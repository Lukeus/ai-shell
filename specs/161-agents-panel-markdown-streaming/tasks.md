# 161 - Agents Panel Markdown + Streaming Responses - Tasks

## Rules
- Ordered tasks only
- Each task: files to change, verification commands, invariants to protect

## Task 1 - Contracts-first: message format + streaming events
**Files**:
- `packages/api-contracts/src/types/agent-conversations.ts`
- `packages/api-contracts/src/types/agent-events.ts`
- `packages/api-contracts/src/index.ts`

**Work**:
- Add AgentMessageFormat schema (text | markdown).
- Extend AgentConversationMessageEntry with format (default to text for legacy).
- Add event schemas for message-delta, message-complete, and status-update.
- Update AgentMessageEvent to include format for non-streaming responses.

**Verify**:
- `pnpm --filter packages-api-contracts typecheck`

**Invariants**:
- P6 (Contracts-first)

---

## Task 2 - Agent runtime + host: markdown responses + streaming/status events
**Files**:
- `packages/agent-runtime/src/workflows/chat/`
- `packages/agent-runtime/src/workflows/chat/prompts.ts`
- `packages/agent-runtime/src/runtime/DeepAgentRunner.ts`
- `apps/agent-host/src/index.ts`

**Work**:
- Update chat prompts to request Markdown-only responses.
- Emit message-delta and message-complete events from streaming model output.
- Emit high-level status-update events (no chain-of-thought, no secrets).
- Route new events through agent-host to the main event stream.

**Verify**:
- `pnpm --filter packages-agent-runtime test`
- `pnpm --filter apps-agent-host test`

**Invariants**:
- P1 (Process isolation)
- P6 (Contracts-first)

---

## Task 3 - Main process: aggregate stream + persist markdown
**Files**:
- `apps/electron-shell/src/main/ipc/agents.ts`
- `apps/electron-shell/src/main/services/AgentConversationStore.ts`
- `apps/electron-shell/src/main/services/AgentRunStore.ts`

**Work**:
- Aggregate message deltas into a final response per conversation/run.
- Persist final markdown messages with format metadata.
- Sanitize status updates before persistence or broadcast.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- P1 (Process isolation)
- P2 (Security defaults)
- P6 (Contracts-first)

---

## Task 4 - Renderer: markdown rendering + streaming UX
**Files**:
- `apps/electron-shell/src/renderer/components/agents/AgentsConversationThread.tsx`
- `apps/electron-shell/src/renderer/components/agents/AgentEventStream.tsx`
- `apps/electron-shell/src/renderer/components/agents/AgentMarkdownMessage.tsx` (new)
- `apps/electron-shell/src/renderer/components/agents/AgentStreamingIndicator.tsx` (new)
- `apps/electron-shell/src/renderer/hooks/useAgentConversations.ts`
- `apps/electron-shell/src/renderer/styles/agents/AgentMarkdownMessage.module.css` (new)
- `apps/electron-shell/package.json` (if adding a markdown renderer dependency)
- `specs/161-agents-panel-markdown-streaming/screenshots/` (new)

**Work**:
- Render agent messages with sanitized markdown and theme tokens.
- Show streaming updates with a typing indicator and status line.
- Keep user messages readable and backward compatible.
- Add a screenshot of the updated Agents panel.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- P1 (Process isolation)
- P5 (Monaco lazy-load preserved)
- UI guardrails (no library migration)

---

## Task 5 - Tests + docs
**Files**:
- `apps/electron-shell/src/renderer/components/agents/__tests__/` (new or update)
- `apps/electron-shell/src/main/services/__tests__/` (new or update)
- `docs/` (update relevant docs)
- update root readme.md and the readme.md linked `docs/`

**Work**:
- Add tests for markdown rendering and streaming aggregation.
- Document markdown/streaming behavior and status indicators.

**Verify**:
- `pnpm --filter apps-electron-shell test`

**Invariants**:
- Documentation reflects new behavior
