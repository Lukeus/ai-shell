# Plan - IPC Hardening and Agent Controls

## Assumptions
- Result envelope pattern (handleSafe/invokeSafe) is the preferred IPC error model.
- Agent run retry should re-run the last request without changing the run ID.
- Extension command results are expected to be JSON-serializable.

## Architecture decisions
1. **Contracts-first for extensions**
   - Add ExtensionExecuteCommandRequest schema.
   - Reuse PermissionRequest schema for permission requests.
   - Validate outputs as JsonValue.

2. **Result envelopes for extension IPC**
   - Use handleSafe in main for execute-command and request-permission.
   - Use invokeSafe in preload and return Result wrappers.

3. **Agent run control path**
   - Add cancel control message from main to agent-host.
   - Cache the last start request per run in main to support retry.
   - Clear run events in AgentRunStore before retry.

4. **Agent event publish resilience**
   - Catch appendEvent failures and log diagnostics without interrupting publish.
   - Keep renderer publish guarded by schema validation.

5. **Monaco worker lazy-load**
   - Remove monacoWorkers from renderer entry.
   - Dynamically import monacoWorkers in EditorLoader before MonacoEditor load.

6. **Anti-monolith split**
   - Extract agent IPC handlers into `apps/electron-shell/src/main/ipc/agents.ts`.
   - Extract extension IPC handlers into `apps/electron-shell/src/main/ipc/extensions.ts`.
   - Keep registerIPCHandlers as a thin coordinator.

7. **Extension Host sandboxing (VM/isolate)**
   - Load extension code into a VM context with no Node built-ins.
   - Provide a minimal CommonJS wrapper with `exports`/`module`, but disallow `require`.
   - Expose a curated Extension API only (no raw JSON-RPC).

8. **Extension registration + activation wiring**
   - On startup, register enabled extensions with Extension Host.
   - Pull contributions and populate ExtensionCommandService/ExtensionViewService/ExtensionToolService.
   - Activate extensions on demand (e.g., `onCommand:*`) before execution.

9. **Tool schema validation**
   - Validate extension tool inputs/outputs using manifest JSON Schema.
   - Register per-tool schemas with BrokerMain instead of JsonValueSchema.

10. **Agent allowlist guard**
   - Treat backend tools like `repo.list` as reserved (exempt from allowlist checks).

## Testing strategy
- Unit: AgentRunStore retry reset, agent IPC cancel/retry, extension IPC Result handling.
- Manual: start/cancel/retry run in Agents panel, execute extension command, confirm no Monaco workers in initial chunk.

## Security checklist
- No secrets in logs or IPC payloads.
- All IPC inputs validated with Zod schemas.
- Renderer remains sandboxed (no new Node/Electron access).
