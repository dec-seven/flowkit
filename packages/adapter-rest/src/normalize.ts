import {
  ACTION_KEY,
  ERROR_CODE,
  FlowError,
  INSTANCE_STATUS,
  TASK_STATUS,
} from '@flowkit/core';
import type {
  ActionKey,
  ApprovalAction,
  ApprovalHistoryItem,
  ApprovalTask,
  FormSchemaLike,
  Page,
  TaskPriority,
  WorkflowDefinition,
  WorkflowInstance,
} from '@flowkit/core';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const asRecord = (payload: unknown): Record<string, unknown> => {
  if (isRecord(payload)) return payload;
  throw new FlowError(ERROR_CODE.TRIGGER_FAILED, 'REST response must be a JSON object', {
    resource: 'response',
  });
};

export const unwrap = (payload: unknown): unknown => {
  if (!isRecord(payload)) return payload;
  if (payload.data !== undefined) return payload.data;
  if (payload.result !== undefined) return payload.result;
  return payload;
};

export const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;

export const asString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value) {
    throw new FlowError(ERROR_CODE.TRIGGER_FAILED, `REST response field is invalid: ${field}`, {
      resource: 'response',
      field,
    });
  }
  return value;
};

export const asEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T => {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new FlowError(ERROR_CODE.TRIGGER_FAILED, `REST response field is invalid: ${field}`, {
      resource: 'response',
      field,
    });
  }
  return value as T;
};

export const asRevision = (value: unknown, field: string): number => {
  const revision = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(revision) || revision < 0) {
    throw new FlowError(ERROR_CODE.TRIGGER_FAILED, `REST response revision is invalid: ${field}`, {
      resource: 'response',
      field,
    });
  }
  return revision;
};

export const mapAction = (value: unknown): ApprovalAction => {
  const item = asRecord(value);
  const key = asEnum(
    item.key ?? item.actionKey ?? item.action ?? item.code,
    Object.values(ACTION_KEY),
    'actionKey',
  ) as ActionKey;
  return {
    key,
    name: String(item.name ?? item.label ?? key),
    enabled: item.enabled !== false && item.available !== false,
    reason:
      item.reason === 'required'
        ? 'required'
        : item.reason === 'optional'
          ? 'optional'
          : undefined,
  };
};

export const mapInstance = (value: unknown): WorkflowInstance => {
  const item = asRecord(value);
  const definition = isRecord(item.definition) ? item.definition : {};
  return {
    id: asString(item.id, 'id'),
    definitionKey: asString(item.definitionKey ?? definition.key, 'definitionKey'),
    definitionVersion: asRevision(
      item.definitionVersion ?? definition.version,
      'definitionVersion',
    ),
    businessKey: optionalString(item.businessKey),
    title: asString(item.title ?? item.name, 'title'),
    status: asEnum(item.status ?? item.state, Object.values(INSTANCE_STATUS), 'status'),
    revision: asRevision(item.revision ?? item.version, 'revision'),
    startedAt: asString(item.startedAt ?? item.createdAt, 'startedAt'),
    endedAt: optionalString(item.endedAt),
    startedBy: optionalString(item.startedBy ?? item.startedById),
    replayed: item.replayed === true ? true : undefined,
  };
};

export const mapTask = (value: unknown): ApprovalTask => {
  const item = asRecord(value);
  const formData = isRecord(item.formData)
    ? item.formData
    : isRecord(item.form)
      ? item.form
      : undefined;
  const assignee = isRecord(item.assignee) ? item.assignee : {};
  const candidateGroupIds = Array.isArray(item.candidateGroupIds)
    ? item.candidateGroupIds.filter((id): id is string => typeof id === 'string')
    : undefined;
  const priority = asEnum(
    item.priority ?? 'normal',
    ['low', 'normal', 'high', 'urgent'] as const,
    'priority',
  ) as TaskPriority;
  return {
    id: asString(item.id, 'id'),
    instanceId: asString(item.instanceId ?? item.processInstanceId, 'instanceId'),
    name: asString(item.name ?? item.taskName, 'name'),
    assigneeId: optionalString(item.assigneeId ?? assignee.id),
    assigneeName: optionalString(item.assigneeName ?? assignee.name),
    candidateGroupIds,
    status: asEnum(item.status ?? item.taskStatus, Object.values(TASK_STATUS), 'status'),
    revision: asRevision(item.revision ?? item.version, 'revision'),
    priority,
    createdAt: asString(item.createdAt, 'createdAt'),
    dueAt: optionalString(item.dueAt),
    completedAt: optionalString(item.completedAt),
    replayed: item.replayed === true ? true : undefined,
    actions: Array.isArray(item.actions) ? item.actions.map(mapAction) : [],
    formData: formData
      ? {
          formKey: optionalString(formData.formKey),
          values: isRecord(formData.values) ? formData.values : {},
          readonly: formData.readonly === true,
        }
      : undefined,
  };
};

export const mapHistoryItem = (value: unknown): ApprovalHistoryItem => {
  const item = asRecord(value);
  const operator = isRecord(item.operator) ? item.operator : {};
  const actionKey = item.actionKey ?? item.action ?? item.eventType;
  const mappedActionKey = Object.values(ACTION_KEY).includes(actionKey as ActionKey)
    ? (actionKey as ActionKey)
    : undefined;
  return {
    id: asString(item.id, 'id'),
    taskId: optionalString(item.taskId),
    actionKey: mappedActionKey,
    operatorId: optionalString(item.operatorId ?? operator.id),
    operatorName: optionalString(item.operatorName ?? operator.name),
    comment: optionalString(item.comment),
    createdAt: asString(item.createdAt ?? item.timestamp, 'createdAt'),
  };
};

export const mapPage = <T>(payload: unknown, map: (item: unknown) => T): Page<T> => {
  const source = Array.isArray(payload) ? payload : unwrap(asRecord(payload));
  if (Array.isArray(source)) {
    return { items: source.map(map), total: source.length, page: 1, pageSize: source.length };
  }
  const page = asRecord(source);
  const items = page.items ?? page.records ?? page.content ?? [];
  if (!Array.isArray(items)) {
    throw new FlowError(ERROR_CODE.TRIGGER_FAILED, 'REST page items must be an array', {
      resource: 'response',
    });
  }
  return {
    items: items.map(map),
    total: Number(page.total ?? page.totalCount ?? items.length),
    page: Number(page.page ?? page.current ?? 1),
    pageSize: Number(page.pageSize ?? page.size ?? items.length),
  };
};

export const mapDefinition = (value: unknown): WorkflowDefinition => {
  const item = asRecord(value);
  return {
    id: asString(item.id, 'id'),
    key: asString(item.key, 'key'),
    name: asString(item.name, 'name'),
    version: asRevision(item.version, 'version'),
    formKey: optionalString(item.formKey),
  };
};

export const mapFormSchema = (
  value: unknown,
  fallbackRef: { schemaId: string; version: number },
): FormSchemaLike => {
  const item = asRecord(value);
  return { ...item, ref: item.ref ?? fallbackRef } as FormSchemaLike;
};
