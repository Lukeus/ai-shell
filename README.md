# ai-shell

An enterprise-grade Electron application shell with secure process architecture, designed for building AI-powered development tools.

## Features

- **Secure Process Architecture**: Sandboxed renderer with contextIsolation, minimal preload API
- **VS Code-like Layout**: Activity bar, side bars, editor area, bottom panel, status bar
- **Tailwind 4 Design System**: CSS-first tokens for consistent theming
- **Monaco Editor**: Lazy-loaded via dynamic import (never in initial chunk)
- **OS Keychain Integration**: Secure secrets via Electron safeStorage (no .env files)
- **Extension System**: Signed, policy-governed extensions with marketplace
- **Agent Host**: LangChain Deep Agents with tool-based execution and audit/policy layer

## Prerequisites

- **Node.js**: 22.x LTS (minimum 20.x)
- **pnpm**: 9.15.4 (specified in package.json)
- **Windows, macOS, or Linux**

## Setup

```bash
# Install dependencies
pnpm install

# Start development server (with hot-reload)
pnpm dev

# Build for production
pnpm -r build

# Run tests
pnpm test

# Type checking
pnpm -r typecheck

# Lint code
pnpm -r lint
```

## Architecture Overview

ai-shell uses a secure multi-process Electron architecture:

### Process Boundaries

```
┌─────────────────────────────────────────┐
│  Renderer (Sandboxed)                   │
│  - React app with Tailwind 4            │
│  - Calls window.api.* methods           │
│  - No Node.js/Electron access           │
└──────────────┬──────────────────────────┘
               │ window.api (contextBridge)
┌──────────────▼──────────────────────────┐
│  Preload (Privileged Context)           │
│  - Exposes window.api via contextBridge │
│  - Wraps ipcRenderer.invoke()           │
│  - Type-safe contracts                  │
└──────────────┬──────────────────────────┘
               │ ipcRenderer.invoke()
┌──────────────▼──────────────────────────┐
│  Main Process                            │
│  - ipcMain.handle() for IPC             │
│  - BrowserWindow management             │
│  - OS access (fs, keychain, etc.)       │
└─────────────────────────────────────────┘
```

### Key Packages

- **`apps/electron-shell`**: Main Electron application (Forge + Vite)
- **`packages/api-contracts`**: Shared IPC contracts with Zod schemas
- **`packages/ui-kit`**: Reusable React components
- **Extensions & agents**: (Coming in future specs)

### Security Model

- **P1 (Process Isolation)**: Main process owns all OS access, renderer is fully sandboxed
- **P2 (Security Defaults)**: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`
- **P3 (Secrets)**: Never stored/logged in plaintext, no .env files, safeStorage only
- **P6 (Contracts-First)**: All IPC defined in packages/api-contracts before implementation

## Development Workflow

1. **Start dev server**: `pnpm dev` (opens Electron app with HMR)
2. **Make changes**: Edit files in `apps/electron-shell/src/`
   - Renderer changes: Hot module reload (no restart)
   - Main/preload changes: Electron restarts automatically
3. **Verify**: Use DevTools (F12) to check security:
   ```javascript
   typeof process    // Should be 'undefined'
   typeof require    // Should be 'undefined'
   window.api       // Should be defined
   ```

## Project Structure

```
ai-shell/
├── apps/
│   ├── electron-shell/      # Main Electron app (Forge + Vite + React)
│   ├── agent-host/          # Agent execution host (future)
│   └── extension-host/      # Extension runtime (future)
├── packages/
│   ├── api-contracts/       # IPC contracts (Zod schemas)
│   ├── ui-kit/              # Shared React components
│   ├── agent-*/             # Agent-related packages (future)
│   └── broker-*/            # IPC broker packages (future)
├── specs/                   # Feature specifications
│   └── 000-foundation-monorepo/
├── test/
│   ├── e2e/                 # Playwright tests
│   └── fixtures/            # Test utilities
├── docs/                    # Architecture documentation
└── memory/                  # Project constitution and context
```

## How to Build with Warp (SDD)

1. Follow `WARP.md` for development rules
2. Read `memory/constitution.md` and `memory/context/*` for invariants
3. Work feature-by-feature in `specs/*`:
   - Read spec.md → plan.md → tasks.md
   - Implement tasks in order
   - Review against invariants

## Documentation

- [Architecture Details](docs/architecture.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Feature Specs](specs/)

## Start Here

New to the project? Start with `specs/000-foundation-monorepo/spec.md`
