# ADR-0002 - Command Palette Scope
- Decision: Use a Workbench-level Command Palette (VS Code-style), not Monaco's editor palette.
- Rationale: Extension commands must be global and not editor-scoped.
- Implications: Command palette UI lives in renderer; commands pulled from extension registry via main IPC.
