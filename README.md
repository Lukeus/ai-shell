# ai-shell

An enterprise-grade Electron application shell with secure process architecture, designed for building AI-powered development tools.

## Features

- **Secure Process Architecture**: Sandboxed renderer with contextIsolation, minimal preload API
- **VS Code-like Layout**: 6 resizable regions, bottom panel tabs, and VS Code-style chrome
- **Workspace Explorer**: File tree navigation with workspace persistence, secure filesystem operations
- **Tailwind 4 Design System**: CSS-first tokens for consistent theming
- **Custom Title Bar (Win/Linux)**: Custom menu bar + window controls, native title bar on macOS
- **Monaco Editor**: Lazy-loaded via dynamic import (never in initial chunk)
- **OS Keychain Integration**: Secure secrets via Electron safeStorage (no .env files)
- **Extension System**: Signed, policy-governed extensions with marketplace
- **Agent Host**: LangChain Deep Agents with tool-based execution and audit/policy layer

### Shell Layout

The application features a VS Code-like layout with 6 resizable regions:

```
┌──┬──────────┬───────────────────────────┬──────────────┐
│  │          │                           │              │
│ A│  Primary │                           │  Secondary   │
│ c│  Sidebar │       Editor Area         │   Sidebar    │
│ t│          │                           │              │
│ i│ Explorer │     (Monaco Editor)       │ AI Assistant │
│ v│          │                           │              │
│ i├──────────┼───────────────────────────┼──────────────┤
│ t│          │                           │              │
│ y│  Bottom  │      Terminal Panel       │              │
│  │  Panel   │                           │              │
│ B├──────────┴───────────────────────────┴──────────────┤
│ a│              Status Bar                             │
│ r│                                                      │
└──┴──────────────────────────────────────────────────────┘
```

**6 Regions**:
1. **Activity Bar** (left, 48px fixed): Explorer, Search, Source Control, Run & Debug, Extensions, Settings
2. **Primary Sidebar** (left, resizable 200-600px): Context panel (Explorer by default)
3. **Editor Area** (center, flexible): Main content area for Monaco editor
4. **Secondary Sidebar** (right, resizable 200-600px): AI Assistant panel
5. **Bottom Panel** (bottom, resizable 100-600px): Terminal/Output/Problems tabs
6. **Status Bar** (bottom, 24px fixed): Status information

**Keyboard Shortcuts**:
- `Ctrl+B` (macOS: `Cmd+B`): Toggle primary sidebar
- `Ctrl+J` (macOS: `Cmd+J`): Toggle bottom panel
- `Ctrl+Shift+E` (macOS: `Cmd+Shift+E`): Focus Explorer icon

**State Persistence**: Layout state (panel sizes, collapsed states, active icon) persists to localStorage and restores on app restart.

### Workspace Explorer

The Workspace Explorer provides secure file system navigation and management:

**Features**:
- **Workspace Management**: Open folders, persist workspace across app restarts
- **File Tree**: Recursive directory tree with lazy-loading, dotfile filtering, and folders-first sorting
- **File Operations**: Create, rename, delete files/folders (moves to OS trash)
- **Editor Tabs**: Multiple file tabs with deduplication, active tab highlighting
- **Security**: All filesystem operations validated to prevent path traversal attacks

**Keyboard Shortcuts**:
- `Ctrl+K Ctrl+O` (macOS: `Cmd+K Cmd+O`): Open Folder
- `F5`: Refresh Explorer

**Menu Items**:
- **File → Open Folder...**: Opens native folder picker
- **File → Close Folder**: Closes current workspace
- **File → Refresh Explorer**: Refreshes file tree (F5)

**Window Chrome**:
- **Windows/Linux**: Custom title bar with menu row and window controls
- **macOS**: Native menu bar and window controls

**Architecture**:
- **WorkspaceService**: Main process singleton managing workspace state and persistence
- **FsBrokerService**: Main process filesystem broker with security validation
- **FileTreeContext**: Renderer context managing tree state and localStorage persistence
- All filesystem access via IPC (no Node.js access in renderer)

## Prerequisites

- **Node.js**: 22.x LTS (minimum 20.x)
- **pnpm**: 9.15.4 (specified in package.json)
- **Windows, macOS, or Linux**
- **Windows only**: Visual Studio Build Tools (for node-pty native compilation)
  - Install via: `npm install --global windows-build-tools` OR
  - Visual Studio 2022/2019 with "Desktop development with C++" workload

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

- [Architecture Details](docs/architecture/architecture.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Feature Specs](specs/)

## Start Here

New to the project? Start with `specs/000-foundation-monorepo/spec.md`
