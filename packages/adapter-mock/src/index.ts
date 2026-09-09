import {
  ACTION_KEY,
  ERROR_CODE,
  FlowError,
  INSTANCE_STATUS,
  TASK_STATUS,
  getEnabledAction,
  isTaskOpen,
} from '@flowkit/core';
import type {
  ActionKey,
  ActionReason,
  ApprovalAction,
  ApprovalHistoryItem,
  ApprovalTask,
  AdapterCapabilities,
  FlowAdapter,
  FormSchemaLike,
  InstanceQuery,
  Page,
  SubmitActionInput,
  StartFlowInput,
  TaskQuery,
  WorkflowDefinition,
  WorkflowInstance,
} from '@flowkit/core';

const DEFAULT_TIME = '2026-01-01T00:00:00.000Z';

interface MockOperator {
  id: string;
  name: string;
}

export interface MockData {
  instances: WorkflowInstance[];
  tasks: ApprovalTask[];
  histories: StoredHistoryItem[];
  definitions?: WorkflowDefinition[];
  formSchemas?: FormSchemaLike[];
}

interface StoredHistoryItem extends ApprovalHistoryItem {
  instanceId: string;
}

export interface MockAdapterOptions {
  data?: MockData;
  now?: () => string;
  operator?: MockOperator;
}

const MOCK_CAPABILITIES: AdapterCapabilities = Object.freeze({
  idempotency: true,
  optimisticConcurrency: true,
  startFlow: true,
  definitions: true,
  formSchemas: true,
});

const makeAction = (
  key: ActionKey,
  name: string,
  reason: ActionReason = 'optional',
): ApprovalAction => ({ key, name, enabled: true, reason });

const clone = <T>(value: T): T => structuredClone(value);

function createFixture(): MockData {
  return {
    definitions: [
      { id: 'definition-purchase', key: 'purchase-approval', name: '采购审批', version: 1, formKey: 'purchase-request' },
      { id: 'definition-leave', key: 'leave-approval', name: '请假审批', version: 1, formKey: 'leave-request' },
    ],
    formSchemas: [
      {
        ref: { schemaId: 'purchase-request', version: 1 },
        fields: [
          { key: 'applicant', type: 'text', label: '申请人' },
          { key: 'amount', type: 'number', label: '金额', required: true },
          { key: 'purpose', type: 'textarea', label: '用途', required: true },
        ],
      },
      {
        ref: { schemaId: 'leave-request', version: 1 },
        fields: [
          { key: 'applicant', type: 'text', label: '申请人' },
          { key: 'days', type: 'number', label: '天数', required: true },
          { key: 'reason', type: 'textarea', label: '原因', required: true },
        ],
      },
    ],
    instances: [
      {
        id: 'instance-purchase-001',
        definitionKey: 'purchase-approval',
        definitionVersion: 1,
        businessKey: 'PO-2026-0001',
        title: '办公设备采购申请',
        status: INSTANCE_STATUS.RUNNING,
        revision: 1,
        startedAt: DEFAULT_TIME,
        startedBy: 'user-requester',
      },
      {
        id: 'instance-leave-001',
        definitionKey: 'leave-approval',
        definitionVersion: 1,
        businessKey: 'LEAVE-2026-0001',
        title: '年假申请（2 天）',
        status: INSTANCE_STATUS.RUNNING,
        revision: 1,
        startedAt: DEFAULT_TIME,
        startedBy: 'user-requester',
      },
    ],
    tasks: [
      {
        id: 'task-purchase-001',
        instanceId: 'instance-purchase-001',
        name: '部门负责人审批',
        assigneeId: 'user-approver',
        assigneeName: '审批人',
        status: TASK_STATUS.TODO,
        revision: 1,
        priority: 'high',
        createdAt: DEFAULT_TIME,
        actions: [
          makeAction(ACTION_KEY.APPROVE, '同意'),
          makeAction(ACTION_KEY.REJECT, '驳回', 'required'),
          makeAction(ACTION_KEY.RETURN, '退回修改'),
        ],
        formData: {
          formKey: 'purchase-request',
          readonly: false,
          values: { applicant: '张三', amount: 12800, purpose: '办公设备' },
        },
      },
      {
        id: 'task-leave-001',
        instanceId: 'instance-leave-001',
        name: '直属领导审批',
        assigneeId: 'user-approver',
        assigneeName: '审批人',
        status: TASK_STATUS.TODO,
        revision: 1,
        priority: 'normal',
        createdAt: DEFAULT_TIME,
        actions: [
          makeAction(ACTION_KEY.APPROVE, '同意'),
          makeAction(ACTION_KEY.REJECT, '驳回', 'required'),
          makeAction(ACTION_KEY.RETURN, '退回修改'),
        ],
        formData: {
          formKey: 'leave-request',
          readonly: false,
          values: { applicant: '李四', days: 2, reason: '家庭事务' },
        },
      },
    ],
    histories: [],
  };
}

