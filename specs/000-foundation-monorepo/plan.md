# 000-foundation-monorepo — Technical Plan

## Architecture changes

### Workspace reorganization
The current structure has separate `apps/shell-main` and `apps/shell-renderer` packages. This plan consolidates them into a single Electron app with proper Forge + Vite integration:

- **Consolidate into `apps/electron-shell`**: Merge shell-main and shell-renderer into a unified Electron Forge project with three entry points:
  - `src/main/index.ts` (main process)
  - `src/preload/index.ts` (preload with contextBridge)
  - `src/renderer/` (React app with Vite)

- **Keep extension-host and agent-host placeholders**: These directories remain as placeholder packages (non-functional) since they're out of scope for this foundation. They'll be wired in future specs.

### Process architecture (foundation layer)
This plan establishes the first two processes of the four-process architecture:

1. **Main Process** (`apps/electron-shell/src/main/`):
   - Creates BrowserWindow with security defaults
   - Handles app lifecycle (ready, quit, window management)
   - Exposes IPC handlers for renderer requests
   - Entry point for future OS brokers and policy enforcement

2. **Renderer Process** (`apps/electron-shell/src/renderer/`):
   - Sandboxed React application
   - Communicates with main via IPC through preload API only
   - No direct Node.js/Electron access
   - Vite HMR for development

3. **Preload Script** (`apps/electron-shell/src/preload/`):
   - Minimal contextBridge API: `window.api.getVersion()`, `window.api.invoke()`
   - Type-safe contracts enforced via api-contracts package
   - No raw IPC exposure to renderer

### Technology stack finalized
- **Node.js**: 20.x LTS (minimum), 22.x recommended (align with package.json engines)
- **pnpm**: 9.15.4 (already specified in packageManager field)
- **Turborepo**: Latest stable (8.x)
- **Electron**: 33.x (latest stable with safeStorage support)
- **Electron Forge**: 7.x with Vite plugin
- **React**: 18.3.x
- **Vite**: 6.x (latest)
- **Tailwind CSS**: 4.x (CSS-first, not PostCSS plugin)
- **TypeScript**: 5.7.x
- **ESLint**: 9.x (flat config for modern tooling)
- **Playwright**: Latest (test infrastructure only, minimal tests)

## Contracts (api-contracts updates)

### Package structure
`packages/api-contracts` becomes the source of truth for all IPC contracts and shared types. Initial structure:

```
packages/api-contracts/
├── src/
│   ├── index.ts (barrel exports)
│   ├── preload-api.ts (window.api type definitions)
│   ├── ipc-channels.ts (IPC channel constants)
│   └── types/
│       └── app-info.ts (AppInfo, Version types)
├── package.json
├── tsconfig.json
└── tsup.config.ts (build with tsup for CJS+ESM dual output)
```

### Initial contracts

**preload-api.ts**:
```typescript
import { z } from 'zod';

// Zod schema for version info
export const AppInfoSchema = z.object({
  version: z.string(),
  electronVersion: z.string(),
  chromeVersion: z.string(),
  nodeVersion: z.string(),
});

export type AppInfo = z.infer<typeof AppInfoSchema>;

// Preload API surface exposed to renderer
export interface PreloadAPI {
  getVersion(): Promise<AppInfo>;
  // Future: invoke(channel: string, ...args: unknown[]): Promise<unknown>;
}

// Global type augmentation for renderer
declare global {
  interface Window {
    api: PreloadAPI;
  }
}
```

**ipc-channels.ts**:
```typescript
// IPC channel name constants (prevents typos)
export const IPC_CHANNELS = {
  GET_VERSION: 'app:get-version',
} as const;

export type IPCChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
```

### Build configuration
- **tsup** for bundling: Dual CJS/ESM output, .d.ts generation
- Exports both Zod schemas (runtime validation) and TypeScript types
- Main and renderer can import as `import { AppInfo } from 'packages-api-contracts'`

## IPC + process boundaries

