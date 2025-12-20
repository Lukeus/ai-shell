import React, { useEffect, useState, Suspense } from 'react';
import { useFileTree } from '../explorer/FileTreeContext';
import { EditorTabBar } from './EditorTabBar';
import { EditorPlaceholder } from './EditorPlaceholder';
import { EditorLoader } from './EditorLoader';

/**
 * EditorArea - Main editor container component with Monaco Editor integration.
 *
 * P1 (Process isolation): File I/O via IPC only, renderer sandboxed.
 * P4 (Tailwind 4): All styles use CSS variables.
 * P5 (Performance budgets): Monaco lazy-loaded via EditorLoader, not loaded when no file open.
 * P6 (Contracts-first): Uses existing api-contracts for file reading (no new contracts needed).
 *
 * @remarks
 * - Combines EditorTabBar (top) and editor content area (bottom)
 * - Shows EditorPlaceholder when no file is open
 * - Loads Monaco Editor via EditorLoader when file is open
 * - Fetches file content from main process via IPC (FS_READ_FILE)
 * - Infers language from file extension for syntax highlighting
 */

export function EditorArea() {
  const { openTabs, activeTabIndex } = useFileTree();
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine active file path
  const activeFilePath =
    activeTabIndex >= 0 && activeTabIndex < openTabs.length ? openTabs[activeTabIndex] : null;

  // P1 (Process isolation): Fetch file content via IPC when active file changes
  useEffect(() => {
    if (!activeFilePath) {
      // Reset states when no file is open
      // Use setTimeout to avoid synchronous setState in effect
      const timer = setTimeout(() => {
        setFileContent('');
        setError(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    let isMounted = true;

    const fetchFileContent = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // P6 (Contracts-first): Use existing fs.readFile API from preload
        const response = await window.api.fs.readFile({ path: activeFilePath });

        if (!isMounted) return;

        setFileContent(response.content || '');
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to read file:', err);
        if (isMounted) {
          setError(`Failed to read file: ${err instanceof Error ? err.message : 'Unknown error'}`);
          setIsLoading(false);
        }
      }
    };

    fetchFileContent();

    return () => {
      isMounted = false;
    };
  }, [activeFilePath]);

  // Infer Monaco language from file extension
  const getLanguageFromPath = (filePath: string): string => {
    const fileName = filePath.split(/[\\/]/).pop()?.toLowerCase();
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    if (fileName === 'dockerfile') {
      return 'dockerfile';
    }

    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
      case 'mjs':
      case 'cjs':
        return 'javascript';
      case 'json':
      case 'jsonc':
        return 'json';
      case 'md':
      case 'markdown':
      case 'mdx':
        return 'markdown';
      case 'html':
      case 'htm':
        return 'html';
      case 'css':
        return 'css';
      case 'scss':
      case 'sass':
        return 'scss';
      case 'less':
        return 'less';
      case 'yaml':
      case 'yml':
        return 'yaml';
      case 'xml':
      case 'svg':
        return 'xml';
      case 'py':
        return 'python';
      case 'sh':
      case 'bash':
        return 'shell';
      case 'ps1':
      case 'psm1':
      case 'psd1':
        return 'powershell';
      case 'bat':
      case 'cmd':
        return 'bat';
      case 'ini':
      case 'properties':
      case 'editorconfig':
        return 'ini';
      case 'c':
      case 'h':
        return 'c';
      case 'cpp':
      case 'cc':
      case 'cxx':
      case 'hpp':
      case 'hh':
      case 'hxx':
        return 'cpp';
      case 'cs':
        return 'csharp';
      case 'java':
        return 'java';
      case 'go':
        return 'go';
      case 'rs':
        return 'rust';
      case 'rb':
        return 'ruby';
      case 'php':
        return 'php';
      case 'sql':
        return 'sql';
      default:
        return 'plaintext';
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-surface">
      {/* Tab bar */}
      <EditorTabBar />

      {/* Editor content area - NO extra padding/margin */}
      <div className="flex-1 overflow-hidden min-h-0 bg-surface">
        {!activeFilePath ? (
          // Empty state: no file open
          <EditorPlaceholder filePath={null} />
        ) : error ? (
          // Error state: failed to load file
          <div 
            className="flex items-center justify-center h-full"
            style={{ 
              backgroundColor: 'var(--editor-bg)',
              color: 'var(--error-fg)',
            }}
          >
            <div className="text-center p-4">
              <p>{error}</p>
            </div>
          </div>
        ) : isLoading ? (
          // Loading state: fetching file content
          <div 
            className="flex items-center justify-center h-full"
            style={{ 
              backgroundColor: 'var(--editor-bg)',
              color: 'var(--secondary-fg)',
            }}
          >
            <div className="text-center">
              <div 
                className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" 
                style={{ borderColor: 'var(--primary-fg)' }}
              />
              <p className="text-sm">Loading file...</p>
            </div>
          </div>
        ) : (
          // P5 (Performance budgets): Monaco loaded only when file is open
          // Suspense boundary for lazy-loading Monaco Editor
          <Suspense
            fallback={
              <div 
                className="flex items-center justify-center h-full"
                style={{ 
                  backgroundColor: 'var(--editor-bg)',
                  color: 'var(--secondary-fg)',
                }}
              >
                <div className="text-center">
                  <div 
                    className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" 
                    style={{ borderColor: 'var(--primary-fg)' }}
                  />
                  <p className="text-sm">Loading Editor...</p>
                </div>
              </div>
            }
          >
            <EditorLoader
              filePath={activeFilePath}
              content={fileContent}
              language={getLanguageFromPath(activeFilePath)}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
