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
- `contributes`: Contribution points (commands, views, tools, settings, connectionProviders)

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

## Activation events

Common examples:

- `onStartup`
- `onCommand:extension.commandId`

## Runtime API (Extension Host)

Currently, extensions receive an API object with:

- `context`: extension context (paths, ID)
- `log(message: string)`: logs a message in Extension Host

Future APIs will be added for commands, views, tools, UI, and storage.
