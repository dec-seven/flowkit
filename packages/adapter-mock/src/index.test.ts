import assert from 'node:assert/strict';
import { ACTION_KEY, ERROR_CODE, FlowError } from '@flowkit/core';
import { createMockAdapter } from './index.ts';

const adapter = createMockAdapter();
const task = (await adapter.listTasks({ assigneeId: 'user-approver' })).items[0];
assert.ok(task, 'fixture should contain a task');
const instance = await adapter.getInstance(task.instanceId);

const command = {
  taskId: task.id,
  actionKey: ACTION_KEY.APPROVE,
  idempotencyKey: 'test-approve-001',
  expectedTaskRevision: task.revision,
  expectedInstanceRevision: instance.revision,
  comment: '已确认',
};

const first = await adapter.submitAction(command);
assert.equal(first.status, 'done');
assert.equal(first.revision, task.revision + 1);
assert.equal((await adapter.getInstance(task.instanceId)).revision, instance.revision + 1);

const replay = await adapter.submitAction(command);
assert.equal(replay.id, first.id);
assert.equal(replay.replayed, true);
assert.equal((await adapter.getHistory(task.instanceId)).length, 1);

await assert.rejects(
  () =>
    adapter.submitAction({
      ...command,
      idempotencyKey: 'test-approve-stale',
    }),
  (error: unknown) => {
    assert.ok(error instanceof FlowError);
    assert.equal(error.code, ERROR_CODE.CONFLICT);
    assert.equal(error.details.currentTaskRevision, task.revision + 1);
    assert.equal(error.details.currentInstanceRevision, instance.revision + 1);
    assert.equal(error.details.retryable, true);
    return true;
  },
);

const started = await adapter.startFlow({
  definitionKey: 'leave-approval',
  definitionVersion: 1,
  idempotencyKey: 'test-start-001',
  formValues: { days: 1 },
});
const startedReplay = await adapter.startFlow({
  definitionKey: 'leave-approval',
  definitionVersion: 1,
  idempotencyKey: 'test-start-001',
  formValues: { days: 99 },
});
assert.equal(startedReplay.id, started.id);
assert.equal(startedReplay.replayed, true);
assert.equal((await adapter.listInstances()).items.filter((item) => item.id === started.id).length, 1);

console.log('mock adapter tests passed');
