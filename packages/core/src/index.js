/**
 * Runtime constants for the framework-agnostic FlowKit protocol.
 * The object shapes are documented in docs/protocol.md and deliberately use
 * plain JavaScript so adapters can be consumed from any frontend framework.
 */

export const INSTANCE_STATUS = Object.freeze({
  RUNNING: 'running',
  COMPLETED: 'completed',
  TERMINATED: 'terminated',
  SUSPENDED: 'suspended',
});

export const TASK_STATUS = Object.freeze({
  TODO: 'todo',
  CLAIMED: 'claimed',
  DONE: 'done',
  TERMINATED: 'terminated',
});

export const ACTION_KEY = Object.freeze({
  APPROVE: 'approve',
  REJECT: 'reject',
  RETURN: 'return',
  TRANSFER: 'transfer',
  DELEGATE: 'delegate',
  COMMENT: 'comment',
  WITHDRAW: 'withdraw',
});

/** Return an enabled action advertised by a task, if it exists. */
export function getEnabledAction(task, actionKey) {
  return task?.actions?.find((item) => item.key === actionKey && item.enabled) ?? null;
}

export function isTaskOpen(task) {
  return task?.status === TASK_STATUS.TODO || task?.status === TASK_STATUS.CLAIMED;
}

/** Apply the local task/instance result for the three M0 actions. */
export function applyTaskAction(task, instance, actionKey, completedAt) {
  if (!isTaskOpen(task)) throw new Error('Task is already completed');
  if (!getEnabledAction(task, actionKey)) throw new Error(`Action is not available: ${actionKey}`);
  if (actionKey === ACTION_KEY.RETURN) {
    return { task: { ...task, status: TASK_STATUS.TODO, completedAt: undefined }, instance };
  }
  const nextInstanceStatus = actionKey === ACTION_KEY.REJECT ? INSTANCE_STATUS.TERMINATED : INSTANCE_STATUS.COMPLETED;
  return {
    task: { ...task, status: TASK_STATUS.DONE, completedAt },
    instance: instance ? { ...instance, status: nextInstanceStatus, endedAt: completedAt } : instance,
  };
}
