import { z } from 'zod';

/**
 * Terminal session metadata.
 * 
 * Represents a PTY session managed by the main process.
 * Security: Session IDs are UUIDs to prevent enumeration attacks.
 */
export const TerminalSessionSchema = z.object({
  /** Unique session ID (UUID v4) */
  sessionId: z.string().uuid(),
  
  /** Display title for the terminal tab */
  title: z.string(),
  
  /** Current working directory (absolute path within workspace) */
  cwd: z.string(),
  
  /** Session creation timestamp (ISO 8601) */
  createdAt: z.string().datetime(),
  
  /** Session status */
  status: z.enum(['running', 'exited']),
  
  /** Exit code (if status is 'exited') */
  exitCode: z.number().optional(),
});

/**
 * TerminalSession type inferred from schema.
 */
export type TerminalSession = z.infer<typeof TerminalSessionSchema>;

/**
 * Request to create a new terminal session.
 * 
 * Main process validates cwd is within workspace before spawning PTY.
 * Environment variables are sanitized to prevent secrets exposure.
 */
export const CreateTerminalRequestSchema = z.object({
  /** Initial working directory (absolute path within workspace) */
  cwd: z.string(),
  
  /** Optional custom environment variables (merged with process.env) */
  env: z.record(z.string()).optional(),
  
  /** Optional custom shell path (defaults to user's default shell) */
  shell: z.string().optional(),
  
  /** Initial terminal size */
  cols: z.number().int().min(1).default(80),
  rows: z.number().int().min(1).default(24),
});

/**
 * CreateTerminalRequest type inferred from schema.
 */
export type CreateTerminalRequest = z.infer<typeof CreateTerminalRequestSchema>;

/**
 * Response from terminal creation.
 */
export const CreateTerminalResponseSchema = z.object({
  /** Created terminal session metadata */
  session: TerminalSessionSchema,
});

/**
 * CreateTerminalResponse type inferred from schema.
 */
export type CreateTerminalResponse = z.infer<typeof CreateTerminalResponseSchema>;

/**
 * Request to write data to a terminal session.
 * 
 * Main process validates sessionId exists before writing to PTY stdin.
 */
export const TerminalWriteRequestSchema = z.object({
  /** Session ID to write to */
  sessionId: z.string().uuid(),
  
  /** Data to write (e.g., user typed characters, control sequences) */
  data: z.string(),
});

/**
 * TerminalWriteRequest type inferred from schema.
 */
export type TerminalWriteRequest = z.infer<typeof TerminalWriteRequestSchema>;

/**
 * Request to resize a terminal session.
 * 
 * Main process validates sessionId and forwards resize to PTY.
 */
export const TerminalResizeRequestSchema = z.object({
  /** Session ID to resize */
  sessionId: z.string().uuid(),
  
  /** New terminal width in columns */
  cols: z.number().int().min(1),
  
  /** New terminal height in rows */
  rows: z.number().int().min(1),
});

/**
 * TerminalResizeRequest type inferred from schema.
 */
export type TerminalResizeRequest = z.infer<typeof TerminalResizeRequestSchema>;

/**
 * Request to close a terminal session.
 * 
 * Main process validates sessionId and kills PTY process.
 */
export const TerminalCloseRequestSchema = z.object({
  /** Session ID to close */
  sessionId: z.string().uuid(),
});

/**
 * TerminalCloseRequest type inferred from schema.
 */
export type TerminalCloseRequest = z.infer<typeof TerminalCloseRequestSchema>;

/**
 * Terminal data event payload (PTY stdout/stderr).
 * 
 * Sent from main → renderer when PTY outputs data.
 * Security: NEVER logged (may contain secrets like passwords).
 */
export const TerminalDataEventSchema = z.object({
  /** Session ID that emitted data */
  sessionId: z.string().uuid(),
  
  /** Output data from PTY (ANSI escape sequences, text, etc.) */
  data: z.string(),
});

/**
 * TerminalDataEvent type inferred from schema.
 */
export type TerminalDataEvent = z.infer<typeof TerminalDataEventSchema>;

/**
 * Terminal exit event payload.
 * 
 * Sent from main → renderer when PTY process exits.
 */
export const TerminalExitEventSchema = z.object({
  /** Session ID that exited */
  sessionId: z.string().uuid(),
  
  /** Exit code from PTY process */
  exitCode: z.number(),
});

/**
 * TerminalExitEvent type inferred from schema.
 */
export type TerminalExitEvent = z.infer<typeof TerminalExitEventSchema>;

/**
 * Request to list all active terminal sessions.
 */
export const ListTerminalsRequestSchema = z.object({});

/**
 * ListTerminalsRequest type inferred from schema.
 */
export type ListTerminalsRequest = z.infer<typeof ListTerminalsRequestSchema>;

/**
 * Response from listing terminal sessions.
 */
export const ListTerminalsResponseSchema = z.object({
  /** Array of active terminal sessions */
  sessions: z.array(TerminalSessionSchema),
});

/**
 * ListTerminalsResponse type inferred from schema.
 */
export type ListTerminalsResponse = z.infer<typeof ListTerminalsResponseSchema>;
