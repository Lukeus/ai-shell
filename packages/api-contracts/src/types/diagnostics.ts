import { z } from 'zod';

/**
 * Diagnostic severity levels (aligned with LSP DiagnosticSeverity).
 * 
 * Maps to LSP standard: Error (1), Warning (2), Information (3), Hint (4).
 */
export const DiagnosticSeveritySchema = z.enum(['error', 'warning', 'info', 'hint']);

/**
 * DiagnosticSeverity type inferred from schema.
 */
export type DiagnosticSeverity = z.infer<typeof DiagnosticSeveritySchema>;

/**
 * Source location within a file.
 * 
 * Represents a range in a text document (line and column are 1-indexed).
 */
export const DiagnosticLocationSchema = z.object({
  /** Start line number (1-indexed) */
  startLine: z.number().int().min(1),
  
  /** Start column number (1-indexed) */
  startColumn: z.number().int().min(1),
  
  /** End line number (1-indexed) */
  endLine: z.number().int().min(1),
  
  /** End column number (1-indexed) */
  endColumn: z.number().int().min(1),
});

/**
 * DiagnosticLocation type inferred from schema.
 */
export type DiagnosticLocation = z.infer<typeof DiagnosticLocationSchema>;

/**
 * Diagnostic entry (error, warning, info, hint).
 * 
 * Represents a single problem in a file (e.g., TypeScript error, ESLint warning).
 */
export const DiagnosticSchema = z.object({
  /** Unique diagnostic ID (UUID) */
  id: z.string().uuid(),
  
  /** Severity level */
  severity: DiagnosticSeveritySchema,
  
  /** Diagnostic message */
  message: z.string(),
  
  /** Absolute path to file containing the diagnostic */
  filePath: z.string(),
  
  /** Location within the file */
  location: DiagnosticLocationSchema,
  
  /** Source of the diagnostic (e.g., "TypeScript", "ESLint", "Stylelint") */
  source: z.string(),
  
  /** Optional diagnostic code (e.g., "TS2304", "no-unused-vars") */
  code: z.string().optional(),
  
  /** Optional related information (additional locations) */
  relatedInformation: z.array(
    z.object({
      message: z.string(),
      filePath: z.string(),
      location: DiagnosticLocationSchema,
    })
  ).optional(),
  
  /** Diagnostic creation timestamp (ISO 8601) */
  createdAt: z.string().datetime(),
});

/**
 * Diagnostic type inferred from schema.
 */
export type Diagnostic = z.infer<typeof DiagnosticSchema>;

/**
 * Request to publish diagnostics for a file.
 * 
 * Main process replaces all diagnostics for the file from the given source.
 * If diagnostics array is empty, clears all diagnostics for that file+source.
 */
export const PublishDiagnosticsRequestSchema = z.object({
  /** Absolute path to file */
  filePath: z.string(),
  
  /** Source of diagnostics (e.g., "TypeScript", "ESLint") */
  source: z.string(),
  
  /** Array of diagnostics for the file (empty array clears diagnostics) */
  diagnostics: z.array(DiagnosticSchema),
});

/**
 * PublishDiagnosticsRequest type inferred from schema.
 */
export type PublishDiagnosticsRequest = z.infer<typeof PublishDiagnosticsRequestSchema>;

/**
 * Request to clear diagnostics.
 * 
 * Clears diagnostics by file path and/or source.
 */
export const ClearDiagnosticsRequestSchema = z.object({
  /** Optional file path to clear (clears all files if omitted) */
  filePath: z.string().optional(),
  
  /** Optional source to clear (clears all sources if omitted) */
  source: z.string().optional(),
});

/**
 * ClearDiagnosticsRequest type inferred from schema.
 */
export type ClearDiagnosticsRequest = z.infer<typeof ClearDiagnosticsRequestSchema>;

/**
 * Request to list all diagnostics.
 * 
 * Supports filtering by severity and source.
 */
export const ListDiagnosticsRequestSchema = z.object({
  /** Optional severity filter */
  severity: DiagnosticSeveritySchema.optional(),
  
  /** Optional source filter */
  source: z.string().optional(),
});

