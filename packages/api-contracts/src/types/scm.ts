import { z } from 'zod';

/**
 * Single SCM file status entry.
 */
export const ScmFileStatusSchema = z.object({
  /** File path relative to workspace root */
  path: z.string(),

  /** Git status code (porcelain) */
  status: z.string().min(1),
});

/**
 * ScmFileStatus type inferred from schema.
 */
export type ScmFileStatus = z.infer<typeof ScmFileStatusSchema>;

/**
 * Request to get SCM status.
 */
export const ScmStatusRequestSchema = z.object({});

/**
 * ScmStatusRequest type inferred from schema.
 */
export type ScmStatusRequest = z.infer<typeof ScmStatusRequestSchema>;

/**
 * Response with grouped SCM status.
 */
export const ScmStatusResponseSchema = z.object({
  /** Current branch name (null if not a repo or detached) */
  branch: z.string().nullable().default(null),

  /** Staged changes */
  staged: z.array(ScmFileStatusSchema),

  /** Unstaged changes */
  unstaged: z.array(ScmFileStatusSchema),

  /** Untracked files */
  untracked: z.array(ScmFileStatusSchema),
});

/**
 * ScmStatusResponse type inferred from schema.
 */
export type ScmStatusResponse = z.infer<typeof ScmStatusResponseSchema>;

/**
 * Request to stage files.
 */
export const ScmStageRequestSchema = z.object({
  /** File paths relative to workspace root */
  paths: z.array(z.string()).optional(),

  /** Stage all changes */
  all: z.boolean().default(false),
}).superRefine((value, ctx) => {
  if (!value.all && (!value.paths || value.paths.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'paths is required when all is false.',
      path: ['paths'],
    });
  }
});

/**
 * ScmStageRequest type inferred from schema.
 */
export type ScmStageRequest = z.infer<typeof ScmStageRequestSchema>;

/**
 * Request to unstage files.
 */
export const ScmUnstageRequestSchema = z.object({
  /** File paths relative to workspace root */
  paths: z.array(z.string()).optional(),

  /** Unstage all changes */
  all: z.boolean().default(false),
}).superRefine((value, ctx) => {
  if (!value.all && (!value.paths || value.paths.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'paths is required when all is false.',
      path: ['paths'],
    });
  }
});

/**
 * ScmUnstageRequest type inferred from schema.
 */
export type ScmUnstageRequest = z.infer<typeof ScmUnstageRequestSchema>;

/**
 * Request to commit staged changes.
 */
export const ScmCommitRequestSchema = z.object({
  /** Commit message */
  message: z.string().min(1),
});

/**
 * ScmCommitRequest type inferred from schema.
 */
export type ScmCommitRequest = z.infer<typeof ScmCommitRequestSchema>;
