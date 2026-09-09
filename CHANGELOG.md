# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- M5 generic REST adapter with endpoint mapping, DTO normalization, pagination, auth-expiry and conflict error conversion.
- Idempotency keys, task/instance revisions, conflict details, adapter capabilities, and start/definition/form query methods.
- Mock, headless, and REST contract coverage for replay and optimistic-concurrency behavior.
- Initial M0 repository structure.
- Core protocol and adapter contract documentation.
- pnpm workspace and repository verification script.
- Minimal approval flow with core constants, headless store, deterministic mock adapter, and runnable example.
