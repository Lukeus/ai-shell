import * as fs from 'fs';
import * as path from 'path';

export type WorkspacePathOptions = {
  requireExisting?: boolean;
};

export class WorkspacePathError extends Error {
  public readonly code: 'SECURITY_VIOLATION';

  constructor(message: string) {
    super(message);
    this.code = 'SECURITY_VIOLATION';
  }
}

const SECURITY_MESSAGE = 'Invalid path: access outside workspace is not allowed.';

const toPlatformCase = (value: string): string => {
  if (process.platform === 'win32') {
    return value.toLowerCase();
  }
  return value;
};

const ensureTrailingSeparator = (value: string): string => {
  return value.endsWith(path.sep) ? value : `${value}${path.sep}`;
};

export const isPathWithinRoot = (targetPath: string, rootPath: string): boolean => {
  const normalizedTarget = toPlatformCase(path.resolve(targetPath));
  const normalizedRoot = toPlatformCase(path.resolve(rootPath));

  if (normalizedTarget === normalizedRoot) {
    return true;
  }

  return normalizedTarget.startsWith(ensureTrailingSeparator(normalizedRoot));
};

const isMissingPathError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'ENOENT' || code === 'ENOTDIR';
};

const resolveExistingAncestor = async (targetPath: string): Promise<string> => {
  let current = targetPath;
  while (true) {
    try {
      await fs.promises.stat(current);
      return current;
    } catch (error) {
      if (!isMissingPathError(error)) {
        throw error;
      }
      const parent = path.dirname(current);
      if (parent === current) {
        throw error;
      }
      current = parent;
    }
  }
};

const resolveRealTarget = async (
  resolvedPath: string,
  requireExisting: boolean
): Promise<string> => {
  try {
    return await fs.promises.realpath(resolvedPath);
  } catch (error) {
    if (requireExisting || !isMissingPathError(error)) {
      throw error;
    }
  }

  const existingAncestor = await resolveExistingAncestor(resolvedPath);
  const realAncestor = await fs.promises.realpath(existingAncestor);
  const relative = path.relative(existingAncestor, resolvedPath);
  return path.join(realAncestor, relative);
};

export const resolvePathWithinWorkspace = async (
  requestPath: string,
  workspaceRoot: string,
  options: WorkspacePathOptions = {}
): Promise<string> => {
  const { requireExisting = true } = options;
  const resolvedRoot = path.resolve(workspaceRoot);
  const resolvedPath = path.resolve(
    path.isAbsolute(requestPath) ? requestPath : path.join(resolvedRoot, requestPath)
  );

  if (!isPathWithinRoot(resolvedPath, resolvedRoot)) {
    throw new WorkspacePathError(SECURITY_MESSAGE);
  }

  const realRoot = await fs.promises.realpath(resolvedRoot);
  const realTarget = await resolveRealTarget(resolvedPath, requireExisting);

  if (!isPathWithinRoot(realTarget, realRoot)) {
    throw new WorkspacePathError(SECURITY_MESSAGE);
  }

  return resolvedPath;
};
