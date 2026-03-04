# 164 - Agent Skill Management Extension - Technical Plan

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P2, P3, P5, P6, P7).

## Architecture changes
- Add a SkillsService in main to aggregate extension and user skills.
- Add a global SkillsStore for user-defined skills in userData (JSON only).
- Add a WorkspaceSkillsStore for workspace extensions/overrides (JSON only).
- Add a SkillResolver in main to merge skill config into AgentRunStartRequest.
- Extend extension host contribution registry and extension SDK for agentSkills.
- Seed a first-party agent-skills extension bundled with the app.
- Track per-workspace skill preferences (defaultSkillId, lastUsedSkillId) with global fallback and apply in resolution.

## Contracts (api-contracts updates)
- Add AgentSkill schemas: AgentSkillId, AgentSkillDefinition, AgentSkillDescriptor, AgentSkillSource, AgentSkillInputSchema.
- Add SkillScope schema (global/workspace) and include it on descriptors and CRUD requests.
- Add SkillPreferences schema (defaultSkillId, lastUsedSkillId) scoped per workspace, with optional global fallback.
- Add skills IPC schemas (list/get/create/update/delete/enable/setDefault/setLastUsed), including scope.
- Extend ExtensionManifestSchema and contribution types with contributes.agentSkills.
- Extend AgentRunStartRequest with skillId and AgentRunMetadata with skill.
- Add toolAllowlist + toolDenylist to skill definitions; exclude modelRef.
- Update ipc-channels, preload-api, and package exports.

## IPC + process boundaries
- Renderer -> Main: skills list/get/create/update/delete/enable/setDefault, with scope awareness.
- Extension Host -> Main: agentSkills contributions only; no skill editing.
- Main -> Agent Host: resolved run config only.
- No secrets cross into renderer or host processes.

## UI components and routes
- Add a Skills UI (panel or settings section) with list and edit form.
- Add a skill selector to the Agent run form with default indicator.
- Skills UI supports Global vs Workspace scopes and shows workspace name when applicable.
- Capture a screenshot under specs/164-agent-skill-management-extension/screenshots/.

## Data model changes
- Global user skills stored in userData/skills.json: id, name, description, promptTemplate, toolAllowlist, toolDenylist, inputs schema, tags, enabled, version, timestamps.
- Workspace skills stored under workspace (.ai-shell/skills.json) for extensions/overrides.
- AgentRunMetadata stores skill metadata: skillId, source, version.
- Per-workspace preferences: defaultSkillId, lastUsedSkillId with optional global fallback.

## Failure modes + recovery
- Missing or disabled skill: reject run with actionable error.
- Extension removed: mark contributed skills unavailable and warn.
- Invalid skill definition: skip with error log and continue.
- No workspace open: allow global skills only and disable workspace edits.

## Testing strategy
- Contract schema tests for skills and IPC responses.
- SkillsService unit tests (merge rules, global/workspace overlay, defaults, last used).
- IPC handler tests for skills CRUD and list.
- Agent run integration tests for skill resolution and metadata.
- UI tests for selector and validation.
- E2E: create skill, set default, start run, verify metadata and last-used behavior.

## Rollout / migration
- Global and per-workspace skill stores created on first use.
- Seed first-party agent-skills extension on first run.

## Risks + mitigations
- Skill config conflicts with explicit run config: enforce precedence rules and tests.
- Skills UI complexity: keep v1 minimal and focused.
- Extension skill list drift: refresh on extension registry changes.
- Per-workspace scope confusion: display workspace name in Skills UI header.
- Global vs workspace conflicts: document precedence and show an override badge.

## Done definition
- Contracts updated and tests pass.
- SkillsService and IPC live in main with persisted user skills.
- Extension contributions for skills supported and visible in UI.
- Agent runs accept skillId and persist skill metadata.
- Skills UI and screenshot are delivered.
