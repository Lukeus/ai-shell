# 080 Extension Host Runtime — Technical Plan
## Architecture changes
The Extension Host introduces a fourth process boundary in the application architecture:

**Current state:**
- Main Process: Shell kernel (Electron main)
- Renderer Process: React UI (sandboxed)
- Agent Host: Deep Agents orchestration (separate Node process)

**New state:**
- **Extension Host Process**: New separate Node.js child process spawned by main
  - Runs untrusted extension code
  - No direct OS/filesystem access
  - Communicates exclusively via JSON-RPC to main process
  - Hosts multiple extensions in a shared runtime (single-process-multi-extension model for MVP)
  - Implements crash recovery and automatic restart

**Main Process responsibilities expand:**
- ExtensionHostManager: spawn/monitor/restart Extension Host child process
- ExtensionRegistry: track installed extensions, manifests, and activation state
- ExtensionIPCBroker: route JSON-RPC messages between Extension Host and main
- PermissionService: enforce runtime permission checks before proxying sensitive operations
- Contribution aggregation: collect commands, views, tools, connection providers from extensions

**Extension Host Process responsibilities:**
- ExtensionLoader: load extension bundles from disk
- ExtensionRuntime: provide extension API surface to extensions
- ActivationController: lazy activate extensions based on activation events
- ContributionRegistry: register and track extension contributions
- JSON-RPC client: bidirectional communication with main process

## Contracts (api-contracts updates)
All new IPC contracts must be defined in `packages/api-contracts` using Zod schemas BEFORE implementation:

### 1. Extension manifest schema
```typescript
// packages/api-contracts/src/types/extension-manifest.ts
ExtensionManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  publisher: z.string(),
  displayName: z.string().optional(),
  description: z.string().optional(),
  main: z.string(), // entry point file
  activationEvents: z.array(z.string()), // ["onCommand:foo", "onView:bar"]
  permissions: z.array(z.enum(['filesystem', 'network', 'secrets', 'ui', 'terminal'])),
  contributes: z.object({
    commands: z.array(CommandContributionSchema).optional(),
    views: z.array(ViewContributionSchema).optional(),
    settings: z.array(SettingContributionSchema).optional(),
    connectionProviders: z.array(ConnectionProviderSchema).optional(),
    tools: z.array(ToolContributionSchema).optional(),
  }).optional(),
});
```

### 2. Extension lifecycle events
```typescript
// packages/api-contracts/src/types/extension-events.ts
ExtensionStateSchema = z.enum(['inactive', 'activating', 'active', 'failed', 'deactivating']);

ExtensionStateChangeEventSchema = z.object({
  extensionId: z.string(),
  state: ExtensionStateSchema,
  timestamp: z.number(),
  error: z.string().optional(),
});
```

### 3. Extension contribution schemas
```typescript
// packages/api-contracts/src/types/extension-contributions.ts
CommandContributionSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().optional(),
  when: z.string().optional(), // context expression
});

ViewContributionSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.enum(['primary-sidebar', 'secondary-sidebar', 'panel']),
  icon: z.string().optional(),
  when: z.string().optional(),
});

ToolContributionSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.record(z.unknown()), // JSON Schema as object
});

SettingContributionSchema = z.object({
  key: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'enum']),
  default: z.unknown(),
  description: z.string().optional(),
  enum: z.array(z.string()).optional(),
});
```

### 4. Extension Host JSON-RPC protocol
```typescript
// packages/api-contracts/src/types/extension-host-protocol.ts
ExtHostRequestSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('activateExtension'), params: z.object({ extensionId: z.string() }) }),
  z.object({ method: z.literal('deactivateExtension'), params: z.object({ extensionId: z.string() }) }),
  z.object({ method: z.literal('executeCommand'), params: z.object({ command: z.string(), args: z.array(z.unknown()) }) }),
  z.object({ method: z.literal('getContributions'), params: z.object({}) }),
]);

ExtHostResponseSchema = z.object({
  id: z.string(),
  result: z.unknown().optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional(),
});

MainToExtHostNotificationSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('shutdown'), params: z.object({}) }),
  z.object({ method: z.literal('reloadExtensions'), params: z.object({}) }),
]);
```

