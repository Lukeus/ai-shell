# Extension API Reference

This document describes the current extension manifest schema and runtime API.
All schemas are validated with Zod in `packages/api-contracts`.

## Manifest (package.json)

Required fields:

- `id`: Unique extension ID (e.g. `publisher.extension-name`)
- `name`: Package name
- `version`: Semver string (e.g. `1.0.0`)
- `publisher`: Publisher identifier
- `main`: Entry point file path relative to the extension root
- `activationEvents`: Array of activation events
- `permissions`: Array of permission groups (`filesystem`, `network`, `secrets`, `ui`, `terminal`)

Optional fields:

- `displayName`: Human-readable display name
- `description`: Short description
- `contributes`: Contribution points (commands, views, tools, settings, connectionProviders, mcpServers)

### Contributions

Commands:

- `id`: command ID
- `title`: command label
- `category`: optional grouping label
- `when`: optional visibility condition

Views:

- `id`: view ID
- `name`: view label
- `location`: `primary-sidebar` | `secondary-sidebar` | `panel`
- `icon`: optional icon identifier
- `when`: optional visibility condition

Tools:

- `name`: tool name (unique within extension)
- `description`: tool description
- `inputSchema`: JSON schema for parameters
- `outputSchema`: optional JSON schema for results

Settings:

- `key`: setting key
- `type`: `string` | `number` | `boolean` | `enum`
- `default`: default value
- `description`: optional help text
- `enum`: optional list of allowed values when `type` is `enum`

Connection providers:

- `id`: provider ID
- `name`: provider label
- `description`: optional provider description
- `icon`: optional icon identifier
- `fields`: array of configuration fields
  - `id`: field key
  - `label`: human-readable label
  - `type`: `string` | `number` | `boolean` | `secret` | `select`
  - `required`: optional boolean
  - `defaultValue`: optional default value
  - `options`: optional list of `{ value, label }` for `select`

MCP servers:

- `id`: server ID (unique within extension)
- `name`: server label
- `transport`: `stdio` (v1 supports stdio only)
- `command`: executable path
- `args`: optional array of arguments
- `env`: optional mapping of env var names to connection sources
  - `source`: `config` | `secret`
  - `key`: optional config/secret key (defaults to env var name)
- `connectionProviderId`: optional connection provider to resolve env sources

Notes:
- MCP servers run in the main process and never in the renderer or extension host.
- Secrets are resolved from Connections + safeStorage, never from plaintext in the manifest.

## Activation events

Common examples:

- `onStartup`
- `onCommand:extension.commandId`

## Runtime API (Extension Host)

Currently, extensions receive an API object with:

- `context`: extension context (paths, ID)
- `log(message: string)`: logs a message in Extension Host
- `commands.registerCommand(commandId, handler)`
- `views.registerView(viewId, provider)`
- `tools.registerTool(name, description, inputSchema, handler)`

Future APIs will be added for UI and storage.