/** In-memory adapter for examples and local development; it never uses a network. */
export class MockAdapter implements FlowAdapter {
  readonly capabilities = MOCK_CAPABILITIES;
  private readonly data: MockData;
  private readonly now: () => string;
  private readonly operator: MockOperator;
  private readonly actionResults = new Map<string, ApprovalTask>();
  private readonly startResults = new Map<string, WorkflowInstance>();

  constructor({
    data = createFixture(),
    now = () => DEFAULT_TIME,
    operator = { id: 'user-approver', name: '审批人' },
  }: MockAdapterOptions = {}) {
    this.data = clone(data);
    this.now = now;
    this.operator = operator;
  }

  async listInstances({ status, page = 1, pageSize }: InstanceQuery = {}): Promise<Page<WorkflowInstance>> {
    const instances = this.data.instances.filter((item) => !status || item.status === status);
    const size = pageSize ?? instances.length;
    const start = Math.max(0, (page - 1) * size);
    return {
      items: clone(instances.slice(start, start + size)),
      total: instances.length,
      page,
      pageSize: size,
    };
  }

  async listTasks({ status, assigneeId, page = 1, pageSize }: TaskQuery = {}): Promise<Page<ApprovalTask>> {
    const tasks = this.data.tasks.filter(
      (item) =>
        (!status || item.status === status) &&
        (!assigneeId || item.assigneeId === assigneeId),
    );
    const size = pageSize ?? tasks.length;
    const start = Math.max(0, (page - 1) * size);
    return {
      items: clone(tasks.slice(start, start + size)),
      total: tasks.length,
      page,
      pageSize: size,
    };
  }

  async getInstance(instanceId: string): Promise<WorkflowInstance> {
    const instance = this.data.instances.find((item) => item.id === instanceId);
    if (!instance) {
      throw new FlowError(ERROR_CODE.NOT_FOUND, `Instance not found: ${instanceId}`, {
        resource: 'instance',
        instanceId,
      });
    }
    return clone(instance);
  }

  async getDefinition(definitionId: string, version: number): Promise<WorkflowDefinition> {
    const definition = this.data.definitions?.find(
      (item) => (item.id === definitionId || item.key === definitionId) && item.version === version,
    );
    if (!definition) {
      throw new FlowError(ERROR_CODE.NOT_FOUND, `Definition not found: ${definitionId}@${version}`, {
        resource: 'definition',
        definitionId,
        version,
      });
    }
    return clone(definition);
  }

  async getFormSchema(schemaId: string, version: number): Promise<FormSchemaLike> {
    const schema = this.data.formSchemas?.find(
      (item) =>
        item.ref?.schemaId === schemaId &&
        item.ref?.version === version,
    );
    if (!schema) {
      throw new FlowError(ERROR_CODE.NOT_FOUND, `Form schema not found: ${schemaId}@${version}`, {
        resource: 'formSchema',
        schemaId,
        version,
      });
    }
    return clone(schema);
  }

  async startFlow({
    definitionKey,
    definitionVersion = 1,
    businessKey,
    title,
    formValues,
    idempotencyKey,
  }: StartFlowInput): Promise<WorkflowInstance> {
    if (!idempotencyKey) {
      throw new FlowError(ERROR_CODE.INVALID_ACTION, 'idempotencyKey is required');
    }
    const replay = this.startResults.get(idempotencyKey);
    if (replay) return { ...clone(replay), replayed: true };

    const definition = await this.getDefinition(definitionKey, definitionVersion);
    const createdAt = this.now();
    const instance: WorkflowInstance = {
      id: `instance-${this.data.instances.length + 1}`,
      definitionKey: definition.key,
      definitionVersion: definition.version,
      businessKey,
      title: title ?? definition.name,
      status: INSTANCE_STATUS.RUNNING,
      revision: 1,
      startedAt: createdAt,
      startedBy: this.operator.id,
    };
    this.data.instances.push(instance);
    this.data.tasks.push({
      id: `task-${this.data.tasks.length + 1}`,
      instanceId: instance.id,
      name: '首节点审批',
      assigneeId: this.operator.id,
      assigneeName: this.operator.name,
      status: TASK_STATUS.TODO,
      revision: 1,
      priority: 'normal',
      createdAt,
      actions: [
        makeAction(ACTION_KEY.APPROVE, '同意'),
        makeAction(ACTION_KEY.REJECT, '驳回', 'required'),
        makeAction(ACTION_KEY.RETURN, '退回修改'),
      ],
      formData: {
        formKey: definition.formKey,
        readonly: false,
        values: formValues ?? {},
      },
    });
    this.startResults.set(idempotencyKey, clone(instance));
    return clone(instance);
  }

