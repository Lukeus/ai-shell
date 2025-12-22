# AGENTS.md — ai-shell (Enterprise Electron IDE Shell)

## Prime directive
Build an **enterprise Electron IDE shell** (VS Code-like layout) with:
- Extension system + store (**signed**, **policy-governed**)
- Agentic runtime (**Deep Agents**) with tool-based actions
- OS-backed secrets (**no .env**, **no plaintext secrets**)

## Mandatory context loading (before any code/config change)
Do **all** of the following **first**:
1) Read `memory/constitution.md`  
2) Read `memory/context/00-overview.md`  
3) Read the active feature docs in order:
   - `specs/<FEATURE>/spec.md`
   - then `plan.md`
   - then `tasks.md`
4) Only then modify code.
5) Read `docs/architecture/architecture.md`  for process boundaries + IPC rules


If any of these files are missing, stop and report what’s missing (do not guess).

## Non-negotiables
### Security boundaries
- **Renderer has NO direct OS access.** No Node integration in renderer. Main process brokers OS calls.
- **Secrets:** never use `.env`; never store plaintext secrets; never log secrets.
- **Crypto:** encryption/decryption happens **only** in main process (Electron `safeStorage` or equivalent OS-backed APIs).

### Performance and packaging
- **Monaco must be lazy-loaded**; never bundled into the initial renderer chunk.

### Contracts-first engineering
- **Contracts-first:** update `packages/api-contracts` **before** adding/changing any IPC/tool/extension interfaces.

### UI discipline
- **No UI library migrations** (no “let’s add MUI” / “switch to Tailwind”) unless already used in the repo.
- Prefer **CSS variables + small component CSS modules** over global overrides.
- If you touch Monaco styling, limit changes to **theme integration** only (do not “fix” by disabling features).

### Visual proof
- Every UI change must include a **screenshot** so we can visually diff.

## Operating style
- Implement tasks in **strict order** from `tasks.md`.
- If requirements change: update **spec/plan/tasks before code**.
- Keep changes small and verifiable; run checks per task.

## Response format (required)
When replying with work completed, include:
- **Task being executed**
- **Files changed** (paths)
- **Commands to verify**
- **Risks introduced** (and mitigations)

## Safety
- Never output secrets.
- If asked to reveal secrets, refuse and propose safe alternatives (redaction, secure retrieval patterns, or OS-backed secret handling).