/**
 * ListDiagnosticsRequest type inferred from schema.
 */
export type ListDiagnosticsRequest = z.infer<typeof ListDiagnosticsRequestSchema>;

/**
 * Response from listing diagnostics.
 */
export const ListDiagnosticsResponseSchema = z.object({
  /** Array of diagnostics (sorted by severity, then file path) */
  diagnostics: z.array(DiagnosticSchema),
  
  /** Summary counts by severity */
  summary: z.object({
    errorCount: z.number().int().min(0),
    warningCount: z.number().int().min(0),
    infoCount: z.number().int().min(0),
    hintCount: z.number().int().min(0),
  }),
});

/**
 * ListDiagnosticsResponse type inferred from schema.
 */
export type ListDiagnosticsResponse = z.infer<typeof ListDiagnosticsResponseSchema>;

/**
 * Diagnostics update event payload.
 * 
 * Sent from main → renderer when diagnostics are added, updated, or removed.
 */
export const DiagnosticsUpdateEventSchema = z.object({
  /** File path that received diagnostic updates */
  filePath: z.string(),
  
  /** Source of the diagnostics */
  source: z.string(),
  
  /** Updated diagnostics for the file+source (empty if cleared) */
  diagnostics: z.array(DiagnosticSchema),
});

/**
 * DiagnosticsUpdateEvent type inferred from schema.
 */
export type DiagnosticsUpdateEvent = z.infer<typeof DiagnosticsUpdateEventSchema>;

/**
 * Diagnostics summary event payload.
 * 
 * Sent from main → renderer when overall diagnostics counts change.
 */
export const DiagnosticsSummaryEventSchema = z.object({
  /** Total error count */
  errorCount: z.number().int().min(0),
  
  /** Total warning count */
  warningCount: z.number().int().min(0),
  
  /** Total info count */
  infoCount: z.number().int().min(0),
  
  /** Total hint count */
  hintCount: z.number().int().min(0),
});

/**
 * DiagnosticsSummaryEvent type inferred from schema.
 */
export type DiagnosticsSummaryEvent = z.infer<typeof DiagnosticsSummaryEventSchema>;

/**
 * Global error sources for diagnostics reporting.
 */
export const ErrorSourceSchema = z.enum([
  'renderer',
  'preload',
  'main',
  'agent-host',
  'extension-host',
]);

export type ErrorSource = z.infer<typeof ErrorSourceSchema>;

/**
 * Sanitized error report payload.
 */
export const ErrorReportSchema = z.object({
  source: ErrorSourceSchema,
  message: z.string().min(1),
  name: z.string().optional(),
  stack: z.string().optional(),
  timestamp: z.string().datetime(),
  context: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});

export type ErrorReport = z.infer<typeof ErrorReportSchema>;

/**
 * Request to report an error to diagnostics.
 */
export const DiagReportErrorRequestSchema = ErrorReportSchema;

export type DiagReportErrorRequest = z.infer<typeof DiagReportErrorRequestSchema>;

/**
 * Response payload for retrieving log path.
 */
export const DiagGetLogPathResponseSchema = z.object({
  path: z.string().min(1),
});

export type DiagGetLogPathResponse = z.infer<typeof DiagGetLogPathResponseSchema>;

/**
 * Request to set Safe Mode state.
 */
export const DiagSetSafeModeRequestSchema = z.object({
  enabled: z.boolean(),
});

export type DiagSetSafeModeRequest = z.infer<typeof DiagSetSafeModeRequestSchema>;

/**
 * Response for Safe Mode toggle.
 */
export const DiagSetSafeModeResponseSchema = z.object({
  enabled: z.boolean(),
});

export type DiagSetSafeModeResponse = z.infer<typeof DiagSetSafeModeResponseSchema>;

/**
 * Fatal diagnostics event payload (main -> renderer).
 */
export const DiagFatalEventSchema = z.object({
  report: ErrorReportSchema,
});

export type DiagFatalEvent = z.infer<typeof DiagFatalEventSchema>;
