# 080 Extension Host Runtime
## Problem / Why
The application requires a secure, isolated runtime for executing untrusted third-party extensions without compromising the main process or renderer security model. Extensions must run in a separate process with controlled communication channels, explicit permission boundaries, and lazy activation to maintain performance. Without a proper extension host runtime, we cannot safely enable the extension ecosystem that is core to the platform's extensibility goals.

## Goals
- Implement a separate Extension Host process that runs untrusted extension code in isolation from main and renderer processes
- Establish a JSON-RPC communication bridge between main process and Extension Host
- Define and enforce extension contribution points (commands, views, settings, connection providers, tools)
- Implement lazy activation based on activation events to maintain performance budgets
- Create a permission model for extensions with explicit user consent flows
- Enable extensions to register capabilities that integrate with the shell's UI and functionality
- Add a VS Code-style Extensions panel in the primary sidebar for managing installed extensions
- Ensure all extension-related contracts are defined in packages/api-contracts using Zod schemas

## Non-goals
- Marketplace UI implementation (covered in separate feature)
- Extension signing and verification infrastructure (covered in separate feature)
- Agent Host integration (separate feature)
- Extension debugging/development tools (future work)
- Hot-reload of extensions during development (future work)
- Extension telemetry and analytics (future work)

## User stories
1. As an extension developer, I want to register commands that users can invoke, so my extension can add functionality to the IDE
2. As an extension developer, I want to contribute custom views to the UI, so I can provide specialized interfaces
3. As an extension developer, I want to register connection providers, so users can connect to external services through my extension
4. As an extension developer, I want to register tool implementations, so agents can use my extension's capabilities
5. As a user, I want extensions to load only when needed, so the application starts quickly
6. As a user, I want to grant explicit permissions to extensions, so I control what they can access
7. As a platform admin, I want extensions isolated from the main process, so a buggy extension cannot crash the application
8. As a platform admin, I want all extension actions auditable, so I can track security-sensitive operations

## UX requirements
- Extensions must activate transparently without blocking the UI
- Permission prompts must be clear and actionable when extensions request new capabilities
- Extension failures must not crash the main application or freeze the renderer
- Users should see clear feedback when extensions are loading or activating
- Extensions panel matches VS Code styling and uses Tailwind 4 token variables

## Functional requirements
1. **Extension Host Process**
   - Spawn a separate Node process for Extension Host on application startup
   - Manage Extension Host lifecycle (start, restart on crash, shutdown)
   - Support loading multiple extensions within a single Extension Host process
   - Implement crash recovery with automatic restart

2. **JSON-RPC Communication**
   - Establish bidirectional JSON-RPC channel between main process and Extension Host
   - Support request/response patterns for synchronous operations
   - Support events/notifications for asynchronous updates
   - Handle message serialization/deserialization with proper error handling
   - Implement timeout handling for hung extension calls

3. **Extension Lifecycle**
   - Load extension manifests (package.json or equivalent) to read metadata and contribution points
   - Implement lazy activation based on activation events (onCommand, onView, onLanguage, etc.)
   - Track extension state (inactive, activating, active, failed)
   - Provide extension activation/deactivation APIs
   - Clean up extension resources on deactivation

4. **Contribution Points**
   - Commands: extensions can register commands that appear in command palette
   - Views: extensions can contribute custom view panels
   - Settings: extensions can define configuration schemas
   - Connection Providers: extensions can register providers for external service connections
   - Tools: extensions can register tool implementations for agent use

7. **Extensions Panel**
   - Extensions view appears in the primary sidebar when Extensions icon is selected
   - Lists installed extensions with enable/disable and uninstall actions
   - Shows activation status and version metadata
   - Supports permission review via a dialog
8. **Extensions Preferences**
   - Settings includes an Extensions preferences tab for auto-update and telemetry
   - Preferences are distinct from the Extensions panel content
9. **Command Palette Integration**
   - Use a Workbench-level Command Palette (VS Code-style), not Monaco's editor palette
   - Include base app commands for core File and Terminal actions alongside extension commands
   - Extension commands surface through the Workbench palette

