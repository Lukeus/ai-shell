# 030-workspace-explorer — Technical Plan

## Architecture changes

This feature introduces two new main-process services (WorkspaceService and FsBrokerService) and a new renderer component tree (Explorer components), while preserving strict process isolation.

### Main Process (Shell Kernel)
**New services:**
- `WorkspaceService`: Singleton managing workspace state (current folder path, persistence)
  - Stores workspace in `app.getPath('userData')/workspace.json`
  - Restores last workspace on app launch (validates path still exists)
  - Handles native folder picker dialog via `dialog.showOpenDialog`
- `FsBrokerService`: Singleton providing secure filesystem broker
  - Path validation: All operations scoped to workspace root (rejects `..`, absolute paths outside workspace)
  - Operations: readDirectory, readFile, createFile, createDirectory, rename, delete (via OS trash)
  - Uses Node.js `fs.promises` for async I/O
  - Error mapping: ENOENT → "File not found", EACCES → "Permission denied"

**Integration points:**
- IPC handlers register workspace and fs-broker channels in `ipc-handlers.ts`
- Menu template (`menu.ts`) gains File → Open Folder, Close Folder, Refresh Explorer

### Renderer Process
**New component tree:**
- `components/explorer/` directory:
  - `ExplorerPanel.tsx`: Root component, renders header + FileTree + empty states
  - `FileTree.tsx`: Recursive tree container, manages expanded folders state
  - `FileTreeNode.tsx`: Individual file/folder row with chevron, hover actions (rename, delete icons)
  - `FileTreeContext.tsx`: React context providing workspace state, IPC calls, editor tab state
  - `ConfirmDeleteModal.tsx`: Modal for delete confirmation (destructive operations)
  - `InlineInput.tsx`: Reusable inline input for new file/folder, rename operations

**New editor components:**
- `components/editor/` directory:
  - `EditorArea.tsx`: Manages tab bar + active editor content
  - `EditorTabBar.tsx`: Horizontal tabs with close buttons
  - `EditorPlaceholder.tsx`: Shows "File: {path}" until Monaco integration (spec 040)

**State management:**
- No global state library (use React context + useState for local state)
- `FileTreeContext` provides:
  - Current workspace (`Workspace | null`)
  - Expanded folders (`Set<string>`, persisted to localStorage per workspace)
  - Open editor tabs (`string[]` of file paths)
  - Active tab index (`number`)
  - File operation handlers (createFile, rename, delete, openFile)

**Existing component modifications:**
- `ExplorerPanel.tsx` (currently placeholder): Replace with new implementation
- `App.tsx`: Add EditorArea component to layout's editor region
- `StatusBar.tsx`: Update left section to show workspace name when workspace is open

### Process isolation verification
- **P1 compliance**: All filesystem access via main process broker (renderer has zero Node.js access)
- **P2 compliance**: No changes to contextIsolation, sandbox, nodeIntegration
- **P3 compliance**: No secrets in workspace.json or file contents (secrets via SecretsService only)

## Contracts (api-contracts updates)

All contracts defined in `packages/api-contracts/src/` BEFORE implementation.

### New files to create:

#### `types/workspace.ts`
```typescript
import { z } from 'zod';

/**
 * Workspace schema representing an opened folder.
 * 
 * @remarks
 * A workspace is a single folder opened in the IDE. Multi-root workspaces
 * (multiple folders) are not supported in this spec.
 */
export const WorkspaceSchema = z.object({
  /** Absolute path to workspace folder */
  path: z.string(),
  
  /** Workspace display name (folder basename) */
  name: z.string(),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;
```

