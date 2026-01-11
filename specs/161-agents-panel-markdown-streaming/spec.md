# 161 - Agents Panel Markdown + Streaming Responses

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P2, P4, P5, P6, P7).

## Problem / Why
- Agent responses render as plain text, which makes multi-step answers harder to scan.
- Long-running responses feel unresponsive; users cannot tell if the agent is working.
- There is no safe, consistent markdown rendering to match a Copilot-like reading experience.

## Goals
- Render agent responses in markdown (GFM subset) with readable typography and code blocks.
- Stream agent responses with visible progress and a non-sensitive status indicator.
- Keep security boundaries intact: no HTML injection, no secrets in status events.
- Preserve existing runs and conversation storage with backward compatibility.

## Decisions
- Store raw markdown in conversation entries and render markdown client-side.
- Emit streaming delta + status events from agent runtime; persist only the final message.
- Throttle streaming UI updates to avoid re-render storms.

## Non-goals
- No inline editor ghost text or code completion.
- No changes to model providers, secrets handling, or extension APIs.
- No UI library migration or global theme redesign.
- No rich markdown editor or message editing.

## User stories
1. As a user, I can read agent responses with headings, lists, and code formatting.
2. As a user, I see a live streaming reply and a "working" indicator while the agent responds.
3. As a user, I can tell when the agent is using tools or planning without seeing chain-of-thought.
4. As a user, I can still copy raw markdown from the conversation history.

## UX requirements
- Agent messages render markdown (GFM subset: headings, lists, tables, blockquotes, code blocks, inline code).
- Markdown styling follows Tailwind 4 tokens and theme variables; no raw hex values.
- Streaming messages update in-place with a subtle typing indicator.
- Status/thinking line shows high-level phases (e.g., "Thinking", "Searching", "Drafting") and never exposes chain-of-thought.
- Tool calls may surface as status chips (optional, non-blocking).
- UI changes include an updated screenshot.

## Functional requirements
- Add a message format field (markdown | text) to conversation entries; default to text for legacy data.
- Update agent runtime workflows to request markdown-formatted responses.
- Emit streaming delta events (contentDelta, sequence, format) plus a final message event.
- Emit status updates for high-level phases only; sanitize/redact before persistence.
- Main process aggregates deltas into a final message and persists to conversation store.
- Renderer renders markdown with sanitization and updates streaming content incrementally.
- Fallback to non-streaming providers: show a working indicator and render the final message on completion.

## Security requirements
- Renderer has no OS access; all events flow via validated IPC.
- Markdown rendering must sanitize HTML (no raw HTML allowed).
- Status messages must not include secrets or chain-of-thought; redact if needed.
- All payloads validated with contracts-first schemas and Result envelopes.

## Performance requirements
- Throttle streaming UI updates and markdown parsing (e.g., 30-50ms coalescing).
- Avoid blocking the main thread for large responses; consider incremental parsing.
- No impact to Monaco lazy-load behavior or initial renderer chunk size.

## Acceptance criteria
- Agent responses render as markdown with readable code blocks and lists.
- Streaming responses appear as they are generated with a visible working indicator.
- Status updates show high-level phases without chain-of-thought.
- Conversation history stores raw markdown and renders consistently across reloads.
- IPC contracts updated and validated; renderer uses window.api only.
- Screenshot added for the updated Agents panel.

## Out of scope / Future work
- Inline editor completions or ghost text.
- Rich markdown editor or message editing.
- Agent-side citations or provenance metadata.

## Open questions
- Should user messages also support markdown rendering, or only agent messages?
- Which markdown renderer and sanitization stack best fits bundle size constraints?
- Should status updates be persisted in conversation history or remain ephemeral?
