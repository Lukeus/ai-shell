import * as fs from 'fs';
import * as path from 'path';
import type { Proposal, ProposalSummary } from 'packages-api-contracts';
import { resolvePathWithinWorkspace } from './workspace-paths';

type PatchHunk = {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
};

type FilePatch = {
  oldPath?: string;
  newPath?: string;
  hunks: PatchHunk[];
};

export type PatchApplyResult = {
  files: string[];
  summary: ProposalSummary;
};

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

const splitLines = (content: string): string[] => {
  if (!content) {
    return [];
  }
  const lines = content.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
};

const extractPatchPath = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('"')) {
    const end = trimmed.indexOf('"', 1);
    if (end > 1) {
      return trimmed.slice(1, end);
    }
  }
  const match = trimmed.match(/^[^\t ]+/);
  return match ? match[0] : trimmed;
};

const normalizePatchPath = (patchPath: string): string => {
  const trimmed = patchPath.replace(/^a\//, '').replace(/^b\//, '');
  return trimmed.replace(/\\/g, '/');
};

const toRelativePath = (workspaceRoot: string, absolutePath: string): string => {
  const relative = path.relative(workspaceRoot, absolutePath);
  return relative.replace(/\\/g, '/');
};

const parseUnifiedDiff = (patchText: string): FilePatch[] => {
  const lines = patchText.split(/\r?\n/);
  const patches: FilePatch[] = [];
  let current: FilePatch | null = null;
  let currentHunk: PatchHunk | null = null;

  const finalizeHunk = (): void => {
    if (current && currentHunk) {
      current.hunks.push(currentHunk);
      currentHunk = null;
    }
  };

  const finalizePatch = (): void => {
    finalizeHunk();
    if (current) {
      patches.push(current);
      current = null;
    }
  };

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      finalizePatch();
      current = { hunks: [] };
      continue;
    }

    if (!current && (line.startsWith('--- ') || line.startsWith('+++ ') || line.startsWith('@@ '))) {
      current = { hunks: [] };
    }

    if (!current) {
      continue;
    }

    if (line.startsWith('--- ')) {
      finalizeHunk();
      current.oldPath = extractPatchPath(line.slice(4));
      continue;
    }

    if (line.startsWith('+++ ')) {
      finalizeHunk();
      current.newPath = extractPatchPath(line.slice(4));
      continue;
    }

    if (line.startsWith('@@ ')) {
      finalizeHunk();
      const match = line.match(HUNK_HEADER);
      if (!match) {
        throw new Error(`Invalid hunk header: ${line}`);
      }
      const oldStart = parseInt(match[1], 10);
      const oldLines = match[2] ? parseInt(match[2], 10) : 1;
      const newStart = parseInt(match[3], 10);
      const newLines = match[4] ? parseInt(match[4], 10) : 1;
      currentHunk = { oldStart, oldLines, newStart, newLines, lines: [] };
      continue;
    }

    if (currentHunk) {
      currentHunk.lines.push(line);
    }
  }

  finalizePatch();
  return patches.filter((patch) => patch.oldPath || patch.newPath || patch.hunks.length > 0);
};

const applyHunks = (
  originalContent: string,
  hunks: PatchHunk[],
  fileLabel: string
): { lines: string[]; additions: number; deletions: number; hadTrailingNewline: boolean } => {
  const hadTrailingNewline = originalContent.endsWith('\n') || originalContent.endsWith('\r\n');
  const lines = splitLines(originalContent);
  let offset = 0;
  let additions = 0;
  let deletions = 0;

  for (const hunk of hunks) {
    const baseIndex = Math.max(hunk.oldStart - 1, 0);
    let index = baseIndex + offset;
    if (index < 0) {
      index = 0;
    }
    let pointer = index;
    const nextLines: string[] = [];

    for (const line of hunk.lines) {
      if (!line) {
        continue;
      }
      if (line.startsWith('\\')) {
        continue;
      }
      const marker = line[0];
      const content = line.slice(1);

      if (marker === ' ') {
        if (lines[pointer] !== content) {
          throw new Error(`Patch conflict in ${fileLabel} near line ${pointer + 1}.`);
        }
        nextLines.push(content);
        pointer += 1;
      } else if (marker === '-') {
        if (lines[pointer] !== content) {
          throw new Error(`Patch conflict in ${fileLabel} near line ${pointer + 1}.`);
        }
        pointer += 1;
        deletions += 1;
      } else if (marker === '+') {
        nextLines.push(content);
        additions += 1;
      }
    }

    const consumed = pointer - index;
    lines.splice(index, consumed, ...nextLines);
    offset += nextLines.length - consumed;
  }

  return { lines, additions, deletions, hadTrailingNewline };
};

