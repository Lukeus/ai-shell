# 160 - Agents Panel Copilot Chat - Technical Plan

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P2, P5, P6, P7).

## Architecture changes
- Add a dedicated edit workflow in agent-runtime that generates structured edit proposals.
- Extend agent-host to route edit requests and emit edit proposal events.
- Update main process to persist conversation entries and apply proposals via PatchApplyService.
- Update renderer Agents panel to attach editor context and render proposal cards.
- Add a chat workflow that emits message events for conversation threads.
- Introduce global consent prompting for secret access on first use.
- Store optional conversation-level connection/model overrides.
- Purge secrets when connections are deleted.

## Contracts (api-contracts updates)
- New schemas:
  - AgentContextAttachment (filePath, range, snippet, hash, kind)
  - AgentEditRequest (conversationId, prompt, attachments, options)
  - AgentEditProposal (summary, proposal: Proposal)
  - AgentConversationEntry (message | proposal)
- Update AgentEvent union with edit-proposal event (carries AgentEditProposal).
- New IPC channels:
  - agents:request-edit
  - agents:apply-proposal
  - agents:list-entries (or extend agents:get-conversation to return entries)
- Preload API additions with Result envelopes.

## IPC + process boundaries
- Renderer collects attachments (active file, selection) and calls window.api.agents.requestEdit.
- Main validates request, starts agent-host run with metadata.workflow = edit.
- Agent-host calls agent-runtime EditWorkflowRunner and emits edit-proposal event.
- Main persists entries and publishes events to renderer.
- Apply requests go renderer -> main -> PatchApplyService; renderer never writes files.

## UI components and routes
- Extend Agents panel conversation view with:
  - Context attachment chips (active file, selection)
  - Quick action bar
  - Proposal card with diff preview + Apply/Discard
- Reuse ProposalDiffView from SDD or extract shared diff component.
- Introduce useEditorContext hook or context to expose active file + selection.

## Data model changes
- Conversation store schema version bump to include entries and attachments.
- Persist proposal metadata (summary + proposal) per conversation entry.
- Retain existing message history; add migration for old format.

## Failure modes + recovery
- Invalid proposal format: show error card, keep conversation state.
- Patch conflicts: surface error with option to retry or copy patch.
- Workspace closed: disable Apply and show message.

## Testing strategy
- Unit: proposal parsing, attachment validation, redaction.
- Integration: IPC request/edit/apply flow, agent-host edit workflow.
- UI: render tests for attachments, proposal cards, and apply confirmation.

## Rollout / migration
- Gate behind an Agents Copilot Chat setting or existing agent feature flag.
- Migrate conversation store from messages-only to entries.

## Risks + mitigations
- Risk: large diffs cause UI lag. Mitigation: virtualization and truncation.
- Risk: secret leakage in proposals or logs. Mitigation: redaction before persistence.
- Risk: patch conflicts confuse users. Mitigation: clear error states and retry flow.

## Done definition
- Agents panel supports edit requests with context attachments.
- Agent host returns edit proposals as structured events.
- Renderer previews proposals and applies via main process.
- Conversation entries persist messages and proposals.
- Tests cover request/apply flow and proposal validation.
