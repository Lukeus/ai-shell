# 164 - Agent Skill Management Extension

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P2, P3, P5, P6, P7).

## Problem / Why
- Agent runs have no reusable, user-managed skill presets today.
- Extension authors cannot contribute skills that agents can use consistently.
- Skill configuration is ad-hoc, which makes runs harder to audit and reproduce.
- There is no UI for discovering, enabling, or editing skills.

## Goals
- Define a formal Agent Skill schema for reusable behavior presets.
- Allow extensions to contribute skills and users to create local skills.
- Provide a first-party extension that manages skills and exposes a Skills UI.
- Allow agent runs to reference a skill by id and record it in run metadata.
- Keep skill data free of secrets and enforce validation at the boundary.

## Decisions
- Skill definitions are resolved in main and merged into run config before agent-host executes.
- Extension-contributed skills are read-only; user skills are editable.
- Skill definitions never include secrets; only references like connectionId are allowed.

## Non-goals
- Skill marketplace or distribution platform.
- Multi-skill composition or chaining.
- Cross-device sync for skill libraries.
- Deep skill debugging or analytics.

## User stories
1. As a user, I can browse skills, enable/disable them, and use them when starting a run.
2. As a user, I can create and edit my own skills.
3. As an admin, I can audit which skill was applied to a run.
4. As an extension author, I can contribute skills via the manifest.
5. As a security reviewer, I can verify skill data contains no secrets.

## UX requirements
- Provide a Skills view with list, search, and detail panel.
- Provide create/edit flows for user skills with validation feedback.
- Show skill source (extension or user) and enabled state.
- Agents run form exposes an optional skill selector and default indicator.
- UI changes include a screenshot in specs/164-agent-skill-management-extension/screenshots/.

## Functional requirements
- Add api-contracts schemas for AgentSkill definitions and responses.
- Extend extension manifests with contributes.agentSkills.
- Add a main-process SkillsService to aggregate extension and user skills.
- Provide IPC for list/get/create/update/delete/enable/default skill actions.
- Extend AgentRunStartRequest with skillId and persist run.skill metadata.
- Main resolves skill config and merges into run config with clear precedence rules.
- Agent-host receives only the resolved config; it never edits skills.
- Add agents.defaultSkillId to settings for default selection.
- Handle missing or invalid skills with actionable errors and UI warnings.

## Security requirements
- Skill definitions must not contain secrets; validation rejects secret fields.
- Renderer uses window.api.skills only; no direct filesystem access.
- Skill persistence happens only in main process.
- Run metadata records skill usage without logging prompts or secret data.

## Performance requirements
- Skill list response is cached or memoized and refreshed on changes.
- Extension skill discovery does not block the renderer.

## Acceptance criteria
- Skills list includes extension and user skills with source and enabled state.
- Users can create, edit, enable/disable, and delete local skills.
- Extensions can contribute skills via manifest and appear in the list.
- Agent runs accept optional skillId and record skill metadata.
- Default skill applies when run omits skillId.
- No secrets reach renderer or agent-host, verified by tests.
- Screenshot added for the Skills UI.

## Out of scope / Future work
- Skill composition and chaining.
- Skill marketplace and signing workflow.
- Skill analytics and telemetry dashboards.

## Open questions
- Are skills global or per-workspace? per-workspace/repo
- Should skills allow denylist rules or only allowlists? Both
- Should skills be allowed to specify modelRef or only inherit connectison defaults? for now, connection defaults
- Do we need a "last used skill" override separate from default? yeah
