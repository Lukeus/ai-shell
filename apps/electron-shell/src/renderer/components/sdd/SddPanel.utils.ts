import type { SddCustomCommand, SddStep } from 'packages-api-contracts';
import type { SddTaskItem } from './SddTaskListSection';

export const parseTasks = (content: string): SddTaskItem[] => {
  const tasks: SddTaskItem[] = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (!line.startsWith('## ')) {
      continue;
    }
    const heading = line.replace(/^##\s+/, '').trim();
    if (!heading) {
      continue;
    }
    const match = heading.match(/^(Task\s+\d+)(?:\s*[-:]\s*(.+))?$/i);
    if (match) {
      const label = match[2] ? `${match[1]}: ${match[2]}` : match[1];
      tasks.push({ id: heading, label });
      continue;
    }
    tasks.push({ id: heading, label: heading });
  }
  return tasks;
};

export type CustomSlashCommand = {
  command: string;
  step: SddStep;
  label?: string;
  goalTemplate?: string;
};

export type ParsedSlashCommand = {
  command: string;
  step: SddStep;
  input: string;
  goalTemplate?: string;
};

const BUILTIN_SLASH_COMMANDS: Record<string, SddStep> = {
  '/spec': 'spec',
  '/plan': 'plan',
  '/tasks': 'tasks',
  '/implement': 'implement',
  '/review': 'review',
};

export const validateCustomCommands = (
  commands: SddCustomCommand[]
): { commands: CustomSlashCommand[]; errors: string[] } => {
  const errors: string[] = [];
  const normalized = new Set<string>();
  const validated: CustomSlashCommand[] = [];

  for (const command of commands) {
    const normalizedCommand = command.command.trim().toLowerCase();
    if (!normalizedCommand.startsWith('/')) {
      errors.push(`Custom command "${command.command}" must start with "/".`);
      continue;
    }
    if (BUILTIN_SLASH_COMMANDS[normalizedCommand]) {
      errors.push(`Custom command "${normalizedCommand}" conflicts with a built-in command.`);
      continue;
    }
    if (normalized.has(normalizedCommand)) {
      errors.push(`Custom command "${normalizedCommand}" is defined more than once.`);
      continue;
    }
    normalized.add(normalizedCommand);
    validated.push({
      command: normalizedCommand,
      step: command.step,
      label: command.label,
      goalTemplate: command.goalTemplate,
    });
  }

  return { commands: validated, errors };
};

export const parseSlashCommand = (
  value: string,
  customCommands: CustomSlashCommand[]
): ParsedSlashCommand | null => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }
  const parts = trimmed.split(/\s+/);
  const rawCommand = parts[0] ?? '';
  const command = rawCommand.toLowerCase();
  const input = trimmed.slice(rawCommand.length).trim();

  const builtin = BUILTIN_SLASH_COMMANDS[command];
  if (builtin) {
    return { command, step: builtin, input };
  }

  const custom = customCommands.find((entry) => entry.command === command);
  if (!custom) {
    return null;
  }

  return {
    command,
    step: custom.step,
    input,
    goalTemplate: custom.goalTemplate,
  };
};

export const applyGoalTemplate = (
  template: string,
  values: { input: string; featureId: string; taskId: string }
): string =>
  template
    .replace(/{{\s*input\s*}}/gi, values.input)
    .replace(/{{\s*featureId\s*}}/gi, values.featureId)
    .replace(/{{\s*taskId\s*}}/gi, values.taskId)
    .trim();

export const getNextTaskId = (tasks: SddTaskItem[], currentTaskId: string | null): string | null => {
  if (!currentTaskId) {
    return null;
  }
  const currentIndex = tasks.findIndex((task) => task.id === currentTaskId);
  if (currentIndex < 0 || currentIndex >= tasks.length - 1) {
    return null;
  }
  return tasks[currentIndex + 1]?.id ?? null;
};
