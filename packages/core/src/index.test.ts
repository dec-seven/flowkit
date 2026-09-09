import assert from 'node:assert/strict';
import {
  ACTION_KEY,
  ERROR_CODE,
  FlowError,
  applyTaskAction,
  mergeFormPolicy,
} from './index.ts';
import type { ApprovalTask, WorkflowInstance } from './index.ts';

const task: ApprovalTask = {
  id: 'task-001',
  instanceId: 'instance-001',
  name: '审批',
  status: 'todo',
  revision: 1,
  priority: 'normal',
  createdAt: '2026-01-01',
  actions: [{ key: ACTION_KEY.APPROVE, enabled: true, name: '同意' }],
};
const instance: WorkflowInstance = {
  id: 'instance-001',
  definitionKey: 'test',
  definitionVersion: 1,
  title: '测试',
  status: 'running',
  revision: 1,
  startedAt: '2026-01-01',
};

const transitioned = applyTaskAction(task, instance, ACTION_KEY.APPROVE, '2026-01-01');
assert.equal(transitioned.task.status, 'done');
assert.equal(transitioned.task.revision, 2);
assert.equal(transitioned.instance?.revision, 2);
assert.throws(
  () => applyTaskAction({ ...task, status: 'done' }, instance, ACTION_KEY.APPROVE),
  (error: unknown) =>
    error instanceof FlowError && error.code === ERROR_CODE.INVALID_ACTION,
);
assert.equal(
  mergeFormPolicy({ fields: [{ key: 'amount', required: true }] }, {}, {})
    .amount.required,
  true,
);
console.log('core tests passed');
