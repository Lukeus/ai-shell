import { z } from 'zod';

/**
 * Zod schema for layout state persistence.
 * Defines panel sizes and collapsed states for the shell layout.
 * 
 * All dimensions are in pixels and validated to ensure UI consistency:
 * - Sidebar widths: 200-600px (default: 300px)
 * - Bottom panel height: 100-600px (default: 200px)
 * 
 * @example
 * ```typescript
 * const state = LayoutStateSchema.parse({
 *   primarySidebarWidth: 350,
 *   primarySidebarCollapsed: false,
 *   // ... other fields use defaults
 * });
 * ```
 */
export const LayoutStateSchema = z.object({
  /** Primary sidebar width in pixels (left sidebar, min: 200, max: 600, default: 300) */
  primarySidebarWidth: z.number().int().min(200).max(600).default(300),
  
  /** Secondary sidebar width in pixels (right sidebar, min: 200, max: 600, default: 300) */
  secondarySidebarWidth: z.number().int().min(200).max(600).default(300),
  
  /** Bottom panel height in pixels (min: 100, max: 600, default: 200) */
  bottomPanelHeight: z.number().int().min(100).max(600).default(200),
  
  /** Whether the primary sidebar is collapsed */
  primarySidebarCollapsed: z.boolean().default(false),
  
  /** Whether the secondary sidebar is collapsed (default: true, hidden by default) */
  secondarySidebarCollapsed: z.boolean().default(true),
  
  /** Whether the bottom panel is collapsed */
  bottomPanelCollapsed: z.boolean().default(false),
  
  /** Active icon in the activity bar */
  activeActivityBarIcon: z.enum([
    'explorer',
    'search',
    'source-control',
    'run-debug',
    'extensions',
    'sdd',
    'settings'
  ]).default('explorer'),
});

/**
 * TypeScript type inferred from LayoutStateSchema.
 * Used for localStorage persistence and React state management.
 * 
 * This type contains only UI dimensions and boolean flags — no secrets or sensitive data.
 */
export type LayoutState = z.infer<typeof LayoutStateSchema>;

/**
 * Default layout state for new workspaces or reset.
 * All fields use their schema-defined defaults:
 * - Sidebars: 300px wide, primary visible, secondary hidden
 * - Bottom panel: 200px tall, visible
 * - Activity bar: Explorer icon active
 */
export const DEFAULT_LAYOUT_STATE: LayoutState = LayoutStateSchema.parse({});
