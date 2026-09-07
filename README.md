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

FlowKit is in the M0 repository setup phase. The package structure and protocol documents are being stabilized before implementation begins.

## Packages

| Package | Purpose |
| --- | --- |
| `@flowkit/core` | Core workflow types, task protocol, and state definitions. |
| `@flowkit/headless` | Framework-agnostic workflow state orchestration. |
| `@flowkit/form` | Approval form schema, rendering contract, and validation model. |

The full target layout also includes adapters, Vue packages, UI packages, designers, examples, and documentation. Those packages will be added as their milestones start.

## Development

FlowKit uses [pnpm](https://pnpm.io/) workspaces.

```bash
pnpm install
pnpm verify
```

## Repository conventions

- Default branch: `main`
- Feature branches: `feat/<scope>-<name>`
- Fix branches: `fix/<scope>-<name>`
- Commit format: `feat(core): add task action transition`
- Release order: `core`, `headless`, adapters and form, `vue2`, `ui`

## License

FlowKit is released under the [MIT License](./LICENSE).
