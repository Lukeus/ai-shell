# WARP Project Rules — ai-shell (Enterprise Electron IDE Shell)

## Prime Directive
You are building an enterprise Electron IDE shell (VS Code-like layout) with:
- Extension system + store (signed, policy-governed)
- Agentic runtime (Deep Agents) with tool-based actions
- OS-backed secrets (no .env, no plaintext secrets)

## Context Loading (MANDATORY)
Before coding or changing configs:
1) Read `memory/constitution.md`
2) Read `memory/context/00-overview.md`
3) Read active feature docs: `specs/<FEATURE>/spec.md`, then `plan.md`, then `tasks.md`
4) Only then modify code.

## Non-Negotiables
- Renderer has NO direct OS access (no Node in renderer). Main process brokers OS calls.
- Secrets: never use `.env`; never store plaintext secrets; never log secrets.
- Encryption/decryption happens ONLY in main process (Electron safeStorage).
- Monaco must be lazy-loaded; never bundled into initial renderer chunk.
- Contracts-first: update `packages/api-contracts` before adding/changing IPC/tool/extension interfaces.

## Operating Style
- Implement tasks in strict order from `tasks.md`.
- If requirements change: update spec/plan/tasks BEFORE code.
- Keep changes small and verifiable. Run checks per task.

## Output Format (when you respond)
- What task you’re doing
- Files changed (paths)
- Commands to verify
- Any risks introduced (and mitigations)

## Safety
Never output secrets. If asked to reveal secrets, refuse and propose safe alternatives.
