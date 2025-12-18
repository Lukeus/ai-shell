# 030-workspace-explorer

## Problem / Why

The ai-shell currently has a VS Code-like layout with placeholder content in the Primary Sidebar showing "No folder open". To become a functional IDE, users need the ability to:
1. Open a folder as a workspace (providing context for all IDE operations)
2. Browse files and directories in an Explorer tree view
3. Open files from the Explorer into editor tabs
4. Perform file operations (create, rename, delete) through UI interactions

Without a workspace model and Explorer, users cannot navigate projects, open files, or perform basic file management tasks. The workspace concept is also foundational for subsequent features (Monaco editor, terminal working directory, settings scope, version control integration).

This spec defines the workspace model and Explorer tree that integrate with the existing layout via brokered filesystem access (respecting **P1: Process Isolation** - only main process accesses OS).

## Goals

- Implement workspace model that tracks currently opened folder path
- Create Explorer tree component displaying files/folders hierarchally
- Enable file system operations via IPC broker (list directory, read file, create, rename, delete)
- Support opening files from Explorer into editor area (placeholder editor cards for now, Monaco integration is separate spec)
- Persist last opened workspace path across app sessions
- Provide "Open Folder" command accessible via File menu and Command Palette
- Wire Explorer to Activity Bar Explorer icon (already present in layout)
- Support refresh on external file system changes (manual refresh command for now)
- Define all IPC contracts in `packages/api-contracts` (Zod-first, respecting **P6: Contracts-first**)
- Implement file system broker in main process with security constraints (no arbitrary path access)

## Non-goals

- Monaco editor integration (handled in spec 040-monaco-lazy-editor)
- Multi-root workspaces (multiple folders open simultaneously) - future enhancement
- File watching with automatic refresh on external changes (manual refresh only for this spec)
- Drag-and-drop file operations within Explorer or from OS (future enhancement)
- File search/filtering within Explorer (Ctrl+P quick open is future spec)
- Version control integration (git status indicators in Explorer are future spec)
- Context menu for file operations (use inline buttons/icons for now)
- File permissions display or enforcement beyond OS-level checks
- Symlink resolution or special handling
- Hidden file visibility toggle (show all non-dotfiles by default)
- Binary file preview or image thumbnails in Explorer
- Folder size calculation or file metadata display beyond name/type

## User stories

**As a user**, I want to open a folder as a workspace, so I can browse and edit my project files.

**As a user**, I want to see a tree view of files and folders in the Explorer, so I can understand my project structure.

**As a user**, I want to click a file in the Explorer to open it in the editor area, so I can view and edit file contents.

**As a user**, I want to expand and collapse folders in the Explorer, so I can navigate large directory structures efficiently.

**As a user**, I want to create new files and folders via the Explorer, so I don't need to use external tools.

**As a user**, I want to rename and delete files via the Explorer, so I can manage my project structure.

**As a user**, I want my last opened workspace to reopen automatically on app launch, so I can continue where I left off.

**As a user**, I want to close the current workspace, so I can return to the "No folder open" state or open a different folder.

**As a developer**, I want file operations to go through a secure broker, so untrusted renderer code cannot access arbitrary filesystem paths.

## UX requirements

### Open Folder Flow

1. **Trigger Options**:
   - File menu → "Open Folder..." (Ctrl+K Ctrl+O / Cmd+K Cmd+O)
   - Explorer panel "Open Folder" button (when no workspace open)
   - Command Palette: "File: Open Folder"

2. **Dialog**:
   - Native OS folder picker dialog (Electron `dialog.showOpenDialog` with `properties: ['openDirectory']`)
   - On selection: Main process validates path exists and is readable, then sets as workspace

3. **Post-Open**:
   - Explorer panel loads folder contents
   - Status Bar updates to show workspace name (folder basename)
   - Window title updates to include workspace path

### Explorer Tree View

1. **Location**: Primary Sidebar when Activity Bar Explorer icon is active (already wired in layout)

2. **Header**:
   - Title: Workspace folder name (e.g., "MY-PROJECT")
   - Actions: 
     - Refresh icon button (manual refresh)
     - New File icon button
     - New Folder icon button
     - Collapse All icon button

3. **Tree Structure**:
   - Folders displayed with chevron icon (▶ collapsed, ▼ expanded)
   - Files displayed with file type icon (generic document icon for now, icon theme is future)
   - Indent: 16px per level
   - Folder sorting: Folders first (alphabetical), then files (alphabetical)
   - Dotfiles (`.git`, `.env`, `.DS_Store`) hidden by default

