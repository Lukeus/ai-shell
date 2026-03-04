# 165 - Multi-Agent Skill Delegation

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P2, P3, P5, P6, P7).

## Problem / Why
- The current skills system applies a single skill to one agent run, but does not support structured agent-to-agent delegation.
- `deepagents` already supports subagents (`subagents` + built-in `task` tool), but our runtime does not map skill definitions into that capability.
- There is no contracts-first shape for delegation metadata, delegation events, or delegated tool-call lineage.
- The first-party `agent-skills` extension cannot express orchestrator workflows that hand off to specialist skills.

## Goals
- Enable supervisor agents to delegate work to skill-backed subagents in a controlled workflow.
- Allow subagents to run with explicit tool policy boundaries and skill-derived prompts.
- Keep all delegation orchestration policy-governed and auditable through main/broker boundaries.
- Expose delegation progress in the agent event stream and run trace without leaking secrets.

## Decisions
- Delegation is modeled as an optional block on `AgentSkillDefinition` and extension `contributes.agentSkills`.
- Delegation entries reference existing skills by `skillId`; subagents do not store inline secrets or connection credentials.
- Main process resolves and validates the delegation graph before starting the run (missing skills, disabled skills, cycles, depth limits).
- v1 supports bounded delegation depth and bounded delegation count per run to prevent runaway task spawning.
- Subagents inherit the run connection context in v1; per-subagent connection/model switching is out of scope.

## Non-goals
- Distributed/multi-machine agent swarms.
- Automatic skill generation from run transcripts.
- Cross-run delegation analytics dashboards.
- Per-subagent secret or credential injection from renderer.

## User stories
1. As a user, I can choose an orchestrator skill that delegates to specialist subagents.
2. As a user, I can see when delegation starts/completes/fails in the run timeline.
3. As an admin, I can audit delegated tool calls with clear supervisor/subagent lineage.
4. As an extension author, I can contribute delegation-capable skills in the manifest.
5. As a security reviewer, I can verify delegated runs still obey tool policy and secret boundaries.

## UX requirements
- Skills UI provides a delegation section for user-editable skills (extension-contributed skills remain read-only).
- Agent run timeline shows delegation lifecycle rows (started, completed, failed) with subagent name + skill ID.
- Delegation validation errors are actionable before run start (e.g., missing or disabled referenced skill).
- UI changes include a screenshot under `specs/165-multi-agent-skill-delegation/screenshots/`.

## Functional requirements
- Add contracts for delegation-enabled skills:
  - `AgentSkillDelegation` configuration (enabled flag, limits, subagent list).
  - `AgentSubagentDefinition` entries with `name`, `description`, referenced `skillId`, and optional tool policy overrides.
- Extend run contracts with resolved delegation configuration passed to agent-host/runtime.
- Add agent event contracts for delegation lifecycle and delegated agent identity/lineage.
- Add optional tool-call context metadata to distinguish supervisor vs subagent tool executions for audit.
- Main-process skill resolution must:
  - Resolve supervisor skill and all referenced subagent skills.
  - Merge tool policies safely (denylist precedence, no policy widening).
  - Reject cycles, missing references, disabled references, and over-budget delegation definitions.
- Agent runtime must map resolved delegation config into DeepAgents `subagents` and keep delegation within configured limits.
- Skills extension must support editing and persisting delegation-capable user skills.
- First-party `agent-skills` extension should include at least one delegation example (orchestrator delegating to specialists).

## Security requirements
- No plaintext secrets in delegation config, run metadata, events, or logs.
- Delegated tool calls remain brokered through main with policy + audit enforcement.
- Renderer only accesses delegation data through `window.api` contracts.
- Main process remains the only place where skills are resolved and validated against policy.

## Performance requirements
- Delegation-enabled runs preserve event-stream responsiveness targets (<200ms publish latency target).
- Delegation setup overhead at run start remains bounded and proportional to configured subagent count.
- Delegation does not affect Monaco lazy-loading or renderer initial chunk budgets.

## Acceptance criteria
- A delegation-capable skill can start a run that hands off at least one task to a configured subagent.
- Subagent tool calls honor merged allow/deny policy and are auditable with delegation lineage.
- Invalid delegation definitions fail fast with actionable errors before run execution.
- Delegation lifecycle events are persisted and visible in the Agents UI stream.
- Extension-contributed delegation skills appear in Skills UI and remain read-only.
- Screenshot added for delegation-related UI updates.

## Out of scope / Future work
- Parallel delegation scheduling controls and advanced load balancing.
- Per-subagent model/provider routing.
- Multi-level delegation beyond configured v1 bounds.
- Delegation replay/visual graph explorer.

## Open questions
- Should v1 allow parallel subagent execution or force serial delegation only?
- Should delegated summaries be persisted as dedicated artifacts separate from raw event traces?
- Should workspace skill overrides be allowed to shadow referenced global delegation skills by default?
