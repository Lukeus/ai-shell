# 070 Agent Host - Deep Agents (LangChain DeepAgents)

## Problem / Why
The product needs a dedicated **Agent Host** process to run **LangChain Deep Agents**
orchestration (planning/todos, optional subagents, tool execution) without giving
the renderer or extensions direct OS access. Today there is no clear spec for
agent lifecycle, Deep Agents-specific events (plan/todos/subagents), tool execution,
policy gating, or event streaming to the UI. This makes it hard to build reliable
agent runs, audit sensitive actions, prevent secret leakage, and keep the renderer isolated.

## Goals
- Define the Agent Host process responsibilities and boundaries for **Deep Agents runtime**.
- Specify contracts for:
  - agent lifecycle events
  - Deep Agents plan/todo events
  - subagent events
  - tool call envelopes + results (Zod-first)
- Stream agent progress and outputs to the UI in the right panel (including plan/todos).
- Ensure tool execution (including filesystem-like operations) is policy-gated and audited in main.
- Persist run metadata and traces (non-secret) with bounded retention.

## Non-goals
- Implementing LLM provider setup, key management, or model catalog UI.
- UI redesign beyond existing right panel patterns.
- Extension marketplace, signing, or policy UI.
- Secret storage changes (handled by SecretsService).
- Cross-device run sync or multi-user collaboration.
- Giving Agent Host access to the real OS filesystem or secrets (explicitly forbidden).

## Personas
- **User**: starts runs, watches progress, views outputs.
- **Admin/SecOps**: audits tool usage + policy decisions.
- **Extension author**: registers tools with contracts + permissions.
- **Platform engineer**: maintains process boundaries, stability, and performance.

## User stories
- As a user, I can start a Deep Agents run and see **plan/todos** and progress in real time.
- As a user, I can cancel or retry a run and see a clear end state.
- As a user, I can view run outputs produced by the agent (files/artifacts) safely.
- As an admin, I can audit which tools were invoked and why (including FS-like operations).
- As an extension author, I can register tools with schemas that are validated.
- As security, I can deny tool calls deterministically without crashing the agent runtime.

## UX requirements
- Right panel shows agent state (idle, running, canceled, failed, completed).
- Event stream lists plan/todos, tool calls, tool results, logs, errors, and status in order.
- Controls for start, stop, and retry are visible and consistent with existing UI.
- Errors are shown with actionable messaging (no raw secrets).
- Use existing layout and Tailwind token styles.
- Secondary side bar can be toggled from the View menu (mirrors VS Code).
- Optional: show subagent start/end events and subagent summaries.

## Functional requirements
- Agent Host runs as a separate process from renderer and extensions.
- Agent Host hosts the **Deep Agents orchestration loop**:
  - planning/todos
  - tool selection + tool calls
  - optional subagents
  - completion/failure/cancel
- Agent Host communicates with main via broker-client and IPC.
- Main process enforces policy checks for all tool calls.
- Contracts define agent lifecycle events, Deep Agents plan/todo/subagent events, tool calls, and trace payloads in `packages/api-contracts`.
- Tools declare schemas and permissions; inputs/outputs validated via Zod.
- Audit service records tool usage and policy decisions (no secret values).
- Store run metadata and trace events locally; redact sensitive data.
- Support cancellation, timeouts, and failure events.
- Provide a filesystem-like surface for agents **only via a virtual backend** (VirtualFS in main).

## Security requirements
- Renderer has no OS access; Agent Host has no direct OS access.
- IPC payloads are validated via Zod contracts (contracts-first).
- Secrets never leave main; Agent Host receives handles only (if needed).
- Audit logs must not include plaintext secrets.
- contextIsolation remains on with minimal preload surface.
- VirtualFS enforces:
  - path allowlist/mount boundaries
  - quotas (size/count)
  - redaction on read/write as needed

## Performance requirements
- Agent Host startup under 500ms on a typical dev machine.
- UI event stream updates within 200ms of event emission.
- Tool call routing overhead under 100ms for local calls (excluding tool runtime).
- Trace storage and VirtualFS storage bounded by size or run count to avoid unbounded growth.
- Event stream throttling/aggregation available for spammy logs/ops.

## Acceptance criteria
- Agent Host process is defined with clear boundaries and responsibilities for Deep Agents runtime.
- Zod contracts exist for lifecycle events, plan/todo/subagent events, and tool call envelopes/results.
- Tool execution is routed through broker-main with policy checks and audit logs.
- Renderer can display agent run status and streamed events, including plan/todos.
- Cancellation and failure paths emit deterministic events.
- No plaintext secrets are logged or exposed to renderer or Agent Host.
- VirtualFS is the only filesystem surface available to agents.
- Tests exist for contract validation and agent-host message flow (including VirtualFS ops).

## Out of scope / Future work
- Multi-agent coordination across machines.
- Long-term trace retention, sync, or cloud storage.
- Advanced visualization (timeline, dependency graphs).
- Enterprise policy configuration UI.
- Offline or background agent runs.
- Automatic run resume after restart (unless state model is formalized).

## Open questions
- What is the default trace retention policy and storage format (JSON vs SQLite first)?
- Which initial tool set ships with the Agent Host (repo tools, http, ado, etc.)?
- How are tool permissions surfaced to users (later UI)?
- Should agent runs be resumable after app restart (if so, what safe state is stored)?
- What are the default VirtualFS quotas (bytes/files per run)?
