# 030-workspace-explorer — Implementation Tasks

## Task 1: Define API contracts (workspace + fs-broker types and IPC channels)

**Description:** Create all Zod schemas and type definitions for workspace and filesystem broker operations in `packages/api-contracts`. This MUST be done first per P6 (Contracts-first).

**Files to create/modify:**
- `packages/api-contracts/src/types/workspace.ts` (create)
- `packages/api-contracts/src/types/fs-broker.ts` (create)
- `packages/api-contracts/src/ipc-channels.ts` (modify: add WORKSPACE_* and FS_* channels)
- `packages/api-contracts/src/preload-api.ts` (modify: add workspace and fs interfaces)
- `packages/api-contracts/src/index.ts` (modify: export new types)

**Verification commands:**
```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r build
```

**Constitution invariants:**
- **P6 (Contracts-first)**: All IPC contracts defined with Zod schemas before any implementation
- **P2 (Security defaults)**: PreloadAPI only exposes approved, minimal API surface via contextBridge

**Acceptance:**
- WorkspaceSchema and all fs-broker schemas (FileEntry, ReadDirectory*, CreateFile*, etc.) defined with Zod
- IPC_CHANNELS constants added for all 9 channels (3 workspace + 6 fs operations)
- PreloadAPI interface updated with workspace.* and fs.* method signatures
- TypeScript compiles with 0 errors
- All types exported from api-contracts index

---

## Task 2: Implement WorkspaceService (main process)

**Description:** Create singleton service managing workspace state with persistence to `workspace.json`. Validates paths, handles native folder picker dialog.

**Files to create/modify:**
- `apps/electron-shell/src/main/services/WorkspaceService.ts` (create)
- `apps/electron-shell/src/main/services/WorkspaceService.test.ts` (create)

**Verification commands:**
```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```

**Constitution invariants:**
- **P1 (Process isolation)**: Service runs ONLY in main process, owns disk access to workspace.json
- **P3 (Secrets)**: workspace.json contains NO secrets (only path + name)

**Acceptance:**
- Singleton pattern with getInstance()
- Methods: getWorkspace(), setWorkspace(path), clearWorkspace(), openWorkspace() (with native dialog)
- Persists to `app.getPath('userData')/workspace.json`
- Validates path exists on load (returns null if path deleted)
- Handles corrupted JSON gracefully (deletes file, logs warning, returns null)
- Unit tests cover all 9 scenarios from plan (singleton, persistence, validation, corruption, dialog)
- Test coverage ≥ 80%

---

## Task 3: Implement FsBrokerService with path validation (main process)

**Description:** Create stateless filesystem broker with critical security validation. ALL operations scoped to workspace root.

**Files to create/modify:**
- `apps/electron-shell/src/main/services/FsBrokerService.ts` (create)
- `apps/electron-shell/src/main/services/FsBrokerService.test.ts` (create)

**Verification commands:**
```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```

**Constitution invariants:**
- **P1 (Process isolation)**: Service runs ONLY in main process, owns all filesystem I/O
- **Security**: Path validation is CRITICAL - validatePathWithinWorkspace() called before EVERY disk access

**Acceptance:**
- Singleton with getInstance()
- Path validation: normalize, resolve, check startsWith(workspaceRoot), reject `..` and outside paths
- Filename validation: reject null bytes, control chars, path separators, max 255 chars
- Methods: readDirectory (filters dotfiles, sorts folders-first), readFile, createFile, createDirectory, rename, delete (via shell.trashItem)
- Error mapping: ENOENT → "File not found", EACCES → "Permission denied"
- Error sanitization: replace absolute paths with relative paths in error messages
- Unit tests cover all 15 scenarios (sorting, filtering, path validation, errors, trash)
- Test coverage ≥ 80%
- **CRITICAL**: Security tests confirm `..` and outside-workspace paths are REJECTED

---

## Task 4: Wire IPC handlers and preload (main + preload)

**Description:** Register IPC handlers for workspace and fs-broker operations. Expose APIs via contextBridge in preload.

**Files to create/modify:**
- `apps/electron-shell/src/main/ipc-handlers.ts` (modify: add workspace and fs handlers)
- `apps/electron-shell/src/main/ipc-handlers.test.ts` (modify: add tests for new handlers)
- `apps/electron-shell/src/preload/index.ts` (modify: expose workspace and fs APIs)

**Verification commands:**
```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm -r build
```

**Constitution invariants:**
- **P1 (Process isolation)**: IPC is the ONLY way renderer accesses workspace/fs operations
- **P2 (Security defaults)**: contextBridge exposes minimal, approved API only
- **P6 (Contracts-first)**: Validate all requests with Zod schemas before processing