#### `types/fs-broker.ts`
```typescript
import { z } from 'zod';

/**
 * File entry type returned by readDirectory operations.
 */
export const FileEntrySchema = z.object({
  /** File or folder name (basename only) */
  name: z.string(),
  
  /** Absolute path to file/folder */
  path: z.string(),
  
  /** Entry type */
  type: z.enum(['file', 'directory']),
  
  /** File size in bytes (files only, optional for directories) */
  size: z.number().optional(),
});

export type FileEntry = z.infer<typeof FileEntrySchema>;

/**
 * Request to read a directory's contents.
 */
export const ReadDirectoryRequestSchema = z.object({
  /** Path to directory (absolute or relative to workspace root) */
  path: z.string(),
});

export type ReadDirectoryRequest = z.infer<typeof ReadDirectoryRequestSchema>;

/**
 * Response from readDirectory operation.
 */
export const ReadDirectoryResponseSchema = z.object({
  /** Array of file entries (sorted: folders first, then files, both alphabetical) */
  entries: z.array(FileEntrySchema),
});

export type ReadDirectoryResponse = z.infer<typeof ReadDirectoryResponseSchema>;

/**
 * Request to read a file's contents.
 */
export const ReadFileRequestSchema = z.object({
  /** Path to file (absolute or relative to workspace root) */
  path: z.string(),
});

export type ReadFileRequest = z.infer<typeof ReadFileRequestSchema>;

/**
 * Response from readFile operation.
 */
export const ReadFileResponseSchema = z.object({
  /** File content as string */
  content: z.string(),
  
  /** Encoding used to read the file */
  encoding: z.enum(['utf-8', 'binary']),
});

export type ReadFileResponse = z.infer<typeof ReadFileResponseSchema>;

/**
 * Request to create a new file.
 */
export const CreateFileRequestSchema = z.object({
  /** Path to new file (absolute or relative to workspace root) */
  path: z.string(),
  
  /** Initial file content (empty string for empty file) */
  content: z.string().default(''),
});

export type CreateFileRequest = z.infer<typeof CreateFileRequestSchema>;

/**
 * Request to create a new directory.
 */
export const CreateDirectoryRequestSchema = z.object({
  /** Path to new directory (absolute or relative to workspace root) */
  path: z.string(),
});

export type CreateDirectoryRequest = z.infer<typeof CreateDirectoryRequestSchema>;

/**
 * Request to rename a file or directory.
 */
export const RenameRequestSchema = z.object({
  /** Current path (absolute or relative to workspace root) */
  oldPath: z.string(),
  
  /** New path (absolute or relative to workspace root) */
  newPath: z.string(),
});

export type RenameRequest = z.infer<typeof RenameRequestSchema>;

/**
 * Request to delete a file or directory.
 */
export const DeleteRequestSchema = z.object({
  /** Path to delete (absolute or relative to workspace root) */
  path: z.string(),
  
  /** If true, delete directories recursively */
  recursive: z.boolean().default(true),
});

export type DeleteRequest = z.infer<typeof DeleteRequestSchema>;

/**
 * Error response for file system operations.
 */
export const FsErrorSchema = z.object({
  /** Error code (e.g., 'ENOENT', 'EACCES', 'EISDIR') */
  code: z.string(),
  
  /** User-friendly error message */
  message: z.string(),
});

export type FsError = z.infer<typeof FsErrorSchema>;
```

#### Update `ipc-channels.ts`
Add workspace and fs-broker channels:
```typescript
export const IPC_CHANNELS = {
  // ... existing channels ...
  
  // Workspace management
  /** Open native folder picker and set workspace */
  WORKSPACE_OPEN: 'workspace:open',
  
  /** Get current workspace (null if no folder open) */
  WORKSPACE_GET_CURRENT: 'workspace:get-current',
  
  /** Close current workspace */
  WORKSPACE_CLOSE: 'workspace:close',
  
  // File system broker (workspace-scoped)
  /** Read directory contents */
  FS_READ_DIRECTORY: 'fs:read-directory',
  
  /** Read file contents */
  FS_READ_FILE: 'fs:read-file',
  
  /** Create new file */
  FS_CREATE_FILE: 'fs:create-file',
  
  /** Create new directory */
  FS_CREATE_DIRECTORY: 'fs:create-directory',
  
  /** Rename file or directory */
  FS_RENAME: 'fs:rename',
  
  /** Delete file or directory (moves to OS trash) */
  FS_DELETE: 'fs:delete',
} as const;
```

