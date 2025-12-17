# 000-foundation-monorepo — Implementation Tasks

## Task 1: Build api-contracts package with Zod schemas and IPC contracts
**Priority**: Critical — Required by all other tasks (contracts-first, P6)

**Files to create/modify**:
- `packages/api-contracts/src/index.ts`
- `packages/api-contracts/src/preload-api.ts`
- `packages/api-contracts/src/ipc-channels.ts`
- `packages/api-contracts/src/types/app-info.ts`
- `packages/api-contracts/package.json` (add zod, tsup, typescript deps)
- `packages/api-contracts/tsconfig.json`
- `packages/api-contracts/tsup.config.ts`

**Implementation**:
- Install dependencies: `zod`, `tsup`, `typescript`
- Define `AppInfoSchema` with Zod (version, electronVersion, chromeVersion, nodeVersion)
- Define `PreloadAPI` interface with `getVersion()` method
- Define `IPC_CHANNELS` const with `GET_VERSION` channel
- Configure tsup for dual CJS/ESM output with .d.ts generation
- Add barrel exports in index.ts

**Verification commands**:
```bash
cd packages/api-contracts
pnpm install
pnpm build
pnpm typecheck
```

**Expected outputs**:
- `packages/api-contracts/dist/` contains CJS, ESM, and .d.ts files
- No TypeScript errors

**Invariants that must remain true**:
- **P6 (Contracts-first)**: All IPC contracts defined in api-contracts using Zod schemas before implementation
- No secrets in code (P3)

---

## Task 2: Scaffold apps/electron-shell with Electron Forge + Vite template
**Priority**: Critical — Foundation structure

**Files to create/modify**:
- Create `apps/electron-shell/` directory
- `apps/electron-shell/package.json` (Electron Forge + Vite + React + Tailwind 4 deps)
- `apps/electron-shell/forge.config.ts` (Electron Forge config with Vite plugin)
- `apps/electron-shell/tsconfig.json` (extends root tsconfig.base.json)
- `apps/electron-shell/.eslintrc.cjs` (ESLint flat config)

**Implementation**:
- Use `pnpm create electron-app@latest` or manual scaffold matching Forge Vite template structure
- Install dependencies:
  - Electron 33.x
  - @electron-forge/cli, @electron-forge/plugin-vite
  - React 18.3.x, react-dom
  - Vite 6.x
  - Tailwind CSS 4.x
  - TypeScript 5.7.x
- Configure forge.config.ts with three entry points: main, preload, renderer
- Add workspace dependency on `packages-api-contracts`

**Verification commands**:
```bash
cd apps/electron-shell
pnpm install
```

**Expected outputs**:
- `apps/electron-shell/package.json` has all required dependencies
- `pnpm install` completes without errors

**Invariants that must remain true**:
- No .env files created (P3)
- Workspace structure maintained

---

## Task 3: Implement main process with BrowserWindow and security defaults
**Priority**: Critical — Process isolation foundation

**Files to create/modify**:
- `apps/electron-shell/src/main/index.ts`
- `apps/electron-shell/src/main/ipc-handlers.ts`

**Implementation**:
- Create main process entry point
- Initialize BrowserWindow with:
  - `contextIsolation: true`
  - `sandbox: true`
  - `nodeIntegration: false`
  - `preload` script path
- Register IPC handler for `IPC_CHANNELS.GET_VERSION` using api-contracts
- Return AppInfo object: version, electronVersion, chromeVersion, nodeVersion
- Handle app lifecycle: ready, quit, window close events
- Add renderer crash handler: `contents.on('render-process-gone')`

**Verification commands**:
```bash
cd apps/electron-shell
pnpm typecheck
```

**Expected outputs**:
- No TypeScript errors
- Main process imports from packages-api-contracts successfully

**Invariants that must remain true**:
- **P1 (Process isolation)**: Main process owns OS access
- **P2 (Security defaults)**: contextIsolation ON, sandbox ON, nodeIntegration OFF
- Renderer cannot access Node.js directly

---

## Task 4: Implement preload script with contextBridge API
**Priority**: Critical — Security boundary

**Files to create/modify**:
- `apps/electron-shell/src/preload/index.ts`

**Implementation**:
- Import contextBridge, ipcRenderer from electron
- Import IPC_CHANNELS, PreloadAPI from packages-api-contracts
- Create api object implementing PreloadAPI interface
- Implement `getVersion()` method wrapping `ipcRenderer.invoke(IPC_CHANNELS.GET_VERSION)`
- Use `contextBridge.exposeInMainWorld('api', api)` to expose to renderer

**Verification commands**:
```bash
cd apps/electron-shell
pnpm typecheck
```

**Expected outputs**:
- No TypeScript errors
- PreloadAPI contract enforced

