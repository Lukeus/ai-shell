# 120 Agent Tools - Technical Plan
## Architecture changes
- Introduce `packages/agent-tools` as a shared package used by broker-main and
  agent-runtime for tool registration and execution helpers.
- Keep ToolCallEnvelope/ToolCallResult contracts in `packages/api-contracts`.
- broker-main delegates tool lookup/execution to agent-tools registry.

## Package design
- `packages/agent-tools` exports:
  - `ToolDefinition` interface (id, description, input schema, output schema,
    category, execute handler).
  - `ToolRegistry` with register/unregister/list/get.
  - `ToolExecutor` helper for validating inputs/outputs with Zod and invoking handlers.
- No OS access or policy logic in agent-tools.

## Broker-main integration
- Replace internal handler map with `ToolRegistry`.
- Use ToolExecutor helper to validate outputs before returning ToolCallResult.
- Audit logging remains in broker-main.

## Files and entry points
- `packages/agent-tools/src/index.ts`
- `packages/agent-tools/src/registry.ts`
- `packages/agent-tools/src/executor.ts`
- `packages/broker-main/src/index.ts`

## Testing strategy
- Unit tests for registry (register/list/get/unregister).
- Unit tests for executor validation and error handling.
- broker-main tests updated to use registry-backed tool execution.

## Rollout
- Start with built-in tools and extension tool registration.
- Expand to other tool categories later (repo/net/etc.).

## Done definition
- Agent-tools package builds and exports registry/executor.
- broker-main uses agent-tools registry for tool calls.
- Tests cover registry/executor and broker-main integration.
