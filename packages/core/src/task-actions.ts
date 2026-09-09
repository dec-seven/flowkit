import { ACTION_KEY, ERROR_CODE, INSTANCE_STATUS, TASK_STATUS } from './constants.ts';
import type { ActionKey } from './constants.ts';
import { FlowError } from './errors.ts';
import type { ApprovalAction, ApprovalTask, WorkflowInstance } from './types.ts';

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
      task: {
        ...task,
        status: TASK_STATUS.TODO,
        revision: task.revision + 1,
        completedAt: undefined,
      },
      instance: instance ? { ...instance, revision: instance.revision + 1 } : instance,
    };
  }
  const nextInstanceStatus =
    actionKey === ACTION_KEY.REJECT ? INSTANCE_STATUS.TERMINATED : INSTANCE_STATUS.COMPLETED;
  return {
    task: { ...task, status: TASK_STATUS.DONE, revision: task.revision + 1, completedAt },
    instance: instance
      ? {
          ...instance,
          status: nextInstanceStatus,
          revision: instance.revision + 1,
          endedAt: completedAt,
        }
      : instance,
  };
}
