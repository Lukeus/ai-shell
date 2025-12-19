# 040 Monaco Lazy Editor

## Problem / Why
Monaco Editor is a large dependency (~3MB minified) that significantly impacts initial bundle size and application startup time. Loading Monaco synchronously in the renderer process violates performance budget P5 from the constitution and creates a poor user experience. The application needs a code editor component, but most users won't need it immediately on startup. We need to implement lazy-loading with proper worker configuration to maintain editor functionality while keeping the initial bundle lean.

## Goals
- Lazy-load Monaco Editor via dynamic import so it's excluded from the initial renderer bundle
- Configure Monaco workers (TypeScript, JSON, CSS, HTML) to function correctly with lazy loading
- Ensure Monaco chunk size remains under performance budget (<500KB gzipped for editor core)
- Implement loading state UI while Monaco is being fetched and initialized
- Verify Monaco is excluded from initial bundle via build output analysis
- Maintain full Monaco Editor functionality (IntelliSense, syntax highlighting, workers)

## Non-goals
- Custom Monaco language support beyond built-in languages
- Monaco theming integration with Tailwind 4 design system (separate feature)
- Multi-file editor or tab management (separate feature)
- Extension-provided language servers or custom completions (separate feature)
- Performance optimizations beyond lazy-loading (e.g., virtualization, caching)
- Monaco configuration persistence or user preferences

## User stories
- As a user, I want the application to start quickly without waiting for editor assets to load
- As a user, I want to see a loading indicator when the editor is being initialized
- As a developer, I want to ensure Monaco doesn't impact initial page load performance
- As a user, I expect full code editor functionality (IntelliSense, syntax highlighting) once loaded

## UX requirements
- Show a loading spinner or skeleton UI while Monaco is being fetched and initialized
- Loading state should clearly indicate "Loading Editor..." or similar message
- Once loaded, editor should render smoothly without visible errors or warnings
- Editor should be responsive and functional immediately after initialization completes
- Loading failure should show an error message with retry option

## Functional requirements
- Monaco must be imported via dynamic `import()` at the point where editor component is first rendered
- Monaco workers (TypeScript, JSON, CSS, HTML, Editor worker) must be configured correctly
- Vite plugin `vite-plugin-monaco-editor` or similar must be configured to handle worker bundling
- Editor component must handle loading/error/success states
- Build output must show Monaco in separate chunk(s), not in main renderer bundle
- Editor must support basic functionality: syntax highlighting, IntelliSense, basic editing

## Security requirements
- Monaco must run in sandboxed renderer process (no Node access) — already enforced by P1
- No eval() or unsafe dynamic code generation in Monaco configuration
- Monaco should not load external resources (CDN) — all assets bundled locally
- Content Security Policy must allow Monaco workers (worker-src 'self')
- No user content should be executed as code by Monaco

## Performance requirements
- Initial renderer bundle size must not include Monaco (verify via build analysis)
- Monaco chunk size: <500KB gzipped for editor core, <200KB per worker
- Time to interactive for editor: <2 seconds on typical hardware after dynamic import
- Monaco initialization should not block main thread for >100ms
- Memory footprint: Monaco should not exceed 50MB heap after initialization

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

## Out of scope / Future work
- Integration with Tailwind 4 theming system (theme switching)
- Custom Monaco themes beyond default light/dark
- Multi-tab editor or file tree integration
- Extension-provided language support or LSP integration
- Editor state persistence (content, cursor position, view state)
- Diff editor or merge conflict resolution UI
- Advanced Monaco features (minimap, breadcrumbs, code folding customization)
- Monaco worker optimization or custom worker implementations

## Open questions
- Should we use `vite-plugin-monaco-editor` or manual worker configuration?
- What's the fallback behavior if Monaco fails to load? (show error, disable feature, etc.)
- Should Monaco be preloaded on idle after application startup?
- Do we need to version-lock Monaco to avoid breaking changes in workers?
