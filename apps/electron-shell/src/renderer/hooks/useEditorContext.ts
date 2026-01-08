import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AgentContextAttachment, AgentTextRange } from 'packages-api-contracts';
import { SETTINGS_TAB_ID, useFileTree } from '../components/explorer/FileTreeContext';

export const EDITOR_SELECTION_EVENT = 'ai-shell:editor-selection';

type EditorSelectionDetail = {
  filePath: string;
  selection: {
    range: AgentTextRange;
    snippet: string;
  } | null;
};

type EditorSelectionState = {
  filePath: string;
  range: AgentTextRange;
  snippet: string;
};

const MAX_ATTACHMENT_CHARS = 4000;

const truncateSnippet = (snippet: string, maxChars: number): string => {
  if (snippet.length <= maxChars) {
    return snippet;
  }
  return snippet.slice(0, maxChars);
};

export type UseEditorContextResult = {
  activeFilePath: string | null;
  selection: EditorSelectionState | null;
  canAttachFile: boolean;
  canAttachSelection: boolean;
  buildFileAttachment: () => Promise<AgentContextAttachment | null>;
  buildSelectionAttachment: () => AgentContextAttachment | null;
};

export function useEditorContext(): UseEditorContextResult {
  const { openTabs, activeTabIndex, draftContents } = useFileTree();
  const [selection, setSelection] = useState<EditorSelectionState | null>(null);

  const activeFilePath = useMemo(() => {
    const activeTabId =
      activeTabIndex >= 0 && activeTabIndex < openTabs.length ? openTabs[activeTabIndex] : null;
    if (!activeTabId || activeTabId === SETTINGS_TAB_ID) {
      return null;
    }
    return activeTabId;
  }, [activeTabIndex, openTabs]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<EditorSelectionDetail>).detail;
      if (!detail || detail.filePath !== activeFilePath) {
        return;
      }
      if (!detail.selection) {
        setSelection(null);
        return;
      }
      setSelection({
        filePath: detail.filePath,
        range: detail.selection.range,
        snippet: detail.selection.snippet,
      });
    };

    window.addEventListener(EDITOR_SELECTION_EVENT, handler);
    return () => {
      window.removeEventListener(EDITOR_SELECTION_EVENT, handler);
    };
  }, [activeFilePath]);

  useEffect(() => {
    setSelection((prev) => (prev?.filePath === activeFilePath ? prev : null));
  }, [activeFilePath]);

  const buildFileAttachment = useCallback(async () => {
    if (!activeFilePath) {
      return null;
    }

    let content = draftContents.get(activeFilePath);
    if (content === undefined) {
      try {
        const response = await window.api.fs.readFile({ path: activeFilePath });
        content = response.content ?? '';
      } catch (error) {
        console.warn('Failed to read active file for attachment.', error);
        content = '';
      }
    }

    const snippet = content ? truncateSnippet(content, MAX_ATTACHMENT_CHARS) : undefined;

    return {
      kind: 'file',
      filePath: activeFilePath,
      snippet,
    };
  }, [activeFilePath, draftContents]);

  const buildSelectionAttachment = useCallback(() => {
    if (!selection) {
      return null;
    }
    const snippet = truncateSnippet(selection.snippet, MAX_ATTACHMENT_CHARS);
    return {
      kind: 'selection',
      filePath: selection.filePath,
      range: selection.range,
      snippet,
    };
  }, [selection]);

  return {
    activeFilePath,
    selection,
    canAttachFile: Boolean(activeFilePath),
    canAttachSelection: Boolean(selection),
    buildFileAttachment,
    buildSelectionAttachment,
  };
}