#### Update `preload-api.ts`
Expose workspace and fs-broker APIs via contextBridge:
```typescript
export interface PreloadAPI {
  // ... existing APIs ...
  
  // Workspace APIs
  workspace: {
    /** Open native folder picker and set workspace */
    open: () => Promise<Workspace | null>;
    
    /** Get current workspace (null if no folder open) */
    getCurrent: () => Promise<Workspace | null>;
    
    /** Close current workspace */
    close: () => Promise<void>;
  };
  
  // File system broker APIs (workspace-scoped only)
  fs: {
    /** Read directory contents */
    readDirectory: (request: ReadDirectoryRequest) => Promise<ReadDirectoryResponse>;
    
    /** Read file contents */
    readFile: (request: ReadFileRequest) => Promise<ReadFileResponse>;
    
    /** Create new file */
    createFile: (request: CreateFileRequest) => Promise<void>;
    
    /** Create new directory */
    createDirectory: (request: CreateDirectoryRequest) => Promise<void>;
    
    /** Rename file or directory */
    rename: (request: RenameRequest) => Promise<void>;
    
    /** Delete file or directory (moves to OS trash) */
    delete: (request: DeleteRequest) => Promise<void>;
  };
}
```

#### Update `index.ts`
Export new types:
```typescript
export * from './types/workspace';
export * from './types/fs-broker';
```

### Contract validation
All contracts use Zod for runtime validation. Main process IPC handlers validate requests before processing; invalid requests are rejected with Zod validation errors.

## IPC + process boundaries

### Workspace IPC flow

**WORKSPACE_OPEN:**
1. Renderer calls `window.api.workspace.open()`
2. Main process opens native dialog (`dialog.showOpenDialog({ properties: ['openDirectory'] })`)
3. User selects folder (or cancels)
4. If selected: Main validates path exists and is readable
5. Main creates Workspace object: `{ path: absolutePath, name: path.basename(absolutePath) }`
6. Main persists to `workspace.json` via WorkspaceService
7. Main returns Workspace object to renderer (or null if cancelled)

**WORKSPACE_GET_CURRENT:**
1. Renderer calls `window.api.workspace.getCurrent()`
2. Main reads from WorkspaceService cache (or loads from `workspace.json`)
3. Main validates path still exists; if not, clears workspace and returns null
4. Main returns Workspace object (or null)

**WORKSPACE_CLOSE:**
1. Renderer calls `window.api.workspace.close()`
2. Main clears workspace in WorkspaceService
3. Main deletes `workspace.json` file
4. Main returns void

### File system broker IPC flow

**FS_READ_DIRECTORY:**
1. Renderer calls `window.api.fs.readDirectory({ path: './src' })`
2. Main validates request with `ReadDirectoryRequestSchema.parse()`
3. Main resolves path relative to workspace root (or validates absolute path is within workspace)
4. Main calls `fs.promises.readdir(path, { withFileTypes: true })`
5. Main filters out dotfiles (names starting with `.`)
6. Main sorts: folders first (alphabetical), then files (alphabetical)
7. Main maps to FileEntry[] with name, path, type, size (for files)
8. Main returns `{ entries: FileEntry[] }`
9. On error: Catch and return FsError with code + message

**FS_READ_FILE:**
1. Renderer calls `window.api.fs.readFile({ path: './README.md' })`
2. Main validates request, resolves path, checks within workspace
3. Main calls `fs.promises.readFile(path, 'utf-8')`
4. Main returns `{ content: string, encoding: 'utf-8' }`
5. On error: Catch and return FsError

**FS_CREATE_FILE:**
1. Renderer calls `window.api.fs.createFile({ path: './newfile.ts', content: '' })`
2. Main validates request, resolves path, checks within workspace
3. Main validates filename (no null bytes, control chars, path separators)
4. Main calls `fs.promises.writeFile(path, content, 'utf-8')`
5. Main returns void (success)
6. On error: Catch and return FsError

