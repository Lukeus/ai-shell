import { z } from 'zod';
import { JsonValueSchema } from './agent-tools';

export const ExtensionExecuteCommandRequestSchema = z.object({
  commandId: z.string().min(1),
  args: z.array(JsonValueSchema).optional(),
});

export type ExtensionExecuteCommandRequest = z.infer<
  typeof ExtensionExecuteCommandRequestSchema
>;
