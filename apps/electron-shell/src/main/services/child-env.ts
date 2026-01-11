type ChildEnvOptions = {
  allowlist?: string[];
  extra?: Record<string, string | undefined>;
};

const DEFAULT_ALLOWLIST = [
  'PATH',
  'Path',
  'PATHEXT',
  'SYSTEMROOT',
  'WINDIR',
  'COMSPEC',
  'TEMP',
  'TMP',
  'TMPDIR',
  'HOME',
  'USERPROFILE',
  'HOMEPATH',
  'HOMEDRIVE',
  'APPDATA',
  'LOCALAPPDATA',
  'XDG_DATA_HOME',
  'XDG_CONFIG_HOME',
  'XDG_CACHE_HOME',
  'XDG_RUNTIME_DIR',
  'SHELL',
  'TERM',
  'TERM_PROGRAM',
  'TERM_PROGRAM_VERSION',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
];

const normalizeKey = (value: string): string => {
  return process.platform === 'win32' ? value.toLowerCase() : value;
};

const buildAllowlist = (allowlist?: string[]): Set<string> => {
  const entries = allowlist ?? DEFAULT_ALLOWLIST;
  return new Set(entries.map(normalizeKey));
};

export const buildChildProcessEnv = (options: ChildEnvOptions = {}): Record<string, string> => {
  const allowlist = buildAllowlist(options.allowlist);
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) {
      continue;
    }
    if (allowlist.has(normalizeKey(key))) {
      env[key] = value;
    }
  }

  if (options.extra) {
    for (const [key, value] of Object.entries(options.extra)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }
  }

  if (!env.ELECTRON_RUN_AS_NODE) {
    env.ELECTRON_RUN_AS_NODE = '1';
  }

  return env;
};
