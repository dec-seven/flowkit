import Vue, { type CreateElement, type PropType, type VNode } from 'vue';
import type { ApprovalTask } from '@flowkit/core';
import type { ApprovalClient } from '@flowkit/headless';

export const ApprovalActionBar = Vue.extend<
  { comment: string },
  { submit(action: ApprovalTask['actions'][number]['key']): void },
  Record<string, never>,
  { client: ApprovalClient; task: ApprovalTask }
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
