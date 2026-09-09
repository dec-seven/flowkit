import Vue, { type CreateElement, type PropType, type VNode } from 'vue';
import type { ApprovalTask, ApprovalHistoryItem } from '@flowkit/core';
import type {
  ApprovalClient,
  ApprovalState,
  Unsubscribe,
} from '@flowkit/headless';

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

export const ApprovalActionBar = Vue.extend<
  { comment: string },
  { submit(action: ApprovalTask['actions'][number]['key']): void },
  Record<string, never>,
  ClientProps & { task: ApprovalTask }
>({
  name: 'ApprovalActionBar',
  props: {
    client: { type: Object as PropType<ApprovalClient>, required: true },
    task: { type: Object as PropType<ApprovalTask>, required: true },
  },
  methods: {
    submit(action) {
      void this.client.executeAction({
        taskId: this.task.id,
        action,
        actionKey: action,
        idempotencyKey: `${this.task.id}-${Date.now()}`,
        comment: this.comment || '',
      });
    },
  },
  data: () => ({ comment: '' }),
  render(h: CreateElement): VNode {
    return h('div', [
      h('textarea', {
        domProps: { value: this.comment },
        on: {
          input: (event: Event) => {
            this.comment = (event.target as HTMLTextAreaElement).value;
          },
        },
      }),
      ...(this.task.actions ?? [])
        .filter((item) => item.enabled)
        .map((item) =>
          h(
            'button',
            { key: item.key, on: { click: () => this.submit(item.key) } },
            item.name,
          ),
        ),
    ]);
  },
});

export const ApprovalDetail = Vue.extend<
  Record<string, never>,
  { refresh(): void },
  Record<string, never>,
  ClientProps & { task: ApprovalTask | null }
>({
  name: 'ApprovalDetail',
  props: {
    client: { type: Object as PropType<ApprovalClient>, required: true },
    task: { type: Object as PropType<ApprovalTask | null>, default: null },
  },
  methods: {
    refresh() {
      if (this.task) void this.client.openTask(this.task.id);
    },
  },
  render(h: CreateElement): VNode {
    if (!this.task) return h('div', '请选择待办');
    return h('section', [
      h('h3', this.task.name),
      this.$scopedSlots.form?.({ task: this.task }) ??
        h('pre', JSON.stringify(this.task.formData?.values ?? {}, null, 2)),
      h('button', { on: { click: this.refresh } }, '刷新'),
    ]);
  },
});

export const ApprovalTimeline = Vue.extend<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  { history: ApprovalHistoryItem[] }
>({
  name: 'ApprovalTimeline',
  props: { history: { type: Array as PropType<ApprovalHistoryItem[]>, default: () => [] } },
  render(h: CreateElement): VNode {
    return h(
      'ol',
      this.history.map((event) =>
        h(
          'li',
          { key: event.id },
          `${event.actionKey ?? '事件'}：${event.comment ?? ''}`,
        ),
      ),
    );
  },
});

export default {
  ApprovalTaskList,
  ApprovalDetail,
  ApprovalActionBar,
  ApprovalTimeline,
};
