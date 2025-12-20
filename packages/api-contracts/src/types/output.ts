import { z } from 'zod';

/**
 * Output channel metadata.
 * 
 * Represents a named output channel (e.g., "Build", "Extension Host", "Agent").
 * Channels are created on-demand when first written to.
 */
export const OutputChannelSchema = z.object({
  /** Unique channel ID */
  id: z.string(),
  
  /** Display name for the channel */
  name: z.string(),
  
  /** Total number of lines in the channel */
  lineCount: z.number().int().min(0),
  
  /** Channel creation timestamp (ISO 8601) */
  createdAt: z.string().datetime(),
});

/**
 * OutputChannel type inferred from schema.
 */
export type OutputChannel = z.infer<typeof OutputChannelSchema>;

/**
 * Output line entry.
 * 
 * Represents a single line appended to an output channel.
 */
export const OutputLineSchema = z.object({
  /** Line number (1-indexed) */
  lineNumber: z.number().int().min(1),
  
  /** Line content (without newline) */
  content: z.string(),
  
  /** Line timestamp (ISO 8601) */
  timestamp: z.string().datetime(),
  
  /** Optional severity level for colored output */
  severity: z.enum(['info', 'warning', 'error']).optional(),
});

/**
 * OutputLine type inferred from schema.
 */
export type OutputLine = z.infer<typeof OutputLineSchema>;

/**
 * Request to append lines to an output channel.
 * 
 * Main process creates channel if it doesn't exist.
 * Lines are appended atomically (all or none).
 */
export const AppendOutputRequestSchema = z.object({
  /** Channel ID to append to */
  channelId: z.string(),
  
  /** Lines to append (array of strings, newlines auto-added) */
  lines: z.array(z.string()).min(1),
  
  /** Optional severity for all lines */
  severity: z.enum(['info', 'warning', 'error']).optional(),
});

/**
 * AppendOutputRequest type inferred from schema.
 */
export type AppendOutputRequest = z.infer<typeof AppendOutputRequestSchema>;

/**
 * Request to clear an output channel.
 * 
 * Removes all lines from the channel; channel metadata is preserved.
 */
export const ClearOutputRequestSchema = z.object({
  /** Channel ID to clear */
  channelId: z.string(),
});

/**
 * ClearOutputRequest type inferred from schema.
 */
export type ClearOutputRequest = z.infer<typeof ClearOutputRequestSchema>;

/**
 * Request to list all output channels.
 */
export const ListOutputChannelsRequestSchema = z.object({});

/**
 * ListOutputChannelsRequest type inferred from schema.
 */
export type ListOutputChannelsRequest = z.infer<typeof ListOutputChannelsRequestSchema>;

/**
 * Response from listing output channels.
 */
export const ListOutputChannelsResponseSchema = z.object({
  /** Array of output channels */
  channels: z.array(OutputChannelSchema),
});

/**
 * ListOutputChannelsResponse type inferred from schema.
 */
export type ListOutputChannelsResponse = z.infer<typeof ListOutputChannelsResponseSchema>;

/**
 * Request to read lines from an output channel.
 * 
 * Supports pagination for large channels (10K+ lines).
 */
export const ReadOutputRequestSchema = z.object({
  /** Channel ID to read from */
  channelId: z.string(),
  
  /** Start line number (1-indexed, inclusive) */
  startLine: z.number().int().min(1).default(1),
  
  /** Maximum number of lines to return */
  maxLines: z.number().int().min(1).max(10000).default(1000),
});

/**
 * ReadOutputRequest type inferred from schema.
 */
export type ReadOutputRequest = z.infer<typeof ReadOutputRequestSchema>;

/**
 * Response from reading output channel lines.
 */
export const ReadOutputResponseSchema = z.object({
  /** Channel metadata */
  channel: OutputChannelSchema,
  
  /** Array of lines */
  lines: z.array(OutputLineSchema),
  
  /** Total number of lines in the channel */
  totalLines: z.number().int().min(0),
  
  /** Whether there are more lines after this batch */
  hasMore: z.boolean(),
});

/**
 * ReadOutputResponse type inferred from schema.
 */
export type ReadOutputResponse = z.infer<typeof ReadOutputResponseSchema>;

/**
 * Output append event payload.
 * 
 * Sent from main → renderer when lines are appended to a channel.
 * Renderer can subscribe to specific channels or all channels.
 */
export const OutputAppendEventSchema = z.object({
  /** Channel ID that received new lines */
  channelId: z.string(),
  
  /** Newly appended lines */
  lines: z.array(OutputLineSchema),
});

/**
 * OutputAppendEvent type inferred from schema.
 */
export type OutputAppendEvent = z.infer<typeof OutputAppendEventSchema>;

/**
 * Output clear event payload.
 * 
 * Sent from main → renderer when a channel is cleared.
 */
export const OutputClearEventSchema = z.object({
  /** Channel ID that was cleared */
  channelId: z.string(),
});

/**
 * OutputClearEvent type inferred from schema.
 */
export type OutputClearEvent = z.infer<typeof OutputClearEventSchema>;
