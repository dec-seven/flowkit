import type {
  AdapterCapabilities,
  ApprovalHistoryItem,
  ApprovalTask,
  FlowAdapter,
  FormSchemaLike,
  InstanceQuery,
  Page,
  StartFlowInput,
  SubmitActionInput,
  TaskQuery,
  WorkflowDefinition,
  WorkflowInstance,
} from '@flowkit/core';
import { DEFAULT_ENDPOINTS } from './endpoints.ts';
import {
  asRecord,
  isRecord,
  mapDefinition,
  mapFormSchema,
  mapHistoryItem,
  mapInstance,
  mapPage,
  mapTask,
  unwrap,
} from './normalize.ts';
import { createRestRequester } from './request.ts';
import type { RestAdapterOptions, RestEndpointMap } from './types.ts';

const DEFAULT_CAPABILITIES: AdapterCapabilities = Object.freeze({
  idempotency: false,
  optimisticConcurrency: false,
  startFlow: true,
  definitions: true,
  formSchemas: true,
});

export class RestAdapter implements FlowAdapter {
  readonly capabilities: AdapterCapabilities;
  private readonly request: ReturnType<typeof createRestRequester>['request'];
  private readonly endpoints: RestEndpointMap;

  constructor({
    baseUrl,
    fetch = globalThis.fetch.bind(globalThis),
    headers = {},
    getToken,
    onAuthExpired,
    capabilities,
    endpoints,
  }: RestAdapterOptions) {
    if (!baseUrl) throw new TypeError('RestAdapter requires baseUrl');
    this.request = createRestRequester({
      baseUrl,
      fetch,
      headers,
      getToken,
      onAuthExpired,
    }).request;
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
    return this.request(this.endpoints.instances(instanceId)).then((payload) =>
      mapInstance(unwrap(payload)),
    );
  }

  async getDefinition(definitionId: string, version: number): Promise<WorkflowDefinition> {
    return this.request(this.endpoints.definitions(definitionId, version)).then((payload) =>
      mapDefinition(unwrap(payload)),
    );
  }

  async getFormSchema(schemaId: string, version: number): Promise<FormSchemaLike> {
    return this.request(this.endpoints.formSchemas(schemaId, version)).then((payload) =>
      mapFormSchema(unwrap(payload), { schemaId, version }),
    );
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
      if (!Array.isArray(source)) throw new Error('REST history must be an array');
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
}

export function createRestAdapter(options: RestAdapterOptions): RestAdapter {
  return new RestAdapter(options);
}
