import { spawn } from 'child_process';
import * as path from 'path';
import type {
  ScmStatusResponse,
  ScmStageRequest,
  ScmUnstageRequest,
  ScmCommitRequest,
  ScmFileStatus,
} from 'packages-api-contracts';
import { WorkspaceService } from './WorkspaceService';

type StatusEntry = {
  status: string;
  path: string;
};

/**
 * GitService - SCM operations for the workspace (main process only).
 */
export class GitService {
  private static instance: GitService | null = null;
  private readonly workspaceService: WorkspaceService;

  private constructor() {
    this.workspaceService = WorkspaceService.getInstance();
  }

  public static getInstance(): GitService {
    if (!GitService.instance) {
      GitService.instance = new GitService();
    }
    return GitService.instance;
  }

  public async getStatus(): Promise<ScmStatusResponse> {
    const workspaceRoot = this.getWorkspaceRoot();
    const isRepo = await this.isGitRepo(workspaceRoot);
    if (!isRepo) {
      return { branch: null, staged: [], unstaged: [], untracked: [] };
    }

    const branch = await this.getBranchName(workspaceRoot);
    const output = await this.runGit(['status', '--porcelain=v1', '-z'], workspaceRoot);
    const entries = this.parsePorcelainStatus(output);

    const staged: ScmFileStatus[] = [];
    const unstaged: ScmFileStatus[] = [];
    const untracked: ScmFileStatus[] = [];

    for (const entry of entries) {
      if (entry.status === '??') {
        untracked.push({ path: entry.path, status: entry.status });
        continue;
      }

      const indexStatus = entry.status[0];
      const worktreeStatus = entry.status[1];

      if (indexStatus && indexStatus !== ' ' && indexStatus !== '?') {
        staged.push({ path: entry.path, status: entry.status });
      }

      if (worktreeStatus && worktreeStatus !== ' ' && worktreeStatus !== '?') {
        unstaged.push({ path: entry.path, status: entry.status });
      }
    }

    return { branch, staged, unstaged, untracked };
  }

  public async stage(request: ScmStageRequest): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    await this.ensureGitRepo(workspaceRoot);

    if (request.all) {
      await this.runGit(['add', '-A'], workspaceRoot);
      return;
    }

    const paths = this.normalizePaths(request.paths ?? [], workspaceRoot);
    if (paths.length === 0) {
      return;
    }

    await this.runGit(['add', '--', ...paths], workspaceRoot);
  }

  public async unstage(request: ScmUnstageRequest): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    await this.ensureGitRepo(workspaceRoot);

    if (request.all) {
      await this.runGit(['reset'], workspaceRoot);
      return;
    }

    const paths = this.normalizePaths(request.paths ?? [], workspaceRoot);
    if (paths.length === 0) {
      return;
    }

    await this.runGit(['reset', '--', ...paths], workspaceRoot);
  }

  public async commit(request: ScmCommitRequest): Promise<void> {
    const workspaceRoot = this.getWorkspaceRoot();
    await this.ensureGitRepo(workspaceRoot);

    const message = request.message.replace(/\s+/g, ' ').trim();
    if (!message) {
      throw new Error('Commit message is required.');
    }

    await this.runGit(['commit', '-m', message], workspaceRoot);
  }

  private async isGitRepo(cwd: string): Promise<boolean> {
    try {
      const output = await this.runGit(['rev-parse', '--is-inside-work-tree'], cwd);
      return output.trim() === 'true';
    } catch {
      return false;
    }
  }

  private async getBranchName(cwd: string): Promise<string | null> {
    try {
      const output = await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
      const branch = output.trim();
      if (!branch || branch === 'HEAD') {
        return null;
      }
      return branch;
    } catch {
      return null;
    }
  }

  private async ensureGitRepo(cwd: string): Promise<void> {
    const isRepo = await this.isGitRepo(cwd);
    if (!isRepo) {
      throw new Error('Workspace is not a Git repository.');
    }
  }

  private runGit(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('git', args, { cwd });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
          return;
        }
        reject(new Error(stderr.trim() || `git failed with code ${code}`));
      });
    });
  }

  private parsePorcelainStatus(output: string): StatusEntry[] {
    if (!output) {
      return [];
    }

    const entries = output.split('\0').filter((entry) => entry.length > 0);
    const results: StatusEntry[] = [];

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (entry.length < 4) {
        continue;
      }

      const status = entry.slice(0, 2);
      let filePath = entry.slice(3);

      if (status[0] === 'R' || status[0] === 'C' || status[1] === 'R' || status[1] === 'C') {
        const next = entries[index + 1];
        if (next) {
          filePath = next;
          index += 1;
        }
      }

      results.push({ status, path: filePath });
    }

    return results;
  }

  private normalizePaths(paths: string[], workspaceRoot: string): string[] {
    const normalized: string[] = [];
    for (const value of paths) {
      const absolutePath = path.isAbsolute(value)
        ? value
        : path.join(workspaceRoot, value);
      const resolvedPath = path.resolve(absolutePath);
      const resolvedRoot = path.resolve(workspaceRoot);

      const isWindows = process.platform === 'win32';
      const isWithinRoot = isWindows
        ? resolvedPath.toLowerCase().startsWith(resolvedRoot.toLowerCase() + path.sep) ||
          resolvedPath.toLowerCase() === resolvedRoot.toLowerCase()
        : resolvedPath.startsWith(resolvedRoot + path.sep) || resolvedPath === resolvedRoot;

      if (!isWithinRoot) {
        throw new Error('Invalid path: access outside workspace is not allowed.');
      }

      normalized.push(path.relative(workspaceRoot, resolvedPath));
    }

    return normalized;
  }

  private getWorkspaceRoot(): string {
    const workspace = this.workspaceService.getWorkspace();
    if (!workspace) {
      throw new Error('No workspace open. Open a folder first.');
    }
    return workspace.path;
  }
}

export const gitService = GitService.getInstance();
