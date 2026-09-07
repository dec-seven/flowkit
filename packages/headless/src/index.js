import { getEnabledAction } from '@flowkit/core';

const makeInitialState = () => ({ tasks: [], selectedTask: null, history: [], loading: false, error: null });

/** Observable workflow state used by Vue, React, or any other UI layer. */
export class ApprovalStore {
  constructor(adapter) {
    if (!adapter) throw new TypeError('ApprovalStore requires an adapter');
    this.adapter = adapter;
    this.state = makeInitialState();
    this.listeners = new Set();
  }

  getSnapshot() { return structuredClone(this.state); }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  async loadTasks(query = {}) {
    return this.run(async () => {
      const page = await this.adapter.listTasks(query);
      this.state.tasks = page.items;
      return page;
    });
  }

  async openTask(taskId) {
    return this.run(async () => {
      const task = await this.adapter.getTask(taskId);
      this.state.selectedTask = task;
      this.state.history = await this.adapter.getHistory(task.instanceId);
      return task;
    });
  }

  async submitAction(actionKey, { comment = '', formValues } = {}) {
    const task = this.state.selectedTask;
    if (!task) throw new Error('Open a task before submitting an action');
    if (!getEnabledAction(task, actionKey)) throw new Error(`Action is not available: ${actionKey}`);
    return this.run(async () => {
      const updatedTask = await this.adapter.submitAction({ taskId: task.id, actionKey, comment, formValues });
      this.state.selectedTask = updatedTask;
      this.state.history = await this.adapter.getHistory(updatedTask.instanceId);
      this.state.tasks = (await this.adapter.listTasks()).items;
      return updatedTask;
    });
  }

  async run(operation) {
    this.state.loading = true;
    this.state.error = null;
    this.emit();
    try { return await operation(); }
    catch (error) { this.state.error = error instanceof Error ? error.message : String(error); throw error; }
    finally { this.state.loading = false; this.emit(); }
  }
}

export function createApprovalStore(adapter) { return new ApprovalStore(adapter); }
