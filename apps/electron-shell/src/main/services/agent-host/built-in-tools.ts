import { spawn } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import {
  ModelGenerateRequestSchema,
  ModelGenerateResponseSchema,
  type ToolCallEnvelope,
} from 'packages-api-contracts';
import { z } from 'zod';
import { fsBrokerService } from '../FsBrokerService';
import { workspaceService } from '../WorkspaceService';
import { sddTraceService } from '../SddTraceService';
import { resolvePathWithinWorkspace } from '../workspace-paths';
import { modelGatewayService } from '../ModelGatewayService';
import type { BrokerMainInstance } from './types';

type FileChange = {
  path: string;
  op: 'added' | 'modified';
  hashBefore?: string;
  hashAfter: string;
};

export type BuiltInToolsRegistrar = {
  registerOnce: () => void;
};

const isMissingPathError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'ENOENT' || code === 'ENOTDIR';
};

const readExistingFileHash = async (
  filePath: string
): Promise<{ exists: boolean; hashBefore?: string }> => {
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) {
      return { exists: false };
    }
    try {
      const content = await fs.promises.readFile(filePath);
      return { exists: true, hashBefore: createHash('sha256').update(content).digest('hex') };
    } catch {
      return { exists: true };
    }
  } catch (error) {
    if (isMissingPathError(error)) {
      return { exists: false };
    }
    return { exists: false };
  }
};

const hashContent = (content: string): string => {
  return createHash('sha256').update(content, 'utf8').digest('hex');
};

