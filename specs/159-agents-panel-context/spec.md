# 159 - Agents Panel Context Conversations

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P2, P5, P6, P7).

## Problem / Why
- The Agents panel is a one-way event stream; there is no conversation thread or prompt history for context-aware planning.
- Users cannot draft spec/plan/tasks from the Agents panel, so SDD workflows must be started with pre-existing files.
- When SDD is disabled, there is no way to use agents to help plan a new feature and save it for later SDD execution.

## Goals
- Add a conversation model in the Agents panel that captures user/agent messages and planning artifacts.
- Enable "feature planning" conversations that generate spec/plan/tasks drafts.
- Allow saving drafts into a new `specs/<feature>/` folder, regardless of SDD enablement.
- When SDD is enabled, allow launching SDD workflows from the drafted feature files.

## Non-goals
- No changes to model providers or secrets handling.
- No extension API changes beyond existing agent tool usage.
- No UI library migration or layout redesign.
- No new design system or theme changes outside existing Tailwind 4 tokens.
- No automatic execution of SDD tasks without explicit user action.

## User stories
1. As a user, I can have a conversation with an agent and see the full message history.
2. As a user, I can ask the agent to draft a new spec/plan/tasks set and save it to a new feature folder.
3. As a user, I can still plan features even when SDD is disabled.
4. As a user, I can switch to SDD and run tasks once the draft is ready.

## UX requirements
- The Agents panel includes a conversation thread with clear user/agent roles.
- The composer supports feature-planning prompts with quick actions (e.g., "Draft spec/plan/tasks").
- Drafted spec/plan/tasks are previewable before saving.
- If SDD is disabled, show a non-blocking callout explaining drafts can be run later.
- UI changes include an updated screenshot.
- UI uses Tailwind 4 tokens and theme variables (`data-theme`), avoiding raw hex values.
- Prefer existing ui-kit components and patterns for panels, headers, and inputs.

## Functional requirements
- Add contracts for conversation messages, drafts, and persistence.
- Provide IPC methods to create/list conversations, append messages, and save drafts to `specs/<feature>/`.
- Preserve current agent run event stream; conversation layer should not break existing runs.
- Draft save operation validates folder naming and prevents overwriting without confirmation.

## Security requirements
- Renderer has no OS access; draft file creation happens in main process only.
- No secrets stored or logged in conversation content; enforce redaction where applicable.
- All IPC payloads validated with contracts-first schemas.

## Performance requirements
- Conversation history loads incrementally to avoid large memory spikes.
- No impact to Monaco lazy-load behavior.

## Acceptance criteria
- Agents panel supports persistent conversations with user/agent messages.
- Users can generate and preview spec/plan/tasks drafts.
- Drafts can be saved to `specs/<feature>/spec.md`, `plan.md`, `tasks.md`.
- When SDD is enabled, a "Run SDD" action is available from a draft.
- All IPC methods follow Result envelopes and contract validation.

## Risks
- Conversation drafts may be large; pagination or truncation may be required.
- Users may expect automatic SDD execution; UI must make the handoff explicit.
