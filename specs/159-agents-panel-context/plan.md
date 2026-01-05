# 159 - Agents Panel Context Conversations - Technical Plan

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P2, P5, P6, P7).

## Architecture changes
- Add a conversation layer to agent runs (message threads and draft artifacts).
- Main process owns draft file creation and conversation persistence.
- Agent host exposes a "feature planning" workflow that produces spec/plan/tasks drafts.

## Contracts (api-contracts updates)
- New schemas:
  - `AgentConversation` (id, title, createdAt, updatedAt)
  - `AgentMessage` (id, role, content, createdAt)
  - `AgentDraft` (featureId, spec, plan, tasks, status)
- New IPC channels:
  - `agents:list-conversations`
  - `agents:get-conversation`
  - `agents:append-message`
  - `agents:save-draft`
- Preload API additions with Result envelopes for the above.

## IPC + process boundaries
- Renderer calls new `window.api.agents.*` methods.
- Main validates payloads, persists conversation history, and brokers draft save operations.
- Agent host handles planning requests and returns draft payloads to main.

## UI components and routes
- Extend Agents panel with:
  - Conversation list and thread view
  - Message composer
  - Draft preview panel with "Save" and optional "Run SDD"
- No layout changes outside the secondary sidebar.
- Styling follows Tailwind 4 design tokens and theme variables; reuse ui-kit patterns where possible.

## Data model changes
- New conversation storage (in-memory + persisted file) with bounded retention.
- Draft objects stored alongside conversations (not embedded in agent events).

## Failure modes + recovery
- Draft save failures return Result errors with clear, user-friendly messages.
- If conversation storage is missing/corrupt, reset to empty and log diagnostics (no message content).
- If SDD is disabled, "Run SDD" is hidden and a hint is shown.

## Testing strategy
- Unit: schema validation, conversation storage, draft save validation.
- Integration: IPC handlers for append/get/save, agent-host planning response.
- UI: basic render tests for conversation thread and draft preview.

## Rollout / migration
- Behind existing agent feature flag if available; default on in dev.
- No migration required for existing agent runs.

## Risks + mitigations
- Risk: large conversations cause UI lag. Mitigation: pagination or windowing.
- Risk: users expect drafts to auto-run. Mitigation: explicit CTA and messaging.

## Done definition
- Conversations available in Agents panel with message history.
- Draft spec/plan/tasks can be generated and saved to `specs/<feature>/`.
- SDD handoff is explicit and only shown when enabled.
