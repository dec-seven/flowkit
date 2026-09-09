import type { FlowAdapter } from '@flowkit/core';
import { ApprovalStore } from './approval-store.ts';
import type { ApprovalActor, ApprovalClient } from './types.ts';

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
