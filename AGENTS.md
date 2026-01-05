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
5) Read `docs/architecture/architecture.md` for process boundaries + IPC rules

If any of these files are missing, stop and report what’s missing (do not guess).

---

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

---

## Anti-monolith guardrails (MANDATORY)

### File size budgets (hard guardrails)
These are **guardrails**, not a religion. But if you exceed them, you must split.

- **TS/TSX source files:** target ≤ **300 lines**, hard stop at **450 lines**
- **React component files:** target ≤ **200 lines**, hard stop at **300 lines**
- **Hooks (`use*`) files:** target ≤ **200 lines**, hard stop at **300 lines**
- **Service / orchestration modules:** target ≤ **250 lines**, hard stop at **400 lines**
- **Single function/method:** target ≤ **40 lines**, hard stop at **80 lines**
- **Single React component:** target ≤ **250 LOC total render + logic**, hard stop at **350**
- **Props surface area:** target ≤ **12 props** per component (beyond that, introduce a config object or subcomponents)

**Exceptions (allowed, but must be explicit):**
- Generated code (must live under a `generated/` folder and be marked as generated)
- Contract schemas/types where splitting reduces correctness (still prefer modular exports)
- Large constant datasets (should move to `.json` or dedicated `data/` modules)

If an exception is used, add a short comment at top of the file:
`// EXCEPTION: <reason> (approved by AGENTS.md guardrails)`

### “Touch-it, fix-it” rule (prevents slow monolith creep)
If you modify a file that is already above the hard stop:
- You **must** split it as part of the same task **or**
- You **must** reduce it below the hard stop **or**
- You **must** document a scoped exception (see above) and create a follow-up task in `tasks.md`.

No more “I’ll refactor later.” Later is a myth. Like unit tests you’ll “add next sprint.”

### Separation rules (how we split)
**One module = one job.** If a file does more than one of these, split:
- UI rendering
- State orchestration
- IPC/tool calls
- Domain/business logic
- Data mapping/serialization
- Styling/theme configuration

**Renderer UI pattern**
- Container components orchestrate state and composition.
- Presentational components render UI only (minimal side-effects).
- IPC/tool calls must live behind:
  - `services/*` (main-side) or
  - `hooks/*` / `adapters/*` (renderer-side), not embedded inline inside big components.

**Folder conventions (recommended)**
For non-trivial UI components:

ComponentName/
  ComponentName.tsx        # thin composition layer
  ComponentName.view.tsx   # presentational rendering
  ComponentName.types.ts
  useComponentName.ts      # logic/hook
  ComponentName.module.css (or equivalent)
  index.ts                 # exports ONLY public surface

### Public API discipline (prevents “everything imports everything”)
- Use **index.ts** only as a **public API boundary**, not a dumping ground.
- Avoid deep imports across packages. Prefer stable public exports.
- If multiple unrelated utilities accumulate, create focused modules (`date/`, `paths/`, `ipc/`, etc.).

### Dependency hygiene (prevents spaghetti)
- No circular dependencies.
- No “god” context/provider that becomes the entire app.
- Don’t pass 9 callbacks down 6 levels—introduce a hook, adapter, or local state boundary.

### Refactor triggers (simple heuristics that catch real problems)
Split when you see any of these:
- Component has **> 3 useEffect** blocks doing unrelated things
- Component has **> 2 distinct async flows** (e.g., load + save + index + sync)
- File mixes UI + IPC + parsing/serialization
- “Helper” functions start to look like a second module living at the bottom of the file
- You can’t describe the file in one sentence without using “and”

---

## Operating style
- Implement tasks in **strict order** from `tasks.md`.
- If requirements change: update **spec/plan/tasks before code**.
- Keep changes small and verifiable; run checks per task.

---

## Response format (required)
When replying with work completed, include:
- **Task being executed**
- **Files changed** (paths)
- **Commands to verify**
- **Risks introduced** (and mitigations)
- **Monolith check:** confirm files touched stayed within budgets OR explain the split/exception

---

## Safety
- Never output secrets.
- If asked to reveal secrets, refuse and propose safe alternatives (redaction, secure retrieval patterns, or OS-backed secret handling).

---

## Recommended enforcement (optional, but strongly suggested)
If repo policy allows, add lint rules to make this automatic:
- ESLint `max-lines` for TS/TSX
- ESLint `complexity` + `max-lines-per-function`
- Import cycle detection (`import/no-cycle` or equivalent)
- Optional boundaries plugin to prevent forbidden imports across layers

(These are policy suggestions; do not add them unless the current feature/task authorizes config changes.)

