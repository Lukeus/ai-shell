# 130 Workspace Search + SCM - Technical Plan

## Architecture changes
- Add SearchService (main) to execute workspace searches (rg) and replacements.
- Add GitService (main) to execute Git status and stage/unstage/commit.
- Add IPC contracts in `packages/api-contracts` for search and SCM requests.
- Extend preload API (`PreloadAPI`) with search + SCM methods.
- Add renderer panels for Search and Source Control in primary sidebar.

## Data flow
### Search
1) Renderer SearchPanel emits SearchRequest via preload API.
2) Main SearchService validates request, runs `rg` in workspace root.
3) Main parses results into structured matches and returns SearchResponse.
4) Renderer renders grouped results and navigates to editor on click.
5) Replace requests (file/all) run via main with validated paths.

### Source Control
1) Renderer SourceControlPanel requests status.
2) Main GitService runs `git status --porcelain=v1 -z` in workspace root.
3) Renderer displays staged/unstaged/untracked groups.
4) Stage/unstage/commit actions run via main GitService.

## API contracts (P6)
Add Zod-first schemas in `packages/api-contracts`:
- `SearchRequest` (query, isRegex, matchCase, wholeWord, includes, excludes, maxResults)
- `SearchMatch` (filePath, line, column, lineText, matchText)
- `SearchResult` (filePath, matches)
- `SearchResponse` (results, truncated)
- `ReplaceRequest` (filePath or workspace, query/replace options)
- `ReplaceResponse` (filesChanged, replacements)
- `ScmStatusRequest/Response` (staged/unstaged/untracked arrays)
- `ScmFileStatus` (path, status code)
- `ScmStageRequest`, `ScmUnstageRequest`, `ScmCommitRequest`

## Main process services
### SearchService
- Validate workspace root and request schema.
- Use `rg --json` with include/exclude patterns when available; fall back to `rg` plain.
- Parse JSON lines into structured matches.
- Enforce max results and return `truncated` flag.
- Replace uses `rg` to find targets, then applies replacements via fs write
  (main process only).

### GitService
- Validate workspace root is a Git repo (`git rev-parse --is-inside-work-tree`).
- Run `git status --porcelain=v1 -z` and parse entries.
- Stage: `git add -- <path>`; Unstage: `git reset -- <path>`.
- Commit: `git commit -m <message>` with sanitized message.
- No network operations.

## Renderer changes
- Add Search panel component and wire into activity bar selection.
- Add Source Control panel component and wire into activity bar selection.
- Use existing editor navigation to open search results.
- Use existing tokens for layout and list styling.
- Prefer `packages/ui-kit` primitives (TabBar, PanelHeader, form controls) and
  Tailwind 4 token variables for spacing/typography.

## Testing strategy
- Unit tests for SearchService parsing and GitService parsing.
- IPC handler tests for contract validation.
- Basic renderer tests for panel rendering and empty states.

## Rollout / migration
- Panels ship disabled if no workspace.
- SCM panel shows empty state when no Git repo.

## Done definition
- Search panel works with VS Code-style options and grouped results.
- SCM panel supports stage/unstage/commit actions.
- All IPC contracts in `packages/api-contracts` and used end-to-end.
- Tests cover main parsing logic and IPC validation.