**FS_CREATE_DIRECTORY:**
1. Renderer calls `window.api.fs.createDirectory({ path: './newfolder' })`
2. Main validates request, resolves path, checks within workspace
3. Main validates directory name
4. Main calls `fs.promises.mkdir(path, { recursive: true })`
5. Main returns void
6. On error: Catch and return FsError

**FS_RENAME:**
1. Renderer calls `window.api.fs.rename({ oldPath: './old.txt', newPath: './new.txt' })`
2. Main validates request, resolves both paths, checks both within workspace
3. Main validates new name
4. Main calls `fs.promises.rename(oldPath, newPath)`
5. Main returns void
6. On error: Catch and return FsError

**FS_DELETE:**
1. Renderer calls `window.api.fs.delete({ path: './file.txt', recursive: true })`
2. Main validates request, resolves path, checks within workspace
3. Main calls `shell.trashItem(path)` (Electron API to move to OS trash/recycle bin)
4. Main returns void
5. On error: Catch and return FsError

### Security boundaries

**Path validation (critical security invariant):**
- Every FS operation calls `validatePathWithinWorkspace(path)` BEFORE disk access
- Validation steps:
  1. Resolve path to absolute: `path.resolve(workspaceRoot, requestedPath)`
  2. Normalize to remove `..`, `.`, redundant separators: `path.normalize()`
  3. Check starts with workspace root: `resolvedPath.startsWith(workspaceRoot)`
  4. Reject if validation fails: throw FsError with code 'SECURITY_VIOLATION'

