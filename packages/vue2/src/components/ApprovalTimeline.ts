import Vue, { type CreateElement, type PropType, type VNode } from 'vue';
import type { ApprovalHistoryItem } from '@flowkit/core';

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