### 5. Extension API surface types
```typescript
// packages/api-contracts/src/types/extension-api.ts
ExtensionContextSchema = z.object({
  extensionId: z.string(),
  extensionPath: z.string(),
  globalStoragePath: z.string(),
  workspaceStoragePath: z.string().optional(),
});

// API capabilities exposed to extensions
ExtensionCapabilitiesSchema = z.object({
  registerCommand: z.function(),
  registerView: z.function(),
  registerTool: z.function(),
  registerConnectionProvider: z.function(),
  onDidChangeWorkspace: z.function(),
  // Note: actual function signatures defined in extension-sdk
});
```

### 6. Permission model
```typescript
// packages/api-contracts/src/types/extension-permissions.ts
PermissionScopeSchema = z.enum([
  'filesystem.read',
  'filesystem.write',
  'network.http',
  'network.websocket',
  'secrets.read',
  'secrets.write',
  'ui.showMessage',
  'ui.showInput',
  'terminal.create',
  'terminal.write',
]);

PermissionRequestSchema = z.object({
  extensionId: z.string(),
  scope: PermissionScopeSchema,
  reason: z.string().optional(),
});

PermissionGrantSchema = z.object({
  extensionId: z.string(),
  scope: PermissionScopeSchema,
  granted: z.boolean(),
  timestamp: z.number(),
  userDecision: z.boolean(), // true if user explicitly granted, false if auto-granted
});
```

### 7. New IPC channels
```typescript
// packages/api-contracts/src/ipc-channels.ts additions
IPC_CHANNELS = {
  ...existing,
  
  // Extension management (renderer/main)
  EXTENSIONS_LIST: 'extensions:list',
  EXTENSIONS_GET: 'extensions:get',
  EXTENSIONS_INSTALL: 'extensions:install',
  EXTENSIONS_UNINSTALL: 'extensions:uninstall',
  EXTENSIONS_ENABLE: 'extensions:enable',
  EXTENSIONS_DISABLE: 'extensions:disable',
  
  // Extension state events (main → renderer)
  EXTENSIONS_ON_STATE_CHANGE: 'extensions:on-state-change',
  
  // Extension commands (renderer → main → ext host)
  EXTENSIONS_EXECUTE_COMMAND: 'extensions:execute-command',
  EXTENSIONS_LIST_COMMANDS: 'extensions:list-commands',
  
  // Extension views (renderer → main)
  EXTENSIONS_LIST_VIEWS: 'extensions:list-views',
  EXTENSIONS_RENDER_VIEW: 'extensions:render-view',
  
  // Extension permissions (renderer/main)
  EXTENSIONS_REQUEST_PERMISSION: 'extensions:request-permission',
  EXTENSIONS_LIST_PERMISSIONS: 'extensions:list-permissions',
  EXTENSIONS_REVOKE_PERMISSION: 'extensions:revoke-permission',
};
```

### 8. Preload API additions
```typescript
// packages/api-contracts/src/preload-api.ts additions
interface PreloadAPI {
  ...existing,
  
  extensions: {
    list(): Promise<ExtensionManifest[]>;
    get(extensionId: string): Promise<ExtensionManifest | null>;
    executeCommand(command: string, args?: unknown[]): Promise<unknown>;
    listCommands(): Promise<CommandContribution[]>;
    listViews(): Promise<ViewContribution[]>;
    requestPermission(extensionId: string, scope: PermissionScope): Promise<boolean>;
    onStateChange(callback: (event: ExtensionStateChangeEvent) => void): () => void;
  };
}
```

## IPC + process boundaries
Extension Host process isolation and communication:

### Process spawn and lifecycle
**Main process (apps/electron-shell/src/main/extension-host-manager.ts):**
- Spawn Extension Host as child Node.js process using `child_process.fork()`
- Pass configuration via environment variables: extensions directory, IPC transport method
- Monitor child process health via heartbeat protocol
- Detect crashes and automatically respawn (with exponential backoff)
- Graceful shutdown: signal Extension Host, wait for acknowledgment, force kill if timeout