**Acceptance:**
- 9 IPC handlers registered: WORKSPACE_OPEN/GET_CURRENT/CLOSE, FS_READ_DIRECTORY/READ_FILE/CREATE_FILE/CREATE_DIRECTORY/RENAME/DELETE
- Each handler validates request with Zod schema (reject invalid with validation error)
- Handlers call WorkspaceService/FsBrokerService methods
- Preload exposes window.api.workspace.* (open, getCurrent, close)
- Preload exposes window.api.fs.* (readDirectory, readFile, createFile, createDirectory, rename, delete)
- Unit tests confirm handlers call services correctly and reject invalid requests
- Build succeeds, renderer can access window.api.workspace and window.api.fs

---

## Task 5: Implement FileTreeContext (renderer state management)

**Description:** React context providing workspace state, tree state, editor tabs, file operations, and localStorage persistence.

**Files to create/modify:**
- `apps/electron-shell/src/renderer/components/explorer/FileTreeContext.tsx` (create)
- `apps/electron-shell/src/renderer/components/explorer/FileTreeContext.test.tsx` (create)

**Verification commands:**
```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```

**Constitution invariants:**
- **P1 (Process isolation)**: Context uses window.api.* for ALL IPC calls (no Node.js access)
- Renderer state is ephemeral or localStorage only (no disk access)

**Acceptance:**
- FileTreeContextProvider with FileTreeContextValue interface
- State: workspace, expandedFolders (Set<string>), openTabs (string[]), activeTabIndex, directoryCache (Map)
- Methods: loadWorkspace, openWorkspace, closeWorkspace, toggleFolder, collapseAll, openFile, closeTab, setActiveTab, createFile, createFolder, renameItem, deleteItem, refresh, loadDirectory
- localStorage persistence: expandedFolders and openTabs saved per workspace (key includes workspace path hash)
- openFile() deduplicates: focuses existing tab if already open, otherwise adds to openTabs
- Unit tests cover all 10 scenarios (workspace load, folder toggle, persistence, file open deduplication, operations)
- Test coverage ≥ 80%

---

## Task 6: Implement Explorer components (FileTree, FileTreeNode, InlineInput)

**Description:** Build recursive tree rendering with expand/collapse, inline editing for new/rename, and hover actions.

**Files to create/modify:**
- `apps/electron-shell/src/renderer/components/explorer/FileTree.tsx` (create)
- `apps/electron-shell/src/renderer/components/explorer/FileTree.test.tsx` (create)
- `apps/electron-shell/src/renderer/components/explorer/FileTreeNode.tsx` (create)
- `apps/electron-shell/src/renderer/components/explorer/InlineInput.tsx` (create)

**Verification commands:**
```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```

**Constitution invariants:**
- **P1 (Process isolation)**: Components use FileTreeContext (IPC via window.api), no direct Node.js access
- **P4 (UI design)**: Use Tailwind 4 tokens/CSS variables for theming (no hardcoded colors)

**Acceptance:**
- FileTree: renders FileTreeNode recursively, shows empty states, lazy-loads directories on expand
- FileTreeNode: displays chevron (folders), icon, label, inline actions (rename, delete icons on hover)
- Click chevron: toggleFolder(), click file: openFile()
- InlineInput: reusable component for new file/folder and rename (Enter commits, Escape cancels)
- Dotfiles (starting with `.`) not rendered
- Loading spinner shown during loadDirectory() IPC call
- Unit tests confirm rendering, sorting (folders-first), expand/collapse, hover actions, dotfile filtering
- Test coverage ≥ 80%

---

## Task 7: Implement ExplorerPanel with header actions and empty states

**Description:** Root explorer component with workspace name, action buttons (Refresh, New File, New Folder, Collapse All), and empty states.

**Files to create/modify:**
- `apps/electron-shell/src/renderer/components/explorer/ExplorerPanel.tsx` (replace existing placeholder)
- `apps/electron-shell/src/renderer/components/explorer/ExplorerPanel.test.tsx` (create)
- `apps/electron-shell/src/renderer/components/explorer/ConfirmDeleteModal.tsx` (create)

**Verification commands:**
```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```

**Constitution invariants:**
- **P1 (Process isolation)**: All operations via FileTreeContext (no direct Node.js access)
- **P4 (UI design)**: Tailwind 4 tokens for all colors

**Acceptance:**
- ExplorerHeader: workspace name, Refresh/New File/New Folder/Collapse All buttons
- Empty states: "No folder open" (with Open Folder button), "No files in workspace", error state with Retry button
- New File/Folder buttons show InlineInput at top of tree, call createFile/createFolder on Enter
- ConfirmDeleteModal: portal-rendered modal with "Delete {name}?" confirmation
- Unit tests confirm header actions, empty states, inline input flow
- Test coverage ≥ 80%

---

## Task 8: Implement Editor components (EditorArea, EditorTabBar, EditorPlaceholder)

