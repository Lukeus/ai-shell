# ai-shell Architecture

This document describes the technical architecture of ai-shell, focusing on the secure multi-process design, IPC communication, and security model.

## Process Architecture

ai-shell uses Electron's multi-process architecture with strict security boundaries:

### Process Boundary Diagram

```
┌─────────────────────────────────────────┐
│  Renderer Process (Sandboxed)           │
│                                          │
│  • React 18 + Tailwind 4                │
│  • No Node.js access                    │
│  • No Electron APIs                     │
│  • Communicates via window.api only     │
│                                          │
│  Security:                               │
│  - contextIsolation: true               │
│  - sandbox: true                        │
│  - nodeIntegration: false               │
└──────────────┬──────────────────────────┘
               │
               │ contextBridge
               │ window.api.*
               │
┌──────────────▼──────────────────────────┐
│  Preload Script (Privileged Context)    │
│                                          │
│  • Runs before renderer loads           │
│  • Has access to contextBridge          │
│  • Exposes minimal API to renderer      │
│  • Wraps ipcRenderer.invoke()           │
│                                          │
│  Exports:                                │
│  - window.api.getVersion()              │
│  - window.api.* (type-safe methods)     │
└──────────────┬──────────────────────────┘
               │
               │ ipcRenderer.invoke()
               │ ipcMain.handle()
               │
┌──────────────▼──────────────────────────┐
│  Main Process (Full Privileges)         │
│                                          │
│  • Node.js and Electron APIs            │
│  • BrowserWindow management             │
│  • IPC handlers                         │
│  • OS access (fs, keychain, etc.)       │
│  • App lifecycle management             │
│                                          │
│  Responsibilities:                       │
│  - Create/manage windows                │
│  - Handle IPC requests                  │
│  - Access file system                   │
│  - Manage secrets via safeStorage       │
└─────────────────────────────────────────┘
```

## IPC Communication Flow

### Request/Response Pattern

All renderer-to-main communication follows a request/response pattern using `invoke/handle`:

```
┌──────────────┐
│   Renderer   │  1. window.api.getVersion()
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Preload    │  2. ipcRenderer.invoke(IPC_CHANNELS.GET_VERSION)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│     Main     │  3. ipcMain.handle(IPC_CHANNELS.GET_VERSION, async () => {...})
└──────┬───────┘
       │
       │ 4. Returns AppInfo
       │
       ▼
┌──────────────┐
│   Renderer   │  5. Promise<AppInfo> resolves
└──────────────┘
```

### Example: Getting Version Info

**1. Contract Definition** (packages/api-contracts):

```typescript
// src/types/app-info.ts
import { z } from 'zod';

export const AppInfoSchema = z.object({
  version: z.string(),
  electronVersion: z.string(),
  chromeVersion: z.string(),
  nodeVersion: z.string(),
});

export type AppInfo = z.infer<typeof AppInfoSchema>;

// src/ipc-channels.ts
export const IPC_CHANNELS = {
  GET_VERSION: 'app:get-version',
} as const;

// src/preload-api.ts
export interface PreloadAPI {
  getVersion(): Promise<AppInfo>;
}

declare global {
  interface Window {
    api: PreloadAPI;
  }
}
```

**2. Main Process Handler** (apps/electron-shell/src/main/ipc-handlers.ts):

```typescript
import { ipcMain, app } from 'electron';
import { IPC_CHANNELS, AppInfo } from 'packages-api-contracts';

export function registerIPCHandlers() {
  ipcMain.handle(IPC_CHANNELS.GET_VERSION, async () => {
    const info: AppInfo = {
      version: app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
    };
    return info;
  });
}
```

**3. Preload Exposure** (apps/electron-shell/src/preload/index.ts):

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, PreloadAPI } from 'packages-api-contracts';

const api: PreloadAPI = {
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.GET_VERSION),
};

contextBridge.exposeInMainWorld('api', api);
```

**4. Renderer Usage** (apps/electron-shell/src/renderer/App.tsx):

```typescript
import { useState, useEffect } from 'react';
import type { AppInfo } from 'packages-api-contracts';

export function App() {
  const [versionInfo, setVersionInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    window.api.getVersion().then(setVersionInfo).catch(console.error);
  }, []);

  return (
    <div>
      {versionInfo && (
        <>
          <p>App: {versionInfo.version}</p>
          <p>Electron: {versionInfo.electronVersion}</p>
        </>
      )}
    </div>
  );
}
```

## Security Model

### Defense in Depth

ai-shell implements multiple layers of security:

#### Layer 1: Process Isolation (P1)

- **Main process**: Has full OS access, manages windows, handles IPC
- **Renderer process**: Fully sandboxed, no Node.js/Electron access
- **Preload script**: Minimal API bridge with curated methods

**Verification**:
```javascript
// In renderer DevTools console:
typeof process   // "undefined" ✓
typeof require   // "undefined" ✓
typeof window.api // "object" ✓
```

#### Layer 2: Security Defaults (P2)

BrowserWindow configuration (apps/electron-shell/src/main/index.ts):

```typescript
const mainWindow = new BrowserWindow({
  webPreferences: {
    // Isolate preload/renderer contexts
    contextIsolation: true,
    
    // Enable Chromium sandbox
    sandbox: true,
    
    // Disable Node.js in renderer
    nodeIntegration: false,
    
    // Load preload script
    preload: path.join(__dirname, 'preload.js'),
  },
});
```

**Never use**:
- ❌ `webSecurity: false`
- ❌ `nodeIntegration: true`
- ❌ `contextIsolation: false`
- ❌ `sandbox: false`

#### Layer 3: Secrets Management (P3)

**Rules**:
- Never store secrets in code or .env files
- Never log secrets (even redacted)
- Use Electron's `safeStorage` API exclusively
- Handle secrets only in main process

**Example** (future implementation):

```typescript
// Main process only
import { safeStorage } from 'electron';

