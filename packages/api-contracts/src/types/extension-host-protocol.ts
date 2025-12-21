import { z } from 'zod';

/**
 * JSON-RPC 2.0 request schema for Extension Host operations.
 * Sent from main process to Extension Host.
 */
export const ExtHostRequestSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('activateExtension'),
    params: z.object({
      extensionId: z.string(),
    }),
  }),
  z.object({
    method: z.literal('deactivateExtension'),
    params: z.object({
      extensionId: z.string(),
    }),
  }),
  z.object({
    method: z.literal('executeCommand'),
    params: z.object({
      command: z.string(),
      args: z.array(z.unknown()),
    }),
  }),
  z.object({
    method: z.literal('getContributions'),
    params: z.object({}),
  }),
]);

/**
 * TypeScript type for Extension Host request.
 */
export type ExtHostRequest = z.infer<typeof ExtHostRequestSchema>;

/**
 * JSON-RPC 2.0 response schema for Extension Host operations.
 * Sent from Extension Host to main process.
 */
export const ExtHostResponseSchema = z.object({
  /** Request ID (matches request) */
  id: z.string(),
  
  /** Result data (present on success) */
  result: z.unknown().optional(),
  
  /** Error object (present on failure) */
  error: z.object({
    code: z.number(),
    message: z.string(),
  }).optional(),
});

/**
 * TypeScript type for Extension Host response.
 */
export type ExtHostResponse = z.infer<typeof ExtHostResponseSchema>;

/**
 * Notification schema from main to Extension Host (no response expected).
 */
export const MainToExtHostNotificationSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('shutdown'),
    params: z.object({}),
  }),
  z.object({
    method: z.literal('reloadExtensions'),
    params: z.object({}),
  }),
]);

/**
 * TypeScript type for main to Extension Host notification.
 */
export type MainToExtHostNotification = z.infer<typeof MainToExtHostNotificationSchema>;
