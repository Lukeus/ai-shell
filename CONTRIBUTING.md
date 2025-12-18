# Contributing to ai-shell

Thank you for contributing to ai-shell! This guide will help you understand the development workflow, architecture patterns, and how to extend the application.

## Development Setup

### Prerequisites

- Node.js 22.x LTS (minimum 20.x)
- pnpm 9.15.4
- Git

### Getting Started

```bash
# Clone the repository
git clone <repository-url>
cd ai-shell

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Turborepo Tasks

This project uses Turborepo to orchestrate tasks across the monorepo. Available tasks:

### `pnpm dev`
Starts all development servers with hot-reload:
- Electron app launches with Vite HMR for renderer
- Main process restarts automatically on changes
- Preload script rebuilds on changes

### `pnpm -r build`
Builds all packages in dependency order:
1. `packages/api-contracts` builds first (required by all)
2. `apps/electron-shell` builds and packages the Electron app
3. Other packages build in parallel where possible

### `pnpm -r typecheck`
Runs TypeScript type checking across all packages without emitting files.

### `pnpm -r lint`
Runs ESLint 9 (flat config) across all TypeScript/React files:
- TypeScript rules via `@typescript-eslint`
- React rules for renderer code
- Node.js environment for main/preload

### `pnpm test`
Runs Playwright E2E tests for the Electron app (when configured).

### `pnpm clean`
Removes all build artifacts (dist, out, .vite, node_modules).

## Architecture Patterns

### Contracts-First Development

**Rule**: Always update `packages/api-contracts` BEFORE adding/changing IPC, tools, or extension interfaces.

#### Adding a New IPC Contract

1. **Define the schema in api-contracts**:

```typescript
// packages/api-contracts/src/types/my-feature.ts
import { z } from 'zod';

export const MyFeatureSchema = z.object({
  id: z.string(),
  data: z.string(),
});

export type MyFeature = z.infer<typeof MyFeatureSchema>;
```

2. **Add IPC channel constant**:

```typescript
// packages/api-contracts/src/ipc-channels.ts
export const IPC_CHANNELS = {
  GET_VERSION: 'app:get-version',
  MY_FEATURE: 'my-feature:action',  // Add new channel
} as const;
```

3. **Extend PreloadAPI**:

```typescript
// packages/api-contracts/src/preload-api.ts
import { MyFeature } from './types/my-feature';

export interface PreloadAPI {
  getVersion(): Promise<AppInfo>;
  myFeature(id: string): Promise<MyFeature>;  // Add new method
}
```

4. **Build api-contracts**:

```bash
pnpm --filter packages-api-contracts build
```

5. **Implement in main process**:

```typescript
// apps/electron-shell/src/main/ipc-handlers.ts
import { IPC_CHANNELS, MyFeature } from 'packages-api-contracts';

export function registerIPCHandlers() {
  // ... existing handlers

  ipcMain.handle(IPC_CHANNELS.MY_FEATURE, async (event, id: string) => {
    const result: MyFeature = {
      id,
      data: 'some data',
    };
    return result;
  });
}
```

6. **Expose in preload**:

```typescript
// apps/electron-shell/src/preload/index.ts
const api: PreloadAPI = {
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.GET_VERSION),
  myFeature: (id) => ipcRenderer.invoke(IPC_CHANNELS.MY_FEATURE, id),
};
```

7. **Use in renderer**:

```typescript
// apps/electron-shell/src/renderer/components/MyComponent.tsx
const result = await window.api.myFeature('123');
```

### Extending window.api

The `window.api` surface is the ONLY way the renderer can communicate with the main process. Follow these rules:

1. **Keep it minimal**: Only expose what the renderer absolutely needs
2. **Type-safe**: All methods must be defined in `PreloadAPI` interface
3. **No raw IPC**: Never expose `ipcRenderer` or `ipcMain` directly
4. **Validate inputs**: Use Zod schemas in main process handlers
5. **No Node.js**: Renderer must never access `process`, `require`, or any Node.js APIs

**Security checklist**:
- ✅ Method defined in `PreloadAPI` (api-contracts)
- ✅ IPC channel constant in `IPC_CHANNELS`
- ✅ Main process validates inputs with Zod
- ✅ Renderer only accesses via `window.api.*`
- ❌ NO `ipcRenderer` in renderer
- ❌ NO `require()` in renderer
- ❌ NO `process` in renderer

## Security Invariants

These invariants MUST remain true in all code:

### P1: Process Isolation
- Main process owns ALL OS access (filesystem, keychain, network)
- Renderer is fully sandboxed with no Node.js access
- Preload provides minimal, curated API surface

### P2: Security Defaults
- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- No `webSecurity: false` or other security bypasses

### P3: Secrets Management
- Never store secrets in code or .env files
- Never log secrets (even redacted)
- Use Electron `safeStorage` API only
- Secrets handled in main process only

### P4: UI Design
- Tailwind 4 CSS-first tokens (not PostCSS plugin)
- Consistent theme across all components

### P5: Performance
- Monaco editor MUST be lazy-loaded (never in initial chunk)
- Use dynamic imports for large dependencies

### P6: Contracts-First
- Update `packages/api-contracts` BEFORE implementation
- All IPC defined with Zod schemas
- TypeScript enforces contracts at compile time

### P7: Spec-Driven Development
- Follow `WARP.md` workflow
- Implement specs in order: spec.md → plan.md → tasks.md → code
- Document architecture decisions

## Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Flat config (ESLint 9)
- **Formatting**: Follow existing patterns
- **File organization**:
  - `src/main/` - Main process code
  - `src/preload/` - Preload scripts
  - `src/renderer/` - React renderer code
  - `src/types/` - TypeScript type definitions

## Testing

### Running Tests

```bash
# Run all E2E tests
pnpm test

