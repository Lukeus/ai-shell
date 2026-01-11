import type { ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from '../../styles/agents/AgentMarkdownMessage.module.css';

type AgentMarkdownMessageProps = {
  content: string;
};

const isSafeHref = (href: string | undefined): string | null => {
  if (!href) {
    return null;
  }
  const trimmed = href.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('#')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
      return trimmed;
    }
  } catch {
    return null;
  }
  return null;
};

const LinkRenderer = ({ href, children }: ComponentProps<'a'>) => {
  const safeHref = isSafeHref(href);
  if (!safeHref) {
    return <span>{children}</span>;
  }
  return (
    <a href={safeHref} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  );
};

export function AgentMarkdownMessage({ content }: AgentMarkdownMessageProps) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: LinkRenderer,
          img: () => null,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
