import { ACTION_KEY } from '@flowkit/core';
import { createMockAdapter } from '@flowkit/adapter-mock';
import { createApprovalStore } from '@flowkit/headless';

// This is the sequence a Vue 2 component would call from its methods.
const store = createApprovalStore(createMockAdapter());
await store.loadTasks({ status: 'todo', assigneeId: 'user-approver' });
const firstTask = store.getSnapshot().tasks[0];
if (!firstTask) throw new Error('The mock adapter did not return a task');
await store.openTask(firstTask.id);
await store.submitAction(ACTION_KEY.APPROVE, { comment: '预算和用途已确认' });

const snapshot = store.getSnapshot();
console.log(`待办数：${snapshot.tasks.filter((task) => task.status === 'todo').length}`);
console.log(`任务状态：${snapshot.selectedTask?.status ?? 'none'}`);
console.log(`审批历史：${snapshot.history.length} 条`);
