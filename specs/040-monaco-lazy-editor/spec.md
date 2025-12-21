# 040 Monaco Lazy Editor

## Problem / Why
Monaco Editor is a large dependency (~3MB minified) that significantly impacts initial bundle size and application startup time. Loading Monaco synchronously in the renderer process violates performance budget P5 from the constitution and creates a poor user experience. The application needs a code editor component, but most users won't need it immediately on startup. We need to implement lazy-loading with proper worker configuration to maintain editor functionality while keeping the initial bundle lean.

The editor experience also lacks VS Code-style navigation affordances. Users expect file + symbol breadcrumbs below the tab strip for context and quick navigation, and a familiar top menu bar (File/Edit/View/etc.) for discoverability. These should match VS Code layout conventions and be configurable in Settings without impacting Monaco lazy-loading or renderer sandboxing.

## Goals
- Lazy-load Monaco Editor via dynamic import so it's excluded from the initial renderer bundle
- Configure Monaco workers (TypeScript, JSON, CSS, HTML) to function correctly with lazy loading
- Ensure Monaco chunk size remains under performance budget (<500KB gzipped for editor core)
- Implement loading state UI while Monaco is being fetched and initialized
- Verify Monaco is excluded from initial bundle via build output analysis
- Maintain full Monaco Editor functionality (IntelliSense, syntax highlighting, workers)
- Add VS Code-style editor breadcrumbs below the tab strip (file path + symbols)
- Add a VS Code-style top menu bar (File/Edit/Selection/View/Go/Run/Terminal/Help)
- Make breadcrumbs and menu bar visibility configurable in Settings

## Non-goals
- Custom Monaco language support beyond built-in languages
- Advanced Monaco features beyond breadcrumbs (minimap, code folding customization)
- Monaco theming integration with Tailwind 4 design system (separate feature)
- Multi-file editor or tab management (separate feature)
- Extension-provided language servers or custom completions (separate feature)
- Performance optimizations beyond lazy-loading (e.g., virtualization, caching)
- Monaco configuration persistence or user preferences
- Command palette implementation and keybinding editor
- Full menu command parity with VS Code (only core actions in this spec)

## User stories
- As a user, I want the application to start quickly without waiting for editor assets to load
- As a user, I want to see a loading indicator when the editor is being initialized
- As a developer, I want to ensure Monaco doesn't impact initial page load performance
- As a user, I expect full code editor functionality (IntelliSense, syntax highlighting) once loaded
- As a user, I want breadcrumbs that show where I am in the file, so I can navigate quickly
- As a user, I want a VS Code-like menu bar, so core actions are easy to discover

## UX requirements
- Show a loading spinner or skeleton UI while Monaco is being fetched and initialized
- Loading state should clearly indicate "Loading Editor..." or similar message
- Once loaded, editor should render smoothly without visible errors or warnings
- Editor should be responsive and functional immediately after initialization completes
- Loading failure should show an error message with retry option
- Breadcrumbs bar appears directly below the editor tab strip
- Breadcrumbs show file path segments followed by symbol path segments for the active cursor
- Breadcrumbs are clickable: file segments focus/open file; symbol segments navigate within the file
- Breadcrumbs collapse gracefully when space is limited (overflow indicator or horizontal scroll)
- Menu bar appears at the top of the window content (below native title bar on Windows/Linux)
- Menu bar matches VS Code layout: File, Edit, Selection, View, Go, Run, Terminal, Help
- Menu bar supports keyboard focus (Alt to focus) and arrow-key navigation

## Functional requirements
- Monaco must be imported via dynamic `import()` at the point where editor component is first rendered
- Monaco workers (TypeScript, JSON, CSS, HTML, Editor worker) must be configured correctly
- Vite plugin `vite-plugin-monaco-editor` or similar must be configured to handle worker bundling
- Editor component must handle loading/error/success states
- Build output must show Monaco in separate chunk(s), not in main renderer bundle
- Editor must support basic functionality: syntax highlighting, IntelliSense, basic editing
- Breadcrumbs must be computed from the active file path and Monaco document symbols
- Breadcrumbs update on cursor move, file change, and tab switch (debounced to avoid jank)
- Breadcrumbs visibility can be toggled in Settings
- Menu bar visibility can be toggled in Settings
- Menu bar uses existing IPC/menu actions for core commands (Open Folder, Close Folder, Toggle Panels) without new renderer OS access

## Security requirements
- Monaco must run in sandboxed renderer process (no Node access) — already enforced by P1
- No eval() or unsafe dynamic code generation in Monaco configuration
- Monaco should not load external resources (CDN) - all assets bundled locally
- Content Security Policy must allow Monaco workers (worker-src 'self')
- No user content should be executed as code by Monaco
- Breadcrumbs and menu bar must not introduce new renderer OS access; all OS actions remain main-process only

## Performance requirements
- Initial renderer bundle size must not include Monaco (verify via build analysis)
- Monaco chunk size: <500KB gzipped for editor core, <200KB per worker
- Time to interactive for editor: <2 seconds on typical hardware after dynamic import
- Monaco initialization should not block main thread for >100ms
- Memory footprint: Monaco should not exceed 50MB heap after initialization
- Breadcrumbs update within 50ms for typical files (<5k symbols)
- Menu bar interaction remains responsive (<16ms for focus/hover transitions)

## Acceptance criteria
- [x] Monaco is loaded via dynamic import() and not present in initial renderer bundle
- [x] Build output shows Monaco in separate chunk (e.g., `monaco-editor-<hash>.js`)
- [x] Monaco workers are correctly configured and functional in built application
- [x] Loading state UI is displayed while Monaco initializes
- [x] Error handling is implemented for Monaco load failures with retry mechanism
- [x] TypeScript syntax highlighting and IntelliSense work correctly in loaded editor
- [x] pnpm -r typecheck passes
- [x] pnpm -r lint passes
- [x] pnpm -r test passes (if tests exist for editor component)
- [x] pnpm -r build produces correct chunks without Monaco in initial bundle
- [x] Manual verification: application starts without loading Monaco assets
- [x] Manual verification: editor component triggers Monaco load and renders correctly
- [ ] Breadcrumbs render below the tab strip and show file + symbol path
- [ ] Clicking a file breadcrumb focuses the corresponding file/tab
- [ ] Clicking a symbol breadcrumb navigates to that symbol in Monaco
- [ ] Breadcrumbs can be toggled on/off via Settings
- [ ] Menu bar renders with VS Code labels and supports keyboard navigation
- [ ] Menu bar visibility can be toggled on/off via Settings
- [ ] Menu bar actions call existing IPC/menu actions (no renderer OS access)

## Out of scope / Future work
- Integration with Tailwind 4 theming system (theme switching)
- Custom Monaco themes beyond default light/dark
- Multi-tab editor or file tree integration
- Extension-provided language support or LSP integration
- Editor state persistence (content, cursor position, view state)
- Diff editor or merge conflict resolution UI
- Advanced Monaco features beyond breadcrumbs (minimap, code folding customization)
- Monaco worker optimization or custom worker implementations
- Full VS Code menu command surface and command palette

## Open questions
- Should we use `vite-plugin-monaco-editor` or manual worker configuration?
- What's the fallback behavior if Monaco fails to load? (show error, disable feature, etc.)
- Should Monaco be preloaded on idle after application startup?
- Do we need to version-lock Monaco to avoid breaking changes in workers?
- Should breadcrumbs include both file path and symbols? (Decision: Yes, both)
- Should the menu bar be toggleable in Settings? (Decision: Yes)
