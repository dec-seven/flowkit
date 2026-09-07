import { ACTION_KEY, INSTANCE_STATUS, TASK_STATUS, getEnabledAction, isTaskOpen } from '@flowkit/core';

const DEFAULT_TIME = '2026-01-01T00:00:00.000Z';
const makeAction = (key, name, reason = 'optional') => ({ key, name, enabled: true, reason });
const clone = (value) => structuredClone(value);

function createFixture() {
  return {
    instances: [
      {
        id: 'instance-purchase-001',
        definitionKey: 'purchase-approval',
        definitionVersion: 1,
        businessKey: 'PO-2026-0001',
        title: '办公设备采购申请',
        status: INSTANCE_STATUS.RUNNING,
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
        startedAt: DEFAULT_TIME,
        startedBy: 'user-requester',
      },
    ],
    tasks: [
      {
        id: 'task-purchase-001', instanceId: 'instance-purchase-001', name: '部门负责人审批',
        assigneeId: 'user-approver', assigneeName: '审批人', status: TASK_STATUS.TODO, priority: 'high', createdAt: DEFAULT_TIME,
        actions: [makeAction(ACTION_KEY.APPROVE, '同意'), makeAction(ACTION_KEY.REJECT, '驳回', 'required'), makeAction(ACTION_KEY.RETURN, '退回修改')],
        formData: { formKey: 'purchase-request', readonly: false, values: { applicant: '张三', amount: 12800, purpose: '办公设备' } },
      },
      {
        id: 'task-leave-001', instanceId: 'instance-leave-001', name: '直属领导审批',
        assigneeId: 'user-approver', assigneeName: '审批人', status: TASK_STATUS.TODO, priority: 'normal', createdAt: DEFAULT_TIME,
        actions: [makeAction(ACTION_KEY.APPROVE, '同意'), makeAction(ACTION_KEY.REJECT, '驳回', 'required'), makeAction(ACTION_KEY.RETURN, '退回修改')],
        formData: { formKey: 'leave-request', readonly: false, values: { applicant: '李四', days: 2, reason: '家庭事务' } },
      },
    ],
    histories: [],
  };
}

/** In-memory adapter for examples and local development; it never uses a network. */
export class MockAdapter {
  constructor({ data = createFixture(), now = () => DEFAULT_TIME, operator = { id: 'user-approver', name: '审批人' } } = {}) {
    this.data = clone(data);
    this.now = now;
    this.operator = operator;
  }

  async listInstances({ status } = {}) {
    const instances = this.data.instances.filter((item) => !status || item.status === status);
    return { items: clone(instances), total: instances.length, page: 1, pageSize: instances.length };
  }

  async listTasks({ status, assigneeId } = {}) {
    const tasks = this.data.tasks.filter((item) => (!status || item.status === status) && (!assigneeId || item.assigneeId === assigneeId));
    return { items: clone(tasks), total: tasks.length, page: 1, pageSize: tasks.length };
  }

  async getTask(taskId) {
    const task = this.data.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    return clone(task);
  }

  async getHistory(instanceId) {
    return clone(this.data.histories.filter((item) => item.instanceId === instanceId));
  }

  async submitAction({ taskId, actionKey, comment = '', formValues } = {}) {
    const task = this.data.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (!isTaskOpen(task)) throw new Error('Task is already completed');
    if (!getEnabledAction(task, actionKey)) throw new Error(`Action is not available: ${actionKey}`);
    if ((actionKey === ACTION_KEY.REJECT || actionKey === ACTION_KEY.RETURN) && !comment.trim()) throw new Error('Comment is required for reject and return actions');

    if (formValues) task.formData = { ...task.formData, values: { ...task.formData.values, ...formValues } };
    const createdAt = this.now();
    const instance = this.data.instances.find((item) => item.id === task.instanceId);
    if (actionKey === ACTION_KEY.RETURN) {
      task.status = TASK_STATUS.TODO;
      delete task.completedAt;
    } else {
      task.status = TASK_STATUS.DONE;
      task.completedAt = createdAt;
      if (instance) {
        instance.status = actionKey === ACTION_KEY.REJECT ? INSTANCE_STATUS.TERMINATED : INSTANCE_STATUS.COMPLETED;
        instance.endedAt = createdAt;
      }
    }
    this.data.histories.push({
      id: `history-${this.data.histories.length + 1}`, instanceId: task.instanceId, taskId: task.id, actionKey,
      operatorId: this.operator.id, operatorName: this.operator.name, comment: comment.trim() || undefined, createdAt,
    });
    return clone(task);
  }
}

export function createMockAdapter(options) {
  return new MockAdapter(options);
}
