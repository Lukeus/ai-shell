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
export * from './types/app-info';
export * from './types/layout-state';
export * from './types/settings';
export * from './types/workspace';
export * from './types/fs-broker';
export * from './ipc-channels';
export * from './preload-api';
