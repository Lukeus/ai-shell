# 080 Extension Host Runtime — Implementation Tasks

## Task 1: Define extension contracts in packages/api-contracts
**Purpose:** Establish Zod-first contracts for all extension-related types before implementation (P6)

**Files to create/change:**
- `packages/api-contracts/src/types/extension-manifest.ts` - ExtensionManifestSchema, ExtensionManifest type
- `packages/api-contracts/src/types/extension-events.ts` - ExtensionStateSchema, ExtensionStateChangeEventSchema
- `packages/api-contracts/src/types/extension-contributions.ts` - CommandContributionSchema, ViewContributionSchema, ToolContributionSchema, SettingContributionSchema
- `packages/api-contracts/src/types/extension-host-protocol.ts` - ExtHostRequestSchema, ExtHostResponseSchema, MainToExtHostNotificationSchema
- `packages/api-contracts/src/types/extension-permissions.ts` - PermissionScopeSchema, PermissionRequestSchema, PermissionGrantSchema
- `packages/api-contracts/src/types/extension-api.ts` - ExtensionContextSchema
- `packages/api-contracts/src/ipc-channels.ts` - Add EXTENSIONS_* channel constants
- `packages/api-contracts/src/preload-api.ts` - Add extensions namespace to PreloadAPI interface
- `packages/api-contracts/src/index.ts` - Export all new types

**Verification commands:**
```bash
pnpm --filter packages-api-contracts typecheck
pnpm --filter packages-api-contracts build
pnpm --filter packages-api-contracts test
```

**Invariants:**
- P6: All IPC and extension contracts defined using Zod schemas
- All schemas must validate correctly and have TypeScript type inference
- No breaking changes to existing IPC_CHANNELS
- Exports added to index.ts maintain alphabetical order

## Task 2: Scaffold Extension Host process structure
**Purpose:** Create basic Extension Host app structure with build configuration

**Files to create/change:**
- `apps/extension-host/src/index.ts` - Entry point for Extension Host process
- `apps/extension-host/src/json-rpc-client.ts` - JSON-RPC 2.0 communication over stdio
- `apps/extension-host/tsconfig.json` - TypeScript configuration
- `apps/extension-host/package.json` - Update scripts (dev, build, typecheck)
- `apps/extension-host/tsup.config.ts` - Build configuration

**Verification commands:**
```bash
pnpm --filter apps-extension-host typecheck
pnpm --filter apps-extension-host build
node apps/extension-host/dist/index.js --help
```

**Invariants:**
- P1: Extension Host runs as separate Node.js process (not Electron)
- Extension Host has NO direct OS access (no fs, no net imports in entry point)
- All communication via stdin/stdout only
- Build produces single executable bundle

## Task 3: Implement ExtensionHostManager in main process
**Purpose:** Main process service to spawn, monitor, and manage Extension Host child process

**Files to create/change:**
- `apps/electron-shell/src/main/services/extension-host-manager.ts` - ExtensionHostManager class
- `apps/electron-shell/src/main/services/json-rpc-broker.ts` - JSON-RPC bridge for main ↔ Extension Host
- `apps/electron-shell/src/main/index.ts` - Initialize ExtensionHostManager
- `apps/electron-shell/src/main/services/extension-host-manager.test.ts` - Unit tests

**Verification commands:**
```bash
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell test
pnpm --filter apps-electron-shell build
```

**Invariants:**
- P1: Extension Host spawned as child process using child_process.fork()
- Main process monitors child health and implements crash recovery
- Exponential backoff on restart (100ms, 500ms, 2s, 10s, max 30s)
- Graceful shutdown on app close
- JSON-RPC transport uses stdio (stdin/stdout)

## Task 4: Implement ExtensionRegistry and manifest loading
**Purpose:** Track installed extensions and load manifests from disk

**Files to create/change:**
- `apps/electron-shell/src/main/services/extension-registry.ts` - ExtensionRegistry class
- `apps/electron-shell/src/main/services/extension-storage.ts` - JSON file storage for registry
- `apps/electron-shell/src/main/services/extension-registry.test.ts` - Unit tests
- `apps/electron-shell/src/main/index.ts` - Initialize ExtensionRegistry

**Verification commands:**
```bash
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell test
pnpm --filter apps-electron-shell build
```