### IPC flow (foundation)
This foundation establishes one-way request/response IPC as proof of concept:

1. **Renderer → Preload → Main**:
   - Renderer calls `window.api.getVersion()`
   - Preload translates to `ipcRenderer.invoke(IPC_CHANNELS.GET_VERSION)`
   - Main handles via `ipcMain.handle(IPC_CHANNELS.GET_VERSION, ...)`
   - Main returns `AppInfo` object
   - Preload returns Promise to renderer

2. **Security enforcement**:
   - Renderer cannot call `ipcRenderer` directly (contextIsolation=true, no Electron in sandbox)
   - Preload validates channel names against whitelist (future)
   - Main validates payloads using Zod schemas from api-contracts

### Boundary diagram
```
┌─────────────────────────────────────────┐
│  Renderer (Sandboxed)                   │
│  - React app                            │
│  - Calls window.api.getVersion()        │
│  - No Node.js access                    │
└──────────────┬──────────────────────────┘
               │ window.api (contextBridge)
┌──────────────▼──────────────────────────┐
│  Preload (Privileged Context)           │
│  - Exposes window.api via contextBridge │
│  - Wraps ipcRenderer.invoke()           │
└──────────────┬──────────────────────────┘
               │ ipcRenderer.invoke()
┌──────────────▼──────────────────────────┐
│  Main Process                            │
│  - ipcMain.handle() for IPC             │
│  - BrowserWindow management             │
│  - OS access (fs, keychain, etc.)       │
└─────────────────────────────────────────┘
```

### IPC implementation files

**apps/electron-shell/src/main/ipc-handlers.ts**:
```typescript
import { ipcMain } from 'electron';
import { IPC_CHANNELS, AppInfo } from 'packages-api-contracts';

export function registerIPCHandlers() {
  ipcMain.handle(IPC_CHANNELS.GET_VERSION, async () => {
    const info: AppInfo = {
      version: app.getVersion(),
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      nodeVersion: process.versions.node,
    };
    return info; // Auto-serialized to renderer
  });
}
```

**apps/electron-shell/src/preload/index.ts**:
```typescript
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, PreloadAPI } from 'packages-api-contracts';

const api: PreloadAPI = {
  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.GET_VERSION),
};

contextBridge.exposeInMainWorld('api', api);
```

## UI components and routes

### Renderer structure
Single-page app for this foundation (no routing yet):

```
apps/electron-shell/src/renderer/
├── index.html (Vite entry)
├── main.tsx (React.render)
├── App.tsx (root component)
├── styles/
│   └── globals.css (@tailwind directives)
└── vite-env.d.ts (Vite types)
```

### App.tsx (foundation component)
Displays version info using window.api:

```typescript
export function App() {
  const [versionInfo, setVersionInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    window.api.getVersion().then(setVersionInfo);
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-gray-950 text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">ai-shell</h1>
        {versionInfo && (
          <div className="text-sm text-gray-400 space-y-1">
            <p>App: {versionInfo.version}</p>
            <p>Electron: {versionInfo.electronVersion}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Tailwind 4 setup
CSS-first approach (no PostCSS plugin):

**globals.css**:
```css
@import "tailwindcss";

