import fs from 'fs';
import path from 'path';

export const resolvePreloadPath = (): string => {
  const candidates = [
    path.join(__dirname, 'preload.js'),
    path.join(__dirname, 'preload', 'index.js'),
    path.join(__dirname, '../preload/index.js'),
    path.join(__dirname, '../preload.js'),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // Ignore fs errors, continue to next candidate.
    }
  }

  return candidates[0];
};

export const resolveExtensionHostPath = (): string => {
  const candidates = [
    path.join(__dirname, '../../../extension-host/dist/index.js'),
    path.join(__dirname, '../../extension-host/dist/index.js'),
    path.join(__dirname, '../../apps/extension-host/dist/index.js'),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        console.log('[Main] Found Extension Host at:', candidate);
        return candidate;
      }
    } catch {
      // Ignore fs errors, continue to next candidate.
    }
  }

  console.warn('[Main] Extension Host not found, using fallback path:', candidates[0]);
  return candidates[0];
};

export const resolveAgentHostPath = (): string => {
  const candidates = [
    path.join(__dirname, '../../../agent-host/dist/index.js'),
    path.join(__dirname, '../../agent-host/dist/index.js'),
    path.join(__dirname, '../../apps/agent-host/dist/index.js'),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        console.log('[Main] Found Agent Host at:', candidate);
        return candidate;
      }
    } catch {
      // Ignore fs errors, continue to next candidate.
    }
  }

  console.warn('[Main] Agent Host not found, using fallback path:', candidates[0]);
  return candidates[0];
};
