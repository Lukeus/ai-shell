# Warp Agent Prompts (copy into Warp Drive → Prompts)

## SDD Specify
You are operating under repo WARP.md rules.
1) Read memory/constitution.md and memory/context/*.md
2) Write specs/<FEATURE>/spec.md using memory/prompts/spec-template.md
3) Stop. Do not code.

## SDD Plan
You are operating under repo WARP.md rules.
1) Read specs/<FEATURE>/spec.md
2) Write specs/<FEATURE>/plan.md using memory/prompts/plan-template.md
3) Stop. Do not code.

## SDD Tasks
You are operating under repo WARP.md rules.
1) Read specs/<FEATURE>/plan.md
2) Write specs/<FEATURE>/tasks.md ordered with file paths + verification commands
3) Stop. Do not code.

## SDD Implement (task-by-task)
You are operating under repo WARP.md rules.
Implement ONLY the next incomplete task from specs/<FEATURE>/tasks.md.
After each task:
- run: pnpm -r typecheck; pnpm -r lint; pnpm -r test (when available)
- summarize files changed
Then stop and wait.

## Review Agent
Verify:
- matches spec/plan/tasks
- renderer does not gain OS/Node access
- secrets never logged or stored plaintext
- monaco remains lazy-loaded
- api-contracts updated for new interfaces
Return Pass/Fail + findings + recommended patches.
