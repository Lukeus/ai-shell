# 100 Hardening + Release — Technical Plan

## Architecture changes
- Add release hardening checks as a main-process startup gate:
  - security flags verification (`contextIsolation`, `sandbox`, `nodeIntegration`).
  - runtime diagnostics service readiness.
  - safe mode and crash-loop state restoration.
- Add release readiness service that validates:
  - update channel configuration.
  - telemetry sinks and redaction settings.
  - performance budget markers (initial bundle and startup path).
- Add a release checklist pipeline that can run in CI and local packaging builds.

## Contracts (api-contracts)
- Add diagnostics/release schemas for:
  - hardening check results (pass/fail with reason codes).
  - startup health summary.
  - safe mode state and transition reason.
  - update channel metadata/status.
- Add typed IPC request/response contracts for:
  - querying hardening status.
  - toggling safe mode with explicit reason.
  - retrieving release diagnostics bundle metadata.
- Export all added types through `packages/api-contracts/src/index.ts`.

## IPC + process boundaries
- Renderer reads hardening/release status via `window.api.diagnostics` only.
- Main process owns:
  - crash-loop detection and safe mode transitions.
  - update-channel configuration and checks.
  - telemetry routing and redaction enforcement.
- Renderer never directly accesses update APIs, crash files, or OS diagnostics paths.

## Testing strategy
- Unit tests:
  - hardening checks (security flags, budget thresholds, config validation).
  - safe mode transitions on repeated crash signals.
  - diagnostics redaction behavior for sensitive fields.
- Integration tests:
  - startup in normal mode vs safe mode.
  - simulated crash-loop leading to safe mode.
  - update channel config validation outcomes.
- E2E tests:
  - app starts with hardened defaults.
  - safe mode banner and behavior when crash-loop is triggered.
  - diagnostics path and fatal report flow through contracts.

## Risks + mitigations
- Risk: overly strict hardening gate blocks valid dev workflows. Mitigation: environment-aware policy with explicit dev/test exemptions.
- Risk: missing telemetry during critical failures. Mitigation: local durable diagnostics log with deferred upload.
- Risk: false crash-loop detection. Mitigation: bounded crash counters with time-window reset and explicit user override.
- Risk: performance regressions close to release. Mitigation: enforce budgets in CI and fail builds when thresholds are exceeded.