@theme {
  --color-background: #030712; /* gray-950 */
  --color-foreground: #ffffff;
}
```

**vite.config.ts**: No Tailwind plugin needed (CSS-first handles imports)

## Data model changes

No persistent data storage in this foundation. All state is ephemeral:

- Renderer state: React useState/useEffect only
- No localStorage, no IndexedDB, no file system access
- Version info comes from Electron APIs (runtime only)

Future specs will introduce:
- Settings storage (future: SecretsService with safeStorage)
- Connection configurations (future: MCP broker)
- Extension metadata (future: extension-host)

## Failure modes + recovery

### Electron process crashes
- **Main process crash**: Entire app terminates (expected behavior, no recovery in foundation)
- **Renderer crash**: Main detects via `contents.on('render-process-gone')`, logs error, reloads window
- **Preload script error**: App fails to load; main logs error to console (future: telemetry)

### IPC failures
- **Handler not registered**: IPC invoke rejects, renderer catches Promise rejection, displays "Version unavailable"
- **Invalid payload**: Main validates with Zod, returns error response, renderer handles gracefully
- **Timeout**: Future spec will add IPC timeout handling (not in foundation)

### Build failures
- **TypeScript errors**: `pnpm typecheck` fails fast, turbo halts pipeline
- **Lint errors**: `pnpm lint` fails, blocks commit (future: husky pre-commit)
- **Vite build errors**: Electron Forge detects failure, exits with non-zero code

### Hot-reload failures
- **HMR connection lost**: Vite client auto-reconnects, shows overlay on error
- **Main process restart loop**: Developer must manually kill process (Ctrl+C)
- **Syntax errors**: Vite/TypeScript shows error overlay in renderer

## Testing strategy

### Test infrastructure setup
Establish Playwright for E2E testing (minimal tests for foundation):

**test/e2e/** structure:
```
test/
├── e2e/
│   ├── app.spec.ts (smoke test: app launches, shows version)
│   └── playwright.config.ts
└── fixtures/
    └── electron-test-app.ts (Playwright Electron helper)
```

### Initial test cases

**app.spec.ts**:
```typescript
test('app launches and displays version info', async () => {
  const electronApp = await electron.launch({ args: ['.'] });
  const window = await electronApp.firstWindow();
  
  // Verify window opens
  expect(await window.title()).toBe('ai-shell');
  
  // Verify app renders
  const heading = window.locator('h1');
  await expect(heading).toHaveText('ai-shell');
  
  // Verify version info loaded from IPC
  await expect(window.locator('text=Electron:')).toBeVisible();
  
  await electronApp.close();
});

test('renderer cannot access Node.js globals', async () => {
  const electronApp = await electron.launch({ args: ['.'] });
  const window = await electronApp.firstWindow();
  
  // Verify sandbox isolation
  const hasProcess = await window.evaluate(() => typeof process !== 'undefined');
  expect(hasProcess).toBe(false);
  
  const hasRequire = await window.evaluate(() => typeof require !== 'undefined');
  expect(hasRequire).toBe(false);
  
  await electronApp.close();
});
```

### Unit testing (future)
- **api-contracts**: Zod schema validation tests (future spec)
- **Main IPC handlers**: Mock Electron APIs, test logic (future spec)
- **React components**: Vitest + React Testing Library (future spec)

### CI pipeline (not implemented in foundation)
Future spec will add:
- GitHub Actions workflow: lint → typecheck → test → build
- Windows + macOS runners
- Artifact upload for smoke testing

## Rollout / migration

### Migration from current state
Current `apps/shell-main` and `apps/shell-renderer` are placeholder packages with echo scripts. Migration steps:

1. **Create new `apps/electron-shell`** with Electron Forge scaffolding
2. **Move package.json dependencies** from old packages to electron-shell
3. **Delete old packages**: Remove `apps/shell-main` and `apps/shell-renderer`
4. **Update turbo.json**: Point dev task to `apps/electron-shell#dev`
5. **Update pnpm-workspace.yaml**: No changes needed (wildcard already includes new structure)

### No runtime migration
This is a greenfield foundation build. No existing user data, settings, or state to migrate.

### Rollback plan
Git branch for this work: `feature/000-foundation-monorepo`
- If foundation build fails validation, revert branch
- Skeleton structure remains intact (no breaking changes to other packages)

## Risks + mitigations

### Risk 1: Electron Forge + Vite plugin complexity on Windows
**Impact**: High — Windows path handling, native dependencies, MSBuild requirements
**Mitigation**:
- Use Electron Forge Vite template as starting point (battle-tested)
- Test on Windows 10 and Windows 11
- Document Visual Studio Build Tools requirements in README
- Use forward slashes in all configs (Vite normalizes paths)