### JSON-RPC transport
**Main ↔ Extension Host bidirectional communication:**
- Transport: stdio (stdin/stdout) for simplicity and built-in backpressure
- Protocol: JSON-RPC 2.0 (request/response with IDs, notifications without IDs)
- Message framing: newline-delimited JSON (one message per line)
- Timeout handling: 30s timeout for extension activation, 5s for command execution
- Error propagation: extension errors wrapped and returned to main, never crash Extension Host

**JSON-RPC message flow examples:**

1. Main → Extension Host: Activate extension
```json
{"jsonrpc":"2.0","id":"1","method":"activateExtension","params":{"extensionId":"publisher.extension"}}
```

2. Extension Host → Main: Response
```json
{"jsonrpc":"2.0","id":"1","result":{"activated":true}}
```

3. Extension Host → Main: Notification (extension state change)
```json
{"jsonrpc":"2.0","method":"notifyStateChange","params":{"extensionId":"publisher.extension","state":"active"}}
```

4. Main → Extension Host: Execute command
```json
{"jsonrpc":"2.0","id":"2","method":"executeCommand","params":{"command":"extension.doSomething","args":[1,2,3]}}
```

### Security boundaries enforced at main process
**All sensitive operations proxied through main:**
- Extension requests filesystem access → main checks permission → main executes via fs-broker
- Extension requests secret access → main checks permission → main returns secret handle (not value)
- Extension makes network request → main checks permission → main proxies request
- Extension Host cannot bypass these checks (no direct Node.js access to fs/net)

### Renderer ↔ Extension interaction
**Renderer never talks directly to Extension Host:**
- Renderer invokes command → preload → main IPC → main routes to Extension Host → Extension Host executes → response back through main → preload → renderer
- Renderer displays extension view → requests view content via main → main requests HTML/component from Extension Host → main sanitizes and forwards to renderer

## UI components and routes
### Extensions page (Settings)
**Location:** `apps/electron-shell/src/renderer/pages/settings/ExtensionsPage.tsx`
- List installed extensions with state badges (active/inactive/failed)
- Enable/disable toggle per extension
- View extension details: manifest, permissions, contributions
- Uninstall button (with confirmation)

### Extension views integration
**Primary/Secondary Sidebar and Panel:**
- Extension-contributed views appear in appropriate locations based on manifest
- View content rendered via iframe or webview for isolation
- View activation triggered by user clicking on view icon

### Command palette integration
**Location:** `apps/electron-shell/src/renderer/components/CommandPalette.tsx`
- Display extension commands alongside built-in commands
- Execute extension command via `window.api.extensions.executeCommand()`
- Show command category prefix (e.g., "Extension: Do Something")

### Permission consent dialog
**Component:** `apps/electron-shell/src/renderer/components/PermissionDialog.tsx`
- Modal dialog triggered when extension requests new permission
- Clear explanation of permission scope and reason
- User can grant once, grant always, or deny
- "Remember my choice" checkbox for future requests

## Data model changes
### Extension registry (main process)
**Storage:** JSON file at `~/.ai-shell/extensions/extensions.json` (migrate to SQLite later)
```typescript
interface ExtensionRegistry {
  extensions: {
    [extensionId: string]: {
      manifest: ExtensionManifest;
      enabled: boolean;
      installedVersion: string;
      installedAt: number;
      lastActivatedAt: number | null;
    };
  };
}
```

### Permission grants (main process)
**Storage:** JSON file at `~/.ai-shell/extensions/permissions.json`
```typescript
interface PermissionGrants {
  grants: {
    [extensionId: string]: {
      [scope: string]: PermissionGrant;
    };
  };
}
```

### Extension state (in-memory, main process)
```typescript
interface ExtensionState {
  extensionId: string;
  state: 'inactive' | 'activating' | 'active' | 'failed' | 'deactivating';
  error?: string;
  activatedAt?: number;
  contributions: {
    commands: CommandContribution[];
    views: ViewContribution[];
    tools: ToolContribution[];
    connectionProviders: ConnectionProvider[];
  };
}
```

