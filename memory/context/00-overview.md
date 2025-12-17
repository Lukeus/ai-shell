# Overview
This repo builds an enterprise Electron IDE shell with a VS Code-like layout, extensions, and an agent runtime.
Monorepo: pnpm + turborepo.
Renderer: React + Tailwind 4.
Editor: Monaco (lazy chunk).
Secrets: OS-backed safeStorage; Connections UI configures MCP/external APIs (no .env).
Extensions: separate host process, signed, policy-governed.
Agents: Deep Agents in agent-host; tool-based execution via broker+policy; auditable.
