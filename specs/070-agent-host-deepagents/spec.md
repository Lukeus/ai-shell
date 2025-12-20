# 070 Agent Host - Deep Agents
## Problem / Why
The product needs a dedicated Agent Host process to run Deep Agents orchestration
without giving the renderer or extensions direct OS access. Today there is no
clear spec for agent lifecycle, tool execution, policy gating, or event streaming
to the UI. This makes it hard to build reliable agent runs, audit sensitive
actions, and keep the renderer isolated.

## Goals
- Define the Agent Host process responsibilities and boundaries.
- Specify contracts for agent lifecycle events and tool call envelopes (Zod-first).
- Stream agent progress and outputs to the UI in the right panel.
- Ensure tool execution is policy-gated and audited in main.
- Persist run metadata and traces (non-secret).

## Non-goals
- Implementing LLM provider setup or key management.
- UI redesign beyond existing right panel patterns.
- Extension marketplace, signing, or policy UI.
- Secret storage changes (handled by SecretsService).
- Cross-device run sync or multi-user collaboration.

## User stories
- As a user, I can start an agent run and watch progress in real time.
- As a user, I can cancel or retry a run and see a clear end state.
- As an admin, I can audit which tools were invoked and why.
- As an extension author, I can register tools with schemas that are validated.
- As security, I can deny tool calls without breaking the agent runtime.

## UX requirements
- Right panel shows agent state (idle, running, canceled, failed, completed).
- Event stream lists plan steps, tool calls, and outputs in order.
- Controls for start, stop, and retry are visible and consistent with existing UI.
- Errors are shown with actionable messaging (no raw secrets).
- Use existing layout and Tailwind token styles.
- Secondary side bar can be toggled from the View menu (mirrors VS Code).

## Functional requirements
- Agent Host runs as a separate process from renderer and extensions.
- Agent Host communicates with main via broker-client and IPC.
- Main process enforces policy checks for tool calls.
- Contracts define agent lifecycle events, tool calls, and trace payloads in
  `packages/api-contracts`.
- Tools declare schemas and permissions; inputs/outputs validated via Zod.
- Audit service records tool usage and policy decisions (no secret values).
- Store run metadata and trace events locally; redact sensitive data.
- Support cancellation, timeouts, and failure events.

## Security requirements
- Renderer has no OS access; Agent Host has no direct OS access.
- IPC payloads are validated via Zod contracts (contracts-first).
- Secrets never leave main; Agent Host receives handles only.
- Audit logs must not include plaintext secrets.
- contextIsolation remains on with minimal preload surface.

## Performance requirements
- Agent Host startup under 500ms on a typical dev machine.
- UI event stream updates within 200ms of event emission.
- Tool call overhead under 100ms for local calls (excluding tool runtime).
- Trace storage bounded by size or run count to avoid unbounded growth.

## Acceptance criteria
- Agent Host process is defined with clear boundaries and responsibilities.
- Zod contracts exist for agent lifecycle events and tool call envelopes.
- Tool execution is routed through broker-main with policy checks and audit logs.
- Renderer can display agent run status and streamed events.
- Cancellation and failure paths emit deterministic events.
- No plaintext secrets are logged or exposed to renderer or Agent Host.
- Tests exist for contract validation and agent-host message flow.

## Out of scope / Future work
- Multi-agent coordination across machines.
- Long-term trace retention, sync, or cloud storage.
- Advanced visualization (timeline, dependency graphs).
- Enterprise policy configuration UI.
- Offline or background agent runs.

## Open questions
- What is the default trace retention policy and storage format?
- Which initial tool set ships with the Agent Host?
- How are tool permissions surfaced to users?
- Should agent runs be resumable after app restart?