**Description:** Editor tab bar with file tabs and placeholder content (Monaco integration deferred to spec 040).

**Files to create/modify:**
- `apps/electron-shell/src/renderer/components/editor/EditorArea.tsx` (create)
- `apps/electron-shell/src/renderer/components/editor/EditorTabBar.tsx` (create)
- `apps/electron-shell/src/renderer/components/editor/EditorTabBar.test.tsx` (create)
- `apps/electron-shell/src/renderer/components/editor/EditorPlaceholder.tsx` (create)

**Verification commands:**
```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
```

**Constitution invariants:**
- **P5 (Performance)**: Monaco NOT loaded (placeholder only, deferred to spec 040)
- **P4 (UI design)**: Tailwind 4 tokens for styling

**Acceptance:**
- EditorArea: container with EditorTabBar + EditorPlaceholder
- EditorTabBar: horizontal tabs, each shows file basename, active tab has accent underline, close (X) button
- Click tab: setActiveTab(), click X: closeTab()
- EditorPlaceholder: displays "File: {relativePath}" + "Monaco not yet implemented"
- Empty state: "Open a file to start editing" when no tabs open
- Unit tests confirm tab rendering, active state, click handlers, close button
- Test coverage ≥ 80%

---

## Task 9: Integrate ExplorerPanel and EditorArea into App layout

**Description:** Wire ExplorerPanel into Primary Sidebar and EditorArea into layout's editor region. Update StatusBar to show workspace name.

**Files to create/modify:**
- `apps/electron-shell/src/renderer/App.tsx` (modify: add EditorArea to editor region)
- `apps/electron-shell/src/renderer/components/layout/StatusBar.tsx` (modify: show workspace name in left section)
- `apps/electron-shell/src/renderer/components/layout/ExplorerPanel.tsx` (already replaced in Task 7, verify integration)

**Verification commands:**
```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r build
pnpm dev  # manual smoke test
```

**Constitution invariants:**
- **P1 (Process isolation)**: All components use IPC via window.api (verify no Node.js access)
- **P4 (UI design)**: Maintain Tailwind 4 token-based theming

**Acceptance:**
- App.tsx renders EditorArea in ShellLayout's editor region
- ExplorerPanel shows when ActivityBar explorer icon active (activity='explorer')
- StatusBar left section updates: shows workspace name when workspace open, "No Folder Open" otherwise
- FileTreeContextProvider wraps App (or relevant subtree)
- Manual test: Open app, click Activity Bar explorer icon, see "No folder open" state
- TypeScript compiles, build succeeds, dev server runs without errors

---

## Task 10: Add File menu items (Open Folder, Close Folder, Refresh)

**Description:** Add menu items to Electron main process menu template for workspace operations.

**Files to create/modify:**
- `apps/electron-shell/src/main/menu.ts` (modify: add File menu items)

**Verification commands:**
```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r build
pnpm dev  # manual test menu items
```

**Constitution invariants:**
- **P1 (Process isolation)**: Menu handlers trigger IPC calls (via BrowserWindow.webContents.send or existing menu IPC pattern)

**Acceptance:**
- File menu gains:
  - "Open Folder..." (Ctrl+K Ctrl+O / Cmd+K Cmd+O) → triggers WORKSPACE_OPEN
  - "Close Folder" (visible only when workspace open) → triggers WORKSPACE_CLOSE
  - "Refresh Explorer" (F5) → triggers refresh action
- Keyboard shortcuts registered
- Manual test: File → Open Folder opens native dialog, Close Folder clears workspace
- Build succeeds

---

## Task 11: Write unit tests for main process services

**Description:** Ensure WorkspaceService and FsBrokerService have comprehensive test coverage (already started in Tasks 2-3, complete if needed).

**Files to create/modify:**
- `apps/electron-shell/src/main/services/WorkspaceService.test.ts` (verify complete)
- `apps/electron-shell/src/main/services/FsBrokerService.test.ts` (verify complete)

**Verification commands:**
```bash
pnpm -r test
```

**Constitution invariants:**
- **P1 (Process isolation)**: Tests confirm services only run in main process
- **Security**: Tests MUST verify path traversal rejection (`..`, outside workspace)

**Acceptance:**
- WorkspaceService: 9+ tests covering singleton, persistence, validation, corruption, dialog
- FsBrokerService: 15+ tests covering sorting, filtering, path validation (CRITICAL), errors, trash
- Test coverage ≥ 80% for both services
- Security tests PASS: attempts to access `../../etc/passwd` are REJECTED
- All tests pass (`pnpm -r test`)

---

## Task 12: Write unit tests for renderer components

**Description:** Ensure Explorer and Editor components have comprehensive test coverage (already started in Tasks 5-8, complete if needed).

