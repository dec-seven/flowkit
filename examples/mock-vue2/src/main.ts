import Vue from 'vue';
import App from './App.vue';
import { createMockAdapter } from '@flowkit/adapter-mock';
import { createApprovalClient } from '@flowkit/headless';
import {
  ApprovalTaskList,
  ApprovalDetail,
  ApprovalActionBar,
  ApprovalTimeline,
} from '@flowkit/vue2';

Vue.component('ApprovalTaskList', ApprovalTaskList);
Vue.component('ApprovalDetail', ApprovalDetail);
Vue.component('ApprovalActionBar', ApprovalActionBar);
Vue.component('ApprovalTimeline', ApprovalTimeline);

const client = createApprovalClient({
  adapter: createMockAdapter(),
  actor: { id: 'user-approver', name: '审批人' },
});

new Vue({ render: (h) => h(App, { props: { client } }) }).$mount('#app');