  async getTask(taskId: string): Promise<ApprovalTask> {
    const task = this.data.tasks.find((item) => item.id === taskId);
    if (!task) {
      throw new FlowError(ERROR_CODE.NOT_FOUND, `Task not found: ${taskId}`, {
        resource: 'task',
        taskId,
      });
    }
    return clone(task);
  }

  async getHistory(instanceId: string): Promise<ApprovalHistoryItem[]> {
    return clone(this.data.histories.filter((item) => item.instanceId === instanceId));
  }

  async submitAction({
    taskId,
    actionKey,
    idempotencyKey,
    expectedTaskRevision,
    expectedInstanceRevision,
    comment = '',
    formValues,
  }: SubmitActionInput): Promise<ApprovalTask> {
    if (!idempotencyKey) {
      throw new FlowError(ERROR_CODE.INVALID_ACTION, 'idempotencyKey is required');
    }
    const replay = this.actionResults.get(idempotencyKey);
    if (replay) return { ...clone(replay), replayed: true };

    const task = this.data.tasks.find((item) => item.id === taskId);
    if (!task) {
      throw new FlowError(ERROR_CODE.NOT_FOUND, `Task not found: ${taskId}`, {
        resource: 'task',
        taskId,
      });
    }
    const instance = this.data.instances.find((item) => item.id === task.instanceId);
    if (!instance) {
      throw new FlowError(ERROR_CODE.NOT_FOUND, `Instance not found: ${task.instanceId}`, {
        resource: 'instance',
        instanceId: task.instanceId,
      });
    }
    if (
      task.revision !== expectedTaskRevision ||
      instance.revision !== expectedInstanceRevision
    ) {
      throw new FlowError(ERROR_CODE.CONFLICT, 'Task or instance revision is stale', {
        resource: task.revision !== expectedTaskRevision ? 'task' : 'instance',
        taskId: task.id,
        instanceId: instance.id,
        expectedTaskRevision,
        expectedInstanceRevision,
        currentTaskRevision: task.revision,
        currentInstanceRevision: instance.revision,
        retryable: true,
      });
    }
    if (!isTaskOpen(task)) throw new Error('Task is already completed');
    if (!getEnabledAction(task, actionKey)) {
      throw new Error(`Action is not available: ${actionKey}`);
    }
    if (
      (actionKey === ACTION_KEY.REJECT || actionKey === ACTION_KEY.RETURN) &&
      !comment.trim()
    ) {
      throw new Error('Comment is required for reject and return actions');
    }

    if (formValues) {
      task.formData = {
        ...task.formData,
        values: { ...(task.formData?.values ?? {}), ...formValues },
        readonly: task.formData?.readonly ?? false,
      };
    }
    const createdAt = this.now();
    task.revision += 1;
    instance.revision += 1;
    if (actionKey === ACTION_KEY.RETURN) {
      task.status = TASK_STATUS.TODO;
      delete task.completedAt;
    } else {
      task.status = TASK_STATUS.DONE;
      task.completedAt = createdAt;
      if (instance) {
        instance.status =
          actionKey === ACTION_KEY.REJECT
            ? INSTANCE_STATUS.TERMINATED
            : INSTANCE_STATUS.COMPLETED;
        instance.endedAt = createdAt;
      }
    }
    this.data.histories.push({
      id: `history-${this.data.histories.length + 1}`,
      instanceId: task.instanceId,
      taskId: task.id,
      actionKey,
      operatorId: this.operator.id,
      operatorName: this.operator.name,
      comment: comment.trim() || undefined,
      createdAt,
    });
    const result = clone(task);
    this.actionResults.set(idempotencyKey, result);
    return result;
  }
}

export function createMockAdapter(options?: MockAdapterOptions): MockAdapter {
  return new MockAdapter(options);
}
