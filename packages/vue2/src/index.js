function stateOf(props) { return props.client?.getSnapshot?.() ?? { tasks: [], selectedTask: null, history: [], loading: false, error: null }; }

export const ApprovalTaskList = {
  name: 'ApprovalTaskList',
  props: { client: { type: Object, required: true } },
  created() { this.unsubscribe = this.client.subscribe((state) => { this.state = state; }); this.state = stateOf(this); this.client.loadTasks(); },
  beforeDestroy() { this.unsubscribe?.(); },
  methods: { open(task) { this.client.openTask(task.id); this.$emit('select', task); } },
  render(h) {
    const tasks = this.state?.tasks ?? [];
    return h('div', { class: 'flowkit-task-list' }, [
      this.state?.loading ? h('div', '加载中…') : null,
      this.state?.error ? h('div', { class: 'flowkit-error' }, this.state.error) : null,
      ...tasks.map((task) => h('button', { key: task.id, on: { click: () => this.open(task) } }, `${task.name} · ${task.priority}`)),
      !tasks.length && !this.state?.loading ? h('div', '暂无待办') : null,
    ]);
  },
};

export const ApprovalActionBar = {
  name: 'ApprovalActionBar',
  props: { client: { type: Object, required: true }, task: { type: Object, required: true } },
  methods: { submit(action) { this.client.executeAction({ taskId: this.task.id, action, actionKey: action, idempotencyKey: `${this.task.id}-${Date.now()}`, comment: this.comment || '' }); } },
  data: () => ({ comment: '' }),
  render(h) { return h('div', [h('textarea', { domProps: { value: this.comment }, on: { input: (event) => { this.comment = event.target.value; } } }), ...(this.task.actions ?? []).filter((item) => item.enabled).map((item) => h('button', { key: item.key, on: { click: () => this.submit(item.key) } }, item.name))]); },
};

export const ApprovalDetail = {
  name: 'ApprovalDetail',
  props: { client: { type: Object, required: true }, task: { type: Object, default: null } },
  methods: { refresh() { if (this.task) this.client.openTask(this.task.id); } },
  render(h) { if (!this.task) return h('div', '请选择待办'); return h('section', [h('h3', this.task.name), this.$scopedSlots.form?.({ task: this.task }) ?? h('pre', JSON.stringify(this.task.formData?.values ?? {}, null, 2)), h('button', { on: { click: this.refresh } }, '刷新')]); },
};

export const ApprovalTimeline = {
  name: 'ApprovalTimeline',
  props: { history: { type: Array, default: () => [] } },
  render(h) { return h('ol', this.history.map((event) => h('li', { key: event.id }, `${event.actionKey ?? '事件'}：${event.comment ?? ''}`))); },
};

export default { ApprovalTaskList, ApprovalDetail, ApprovalActionBar, ApprovalTimeline };
