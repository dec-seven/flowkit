import {
  ACTION_KEY,
  ERROR_CODE,
  FlowError,
  INSTANCE_STATUS,
  TASK_STATUS,
} from '@flowkit/core';
import type {
  ActionKey,
  AdapterCapabilities,
  ApprovalAction,
  ApprovalHistoryItem,
  ApprovalTask,
  FlowAdapter,
  FormSchemaLike,
  InstanceQuery,
  Page,
  StartFlowInput,
  SubmitActionInput,
  TaskPriority,
  TaskQuery,
  WorkflowDefinition,
  WorkflowInstance,
} from '@flowkit/core';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
type HeadersFactory = HeadersInit | (() => HeadersInit | Promise<HeadersInit>);

export interface RestEndpointMap {
  definitions: (definitionId: string, version: number) => string;
  formSchemas: (schemaId: string, version: number) => string;
  instances: (instanceId: string) => string;
  instanceCollection: string;
  tasks: (taskId: string) => string;
  taskCollection: string;
  taskActions: (taskId: string) => string;
  history: (instanceId: string) => string;
}

export interface RestAdapterOptions {
  baseUrl: string;
  fetch?: FetchLike;
  headers?: HeadersFactory;
  /** Return a current bearer token for each request. */
  getToken?: () => string | undefined | Promise<string | undefined>;
  /** Called before an expired-auth error is returned to the caller. */
  onAuthExpired?: () => void | Promise<void>;
  /** Defaults are conservative: unknown servers do not get concurrency guarantees. */
  capabilities?: Partial<AdapterCapabilities>;
  endpoints?: Partial<RestEndpointMap>;
}

const DEFAULT_CAPABILITIES: AdapterCapabilities = Object.freeze({
  idempotency: false,
  optimisticConcurrency: false,
  startFlow: true,
  definitions: true,
  formSchemas: true,
});

const DEFAULT_ENDPOINTS: RestEndpointMap = {
  definitions: (definitionId, version) =>
    `/flow-definitions/${encodeURIComponent(definitionId)}/versions/${version}`,
  formSchemas: (schemaId, version) =>
    `/form-schemas/${encodeURIComponent(schemaId)}/versions/${version}`,
  instances: (instanceId) => `/flow-instances/${encodeURIComponent(instanceId)}`,
  instanceCollection: '/flow-instances',
  tasks: (taskId) => `/tasks/${encodeURIComponent(taskId)}`,
  taskCollection: '/tasks',
  taskActions: (taskId) => `/tasks/${encodeURIComponent(taskId)}/actions`,
  history: (instanceId) => `/flow-instances/${encodeURIComponent(instanceId)}/events`,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asRecord = (payload: unknown): Record<string, unknown> => {
  if (isRecord(payload)) return payload;
  throw new FlowError(ERROR_CODE.TRIGGER_FAILED, 'REST response must be a JSON object', {
    resource: 'response',
  });
};

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined;

const asEnum = <T extends string>(value: unknown, allowed: readonly T[], field: string): T => {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new FlowError(ERROR_CODE.TRIGGER_FAILED, `REST response field is invalid: ${field}`, {
      resource: 'response',
      field,
    });
  }
  return value as T;
};

const unwrap = (payload: unknown): unknown => {
  if (!isRecord(payload)) return payload;
  if (payload.data !== undefined) return payload.data;
  if (payload.result !== undefined) return payload.result;
  return payload;
};

const asString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value) {
    throw new FlowError(ERROR_CODE.TRIGGER_FAILED, `REST response field is invalid: ${field}`, {
      resource: 'response',
      field,
    });
  }
  return value;
};

const asRevision = (value: unknown, field: string): number => {
  const revision = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(revision) || revision < 0) {
    throw new FlowError(ERROR_CODE.TRIGGER_FAILED, `REST response revision is invalid: ${field}`, {
      resource: 'response',
      field,
    });
  }
  return revision;
};

const mapAction = (value: unknown): ApprovalAction => {
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
    reason: item.reason === 'required' ? 'required' : item.reason === 'optional' ? 'optional' : undefined,
  };
};

