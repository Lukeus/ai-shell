import { spawn } from 'node:child_process';
import * as fs from 'fs';
import type {
  SearchRequest,
  SearchResponse,
  SearchMatch,
  ReplaceRequest,
  ReplaceResponse,
} from 'packages-api-contracts';
import { WorkspaceService } from './WorkspaceService';
import { resolvePathWithinWorkspace } from './workspace-paths';

const RIPGREP_TIMEOUT_MS = 30000;

type SpawnFn = typeof spawn;
let spawnFn: SpawnFn = spawn;

type RipgrepMatch = {
  type?: string;
  data?: {
    path?: { text?: string };
    line_number?: number;
    lines?: { text?: string };
    submatches?: Array<{
      match?: { text?: string };
      start?: number;
      end?: number;
    }>;
  };
};

/**
 * SearchService - Workspace search and replace (main process only).
 *
 * Security: all operations are scoped to workspace root (P1).
 */
export class SearchService {
  private static instance: SearchService | null = null;
  private readonly workspaceService: WorkspaceService;

  private constructor() {
    this.workspaceService = WorkspaceService.getInstance();
  }

  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  public async search(request: SearchRequest): Promise<SearchResponse> {
    if (!request.query) {
      return { results: [], truncated: false };
    }

    const workspaceRoot = this.getWorkspaceRoot();
    const args = this.buildRipgrepArgs(request);
    const results = new Map<string, SearchMatch[]>();
    const maxResults = request.maxResults ?? 2000;
    let totalMatches = 0;
    let truncated = false;

    await this.runRipgrep(args, workspaceRoot, (match) => {
      if (match.type !== 'match' || !match.data) {
        return;
      }

      const fileText = match.data.path?.text;
      if (!fileText) {
        return;
      }

      const lineNumber = match.data.line_number ?? 0;
      const lineText = (match.data.lines?.text ?? '').replace(/\r?\n$/, '');
      const submatches = match.data.submatches ?? [];

      for (const submatch of submatches) {
        if (totalMatches >= maxResults) {
          truncated = true;
          return 'stop';
        }

        const start = submatch.start ?? 0;
        const matchText = submatch.match?.text ?? '';
        const searchMatch: SearchMatch = {
          filePath: fileText,
          line: Math.max(1, lineNumber),
          column: Math.max(1, start + 1),
          lineText,
          matchText,
        };

        const existing = results.get(fileText);
        if (existing) {
          existing.push(searchMatch);
        } else {
          results.set(fileText, [searchMatch]);
        }

        totalMatches += 1;
      }
    }).then((status) => {
      if (status === 'stopped') {
        truncated = true;
      }
    });

    const validatedResults: SearchResponse['results'] = [];
    for (const [filePath, matches] of results.entries()) {
      const validatedPath = await this.resolveAndValidatePath(filePath, workspaceRoot);
      const updatedMatches = matches.map((match) => ({
        ...match,
        filePath: validatedPath,
      }));
      validatedResults.push({ filePath: validatedPath, matches: updatedMatches });
    }

    return {
      results: validatedResults,
      truncated,
    };
  }

  public async replace(request: ReplaceRequest): Promise<ReplaceResponse> {
    if (!request.query) {
      return { filesChanged: 0, replacements: 0 };
    }

    const workspaceRoot = this.getWorkspaceRoot();
    const matcher = this.buildMatcher(request);
    const maxReplacements = request.maxReplacements ?? null;
    let remaining = maxReplacements ?? null;
    let filesChanged = 0;
    let replacements = 0;

    const targetFiles =
      request.scope === 'file'
        ? [await this.resolveAndValidatePath(request.filePath ?? '', workspaceRoot)]
        : await this.findFilesWithMatches(request, workspaceRoot);

    for (const filePath of targetFiles) {
      if (remaining !== null && remaining <= 0) {
        break;
      }

      const content = await fs.promises.readFile(filePath, 'utf-8');
      const { updated, count } = this.replaceInText(
        content,
        matcher,
        request.replace,
        remaining
      );

      if (count > 0) {
        await fs.promises.writeFile(filePath, updated, 'utf-8');
        filesChanged += 1;
        replacements += count;
        if (remaining !== null) {
          remaining -= count;
        }
      }
    }

    return { filesChanged, replacements };
  }

  private async findFilesWithMatches(
    request: ReplaceRequest,
    workspaceRoot: string
  ): Promise<string[]> {
    const args = this.buildRipgrepArgs(request, { filesWithMatches: true });
    let output = '';

    await this.runRipgrep(args, workspaceRoot, undefined, (chunk) => {
      output += chunk;
    });

    if (!output) {
      return [];
    }

    const files = output
      .split('\0')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map((entry) => entry.trim());

    const validated = new Set<string>();
    for (const entry of files) {
      const resolved = await this.resolveAndValidatePath(entry, workspaceRoot);
      validated.add(resolved);
    }

    return Array.from(validated);
  }

