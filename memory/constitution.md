# Constitution — ai-shell

## Purpose
Build a production-grade Electron IDE shell (VS Code-like layout) with a secure extension ecosystem and a policy-governed agent runtime.

## Non-negotiable principles

### P1 — Process isolation
- Main process (Shell Kernel) owns OS access, policy enforcement, secrets, updates.
- Renderer is sandboxed and cannot access Node directly.
- Extension Host runs untrusted code in a separate process.
- Agent Host runs orchestration in a separate process.

### P2 — Security defaults
- contextIsolation ON.
- minimal preload API via contextBridge.
- no secrets in logs; no plaintext secrets on disk.

### P3 — Secrets: no .env, OS-backed encryption
- All credentials stored via main-process SecretsService using Electron safeStorage.
- Extensions/agents receive handles (connectionId/secretRef), not raw values.

### P4 — UI design system is token-based (Tailwind 4)
- Tailwind tokens define the contract.
- Themes switch via CSS variables (`data-theme`) only.

### P5 — Performance budgets
- Monaco is lazy-loaded; never in initial renderer chunk.
- Extensions activate lazily by activation events.

### P6 — Contracts-first
- IPC, tool calls, agent events, and extension contributions must be defined in `packages/api-contracts` (Zod-first).
- JSON Schema is generated from contracts.

### P7 — Spec-Driven Development
- Every feature lives in `specs/<feature>/` with spec → plan → tasks.
- Specs/plans/tasks updated BEFORE implementation when requirements evolve.
