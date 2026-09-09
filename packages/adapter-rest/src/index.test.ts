import assert from 'node:assert/strict';
import { ACTION_KEY, ERROR_CODE, FlowError } from '@flowkit/core';
import { createRestAdapter } from './index.ts';

const calls: Array<{ url: string; init?: RequestInit }> = [];
const responses: Response[] = [];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const adapter = createRestAdapter({
  baseUrl: 'https://approval.example.test/api',
  getToken: () => 'token-001',
  capabilities: { idempotency: true, optimisticConcurrency: true },
  fetch: async (url, init) => {
    calls.push({ url, init });
    const response = responses.shift();
    if (!response) throw new Error('test response queue is empty');
    return response;
  },
});

responses.push(
  json({
    data: {
      items: [
        {
          id: 'task-001',
          processInstanceId: 'instance-001',
          taskName: '审批',
          status: 'todo',
          version: 4,
          createdAt: '2026-01-01T00:00:00.000Z',
          actions: [{ code: 'approve', label: '同意' }],
        },
      ],
      totalCount: 1,
      current: 2,
      size: 10,
    },
  }),
);
const page = await adapter.listTasks({ status: 'todo', assigneeId: 'user-001', page: 2, pageSize: 10 });
assert.equal(page.items[0]?.instanceId, 'instance-001');
assert.equal(page.items[0]?.revision, 4);
assert.equal(page.page, 2);
assert.match(calls[0]?.url ?? '', /assignee=user-001/);
assert.match(calls[0]?.url ?? '', /page=2/);
assert.equal(new Headers(calls[0]?.init?.headers).get('Authorization'), 'Bearer token-001');

responses.push(
  json({
    task: {
      id: 'task-001',
      instanceId: 'instance-001',
      name: '审批',
      status: 'done',
      revision: 5,
      priority: 'normal',
      createdAt: '2026-01-01T00:00:00.000Z',
      actions: [{ key: 'approve', name: '同意', enabled: true }],
    },
    replayed: true,
  }),
);
const submitted = await adapter.submitAction({
  taskId: 'task-001',
  actionKey: ACTION_KEY.APPROVE,
  idempotencyKey: 'action-001',
  expectedTaskRevision: 4,
  expectedInstanceRevision: 2,
});
assert.equal(submitted.status, 'done');
assert.equal(submitted.replayed, true);
const submitBody = JSON.parse(String(calls[1]?.init?.body));
assert.deepEqual(submitBody, {
  actionKey: 'approve',
  idempotencyKey: 'action-001',
  expectedTaskRevision: 4,
  expectedInstanceRevision: 2,
});

responses.push(
  json(
    {
      error: {
        code: 'FLOW_CONFLICT',
        message: '版本冲突',
        details: {
          resource: 'task',
          currentTaskRevision: 5,
          currentInstanceRevision: 3,
          retryable: true,
        },
      },
    },
    409,
  ),
);
await assert.rejects(
  () =>
    adapter.submitAction({
      taskId: 'task-001',
      actionKey: ACTION_KEY.APPROVE,
      idempotencyKey: 'action-002',
      expectedTaskRevision: 4,
      expectedInstanceRevision: 2,
    }),
  (error: unknown) => {
    assert.ok(error instanceof FlowError);
    assert.equal(error.code, ERROR_CODE.CONFLICT);
    assert.equal(error.details.currentTaskRevision, 5);
    assert.equal(error.details.retryable, true);
    return true;
  },
);

responses.push(
  json({
    data: {
      id: 'instance-001',
      definition: { key: 'leave-approval', version: 1 },
      title: '请假申请',
      status: 'running',
      revision: 2,
      startedAt: '2026-01-01T00:00:00.000Z',
    },
  }),
  json({ data: { id: 'definition-leave', key: 'leave-approval', name: '请假审批', version: 1 } }),
  json({ data: { fields: [{ key: 'days' }], ref: { schemaId: 'leave-request', version: 1 } } }),
  json({ data: [{ id: 'event-001', eventType: 'approve', timestamp: '2026-01-01T00:00:00.000Z' }] }),
  json({
    data: {
      id: 'instance-002',
      definitionKey: 'leave-approval',
      definitionVersion: 1,
      title: '新请假',
      status: 'running',
      revision: 1,
      startedAt: '2026-01-01T00:00:00.000Z',
    },
  }),
);
assert.equal((await adapter.getInstance('instance-001')).revision, 2);
assert.equal((await adapter.getDefinition('definition-leave', 1)).key, 'leave-approval');
assert.equal((await adapter.getFormSchema('leave-request', 1)).ref?.schemaId, 'leave-request');
assert.equal((await adapter.getHistory('instance-001'))[0]?.actionKey, 'approve');
const started = await adapter.startFlow({
  definitionKey: 'leave-approval',
  idempotencyKey: 'start-001',
  formValues: { days: 2 },
});
assert.equal(started.id, 'instance-002');
assert.equal(calls.at(-1)?.init?.method, 'POST');

let authExpired = 0;
const authAdapter = createRestAdapter({
  baseUrl: 'https://approval.example.test',
  onAuthExpired: () => {
    authExpired += 1;
  },
  fetch: async () => json({ message: '登录已过期' }, 401),
});
await assert.rejects(
  () => authAdapter.listInstances(),
  (error: unknown) => error instanceof FlowError && error.code === ERROR_CODE.AUTH_EXPIRED,
);
assert.equal(authExpired, 1);

console.log('rest adapter tests passed');
