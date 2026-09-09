import { ERROR_CODE, FlowError, getEnabledAction } from '@flowkit/core';
import type {
  ActionKey,
  ApprovalHistoryItem,
  ApprovalTask,
  FlowAdapter,
  FormSchemaLike,
  StartFlowInput,
  TaskQuery,
  WorkflowDefinition,
  WorkflowInstance,
} from '@flowkit/core';

export interface ApprovalState {
  tasks: ApprovalTask[];
  selectedTask: ApprovalTask | null;
  selectedInstance: WorkflowInstance | null;
  history: ApprovalHistoryItem[];
  loading: boolean;
  error: string | null;
}

export type ApprovalStateListener = (state: ApprovalState) => void;
export type Unsubscribe = () => boolean;

export interface SubmitActionOptions {
  idempotencyKey: string;
  expectedTaskRevision?: number;
  expectedInstanceRevision?: number;
  comment?: string;
  formValues?: Record<string, unknown>;
}

export interface ApprovalActor {
  id: string;
  name?: string;
}

export interface ExecuteActionInput {
  taskId?: string;
  action?: ActionKey;
  actionKey?: ActionKey;
  idempotencyKey: string;
  expectedTaskRevision?: number;
  expectedInstanceRevision?: number;
  comment?: string;
  dataPatch?: Record<string, unknown>;
}

export type TaskPage = Awaited<ReturnType<FlowAdapter['listTasks']>>;

export interface ApprovalClient {
  store: ApprovalStore;
  actor?: ApprovalActor;
  loadTasks(query?: TaskQuery): Promise<TaskPage>;
  getInstance(instanceId: string): Promise<WorkflowInstance>;
  getDefinition(definitionId: string, version: number): Promise<WorkflowDefinition>;
  getFormSchema(schemaId: string, version: number): Promise<FormSchemaLike>;
  openTask(taskId: string): Promise<ApprovalTask>;
  startFlow(input: StartFlowInput): Promise<WorkflowInstance>;
  getSnapshot(): ApprovalState;
  subscribe(listener: ApprovalStateListener): Unsubscribe;
  executeAction(input: ExecuteActionInput): Promise<ApprovalTask>;
}

const makeInitialState = (): ApprovalState => ({
  tasks: [],
  selectedTask: null,
  selectedInstance: null,
  history: [],
  loading: false,
  error: null,
});

/** Observable workflow state used by Vue, React, or any other UI layer. */
export class ApprovalStore {
  readonly adapter: FlowAdapter;
  private state: ApprovalState = makeInitialState();
  private readonly listeners = new Set<ApprovalStateListener>();

  constructor(adapter: FlowAdapter) {
    if (!adapter) throw new TypeError('ApprovalStore requires an adapter');
    this.adapter = adapter;
  }

  getSnapshot(): ApprovalState {
    return structuredClone(this.state);
  }

  subscribe(listener: ApprovalStateListener): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  async loadTasks(query: TaskQuery = {}) {
    return this.run(async () => {
      const page = await this.adapter.listTasks(query);
      this.state.tasks = page.items;
      return page;
    });
  }

  async openTask(taskId: string): Promise<ApprovalTask> {
    return this.run(async () => {
      const task = await this.adapter.getTask(taskId);
      this.state.selectedTask = task;
      const [instance, history] = await Promise.all([
        this.adapter.getInstance(task.instanceId),
        this.adapter.getHistory(task.instanceId),
      ]);
      this.state.selectedInstance = instance;
      this.state.history = history;
      return task;
    });
  }

  async getInstance(instanceId: string): Promise<WorkflowInstance> {
    return this.run(async () => {
      const instance = await this.adapter.getInstance(instanceId);
      this.state.selectedInstance = instance;
      return instance;
    });
  }

  async getDefinition(definitionId: string, version: number): Promise<WorkflowDefinition> {
    this.assertCapabilities('definitions');
    return this.run(() => this.adapter.getDefinition(definitionId, version));
  }

  async getFormSchema(schemaId: string, version: number): Promise<FormSchemaLike> {
    this.assertCapabilities('formSchemas');
    return this.run(() => this.adapter.getFormSchema(schemaId, version));
  }