## Failure modes + recovery
### Extension Host crash
**Detection:** Main process monitors child process exit event
**Recovery:** 
- Automatic restart with exponential backoff (100ms, 500ms, 2s, 10s, max 30s)
- All extensions marked as 'inactive' and must re-activate
- Renderer notified via state change events
- After 5 consecutive crashes within 1 minute, Extension Host disabled until user intervention

### Extension activation failure
**Detection:** Activation promise rejects or times out (30s)
**Recovery:**
- Extension state set to 'failed' with error message
- Other extensions continue to function
- User shown notification with option to view error details
- Failed extension can be manually retried from Extensions page

### Extension runtime error
**Detection:** Uncaught exception in extension code
**Recovery:**
- Error caught by Extension Host runtime wrapper
- Error logged and returned to main process
- Extension remains active (error does not deactivate it)
- User shown notification if error occurred during user action

### JSON-RPC communication failure
**Detection:** Message parsing error or timeout
**Recovery:**
- Invalid messages logged and ignored
- Timeout causes promise rejection and error returned to caller
- Communication channel remains open (does not kill Extension Host)

### Permission denial
**Handling:**
- Extension API call returns error indicating permission denied
- Extension must handle gracefully or fail
- User can grant permission retroactively from Extensions page

## Testing strategy
### Unit tests
**Packages to test:**
- `packages/api-contracts`: Zod schema validation tests for all extension-related schemas
- `packages/extension-sdk`: Extension API surface tests (mocked runtime)
- Main process extension services: ExtensionHostManager, ExtensionRegistry, PermissionService (mocked child process)
- Extension Host runtime: ExtensionLoader, ActivationController (mocked extensions)

**Testing framework:** Vitest
**Coverage target:** >80% for core extension runtime code

### Integration tests
**Test scenarios:**
1. Spawn Extension Host process from main and establish JSON-RPC connection
2. Load extension manifest from disk
3. Activate extension and verify contribution registration
4. Execute extension command and receive response
5. Request permission, grant it, verify extension can execute privileged operation
6. Crash Extension Host and verify automatic restart
7. Multiple extensions active concurrently without interference

**Test fixtures:** Sample extensions in `tests/fixtures/extensions/`
**Testing framework:** Vitest + Electron test environment

### End-to-end tests
**Test scenarios (Playwright):**
1. Install extension from Extensions page
2. Enable extension and verify it appears in command palette
3. Execute extension command from command palette
4. Extension requests permission → user grants → extension operation succeeds
5. Disable extension and verify commands/views removed
6. Uninstall extension

**Verification:** Visual regression tests for Extensions page, permission dialogs

### Verification commands
```bash
# Type checking
pnpm -r typecheck

# Linting
pnpm -r lint

# Unit tests
pnpm -r test

# Build all packages
pnpm -r build

# E2E tests (after implementation)
pnpm test:e2e --grep "extension"

# Manual testing checklist
# 1. Start app, verify Extension Host process spawns
# 2. Install sample extension
# 3. Activate extension, check command palette
# 4. Execute command, verify response
# 5. Request permission, verify dialog
# 6. Kill Extension Host process (task manager), verify restart
```

## Rollout / migration
### Phase 1: Foundation (first)
- Implement contracts in `packages/api-contracts`
- Scaffold Extension Host process in `apps/extension-host`
- Implement ExtensionHostManager in main process
- Establish JSON-RPC communication
- **Verification:** Extension Host spawns and responds to ping

### Phase 2: Extension loading (second)
- Implement ExtensionLoader in Extension Host
- Implement manifest parsing and validation
- Implement ExtensionRegistry in main process
- Load extensions from disk on startup
- **Verification:** Extension manifests loaded and stored in registry

### Phase 3: Lifecycle and activation (third)
- Implement ActivationController in Extension Host
- Implement activation event system
- Implement lazy activation based on events
- **Verification:** Extension activates on `onCommand` event

### Phase 4: Contribution points (fourth)
- Implement command registration and execution
- Implement view registration
- Implement tool registration
- Implement connection provider registration
- **Verification:** Extension commands appear in command palette and execute

