import type {
  AgentContextAttachment,
  AgentEditRequestOptions,
  AgentTextRange,
} from 'packages-api-contracts';

const MAX_SNIPPET_CHARS = 4000;
const MAX_TOTAL_SNIPPET_CHARS = 12000;

type BuildEditPromptOptions = {
  prompt: string;
  attachments: AgentContextAttachment[];
  options?: AgentEditRequestOptions;
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

const formatOptions = (options?: AgentEditRequestOptions): string => {
  if (!options) {
    return 'Options: none';
  }

  const lines: string[] = ['Options:'];
  if (typeof options.allowWrites === 'boolean') {
    lines.push(`- allowWrites: ${options.allowWrites ? 'true' : 'false'}`);
  }
  if (typeof options.includeTests === 'boolean') {
    lines.push(`- includeTests: ${options.includeTests ? 'true' : 'false'}`);
  }
  if (typeof options.maxPatchBytes === 'number') {
    lines.push(`- maxPatchBytes: ${options.maxPatchBytes}`);
  }

  return lines.length === 1 ? 'Options: none' : lines.join('\n');
};

const formatAttachment = (
  attachment: AgentContextAttachment,
  index: number,
  budget: SnippetBudget
): string => {
  const header = `[Attachment ${index + 1}] ${attachment.kind}`;
  const lines: string[] = [
    header,
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

export const EDIT_SYSTEM_PROMPT =
  'You are a code editing assistant. Return ONLY valid JSON. ' +
  'Use this shape: { "summary": "short description", "proposal": { "writes": [], "patch": "", ' +
  '"summary": { "filesChanged": 0, "additions": 0, "deletions": 0 } } }. ' +
  'Use workspace-relative paths. Use unified diff format for patch output. ' +
  'Do not apply changes.';

export const buildEditPrompt = ({
  prompt,
  attachments,
  options,
}: BuildEditPromptOptions): string =>
  [
    `User request: ${prompt}`,
    '',
    formatOptions(options),
    '',
    formatAttachments(attachments),
  ].join('\n');
