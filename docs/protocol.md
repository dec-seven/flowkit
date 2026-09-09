# FlowKit Protocol

This document defines the core approval workflow protocol. It is the contract shared by core, headless, adapters, form, and UI packages.

## Design goals

1. Keep the protocol independent of Vue, React, backend engine, and transport.
2. Model enterprise approval tasks explicitly rather than relying on generic BPMN objects.
3. Allow adapters to normalize backend-specific data into FlowKit objects.
4. Keep form state and workflow state separate but connected.

## Workflow definition

```ts
type WorkflowDefinition = {
  id: string;
  key: string;
  name: string;
  version: number;
  formKey?: string;
};
```

A workflow definition identifies an approval process type. It does not describe executable graph semantics. FlowKit treats graph execution as the backend engine's responsibility.

## Workflow instance

```ts
type WorkflowInstance = {
  id: string;
  definitionKey: string;
  definitionVersion: number;
  businessKey?: string;
  title: string;
  status: 'running' | 'completed' | 'terminated' | 'suspended';
  revision: number;
  startedAt: string;
  endedAt?: string;
  startedBy?: string;
};
```

## Task

```ts
type ApprovalTask = {
  id: string;
  instanceId: string;
  name: string;
  assigneeId?: string;
  assigneeName?: string;
  candidateGroupIds?: string[];
  status: 'todo' | 'claimed' | 'done' | 'terminated';
  revision: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: string;
  dueAt?: string;
  completedAt?: string;
  actions: ApprovalAction[];
};
```

## Task action

```ts
type ApprovalAction = {
  key: 'approve' | 'reject' | 'return' | 'transfer' | 'delegate' | 'comment' | 'withdraw';
  name: string;
  enabled: boolean;
  reason?: 'required' | 'optional';
};
```

Actions are declarative. A backend adapter must resolve whether an action is available for the current user and task state before returning the task.

## History

```ts
type ApprovalHistoryItem = {
  id: string;
  taskId?: string;
  actionKey?: ApprovalAction['key'];
  operatorId?: string;
  operatorName?: string;
  comment?: string;
  createdAt: string;
};
```

History is append-only from the frontend perspective. FlowKit does not infer history from local state changes; it reads history from an adapter.

## Form data

```ts
type ApprovalFormData = {
  formKey?: string;
  values: Record<string, unknown>;
  readonly: boolean;
};
```

Workflow actions can submit form values, but form validation remains a form-layer concern. Headless workflow state should not depend on a specific form implementation.

## Commands, idempotency, and revisions

Starting a flow and executing a task action are commands. A command must not be represented as a direct status update because only the backend workflow engine may decide the resulting state.

```ts
type StartFlowInput = {
  definitionKey: string;
  definitionVersion?: number;
  businessKey?: string;
  title?: string;
  formValues?: Record<string, unknown>;
  idempotencyKey: string;
};

type SubmitActionInput = {
  taskId: string;
  actionKey: ApprovalAction['key'];
  idempotencyKey: string;
  expectedTaskRevision: number;
  expectedInstanceRevision: number;
  comment?: string;
  formValues?: Record<string, unknown>;
};
```

`idempotencyKey` identifies one logical command. Retrying that command with the same key must return the original result without applying the transition or appending history again. A replayed result sets `replayed: true`.

`revision` is a server-owned, monotonically increasing version. Task commands carry both revisions observed by the caller. If either has changed, the adapter throws `FlowError` with code `FLOW_CONFLICT` and details containing `resource`, `currentTaskRevision`, `currentInstanceRevision`, and `retryable`.

## Adapter capabilities

Every adapter declares whether its backend actually guarantees idempotency and optimistic concurrency:

```ts
type AdapterCapabilities = {
  idempotency: boolean;
  optimisticConcurrency: boolean;
  startFlow?: boolean;
  definitions?: boolean;
  formSchemas?: boolean;
};
```

Headless must reject a protected command when the corresponding capability is false. Passing an idempotency key to a server that ignores it is not an idempotency guarantee.

## Error codes

Adapters normalize transport and backend failures into these stable codes:

- `FLOW_INVALID_ACTION`: the command or its required input is invalid;
- `FLOW_FORBIDDEN`: the current actor is not allowed to perform it;
- `FLOW_AUTH_EXPIRED`: authentication is missing or expired;
- `FLOW_CAPABILITY_UNSUPPORTED`: the adapter cannot guarantee a requested feature;
- `FLOW_CONFLICT`: one of the expected revisions is stale;
- `FLOW_NOT_FOUND`: the requested workflow resource does not exist;
- `FLOW_TRIGGER_FAILED`: the backend or a registered trigger failed.
