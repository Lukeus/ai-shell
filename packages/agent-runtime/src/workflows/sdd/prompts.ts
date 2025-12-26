import type { SddStep } from 'packages-api-contracts';

export const SDD_SYSTEM_PROMPT =
  'You are an SDD workflow engine. Output only the requested content without code fences.';

export const SDD_STEP_PROMPTS: Record<SddStep, string> = {
  spec: 'Generate the spec document only. Do not implement code.',
  plan: 'Generate the plan document from the spec only. Do not implement code.',
  tasks: 'Generate the tasks document from the plan only. Do not implement code.',
  implement: 'Generate code changes for the selected task only. Do not apply changes.',
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
}: PromptOptions): string => {
  const outputInstruction = step === 'implement'
    ? [
        'Return a JSON object with this shape:',
        '{ "writes": [ { "path": "path/to/file", "content": "file contents" } ],',
        '  "summary": { "filesChanged": 0, "additions": 0, "deletions": 0 },',
        '  "patch": "optional unified diff patch" }',
        'Include multiple writes when needed. Use workspace-relative paths.',
      ].join('\n')
    : `Return only the contents for ${targetPath}.`;
  const targetLine = step === 'implement'
    ? 'Target: multi-file proposal'
    : `Target file: ${targetPath}`;

  return [
    `Feature: ${featureId}`,
    `Goal: ${goal}`,
    `Step: ${step}`,
    targetLine,
    `Instructions: ${SDD_STEP_PROMPTS[step]}`,
    'Context:',
    formatContext(context),
    outputInstruction,
  ].join('\n');
};
