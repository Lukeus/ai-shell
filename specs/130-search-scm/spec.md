# Workspace Search + Source Control Panels

## Problem / Why
Users need VS Code-style Search and Source Control panels to navigate large workspaces
and manage Git changes without leaving the shell. Today, the activity bar has the icons,
but there are no corresponding panels or backend workflows to power search and Git tasks.

## Goals
- Add a Search panel that matches VS Code behavior (query, replace, regex, match case,
  whole word, include/exclude, results grouped by file).
- Add a Source Control panel that matches VS Code behavior (status, stage/unstage,
  commit, refresh).
- Implement backend support via main-process Git and search execution, respecting
  process isolation and contract-first IPC.
- Keep UI consistent with Tailwind 4 tokens and existing VS Code-like styling.

## Non-goals
- No advanced Git features (branching, merge, stash, rebase, history, diff UI).
- No file system writes from renderer.
- No network or remote Git operations (fetch/pull/push).
- No extension contributions for search/SCM in this phase.

## User stories
- As a developer, I can search the workspace with filters and quickly open results.
- As a developer, I can replace matches across files in a controlled way.
- As a developer, I can stage/unstage changes and commit without leaving the shell.
- As a developer, I can see if a folder is not a Git repo and get a clear message.

## Functional requirements
### Search
- Search panel appears in the primary sidebar when Search icon is selected.
- Query supports:
  - Plain text
  - Regex
  - Match case
  - Whole word
  - Include patterns
  - Exclude patterns
- Results grouped by file with counts and line previews.
- Clicking a match opens the file in the editor and reveals the match.
- Replace supports:
  - Replace next in file
  - Replace all in file
  - Replace all in workspace
  - Optional preview (count of replacements).
- Search respects workspace root; no access outside workspace.

### Source Control
- Source Control panel appears in the primary sidebar when SCM icon is selected.
- Shows Git status (staged/unstaged, untracked).
- Actions:
  - Stage file
  - Unstage file
  - Stage all
  - Unstage all
  - Commit with message
  - Refresh status
- If workspace is not a Git repo, show a clear empty state.

## Security requirements
- **P1**: All search and Git commands run in main process only.
- **P2**: Renderer uses contextBridge IPC only; no direct Node access.
- **P3**: No secrets or credentials persisted; no Git remotes invoked.
- **P6**: All IPC contracts defined in `packages/api-contracts` with Zod schemas.

## Performance requirements
- Search uses streaming or incremental result parsing; no blocking UI.
- Limit initial results and allow paging if the match set is huge.
- Avoid large renderer bundle changes; keep heavy logic in main.

## UX requirements
- Panel layout, spacing, icons, and typography match VS Code styling.
- Results list uses list-row height tokens and shows file icons.
- Buttons and toggles match existing menu/toolbar styling.
- UI components use Tailwind 4 tokens and existing `packages/ui-kit` primitives
  where applicable (TabBar, PanelHeader, form inputs).
- No hard-coded colors or spacing outside token variables.

## Acceptance criteria
- Search panel performs workspace searches with VS Code-like options and results.
- Replace works for file-level and workspace-level replacements.
- Source Control panel lists status and supports stage/unstage/commit.
- All IPC interactions are contract-first and validated.
- Renderer remains sandboxed; no direct OS access.
- Screenshots of Search and SCM panels align with VS Code patterns.
- UI elements use Tailwind 4 tokens and align with ui-kit components for
  spacing, typography, and states.

## Open questions
- Do we want to show diffs in SCM panel in this phase?
- Should replace-all prompt for confirmation on large changes?
