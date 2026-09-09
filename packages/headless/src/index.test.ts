import assert from 'node:assert/strict';
import { ACTION_KEY, ERROR_CODE, FlowError } from '@flowkit/core';
import { createMockAdapter } from '../../adapter-mock/src/index.ts';
import { createApprovalClient } from './index.ts';

const adapter = createMockAdapter();
const client = createApprovalClient({
  adapter,
  actor: { id: 'user-approver', name: '审批人' },
});

await client.loadTasks();
const first = client.getSnapshot().tasks[0];
assert.ok(first);
await client.openTask(first.id);
const opened = client.getSnapshot();
assert.equal(opened.selectedTask?.revision, 1);
assert.equal(opened.selectedInstance?.revision, 1);

const updated = await client.executeAction({
  taskId: first.id,
  action: ACTION_KEY.APPROVE,
  idempotencyKey: 'headless-approve-001',
  comment: '审批通过',
});
assert.equal(updated.status, 'done');
assert.equal(client.getSnapshot().selectedInstance?.revision, 2);
assert.equal(client.getSnapshot().history.length, 1);

const started = await client.startFlow({
  definitionKey: 'leave-approval',
  idempotencyKey: 'headless-start-001',
  formValues: { days: 1 },
});
assert.equal(client.getSnapshot().selectedInstance?.id, started.id);
assert.equal(client.getSnapshot().selectedTask?.instanceId, started.id);

const unsupportedAdapter = createMockAdapter();
Object.defineProperty(unsupportedAdapter, 'capabilities', {
  value: { ...unsupportedAdapter.capabilities, optimisticConcurrency: false },
});
const unsupportedClient = createApprovalClient({ adapter: unsupportedAdapter });
await unsupportedClient.loadTasks();
const unsupportedTask = unsupportedClient.getSnapshot().tasks[0];
assert.ok(unsupportedTask);
await unsupportedClient.openTask(unsupportedTask.id);
await assert.rejects(
  () =>
    unsupportedClient.executeAction({
      action: ACTION_KEY.APPROVE,
      idempotencyKey: 'unsupported-001',
    }),
  (error: unknown) => error instanceof FlowError && error.code === ERROR_CODE.CAPABILITY_UNSUPPORTED,
);

console.log('headless tests passed');
