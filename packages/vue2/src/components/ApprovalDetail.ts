import Vue, { type CreateElement, type PropType, type VNode } from 'vue';
import type { ApprovalTask } from '@flowkit/core';
import type { ApprovalClient } from '@flowkit/headless';

export const ApprovalDetail = Vue.extend<
  Record<string, never>,
  { refresh(): void },
  Record<string, never>,
  { client: ApprovalClient; task: ApprovalTask | null }
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