### Phase 5: Permissions (fifth)
- Implement PermissionService in main process
- Implement permission request flow
- Implement permission UI (consent dialog)
- Enforce permission checks before sensitive operations
- **Verification:** Extension cannot access filesystem without permission

### Phase 6: UI integration (sixth)
- Implement Extensions page in Settings
- Integrate extension commands in command palette
- Implement extension view rendering
- **Verification:** Extensions manageable from UI

### Phase 7: Robustness (seventh)
- Implement crash recovery and restart
- Implement timeout handling
- Implement error propagation
- Add comprehensive logging and diagnostics
- **Verification:** Extension Host crashes and recovers gracefully

### Backward compatibility
- No breaking changes to existing IPC contracts
- Extensions are opt-in feature; app works without extensions installed
- Extension Host does not start if no extensions installed (lazy spawn)

## Risks + mitigations
### Risk 1: Extension Host startup latency impacts app startup time
**Mitigation:** Lazy spawn Extension Host only when first extension needs activation, not on app startup. Load extension manifests synchronously from disk in main process (fast), spawn Extension Host only when needed.

### Risk 2: JSON-RPC performance overhead for high-frequency calls
**Mitigation:** Batch extension API calls where possible. Cache contribution metadata in main process to avoid repeated queries. Measure IPC latency in integration tests, set performance budget (<5ms).

### Risk 3: Extension crashes take down Extension Host, affecting all extensions
**Mitigation:** Wrap each extension activation and execution in try-catch. Isolate errors to individual extensions. Future: multi-process model (one Extension Host per extension).

### Risk 4: Permission model too coarse or too granular
**Mitigation:** Start with coarse categories (filesystem, network, secrets) for MVP. Collect feedback from extension developers. Refine granularity in follow-up iteration.

### Risk 5: Extension manifest schema changes break installed extensions
**Mitigation:** Version manifest schema (e.g., `manifestVersion: 1`). Main process checks version and rejects incompatible extensions. Document versioning policy.

### Risk 6: Secrets handling: extension gets handle but needs value
**Mitigation:** Design broker pattern where extension makes API call with secret handle, main process resolves handle to value and executes operation, never passing value to Extension Host. Requires clear documentation and examples.

### Risk 7: Extension view rendering security (XSS, clickjacking)
**Mitigation:** Render extension views in sandboxed iframe/webview with strict CSP. Sanitize all extension-provided HTML. Future: use web components or JSON-based UI description instead of HTML.

## Done definition
Feature is complete when ALL of the following are verified:

1. **Contracts defined:** All extension-related Zod schemas defined in `packages/api-contracts` and exported
2. **Extension Host spawns:** Main process spawns Extension Host child process and establishes JSON-RPC connection
3. **Manifest loading:** Extensions can be loaded from disk based on manifest files
4. **Lazy activation:** Extensions activate lazily based on activation events (e.g., `onCommand:foo`)
5. **Command execution:** Extensions can register commands that execute when invoked from command palette
6. **View contribution:** Extensions can contribute views that render in sidebar/panel
7. **Tool registration:** Extensions can register tool implementations callable by Agent Host
8. **Connection providers:** Extensions can register connection providers with schema definitions
9. **Permission checks:** Permission system enforces declared capabilities before sensitive operations
10. **Crash recovery:** Extension Host crashes do not crash main process; Extension Host automatically restarts
11. **Secrets flow:** Extensions access secrets via handle-based flow (no plaintext exposure)
12. **UI integration:** Extensions page in Settings allows enable/disable/uninstall; extension commands in command palette
13. **Permission UI:** Permission consent dialog shown when extension requests new permission
14. **Non-blocking activation:** Extension activation does not block UI thread or renderer
15. **Concurrent extensions:** Multiple extensions can be active concurrently without interference
16. **Tests passing:** Unit tests >80% coverage, integration tests cover key scenarios, E2E tests verify user workflows
17. **Documentation:** Extension API documented with examples in `docs/extensions/` (README, API reference, sample extension)
18. **Performance verified:** Extension system adds <100ms to startup, IPC latency <5ms, activation <500ms
19. **All verification commands pass:** `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`, `pnpm -r build`