  async startFlow(input: StartFlowInput): Promise<WorkflowInstance> {
    this.assertCapabilities('startFlow');
    this.assertCapabilities('idempotency');
    return this.run(async () => {
      const instance = await this.adapter.startFlow(input);
      this.state.selectedInstance = instance;
      this.state.selectedTask = null;
      this.state.history = [];
      const page = await this.adapter.listTasks();
      this.state.tasks = page.items;
      const firstTask = page.items.find((item) => item.instanceId === instance.id);
      if (firstTask) {
        this.state.selectedTask = firstTask;
        this.state.history = await this.adapter.getHistory(instance.id);
      }
      return instance;
    });
  }

  async submitAction(
    actionKey: ActionKey,
    {
      idempotencyKey,
      expectedTaskRevision,
      expectedInstanceRevision,
      comment = '',
      formValues,
    }: SubmitActionOptions,
  ) {
    const task = this.state.selectedTask;
    if (!task) throw new Error('Open a task before submitting an action');
    const instance = this.state.selectedInstance;
    if (!instance) throw new Error('Task instance is not loaded');
    if (!idempotencyKey) throw new Error('idempotencyKey is required');
    if (!getEnabledAction(task, actionKey)) {
      throw new Error(`Action is not available: ${actionKey}`);
    }
    this.assertCapabilities('idempotency');
    this.assertCapabilities('optimisticConcurrency');
    return this.run(async () => {
      const updatedTask = await this.adapter.submitAction({
        taskId: task.id,
        actionKey,
        idempotencyKey,
        expectedTaskRevision: expectedTaskRevision ?? task.revision,
        expectedInstanceRevision: expectedInstanceRevision ?? instance.revision,
        comment,
        formValues,
      });
      this.state.selectedTask = updatedTask;
      const [updatedInstance, history, page] = await Promise.all([
        this.adapter.getInstance(updatedTask.instanceId),
        this.adapter.getHistory(updatedTask.instanceId),
        this.adapter.listTasks(),
      ]);
      this.state.selectedInstance = updatedInstance;
      this.state.history = history;
      this.state.tasks = page.items;
      return updatedTask;
    });
  }

  private assertCapabilities(capability: keyof NonNullable<FlowAdapter['capabilities']>): void {
    if (!this.adapter.capabilities[capability]) {
      throw new FlowError(
        ERROR_CODE.CAPABILITY_UNSUPPORTED,
        `Adapter capability is not supported: ${capability}`,
        { capability },
      );
    }
  }

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    this.state.loading = true;
    this.state.error = null;
    this.emit();
    try {
      return await operation();
    } catch (error) {
      this.state.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      this.state.loading = false;
      this.emit();
    }
  }
}

export function createApprovalStore(adapter: FlowAdapter): ApprovalStore {
  return new ApprovalStore(adapter);
}

/** Public client facade carrying actor and optimistic-concurrency metadata. */
export function createApprovalClient({
  adapter,
  actor,
}: {
  adapter: FlowAdapter;
  actor?: ApprovalActor;
}): ApprovalClient {
  const store = new ApprovalStore(adapter);
  return {
    store,
    actor,
    loadTasks: (query = {}) =>
      store.loadTasks({ ...query, assigneeId: query.assigneeId ?? actor?.id }),
    openTask: (taskId) => store.openTask(taskId),
    getSnapshot: () => store.getSnapshot(),
    subscribe: (listener) => store.subscribe(listener),
    executeAction: (input) => {
      if (!input?.idempotencyKey) throw new Error('idempotencyKey is required');
      const actionKey = input.action ?? input.actionKey;
      if (!actionKey) throw new Error('action or actionKey is required');
      const selectedTaskId = store.getSnapshot().selectedTask?.id;
      if (input.taskId && selectedTaskId && input.taskId !== selectedTaskId) {
        throw new Error('Selected task does not match the requested task');
      }
      return store.submitAction(actionKey, {
        idempotencyKey: input.idempotencyKey,
        expectedTaskRevision: input.expectedTaskRevision,
        expectedInstanceRevision: input.expectedInstanceRevision,
        comment: input.comment,
        formValues: input.dataPatch,
      });
    },
    getInstance: (instanceId) => store.getInstance(instanceId),
    getDefinition: (definitionId, version) => store.getDefinition(definitionId, version),
    getFormSchema: (schemaId, version) => store.getFormSchema(schemaId, version),
    startFlow: (input) => store.startFlow(input),
  };
}
