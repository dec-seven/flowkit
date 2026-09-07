# Adapter Contract

FlowKit separates the approval experience layer from backend workflow engines. An adapter translates a backend API into the FlowKit protocol.

## Required capabilities

An approval adapter should implement:

```ts
type FlowAdapter = {
  listInstances(query: InstanceQuery): Promise<Page<WorkflowInstance>>;
  listTasks(query: TaskQuery): Promise<Page<ApprovalTask>>;
  getTask(taskId: string): Promise<ApprovalTask>;
  getHistory(instanceId: string): Promise<ApprovalHistoryItem[]>;
  submitAction(input: SubmitActionInput): Promise<ApprovalTask>;
};
```

The exact error and paging shapes will be finalized in M0. The contract is intentionally small so that REST, Flowable, and mock adapters can share the same frontend behavior.

## Adapter rules

1. Map backend-specific action names to FlowKit action keys.
2. Normalize timestamps to ISO 8601 strings.
3. Do not expose engine-specific task IDs through component APIs.
4. Do not silently enable actions that the backend has not authorized.
5. Return user-facing errors in a consistent structure.

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