export class PatchApplyService {
  public async applyProposal(
    proposal: Proposal,
    workspaceRoot: string
  ): Promise<PatchApplyResult> {
    if (proposal.patch && proposal.patch.trim().length > 0) {
      return this.applyPatch(proposal.patch, workspaceRoot);
    }
    return this.applyWrites(proposal.writes ?? [], workspaceRoot);
  }

  private async applyPatch(patchText: string, workspaceRoot: string): Promise<PatchApplyResult> {
    const filePatches = parseUnifiedDiff(patchText);
    if (filePatches.length === 0) {
      throw new Error('Patch is empty or invalid.');
    }

    const files: string[] = [];
    let additions = 0;
    let deletions = 0;

    for (const filePatch of filePatches) {
      const oldRaw = filePatch.oldPath;
      const newRaw = filePatch.newPath;
      const isDeletion = newRaw === '/dev/null';
      const isAddition = oldRaw === '/dev/null';

      const oldPath = oldRaw && oldRaw !== '/dev/null' ? normalizePatchPath(oldRaw) : undefined;
      const newPath = newRaw && newRaw !== '/dev/null' ? normalizePatchPath(newRaw) : undefined;
      const targetPath = newPath ?? oldPath;

      if (!targetPath) {
        continue;
      }

      const resolvedTarget = await resolvePathWithinWorkspace(targetPath, workspaceRoot, {
        requireExisting: !isAddition,
      });
      const resolvedSource =
        oldPath && oldPath !== targetPath
          ? await resolvePathWithinWorkspace(oldPath, workspaceRoot, {
            requireExisting: !isAddition,
          })
          : resolvedTarget;

      const originalContent =
        isAddition || !fs.existsSync(resolvedSource)
          ? ''
          : await fs.promises.readFile(resolvedSource, 'utf-8');

      const applied = applyHunks(originalContent, filePatch.hunks, targetPath);
      additions += applied.additions;
      deletions += applied.deletions;

      if (isDeletion) {
        if (fs.existsSync(resolvedSource)) {
          await fs.promises.unlink(resolvedSource);
        }
        files.push(toRelativePath(workspaceRoot, resolvedSource));
        continue;
      }

      const output =
        applied.lines.length === 0
          ? ''
          : `${applied.lines.join('\n')}${applied.hadTrailingNewline || isAddition ? '\n' : ''}`;

      const dir = path.dirname(resolvedTarget);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(resolvedTarget, output, 'utf-8');

      if (resolvedSource !== resolvedTarget && fs.existsSync(resolvedSource)) {
        await fs.promises.unlink(resolvedSource);
      }

      files.push(toRelativePath(workspaceRoot, resolvedTarget));
    }

    return {
      files,
      summary: {
        filesChanged: files.length,
        additions,
        deletions,
      },
    };
  }

  private async applyWrites(
    writes: Proposal['writes'],
    workspaceRoot: string
  ): Promise<PatchApplyResult> {
    const files: string[] = [];

    for (const write of writes) {
      const resolved = await resolvePathWithinWorkspace(write.path, workspaceRoot, {
        requireExisting: false,
      });
      const dir = path.dirname(resolved);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(resolved, write.content, 'utf-8');
      files.push(toRelativePath(workspaceRoot, resolved));
    }

    return {
      files,
      summary: {
        filesChanged: files.length,
      },
    };
  }
}

export const patchApplyService = new PatchApplyService();
