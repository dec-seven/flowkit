import { getEnabledAction } from '@flowkit/core';
import type {
  ActionKey,
  ApprovalHistoryItem,
  ApprovalTask,
  FlowAdapter,
  TaskQuery,
} from '@flowkit/core';

export interface ApprovalState {
  tasks: ApprovalTask[];
  selectedTask: ApprovalTask | null;
  history: ApprovalHistoryItem[];
  loading: boolean;
  error: string | null;
}

export type ApprovalStateListener = (state: ApprovalState) => void;
export type Unsubscribe = () => boolean;

export interface SubmitActionOptions {
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
  comment?: string;
  dataPatch?: Record<string, unknown>;
}

export type TaskPage = Awaited<ReturnType<FlowAdapter['listTasks']>>;

export interface ApprovalClient {
  store: ApprovalStore;
  actor?: ApprovalActor;
  loadTasks(query?: TaskQuery): Promise<TaskPage>;
  openTask(taskId: string): Promise<ApprovalTask>;
  getSnapshot(): ApprovalState;
  subscribe(listener: ApprovalStateListener): Unsubscribe;
  executeAction(input: ExecuteActionInput): Promise<ApprovalTask>;
}

const makeInitialState = (): ApprovalState => ({
  tasks: [],
  selectedTask: null,
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
      this.state.history = await this.adapter.getHistory(task.instanceId);
      return task;
    });
  }

  async submitAction(actionKey: ActionKey, { comment = '', formValues }: SubmitActionOptions = {}) {
    const task = this.state.selectedTask;
    if (!task) throw new Error('Open a task before submitting an action');
    if (!getEnabledAction(task, actionKey)) {
      throw new Error(`Action is not available: ${actionKey}`);
    }
    return this.run(async () => {
      const updatedTask = await this.adapter.submitAction({
        taskId: task.id,
        actionKey,
        comment,
        formValues,
      });
      this.state.selectedTask = updatedTask;
      this.state.history = await this.adapter.getHistory(updatedTask.instanceId);
      this.state.tasks = (await this.adapter.listTasks()).items;
      return updatedTask;
    });
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
      return store.submitAction(actionKey, {
        comment: input.comment,
        formValues: input.dataPatch,
      });
    },
  };
}
