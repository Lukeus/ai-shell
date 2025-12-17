# ai-shell

Enterprise Electron IDE shell with:
- VS Code-like layout (activity bar, side bars, editor, bottom panel, status bar)
- Tailwind 4 theme token design system
- Monaco editor lazy-loaded via dynamic import
- Secure secrets via OS keychain crypto (Electron safeStorage) — no .env
- Extensions + marketplace (signed, policy-governed)
- Agent host (LangChain Deep Agents) with tool-based execution + audit/policy

## How to build with Warp (SDD)
1) Follow `WARP.md`
2) Read `memory/constitution.md` and `memory/context/*`
3) Work feature-by-feature in `specs/*`:
   - spec.md → plan.md → tasks.md → implement tasks in order

## Start here
Open `specs/000-foundation-monorepo/spec.md`
