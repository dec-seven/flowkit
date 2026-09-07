import assert from 'node:assert/strict';
import { ACTION_KEY, ERROR_CODE, FlowError, applyTaskAction, mergeFormPolicy } from './index.js';

const task = { status: 'todo', actions: [{ key: ACTION_KEY.APPROVE, enabled: true }] };
const instance = { status: 'running' };
assert.equal(applyTaskAction(task, instance, ACTION_KEY.APPROVE, '2026-01-01').task.status, 'done');
assert.throws(() => applyTaskAction({ ...task, status: 'done' }, instance, ACTION_KEY.APPROVE), (error) => error instanceof FlowError && error.code === ERROR_CODE.INVALID_ACTION);
assert.equal(mergeFormPolicy({ fields: [{ key: 'amount', required: true }] }, {}, {}).amount.required, true);
console.log('core tests passed');
