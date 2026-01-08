# 160 - Agents Panel Copilot Chat - Tasks

## Rules
- Ordered tasks only
- Each task: files to change, verification commands, invariants to protect

## Task 1 - Contracts-first edit workflow + conversation entries
**Files**:
- `packages/api-contracts/src/types/agent-edits.ts` (new)
- `packages/api-contracts/src/types/agent-conversations.ts`
- `packages/api-contracts/src/types/agent-events.ts`
- `packages/api-contracts/src/types/sdd.ts` (reuse Proposal schema)
- `packages/api-contracts/src/ipc-channels.ts`
- `packages/api-contracts/src/preload-api.ts`
- `packages/api-contracts/src/index.ts`

**Work**:
- Add schemas for AgentContextAttachment, AgentEditRequest, AgentEditProposal, and AgentConversationEntry.
- Extend AgentEvent with an edit-proposal event.
- Add IPC channels for agents:request-edit and agents:apply-proposal.
- Update PreloadAPI for new agents methods with Result envelopes.

**Verify**:
- `pnpm --filter packages-api-contracts typecheck`

**Invariants**:
- P6 (Contracts-first)

---

## Task 2 - Main process edit request + proposal apply
**Files**:
- `apps/electron-shell/src/main/services/AgentConversationStore.ts`
- `apps/electron-shell/src/main/services/AgentEditService.ts` (new)
- `apps/electron-shell/src/main/ipc/agents.ts`
- `apps/electron-shell/src/main/ipc-handlers.ts`
- `apps/electron-shell/src/main/services/AgentRunStore.ts`

**Work**:
- Add conversation entry persistence (messages + proposals) with migration.
- Start edit workflow runs through Agent Host with validated attachments.
- Persist edit proposal events and publish to renderer.
- Apply proposals via PatchApplyService with workspace path validation.
- Redact sensitive fields before persistence.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- P1 (Process isolation)
- P2 (Security defaults)
- P6 (Contracts-first)

---

## Task 3 - Agent host edit workflow
**Files**:
- `packages/agent-runtime/src/workflows/edit/` (new)
- `packages/agent-runtime/src/workflows/edit/prompts.ts` (new)
- `packages/agent-runtime/src/index.ts`
- `apps/agent-host/src/index.ts`

**Work**:
- Implement EditWorkflowRunner to generate structured proposals (patch or writes).
- Parse model output into AgentEditProposal and emit edit-proposal events.
- Route workflow = edit in agent-host and wire into event stream.

**Verify**:
- `pnpm --filter packages-agent-runtime test`
- `pnpm --filter apps-agent-host test`

**Invariants**:
- P1 (Process isolation)
- P6 (Contracts-first)

---

## Task 4 - Agents panel Copilot UI + editor context
**Files**:
- `apps/electron-shell/src/renderer/hooks/useEditorContext.ts` (new)
- `apps/electron-shell/src/renderer/hooks/useAgentEdits.ts` (new)
- `apps/electron-shell/src/renderer/components/agents/AgentsConversationComposer.tsx`
- `apps/electron-shell/src/renderer/components/agents/AgentsConversationThread.tsx`
- `apps/electron-shell/src/renderer/components/agents/AgentEditProposalCard.tsx` (new)
- `apps/electron-shell/src/renderer/components/agents/AgentContextChips.tsx` (new)
- `apps/electron-shell/src/renderer/components/editor/MonacoEditor.tsx`
- `apps/electron-shell/src/renderer/components/editor/EditorArea.tsx`
- `apps/electron-shell/src/renderer/styles/agents/AgentEditProposalCard.module.css` (new)
- `specs/160-agents-panel-copilot-chat/screenshots/` (new)

**Work**:
- Capture active file + selection ranges for attachments.
- Add quick action bar and context chips in the composer.
- Render edit proposals with diff previews and Apply/Discard actions.
- Add screenshot of updated Agents panel.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- P1 (Process isolation)
- P5 (Monaco lazy-load preserved)
- UI guardrails (no library migration)

---

## Task 5 - Docs + follow-through tests
**Files**:
- `docs/` (update relevant docs)
- `apps/electron-shell/src/main/services/__tests__/` (new tests)
- `apps/electron-shell/src/renderer/components/agents/__tests__/` (new tests)

**Work**:
- Document edit workflow, attachments, and apply flow.
- Add tests for conversation entry persistence and proposal apply flow.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- Documentation reflects new behavior

---

## Task 6 - Refactor SDD workflow runner size (guardrail follow-up)
**Files**:
- `packages/agent-runtime/src/workflows/sdd/SddWorkflowRunner.ts`
- `packages/agent-runtime/src/workflows/sdd/` (new split modules)

**Work**:
- Split parsing, prompt, and validation logic into focused modules to bring SddWorkflowRunner below guardrail limits.
- Preserve existing behavior and tests.

**Verify**:
- `pnpm --filter packages-agent-runtime test`
- `pnpm --filter apps-agent-host test`

**Invariants**:
- P6 (Contracts-first)
