# 163 - MCP Extension Support - Tasks

## Rules
- Ordered tasks only
- Each task: files to change, verification commands, invariants to protect

## Task 1 - Contracts-first: MCP schemas + manifest contributions
**Files**:
- packages/api-contracts/src/types/mcp.ts (new)
- packages/api-contracts/src/types/extension-contributions.ts
- packages/api-contracts/src/types/extension-manifest.ts
- packages/api-contracts/src/types/settings.ts
- packages/api-contracts/src/ipc-channels.ts
- packages/api-contracts/src/preload-api.ts
- packages/api-contracts/src/index.ts
- packages/api-contracts/src/types/mcp.test.ts (new)

**Work**:
- Define MCP server contribution and status schemas.
- Add contributes.mcpServers to the manifest schema and exports.
- Add Settings schema fields for MCP enablement and connection selection.
- Add IPC channel constants and PreloadAPI surface for MCP.

**Verify**:
- pnpm --filter packages-api-contracts test

**Invariants**:
- P6 (Contracts-first)

---

## Task 2 - Extension host contributions: MCP registry + RPC
**Files**:
- apps/extension-host/src/contribution-registry.ts
- apps/extension-host/src/contribution-registry.test.ts
- apps/extension-host/src/index.ts

**Work**:
- Store MCP server contributions in the registry.
- Add contributions.getMcpServers RPC response.
- Validate contributions against the MCP schema before exposure.

**Verify**:
- pnpm --filter apps-extension-host test

**Invariants**:
- P1 (Process isolation)
- P6 (Contracts-first)

---

## Task 3 - Main: MCP server manager + settings integration
**Files**:
- apps/electron-shell/src/main/services/McpServerManager.ts (new)
- apps/electron-shell/src/main/services/SettingsService.ts
- apps/electron-shell/src/main/services/ConnectionProviderRegistry.ts (if mapping needed)
- apps/electron-shell/src/main/ipc/mcp.ts (new)
- apps/electron-shell/src/main/ipc-handlers.ts
- apps/electron-shell/src/main/services/McpServerManager.test.ts (new)

**Work**:
- Resolve MCP server definitions from extension contributions and settings.
- Start/stop stdio MCP servers with allowlisted env and secrets resolved from ConnectionsService.
- Track status, errors, and tool discovery metadata.
- Expose list/start/stop/status IPC handlers.

**Verify**:
- pnpm --filter apps-electron-shell test

**Invariants**:
- P1 (Process isolation)
- P3 (Secrets)
- P6 (Contracts-first)

---

## Task 4 - MCP tool bridge to broker
**Files**:
- apps/electron-shell/src/main/services/McpToolBridge.ts (new)
- apps/electron-shell/src/main/services/agent-host-manager.ts
- apps/electron-shell/src/main/services/McpToolBridge.test.ts (new)

**Work**:
- List tools from MCP servers and register them in broker-main.
- Route tool execution to MCP servers and validate outputs.
- Unregister tools when servers stop or extensions are disabled.

**Verify**:
- pnpm --filter apps-electron-shell test

**Invariants**:
- P1 (Process isolation)
- P6 (Contracts-first)

---

## Task 5 - Preload + renderer UI + screenshot
**Files**:
- apps/electron-shell/src/preload/index.ts
- apps/electron-shell/src/renderer/components/extensions/ExtensionsPanel.tsx
- apps/electron-shell/src/renderer/hooks/useMcpServers.ts (new)
- apps/electron-shell/src/renderer/vite-env.d.ts
- specs/163-mcp-extension-support/screenshots/ (new)

**Work**:
- Expose window.api.mcp in preload with typed calls.
- Add MCP server list UI with enable/disable controls and status display.
- Capture a screenshot for the UI change.

**Verify**:
- pnpm --filter apps-electron-shell test

**Invariants**:
- P1 (Process isolation)
- P4 (UI discipline)
- Screenshot requirement

---

## Task 6 - Docs and examples
**Files**:
- docs/extensions/api-reference.md
- docs/extensions/getting-started.md
- docs/architecture/architecture.md

**Work**:
- Document mcpServers contribution schema and usage.
- Add a minimal MCP extension example entry.
- Update architecture docs for MCP server lifecycle.

**Verify**:
- pnpm --filter apps-electron-shell test

**Invariants**:
- P1 (Process isolation)
- P3 (Secrets)

---

## Task 7 - IPC handlers refactor (guardrail follow-up)
**Files**:
- apps/electron-shell/src/main/ipc-handlers.ts
- apps/electron-shell/src/main/ipc/*

**Work**:
- Split ipc-handlers.ts into feature-scoped modules.
- Keep registerIPCHandlers as a thin orchestrator.

**Verify**:
- pnpm --filter apps-electron-shell test

**Invariants**:
- P1 (Process isolation)
- P6 (Contracts-first)

---

## Task 8 - Agent host manager split (guardrail follow-up)
**Files**:
- apps/electron-shell/src/main/services/agent-host-manager.ts
- apps/electron-shell/src/main/services/agent-host/*

**Work**:
- Split tool registration, tool call handling, and run orchestration into dedicated modules.
- Keep agent-host-manager.ts as a thin lifecycle orchestrator.

**Verify**:
- pnpm --filter apps-electron-shell test

**Invariants**:
- P1 (Process isolation)
- P6 (Contracts-first)

---

## Task 9 - Main bootstrap split (guardrail follow-up)
**Files**:
- apps/electron-shell/src/main/index.ts
- apps/electron-shell/src/main/bootstrap/*

**Work**:
- Move extension/agent host bootstrap, IPC registration, and window creation into focused modules.
- Keep index.ts as a small entrypoint that wires modules together.

**Verify**:
- pnpm --filter apps-electron-shell test

**Invariants**:
- P1 (Process isolation)
- P6 (Contracts-first)
