# Contributing

Thanks for contributing to FlowKit.

## Branches

Use `main` as the default branch.

```text
feat/<scope>-<name>
fix/<scope>-<name>
```

Examples:

```text
feat(core): add task action transition
fix(adapter-flowable): map return action
```

## Development checklist

Before opening a pull request:

1. Run `pnpm install`.
2. Run `pnpm verify`.
3. Add or update tests for behavior changes.
4. Update protocol or adapter documentation when public contracts change.
5. Keep changes focused; avoid unrelated refactors.

## Architecture rules

- `@flowkit/core` and `@flowkit/headless` must remain backend-agnostic.
- Backend integration belongs in adapters such as `@flowkit/adapter-rest` or `@flowkit/adapter-flowable`.
- Vue-specific code must not leak into core, headless, form, or adapter packages.
- Public package APIs require documentation and tests.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
