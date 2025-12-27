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

/**
 * SDD workflow engine (runs, events, proposals).
 */
export const SddStepSchema = z.enum([
  'spec',
  'plan',
  'tasks',
  'implement',
  'review',
]);

export type SddStep = z.infer<typeof SddStepSchema>;

export const SddRunStartRequestSchema = z.object({
  featureId: z.string().min(1),
  goal: z.string().min(1),
  connectionId: z.string().uuid().optional(),
  step: SddStepSchema.optional(),
});

export type SddRunStartRequest = z.infer<typeof SddRunStartRequestSchema>;

export const SddRunControlActionSchema = z.enum(['cancel', 'retry']);

export type SddRunControlAction = z.infer<typeof SddRunControlActionSchema>;

export const SddRunControlRequestSchema = z.object({
  runId: z.string().uuid(),
  action: SddRunControlActionSchema,
  reason: z.string().min(1).optional(),
});

export type SddRunControlRequest = z.infer<typeof SddRunControlRequestSchema>;

export const ProposalFileWriteSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

export type ProposalFileWrite = z.infer<typeof ProposalFileWriteSchema>;

export const ProposalSummarySchema = z.object({
  filesChanged: z.number().int().nonnegative(),
  additions: z.number().int().nonnegative().optional(),
  deletions: z.number().int().nonnegative().optional(),
});

export type ProposalSummary = z.infer<typeof ProposalSummarySchema>;

export const ProposalSchema = z.object({
  writes: z.array(ProposalFileWriteSchema).default([]),
  patch: z.string().optional(),
  summary: ProposalSummarySchema,
});

export type Proposal = z.infer<typeof ProposalSchema>;

export const SddProposalApplyRequestSchema = z.object({
  runId: z.string().uuid(),
  proposal: ProposalSchema,
});

export type SddProposalApplyRequest = z.infer<typeof SddProposalApplyRequestSchema>;

export const SddTestsRunRequestSchema = z.object({
  runId: z.string().uuid(),
  command: z.string().min(1),
});

export type SddTestsRunRequest = z.infer<typeof SddTestsRunRequestSchema>;

const SddRunEventBaseSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  timestamp: z.string().datetime(),
});

export const SddRunStartedEventSchema = SddRunEventBaseSchema.extend({
  type: z.literal('started'),
  featureId: z.string().min(1),
  goal: z.string().min(1),
  step: SddStepSchema,
});

export const SddContextLoadedEventSchema = SddRunEventBaseSchema.extend({
  type: z.literal('contextLoaded'),
  step: SddStepSchema.optional(),
});

export const SddStepStartedEventSchema = SddRunEventBaseSchema.extend({
  type: z.literal('stepStarted'),
  step: SddStepSchema,
});

export const SddOutputAppendedEventSchema = SddRunEventBaseSchema.extend({
  type: z.literal('outputAppended'),
  content: z.string(),
});

export const SddProposalReadyEventSchema = SddRunEventBaseSchema.extend({
  type: z.literal('proposalReady'),
  proposal: ProposalSchema,
});

export const SddApprovalRequiredEventSchema = SddRunEventBaseSchema.extend({
  type: z.literal('approvalRequired'),
  proposal: ProposalSchema,
});

export const SddProposalAppliedEventSchema = SddRunEventBaseSchema.extend({
  type: z.literal('proposalApplied'),
  summary: ProposalSummarySchema,
});

export const SddTestsRequestedEventSchema = SddRunEventBaseSchema.extend({
  type: z.literal('testsRequested'),
  command: z.string().min(1),
});

export const SddTestsCompletedEventSchema = SddRunEventBaseSchema.extend({
  type: z.literal('testsCompleted'),
  command: z.string().min(1),
  exitCode: z.number().int(),
  durationMs: z.number().int().nonnegative().optional(),
});

export const SddRunCompletedEventSchema = SddRunEventBaseSchema.extend({
  type: z.literal('runCompleted'),
});

export const SddRunFailedEventSchema = SddRunEventBaseSchema.extend({
  type: z.literal('runFailed'),
  message: z.string().min(1),
  code: z.string().optional(),
});

export const SddRunCanceledEventSchema = SddRunEventBaseSchema.extend({
  type: z.literal('runCanceled'),
  message: z.string().min(1).optional(),
});

export const SddRunEventSchema = z.discriminatedUnion('type', [
  SddRunStartedEventSchema,
  SddContextLoadedEventSchema,
  SddStepStartedEventSchema,
  SddOutputAppendedEventSchema,
  SddProposalReadyEventSchema,
  SddApprovalRequiredEventSchema,
  SddProposalAppliedEventSchema,
  SddTestsRequestedEventSchema,
  SddTestsCompletedEventSchema,
  SddRunCompletedEventSchema,
  SddRunFailedEventSchema,
  SddRunCanceledEventSchema,
]);

export type SddRunEvent = z.infer<typeof SddRunEventSchema>;
