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