**Invariants that must remain true**:
- **P2 (Security defaults)**: Minimal preload API via contextBridge
- **P6 (Contracts-first)**: PreloadAPI type from api-contracts enforced
- No raw ipcRenderer exposed to renderer

---

## Task 5: Build React renderer with Vite and Tailwind 4 CSS-first
**Priority**: Critical — UI foundation

**Files to create/modify**:
- `apps/electron-shell/src/renderer/index.html`
- `apps/electron-shell/src/renderer/main.tsx`
- `apps/electron-shell/src/renderer/App.tsx`
- `apps/electron-shell/src/renderer/styles/globals.css`
- `apps/electron-shell/src/renderer/vite-env.d.ts`
- `apps/electron-shell/vite.renderer.config.ts`

**Implementation**:
- Create index.html as Vite entry point
- Create main.tsx with React.render call
- Create App.tsx component:
  - useState for AppInfo
  - useEffect to call window.api.getVersion()
  - Display "ai-shell" heading and version info
  - Use Tailwind classes: flex, h-screen, items-center, justify-center, bg-gray-950, text-white
- Create globals.css with `@import "tailwindcss"` and @theme block
- Configure vite.renderer.config.ts for React + TypeScript
- Add type declarations for window.api (import from packages-api-contracts)

**Verification commands**:
```bash
cd apps/electron-shell
pnpm typecheck
```

**Expected outputs**:
- No TypeScript errors
- Renderer has access to window.api types

**Invariants that must remain true**:
- **P1 (Process isolation)**: Renderer is sandboxed, no Node.js access
- **P4 (UI design system)**: Tailwind 4 CSS-first tokens
- **P5 (Performance budgets)**: No Monaco in initial chunk (not added yet)

---

## Task 6: Wire turbo tasks and package.json scripts
**Priority**: High — Development workflow

**Files to create/modify**:
- `apps/electron-shell/package.json` (add scripts: dev, build, typecheck, lint, clean)
- Root `package.json` (verify turbo scripts exist)
- `turbo.json` (update outputs for electron-shell)

**Implementation**:
- Add scripts to electron-shell package.json:
  - `"dev": "electron-forge start"`
  - `"build": "electron-forge make"`
  - `"typecheck": "tsc --noEmit"`
  - `"lint": "eslint src --ext .ts,.tsx"`
  - `"clean": "rm -rf dist out .vite"`
- Update turbo.json outputs to include `[".vite/**", "out/**"]`
- Add forge.config.ts to globalDependencies in turbo.json

**Verification commands**:
```bash
pnpm install
pnpm -r typecheck
pnpm -r build
```

**Expected outputs**:
- All packages build successfully
- Turbo respects dependencies (api-contracts builds before electron-shell)

**Invariants that must remain true**:
- **P7 (Spec-Driven Development)**: Build pipeline follows spec
- Turbo caching works correctly

---

## Task 7: Configure ESLint 9 flat config for all TypeScript files
**Priority**: Medium — Code quality

**Files to create/modify**:
- Root `eslint.config.js` (or .mjs for flat config)
- `apps/electron-shell/.eslintrc.cjs` (if not using root config)
- `packages/api-contracts/.eslintrc.cjs`