4. **Interactions**:
   - Single click file: Opens in editor area (focus editor)
   - Single click folder chevron: Expand/collapse folder
   - Hover: Highlight row with subtle background color
   - Right edge: Show inline action icons on hover (rename, delete)
   - Double click: Same as single click (consistent with modern IDEs)

5. **File Operations**:
   - **New File**: Click "New File" button → inline input appears at top of tree → type name → Enter creates file
   - **New Folder**: Click "New Folder" button → inline input appears → type name → Enter creates folder
   - **Rename**: Click rename icon on hover → inline input replaces name → Enter commits, Escape cancels
   - **Delete**: Click delete icon on hover → confirmation modal → confirm deletes file/folder recursively

6. **Empty States**:
   - No workspace open: "No folder open" message + "Open Folder" button
   - Empty workspace folder: "No files in workspace" message
   - Folder read error: "Unable to read folder" with error details + "Retry" button

### Editor Area Integration

For this spec, editor area shows placeholder cards (not Monaco):

1. **Tab Bar**: 
   - Horizontal tabs at top of editor area
   - Each open file = one tab (file basename as label)
   - Active tab has accent color underline
   - Close button (X) on each tab

2. **Editor Content Placeholder**:
   - Display: "File: {relative path}" + "Open in Monaco (not yet implemented)"
   - For this spec: Just confirm file opened; Monaco integration is spec 040

3. **Tab Interactions**:
   - Click tab: Focus that file
   - Click close (X): Remove tab
   - Opening same file again: Focus existing tab instead of creating duplicate

### Status Bar Updates

- Left section: 
  - No workspace: "No Folder Open" (already implemented)
  - Workspace open: Workspace folder name (e.g., "my-project")

## Functional requirements

### Workspace Model

1. **State Schema** (define in `packages/api-contracts/src/types/workspace.ts`):
   ```typescript
   const WorkspaceSchema = z.object({
     path: z.string(), // absolute path to workspace folder
     name: z.string(), // folder basename
   });

   type Workspace = z.infer<typeof WorkspaceSchema>;
   ```

2. **Storage**:
   - Main process stores current workspace path in `app.getPath('userData')/workspace.json`
   - Restore on app launch (if path still exists and is readable)
   - Clear on "Close Folder" command

3. **IPC Contract** (define in `packages/api-contracts/src/ipc/workspace.ts`):
   - `IPC_CHANNELS.WORKSPACE_OPEN`: Args: none. Opens native folder picker, returns `Workspace | null`
   - `IPC_CHANNELS.WORKSPACE_GET_CURRENT`: Returns current `Workspace | null`
   - `IPC_CHANNELS.WORKSPACE_CLOSE`: Clears workspace, returns void

### File System Broker

1. **Security Constraints**:
   - Broker only allows operations within current workspace path (path validation on every call)
   - Reject attempts to access parent directories via `..` (normalize and validate paths)
   - Read-only operations: list directory, read file contents
   - Write operations: create file/folder, rename, delete (with confirmation)
   - No arbitrary shell command execution or symlink creation

2. **IPC Contract** (define in `packages/api-contracts/src/ipc/fs-broker.ts`):
   ```typescript
   const FileEntrySchema = z.object({
     name: z.string(),
     path: z.string(), // absolute path
     type: z.enum(['file', 'directory']),
     size: z.number().optional(), // bytes, for files only
   });

   // IPC_CHANNELS.FS_READ_DIRECTORY
   // Args: { path: string } (absolute or relative to workspace)
   // Returns: { entries: FileEntry[] } (sorted: folders first, then files, alphabetical)

   // IPC_CHANNELS.FS_READ_FILE
   // Args: { path: string }
   // Returns: { content: string, encoding: 'utf-8' | 'binary' }

   // IPC_CHANNELS.FS_CREATE_FILE
   // Args: { path: string, content: string }
   // Returns: void (throws on error)

   // IPC_CHANNELS.FS_CREATE_DIRECTORY
   // Args: { path: string }
   // Returns: void

   // IPC_CHANNELS.FS_RENAME
   // Args: { oldPath: string, newPath: string }
   // Returns: void

   // IPC_CHANNELS.FS_DELETE
   // Args: { path: string, recursive: boolean }
   // Returns: void
   ```

3. **Error Handling**:
   - ENOENT (not found): Return user-friendly "File not found" error
   - EACCES (permission denied): Return "Permission denied" error with suggestion to check file permissions
   - EISDIR / ENOTDIR: Return type mismatch error
   - All errors returned as `{ success: false, error: { code: string, message: string } }`

