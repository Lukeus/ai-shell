# 157 - DeepAgents Runtime Integration - Technical Plan

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P3, P5, P6, P7).

## Architecture changes
- Agent Host delegates orchestration to packages/agent-runtime (deepagents) and uses broker-client for tool calls.
- broker-client provides a typed IPC transport over process.send/on('message').
- packages/agent-memory supplies a run-scoped memory store for deepagents.
- packages/agent-policy owns policy evaluation; broker-main uses it.
- Main adds a publish choke point that validates AgentEventSchema and redacts sensitive fields before renderer events.

## Contracts (api-contracts updates)
- Extend DeepAgentRunConfig with memory settings (maxEntries, maxBytes) and optional policy overrides (allowlist, denylist).
- Add AgentMemoryConfig and AgentPolicyConfig schemas if needed.
- Document "secretRef-only" expectations on ToolCallEnvelope and tool inputs (no plaintext secrets).

## IPC + process boundaries
- Agent Host -> Main: broker-client sends tool-call requests; main replies with tool-result.
- Main -> Renderer: only validated + redacted agent events over IPC.
- Renderer remains read-only for agent events; no OS access.

## UI components and routes
- No new UI components; existing Agents panel continues to render events.

## Data model changes
- New in-memory store for agent memory (bounded per run).
- Policy config surfaced in DeepAgentRunConfig.
- Optional memory snapshots for debugging (non-secret).

## Failure modes + recovery
- Policy denial returns TOOL_ERROR_CODES.POLICY_DENIED and emits tool-result failure.
- Broker-client timeout emits error event and fails the run.
- Agent Host crash marks run failed in AgentRunStore; main notifies renderer.

## Testing strategy
- Unit: broker-client correlation/timeout, agent-memory bounds, agent-policy evaluation, deepagents event sequence.
- Integration: agent-host <-> main tool call flow, policy denial path, renderer publish redaction.
- Verify no secrets in events by snapshot tests against redaction.

## Rollout / migration
- Guard behind existing settings flag if available; default on in dev, off in release until verified.

## Risks + mitigations
- Risk: secret leakage in event payloads. Mitigation: contract guidelines + redactor + schema validation.
- Risk: deepagents behavior drift with upstream versions. Mitigation: pin version and add regression tests.
- Risk: broker-client IPC congestion. Mitigation: bounded queue and timeouts.

## Done definition
- broker-client, agent-memory, agent-policy implemented and tested.
- agent-runtime uses deepagents and emits contract-shaped events.
- broker-main uses agent-policy and audits decisions.
- renderer only sees validated/redacted events.
