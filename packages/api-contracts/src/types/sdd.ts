import { z } from 'zod';

/**
 * Reference to an SDD source document (spec/plan/tasks/etc.).
 */
export const SddDocRefSchema = z.object({
  path: z.string().min(1),
  hash: z.string().min(1),
});

export type SddDocRef = z.infer<typeof SddDocRefSchema>;

/**
 * Summary of an SDD feature on disk.
 */
export const SddFeatureSummarySchema = z.object({
  featureId: z.string().min(1),
  specPath: z.string().min(1),
  planPath: z.string().min(1).optional(),
  tasksPath: z.string().min(1).optional(),
});

export type SddFeatureSummary = z.infer<typeof SddFeatureSummarySchema>;

/**
 * SDD run status values.
 */
export const SddRunStatusSchema = z.enum(['running', 'stopped', 'aborted']);

export type SddRunStatus = z.infer<typeof SddRunStatusSchema>;

/**
 * SDD run metadata.
 */
export const SddRunSchema = z.object({
  runId: z.string().min(1),
  featureId: z.string().min(1),
  taskId: z.string().min(1),
  startedAt: z.string().datetime(),
  stoppedAt: z.string().datetime().nullable().default(null),
  status: SddRunStatusSchema,
});

export type SddRun = z.infer<typeof SddRunSchema>;

/**
 * Request to start an SDD run.
 */
export const SddStartRunRequestSchema = z.object({
  featureId: z.string().min(1),
  taskId: z.string().min(1),
  inputs: z.array(SddDocRefSchema).default([]),
});

export type SddStartRunRequest = z.infer<typeof SddStartRunRequestSchema>;

/**
 * Request to set the active task without starting a run.
 */
export const SddSetActiveTaskRequestSchema = z.object({
  featureId: z.string().min(1),
  taskId: z.string().min(1),
});

export type SddSetActiveTaskRequest = z.infer<typeof SddSetActiveTaskRequestSchema>;

/**
 * SDD parity summary for the workspace.
 */
export const SddParitySchema = z.object({
  trackedFileChanges: z.number().int().nonnegative(),
  untrackedFileChanges: z.number().int().nonnegative(),
  trackedRatio: z.number().min(0).max(1),
  driftFiles: z.array(z.string()),
  staleDocs: z.array(z.string()),
});

export type SddParity = z.infer<typeof SddParitySchema>;

/**
 * Current SDD status snapshot.
 */
export const SddStatusSchema = z.object({
  activeRun: SddRunSchema.nullable(),
  parity: SddParitySchema,
});

export type SddStatus = z.infer<typeof SddStatusSchema>;

/**
 * Commit enforcement check result.
 */
export const SddCommitCheckResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
  untrackedFiles: z.array(z.string()).optional(),
  driftFiles: z.array(z.string()).optional(),
});

export type SddCommitCheckResult = z.infer<typeof SddCommitCheckResultSchema>;

/**
 * SDD event type enum (for ledger persistence and diagnostics).
 */
export const SddEventTypeSchema = z.enum([
  'RUN_STARTED',
  'RUN_STOPPED',
  'RUN_ABORTED',
  'FILE_MODIFIED',
  'FILE_ADDED',
  'FILE_DELETED',
  'FILE_RENAMED',
  'UNTRACKED_CHANGE_DETECTED',
  'COMMIT_BLOCKED',
  'COMMIT_OVERRIDDEN',
  'COMMIT_SUCCEEDED',
]);

export type SddEventType = z.infer<typeof SddEventTypeSchema>;

/**
 * File entry within an SDD event.
 */
export const SddEventFileSchema = z.object({
  path: z.string().min(1),
  op: z.enum(['modified', 'added', 'deleted', 'renamed']),
  hashBefore: z.string().optional(),
  hashAfter: z.string().optional(),
});

export type SddEventFile = z.infer<typeof SddEventFileSchema>;

/**
 * Run reference attached to events.
 */
export const SddRunRefSchema = z.object({
  runId: z.string().min(1),
  featureId: z.string().min(1),
  taskId: z.string().min(1),
});

export type SddRunRef = z.infer<typeof SddRunRefSchema>;

/**
 * Ledger event entry.
 */
export const SddEventSchema = z.object({
  v: z.number().int().min(1),
  ts: z.string().datetime(),
  type: SddEventTypeSchema,
  actor: z.string().min(1),
  run: SddRunRefSchema.optional(),
  docRefs: z.array(SddDocRefSchema).optional(),
  files: z.array(SddEventFileSchema).optional(),
  meta: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});

export type SddEvent = z.infer<typeof SddEventSchema>;

/**
 * Requests and responses for IPC handlers.
 */
export const SddListFeaturesRequestSchema = z.object({});

export type SddListFeaturesRequest = z.infer<typeof SddListFeaturesRequestSchema>;

export const SddListFeaturesResponseSchema = z.array(SddFeatureSummarySchema);

export type SddListFeaturesResponse = z.infer<typeof SddListFeaturesResponseSchema>;

export const SddStatusRequestSchema = z.object({});

export type SddStatusRequest = z.infer<typeof SddStatusRequestSchema>;

export const SddStopRunRequestSchema = z.object({});

export type SddStopRunRequest = z.infer<typeof SddStopRunRequestSchema>;

export const SddGetFileTraceRequestSchema = z.object({
  path: z.string().min(1),
});

export type SddGetFileTraceRequest = z.infer<typeof SddGetFileTraceRequestSchema>;

export const SddFileTraceResponseSchema = z.object({
  path: z.string().min(1),
  runs: z.array(SddRunSchema),
});

export type SddFileTraceResponse = z.infer<typeof SddFileTraceResponseSchema>;

export const SddGetTaskTraceRequestSchema = z.object({
  featureId: z.string().min(1),
  taskId: z.string().min(1),
});

export type SddGetTaskTraceRequest = z.infer<typeof SddGetTaskTraceRequestSchema>;

export const SddTaskTraceResponseSchema = z.object({
  files: z.array(z.string()),
  runs: z.array(SddRunSchema),
});

export type SddTaskTraceResponse = z.infer<typeof SddTaskTraceResponseSchema>;

export const SddGetParityRequestSchema = z.object({});

export type SddGetParityRequest = z.infer<typeof SddGetParityRequestSchema>;

export const SddOverrideUntrackedRequestSchema = z.object({
  reason: z.string().min(1),
});

export type SddOverrideUntrackedRequest = z.infer<typeof SddOverrideUntrackedRequestSchema>;
