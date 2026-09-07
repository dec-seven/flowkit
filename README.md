# FlowKit

FlowKit is an adapter-driven, headless approval workflow SDK for enterprise web applications. It focuses on the approval experience layer: task lists, task details, forms, actions, history, and state orchestration. FlowKit is not a BPMN engine and does not require a specific backend.

The first milestone is intentionally small:

1. Define the core task and workflow protocol.
2. Build a headless state layer that framework components can consume.
3. Build a form layer for approval forms.
4. Provide a mock adapter for local development.
5. Provide a minimal Vue 2 component set.
6. Ship purchase-order and leave-request demo workflows.

## Status

FlowKit now has a first end-to-end local flow: the mock adapter supplies inbox tasks, while the headless layer loads tasks, opens a detail, submits an approval action, and refreshes history. A production backend adapter is still required for real deployments.

## Packages

| Package | Purpose |
| --- | --- |
| `@flowkit/core` | Core workflow types, task protocol, and state definitions. |
| `@flowkit/headless` | Framework-agnostic workflow state orchestration. |
| `@flowkit/adapter-mock` | Deterministic in-memory tasks and approval actions with no network dependency. |
| `@flowkit/vue2` | Minimal Vue 2 approval components backed by the headless API. |
| `@flowkit/form` | Approval form schema, rendering contract, and validation model. |

The full target layout also includes adapters, Vue packages, UI packages, designers, examples, and documentation. Those packages will be added as their milestones start.

## Development

FlowKit uses [pnpm](https://pnpm.io/) workspaces.

```bash
pnpm install
pnpm verify
pnpm demo
```

`pnpm demo` runs the full local sequence: load the inbox, open a task, approve it, then refresh the task list and history. The runner is in `examples/mock-vue2/src/index.js`; a Vue 2 component can call the same headless methods.

## Repository conventions

- Default branch: `main`
- Feature branches: `feat/<scope>-<name>`
- Fix branches: `fix/<scope>-<name>`
- Commit format: `feat(core): add task action transition`
- Release order: `core`, `headless`, adapters and form, `vue2`, `ui`

## License

FlowKit is released under the [MIT License](./LICENSE).
