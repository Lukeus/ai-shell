/**
 * API Contracts Package
 * 
 * This package is the single source of truth for all IPC contracts, types,
 * and interfaces shared between processes in the ai-shell application.
 * 
 * Following P6 (Contracts-first): All IPC, tool calls, agent events, and
 * extension contributions must be defined here using Zod schemas.
 */

// Export all types and schemas
export * from './types/agent-events';
export * from './types/agent-runs';
export * from './types/agent-tools';
export * from './types/app-info';
export * from './types/audit';
export * from './types/connections';
export * from './types/diagnostics';
export * from './types/extension-api';
export * from './types/extension-contributions';
export * from './types/extension-events';
export * from './types/extension-host-protocol';
export * from './types/extension-manifest';
export * from './types/extension-permissions';
export * from './types/extension-registry';
export * from './types/fs-broker';
export * from './types/layout-state';
export * from './types/output';
export * from './types/scm';
export * from './types/search';
export * from './types/secrets';
export * from './types/sdd';
export * from './types/settings';
export * from './types/terminal';
export * from './types/window-state';
export * from './types/workspace';
export * from './ipc-channels';
export * from './preload-api';
