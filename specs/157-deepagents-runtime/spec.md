# 157 - DeepAgents Runtime Integration

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P3, P5, P6, P7).

## Problem / Why
- packages/agent-runtime is a stub and does not use the deepagents library.
- packages/agent-memory, packages/agent-policy, and packages/broker-client are empty shells.
- Tool execution is wired ad-hoc; policy decisions and event publish safety are not enforced at a single choke point.

## Goals
- Implement LangChain DeepAgents orchestration in packages/agent-runtime using deepagents.
- Implement packages/broker-client for tool call IPC between agent-host and main.
- Implement packages/agent-memory for in-memory run memory with bounded retention.
- Implement packages/agent-policy and wire broker-main to use it.
- Enforce "never-secret" agent event payloads (secretRef-only) and add defensive redaction + schema validation before renderer publish.
- Add tests for broker-client, memory, policy, and deepagents event flow.

## Non-goals
- UI redesign or new panels.
- Changes to SecretsService or storage formats.
- New extension marketplace or signing work.
- Persistent long-term memory (beyond bounded in-memory storage).
- Multi-agent coordination.

## User stories
1. As a user, I can start a DeepAgents run and see plan/todo/tool events stream in the UI.
2. As a security owner, tool calls are policy-gated in main and audited.
3. As a maintainer, tool IPC is brokered through a typed client, not ad-hoc process messaging.
4. As an extension author, tools run through the same policy and audit pipeline.
5. As an operator, no secret values are emitted to the renderer.

## UX requirements
- Existing Agents panel continues to display run status, plan steps, and tool events.
- Policy denials appear as tool-result failures with a clear error code.
- No new UI or layout changes.

## Functional requirements
- Broker-client provides a request/response API for tool calls with correlation IDs, timeouts, and schema validation.
- Agent-host uses broker-client; agent-runtime uses the broker-client transport via ToolExecutor.
- Agent-runtime integrates deepagents to generate plans, todos, tool calls, and status events.
- Agent-memory provides run-scoped memory with bounded size and safe serialization.
- Agent-policy exposes allowlist/denylist evaluation and is the single source of policy logic for broker-main.
- Agent events and tool envelopes are secretRef-only by contract; main performs a cheap redaction + schema validation before publish to renderer.

## Security requirements
- Renderer has no OS access; agent-host has no direct OS access.
- No secrets in logs, traces, or event payloads; only secretRef handles.
- Encryption/decryption remains in main only (safeStorage).
- Contracts-first changes land in packages/api-contracts before use.

## Performance requirements
- Broker-client round-trip overhead under 100ms for local tool calls (excluding tool runtime).
- Agent-memory is bounded (configurable max entries and max bytes).
- Event publish to renderer within 200ms of receipt.

## Acceptance criteria
- DeepAgents orchestration is implemented in packages/agent-runtime using the deepagents dependency.
- packages/broker-client, packages/agent-memory, and packages/agent-policy contain real code with tests.
- broker-main consumes agent-policy and continues to audit policy decisions.
- Main process validates and redacts agent events before sending to renderer.
- Agent events contain only secretRef handles; no plaintext secrets appear in the renderer stream.

## Out of scope / Future work
- Cross-run memory persistence or vector stores.
- Multi-agent collaboration or distributed runs.
- Advanced UI visualizations (timelines, graphs).
- Cloud policy management.

## Open questions
- What default memory retention limits should ship (entries/bytes)?
- Which deepagents planning strategy should be default (plan depth, todo granularity)?
- Should policy configuration be per-run or global settings only?
