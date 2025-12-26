export type SddDocPaths = {
  featureRoot: string;
  specPath: string;
  planPath: string;
  tasksPath: string;
};

export type SddDocPathResolver = (featureId: string) => SddDocPaths;

const DOC_FILENAMES = ['spec.md', 'plan.md', 'tasks.md'] as const;

const normalizePath = (value: string): string =>
  value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\.\//, '').trim();

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const stripDocSuffix = (value: string): string | null => {
  const lower = value.toLowerCase();
  for (const filename of DOC_FILENAMES) {
    const suffix = `/${filename}`;
    if (lower.endsWith(suffix)) {
      return value.slice(0, -suffix.length);
    }
  }
  return null;
};

export const resolveSddDocPaths: SddDocPathResolver = (featureId) => {
  const raw = normalizePath(featureId);
  if (!raw) {
    throw new Error('SDD feature id must not be empty.');
  }

  const stripped = stripDocSuffix(raw);
  let featureRoot = stripped ?? raw;
  featureRoot = trimTrailingSlash(featureRoot);

  if (!featureRoot.startsWith('specs/')) {
    if (!featureRoot.includes('/')) {
      featureRoot = `specs/${featureRoot}`;
    }
  }

  featureRoot = trimTrailingSlash(featureRoot);
  if (!featureRoot) {
    throw new Error(`SDD feature id "${featureId}" did not resolve to a valid root.`);
  }

  return {
    featureRoot,
    specPath: `${featureRoot}/spec.md`,
    planPath: `${featureRoot}/plan.md`,
    tasksPath: `${featureRoot}/tasks.md`,
  };
};
