# ADR-0001 — Tech Stack
- Monorepo: pnpm + turborepo
- UI: React + Tailwind 4 token design system
- Editor: Monaco (lazy-loaded chunk)
- Terminal: @xterm/xterm
- Secrets: Electron safeStorage (OS crypto), no .env
- Extensions: separate host + signed + policy-governed store
- Agentic runtime: LangChain DeepAgents in packages/agent-runtime; agent-host is a thin process boundary; tools via broker+policy
- Contracts-first: Zod schemas in packages/api-contracts
