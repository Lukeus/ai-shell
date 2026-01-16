# 163 - MCP Extension Support - Technical Plan

## Constitution alignment
Constitution alignment: yes. Aligned with memory/constitution.md (P1, P2, P3, P5, P6, P7).

## Architecture changes
- Extend extension manifests with mcpServers contributions and propagate them through the extension host contribution registry.
- Add a main-process McpServerManager to resolve configs, start/stop stdio servers, and track status.
- Add a lightweight MCP stdio client to list tools and execute tool calls from main.
- Bridge MCP tools into broker-main with extension-scoped tool IDs.
- Persist per-server enablement and connection selection in SettingsService.

## Contracts (api-contracts updates)
- Add MCP schemas: McpServerContribution, McpServerStatus, McpToolDefinition, McpToolCall.
- Add mcpServers to ExtensionManifestSchema and extension contributions types.
- Add IPC channels for MCP list, status, start/stop, and tool refresh.
- Extend PreloadAPI with window.api.mcp surface and update exports.

## IPC + process boundaries
- Renderer uses window.api.mcp for listing servers and toggling status.
- Main process owns MCP server lifecycle and all tool execution.
- Extension host only supplies contribution metadata; it never starts MCP servers.

## UI components and routes
- Update Extensions panel (or Settings) with an MCP servers section.
- Add a small MCP status row component and a hook to load server status.
- Include a screenshot in specs/163-mcp-extension-support/screenshots/.

## Data model changes
- Extend Settings schema with mcpServers state (enabled flag, selected connectionId).
- No secrets stored in settings; only connection references.

## Failure modes + recovery
- Server fails to start: show error state and allow retry.
- Tool discovery fails: keep server running but mark tools unavailable.
- Connection missing or revoked: block start and surface message.

## Testing strategy
- Unit: MCP schema validation, McpServerManager lifecycle, env resolution.
- Integration: stub MCP server to verify tool discovery and tool execution.
- UI: MCP server list renders and toggles state.

## Rollout / migration
- Default to disabled for new MCP servers until user enables.
- Backward compatible with existing settings and extensions.

## Risks + mitigations
- Untrusted server processes: run with allowlisted env, user consent, and crash isolation.
- Tool list drift: refresh tools on server start and on demand.
- Misconfigured command paths: validate and surface clear errors.

## Done definition
- MCP contributions validated and visible in UI.
- Servers start/stop from main with status events.
- MCP tools registered in broker and callable by agent runtime.
- Contracts, tests, and screenshot complete.
