# 070 Agent Host - Deep Agents (LangChain DeepAgents) - Technical Plan

## Architecture changes
- **Agent Host process owns Deep Agents orchestration**, run state machine, and tool execution coordination; **no direct OS access**.
- **Main process owns policy enforcement**, audit logging, trace storage, and any OS operations for tool calls via broker-main.
- Renderer subscribes to agent run events via minimal preload APIs; UI remains read-only for traces, status, and outputs (sanitized).
- Broker-client in Agent Host sends tool call requests to broker-main; broker-main routes to tool implementations and returns validated results.
- Add an AgentRunStore in main (JSON for now) to persist run metadata, todo snapshots, and trace events with bounded retention.
- Add a **VirtualFS** service in main to provide Deep Agents filesystem-like tools without exposing the real filesystem.

## Deep Agents integration
- Agent Host wraps **deepagentsjs** to run:
  - planning/todos generation and updates
  - tool selection + execution
  - optional subagents (with bounded budgets)
- Use Deep Agents middleware/hooks to:
  - emit structured plan/todo events
  - attach correlation ids (todoId, deepStepId, subagentId) to tool calls
  - throttle noisy events
  - enforce step/tool-call/wallclock budgets

## Contracts (api-contracts updates)
- Add/extend Zod schemas for:
  - AgentRun metadata (id, status, createdAt, updatedAt, source).
  - DeepAgentRunConfig (goal, modelRef, tool allowlist, mounts, budgets, metadata).
  - AgentRunStartRequest (goal, inputs, config, tool allowlist, metadata).
  - AgentRunControlRequest (cancel, retry, optional resume).
  - AgentEvent payloads:
    - agent:plan (structured plan/todos)
    - agent:todo:update
    - agent:subagent:start/end
    - tool call / tool result
    - log / error / status
  - ToolCallEnvelope (toolId, requesterId, input, reason, runId, todoId?, deepStepId?, subagentId?, idempotencyKey?).
  - ToolCallResult (ok, output, error, durationMs, redactionsApplied?).
  - PolicyDecision (allowed, reason, scope, category, requiresUserApproval?, redactionsApplied?).
- Add IPC channel constants for:
  - agent:runs:list/get/start/cancel/retry (optional: resume)
  - agent:events:subscribe/unsubscribe
  - agent:trace:list
  - agent:vfs:stats (optional diagnostics)
- Update preload API typing to expose read-only agent events and run controls.
- Ensure JSON schema generation includes the new agent contracts.

## IPC + process boundaries
- Renderer -> Main: start/cancel/retry run, list runs, read trace summaries and safe outputs.
- Main -> Renderer: push agent events via event channel (sanitized; no secrets).
- Agent Host -> Main: request tool execution via broker-client with Zod-validated envelopes; receive policy-gated results.
- Main is the only process that touches OS resources and secrets.
- Main -> Renderer: send a View menu event to toggle the secondary sidebar.

## Tooling model
### Virtual filesystem (required)
- Implement VirtualFS in main with mount boundaries and quotas:
  - `/workspace` (read-only mirror or controlled snapshot)
  - `/runs/<runId>` (writable outputs)
  - `/scratch` (ephemeral)
- Expose broker tools that Deep Agents calls instead of real fs:
  - vfs.ls, vfs.read, vfs.write, vfs.edit, vfs.glob, vfs.grep
- Policy + audit for every vfs op; redact content where needed.

### Other tools (initial ship set)
- repo.search (ripgrep-like on indexed workspace)
- repo.openFile (read-only)
- repo.applyPatch (writes patch artifacts; optional “apply” gated by policy)

## UI components and routes
- Right panel "Agents" view: run list, active run status, plan/todos, and event stream.
- Display subagent start/end and summaries (optional in phase 1).
- Reuse existing layout regions; avoid new global styling or UI library changes.
- Optional: command palette entry to start an agent run.

## Data model changes
- AgentRunStore in main: metadata + event log + latest todo snapshot, keyed by runId.
- VirtualFS store: per-run files and sizes; enforce quotas and retention.
- Event log uses append-only entries with size or count caps.
- Redact or omit sensitive fields from persisted events and outputs.

## Failure modes + recovery
- Policy denial: emit denied tool result event; Agent Host continues (skip/alternate) or ends gracefully as “blocked”.
- Agent Host crash: main marks run as failed and notifies renderer.
- Budget exceeded (steps/toolcalls/wallclock): deterministic terminal event with reason.
- Event backlog: drop/aggregate low-priority log events with warning.
- Malformed tool response: validate with Zod, emit error event, continue or fail.
- Cancellation timeout: force-cancel and record audit event.
- VirtualFS quota exceeded: error result; agent instructed to summarize/compact outputs.

## Testing strategy
- Unit tests:
  - Zod contract validation (including Deep Agents event shapes)
  - Agent Host run state transitions + budget enforcement
  - broker-main policy decision handling
  - trace redaction and output sanitization
  - VirtualFS quotas + mount boundary enforcement
- Integration tests:
  - Agent Host <-> Main IPC, tool call envelope flow (including vfs ops)
  - event streaming to renderer (plan/todos + ordering)
- UI tests:
  - right panel status rendering
  - plan/todos rendering
  - event list ordering and grouping
- Verification commands:
  - pnpm -r typecheck
  - pnpm -r lint
  - pnpm -r test
  - pnpm -r build

## Rollout / migration
- Introduce behind a feature flag or config toggle.
- Start with JSON-backed run storage and VirtualFS store; migrate to SQLite later.

## Risks + mitigations
- Risk: accidental secret leakage in traces/outputs.
  - Mitigation: redact fields at event creation and validate payloads; sanitize before persistence and renderer emission.
- Risk: Deep Agents filesystem tools touching real disk.
  - Mitigation: do not wire real fs tools; only expose VirtualFS via broker-main.
- Risk: policy denies break agent flow.
  - Mitigation: emit explicit denial events and allow graceful recovery.
- Risk: event stream overwhelms renderer.
  - Mitigation: throttle and aggregate low-priority events and cap retention.
- Risk: subagents amplify tool usage and noise.
  - Mitigation: cap subagent count and budgets; require summarized outputs.

## Done definition
- Contracts for agent runs, Deep Agents plan/todo/subagent events, and tool call envelopes exist in api-contracts.
- Agent Host runs deepagentsjs orchestration; all tools go through broker-main with policy + audit.
- VirtualFS exists in main and is the only filesystem surface available to agents.
- Renderer can start/cancel runs and display plan/todos + event streams without secrets.
- Tests cover contract validation, VirtualFS enforcement, and message flow; verification commands defined.
