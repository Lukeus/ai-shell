# 160 - Agents Panel Copilot Chat

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P2, P5, P6, P7).

## Problem / Why
- Agents panel supports runs and planning drafts but not interactive code assistance.
- There is no way to attach editor context (active file/selection) or request edits with a preview.
- Users must copy/paste changes and manually apply them, which is slow and error-prone.

## Goals
- Add a Copilot-like chat experience in the Agents panel for code assistance.
- Support context attachments from the editor (active file, selection, multi-file snippets).
- Produce structured edit proposals with diff previews and explicit Apply/Discard controls.
- Persist conversation history with attachments and proposals.
- Keep agent runs policy-governed and consistent with SDD and IPC contracts.

## Non-goals
- No inline ghost text or code completion in the editor.
- No automatic writes to the workspace without explicit user action.
- No changes to model providers, secrets storage, or connection handling.
- No UI library migration or layout redesign.
- No extension API changes beyond existing agent tool usage.

## User stories
1. As a user, I can ask the agent to explain or refactor a selected block of code.
2. As a user, I can attach files or selections to a message and see what context is sent.
3. As a user, I can preview a proposed edit as a diff before applying it.
4. As a user, I can apply or discard the proposal and keep the chat history.
5. As a user, I can generate tests or fixes from quick actions in the composer.

## UX requirements
- Agents panel shows message history with roles and timestamps.
- Composer supports context chips for active file and selection, with remove actions.
- Quick actions (Explain, Fix, Generate tests, Refactor) are visible and optional.
- Proposed edits render as a diff card with summary and Apply/Discard buttons.
- Errors (invalid patch, conflicts) surface inline as non-blocking callouts.
- UI uses Tailwind 4 tokens and existing ui-kit components.
- UI changes include a screenshot.

## Functional requirements
- Add a structured edit request workflow with attachments (file path, range, snippet).
- Agent host returns an edit proposal (patch or writes) plus a summary message.
- Renderer can request an edit, preview the proposal, and apply it via main.
- Conversation storage persists messages, attachments, and proposal metadata.
- Applying edits uses main-process PatchApplyService and workspace path validation.
- All IPC payloads use contracts-first schemas and Result envelopes.

## Security requirements
- Renderer has no OS access; all file writes happen in main process only.
- Redact or avoid storing sensitive values in conversation entries and proposals.
- Never log secrets from agent inputs/outputs.
- Apply operations validate workspace boundaries and reject path traversal.

## Performance requirements
- Limit attached context size (per file and per request).
- Large diffs render lazily or with virtualization.
- No impact to Monaco lazy-load behavior or initial renderer chunk size.

## Acceptance criteria
- Users can attach editor context and request edits from the Agents panel.
- Proposed edits show a diff preview with Apply/Discard actions.
- Applied edits modify workspace files via main process only.
- Conversation history persists messages, attachments, and proposals.
- IPC contracts updated and validated; renderer uses window.api only.
- Screenshot added for the updated Agents panel.

## Out of scope / Future work
- Inline ghost text suggestions in the editor.
- Multi-turn auto-apply or background edits.
- Extension-provided edit providers.

## Open questions
- Should proposals be patch-only, or allow file writes for new files?
- Should multi-file proposals be allowed by default or gated by a setting?
- What is the max context size per attachment to balance quality vs performance?
