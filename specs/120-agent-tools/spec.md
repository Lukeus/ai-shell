# 120 Agent Tools Package
## Problem / Why
We need a dedicated `packages/agent-tools` package to centralize tool schemas,
registries, and execution helpers used by agent-runtime, broker-main, and main.
Today tool concepts are scattered across api-contracts and broker-main, which
makes it harder to enforce consistent validation, policy metadata, and testing.

## Goals
- Define a shared tool registry and helper layer in `packages/agent-tools`.
- Keep tool schemas in `packages/api-contracts` (contracts-first).
- Provide runtime helpers for tool registration, validation, and execution.
- Make broker-main consume agent-tools for tool discovery and execution wiring.
- Keep process isolation intact (no OS access in shared package).

## Non-goals
- Implementing UI for tool permissions.
- Replacing broker-main policy logic.
- Adding network tool implementations.

## User stories
- As an agent runtime, I can register tools with schemas and execute them safely.
- As main, I can list available tools and enforce policy on each call.
- As a security reviewer, I can audit tool usage with consistent metadata.

## Functional requirements
- `packages/agent-tools` exposes:
  - Tool registry (register/unregister/list).
  - Schema validation helpers (inputs/outputs) using Zod.
  - Tool execution helpers (invoke, handle errors).
- Broker-main uses agent-tools registry instead of ad-hoc handler maps.
- Tool metadata includes id, description, input schema, output schema (optional),
  and tool category (e.g., fs/repo/net/other).
- API contracts remain source-of-truth for ToolCallEnvelope/ToolCallResult.

## Security requirements
- No direct OS access in `packages/agent-tools`.
- Inputs/outputs validated with Zod schemas before execution.
- Tool execution errors are sanitized (no secret leakage).

## Acceptance criteria
- `packages/agent-tools` is wired with build/test scripts and exports.
- broker-main uses the shared registry for tool execution.
- At least one tool registration path (extension tools or built-ins) goes through
  agent-tools.

## Open questions
- Should tool categories be enforced at registration time or optional metadata?
- Do we want a separate tool registry per run or a global registry?
