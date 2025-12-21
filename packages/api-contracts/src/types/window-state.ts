import { z } from 'zod';

export const WindowStateSchema = z.object({
  isMaximized: z.boolean(),
});

export type WindowState = z.infer<typeof WindowStateSchema>;
