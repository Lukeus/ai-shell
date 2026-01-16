# 163 - MCP Extension Support

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P2, P3, P5, P6, P7).

## Problem / Why
- Extensions can only contribute commands, views, tools, and connection providers. They cannot ship MCP servers or MCP tool catalogs.
- MCP integrations must be added manually, which blocks the VS Code MCP extension ecosystem and limits agent tooling.
- There is no lifecycle, status, or policy surface for MCP servers tied to extensions.

## Goals
- Allow extensions to declare MCP servers in manifests and have them discovered, validated, and managed.
- Run MCP servers under main-process control with allowlisted env and OS-backed secrets only.
- Expose MCP tools to the agent runtime via existing broker and tool-call paths.
- Provide UI to view MCP servers, status, and enablement with a screenshot.

## Decisions
- MCP servers are treated as extension contributions (contributes.mcpServers) and validated in api-contracts.
- MCP server processes are started by main process services and never from renderer or extension host.
- MCP tools are surfaced as broker tools with stable IDs and audit logging.

## Non-goals
- Marketplace signing or remote registry updates (handled by spec 090).
- Supporting HTTP/SSE MCP transports in this phase (stdio only).
- Allowing extensions to bypass ConnectionsService or safeStorage for secrets.
- UI redesigns or library changes.

## User stories
1. As a user, I can install an MCP extension and see its servers listed and controllable.
2. As a user, I can enable a server and see its tools appear in agent runs.
3. As an admin, I can disable or revoke MCP servers tied to an extension.
4. As an extension author, I can declare MCP servers with a clear manifest schema.
5. As a security reviewer, I can confirm secrets never reach the renderer or logs.

## UX requirements
- MCP servers display in the Extensions panel (or a dedicated Settings section) with status and errors.
- Users can enable/disable per server, with confirmation for first-run.
- Status changes are visible without requiring a restart.
- UI changes include a screenshot in specs/163-mcp-extension-support/screenshots/.

## Functional requirements
- Add a contrib schema for mcpServers (id, name, transport, command, args, env mapping, connectionProviderId).
- Validate MCP server contributions in api-contracts and extension host registry.
- Persist per-server enablement and selected connection mapping in SettingsService.
- Main process spawns MCP servers on demand with allowlisted env and resolved secrets.
- Discover MCP tools and register them in broker-main with extension-scoped IDs.
- Add IPC for listing servers, statuses, and start/stop controls.
- Renderer uses window.api.mcp only; no direct OS or MCP access.

## Security requirements
- Renderer remains sandboxed; all MCP calls handled in main.
- No plaintext secrets in manifests, logs, or renderer state.
- Environment variables for MCP servers are allowlisted and sourced from ConnectionsService.
- PermissionService records user consent for MCP server enablement and tool access.

## Performance requirements
- MCP servers start lazily (on demand or explicit enable).
- Tool discovery is cached per server and refreshed on change events only.
- No impact to Monaco lazy-load or initial renderer chunk size.

## Acceptance criteria
- Extensions can declare mcpServers and appear in the UI.
- MCP servers start/stop via window.api.mcp and report status.
- MCP tool list appears in agent tool registry and is callable.
- Secrets flow only through safeStorage and main process.
- IPC contracts updated and tests pass.
- Screenshot added for MCP server UI.

## Out of scope / Future work
- HTTP/SSE MCP transports.
- Marketplace signing enforcement (spec 090).
- Cross-device sync for MCP server settings.

## Open questions
- Do we require MCP servers to be stdio-only for v1?
- Should each MCP server bind to a specific connection instance or allow selection?
- How should we handle per-workspace enablement vs global?
- Do we need a dedicated MCP host process separate from main?
