import type { AgentEvent } from 'packages-api-contracts';

const redactSensitiveData = (data: unknown): unknown => {
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('password') ||
        (lowerKey.includes('key') && !lowerKey.includes('keyname'))
      ) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = redactSensitiveData(value);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }

  return data;
};

export const redactAgentEventForPublish = (event: AgentEvent): AgentEvent => {
  if (event.type === 'tool-call') {
    return {
      ...event,
      toolCall: {
        ...event.toolCall,
        input: redactSensitiveData(event.toolCall.input) as typeof event.toolCall.input,
      },
    };
  }

  if (event.type === 'tool-result') {
    return {
      ...event,
      result: {
        ...event.result,
        output: event.result.output
          ? (redactSensitiveData(event.result.output) as typeof event.result.output)
          : undefined,
      },
    };
  }

  return event;
};

export const logInvalidAgentEvent = (error: unknown): void => {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = Array.isArray((error as { issues?: unknown }).issues)
      ? (error as { issues: Array<{ path: Array<string | number>; message: string }> }).issues.map(
          (issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })
        )
      : undefined;
    console.warn('[Agent IPC] Dropping invalid agent event.', issues);
    return;
  }

  console.warn('[Agent IPC] Dropping invalid agent event.');
};