// Store encrypted secret
const encrypted = safeStorage.encryptString('my-secret');
// Save encrypted buffer to secure storage

// Retrieve and decrypt
const decrypted = safeStorage.decryptString(encrypted);
// Use secret, never log it
```

#### Layer 4: Contracts-First (P6)

All IPC communication must:
1. Be defined in `packages/api-contracts` first
2. Use Zod schemas for runtime validation
3. Have TypeScript types for compile-time safety
4. Use channel constants (no magic strings)

**Workflow**:
1. Define schema in api-contracts
2. Build api-contracts: `pnpm --filter packages-api-contracts build`
3. Implement main process handler
4. Expose in preload
5. Use in renderer

## Technology Stack

### Core Technologies

- **Electron**: 33.x (latest with safeStorage)
- **Electron Forge**: 7.x with Vite plugin
- **Node.js**: 22.x LTS (minimum 20.x)
- **pnpm**: 9.15.4 (workspace manager)
- **Turborepo**: 2.x (task orchestration)

### Frontend

- **React**: 18.3.x (with strict mode)
- **Vite**: 6.x (dev server + bundler)
- **Tailwind CSS**: 4.x (CSS-first tokens)
- **TypeScript**: 5.7.x (strict mode)

### Tooling

- **ESLint**: 9.x (flat config)
- **Playwright**: Latest (E2E testing)
- **tsup**: For bundling api-contracts (dual CJS/ESM)
- **Zod**: Runtime schema validation

## Package Structure

### Monorepo Layout

```
ai-shell/
├── apps/
│   ├── electron-shell/          # Main Electron app
│   │   ├── src/
│   │   │   ├── main/            # Main process
│   │   │   │   ├── index.ts     # Entry point
│   │   │   │   └── ipc-handlers.ts
│   │   │   ├── preload/         # Preload script
│   │   │   │   └── index.ts
│   │   │   └── renderer/        # React app
│   │   │       ├── App.tsx
│   │   │       ├── main.tsx
│   │   │       └── styles/
│   │   ├── forge.config.ts      # Electron Forge config
│   │   ├── vite.*.config.ts     # Vite configs
│   │   └── package.json
│   ├── agent-host/              # Future: Agent execution
│   └── extension-host/          # Future: Extension runtime
│
├── packages/
│   ├── api-contracts/           # IPC contracts (Zod + TS)
│   │   ├── src/
│   │   │   ├── preload-api.ts
│   │   │   ├── ipc-channels.ts
│   │   │   └── types/
│   │   ├── tsup.config.ts       # Dual CJS/ESM build
│   │   └── package.json
│   ├── ui-kit/                  # Shared React components
│   └── [other packages]/
│
├── test/
│   ├── e2e/                     # Playwright tests
│   │   ├── app.spec.ts
│   │   └── playwright.config.ts
│   └── fixtures/
│       └── electron-test-app.ts
│
└── docs/
    └── architecture.md          # This file
```

### Dependency Flow

```
electron-shell → api-contracts
ui-kit → api-contracts
agent-host → api-contracts (future)
extension-host → api-contracts (future)
```

Turborepo ensures `api-contracts` builds first, then dependent packages build in parallel.

## Development Workflow

### Hot Reload Behavior

#### Renderer Changes
- **File**: `apps/electron-shell/src/renderer/**`
- **Behavior**: Vite HMR updates without restarting Electron
- **Speed**: < 1 second

#### Main/Preload Changes
- **Files**: `apps/electron-shell/src/main/**`, `src/preload/**`
- **Behavior**: Electron restarts automatically
- **Speed**: 2-3 seconds

### Build Process

```bash
# Development (with hot-reload)
pnpm dev

# Production build
pnpm -r build
  # 1. Builds api-contracts (tsup)
  # 2. Builds electron-shell (electron-forge package)
  # 3. Output: apps/electron-shell/out/
```

## Future Architecture

### Planned Additions

1. **Agent Host** (apps/agent-host):
   - LangChain Deep Agents runtime
   - Tool execution with audit trail
   - Policy enforcement layer

2. **Extension Host** (apps/extension-host):
   - Signed extension loader
   - Sandboxed extension runtime
   - Extension marketplace integration

3. **IPC Broker** (packages/broker-*):
   - Message routing between processes
   - Request validation and throttling
   - Audit logging

These will follow the same security model: contracts-first, sandboxed, type-safe.

## Testing Strategy

### E2E Tests (Playwright)

Tests verify:
- App launches successfully
- Security model enforced (no Node.js in renderer)
- IPC communication works
- window.api methods function correctly

**Example**:
```typescript
test('renderer has no Node.js access', async ({ page }) => {
  const hasProcess = await page.evaluate(() => typeof process !== 'undefined');
  expect(hasProcess).toBe(false);
});
```

### Unit Tests

(Future) Test individual functions:
- IPC handlers (main process)
- Zod schema validation
- React components

## Performance Considerations

### P5: Performance Budgets

1. **Monaco Editor**: MUST be lazy-loaded
   ```typescript
   // ✓ Correct
   const Monaco = lazy(() => import('./Monaco'));
   
   // ✗ Wrong
   import Monaco from './Monaco';
   ```

2. **Initial Bundle**: Target < 500KB
3. **First Paint**: < 2 seconds on dev machine

## References

- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [IPC Best Practices](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Project Constitution](../memory/constitution.md)