**Invariants:**
- P1: ExtensionRegistry runs in main process only
- P2: Extension manifests validated against ExtensionManifestSchema before loading
- Registry persisted to JSON file at ~/.ai-shell/extensions/extensions.json
- P3: No secrets stored in registry (only metadata)
- Manifest validation fails gracefully, logs errors, skips invalid extensions

## Task 5: Implement extension activation and lifecycle in Extension Host
**Purpose:** Load extensions and activate them lazily based on activation events

**Files to create/change:**
- `apps/extension-host/src/extension-loader.ts` - ExtensionLoader class
- `apps/extension-host/src/activation-controller.ts` - ActivationController class
- `apps/extension-host/src/contribution-registry.ts` - ContributionRegistry class
- `apps/extension-host/src/extension-runtime.ts` - Extension API surface wrapper
- `apps/extension-host/src/index.ts` - Wire up activation system
- Unit tests for each module

**Verification commands:**
```bash
pnpm --filter apps-extension-host typecheck
pnpm --filter apps-extension-host test
pnpm --filter apps-extension-host build
```

**Invariants:**
- P5: Extensions activate lazily only when activation event fires
- P1: Extension code executes in Extension Host process only
- Extension errors caught and wrapped, never crash Extension Host
- Activation timeout: 30s max
- State transitions: inactive → activating → active/failed
- Multiple extensions can activate concurrently without blocking

## Task 6: Implement command contribution and execution
**Purpose:** Extensions register commands, main process routes execution requests

**Files to create/change:**
- `apps/electron-shell/src/main/ipc-handlers/extension-handlers.ts` - IPC handlers for extensions
- `apps/electron-shell/src/main/services/extension-command-service.ts` - Command registry and execution
- `apps/electron-shell/src/preload/index.ts` - Add window.api.extensions methods
- `apps/extension-host/src/command-manager.ts` - Command registration in Extension Host
- Integration tests for command flow

**Verification commands:**
```bash
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell test
pnpm --filter apps-extension-host typecheck
pnpm --filter apps-extension-host test
pnpm -r build
```

**Invariants:**
- P2: Renderer communicates via preload contextBridge only (window.api.extensions)
- P1: Renderer never talks directly to Extension Host (always through main)
- Command execution timeout: 5s
- Command results validated against JSON-RPC schema
- Failed commands return error, do not crash Extension Host

## Task 7: Implement PermissionService and permission enforcement
**Purpose:** Permission system enforces extension capabilities before sensitive operations

**Files to create/change:**
- `apps/electron-shell/src/main/services/permission-service.ts` - PermissionService class
- `apps/electron-shell/src/main/services/permission-storage.ts` - JSON storage for permission grants
- `apps/electron-shell/src/main/ipc-handlers/permission-handlers.ts` - IPC handlers for permissions
- `apps/electron-shell/src/preload/index.ts` - Add permission request methods
- Unit tests for PermissionService

**Verification commands:**
```bash
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell test
pnpm --filter apps-electron-shell build
```

**Invariants:**
- P1: Permission checks enforced in main process only (not in Extension Host)
- P3: Extensions never receive raw secret values (handles only)
- Permission grants persisted to ~/.ai-shell/extensions/permissions.json
- P2: No secrets in logs; no plaintext secrets on disk
- Denied permissions return error to extension, do not crash
- All permission requests audited/logged

## Task 8: Implement view and tool contribution points
**Purpose:** Extensions contribute views and tools; integrate with existing systems

**Files to create/change:**
- `apps/extension-host/src/view-manager.ts` - View registration
- `apps/extension-host/src/tool-manager.ts` - Tool registration
- `apps/electron-shell/src/main/services/extension-view-service.ts` - View aggregation
- `apps/electron-shell/src/main/services/extension-tool-service.ts` - Tool aggregation
- `apps/electron-shell/src/main/ipc-handlers/extension-handlers.ts` - Add view/tool IPC handlers

**Verification commands:**
```bash
pnpm --filter apps-extension-host typecheck
pnpm --filter apps-extension-host test
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell test
pnpm -r build
```

**Invariants:**
- View content sanitized before rendering in renderer
- Tool schemas validated against ToolContributionSchema
- Extension-contributed tools callable by Agent Host
- Connection providers use existing ConnectionProviderSchema (already in api-contracts)

## Task 9: Implement crash recovery and error handling
**Purpose:** Extension Host crashes recover gracefully without affecting main process

