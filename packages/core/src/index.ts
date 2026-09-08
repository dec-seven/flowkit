/**
 * Runtime constants and types for the framework-agnostic FlowKit protocol.
 * The object shapes are documented in docs/protocol.md and are intentionally
 * independent of Vue, React, backend engines, and transport details.
 */

export const INSTANCE_STATUS = Object.freeze({
  RUNNING: 'running',
  COMPLETED: 'completed',
  TERMINATED: 'terminated',
  SUSPENDED: 'suspended',
} as const);

export type InstanceStatus = (typeof INSTANCE_STATUS)[keyof typeof INSTANCE_STATUS];

export const TASK_STATUS = Object.freeze({
  TODO: 'todo',
  CLAIMED: 'claimed',
  DONE: 'done',
  TERMINATED: 'terminated',
} as const);

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export const ACTION_KEY = Object.freeze({
  APPROVE: 'approve',
  REJECT: 'reject',
  RETURN: 'return',
  TRANSFER: 'transfer',
  DELEGATE: 'delegate',
  COMMENT: 'comment',
  WITHDRAW: 'withdraw',
} as const);

export type ActionKey = (typeof ACTION_KEY)[keyof typeof ACTION_KEY];

export const ERROR_CODE = Object.freeze({
  INVALID_ACTION: 'FLOW_INVALID_ACTION',
  FORBIDDEN: 'FLOW_FORBIDDEN',
  CONFLICT: 'FLOW_CONFLICT',
  NOT_FOUND: 'FLOW_NOT_FOUND',
  TRIGGER_FAILED: 'FLOW_TRIGGER_FAILED',
} as const);

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

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
  priority: TaskPriority;
  createdAt: string;
  dueAt?: string;
  completedAt?: string;
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
  comment?: string;
  formValues?: Record<string, unknown>;
}

export interface FlowAdapter {
  listInstances(query?: InstanceQuery): Promise<Page<WorkflowInstance>>;
  listTasks(query?: TaskQuery): Promise<Page<ApprovalTask>>;
  getTask(taskId: string): Promise<ApprovalTask>;
  getHistory(instanceId: string): Promise<ApprovalHistoryItem[]>;
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

export class FlowError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'FlowError';
    this.code = code;
    this.details = details;
  }
}

/** Return an enabled action advertised by a task, if it exists. */
export function getEnabledAction(
  task: Pick<ApprovalTask, 'actions'> | null | undefined,
  actionKey: ActionKey,
): ApprovalAction | null {
  return task?.actions?.find((item) => item.key === actionKey && item.enabled) ?? null;
}

export function isTaskOpen(task: Pick<ApprovalTask, 'status'> | null | undefined): boolean {
  return task?.status === TASK_STATUS.TODO || task?.status === TASK_STATUS.CLAIMED;
}

/** Apply the local task/instance result for the three M0 actions. */
export function applyTaskAction(
  task: ApprovalTask,
  instance: WorkflowInstance | undefined,
  actionKey: ActionKey,
  completedAt?: string,
): { task: ApprovalTask; instance: WorkflowInstance | undefined } {
  if (!isTaskOpen(task)) {
    throw new FlowError(ERROR_CODE.INVALID_ACTION, 'Task is already completed');
  }
  if (!getEnabledAction(task, actionKey)) {
    throw new FlowError(ERROR_CODE.INVALID_ACTION, `Action is not available: ${actionKey}`);
  }
  if (actionKey === ACTION_KEY.RETURN) {
    return {
      task: { ...task, status: TASK_STATUS.TODO, completedAt: undefined },
      instance,
    };
  }
  const nextInstanceStatus =
    actionKey === ACTION_KEY.REJECT ? INSTANCE_STATUS.TERMINATED : INSTANCE_STATUS.COMPLETED;
  return {
    task: { ...task, status: TASK_STATUS.DONE, completedAt },
    instance: instance
      ? { ...instance, status: nextInstanceStatus, endedAt: completedAt }
      : instance,
  };
}

/** Merge server policy over schema/UI defaults without mutating either input. */
export function mergeFormPolicy(
  schema: FormSchemaLike,
  ui: FormUiLike = {},
  policy: FormFieldPolicyInput = {},
): Record<string, MergedFormFieldPolicy> {
  const fields = schema?.fields ?? [];
  const visible = new Set(policy.visible ?? fields.map((field) => field.key));
  return fields.reduce<Record<string, MergedFormFieldPolicy>>((result, field) => {
    const key = field.key;
    result[key] = {
      visible: visible.has(key),
      readonly: (policy.readonly ?? []).includes(key),
      required: (policy.required ?? []).includes(key) || Boolean(field.required),
      disabled: (policy.disabled ?? []).includes(key),
      component: ui.fields?.[key]?.component,
      props: ui.fields?.[key]?.props ?? {},
    };
    return result;
  }, {});
}