**Implementation**:
- Install ESLint 9.x and @typescript-eslint/* packages at root
- Create flat config with:
  - TypeScript parser
  - Recommended rules for TS
  - React plugin rules for renderer
  - Node.js environment for main/preload
- Configure ignorePatterns: dist, out, .vite, node_modules
- Test lint passes with 0 errors on foundation code

**Verification commands**:
```bash
pnpm -r lint
```

**Expected outputs**:
- Lint runs across all TypeScript files
- 0 errors in foundation code

**Invariants that must remain true**:
- Lint enforces code quality standards
- Windows compatibility maintained

---

## Task 8: Test Electron app launches with hot-reload
**Priority**: Critical — Development workflow validation

**Files to verify**:
- All files from previous tasks

**Implementation**:
- Run `pnpm dev` from root
- Verify Electron window opens within 3 seconds
- Verify React renders "ai-shell" heading with Tailwind styling
- Verify version info displays (from IPC call to main process)
- Edit App.tsx, verify HMR updates renderer without restart
- Edit main/index.ts, verify Electron restarts and reopens window

**Verification commands**:
```bash
pnpm dev
# Manual verification in running app
```

**Expected outputs**:
- Electron app opens showing styled React content
- Version info visible (e.g., "Electron: 33.x.x")
- HMR works for renderer changes
- Main process restarts on main code changes

**Invariants that must remain true**:
- **P2 (Security defaults)**: contextIsolation verified (check DevTools Console)
- **P1 (Process isolation)**: Renderer cannot access process or require (verify in DevTools)

---

## Task 9: Add Playwright test infrastructure with E2E smoke tests
**Priority**: Medium — Quality assurance

**Files to create/modify**:
- Root `package.json` (add Playwright dev dependency)
- `test/e2e/playwright.config.ts`
- `test/e2e/app.spec.ts`
- `test/fixtures/electron-test-app.ts`

**Implementation**:
- Install @playwright/test and Playwright Electron support
- Configure playwright.config.ts for Electron testing
- Write smoke test: app launches and displays version info
- Write security test: renderer cannot access Node.js globals (process, require)
- Create reusable electron-test-app fixture
- All tests need to pass before moving on

**Verification commands**:
```bash
pnpm test
```

**Expected outputs**:
- Both tests pass
- Test confirms contextIsolation works (no Node.js globals in renderer)

**Invariants that must remain true**:
- **P2 (Security defaults)**: Test validates sandbox isolation
- **P1 (Process isolation)**: Test confirms renderer cannot access Node.js

---

## Task 10: Delete placeholder apps/shell-main and apps/shell-renderer
**Priority**: Low — Cleanup

**Files to delete**:
- `apps/shell-main/` (entire directory)
- `apps/shell-renderer/` (entire directory)

**Implementation**:
- Remove placeholder packages since functionality moved to apps/electron-shell
- Verify no other packages depend on these placeholders
- Update any documentation references

**Verification commands**:
```bash
pnpm install
pnpm -r build
```

**Expected outputs**:
- Build completes without errors
- No broken workspace references

**Invariants that must remain true**:
- Workspace structure integrity maintained
- No broken dependencies

---

## Task 11: Update README.md and add CONTRIBUTING.md
**Priority**: Medium — Documentation

**Files to create/modify**:
- Root `README.md`
- Root `CONTRIBUTING.md`
- `docs/architecture.md` (IPC flow diagram)

**Implementation**:
- Update README.md:
  - Add project description
  - Add setup instructions (pnpm install, pnpm dev)
  - Add architecture overview
  - Add development workflow
- Create CONTRIBUTING.md:
  - Explain turbo tasks (dev, build, lint, typecheck, test)
  - Document how to add new IPC contracts
  - Document how to extend window.api
- Create docs/architecture.md:
  - Include process boundary diagram
  - Explain IPC flow from plan.md
  - Document security model (contextIsolation, sandbox)

**Verification commands**:
- Manual review of documentation

**Expected outputs**:
- Clear setup instructions for new developers
- Architecture documented

**Invariants that must remain true**:
- **P7 (Spec-Driven Development)**: Documentation reflects spec/plan

---

## Task 12: Final validation — Run all acceptance criteria checks
**Priority**: Critical — Done definition

**Files to verify**:
- All files from previous tasks

**Implementation**:
Run all verification commands and manually verify acceptance criteria:

1. Repository structure matches spec
2. `pnpm install` completes without errors on Windows
3. `pnpm dev` launches app with styled content
4. HMR works (renderer changes)
5. Hot-restart works (main changes)
6. `pnpm build` compiles all packages
7. `pnpm lint` passes with 0 errors
8. `pnpm typecheck` passes
9. window.api.getVersion() works from renderer
10. Renderer cannot access Node.js (verify in DevTools)
11. Tailwind classes apply styling
12. Turbo pipeline respects dependencies (api-contracts → electron-shell)

**Verification commands**:
```bash
pnpm clean
pnpm install
pnpm -r typecheck
pnpm -r lint
pnpm -r build
pnpm test
pnpm dev
# Manual verification in DevTools:
# > typeof process
# undefined
# > typeof require
# undefined
# > window.api.getVersion()
# Promise { <pending> }
```

**Expected outputs**:
- All 12 acceptance criteria pass
- No errors in any verification command
- Manual DevTools checks confirm security model

**Invariants that must remain true**:
- **P1 (Process isolation)**: Main owns OS access, renderer sandboxed
- **P2 (Security defaults)**: contextIsolation ON, minimal preload API
- **P3 (Secrets)**: No .env files, no secrets in logs
- **P4 (UI design)**: Tailwind 4 tokens used
- **P5 (Performance)**: Monaco not in initial chunk (N/A for foundation)
- **P6 (Contracts-first)**: All IPC via api-contracts
- **P7 (Spec-Driven)**: Implementation matches spec.md and plan.md

---

## Summary
**Total tasks**: 12  
**Critical tasks**: 6 (Tasks 1, 2, 3, 4, 5, 8, 12)  
**High priority**: 1 (Task 6)  
**Medium priority**: 3 (Tasks 7, 9, 11)  
**Low priority**: 1 (Task 10)  

**Execution order**: Sequential (1 → 12)  
**Dependencies**: Task 1 must complete before all others (contracts-first)
