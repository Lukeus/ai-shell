# 070 Agent Host - Deep Agents - Technical Plan
## Architecture changes
- Agent Host process owns Deep Agents orchestration, run state machine, and tool
  execution coordination; no direct OS access.
- Main process owns policy enforcement, audit logging, trace storage, and any OS
  operations for tool calls via broker-main.
- Renderer subscribes to agent run events via minimal preload APIs; UI remains
  read-only for traces and status.
- Broker-client in Agent Host sends tool call requests to broker-main; broker-main
  routes to tool implementations and returns validated results.
- Add an AgentRunStore in main (JSON for now) to persist run metadata and trace
  events with bounded retention.

## Contracts (api-contracts updates)
- Add Zod schemas for:
  - AgentRun metadata (id, status, createdAt, updatedAt, source).
  - AgentRunStartRequest (goal, inputs, tool allowlist, metadata).
  - AgentRunControlRequest (cancel, retry).
  - AgentEvent payloads (plan step, tool call, tool result, log, error, status).
  - ToolCallEnvelope (toolId, requesterId, input, reason, runId).
  - ToolCallResult (ok, output, error, durationMs).
  - PolicyDecision (allowed, reason, scope).
- Add IPC channel constants for:
  - agent:runs:list/get/start/cancel/retry
  - agent:events:subscribe/unsubscribe
  - agent:trace:list
- Update preload API typing to expose read-only agent events and run controls.
- Ensure JSON schema generation includes the new agent contracts.

## IPC + process boundaries
- Renderer -> Main: start/cancel/retry run, list runs, read trace events.
- Main -> Renderer: push agent events via event channel (no secrets).
- Agent Host -> Main: request tool execution via broker-client with Zod-validated
  envelopes; receive policy-gated results.
- Main is the only process that touches OS resources and secrets.
- Main -> Renderer: send a View menu event to toggle the secondary sidebar.

## UI components and routes
- Right panel "Agents" view: run list, active run status, and event stream.
- Reuse existing layout regions; avoid new global styling or UI library changes.
- Optional: command palette entry to start an agent run.

## Data model changes
- AgentRunStore in main: metadata + event log, keyed by runId.
- Event log uses append-only entries with size or count caps.
- Redact or omit sensitive fields from persisted events.

## Failure modes + recovery
- Policy denial: emit denied tool result event, mark step as failed or skipped.
- Agent Host crash: main marks run as failed and notifies renderer.
- Event backlog: drop or summarize low-priority log events with warning.
- Malformed tool response: validate with Zod, emit error event, continue or fail.
- Cancellation timeout: force-cancel and record audit event.

## Testing strategy
- Unit tests: Zod contract validation, Agent Host run state transitions,
  broker-main policy decision handling, trace redaction.
- Integration tests: Agent Host <-> Main IPC, tool call envelope flow,
  event streaming to renderer.
- UI tests: right panel status rendering and event list ordering.
- Verification commands:
  - pnpm -r typecheck
  - pnpm -r lint
  - pnpm -r test
  - pnpm -r build

## Rollout / migration
- Introduce behind a feature flag or config toggle.
- Start with in-memory or JSON-backed run storage; migrate to SQLite later.

## Risks + mitigations
- Risk: accidental secret leakage in traces.
  - Mitigation: redact fields at event creation and validate payloads.
- Risk: policy denies break agent flow.
  - Mitigation: emit explicit denial events and allow graceful recovery.
- Risk: event stream overwhelms renderer.
  - Mitigation: throttle low-priority events and cap retention.

## Done definition
- Contracts for agent runs, events, and tool call envelopes exist in api-contracts.
- Agent Host <-> Main IPC boundaries enforce policy and audit logging.
- Renderer can start/cancel runs and display event streams without secrets.
- Tests cover contract validation and message flow; verification commands defined.