5. **Extension API**
   - Provide extension context object with lifecycle hooks (activate, deactivate)
   - Expose controlled APIs for extensions to interact with the platform
   - Implement capability-based permission system
   - Provide event subscription mechanisms for extensions

6. **Permission Model**
   - Define permission scopes (filesystem, network, secrets, UI, etc.)
   - Extensions declare required permissions in manifest
   - Implement runtime permission checks before sensitive operations
   - Track granted permissions per extension

## Security requirements
1. **Process Isolation**
   - Extension Host must run in a separate process from main and renderer
   - Extensions cannot directly access Node APIs from renderer
   - Extensions cannot bypass the JSON-RPC bridge to access main process resources

2. **Permission Enforcement**
   - All sensitive operations (filesystem, network, secrets) require explicit permissions
   - Permission checks enforced on main process side, not in Extension Host
   - User consent required before granting new permissions at runtime

3. **Secrets Handling**
   - Extensions never receive raw secret values
   - Extensions receive connection handles or secret references only
   - All secret access goes through main process SecretsService
   - Audit log all extension secret access attempts

4. **Input Validation**
   - All messages between main and Extension Host validated against Zod contracts
   - Reject malformed or unauthorized requests
   - Sanitize extension-provided data before displaying in UI

5. **Resource Limits**
   - Implement timeouts for extension calls to prevent hanging
   - Monitor Extension Host memory/CPU usage
   - Terminate runaway extensions that exceed resource limits

## Performance requirements
1. **Lazy Loading**
   - Extensions must not load until their activation event fires
   - Extension Host process starts on-demand, not at application launch (unless extensions are pre-activated)
   - Contribution metadata (commands, views) loaded separately from extension code

2. **Startup Impact**
   - Extension system initialization must not add more than 100ms to application startup
   - No extension code should execute during initial renderer paint

3. **Runtime Performance**
   - IPC call overhead between main and Extension Host < 5ms for simple operations
   - Extension activation time < 500ms for typical extensions
   - Support concurrent extension activation without blocking

4. **Memory Budget**
   - Extension Host base overhead < 50MB when no extensions active
   - Each active extension should use < 100MB on average

## Acceptance criteria
1. Extension Host process launches successfully and establishes JSON-RPC bridge with main process
2. Extensions can be loaded from disk based on manifest files
3. Extensions activate lazily based on activation events (e.g., onCommand)
4. Extensions can register commands that execute when invoked
5. Extensions can contribute views that render in the shell UI
6. Extensions can register connection providers with schema definitions
7. Extensions can register tool implementations callable by agents
8. Permission checks enforce declared capabilities before sensitive operations
9. Extension crashes do not crash main process or renderer
10. Extension Host automatically restarts after crash
11. All IPC contracts defined in packages/api-contracts with Zod schemas
12. Secrets accessed by extensions use handle-based flow (no plaintext exposure)
13. Extension activation does not block UI thread
14. Multiple extensions can be active concurrently without interference
15. Documentation exists for extension API and contribution points
16. Extensions panel renders in the primary sidebar with VS Code-like styling
17. Extensions panel supports enable/disable/uninstall and permission review actions
18. Extensions preferences are available in Settings under Extensions
19. Command palette includes base File and Terminal commands alongside extensions

## Out of scope / Future work
- Extension marketplace UI and browsing experience
- Extension signing, verification, and code scanning
- Publisher verification and trust system
- Extension update mechanism
- Extension development tools (debugger, scaffold, test harness)
- Hot reload during extension development
- Extension telemetry and usage analytics
- Multi-Extension Host support (separate processes per extension)
- Extension sandboxing beyond process isolation (e.g., WASM, containers)
- Extension performance profiling tools
- Extension dependency management and version resolution

## Open questions
- Should each extension run in its own process, or share a single Extension Host? (Decision: shared for MVP, dedicated per-extension later)
- How do we handle extensions that need to spawn child processes?
- What is the maximum number of concurrent active extensions we should support?
- Should extension permissions be granular (per-API) or coarse (categories)?
- How do we version the extension API as the platform evolves?
