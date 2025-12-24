import type { SddStep } from 'packages-api-contracts';

export const SDD_SYSTEM_PROMPT =
  'You are an SDD workflow engine. Output only the target file content without code fences.';

export const SDD_STEP_PROMPTS: Record<SddStep, string> = {
  spec: 'Generate specs/<feature>/spec.md only. Do not implement code.',
  plan: 'Generate specs/<feature>/plan.md from spec.md only. Do not implement code.',
  tasks: 'Generate specs/<feature>/tasks.md from plan.md only. Do not implement code.',
  implement: 'Produce a unified diff patch for the selected task only. Do not apply changes.',
  review: 'Review implementation against acceptance criteria and propose fixes only.',
};

type PromptOptions = {
  step: SddStep;
  featureId: string;
  goal: string;
  targetPath: string;
  context: Record<string, string>;
};

const formatContext = (context: Record<string, string>): string => {
  const entries = Object.entries(context);
  if (entries.length === 0) {
    return 'None';
  }

  return entries
    .map(([path, content]) => `--- ${path}\n${content}\n---`)
    .join('\n\n');
};

export const buildSddPrompt = ({
  step,
  featureId,
  goal,
  targetPath,
  context,
}: PromptOptions): string =>
  [
    `Feature: ${featureId}`,
    `Goal: ${goal}`,
    `Step: ${step}`,
    `Target file: ${targetPath}`,
    `Instructions: ${SDD_STEP_PROMPTS[step]}`,
    'Context:',
    formatContext(context),
    `Return only the contents for ${targetPath}.`,
  ].join('\n');
