import { z } from 'zod';

/**
 * Request to search workspace files.
 *
 * Main process validates workspace scope before executing ripgrep.
 */
export const SearchRequestSchema = z.object({
  /** Query string to search for */
  query: z.string(),

  /** Interpret query as regex */
  isRegex: z.boolean().default(false),

  /** Match case-sensitive */
  matchCase: z.boolean().default(false),

  /** Match whole word boundaries */
  wholeWord: z.boolean().default(false),

  /** Include glob patterns */
  includes: z.array(z.string()).optional(),

  /** Exclude glob patterns */
  excludes: z.array(z.string()).optional(),

  /** Maximum number of matches to return */
  maxResults: z.number().int().positive().optional(),
});

/**
 * SearchRequest type inferred from schema.
 */
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

/**
 * Single match within a file.
 */
export const SearchMatchSchema = z.object({
  /** Absolute file path for the match */
  filePath: z.string(),

  /** 1-based line number */
  line: z.number().int().positive(),

  /** 1-based column number */
  column: z.number().int().positive(),

  /** Full line text containing the match */
  lineText: z.string(),

  /** Exact matched substring */
  matchText: z.string(),
});

/**
 * SearchMatch type inferred from schema.
 */
export type SearchMatch = z.infer<typeof SearchMatchSchema>;

/**
 * Search results for a single file.
 */
export const SearchResultSchema = z.object({
  /** Absolute file path for results */
  filePath: z.string(),

  /** Matches within the file */
  matches: z.array(SearchMatchSchema),
});

/**
 * SearchResult type inferred from schema.
 */
export type SearchResult = z.infer<typeof SearchResultSchema>;

/**
 * Response from a search request.
 */
export const SearchResponseSchema = z.object({
  /** Grouped results by file */
  results: z.array(SearchResultSchema),

  /** True when results were truncated due to maxResults */
  truncated: z.boolean(),
});

/**
 * SearchResponse type inferred from schema.
 */
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

/**
 * Request to replace matches in file or workspace.
 */
export const ReplaceRequestSchema = z.object({
  /** Replacement scope */
  scope: z.enum(['file', 'workspace']),

  /** File path when scope is "file" */
  filePath: z.string().optional(),

  /** Query string to replace */
  query: z.string(),

  /** Replacement string */
  replace: z.string(),

  /** Interpret query as regex */
  isRegex: z.boolean().default(false),

  /** Match case-sensitive */
  matchCase: z.boolean().default(false),

  /** Match whole word boundaries */
  wholeWord: z.boolean().default(false),

  /** Include glob patterns */
  includes: z.array(z.string()).optional(),

  /** Exclude glob patterns */
  excludes: z.array(z.string()).optional(),

  /** Optional cap on number of replacements */
  maxReplacements: z.number().int().positive().optional(),
}).superRefine((value, ctx) => {
  if (value.scope === 'file' && !value.filePath) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'filePath is required when scope is "file".',
      path: ['filePath'],
    });
  }
});

/**
 * ReplaceRequest type inferred from schema.
 */
export type ReplaceRequest = z.infer<typeof ReplaceRequestSchema>;

/**
 * Response from a replace operation.
 */
export const ReplaceResponseSchema = z.object({
  /** Number of files modified */
  filesChanged: z.number().int().nonnegative(),

  /** Total number of replacements applied */
  replacements: z.number().int().nonnegative(),
});

/**
 * ReplaceResponse type inferred from schema.
 */
export type ReplaceResponse = z.infer<typeof ReplaceResponseSchema>;
