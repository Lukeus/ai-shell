import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { ZodType } from 'zod';
import type { ErrorInfo, Result } from 'packages-api-contracts';

type SafeHandlerOptions<Input, Output> = {
  inputSchema?: ZodType<Input>;
  outputSchema?: ZodType<Output>;
};

type SafeHandler<Input, Output> = (
  event: IpcMainInvokeEvent,
  input: Input
) => Promise<Output> | Output;

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

/**
 * Registers an IPC handler that never throws across the IPC boundary.
 */
export const handleSafe = <Input = void, Output = void>(
  channel: string,
  options: SafeHandlerOptions<Input, Output>,
  handler: SafeHandler<Input, Output>
): void => {
  ipcMain.handle(
    channel,
    async (event, input: unknown): Promise<Result<Output>> => {
      try {
        const parsedInput = options.inputSchema
          ? options.inputSchema.parse(input)
          : (input as Input);
        const output = await handler(event, parsedInput);
        const parsedOutput = options.outputSchema
          ? options.outputSchema.parse(output)
          : output;
        return { ok: true, value: parsedOutput } as Result<Output>;
      } catch (error) {
        return { ok: false, error: toErrorInfo(error) } as Result<Output>;
      }
    }
  );
};
