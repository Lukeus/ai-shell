# Extensions

This directory documents the extension system for ai-shell. Extensions run in a
separate Extension Host process and communicate with the main process over
JSON-RPC. The renderer talks to extensions only through the preload API.

## Architecture overview

- Extension Host (Node.js): loads extensions, runs activation, registers commands
  and contributions.
- Main process: spawns the Extension Host, manages lifecycle, permissions, and
  registry data, and exposes extension APIs over IPC.
- Renderer: displays extension UI and uses `window.api.extensions` to interact
  with extensions.

## Key docs

- `api-reference.md`: Extension manifest schema, contributions, and runtime API.
- `getting-started.md`: Build and install your first extension.
- `sample-extension/`: A minimal working extension example.
