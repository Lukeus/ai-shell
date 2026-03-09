# 166 - AI Code Generation

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P2, P3, P5, P6, P7).

## Problem / Why
- AI-assisted code generation exists today in two separate paths:
  - SDD implementation/review proposals
  - Agents panel edit proposals
- Those paths do not share a single product contract for proposal semantics, apply behavior, persistence rules, audit, or user-facing lifecycle.
- The current implementation accepts proposal payloads that can contain both `patch` and `writes`, but apply behavior is not defined consistently across the platform.
- Proposal persistence is not uniformly hardened against secret leakage, even though proposal content can contain sensitive snippets from workspace files.
- There is no single spec that defines what "AI code generation" means across chat, edit, and SDD workflows.

## Goals
- Define AI code generation as a proposal-first workflow that spans Agents chat/edit and SDD implementation.
- Standardize proposal semantics for `patch`, `writes`, or mixed payloads so apply behavior is deterministic.
- Ensure proposal persistence and event storage never write plaintext secrets or sensitive snippets without an explicit safe policy.
- Persist proposal lifecycle state (`pending`, `applied`, `discarded`, `failed`) so history survives reloads.
- Audit proposal apply/discard actions consistently across all AI code generation entrypoints.
- Keep renderer sandboxed and route all workspace writes through main-process validation and policy checks.

## Decisions
- AI code generation remains proposal-first in v1. No automatic workspace writes from chat or edit flows.
- A proposal must use one of two valid apply modes:
  - `patch` only
  - `writes` only
- Mixed `patch` + `writes` payloads are invalid in v1 unless the contract explicitly introduces an ordered hybrid mode.
- Full proposal content may be shown in the live renderer session, but persisted stores must use a hardened storage model:
  - redacted/sanitized content, or
  - metadata plus an ephemeral in-memory proposal cache keyed by ID.
- Apply/discard actions are first-class events with audit logging and persisted lifecycle state.
- SDD and Agents edit flows must share the same proposal validation and apply pipeline.

## Non-goals
- Inline ghost text or editor autocomplete.
- Background autonomous coding without explicit user approval.
- New model providers or secrets storage changes.
- UI library migration or layout redesign.

## User stories
1. As a user, I can request a code change from the Agents panel and review a proposal before anything is written.
2. As a user, I can run an SDD implementation step and get the same proposal semantics and apply guarantees as the Agents panel.
3. As a user, I can reload the app and still see whether a proposal was applied, discarded, or failed.
4. As a security reviewer, I can verify that persisted proposal data does not leak secrets or raw sensitive snippets.
5. As a maintainer, I can reason about one code generation contract instead of separate chat/edit/SDD exceptions.

## UX requirements
- Proposal cards clearly show lifecycle state: `Pending`, `Applied`, `Discarded`, or `Apply failed`.
- Agents edit proposals and SDD proposals use the same summary and diff semantics.
- When apply fails, the user sees a clear conflict or validation error without losing the proposal.
- Discarding a proposal is persisted and reflected after reload.
- UI changes include screenshots for any renderer updates.

## Functional requirements
- Define a single proposal contract for AI code generation entrypoints.
- Reject invalid proposal shapes before persistence or apply.
- Apply pipeline must:
  - validate workspace boundaries in main,
  - enforce deterministic handling of proposal mode,
  - emit structured success/failure results,
  - record audit entries.
- Proposal persistence must:
  - avoid plaintext secrets,
  - avoid storing full sensitive snippets unless explicitly redacted,
  - persist lifecycle metadata.
- Agents edit workflow and SDD implementation workflow must reuse shared proposal parsing and validation utilities.
- Conversation and run history must remain backward-compatible with existing stored data.

## Security requirements
- Renderer has no direct OS or filesystem access.
- Secrets never persist in proposal history, run traces, or logs.
- Proposal apply stays main-process only.
- Any live proposal cache holding full content must be non-persistent and scoped to the local app session.

## Performance requirements
- Proposal parsing and validation remain bounded for multi-file responses.
- Large diffs continue to render lazily in the renderer.
- No regression to Monaco lazy-loading or initial renderer chunk budgets.

## Acceptance criteria
- Proposal payloads are validated consistently across Agents edit and SDD workflows.
- Invalid mixed-mode proposals fail fast with actionable errors.
- Proposal application behaves deterministically for every accepted proposal.
- Persisted conversation/run history no longer stores raw sensitive proposal content.
- Apply/discard lifecycle state survives app reload.
- Proposal apply/discard actions are auditable.
- Shared tests cover proposal parsing, persistence hardening, and apply behavior.

## Open questions
- Should v2 support an explicit hybrid proposal mode for "new files via writes + edits via patch"?
- Should persisted proposal history keep truncated diff previews, or only metadata plus an ephemeral cache key?
- Should generic chat runs be able to escalate into edit/codegen mode explicitly from the same thread?
