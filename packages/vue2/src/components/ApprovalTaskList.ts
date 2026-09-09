import Vue, { type CreateElement, type PropType, type VNode } from 'vue';
import type { ApprovalTask } from '@flowkit/core';
import type { ApprovalClient, ApprovalState, Unsubscribe } from '@flowkit/headless';

interface ClientProps {
  client: ApprovalClient;
}

function stateOf(props: Partial<ClientProps>): ApprovalState {
  return (
    props.client?.getSnapshot?.() ?? {
      tasks: [],
      selectedTask: null,
      selectedInstance: null,
      history: [],
      loading: false,
      error: null,
    }
  );
}

export const ApprovalTaskList = Vue.extend<
  { state: ApprovalState; unsubscribe: Unsubscribe | null },
  { open(task: ApprovalTask): void },
  Record<string, never>,
  ClientProps
>({
  name: 'ApprovalTaskList',
  props: { client: { type: Object as PropType<ApprovalClient>, required: true } },
  data() {
    return { state: stateOf(this), unsubscribe: null };
  },
  created() {
    this.unsubscribe = this.client.subscribe((state) => {
      this.state = state;
    });
    void this.client.loadTasks();
  },
  beforeDestroy() {
    this.unsubscribe?.();
  },
  methods: {
    open(task) {
      void this.client.openTask(task.id);
      this.$emit('select', task);
    },
  },
  render(h: CreateElement): VNode {
    const tasks = this.state?.tasks ?? [];
    return h('div', { class: 'flowkit-task-list' }, [
      this.state?.loading ? h('div', '加载中…') : null,
      this.state?.error ? h('div', { class: 'flowkit-error' }, this.state.error) : null,
      ...tasks.map((task) =>
        h(
          'button',
          { key: task.id, on: { click: () => this.open(task) } },
          `${task.name} · ${task.priority}`,
        ),
      ),
      !tasks.length && !this.state?.loading ? h('div', '暂无待办') : null,
    ]);
  },
});
