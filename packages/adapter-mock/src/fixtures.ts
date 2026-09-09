import { ACTION_KEY, INSTANCE_STATUS, TASK_STATUS } from '@flowkit/core';
import type {
  ActionKey,
  ActionReason,
  ApprovalAction,
  ApprovalHistoryItem,
  ApprovalTask,
  FormSchemaLike,
  WorkflowDefinition,
  WorkflowInstance,
} from '@flowkit/core';

export const DEFAULT_TIME = '2026-01-01T00:00:00.000Z';

export interface MockOperator {
  id: string;
  name: string;
}

export interface StoredHistoryItem extends ApprovalHistoryItem {
  instanceId: string;
}

export interface MockData {
  instances: WorkflowInstance[];
  tasks: ApprovalTask[];
  histories: StoredHistoryItem[];
  definitions?: WorkflowDefinition[];
  formSchemas?: FormSchemaLike[];
}

export const makeAction = (
  key: ActionKey,
  name: string,
  reason: ActionReason = 'optional',
): ApprovalAction => ({ key, name, enabled: true, reason });

export function createFixture(): MockData {
  return {
    definitions: [
      {
        id: 'definition-purchase',
        key: 'purchase-approval',
        name: '采购审批',
        version: 1,
        formKey: 'purchase-request',
      },
      {
        id: 'definition-leave',
        key: 'leave-approval',
        name: '请假审批',
        version: 1,
        formKey: 'leave-request',
      },
    ],
    formSchemas: [
      {
        ref: { schemaId: 'purchase-request', version: 1 },
        fields: [
          { key: 'applicant', type: 'text', label: '申请人' },
          { key: 'amount', type: 'number', label: '金额', required: true },
          { key: 'purpose', type: 'textarea', label: '用途', required: true },
        ],
      },
      {
        ref: { schemaId: 'leave-request', version: 1 },
        fields: [
          { key: 'applicant', type: 'text', label: '申请人' },
          { key: 'days', type: 'number', label: '天数', required: true },
          { key: 'reason', type: 'textarea', label: '原因', required: true },
        ],
      },
    ],
    instances: [
      {
        id: 'instance-purchase-001',
        definitionKey: 'purchase-approval',
        definitionVersion: 1,
        businessKey: 'PO-2026-0001',
        title: '办公设备采购申请',
        status: INSTANCE_STATUS.RUNNING,
        revision: 1,
        startedAt: DEFAULT_TIME,
        startedBy: 'user-requester',
      },
      {
        id: 'instance-leave-001',
        definitionKey: 'leave-approval',
        definitionVersion: 1,
        businessKey: 'LEAVE-2026-0001',
        title: '年假申请（2 天）',
        status: INSTANCE_STATUS.RUNNING,
        revision: 1,
        startedAt: DEFAULT_TIME,
        startedBy: 'user-requester',
      },
    ],
    tasks: [
      {
        id: 'task-purchase-001',
        instanceId: 'instance-purchase-001',
        name: '部门负责人审批',
        assigneeId: 'user-approver',
        assigneeName: '审批人',
        status: TASK_STATUS.TODO,
        revision: 1,
        priority: 'high',
        createdAt: DEFAULT_TIME,
        actions: [
          makeAction(ACTION_KEY.APPROVE, '同意'),
          makeAction(ACTION_KEY.REJECT, '驳回', 'required'),
          makeAction(ACTION_KEY.RETURN, '退回修改'),
        ],
        formData: {
          formKey: 'purchase-request',
          readonly: false,
          values: { applicant: '张三', amount: 12800, purpose: '办公设备' },
        },
      },
      {
        id: 'task-leave-001',
        instanceId: 'instance-leave-001',
        name: '直属领导审批',
        assigneeId: 'user-approver',
        assigneeName: '审批人',
        status: TASK_STATUS.TODO,
        revision: 1,
        priority: 'normal',
        createdAt: DEFAULT_TIME,
        actions: [
          makeAction(ACTION_KEY.APPROVE, '同意'),
          makeAction(ACTION_KEY.REJECT, '驳回', 'required'),
          makeAction(ACTION_KEY.RETURN, '退回修改'),
        ],
        formData: {
          formKey: 'leave-request',
          readonly: false,
          values: { applicant: '李四', days: 2, reason: '家庭事务' },
        },
      },
    ],
    histories: [],
  };
}
