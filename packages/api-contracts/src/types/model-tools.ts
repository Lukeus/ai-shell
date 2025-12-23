import { z } from 'zod';

export const ModelGenerateRequestSchema = z.object({
  connectionId: z.string().uuid().optional(),
  modelRef: z.string().optional(),
  prompt: z.string().min(1),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export type ModelGenerateRequest = z.infer<typeof ModelGenerateRequestSchema>;

export const ModelGenerateResponseSchema = z.object({
  text: z.string(),
});

export type ModelGenerateResponse = z.infer<typeof ModelGenerateResponseSchema>;