4. **Implementation** (main process):
   - `apps/electron-shell/src/main/services/WorkspaceService.ts`: Manages workspace state
   - `apps/electron-shell/src/main/services/FsBrokerService.ts`: Implements file operations with validation
   - Use Node.js `fs.promises` API for async file operations
   - Path validation: `path.resolve()` and check starts with workspace path

### Explorer Component

1. **Component Structure** (`apps/electron-shell/src/renderer/components/explorer/`):
   - `ExplorerPanel.tsx`: Root component with header + tree + empty states
   - `FileTree.tsx`: Recursive tree rendering
   - `FileTreeNode.tsx`: Single file/folder row with expand/collapse, hover actions
   - `FileTreeContext.tsx`: React context for workspace state and file operations

2. **State Management**:
   - Workspace state: Current workspace from IPC
   - Expanded folders: Set of expanded folder paths (persist in localStorage per workspace)
   - Open editor tabs: Array of file paths
   - Active editor tab: Current file path

3. **Tree Rendering**:
   - Recursive: FileTreeNode renders children when folder is expanded
   - Lazy load: Only call `FS_READ_DIRECTORY` when folder expanded for first time (cache results)
   - Virtualization: Not required for this spec (assume < 1000 files visible at once)

4. **File Operations Flow**:
   - New File: Show inline input → validate name (not empty, no slashes) → call `FS_CREATE_FILE` with empty content → refresh parent folder in tree → open new file in editor
   - Rename: Show inline input → validate → call `FS_RENAME` → update tree node
   - Delete: Show confirmation modal ("Delete {name}?") → call `FS_DELETE` → remove from tree → close editor tab if open

### Activity Bar Integration

- Explorer icon (already in ActivityBar from spec 010) activates ExplorerPanel in Primary Sidebar
- Active state: Explorer icon highlighted when Activity Bar selection is 'explorer'

### Menu Integration

Add to main process menu template (`apps/electron-shell/src/main/menu.ts`):
- File → Open Folder... (Ctrl+K Ctrl+O)
- File → Close Folder (when workspace open)
- File → Refresh Explorer (F5)

## Security requirements

