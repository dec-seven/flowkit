import { ERROR_CODE, FlowError, getEnabledAction } from '@flowkit/core';
import type {
  ActionKey,
  ApprovalTask,
  FlowAdapter,
  FormSchemaLike,
  StartFlowInput,
  TaskQuery,
  WorkflowDefinition,
  WorkflowInstance,
} from '@flowkit/core';
import type {
  ApprovalState,
  ApprovalStateListener,
  SubmitActionOptions,
  Unsubscribe,
} from './types.ts';

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

  private assertCapabilities(capability: keyof FlowAdapter['capabilities']): void {
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
