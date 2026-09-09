export const INSTANCE_STATUS = Object.freeze({
  RUNNING: 'running',
  COMPLETED: 'completed',
  TERMINATED: 'terminated',
  SUSPENDED: 'suspended',
} as const);

export const TASK_STATUS = Object.freeze({
  TODO: 'todo',
  CLAIMED: 'claimed',
  DONE: 'done',
  TERMINATED: 'terminated',
} as const);

export const ACTION_KEY = Object.freeze({
  APPROVE: 'approve',
  REJECT: 'reject',
  RETURN: 'return',
  TRANSFER: 'transfer',
  DELEGATE: 'delegate',
  COMMENT: 'comment',
  WITHDRAW: 'withdraw',
} as const);

export const ERROR_CODE = Object.freeze({
  INVALID_ACTION: 'FLOW_INVALID_ACTION',
  FORBIDDEN: 'FLOW_FORBIDDEN',
  AUTH_EXPIRED: 'FLOW_AUTH_EXPIRED',
  CAPABILITY_UNSUPPORTED: 'FLOW_CAPABILITY_UNSUPPORTED',
  CONFLICT: 'FLOW_CONFLICT',
  NOT_FOUND: 'FLOW_NOT_FOUND',
  TRIGGER_FAILED: 'FLOW_TRIGGER_FAILED',
} as const);

export type InstanceStatus = (typeof INSTANCE_STATUS)[keyof typeof INSTANCE_STATUS];
export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];
export type ActionKey = (typeof ACTION_KEY)[keyof typeof ACTION_KEY];
export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];