**Files to create/modify:**
- `apps/electron-shell/src/renderer/components/explorer/FileTreeContext.test.tsx` (verify complete)
- `apps/electron-shell/src/renderer/components/explorer/FileTree.test.tsx` (verify complete)
- `apps/electron-shell/src/renderer/components/explorer/ExplorerPanel.test.tsx` (verify complete)
- `apps/electron-shell/src/renderer/components/editor/EditorTabBar.test.tsx` (verify complete)

**Verification commands:**
```bash
pnpm -r test
```

**Constitution invariants:**
- **P1 (Process isolation)**: Tests mock window.api.* (no direct Node.js access in renderer)

**Acceptance:**
- FileTreeContext: 10+ tests covering workspace load, folder toggle, persistence, file operations
- FileTree: 7+ tests covering rendering, sorting, expand/collapse, hover, dotfile filtering
- ExplorerPanel: 6+ tests covering empty states, header actions, inline input
- EditorTabBar: 4+ tests covering tab rendering, active state, click handlers
- Test coverage ≥ 80% for all components
- All tests pass (`pnpm -r test`)

---

## Task 13: Write E2E tests (Playwright)

**Description:** End-to-end tests covering workspace flow, explorer tree, file operations, editor tabs, and security.

**Files to create/modify:**
- `test/e2e/workspace.spec.ts` (create)
- `test/e2e/explorer.spec.ts` (create)
- `test/e2e/file-operations.spec.ts` (create)
- `test/e2e/editor-tabs.spec.ts` (create)
- `test/e2e/security.spec.ts` (create)

**Verification commands:**
```bash
pnpm test:e2e
```

**Constitution invariants:**
- **P1 (Process isolation)**: E2E tests verify renderer cannot access Node.js (security test)
- **Security**: Path traversal test MUST PASS (attempt `../../etc/passwd`, verify rejection)

**Acceptance:**
- Workspace flow: open folder, close folder, persistence across restart
- Explorer tree: display files/folders, sorting, expand/collapse, localStorage persistence
- File operations: new file, new folder, rename, delete (confirm moved to trash), refresh
- Editor tabs: open file, deduplicate tabs, close tab, active tab styling
- Security: reject `..` paths, reject paths outside workspace
- All E2E tests PASS (`pnpm test:e2e`)

---

## Task 14: Performance validation and bundle size check

**Description:** Verify performance budgets and bundle size constraints from spec.

**Files to create/modify:**
- None (verification only)

**Verification commands:**
```bash
pnpm -r build
# Analyze bundle with webpack-bundle-analyzer or similar
# Manual performance testing with Chrome DevTools
```

**Constitution invariants:**
- **P5 (Performance)**: Monaco NOT in initial renderer bundle (verify with bundle analyzer)
- Explorer tree renders efficiently (performance budget: < 100ms for 100 files)

**Acceptance:**
- Bundle size increase ≤ 60KB for renderer (measure with bundle analyzer)
- Chrome DevTools Performance: Explorer tree renders 100 files in < 100ms
- Open folder operation completes in < 200ms (manual timing or E2E test assertion)
- No significant jank during tree scroll or interactions (maintain 60fps)
- Monaco NOT in initial bundle (verify with analyzer)

---

## Task 15: Final verification and documentation

**Description:** Run all verification commands, ensure all acceptance criteria pass, update documentation.

**Files to create/modify:**
- `README.md` (modify: add workspace/explorer feature description)
- `docs/architecture.md` (create or modify: add WorkspaceService + FsBrokerService diagram)

**Verification commands:**
```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm -r build
pnpm test:e2e
```

**Constitution invariants:**
- **P1 (Process isolation)**: All FS access via main process (audit complete)
- **P2 (Security defaults)**: No changes to contextIsolation, sandbox, nodeIntegration (audit complete)
- **P3 (Secrets)**: No secrets in workspace.json or file operations (audit complete)
- **P6 (Contracts-first)**: All IPC contracts in api-contracts with Zod (verify complete)

**Acceptance:**
- All 32 acceptance criteria from spec.md PASS (verified via E2E tests)
- TypeScript compiles with 0 errors
- ESLint passes with 0 errors
- All unit tests pass (coverage ≥ 80% for services and components)
- All E2E tests pass
- Build succeeds
- README updated with workspace/explorer feature description
- Architecture docs updated with WorkspaceService + FsBrokerService
- Manual QA checklist complete (25 items from plan Done definition):
  - Open folder on Windows (test native dialog)
  - Create file with special characters (spaces, unicode)
  - Delete file, verify moved to OS trash
  - Open folder with 1000+ files, verify no hang
  - Open folder, close app, reopen, verify workspace restored
  - Close folder, verify "No folder open" state
  - Refresh after external file change, verify tree updates

**Feature complete and ready to merge when all verification passes.**
