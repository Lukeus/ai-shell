import { ipcRenderer } from 'electron';
import type { ErrorInfo, Result } from 'packages-api-contracts';

const toErrorInfo = (error: unknown): ErrorInfo => {
  if (error instanceof Error) {
    const code = typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code?: string }).code
      : undefined;
    return {
      message: error.message || 'Unknown error',
      name: error.name || undefined,
      stack: error.stack || undefined,
      code,
    };
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return { message: error.trim() };
  }

  return { message: 'Unknown error' };
};

const isResultEnvelope = <T>(value: unknown): value is Result<T> => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { ok?: unknown };
  return candidate.ok === true || candidate.ok === false;
};

/**
 * invokeSafe - wraps ipcRenderer.invoke and always returns a Result envelope.
 */
export const invokeSafe = async <T>(
  channel: string,
  request?: unknown
): Promise<Result<T>> => {
  try {
    const response = await ipcRenderer.invoke(channel, request);
    if (isResultEnvelope<T>(response)) {
      return response;
    }
    return { ok: true, value: response as T };
  } catch (error) {
    return { ok: false, error: toErrorInfo(error) };
  }
};
