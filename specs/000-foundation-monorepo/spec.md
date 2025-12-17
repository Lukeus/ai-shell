# 000-foundation-monorepo

## Problem / Why
The ai-shell project requires a production-ready monorepo foundation that supports the process-isolation architecture (Main, Renderer, Extension Host, Agent Host). Currently, the repository needs real build tooling, proper task orchestration, and a working Electron development environment with React and Vite. Without this foundation, we cannot begin implementing the secure, multi-process architecture defined in the constitution.

## Goals
- Establish a working pnpm + turborepo monorepo structure with proper workspace configuration
- Wire Electron Forge with Vite plugin for hot-reload development on Windows
- Configure React renderer with Tailwind 4 (CSS-first)
- Create functional turbo tasks (dev, build, lint, typecheck, test) that execute across all packages
- Ensure process isolation foundations: main process, preload, and sandboxed renderer
- Enable development workflow: `pnpm dev` starts Electron app with hot-reload
- Provide Windows-first development experience with clean architecture for future macOS support

## Non-goals
- Full UI implementation (Monaco, panels, layout) — those are future features
- Extension Host or Agent Host processes — only Main + Renderer for this foundation
- Secrets management or safeStorage integration
- Production packaging, code signing, or update mechanisms
- Full test coverage — establish test infrastructure only
- Complete Tailwind theming system — basic setup only

## User stories
**As a developer**, I want to run `pnpm dev` and see the Electron app launch with hot-reload, so I can start building features immediately.

**As a developer**, I want to run `pnpm build` and have turbo build all packages in dependency order, so the project compiles successfully.

**As a developer**, I want TypeScript compilation and linting to work across all packages, so I can catch errors early.

**As a Windows developer**, I want all tooling to work natively on Windows without requiring WSL, so I have a smooth development experience.

**As a future macOS developer**, I want the project structure to be portable, so minimal changes are needed when macOS support is added.

## UX requirements
- Developer runs `pnpm install` once after clone
- Developer runs `pnpm dev` to start Electron app in development mode
- Hot-reload works for both main process (restart) and renderer (HMR)
- Clear console output showing which tasks are running
- Electron window opens with basic "Hello World" React app and Tailwind styling

## Functional requirements

### Monorepo Structure
- Root `package.json` with pnpm workspace configuration
- `turbo.json` defining task pipelines: dev, build, lint, typecheck, test
- Workspaces:
  - `apps/electron-shell`: Electron main + preload + renderer (Vite)
  - `packages/api-contracts`: Shared TypeScript types/Zod schemas (future IPC contracts)
  - Additional packages as needed for shared utilities

### Electron Configuration
- Electron Forge with Vite plugin
- Main process entry: `apps/electron-shell/src/main/index.ts`
- Preload script: `apps/electron-shell/src/preload/index.ts` with contextBridge minimal API
- Renderer: `apps/electron-shell/src/renderer/` React app with Vite
- `BrowserWindow` configuration:
  - `contextIsolation: true`
  - `sandbox: true`
  - `nodeIntegration: false`
  - Preload script attached

### React + Vite + Tailwind
- React 18+ with TypeScript
- Vite 5+ as bundler for renderer
- Tailwind 4 (CSS-first) configured with `@tailwind` directives
- Basic App.tsx showing "ai-shell" heading with Tailwind classes

### Turbo Tasks
- `turbo dev`: Start Electron Forge dev server (main + renderer hot-reload)
- `turbo build`: Build all packages, then Electron app
- `turbo lint`: Run ESLint across all TypeScript files
- `turbo typecheck`: Run `tsc --noEmit` for type validation
- `turbo test`: Run test framework (Playwright setup for future, but minimal tests now)

### TypeScript Configuration
- Root `tsconfig.base.json` with shared compiler options
- Per-package `tsconfig.json` extending base
- Strict mode enabled
- Path aliases configured for clean imports

## Security requirements
- Renderer must run in sandbox with `contextIsolation: true`
- Preload script exposes minimal API via `contextBridge` (e.g., `window.api.getVersion()`)  
- No direct Node.js access from renderer
- No secrets or credentials in this foundation spec (future specs will handle SecretsService)
- All dependencies must be from npm registry with package-lock integrity

## Performance requirements
- Cold start: Electron app opens within 3 seconds on Windows 10+
- Hot-reload (renderer change): Updates visible within 1 second
- Hot-reload (main change): Electron restarts within 2 seconds
- Initial bundle size (renderer): < 500KB (excluding Monaco, which is future)
- Turbo caching enabled: subsequent builds use cached artifacts

## Acceptance criteria
1. ✅ Repository structure matches monorepo architecture with pnpm workspaces
2. ✅ `pnpm install` completes without errors on Windows
3. ✅ `pnpm dev` launches Electron app with React renderer showing styled content
4. ✅ Changing renderer code triggers HMR without full restart
5. ✅ Changing main process code triggers Electron restart
6. ✅ `pnpm build` successfully compiles all packages
7. ✅ `pnpm lint` runs ESLint across TypeScript files (0 errors in foundation code)
8. ✅ `pnpm typecheck` validates types with no errors
9. ✅ Preload script correctly exposes API via contextBridge
10. ✅ Renderer cannot access Node.js globals (verified by contextIsolation)
11. ✅ Tailwind 4 classes apply styling in renderer
12. ✅ Turbo task pipeline respects dependencies (e.g., api-contracts builds before electron-shell)

## Out of scope / Future work
- Monaco editor integration (separate spec: 001-monaco-lazy-load)
- VS Code-like panel layout (spec: 002-layout-panels)
- Extension Host process (spec: 00X-extension-host)
- Agent Host process (spec: 00X-agent-host)
- Secrets management with safeStorage (spec: 00X-secrets-service)
- Connections UI for MCP/API configuration (spec: 00X-connections-ui)
- Electron Forge packaging and distribution (spec: 00X-packaging-signing)
- macOS-specific build configuration (future enhancement to this spec)
- Full Playwright E2E test suite (establish infrastructure only)

## Open questions
- Should we use ESLint flat config or legacy config for Windows compatibility?
- Do we need a separate `packages/shared-utils` package at this stage, or inline utilities?
- Should turbo tasks run sequentially or in parallel by default (considering Windows terminal constraints)?
- What is the minimum Node.js version requirement? (Recommend LTS: 20.x)
- Should we include vitest for unit tests in addition to Playwright infrastructure?
