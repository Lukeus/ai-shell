# 161 - Agents Panel Markdown + Streaming Responses - Technical Plan

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P2, P4, P5, P6, P7).

## Architecture changes
- Emit streaming delta + status events from agent-runtime chat workflows.
- Forward streaming and status events through agent-host into the existing event stream.
- Aggregate deltas in main process and persist final markdown messages in the conversation store.
- Update renderer to render markdown and show streaming/status indicators in the Agents panel.

## Contracts (api-contracts updates)
- Add AgentMessageFormat enum (text | markdown).
- Extend AgentConversationMessageEntry with format.
- Add AgentEvent types:
  - message-delta (contentDelta, sequence, format, conversationId, messageId)
  - message-complete (content, format, conversationId, messageId)
  - status-update (phase, label)
- Update AgentMessageEvent to include format for non-streaming messages.
- Export new schemas in api-contracts index.

## IPC + process boundaries
- Renderer subscribes to agent event stream via window.api only.
- Main validates and sanitizes status updates before persisting or forwarding.
- No new renderer-to-main IPC required unless we add explicit streaming controls.

## UI components and routes
- Add AgentMarkdownMessage component to render sanitized markdown with theme tokens.
- Add AgentStreamingIndicator component for typing/status display.
- Update AgentsConversationThread and AgentEventStream to render markdown for agent messages.
- Add CSS module for markdown typography and code block styling using CSS variables.
- Keep existing panel layout and ui-kit usage.

## Data model changes
- Conversation store migration: set format = text for legacy entries.
- Streaming buffers are in-memory only; final markdown saved as a message entry.

## Failure modes + recovery
- Out-of-order deltas: order by sequence and drop duplicates.
- Missing final event: timeout and persist current buffer with a warning entry.
- Markdown parsing error: fall back to escaped plain text.
- Provider lacks streaming: show working indicator until final response arrives.

## Testing strategy
- Unit: schema validation for new events; delta aggregation logic.
- Integration: agent-host streaming event flow to main and renderer.
- UI: markdown rendering and streaming indicator behavior.

## Rollout / migration
- Backward compatible; default format to text for existing conversations.
- Optional feature flag if needed for gradual rollout.

## Risks + mitigations
- XSS risk: enforce sanitization and disallow raw HTML.
- UI jank from frequent updates: throttle rendering and parsing.
- Large responses: chunk display and consider virtualization.

## Done definition
- Markdown rendering and streaming/status indicators visible in Agents panel.
- Contracts and event handling updated with tests passing.
- Screenshot captured for visual diff.