# Run tests in specific package
pnpm --filter apps-electron-shell test
```

### Writing Tests

Use Playwright for E2E tests:

```typescript
import { test, expect } from '../fixtures/electron-test-app';

test('should verify security', async ({ page }) => {
  // Verify Node.js globals are not accessible
  const hasProcess = await page.evaluate(() => typeof process !== 'undefined');
  expect(hasProcess).toBe(false);
});
```

## Adding Layout Panels

To add a new panel to the shell layout:

### Step 1: Create the Panel Component

Create your panel component in `apps/electron-shell/src/renderer/components/layout/`:

```typescript
// MyNewPanel.tsx
import React from 'react';

export const MyNewPanel: React.FC = () => {
  return (
    <div className="flex h-full flex-col bg-surface-default">
      <div className="border-b border-border-default p-4">
        <h2 className="text-lg font-semibold">My New Panel</h2>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {/* Panel content */}
      </div>
    </div>
  );
};
```

### Step 2: Add Panel to ShellLayout

Update `apps/electron-shell/src/renderer/App.tsx` to include your panel:

```typescript
import { MyNewPanel } from './components/layout/MyNewPanel';

<ShellLayout
  activityBar={<ActivityBar ... />}
  primarySidebar={<ExplorerPanel />}
  editor={<EditorPlaceholder />}
  secondarySidebar={<MyNewPanel />}  {/* Replace AIAssistantPanel */}
  bottomPanel={<TerminalPanel />}
  statusBar={<StatusBar />}
  primarySidebarWidth={state.primarySidebarWidth}
  // ... rest of props
/>
```

### Step 3: Access Layout State (Optional)

If your panel needs to interact with layout state:

```typescript
import { useLayoutContext } from '../../contexts/LayoutContext';

export const MyNewPanel: React.FC = () => {
  const { state, actions } = useLayoutContext();
  
  const handleToggleSidebar = () => {
    actions.toggleSecondarySidebar();
  };
  
  return (
    <div>
      <button onClick={handleToggleSidebar}>Toggle</button>
      <p>Width: {state.secondarySidebarWidth}px</p>
    </div>
  );
};
```

### Step 4: Add Tests

Create unit tests for your panel:

```typescript
// MyNewPanel.test.tsx
import { render, screen } from '@testing-library/react';
import { MyNewPanel } from './MyNewPanel';

describe('MyNewPanel', () => {
  it('renders panel title', () => {
    render(<MyNewPanel />);
    expect(screen.getByText('My New Panel')).toBeInTheDocument();
  });
});
```

### Step 5: Update E2E Tests

Add E2E test coverage in `test/e2e/shell-layout.spec.ts`:

```typescript
test('new panel is visible', async ({ page }) => {
  const panel = await page.locator('text=My New Panel');
  await expect(panel).toBeVisible();
});
```

### Layout Component API Reference

For detailed component props and usage, see:
- `packages/ui-kit/src/components/ShellLayout/ShellLayout.tsx`
- `packages/ui-kit/src/components/ResizablePanel/ResizablePanel.tsx`
- `packages/api-contracts/src/types/layout-state.ts` (LayoutState schema)

**Key guidelines**:
- All panels should handle their own scrolling (use `overflow-auto`)
- Use Tailwind 4 design tokens for colors (`bg-surface-default`, `border-border-default`)
- Test with both collapsed and expanded states
- Verify keyboard shortcuts still work after changes

## Pull Request Guidelines

1. **One feature per PR**: Keep changes focused
2. **Tests pass**: All tests must pass (`pnpm test`)
3. **Lint passes**: No ESLint errors (`pnpm -r lint`)
4. **Types check**: No TypeScript errors (`pnpm -r typecheck`)
5. **Build succeeds**: Package builds without errors (`pnpm -r build`)
6. **Security reviewed**: Verify no privilege escalation or secrets exposure
7. **Documentation updated**: Update README/docs if architecture changes

## Common Tasks

### Adding a New Package

1. Create package directory under `apps/` or `packages/`
2. Add `package.json` with name and scripts
3. Add to `pnpm-workspace.yaml` if not under existing glob
4. Add scripts: `dev`, `build`, `typecheck`, `lint`
5. Configure Turborepo in root `turbo.json` if needed

### Debugging

#### DevTools in Renderer
Press F12 or Cmd+Option+I to open DevTools.

Verify security:
```javascript
typeof process    // Should be "undefined"
typeof require    // Should be "undefined"
window.api        // Should be defined
```

#### Main Process Logs
Check terminal where `pnpm dev` is running for main process console output.

## Getting Help

- Read `docs/architecture.md` for detailed architecture
- Check `specs/` for feature specifications
- Review `memory/constitution.md` for project invariants
- Open an issue for bugs or feature requests

## License

See LICENSE file for details.
