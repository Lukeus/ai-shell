# 165 - Multi-Agent Skill Delegation - Technical Plan

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P2, P3, P5, P6, P7).

## Research summary
- Current runtime (`packages/agent-runtime/src/runtime/DeepAgentRunner.ts`) creates `createDeepAgent({ model, backend, tools })` but does not pass `subagents`.
- The installed `deepagents@1.3.1` package supports subagent delegation via `createDeepAgent({ subagents })` and a built-in `task` tool.
- Skills are already persisted/resolved in main (`SkillsService`), so delegation resolution belongs in main before agent-host execution.

## Architecture changes
- Extend skill definitions with a delegation block that references specialist skills for subagent handoff.
- Add a main-process DelegationResolver that validates and resolves supervisor + subagent skills into runtime-ready config.
- Extend run wiring so resolved delegation config flows main -> agent-host -> agent-runtime.
- Update `DeepAgentRunner` to construct DeepAgents `subagents` and emit delegation lifecycle events.
- Extend tool-call envelopes with optional delegation context for audit lineage.

## Contracts (api-contracts updates)
- Update `agent-skills` schemas:
  - `AgentSubagentDefinition` (name, description, skillId, optional policy overrides, enabled).
  - `AgentSkillDelegation` (enabled, maxDepth, maxDelegations, subagents[]).
  - Add optional `delegation` to `AgentSkillDefinition`.
- Update run schemas:
  - Add `delegation` to `DeepAgentRunConfig` for resolved runtime delegation config.
  - Add delegation metadata shape on run metadata where needed for audit/trace.
- Update events:
  - Add delegation event types (start/completed/failed) to `AgentEventSchema`.
- Update tool envelope:
  - Add optional delegation context fields (supervisor/subagent identity, depth, skillId).
- Update exports in `packages/api-contracts/src/index.ts`.

## IPC + process boundaries
- Renderer sends standard run requests (`window.api.agents.startRun`) with optional `skillId`; no renderer-side delegation resolution.
- Main resolves skill + delegation graph and passes only resolved config to agent-host.
- Agent-host remains orchestration boundary and forwards resolved config to runtime.
- All tool execution stays in broker-main with policy enforcement; no direct renderer or extension-host execution.

## Runtime design
- Build subagent runtime definitions from resolved delegation config:
  - `systemPrompt` sourced from referenced skill prompt template + delegation hints.
  - tool set restricted by merged allowlist/denylist (never broader than supervisor policy).
- Enforce v1 delegation safety controls:
  - maximum subagent count,
  - maximum depth,
  - maximum delegation operations per run.
- Emit delegation lifecycle events from runtime stream handling.

## Data model changes
- User/global/workspace skill stores persist optional delegation config.
- Extension skill contributions may include delegation config in manifest.
- Run metadata can record resolved delegation summary (enabled, subagent IDs, limits).

## Failure modes + recovery
- Missing/disabled referenced skill: fail run start with actionable error.
- Delegation cycle detected: fail run start with cycle path in error message.
- Delegation budget/depth exceeded: emit delegation failure event and return structured error.
- Subagent tool policy denial: emitted as tool-result failure with policy code; run may continue if supervisor handles it.

## Testing strategy
- Contract tests:
  - Valid/invalid delegation schema payloads.
  - Event/tool envelope parsing for delegation fields.
- Main unit tests:
  - Delegation resolution,
  - policy merge and denylist precedence,
  - cycle/depth/budget enforcement.
- Runtime tests:
  - `createDeepAgent` receives subagents,
  - delegation events emitted,
  - delegated tool calls include lineage metadata.
- Integration tests:
  - start run with orchestrator skill and verify event stream + run metadata.
- UI tests:
  - skill editor delegation section,
  - agent timeline delegation rows.
- E2E:
  - orchestrator skill delegates to reviewer/implementer subagents.

## Rollout / migration
- Backward compatible: existing skills without delegation continue unchanged.
- Default behavior remains single-agent unless delegation is explicitly configured.
- Ship one first-party orchestration skill example in bundled `agent-skills` extension.

## Risks + mitigations
- Risk: runaway delegation loops. Mitigation: static cycle checks + runtime depth/budget limits.
- Risk: policy widening through overrides. Mitigation: enforce intersection semantics and denylist precedence in main.
- Risk: runtime complexity in `DeepAgentRunner`. Mitigation: split runtime into focused modules as part of implementation.
- Risk: noisy event streams. Mitigation: dedicated delegation event types and UI grouping rules.

## Done definition
- Contracts updated for delegation skill schema, run config, events, and tool envelope context.
- Main resolves delegation-safe subagent config before run start.
- Runtime uses DeepAgents subagents and emits delegation lifecycle events.
- Skills extension supports delegation-capable skill definitions.
- UI surfaces delegation configuration and run progress with screenshot.
- Tests pass across contracts, main, runtime, renderer, and e2e paths.