export const createBuiltInToolsRegistrar = (
  brokerMain: BrokerMainInstance
): BuiltInToolsRegistrar => {
  let registered = false;

  const buildAgentFileChange = async (
    requestPath: string,
    content: string
  ): Promise<FileChange | null> => {
    const workspace = workspaceService.getWorkspace();
    if (!workspace) {
      return null;
    }

    let resolvedPath = requestPath;
    try {
      resolvedPath = await resolvePathWithinWorkspace(requestPath, workspace.path, {
        requireExisting: false,
      });
    } catch {
      return null;
    }

    const { exists, hashBefore } = await readExistingFileHash(resolvedPath);
    const hashAfter = hashContent(content);

    return {
      path: resolvedPath,
      op: exists ? 'modified' : 'added',
      hashBefore,
      hashAfter,
    };
  };

  const recordSddChange = async (change: FileChange | null): Promise<void> => {
    if (!change) {
      return;
    }

    try {
      await sddTraceService.recordFileChange({
        path: change.path,
        op: change.op,
        actor: 'agent',
        hashBefore: change.hashBefore,
        hashAfter: change.hashAfter,
      });
    } catch {
      // Ignore SDD failures so agent tool execution succeeds.
    }
  };

  const writeWorkspaceFile = async (path: string, content: string): Promise<void> => {
    const change = await buildAgentFileChange(path, content);
    await fsBrokerService.createFile(path, content);
    await recordSddChange(change);
  };

  const registerOnce = (): void => {
    if (registered) {
      return;
    }

    const workspaceReadInput = z.object({ path: z.string() });
    const workspaceReadOutput = z.object({ content: z.string(), encoding: z.string() });
    const workspaceWriteInput = z.object({ path: z.string(), content: z.string() });
    const workspaceWriteOutput = z.object({ success: z.literal(true) });
    const repoSearchInput = z.object({ query: z.string().min(1), glob: z.string().optional() });
    const repoSearchOutput = z.object({
      matches: z.array(
        z.object({
          file: z.string(),
          line: z.number().int().min(1),
          text: z.string(),
        })
      ),
    });
    const repoListInput = z.object({
      glob: z.string().optional(),
      root: z.string().optional(),
      maxResults: z.number().int().min(1).max(5000).optional(),
    });
    const repoListOutput = z.object({
      files: z.array(z.string()),
      truncated: z.boolean().optional(),
    });

    brokerMain.registerToolDefinition({
      id: 'workspace.read',
      description: 'Read a file within the workspace.',
      inputSchema: workspaceReadInput,
      outputSchema: workspaceReadOutput,
      category: 'fs',
      execute: async (input) => {
        const { path } = input as z.infer<typeof workspaceReadInput>;
        return fsBrokerService.readFile(path);
      },
    });

    brokerMain.registerToolDefinition({
      id: 'workspace.write',
      description: 'Write a file within the workspace (create or overwrite).',
      inputSchema: workspaceWriteInput,
      outputSchema: workspaceWriteOutput,
      category: 'fs',
      execute: async (input) => {
        const { path, content } = input as z.infer<typeof workspaceWriteInput>;
        await writeWorkspaceFile(path, content);
        return { success: true };
      },
    });

    brokerMain.registerToolDefinition({
      id: 'workspace.update',
      description: 'Update a file within the workspace.',
      inputSchema: workspaceWriteInput,
      outputSchema: workspaceWriteOutput,
      category: 'fs',
      execute: async (input) => {
        const { path, content } = input as z.infer<typeof workspaceWriteInput>;
        await writeWorkspaceFile(path, content);
        return { success: true };
      },
    });

    brokerMain.registerToolDefinition({
      id: 'repo.search',
      description: 'Search the workspace using ripgrep.',
      inputSchema: repoSearchInput,
      outputSchema: repoSearchOutput,
      category: 'repo',
      execute: async (input) => {
        const { query, glob } = input as z.infer<typeof repoSearchInput>;
        const workspace = workspaceService.getWorkspace();
        if (!workspace) {
          throw new Error('No workspace open.');
        }

        const args = ['--json', query];
        if (glob) {
          args.push('-g', glob);
        }

        const matches: Array<{ file: string; line: number; text: string }> = [];
        await new Promise<void>((resolve, reject) => {
          const child = spawn('rg', args, { cwd: workspace.path });
          let stderr = '';

          child.stdout.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n').filter((line) => line.length > 0);
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line) as {
                  type?: string;
                  data?: {
                    path?: { text?: string };
                    line_number?: number;
                    lines?: { text?: string };
                  };
                };
                if (parsed.type === 'match' && parsed.data) {
                  const file = parsed.data.path?.text ?? 'unknown';
                  const lineNumber = parsed.data.line_number ?? 0;
                  const text = parsed.data.lines?.text ?? '';
                  if (lineNumber > 0) {
                    matches.push({ file, line: lineNumber, text: text.trimEnd() });
                  }
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
            reject(error);
          });

          child.on('close', (code) => {
            if (code === 0 || code === 1) {
              resolve();
              return;
            }
            reject(new Error(stderr.trim() || `ripgrep failed with code ${code}`));
          });
        });

        return { matches };
      },
    });

    brokerMain.registerToolDefinition({
      id: 'model.generate',
      description: 'Generate a model response using a configured connection.',
      inputSchema: ModelGenerateRequestSchema,
      outputSchema: ModelGenerateResponseSchema,
      category: 'net',
      execute: async (input, context) => {
        const envelope = context?.envelope as ToolCallEnvelope | undefined;
        if (!envelope) {
          throw new Error('Missing tool execution envelope.');
        }
        const request = ModelGenerateRequestSchema.parse(input);
        return await modelGatewayService.generate(request, {
          runId: envelope.runId,
          requesterId: envelope.requesterId,
        });
      },
    });

    brokerMain.registerToolDefinition({
      id: 'repo.list',
      description: 'List workspace files using ripgrep with optional glob.',
      inputSchema: repoListInput,
      outputSchema: repoListOutput,
      category: 'repo',
      execute: async (input) => {
        const workspace = workspaceService.getWorkspace();
        if (!workspace) {
          throw new Error('No workspace open.');
        }

        const request = repoListInput.parse(input);
        const rootPath = request.root
          ? await resolvePathWithinWorkspace(request.root, workspace.path, { requireExisting: true })
          : workspace.path;
        const maxResults = request.maxResults ?? 2000;
        const args = ['--files'];
        if (request.glob) {
          args.push('-g', request.glob);
        }

        const files: string[] = [];
        let truncated = false;

        await new Promise<void>((resolve, reject) => {
          const child = spawn('rg', args, { cwd: rootPath });
          let stderr = '';

          child.stdout.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n').filter((line) => line.length > 0);
            for (const line of lines) {
              if (files.length >= maxResults) {
                truncated = true;
                child.kill();
                break;
              }
              files.push(line);
            }
          });

          child.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });

          child.on('error', (error) => {
            reject(error);
          });

          child.on('close', (code) => {
            if (code === 0 || code === 1) {
              resolve();
              return;
            }
            reject(new Error(stderr.trim() || `ripgrep failed with code ${code}`));
          });
        });

        return { files, truncated: truncated || undefined };
      },
    });

    registered = true;
  };

  return { registerOnce };
};
