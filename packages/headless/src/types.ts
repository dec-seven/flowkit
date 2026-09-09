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
import type { ApprovalStore } from './approval-store.ts';

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
