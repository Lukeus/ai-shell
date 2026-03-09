# 166 - AI Code Generation - Technical Plan

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P2, P3, P5, P6, P7).

## Research summary
- Existing implementation is split between:
  - `packages/agent-runtime/src/workflows/edit/`
  - `packages/agent-runtime/src/workflows/sdd/`
  - `apps/electron-shell/src/main/services/AgentEditService.ts`
  - `apps/electron-shell/src/main/services/PatchApplyService.ts`
- `ProposalSchema` currently allows both `writes` and `patch`.
- `PatchApplyService` currently applies `patch` preferentially and ignores `writes` when both are present.
- Conversation persistence stores proposal payloads directly, while run storage already redacts persisted events.

## Architecture changes
- Introduce a shared proposal policy layer for AI code generation.
- Harden proposal persistence in main so conversation history does not store raw sensitive proposal payloads.
- Standardize apply semantics at the contract layer and enforce them before apply.
- Persist proposal lifecycle state in conversation entries and, where relevant, run metadata.
- Reuse shared proposal validators/parsers across edit and SDD workflows.

## Contracts (api-contracts updates)
- Update proposal-related schemas to define the accepted apply mode explicitly.
- Extend conversation proposal entries with lifecycle metadata:
  - `state`
  - `appliedAt`
  - `discardedAt`
  - optional apply failure summary
- If full proposal content becomes ephemeral-only, add a stable `proposalId` / `cacheKey` contract.
- Add apply/discard event/result contracts if needed to keep timeline behavior explicit.

## IPC + process boundaries
- Renderer continues to request code generation and proposal apply/discard through `window.api`.
- Main owns:
  - proposal validation,
  - proposal persistence policy,
  - apply/discard state transitions,
  - audit logging.
- Agent host/runtime produce proposal candidates but do not decide persistence shape.

## Runtime design
- Extract shared proposal parsing helpers from edit and SDD workflows into a common runtime module.
- Fail fast when model output violates the accepted proposal mode.
- Keep edit and SDD prompts aligned to the same proposal contract.

## Main-process design
- Add a proposal storage hardening layer before conversation persistence.
- Update `AgentEditService` to persist proposal lifecycle changes and audit apply/discard.
- Update `PatchApplyService` to either:
  - reject mixed proposals, or
  - support an explicit ordered hybrid mode if the contract introduces it.
- Keep SDD proposal apply behavior on the same code path or wrapper around the shared apply service.

## Renderer design
- Proposal cards render persisted lifecycle state.
- Conversations reload proposal state without relying on local React-only apply/discard bookkeeping.
- Any UI changes stay within the existing design language and include screenshots.

## Failure modes + recovery
- Invalid proposal mode: reject before persistence/apply with a user-facing validation error.
- Patch conflict: mark proposal `failed` with a recoverable error and keep the proposal visible.
- Missing workspace: apply disabled with clear guidance.
- Proposal cache miss (if ephemeral cache is used): preserve metadata and prompt the user to regenerate.

## Testing strategy
- Contract tests for proposal mode validation and lifecycle state.
- Main unit tests for:
  - persistence redaction/hardening,
  - apply/discard lifecycle transitions,
  - mixed proposal rejection or ordered application.
- Runtime tests for shared parser behavior used by both edit and SDD flows.
- Integration tests covering:
  - edit request -> proposal persistence -> apply,
  - SDD implement -> proposal apply,
  - reload behavior for applied/discarded proposals.

## Rollout / migration
- Migrate existing conversation entries to default proposal state `pending`.
- Backfill or sanitize stored proposal payloads on load if old data contains raw proposal bodies.
- Maintain compatibility with existing Agents and SDD UI while the new proposal contract rolls out.

## Risks + mitigations
- Risk: breaking existing proposal payloads from model prompts.
  Mitigation: validate at parse time and update prompts/tests together.
- Risk: losing proposal preview data when hardening persistence.
  Mitigation: keep full content in-memory during active sessions and persist safe metadata.
- Risk: duplicated apply logic across SDD and Agents.
  Mitigation: converge on one apply service and shared contract tests.

## Done definition
- AI code generation has one documented proposal contract across Agents edit and SDD.
- Persisted proposal history no longer stores raw sensitive content unsafely.
- Proposal lifecycle state survives reload.
- Apply/discard actions are audited.
- Tests cover proposal validation, persistence hardening, and apply behavior.
