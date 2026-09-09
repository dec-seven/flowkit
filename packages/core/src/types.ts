import type { ActionKey, InstanceStatus, TaskStatus } from './constants.ts';

export interface WorkflowDefinition {
  id: string;
  key: string;
  name: string;
  version: number;
  formKey?: string;
}

export interface WorkflowInstance {
  id: string;
  definitionKey: string;
  definitionVersion: number;
  businessKey?: string;
  title: string;
  status: InstanceStatus;
  /** Monotonically increasing server version used for optimistic concurrency. */
  revision: number;
  /** Set only on a replayed start command response; not persisted as instance state. */
  replayed?: boolean;
  startedAt: string;
  endedAt?: string;
  startedBy?: string;
}

export type ActionReason = 'required' | 'optional';

export interface ApprovalAction {
  key: ActionKey;
  name: string;
  enabled: boolean;
  reason?: ActionReason;
}

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ApprovalFormData {
  formKey?: string;
  values: Record<string, unknown>;
  readonly: boolean;
}

export interface ApprovalTask {
  id: string;
  instanceId: string;
  name: string;
  assigneeId?: string;
  assigneeName?: string;
  candidateGroupIds?: string[];
  status: TaskStatus;
  /** Monotonically increasing server version used for optimistic concurrency. */
  revision: number;
  priority: TaskPriority;
  createdAt: string;
  dueAt?: string;
  completedAt?: string;
  /** Set only on a replayed command response; not persisted as task state. */
  replayed?: boolean;
  actions: ApprovalAction[];
  formData?: ApprovalFormData;
}

export interface ApprovalHistoryItem {
  id: string;
  taskId?: string;
  actionKey?: ActionKey;
  operatorId?: string;
  operatorName?: string;
  comment?: string;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InstanceQuery {
  status?: InstanceStatus;
  page?: number;
  pageSize?: number;
}

export interface TaskQuery {
  status?: TaskStatus;
  assigneeId?: string;
  page?: number;
  pageSize?: number;
}

export interface SubmitActionInput {
  taskId: string;
  actionKey: ActionKey;
  /** Unique key for one logical command; retries with the same key are replay-safe. */
  idempotencyKey: string;
  /** Versions observed by the caller before issuing this command. */
  expectedTaskRevision: number;
  expectedInstanceRevision: number;
  comment?: string;
  formValues?: Record<string, unknown>;
}

export interface StartFlowInput {
  definitionKey: string;
  definitionVersion?: number;
  businessKey?: string;
  title?: string;
  formValues?: Record<string, unknown>;
  idempotencyKey: string;
}

export interface ConflictDetails {
  resource: 'task' | 'instance';
  currentTaskRevision: number;
  currentInstanceRevision: number;
  retryable: boolean;
  expectedTaskRevision?: number;
  expectedInstanceRevision?: number;
  taskId?: string;
  instanceId?: string;
  [property: string]: unknown;
}

export interface AdapterCapabilities {
  idempotency: boolean;
  optimisticConcurrency: boolean;
  startFlow?: boolean;
  definitions?: boolean;
  formSchemas?: boolean;
  parallel?: boolean;
  multiInstance?: boolean;
  timeout?: boolean;
}

export interface FlowAdapter {
  readonly capabilities: AdapterCapabilities;
  listInstances(query?: InstanceQuery): Promise<Page<WorkflowInstance>>;
  listTasks(query?: TaskQuery): Promise<Page<ApprovalTask>>;
  getInstance(instanceId: string): Promise<WorkflowInstance>;
  getDefinition(definitionId: string, version: number): Promise<WorkflowDefinition>;
  getFormSchema(schemaId: string, version: number): Promise<FormSchemaLike>;
  getTask(taskId: string): Promise<ApprovalTask>;
  getHistory(instanceId: string): Promise<ApprovalHistoryItem[]>;
  startFlow(input: StartFlowInput): Promise<WorkflowInstance>;
  submitAction(input: SubmitActionInput): Promise<ApprovalTask>;
}

export interface FormFieldPolicyInput {
  visible?: string[];
  readonly?: string[];
  required?: string[];
  disabled?: string[];
}

export interface FormFieldDefinition {
  key: string;
  required?: boolean;
  [property: string]: unknown;
}

export interface FormSchemaLike {
  ref?: { schemaId: string; version: number };
  fields?: FormFieldDefinition[];
}

export interface FormUiField {
  component?: string;
  props?: Record<string, unknown>;
}

export interface FormUiLike {
  fields?: Record<string, FormUiField | undefined>;
}

export interface MergedFormFieldPolicy {
  visible: boolean;
  readonly: boolean;
  required: boolean;
  disabled: boolean;
  component?: string;
  props: Record<string, unknown>;
}
