import React, { useState, useEffect } from 'react';
import { MonacoEditor, MonacoEditorProps } from './MonacoEditor';

/**
 * EditorLoader - Wrapper component that handles lazy-loading Monaco Editor with proper state management.
 *
 * P1 (Process isolation): Renderer-only component, no Node.js APIs.
 * P4 (UI design): Uses Tailwind 4 CSS variables for colors, not hardcoded values.
 * P5 (Performance budgets): Enforces lazy-loading pattern for Monaco Editor.
 *
 * @remarks
 * - Displays loading state while Monaco Editor component is being prepared
 * - Shows error state with retry button if loading fails
 * - Renders MonacoEditor component once successfully loaded
 * - Uses manual dynamic import instead of React.lazy() for better error handling
 */

export type EditorLoaderProps = MonacoEditorProps;

type LoadingState = 'loading' | 'success' | 'error';

export function EditorLoader(props: EditorLoaderProps) {
  const [state, setState] = useState<LoadingState>('loading');
  const [MonacoComponent, setMonacoComponent] = useState<typeof MonacoEditor | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // P5 (Performance budgets): Load MonacoEditor component dynamically
  useEffect(() => {
    let isMounted = true;

    const loadEditor = async () => {
      try {
        setState('loading');
        
        // Dynamic import of MonacoEditor component
        // Note: The MonacoEditor component itself handles the monaco-editor library import
        await import('../../monaco/monacoWorkers');
        const module = await import('./MonacoEditor');
        
        if (!isMounted) return;
        
        setMonacoComponent(() => module.MonacoEditor);
        setState('success');
      } catch (err) {
        console.error('Failed to load MonacoEditor component:', err);
        if (isMounted) {
          setState('error');
        }
      }
    };

    loadEditor();

    return () => {
      isMounted = false;
    };
  }, [retryCount]);

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
  };

  // Loading state
  if (state === 'loading') {
    return (
      <div 
        className="flex items-center justify-center h-full"
        style={{ 
          backgroundColor: 'var(--editor-bg)',
          color: 'var(--secondary-fg)',
        }}
      >
        <div className="text-center">
          <div 
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" 
            style={{ borderColor: 'var(--primary-fg)' }}
          />
          <p className="text-sm">Loading Editor...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div 
        className="flex items-center justify-center h-full"
        style={{ 
          backgroundColor: 'var(--editor-bg)',
          color: 'var(--error-fg)',
        }}
      >
        <div className="text-center p-8">
          <svg
            width="48"
            height="48"
            viewBox="0 0 16 16"
            fill="currentColor"
            className="mx-auto mb-4"
            style={{ color: 'var(--error-fg)' }}
          >
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 5h2v4H7V5zm0 5h2v2H7v-2z" />
          </svg>
          <h3 className="text-lg font-semibold mb-2">Failed to load editor</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--secondary-fg)' }}>
            The code editor component could not be loaded.
          </p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 rounded"
            style={{
              backgroundColor: 'var(--button-bg)',
              color: 'var(--button-fg)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--button-hover-bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--button-bg)';
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Success state - render MonacoEditor
  if (state === 'success' && MonacoComponent) {
    return <MonacoComponent {...props} />;
  }

  // Fallback (should never reach here)
  return null;
}