const mapInstance = (value: unknown): WorkflowInstance => {
  const item = asRecord(value);
  const definition = isRecord(item.definition) ? item.definition : {};
  return {
    id: asString(item.id, 'id'),
    definitionKey: asString(item.definitionKey ?? definition.key, 'definitionKey'),
    definitionVersion: asRevision(item.definitionVersion ?? definition.version, 'definitionVersion'),
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

const mapTask = (value: unknown): ApprovalTask => {
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

const mapHistoryItem = (value: unknown): ApprovalHistoryItem => {
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

const mapPage = <T>(payload: unknown, map: (item: unknown) => T): Page<T> => {
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

export class RestAdapter implements FlowAdapter {
  readonly capabilities: AdapterCapabilities;
  private readonly baseUrl: string;
  private readonly requestFetch: FetchLike;
  private readonly headers: HeadersFactory;
  private readonly getToken?: RestAdapterOptions['getToken'];
  private readonly onAuthExpired?: RestAdapterOptions['onAuthExpired'];
  private readonly endpoints: RestEndpointMap;

  constructor({
    baseUrl,
    fetch: requestFetch = globalThis.fetch.bind(globalThis),
    headers = {},
    getToken,
    onAuthExpired,
    capabilities,
    endpoints,
  }: RestAdapterOptions) {
    if (!baseUrl) throw new TypeError('RestAdapter requires baseUrl');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.requestFetch = requestFetch;
    this.headers = headers;
    this.getToken = getToken;
    this.onAuthExpired = onAuthExpired;
    this.capabilities = Object.freeze({ ...DEFAULT_CAPABILITIES, ...capabilities });
    this.endpoints = { ...DEFAULT_ENDPOINTS, ...endpoints };
  }

  async listInstances(query: InstanceQuery = {}): Promise<Page<WorkflowInstance>> {
    return this.request(this.endpoints.instanceCollection, {
      query: { status: query.status, page: query.page, pageSize: query.pageSize },
    }).then((payload) => mapPage(payload, mapInstance));
  }

  async listTasks(query: TaskQuery = {}): Promise<Page<ApprovalTask>> {
    return this.request(this.endpoints.taskCollection, {
      query: {
        status: query.status,
        assignee: query.assigneeId,
        page: query.page,
        pageSize: query.pageSize,
      },
    }).then((payload) => mapPage(payload, mapTask));
  }

  async getInstance(instanceId: string): Promise<WorkflowInstance> {
    return this.request(this.endpoints.instances(instanceId)).then((payload) => mapInstance(unwrap(payload)));
  }

  async getDefinition(definitionId: string, version: number): Promise<WorkflowDefinition> {
    return this.request(this.endpoints.definitions(definitionId, version)).then((payload) => {
      const item = asRecord(unwrap(payload));
      return {
        id: asString(item.id, 'id'),
        key: asString(item.key, 'key'),
        name: asString(item.name, 'name'),
        version: asRevision(item.version, 'version'),
        formKey: optionalString(item.formKey),
      };
    });
  }

  async getFormSchema(schemaId: string, version: number): Promise<FormSchemaLike> {
    return this.request(this.endpoints.formSchemas(schemaId, version)).then((payload) => {
      const item = asRecord(unwrap(payload));
      return { ...item, ref: item.ref ?? { schemaId, version } } as FormSchemaLike;
    });
  }

  async getTask(taskId: string): Promise<ApprovalTask> {
    return this.request(this.endpoints.tasks(taskId)).then((payload) => mapTask(unwrap(payload)));
  }

  async getHistory(instanceId: string): Promise<ApprovalHistoryItem[]> {
    return this.request(this.endpoints.history(instanceId)).then((payload) => {
      const unwrapped = unwrap(payload);
      const source = Array.isArray(unwrapped)
        ? unwrapped
        : isRecord(unwrapped) && Array.isArray(unwrapped.events)
          ? unwrapped.events
          : unwrapped;
      if (!Array.isArray(source)) {
        throw new FlowError(ERROR_CODE.TRIGGER_FAILED, 'REST history must be an array', {
          resource: 'history',
        });
      }
      return source.map(mapHistoryItem);
    });
  }

  async startFlow(input: StartFlowInput): Promise<WorkflowInstance> {
    return this.request(this.endpoints.instanceCollection, {
      method: 'POST',
      body: input,
    }).then((payload) => mapInstance(unwrap(payload)));
  }

  async submitAction(input: SubmitActionInput): Promise<ApprovalTask> {
    return this.request(this.endpoints.taskActions(input.taskId), {
      method: 'POST',
      body: {
        actionKey: input.actionKey,
        idempotencyKey: input.idempotencyKey,
        expectedTaskRevision: input.expectedTaskRevision,
        expectedInstanceRevision: input.expectedInstanceRevision,
        comment: input.comment,
        formValues: input.formValues,
      },
    }).then((payload) => {
      const root = asRecord(payload);
      const rawTask = root.task ?? unwrap(payload);
      const task = mapTask(rawTask);
      return root.replayed === true || (isRecord(rawTask) && rawTask.replayed === true)
        ? { ...task, replayed: true }
        : task;
    });
  }

  private async request(
    path: string,
    {
      method = 'GET',
      query,
      body,
    }: { method?: string; query?: Record<string, unknown>; body?: unknown } = {},
  ): Promise<unknown> {
    const url = new URL(path, `${this.baseUrl}/`);
    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });
    const configuredHeaders = typeof this.headers === 'function' ? await this.headers() : this.headers;
    const headers = new Headers(configuredHeaders);
    headers.set('Accept', 'application/json');
    if (body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }
    const token = await this.getToken?.();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    let response: Response;
    try {
      response = await this.requestFetch(url.toString(), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new FlowError(ERROR_CODE.TRIGGER_FAILED, 'REST request failed', {
        resource: 'network',
        cause: error instanceof Error ? error.message : String(error),
      });
    }

    const payload = await this.readPayload(response);
    if (!response.ok) {
      await this.throwHttpError(response.status, payload);
    }
    return payload;
  }

  private async readPayload(response: Response): Promise<unknown> {
    if (response.status === 204) return {};
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      try {
        return await response.json();
      } catch {
        return {};
      }
    }
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  private async throwHttpError(status: number, payload: unknown): Promise<never> {
    const root = isRecord(payload) ? payload : {};
    const source = isRecord(root.error) ? root.error : root;
    const code = typeof source.code === 'string' ? source.code : undefined;
    const message = typeof source.message === 'string' ? source.message : `REST request failed (${status})`;
    const details = isRecord(source.details)
      ? { ...source.details }
      : Object.fromEntries(
          Object.entries(source).filter(([key]) => !['code', 'message', 'error'].includes(key)),
        );

    if (status === 401) {
      await this.onAuthExpired?.();
      throw new FlowError(ERROR_CODE.AUTH_EXPIRED, message, { ...details, status });
    }
    if (status === 403) throw new FlowError(ERROR_CODE.FORBIDDEN, message, { ...details, status });
    if (status === 404) throw new FlowError(ERROR_CODE.NOT_FOUND, message, { ...details, status });
    if (status === 409 || code === ERROR_CODE.CONFLICT) {
      throw new FlowError(ERROR_CODE.CONFLICT, message, {
        resource: details.resource ?? 'task',
        currentTaskRevision: Number(details.currentTaskRevision ?? details.taskRevision ?? 0),
        currentInstanceRevision: Number(details.currentInstanceRevision ?? details.instanceRevision ?? 0),
        retryable: details.retryable !== false,
        ...details,
        status,
      });
    }
    const knownCode = Object.values(ERROR_CODE).includes(code as (typeof ERROR_CODE)[keyof typeof ERROR_CODE])
      ? (code as (typeof ERROR_CODE)[keyof typeof ERROR_CODE])
      : ERROR_CODE.TRIGGER_FAILED;
    throw new FlowError(knownCode, message, { ...details, status });
  }
}

export function createRestAdapter(options: RestAdapterOptions): RestAdapter {
  return new RestAdapter(options);
}
