import type { JsonValue, SddStep, ToolCallEnvelope } from 'packages-api-contracts';
import type { SddDocPathResolver, SddDocPaths } from './sdd-paths';
import type { SddContext, SddContextLoader, SddToolExecutor } from './sdd-types';

const BASE_CONTEXT_PATHS = [
  'memory/constitution.md',
  'memory/context/00-overview.md',
  'docs/architecture/architecture.md',
];

const buildOptionalPathsForStep = (step: SddStep, docPaths: SddDocPaths): string[] => {
  if (step === 'spec') {
    return [docPaths.specPath, docPaths.planPath, docPaths.tasksPath];
  }
  if (step === 'plan') {
    return [docPaths.planPath, docPaths.tasksPath];
  }
  if (step === 'tasks') {
    return [docPaths.tasksPath];
  }
  return [];
};

export const buildContextPathsForStep = (step: SddStep, docPaths: SddDocPaths): string[] => {
  if (step === 'spec') {
    return BASE_CONTEXT_PATHS;
  }
  if (step === 'plan') {
    return [...BASE_CONTEXT_PATHS, docPaths.specPath];
  }
  if (step === 'tasks') {
    return [...BASE_CONTEXT_PATHS, docPaths.specPath, docPaths.planPath];
  }
  return [...BASE_CONTEXT_PATHS, docPaths.specPath, docPaths.planPath, docPaths.tasksPath];
};

export const contextToRecord = (context: SddContext): Record<string, string> => {
  const record: Record<string, string> = {};
  for (const [path, content] of context.files.entries()) {
    record[path] = content;
  }
  return record;
};

type ReadWorkspaceOptions = {
  toolExecutor: SddToolExecutor;
  idProvider: () => string;
  runId: string;
  path: string;
};

const readWorkspaceFile = async ({
  toolExecutor,
  idProvider,
  runId,
  path,
}: ReadWorkspaceOptions): Promise<string> => {
  const input: JsonValue = { path };
  const envelope: ToolCallEnvelope = {
    callId: idProvider(),
    toolId: 'workspace.read',
    requesterId: 'agent-host',
    runId,
    input,
    reason: `Load SDD context: ${path}`,
  };

  const result = await toolExecutor.executeToolCall(envelope);
  if (!result.ok) {
    throw new Error(result.error ?? 'workspace.read failed');
  }

  const output = result.output as { content?: unknown };
  if (!output || typeof output.content !== 'string') {
    throw new Error('workspace.read returned invalid content');
  }

  return output.content;
};

type CreateContextLoaderOptions = {
  toolExecutor: SddToolExecutor;
  idProvider: () => string;
  docPathResolver: SddDocPathResolver;
};

export const createContextLoader = ({
  toolExecutor,
  idProvider,
  docPathResolver,
}: CreateContextLoaderOptions): SddContextLoader => {
  return async (runId, featureId, step, docPaths) => {
    const files = new Map<string, string>();
    const missing: string[] = [];
    const resolvedDocPaths = docPaths ?? docPathResolver(featureId);

    const requiredPaths = buildContextPathsForStep(step, resolvedDocPaths);
    for (const path of requiredPaths) {
      try {
        const content = await readWorkspaceFile({
          toolExecutor,
          idProvider,
          runId,
          path,
        });
        files.set(path, content);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'read failed';
        missing.push(`${path} (${message})`);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required context files: ${missing.join(', ')}`);
    }

    const optionalPaths = buildOptionalPathsForStep(step, resolvedDocPaths);
    for (const path of optionalPaths) {
      if (requiredPaths.includes(path) || files.has(path)) {
        continue;
      }
      try {
        const content = await readWorkspaceFile({
          toolExecutor,
          idProvider,
          runId,
          path,
        });
        files.set(path, content);
      } catch {
        // Optional context; ignore missing files.
      }
    }

    return { files };
  };
};
