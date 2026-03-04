# 164 - Agent Skill Management Extension - Tasks

## Rules
- Ordered tasks only
- Each task: files to change, verification commands, invariants to protect

## Task 1 - Contracts-first: skills schemas + run metadata
**Files**:
- packages/api-contracts/src/types/agent-skills.ts (new)
- packages/api-contracts/src/types/extension-contributions.ts
- packages/api-contracts/src/types/extension-manifest.ts
- packages/api-contracts/src/types/agent-runs.ts
- packages/api-contracts/src/ipc-channels.ts
- packages/api-contracts/src/preload-api.ts
- packages/api-contracts/src/index.ts
- packages/api-contracts/src/types/agent-skills.test.ts (new)

**Work**:
- Define AgentSkill schemas (definition, descriptor, source, input schema).
- Add SkillScope (global/workspace) and include in CRUD request schemas.
- Add contributes.agentSkills to manifest and contribution exports.
- Extend AgentRunStartRequest with skillId and AgentRunMetadata with skill info.
- Add SkillPreferences schema (defaultSkillId, lastUsedSkillId) scoped per workspace with global fallback.
- Define skills IPC request/response schemas and preload typings (including setLastUsed).
- Add schema tests for valid/invalid skill definitions and run metadata.
- Add toolAllowlist + toolDenylist fields and exclude modelRef from skills.

**Verify**:
- pnpm --filter packages-api-contracts test

**Invariants**:
- P6 (Contracts-first)
- P3 (No secrets in contracts)

---

## Task 2 - Extension host + SDK: skill contributions
**Files**:
- apps/extension-host/src/contribution-registry.ts
- apps/extension-host/src/contribution-registry.test.ts
- packages/extension-sdk/src/contributions/agentSkills.ts (new)
- packages/extension-sdk/README.md

**Work**:
- Track agentSkills contributions in the registry and expose them to main.
- Validate contributions against AgentSkillDefinitionSchema.
- Add SDK helper to register/list agent skills for extension authors.

**Verify**:
- pnpm --filter apps-extension-host test

**Invariants**:
- P1 (Process isolation)
- P6 (Contracts-first)

---

## Task 3 - Main SkillsService + IPC
**Files**:
- apps/electron-shell/src/main/services/SkillsService.ts (new)
- apps/electron-shell/src/main/services/SkillsStore.ts (new)
- apps/electron-shell/src/main/ipc/skills.ts (new)
- apps/electron-shell/src/main/ipc-handlers.ts
- apps/electron-shell/src/preload/index.ts
- apps/electron-shell/src/main/services/SkillsService.test.ts (new)
- apps/electron-shell/src/main/ipc-handlers.skills.test.ts (new)

**Work**:
- Aggregate extension and user skills with source metadata.
- Implement CRUD for user skills across global + workspace scopes.
- Cache list responses and refresh on extension changes.
- Persist skill preferences (default + last used) per workspace with global fallback.
- Expose skills IPC via preload window.api.skills.

**Verify**:
- pnpm --filter apps-electron-shell test

**Invariants**:
- P1 (Renderer has no OS access)
- P3 (No secrets)

---

## Task 4 - Agent run wiring + defaults
**Files**:
- apps/electron-shell/src/main/ipc/agents.ts
- apps/electron-shell/src/main/services/AgentRunStore.ts
- apps/electron-shell/src/main/services/agent-host/run-orchestration.ts
- apps/electron-shell/src/main/services/agent-host-manager.ts
- apps/electron-shell/src/main/services/WorkspaceService.ts
- apps/agent-host/src/index.ts
- packages/agent-runtime/src/runtime/DeepAgentRunner.ts
- relevant tests

**Work**:
- Resolve skillId (explicit, last used, or default) before starting a run.
- Merge skill config into run config with clear precedence rules (workspace overrides global).
- Persist run.skill metadata for audit.
- Update lastUsedSkillId when a run starts successfully.
- Surface missing/disabled skill errors to renderer.

**Verify**:
- pnpm --filter apps-electron-shell test
- pnpm --filter apps-agent-host test

**Invariants**:
- P3 (Agent-host never receives secrets)
- P6 (Contracts-first)

---

## Task 5 - Skills UI + screenshot
**Files**:
- apps/electron-shell/src/renderer/components/agents/AgentsRunsView.tsx
- apps/electron-shell/src/renderer/components/skills/SkillsPanel.tsx (new)
- apps/electron-shell/src/renderer/components/skills/SkillEditor.tsx (new)
- apps/electron-shell/src/renderer/hooks/useSkills.ts (new)
- apps/electron-shell/src/renderer/components/settings/SettingsPanel.tsx
- specs/164-agent-skill-management-extension/screenshots/skills-panel.png
- relevant tests

**Work**:
- Add a Skills panel with list, search, and edit UI.
- Add skill selector to run form with default + last used indicators.
- Allow users to filter or create skills in Global vs Workspace scope.
- Wire UI to window.api.skills.
- Capture a screenshot of the Skills panel.

**Verify**:
- pnpm --filter apps-electron-shell test

**Invariants**:
- P1 (Renderer uses preload API only)
- P4 (Token-based styling)
- Screenshot requirement

---

## Task 6 - First-party agent-skills extension + docs
**Files**:
- extensions/agent-skills/package.json (new)
- extensions/agent-skills/extension.ts (new)
- extensions/agent-skills/skills.json (new)
- apps/electron-shell/src/main/bootstrap/extension-host.ts
- docs/extensions/api-reference.md
- docs/extensions/getting-started.md

**Work**:
- Add a bundled agent-skills extension with default skills.
- Seed the extension into userData/extensions on first run.
- Document the agentSkills contribution schema and usage.

**Verify**:
- pnpm --filter apps-electron-shell test

**Invariants**:
- P1 (Process isolation)
- P3 (No secrets in bundled skills)

---

## Task 7 - E2E coverage
**Files**:
- test/e2e/agent-skills.spec.ts (new)
- test/fixtures/extensions/skill-extension (new)

**Work**:
- E2E: create skill, set default, start run, verify metadata and last-used override.
- E2E: workspace skill overrides a global skill with the same id.
- E2E: extension-contributed skill appears and is selectable.

**Verify**:
- pnpm test:e2e --grep "agent skills"

**Invariants**:
- P1 (Renderer uses preload API only)
- P3 (No secret leakage)
