import React from 'react';
import { useFileTree } from '../explorer/FileTreeContext';
import { EditorTabBar } from './EditorTabBar';
import { EditorPlaceholder } from './EditorPlaceholder';

/**
 * EditorArea - Main editor container component.
 *
 * P1 (Process isolation): Uses FileTreeContext for tab state management.
 * P4 (Tailwind 4): All styles use CSS variables.
 * P5 (Monaco): Monaco integration deferred to spec 040 - displays placeholder only.
 *
 * @remarks
 * - Combines EditorTabBar (top) and EditorPlaceholder (content)
 * - Shows placeholder with active file path or empty state
 * - Monaco editor will be integrated in spec 040
 */

export function EditorArea() {
  const { openTabs, activeTabIndex } = useFileTree();

  // Determine active file path
  const activeFilePath =
    activeTabIndex >= 0 && activeTabIndex < openTabs.length ? openTabs[activeTabIndex] : null;

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--editor-bg)' }}>
      {/* Tab bar */}
      <EditorTabBar />

      {/* Editor content area (placeholder for now) */}
      <div className="flex-1 overflow-hidden">
        <EditorPlaceholder filePath={activeFilePath} />
      </div>
    </div>
  );
}