  private buildRipgrepArgs(
    request: Pick<
      SearchRequest,
      'query' | 'isRegex' | 'matchCase' | 'wholeWord' | 'includes' | 'excludes'
    >,
    options?: { filesWithMatches?: boolean }
  ): string[] {
    const args: string[] = [];
    if (options?.filesWithMatches) {
      args.push('--files-with-matches', '--null');
    } else {
      args.push('--json');
    }

    if (!request.isRegex) {
      args.push('-F');
    }

    if (!request.matchCase) {
      args.push('-i');
    }

    if (request.wholeWord) {
      args.push('-w');
    }

    for (const include of request.includes ?? []) {
      args.push('-g', include);
    }

    for (const exclude of request.excludes ?? []) {
      args.push('-g', `!${exclude}`);
    }

    args.push(request.query);
    args.push('.');
    return args;
  }

  private buildMatcher(request: ReplaceRequest): RegExp {
    const base = request.isRegex ? request.query : this.escapeRegExp(request.query);
    const source = request.wholeWord ? `\\b(?:${base})\\b` : base;
    const flags = `g${request.matchCase ? '' : 'i'}`;
    return new RegExp(source, flags);
  }

  private replaceInText(
    input: string,
    matcher: RegExp,
    replacement: string,
    limit: number | null
  ): { updated: string; count: number } {
    if (limit === null) {
      const counter = new RegExp(matcher.source, matcher.flags);
      let count = 0;
      let match: RegExpExecArray | null;
      while ((match = counter.exec(input))) {
        count += 1;
        if (match[0].length === 0) {
          counter.lastIndex += 1;
        }
      }
      return { updated: input.replace(matcher, replacement), count };
    }

    const localMatcher = new RegExp(matcher.source, matcher.flags.replace('g', ''));
    let count = 0;
    let lastIndex = 0;
    let updated = '';
    matcher.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = matcher.exec(input))) {
      if (count >= limit) {
        break;
      }

      updated += input.slice(lastIndex, match.index);
      updated += match[0].replace(localMatcher, replacement);
      lastIndex = match.index + match[0].length;
      count += 1;

      if (match[0].length === 0) {
        matcher.lastIndex += 1;
      }
    }

    updated += input.slice(lastIndex);
    return { updated, count };
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private getWorkspaceRoot(): string {
    const workspace = this.workspaceService.getWorkspace();
    if (!workspace) {
      throw new Error('No workspace open. Open a folder first.');
    }
    return workspace.path;
  }

  private async resolveAndValidatePath(
    requestPath: string,
    workspaceRoot: string
  ): Promise<string> {
    return resolvePathWithinWorkspace(requestPath, workspaceRoot, { requireExisting: true });
  }

  private runRipgrep(
    args: string[],
    cwd: string,
    onMatch?: (match: RipgrepMatch) => void | 'stop',
    onRawOutput?: (chunk: string) => void
  ): Promise<'completed' | 'stopped'> {
    return new Promise((resolve, reject) => {
      const child = spawnFn('rg', args, { cwd });
      let stderr = '';
      let buffer = '';
      let finished = false;
      let timedOut = false;

      const finalize = (
        outcome: 'completed' | 'stopped' | null,
        error?: Error
      ): void => {
        if (finished) {
          return;
        }
        finished = true;
        clearTimeout(timeoutId);
        if (error) {
          reject(error);
          return;
        }
        resolve(outcome ?? 'completed');
      };

      const timeoutId = setTimeout(() => {
        finalize(null, new Error('ripgrep timed out'));
        timedOut = true;
        try {
          child.kill();
        } catch (error) {
          console.warn('Failed to kill ripgrep after timeout:', error);
        }
      }, RIPGREP_TIMEOUT_MS);

      child.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        if (onRawOutput) {
          onRawOutput(chunk);
        }

        if (!onMatch) {
          return;
        }

        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line) {
            continue;
          }
          try {
            const parsed = JSON.parse(line) as RipgrepMatch;
            const result = onMatch(parsed);
            if (result === 'stop') {
              child.kill();
              finalize('stopped');
              return;
            }
          } catch {
            // Ignore non-JSON output.
          }
        }
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        finalize(null, error);
      });

      child.on('close', (code, signal) => {
        if (timedOut) {
          return;
        }
        if (buffer && onMatch) {
          try {
            const parsed = JSON.parse(buffer) as RipgrepMatch;
            onMatch(parsed);
          } catch {
            // Ignore leftover parse errors.
          }
        }

        if (signal) {
          finalize('stopped');
          return;
        }

        if (code === 0 || code === 1) {
          finalize('completed');
          return;
        }

        finalize(null, new Error(stderr.trim() || `ripgrep failed with code ${code}`));
      });
    });
  }
}

export const searchService = SearchService.getInstance();

export const setSearchSpawnForTesting = (fn?: SpawnFn): void => {
  spawnFn = fn ?? spawn;
};