- **P1 (Process Isolation)**: All file system access via main process broker; renderer cannot touch Node.js `fs` directly
- **P2 (Security Defaults)**: No changes to contextIsolation, sandbox, nodeIntegration
- **P3 (Secrets)**: No secrets in workspace.json or file operations (secrets are handled by SecretsService)
- Path validation: Broker rejects paths outside workspace root (prevent directory traversal attacks)
- Input sanitization: File/folder names validated (reject null bytes, control characters, path separators)
- Confirmation for destructive operations: Delete shows modal confirmation (prevent accidental data loss)
- Error messages: No leaking of sensitive path info in errors (e.g., don't expose user home directory structure)
- Workspace path storage: Only path, no sensitive metadata (user/group ownership not stored)
- No arbitrary code execution: File operations are pure data I/O (no shell commands, no eval)

## Performance requirements

- **Open Folder**: Native dialog opens within 100ms; workspace loads within 200ms
- **Load Directory**: `FS_READ_DIRECTORY` for folder with 100 files completes within 100ms
- **Tree Render**: Initial render of 100 files completes within 100ms
- **Expand Folder**: Folder expansion (load children + render) completes within 150ms
- **Open File**: Click file → editor tab appears within 50ms (read file content within 200ms)
- **Refresh**: Manual refresh of entire tree completes within 500ms for 1000 files
- **File Operations**: Create, rename, delete complete within 100ms
- **Bundle Size**: Explorer components add ≤ 60KB to renderer bundle
- **Memory**: Explorer tree state uses ≤ 10MB for 10,000 files (assume 1KB per cached entry)
- **Responsiveness**: Tree scroll and interactions maintain 60fps (no jank)

## Acceptance criteria

1. ✅ Workspace and FS broker schemas defined in `packages/api-contracts` with Zod validation
2. ✅ IPC channels implemented: `WORKSPACE_OPEN`, `WORKSPACE_GET_CURRENT`, `WORKSPACE_CLOSE`, `FS_READ_DIRECTORY`, `FS_READ_FILE`, `FS_CREATE_FILE`, `FS_CREATE_DIRECTORY`, `FS_RENAME`, `FS_DELETE`
3. ✅ Main process WorkspaceService stores current workspace in `workspace.json`
4. ✅ Main process FsBrokerService validates all paths are within workspace root
5. ✅ File → Open Folder opens native OS folder picker dialog
6. ✅ Selecting folder in dialog loads workspace and displays Explorer tree
7. ✅ Last opened workspace persists across app restarts (if path still exists)
8. ✅ Explorer tree displays files and folders hierarchally with correct indentation
9. ✅ Folders sorted before files; both alphabetically sorted
10. ✅ Clicking folder chevron expands/collapses folder
11. ✅ Clicking file opens placeholder editor tab
12. ✅ Opening same file twice focuses existing tab instead of creating duplicate
13. ✅ Editor tab bar displays open files with close buttons
14. ✅ Status Bar shows workspace folder name when workspace is open
15. ✅ Window title includes workspace path when workspace is open
16. ✅ New File button shows inline input, creates file on Enter, refreshes tree
17. ✅ New Folder button shows inline input, creates folder on Enter, refreshes tree
18. ✅ Rename icon shows inline input, renames file/folder on Enter, updates tree
19. ✅ Delete icon shows confirmation modal, deletes file/folder on confirm, removes from tree
20. ✅ Refresh button reloads entire tree from disk
21. ✅ Close Folder command clears workspace, returns to "No folder open" state
22. ✅ Expanded folder state persists per workspace in localStorage
23. ✅ Dotfiles (starting with `.`) hidden from tree by default
24. ✅ FS broker rejects paths with `..` or outside workspace root (security test)
25. ✅ Empty workspace shows "No files in workspace" message
26. ✅ File read errors display "Unable to read folder" with retry button
27. ✅ TypeScript compiles with 0 errors (`pnpm -r typecheck`)
28. ✅ ESLint passes with 0 errors (`pnpm -r lint`)
29. ✅ Unit tests for WorkspaceService (main process)
30. ✅ Unit tests for FsBrokerService with path validation (main process)
31. ✅ Unit tests for Explorer components (renderer)
32. ✅ Playwright E2E test: open folder, browse tree, create file, open file, rename, delete, close workspace

## Out of scope / Future work

- **Monaco Editor Integration**: Opening files displays Monaco editor instead of placeholder (spec 040-monaco-lazy-editor)
- **Multi-Root Workspaces**: Opening multiple folders simultaneously (future spec)
- **File Watching**: Automatic tree refresh on external file system changes (fs.watch) (future enhancement)
- **Drag-and-Drop**: Drag files within Explorer or from OS to import (future enhancement)
- **Context Menus**: Right-click context menus for file operations (future enhancement, use inline buttons for now)
- **Quick Open**: Ctrl+P fuzzy file search (separate spec)
- **File Search**: Ctrl+Shift+F global text search (separate spec)
- **Version Control Integration**: Git status indicators (modified, staged, untracked) in Explorer (future spec)
- **File Icons Theme**: Custom file type icons (currently generic document icon) (future spec)
- **Hidden Files Toggle**: Show/hide dotfiles setting (future enhancement)
- **File Metadata Display**: Size, modified date, permissions in tree or details pane (future enhancement)
- **Symlink Handling**: Special rendering or resolution of symbolic links (future enhancement)
- **Binary File Detection**: Prevent opening binary files in text editor with warning (future enhancement)
- **Large Directory Handling**: Virtualized scrolling for folders with 10,000+ files (future optimization)
- **Workspace Settings**: Per-workspace overrides of global settings (future spec)
- **Breadcrumbs**: File path breadcrumbs in editor area (part of Monaco spec)

## Open questions

1. Should we limit the depth of the tree rendering (e.g., max 10 levels deep) to prevent performance issues with deeply nested structures?
   - **Decision**: No hard limit for this spec. Assume reasonable project structures (< 10 levels). Add warning log if depth > 20.

2. Should dotfiles be hidden by default, or should there be a toggle in Explorer header?
   - **Decision**: Hidden by default. Toggle is future enhancement (settings option).

3. Should we cache `FS_READ_DIRECTORY` results, or always read fresh from disk?
   - **Decision**: Cache on first expand; only refresh on explicit Refresh button or file operation (create/rename/delete). Automatic watching is future spec.

4. Should rename/delete use inline actions (icons on hover) or context menus?
   - **Decision**: Inline icons on hover for this spec. Context menus are future enhancement.

5. Should we support undo for delete operations (move to trash vs permanent delete)?
   - **Decision**: Use OS trash/recycle bin (`shell.trashItem()` in Electron) instead of permanent delete. Safer and matches user expectations.

6. Should clicking a file in Explorer open it in a new tab or replace the active tab?
   - **Decision**: Always open in new tab. Tab management (pinning, preview mode) is future enhancement.

7. Should we show a loading spinner when expanding large folders?
   - **Decision**: Yes, show spinner next to chevron during `FS_READ_DIRECTORY` call.

8. Should file size be displayed in the tree?
   - **Decision**: No, keep tree minimal. File metadata (size, date) is future enhancement (details pane or hover tooltip).
