# Adapter Contract

FlowKit separates the approval experience layer from backend workflow engines. An adapter translates a backend API into the FlowKit protocol.

## Required capabilities

An approval adapter should implement:

```ts
type FlowAdapter = {
  readonly capabilities: AdapterCapabilities;
  listInstances(query: InstanceQuery): Promise<Page<WorkflowInstance>>;
  listTasks(query: TaskQuery): Promise<Page<ApprovalTask>>;
  getInstance(instanceId: string): Promise<WorkflowInstance>;
  getDefinition(definitionId: string, version: number): Promise<WorkflowDefinition>;
  getFormSchema(schemaId: string, version: number): Promise<FormSchemaLike>;
  getTask(taskId: string): Promise<ApprovalTask>;
  getHistory(instanceId: string): Promise<ApprovalHistoryItem[]>;
  startFlow(input: StartFlowInput): Promise<WorkflowInstance>;
  submitAction(input: SubmitActionInput): Promise<ApprovalTask>;
};
```

All adapters return the same canonical models, `Page<T>` shape, and `FlowError` codes. Transport and engine DTOs must not escape the adapter boundary.

## Adapter rules

1. Map backend-specific action names to FlowKit action keys.
2. Normalize timestamps to ISO 8601 strings.
3. Do not expose engine-specific task IDs through component APIs.
4. Do not silently enable actions that the backend has not authorized.
5. Return user-facing errors in a consistent structure.
6. Declare idempotency and optimistic-concurrency support; do not infer support from request fields alone.
7. Convert an HTTP or engine conflict into `FLOW_CONFLICT` with both current revisions.

## Generic REST mapping

`@flowkit/adapter-rest` uses these default endpoints:

| FlowAdapter method | REST endpoint |
| --- | --- |
| `getDefinition` | `GET /flow-definitions/{id}/versions/{version}` |
| `getFormSchema` | `GET /form-schemas/{id}/versions/{version}` |
| `startFlow` | `POST /flow-instances` |
| `getInstance` | `GET /flow-instances/{instanceId}` |
| `listTasks` | `GET /tasks` |
| `getTask` | `GET /tasks/{taskId}` |
| `getHistory` | `GET /flow-instances/{instanceId}/events` |
| `submitAction` | `POST /tasks/{taskId}/actions` |

Its endpoint map is configurable, but its output protocol is not. It maps common response wrappers (`data`, `result`), paging names (`items`, `records`, `content`), event fields, 401 authentication expiry, 403, 404, and 409 conflict responses into FlowKit types.

## Planned adapters

| Adapter | Purpose |
| --- | --- |
| `@flowkit/adapter-rest` | Connects to a generic REST approval API. |
| `@flowkit/adapter-flowable` | Connects to Flowable's task and history APIs. |
| `@flowkit/adapter-mock` | Provides deterministic local development data. |

## Mock adapter

The mock adapter is a first-class development tool. It must support:

1. Purchase-order approval.
2. Leave-request approval.
3. Approve, reject, and return actions.
4. Deterministic task state transitions.
5. No network dependency.