**Filename validation:**
- Reject null bytes (`\0`)
- Reject control characters (ASCII 0-31)
- Reject path separators in filename (`/`, `\`, `:` on Windows)
- Max length: 255 characters (typical filesystem limit)

**Error sanitization:**
- Do not leak full paths in error messages sent to renderer
- Replace absolute paths with relative paths from workspace root
- Example: `/Users/alice/secret/file.txt` → `secret/file.txt`

## UI components and routes

### Component hierarchy

```
App.tsx
├── ShellLayout (from spec 010)
│   ├── ActivityBar (existing)
│   ├── PrimarySidebar (existing container)
│   │   └── ExplorerPanel (NEW) (when activity='explorer')
│   │       ├── ExplorerHeader
│   │       │   ├── Workspace name
│   │       │   └── Action buttons (Refresh, New File, New Folder, Collapse All)
│   │       ├── FileTree
│   │       │   └── FileTreeNode (recursive)
│   │       │       ├── Chevron (folders only)
│   │       │       ├── Icon (file/folder)
│   │       │       ├── Label (editable inline for rename)
│   │       │       └── Action icons (rename, delete) (on hover)
│   │       ├── InlineInput (for new file/folder, rename)
│   │       └── Empty states (no workspace, empty folder, error)
│   ├── EditorArea (NEW)
│   │   ├── EditorTabBar
│   │   │   └── EditorTab[] (file basename + close button)
│   │   └── EditorPlaceholder (active tab content)
│   │       └── "File: {relativePath}" + "Monaco not implemented"
│   ├── SecondarySidebar (existing, unchanged)
│   ├── BottomPanel (existing, unchanged)
│   └── StatusBar (existing, UPDATE left section)
└── ConfirmDeleteModal (portal, conditional render)
```

### FileTreeContext API

```typescript
interface FileTreeContextValue {
  // Workspace state
  workspace: Workspace | null;
  loadWorkspace: () => Promise<void>;
  openWorkspace: () => Promise<void>;
  closeWorkspace: () => Promise<void>;
  
  // Tree state
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  collapseAll: () => void;
  
  // Editor tabs state
  openTabs: string[]; // file paths
  activeTabIndex: number;
  openFile: (path: string) => void;
  closeTab: (index: number) => void;
  setActiveTab: (index: number) => void;
  
  // File operations
  createFile: (parentPath: string, name: string) => Promise<void>;
  createFolder: (parentPath: string, name: string) => Promise<void>;
  renameItem: (oldPath: string, newName: string) => Promise<void>;
  deleteItem: (path: string) => Promise<void>;
  refresh: () => Promise<void>;
  
  // Directory content cache
  directoryCache: Map<string, FileEntry[]>;
  loadDirectory: (path: string) => Promise<FileEntry[]>;
}
```

### State persistence

**Expanded folders (localStorage, per workspace):**
- Key: `explorer:expanded:${workspace.path.replace(/[^a-zA-Z0-9]/g, '_')}`
- Value: JSON array of expanded folder paths
- Save on every toggle, restore on workspace load

**Open tabs (localStorage, per workspace):**
- Key: `editor:tabs:${workspaceKey}`
- Value: JSON object `{ openTabs: string[], activeTabIndex: number }`
- Save on every tab open/close/switch, restore on workspace load

## Data model changes

### New main process state

**WorkspaceService:**
- `currentWorkspace: Workspace | null` (in-memory cache)
- Persisted to `app.getPath('userData')/workspace.json`:
  ```json
  {
    "path": "/Users/alice/projects/my-app",
    "name": "my-app"
  }
  ```

**FsBrokerService:**
- No persistent state (stateless broker)
- All operations validate against WorkspaceService.currentWorkspace

### New renderer state

**FileTreeContext:**
- `workspace: Workspace | null` (from IPC)
- `expandedFolders: Set<string>` (persisted to localStorage)
- `openTabs: string[]` (persisted to localStorage)
- `activeTabIndex: number` (persisted to localStorage)
- `directoryCache: Map<string, FileEntry[]>` (in-memory only, cleared on refresh)

### No database changes
This feature does not require a database. All state is ephemeral (in-memory + localStorage) or persisted to JSON files.

## Failure modes + recovery

### Workspace file corrupted
- **Symptom:** `workspace.json` has invalid JSON or fails Zod validation
- **Detection:** WorkspaceService catches parse error on `getWorkspace()`
- **Recovery:** Log warning, return null workspace, delete corrupted file, show "No folder open" state
- **User impact:** User must re-open workspace (one-time inconvenience)

### Workspace path no longer exists
- **Symptom:** Workspace path in `workspace.json` no longer exists on disk (folder deleted externally)
- **Detection:** WorkspaceService validates path with `fs.existsSync()` on app launch and `getCurrent()`
- **Recovery:** Clear workspace, delete `workspace.json`, return null
- **User impact:** Show "No folder open" state with message "Workspace path no longer exists"

### File system operation fails (EACCES permission denied)
- **Symptom:** User lacks read/write permissions for file/folder
- **Detection:** FsBrokerService catches fs.promises error
- **Recovery:** Return FsError with code 'EACCES' and message "Permission denied. Check file permissions."
- **User impact:** Show error toast/notification, operation fails, tree state unchanged

### File system operation fails (ENOENT not found)
- **Symptom:** File/folder deleted externally between listing and operation
- **Detection:** FsBrokerService catches fs.promises error
- **Recovery:** Return FsError with code 'ENOENT' and message "File not found. Refresh the explorer."
- **User impact:** Show error notification with "Retry" or "Refresh" button

### Directory too large (10,000+ files)
- **Symptom:** `readDirectory` returns massive array, tree render is slow
- **Detection:** ReadDirectoryResponse.entries.length > 10,000 (logged in main process)
- **Recovery:** No special handling in this spec (future: virtualization)
- **User impact:** Slow render (acceptable for rare edge case), warn user in console log

### Path traversal attack attempt
- **Symptom:** Renderer sends path with `..` or absolute path outside workspace
- **Detection:** FsBrokerService.validatePathWithinWorkspace() rejects path
- **Recovery:** Return FsError with code 'SECURITY_VIOLATION' and message "Invalid path"
- **User impact:** Operation fails silently (attack attempt blocked)

### Renderer crash during file operation
- **Symptom:** Renderer crashes while waiting for FS operation IPC response
- **Detection:** Electron detects renderer crash, main process completes operation
- **Recovery:** Main process operation completes normally, renderer state lost on restart
- **User impact:** File operation succeeds (e.g., file created), but renderer doesn't update until refresh

## Testing strategy

### Unit tests (main process)

**WorkspaceService tests** (`apps/electron-shell/src/main/services/WorkspaceService.test.ts`):
- ✅ getInstance() returns singleton
- ✅ getWorkspace() returns null when no workspace set
- ✅ setWorkspace() persists to workspace.json
- ✅ setWorkspace() validates path exists
- ✅ getWorkspace() restores from workspace.json on restart (mock fs.readFileSync)
- ✅ getWorkspace() returns null and clears file if path no longer exists
- ✅ getWorkspace() handles corrupted JSON (returns null, logs warning)
- ✅ clearWorkspace() deletes workspace.json
- ✅ openWorkspace() opens native dialog and sets workspace (mock dialog.showOpenDialog)

**FsBrokerService tests** (`apps/electron-shell/src/main/services/FsBrokerService.test.ts`):
- ✅ readDirectory() returns sorted entries (folders first, alphabetical)
- ✅ readDirectory() filters out dotfiles
- ✅ readDirectory() rejects path with `..`
- ✅ readDirectory() rejects absolute path outside workspace
- ✅ readDirectory() returns FsError on ENOENT
- ✅ readDirectory() returns FsError on EACCES
- ✅ readFile() reads UTF-8 file content
- ✅ readFile() validates path within workspace
- ✅ createFile() creates file with content
- ✅ createFile() rejects invalid filename (null byte, path separator)
- ✅ createDirectory() creates directory recursively
- ✅ rename() renames file/folder
- ✅ rename() validates both paths within workspace
- ✅ delete() moves to OS trash (mock shell.trashItem)
- ✅ delete() validates path within workspace

**IPC handler tests** (`apps/electron-shell/src/main/ipc-handlers.test.ts`):
- ✅ WORKSPACE_OPEN handler calls WorkspaceService.openWorkspace()
- ✅ WORKSPACE_GET_CURRENT handler calls WorkspaceService.getWorkspace()
- ✅ WORKSPACE_CLOSE handler calls WorkspaceService.clearWorkspace()
- ✅ FS_READ_DIRECTORY handler validates request with Zod, calls FsBrokerService
- ✅ FS_CREATE_FILE handler validates request, calls FsBrokerService
- ✅ IPC handlers reject invalid requests with Zod validation errors

### Unit tests (renderer)

**FileTreeContext tests** (`apps/electron-shell/src/renderer/components/explorer/FileTreeContext.test.tsx`):
- ✅ Provides null workspace initially
- ✅ loadWorkspace() fetches workspace from IPC
- ✅ openWorkspace() calls IPC and updates state
- ✅ toggleFolder() expands/collapses folder
- ✅ expandedFolders persists to localStorage
- ✅ openFile() adds to openTabs if not already open
- ✅ openFile() focuses existing tab if already open
- ✅ closeTab() removes from openTabs
- ✅ createFile() calls IPC, refreshes parent directory, opens new file
- ✅ deleteItem() shows confirmation, calls IPC, closes tab if open

**FileTree tests** (`apps/electron-shell/src/renderer/components/explorer/FileTree.test.tsx`):
- ✅ Renders empty state when no workspace
- ✅ Renders file/folder list when workspace loaded
- ✅ Folders sorted before files, both alphabetical
- ✅ Clicking folder chevron expands/collapses
- ✅ Clicking file calls openFile()
- ✅ Hover shows rename/delete icons
- ✅ Dotfiles not rendered

**ExplorerPanel tests** (`apps/electron-shell/src/renderer/components/explorer/ExplorerPanel.test.tsx`):
- ✅ Shows "No folder open" when no workspace
- ✅ Shows "Open Folder" button that calls openWorkspace()
- ✅ Shows workspace name in header when workspace loaded
- ✅ Refresh button calls refresh()
- ✅ New File button shows inline input
- ✅ New Folder button shows inline input

**EditorTabBar tests** (`apps/electron-shell/src/renderer/components/editor/EditorTabBar.test.tsx`):
- ✅ Renders tabs for open files
- ✅ Active tab has accent underline
- ✅ Clicking tab calls setActiveTab()
- ✅ Clicking close (X) calls closeTab()

### Integration tests (E2E with Playwright)

**Workspace flow** (`test/e2e/workspace.spec.ts`):
- ✅ Open folder: Click File → Open Folder, select folder, explorer loads
- ✅ Close folder: Click File → Close Folder, explorer shows "No folder open"
- ✅ Persist workspace: Open folder, restart app, workspace still open

**Explorer tree** (`test/e2e/explorer.spec.ts`):
- ✅ Tree displays files and folders
- ✅ Folders sorted before files
- ✅ Clicking folder expands/collapses
- ✅ Expanded state persists across refresh (localStorage)

**File operations** (`test/e2e/file-operations.spec.ts`):
- ✅ New File: Click button, type name, press Enter, file created and opened
- ✅ New Folder: Click button, type name, press Enter, folder created
- ✅ Rename: Click rename icon, type new name, press Enter, item renamed in tree
- ✅ Delete: Click delete icon, confirm modal, file deleted and tab closed
- ✅ Refresh: Manually create file externally, click Refresh, file appears in tree

**Editor tabs** (`test/e2e/editor-tabs.spec.ts`):
- ✅ Clicking file opens tab
- ✅ Opening same file twice focuses existing tab (no duplicate)
- ✅ Closing tab removes from tab bar
- ✅ Tab shows file basename as label
- ✅ Active tab has accent underline

**Security** (`test/e2e/security.spec.ts`):
- ✅ Cannot access path outside workspace (mock IPC call with `../../etc/passwd`, verify rejection)
- ✅ Cannot use `..` in path (mock IPC call, verify rejection)

### Verification commands

After each task implementation:
```bash
# TypeScript compilation
pnpm -r typecheck

# Linting
pnpm -r lint

# Unit tests
pnpm -r test

# Build (ensure no bundle size regression)
pnpm -r build

# E2E tests (after all tasks complete)
pnpm test:e2e
```

## Rollout / migration

### No breaking changes
This feature is additive:
- No existing APIs modified
- No existing components changed (except ExplorerPanel replacement)
- No user data migration required

### First launch
1. User opens app → no workspace loaded (workspace.json doesn't exist yet)
2. ExplorerPanel shows "No folder open" state
3. User clicks "Open Folder" → native dialog → workspace loaded
4. workspace.json created in userData directory

### Existing users (if settings.json exists)
- No migration needed (workspace is independent of settings)
- workspace.json is a new file

### Rollback plan
If critical bug discovered post-merge:
1. Revert commit range for this feature
2. User impact: Explorer shows placeholder "Feature disabled", File menu disabled
3. workspace.json remains on disk (no data loss)
4. Future fix can be merged without migration

## Risks + mitigations

### Risk: Path traversal vulnerability
- **Impact:** Renderer could access files outside workspace (read/write sensitive data)
- **Likelihood:** Medium (requires attacker to control renderer or exploit XSS)
- **Mitigation:** 
  - Path validation in every FS operation (normalize, check starts with workspace root)
  - Unit tests for `..` and absolute path rejection
  - Security E2E test attempting traversal
  - Code review focused on path validation

### Risk: Performance issues with large directories
- **Impact:** Slow tree render or hang for folders with 10,000+ files
- **Likelihood:** Low (most projects < 1000 files per directory)
- **Mitigation:**
  - Log warning if directory > 10,000 files
  - Future spec: Virtualized scrolling (react-window)
  - Accept slow render as edge case for this spec

### Risk: Race condition in file operations
- **Impact:** File deleted externally between listing and operation → ENOENT error
- **Likelihood:** Medium (common in multi-user environments, version control, build tools)
- **Mitigation:**
  - All FS operations return FsError on failure (don't crash)
  - Show error notification with "Refresh" button
  - Refresh operation clears cache and reloads tree

### Risk: Renderer crash during IPC call
- **Impact:** File operation succeeds in main, but renderer doesn't update (orphaned state)
- **Likelihood:** Low (renderer crashes are rare)
- **Mitigation:**
  - Reload workspace on renderer restart (always fetch fresh state from main)
  - Manual Refresh button allows user to sync state

### Risk: localStorage quota exceeded
- **Impact:** Cannot persist expanded folders or open tabs (quota ~5-10MB)
- **Likelihood:** Very low (expanded folders + tabs ~10KB for typical project)
- **Mitigation:**
  - Catch localStorage.setItem() quota errors, log warning, continue without persistence
  - User impact: Expanded state not restored (minor inconvenience)

### Risk: Dotfile filtering too aggressive
- **Impact:** User needs to access `.github`, `.vscode` folders but they're hidden
- **Likelihood:** Medium (valid use case)
- **Mitigation:**
  - Document dotfile behavior in spec (hidden by default)
  - Future enhancement: Settings toggle to show dotfiles
  - Accept limitation for this spec

### Risk: Delete moves to trash, but trash is full or disabled
- **Impact:** Delete operation fails with error
- **Likelihood:** Low (OS trash rarely full)
- **Mitigation:**
  - shell.trashItem() returns error if trash fails
  - Show error notification: "Unable to delete. Trash may be full or disabled."
  - Do not implement permanent delete fallback (too dangerous)

## Done definition

Feature is complete when:

### Functional acceptance criteria (32 from spec)
1. ✅ All 32 acceptance criteria in spec.md pass (automated E2E tests)

### Code quality
2. ✅ TypeScript compiles with 0 errors (`pnpm -r typecheck`)
3. ✅ ESLint passes with 0 errors (`pnpm -r lint`)
4. ✅ Unit test coverage ≥ 80% for WorkspaceService, FsBrokerService, FileTreeContext
5. ✅ E2E tests pass for workspace, explorer, file operations, editor tabs, security

### Documentation
6. ✅ JSDoc comments for all public APIs in contracts
7. ✅ README updated with workspace/explorer feature description
8. ✅ Architecture diagram updated to show WorkspaceService + FsBrokerService

### Performance validation
9. ✅ Explorer tree renders 100 files in < 100ms (Chrome DevTools Performance)
10. ✅ Open folder operation completes in < 200ms (E2E test assertion)
11. ✅ Bundle size increase ≤ 60KB (renderer bundle analysis)

### Security validation
12. ✅ Path traversal test passes (attempts to access `../../../etc/passwd` rejected)
13. ✅ Code review confirms path validation in all FS operations
14. ✅ No Node.js APIs exposed to renderer (audit preload.ts, contextBridge)

### Constitution compliance
15. ✅ P1 (Process Isolation): All FS access via main process broker
16. ✅ P2 (Security Defaults): No changes to contextIsolation, sandbox, nodeIntegration
17. ✅ P3 (Secrets): No secrets in workspace.json or file operations
18. ✅ P6 (Contracts-first): All IPC contracts defined in packages/api-contracts with Zod

### Manual QA checklist
19. ✅ Open folder on Windows, macOS, Linux (test native dialog)
20. ✅ Create file with special characters in name (spaces, unicode)
21. ✅ Delete file, verify moved to OS trash (not permanently deleted)
22. ✅ Open folder with 1000+ files, verify no hang or crash
23. ✅ Open folder, close app, reopen, verify workspace restored
24. ✅ Close folder, verify returns to "No folder open" state
25. ✅ Refresh explorer after external file change, verify tree updates

When all 25 items pass, feature is ready to merge to main.
