# 158 - IPC Hardening and Agent Controls

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P2, P5, P6, P7).

## Problem / Why
- Extension IPC handlers accept unvalidated payloads and bypass the Result envelope pattern.
- Agent run cancel/retry does not reach the agent-host, so control actions are not functional.
- Agent event publish can throw on invalid events and interrupt the stream.
- Monaco worker setup is imported eagerly in the renderer entry point.
- ipc-handlers is a monolith that violates AGENTS.md guardrails.
- Extension Host executes untrusted code with full Node/OS access (no sandbox).
- Extensions are not registered/activated from main, so commands/views/tools never register.
- Extension tool inputs/outputs are not validated against declared schemas.

## Goals
- Normalize extension command and permission IPC to contracts-first schemas and Result envelopes.
- Make agent run cancel/retry functional end-to-end (renderer -> main -> agent-host -> runtime).
- Harden agent event publish to avoid crashes on invalid events or missing runs.
- Defer Monaco worker setup to the lazy-loaded editor path.
- Split ipc-handlers responsibilities to align with anti-monolith guardrails.
- Sandbox Extension Host with VM/isolate so extensions have no direct Node/OS access.
- Wire extension registration + activation to main so contributions are usable.
- Validate extension tool inputs/outputs against declared schemas.
- Ensure agent allowlist does not block built-in backend tools.

## Non-goals
- No UI redesigns or new UI features.
- No new extension host capabilities beyond command/permission validation.
- No changes to secrets storage or policy logic.
- No changes to agent event schema shape.
- No changes to extension marketplace signing or installation flows.

## User stories
1. As a security owner, extension IPC payloads are validated and never throw across IPC boundaries.
2. As a user, cancel and retry actions actually stop or restart agent runs.
3. As a performance owner, Monaco workers are not loaded in the initial renderer chunk.
4. As a maintainer, ipc-handlers responsibilities are split into smaller modules.

## Acceptance criteria
### IPC contracts + Result envelopes
- Extension execute-command and permission request payloads are defined in packages/api-contracts.
- Main uses handleSafe for these channels and validates inputs/outputs with Zod.
- Preload uses invokeSafe and exposes Result-wrapped methods.
- Renderer handles Result failures when executing extension commands.

### Agent run controls
- Cancel sends a control message to agent-host and results in canceled status events.
- Retry restarts the last run request for the same run ID and resets event history.
- If a retry request is missing cached inputs, a clear error is returned.

### Agent event resilience
- appendAndPublish never throws on invalid events or missing runs.
- Invalid events are dropped with a safe diagnostic log entry (no payloads logged).

### Monaco lazy-load
- monacoWorkers is only imported during editor lazy-load.

### Extension sandbox
- Extension Host executes extensions in a VM/isolate with no Node built-ins.
- `require`, `process`, and native modules are unavailable inside extension code.
- Only the curated Extension API is exposed to extension code.

### Extension wiring + validation
- Main registers enabled extensions with Extension Host on startup.
- Contributions (commands/views/tools) populate main services.
- Extension commands/tools activate their owning extension on demand.
- Extension tool inputs/outputs validated against declared schemas.

### Agent allowlist
- Built-in backend tools (e.g., repo.list) are exempt from custom allowlists.

### Guardrails
- ipc-handlers is split into dedicated agent and extension IPC modules.

## Risks
- Retry semantics may surprise users if prior event history is cleared.
- Extension command results may fail validation if non-JSON values are returned.
- VM-based sandboxing is a best-effort isolation; stronger sandboxing may be required later.