**Files to create/change:**
- `apps/electron-shell/src/main/services/extension-host-manager.ts` - Add crash detection and restart logic
- `apps/extension-host/src/error-handler.ts` - Global error handler for Extension Host
- `apps/electron-shell/src/main/services/extension-state-manager.ts` - Track and broadcast extension state changes
- Integration tests for crash scenarios

**Verification commands:**
```bash
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell test
pnpm -r build
```

**Invariants:**
- P1: Extension Host crash does not crash main process or renderer
- Automatic restart with exponential backoff
- After 5 crashes in 1 minute, Extension Host disabled until user intervention
- All extensions marked inactive after crash
- Renderer notified of state changes via IPC events

## Task 10: Build Extensions UI page in Settings
**Purpose:** User interface for managing extensions

**Files to create/change:**
- `apps/electron-shell/src/renderer/pages/settings/ExtensionsPage.tsx` - Extensions management UI
- `apps/electron-shell/src/renderer/components/ExtensionCard.tsx` - Extension list item
- `apps/electron-shell/src/renderer/components/PermissionDialog.tsx` - Permission consent dialog
- `apps/electron-shell/src/renderer/pages/settings/SettingsPage.tsx` - Add Extensions route
- E2E tests for Extensions page

**Verification commands:**
```bash
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell lint
pnpm --filter apps-electron-shell build
pnpm test:e2e --grep "extensions"
```

**Invariants:**
- P2: Renderer uses window.api.extensions only (no direct Node access)
- P4: UI uses Tailwind 4 tokens and theme variables
- Permission dialog clearly explains scope and reason
- Enable/disable actions go through main process
- Uninstall requires confirmation

## Task 11: Integrate extension commands into Command Palette
**Purpose:** Extension commands appear and execute from command palette

**Files to create/change:**
- `apps/electron-shell/src/renderer/components/CommandPalette.tsx` - Add extension commands
- `apps/electron-shell/src/renderer/hooks/useExtensionCommands.ts` - Hook to fetch extension commands
- `apps/electron-shell/src/renderer/components/CommandPaletteItem.tsx` - Show category prefix

**Verification commands:**
```bash
pnpm --filter apps-electron-shell typecheck
pnpm --filter apps-electron-shell lint
pnpm --filter apps-electron-shell build
pnpm test:e2e --grep "command palette.*extension"
```

**Invariants:**
- Extension commands displayed with category prefix ("Extension: ...")
- Command execution goes through window.api.extensions.executeCommand()
- Failed commands show error notification
- Command palette does not block while waiting for extension commands

## Task 12: Write comprehensive tests and fixtures
**Purpose:** Achieve >80% test coverage with unit, integration, and E2E tests

**Files to create/change:**
- `tests/fixtures/extensions/sample-extension/` - Sample extension for testing
- `tests/fixtures/extensions/failing-extension/` - Extension that fails activation
- `tests/fixtures/extensions/permission-extension/` - Extension requiring permissions
- `packages/api-contracts/src/types/*.test.ts` - Schema validation tests
- `apps/extension-host/src/**/*.test.ts` - Unit tests for Extension Host modules
- `apps/electron-shell/src/main/services/**/*.test.ts` - Unit tests for main services
- `tests/e2e/extensions.spec.ts` - E2E tests for extension workflows

**Verification commands:**
```bash
pnpm -r test
pnpm test:coverage
pnpm test:e2e --grep "extension"
pnpm -r typecheck
pnpm -r lint
pnpm -r build
```

**Invariants:**
- All Zod schemas have validation tests
- Extension Host crash recovery tested
- Permission enforcement tested
- Command execution flow tested end-to-end
- Sample extensions follow manifest schema correctly
- No tests bypass security boundaries (P1, P2)
- Test coverage >80% for core extension runtime code

## Task 13: Add documentation and sample extension
**Purpose:** Document extension API with working examples

**Files to create/change:**
- `docs/extensions/README.md` - Extension system overview
- `docs/extensions/api-reference.md` - Extension API documentation
- `docs/extensions/getting-started.md` - Create your first extension guide
- `docs/extensions/sample-extension/` - Complete working sample extension
- `packages/extension-sdk/README.md` - SDK usage documentation
- `CHANGELOG.md` - Document extension system release

**Verification commands:**
```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r build
pnpm -r test
```

**Invariants:**
- Documentation examples follow best practices
- Sample extension demonstrates all contribution points
- API reference matches actual implementation
- Security considerations documented (permissions, secrets handling)
- P5: Performance guidelines included (activation events, lazy loading)
- Manifest schema versioning documented
