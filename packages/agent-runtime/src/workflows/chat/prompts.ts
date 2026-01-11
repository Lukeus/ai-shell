import type {
  AgentContextAttachment,
  AgentMessageRole,
  AgentTextRange,
} from 'packages-api-contracts';

const MAX_SNIPPET_CHARS = 4000;
const MAX_TOTAL_SNIPPET_CHARS = 12000;

export type ChatHistoryEntry = {
  role: AgentMessageRole;
  content: string;
  createdAt?: string;
};

type BuildChatPromptOptions = {
  prompt: string;
  attachments: AgentContextAttachment[];
  history: ChatHistoryEntry[];
};

type SnippetBudget = {
  remaining: number;
};

const formatRange = (range?: AgentTextRange): string => {
  if (!range) {
    return 'full';
  }
  return `${range.startLineNumber}:${range.startColumn}-${range.endLineNumber}:${range.endColumn}`;
};

const truncateSnippet = (
  snippet: string,
  maxChars: number
): { text: string; truncated: boolean } => {
  if (snippet.length <= maxChars) {
    return { text: snippet, truncated: false };
  }
  return { text: snippet.slice(0, maxChars), truncated: true };
};

const formatAttachment = (
  attachment: AgentContextAttachment,
  index: number,
  budget: SnippetBudget
): string => {
  const lines: string[] = [
    `[Attachment ${index + 1}] ${attachment.kind}`,
    `File: ${attachment.filePath}`,
    `Range: ${formatRange(attachment.range)}`,
  ];

  if (typeof attachment.snippet === 'string' && attachment.snippet.length > 0) {
    if (budget.remaining <= 0) {
      lines.push('Snippet: (omitted due to size limit)');
    } else {
      const maxChars = Math.min(MAX_SNIPPET_CHARS, budget.remaining);
      const clipped = truncateSnippet(attachment.snippet, maxChars);
      budget.remaining -= clipped.text.length;
      lines.push('Snippet:');
      lines.push(clipped.text);
      if (clipped.truncated) {
        lines.push('[truncated]');
      }
    }
  } else {
    lines.push('Snippet: (not provided)');
  }

  return lines.join('\n');
};

const formatAttachments = (attachments: AgentContextAttachment[]): string => {
  if (attachments.length === 0) {
    return 'Attachments: none';
  }

  const budget: SnippetBudget = { remaining: MAX_TOTAL_SNIPPET_CHARS };
  const blocks = attachments.map((attachment, index) =>
    formatAttachment(attachment, index, budget)
  );

  return ['Attachments:', ...blocks].join('\n\n');
};

const formatHistory = (history: ChatHistoryEntry[]): string => {
  if (history.length === 0) {
    return 'History: none';
  }

  const lines = history.map((entry) => {
    const timestamp = entry.createdAt ? ` (${entry.createdAt})` : '';
    return `- ${entry.role}${timestamp}: ${entry.content}`;
  });

  return ['History:', ...lines].join('\n');
};

export const CHAT_SYSTEM_PROMPT = [
  'You are a helpful assistant.',
  'Respond in GitHub-flavored Markdown.',
  'Do not include raw HTML.',
  'Do not reveal chain-of-thought; provide concise, user-facing answers.',
  'Use the provided context and respond clearly.',
].join(' ');

export const buildChatPrompt = ({
  prompt,
  attachments,
  history,
}: BuildChatPromptOptions): string =>
  [
    `User request: ${prompt}`,
    '',
    formatHistory(history),
    '',
    formatAttachments(attachments),
  ].join('\n');