### Risk 2: Tailwind 4 CSS-first is new (alpha/beta)
**Impact**: Medium — Breaking changes, incomplete docs, plugin incompatibilities
**Mitigation**:
- Pin exact Tailwind version (no ^ or ~)
- Use minimal feature set (no custom plugins in foundation)
- Fallback: Downgrade to Tailwind 3.4 with PostCSS if blocked (requires spec revision)

### Risk 3: pnpm 9.15.4 vs LTS
**Impact**: Low — User rule prefers LTS; pnpm 9 is not LTS
**Mitigation**:
- Check if pnpm 10 is available (newest LTS candidate)
- Update packageManager field to latest stable/LTS version
- Re-run `pnpm install` after version bump

### Risk 4: Turbo caching issues with Electron Forge
**Impact**: Medium — Stale cache causes dev server to fail after main process changes
**Mitigation**:
- Configure turbo.json outputs correctly: `[".vite/**", "dist/**"]`
- Add Forge config files to globalDependencies
- Document `pnpm clean && pnpm dev` workflow for cache issues

### Risk 5: TypeScript strict mode errors in Electron types
**Impact**: Medium — Electron typings may have `any` or loose types
**Mitigation**:
- Use `skipLibCheck: true` in tsconfig (already configured)
- Add type assertions where Electron types are loose
- File issues upstream if blocking

### Risk 6: contextIsolation breaks existing assumptions
**Impact**: Low — This is greenfield, no existing renderer code
**Mitigation**:
- Document preload pattern clearly in README
- Add JSDoc examples for extending window.api
- Create architecture.md doc showing IPC flow

## Done definition

This feature is **DONE** when all 12 acceptance criteria from spec.md pass:

### Build and dependency criteria
✅ 1. Repository structure matches monorepo architecture with pnpm workspaces
- `apps/electron-shell` exists with src/main, src/preload, src/renderer
- `packages/api-contracts` has contracts and builds successfully
- pnpm-workspace.yaml includes all workspaces

✅ 2. `pnpm install` completes without errors on Windows
- No dependency conflicts
- Native modules (if any) compile successfully

### Development workflow criteria
✅ 3. `pnpm dev` launches Electron app with React renderer showing styled content
- Electron window opens within 3 seconds
- React renders "ai-shell" heading with Tailwind classes
- Version info displays from IPC call

✅ 4. Changing renderer code triggers HMR without full restart
- Edit App.tsx, see changes in < 1 second
- HMR overlay shows on error

✅ 5. Changing main process code triggers Electron restart
- Edit main/index.ts, Electron restarts in < 2 seconds
- Window reopens automatically

### Build pipeline criteria
✅ 6. `pnpm build` successfully compiles all packages
- api-contracts builds to dist/ with .d.ts files
- electron-shell builds main, preload, renderer
- No TypeScript errors

✅ 7. `pnpm lint` runs ESLint across TypeScript files (0 errors in foundation code)
- Flat config works on Windows
- All foundation code passes linting

✅ 8. `pnpm typecheck` validates types with no errors
- Strict mode enabled
- All workspaces typecheck successfully

### Security and IPC criteria
✅ 9. Preload script correctly exposes API via contextBridge
- `window.api.getVersion()` callable from renderer
- Returns Promise<AppInfo>

✅ 10. Renderer cannot access Node.js globals (verified by contextIsolation)
- `typeof process === 'undefined'` in renderer console
- `typeof require === 'undefined'` in renderer console
- Playwright test passes

### Styling and orchestration criteria
✅ 11. Tailwind 4 classes apply styling in renderer
- Background color matches theme
- Typography classes render correctly

✅ 12. Turbo task pipeline respects dependencies (e.g., api-contracts builds before electron-shell)
- Run `pnpm build` from clean state
- api-contracts builds first, then electron-shell
- Turbo cache works on subsequent runs

### Documentation criterion (implicit)
- README.md updated with setup instructions, architecture diagram, and dev workflow
- CONTRIBUTING.md added with turbo task explanations
