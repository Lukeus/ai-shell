import React, { useEffect, useRef, useState } from 'react';

/**
 * MonacoEditor - Code editor component with lazy-loaded Monaco Editor.
 *
 * P1 (Process isolation): Runs in sandboxed renderer process with no Node.js access.
 * P5 (Performance budgets): Monaco loaded via dynamic import only when component mounts.
 * P4 (UI design): Uses Tailwind 4 CSS variables for styling.
 *
 * @remarks
 * - Monaco Editor is dynamically imported to keep it out of initial bundle
 * - Editor instance is properly disposed on unmount to prevent memory leaks
 * - Handles resize events to maintain correct editor layout
 * - Content is read-only by default (save functionality deferred to future spec)
 */

export interface MonacoEditorProps {
  /** Absolute path to the file being edited */
  filePath: string;
  /** File content to display in editor */
  content: string;
  /** Monaco language identifier (e.g., 'typescript', 'javascript', 'json') */
  language: string;
  /** Optional callback when content changes (for future save functionality) */
  onChange?: (content: string) => void;
}

export function MonacoEditor({ filePath, content, language, onChange }: MonacoEditorProps) {
  const editorRef = useRef<React.ElementRef<'div'>>(null);
  const [editor, setEditor] = useState<any>(null);
  const [monaco, setMonaco] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { name?: string; message?: string; stack?: string } | null;
      if (!reason || typeof reason !== 'object') return;

      const isCanceled = reason.name === 'Canceled' || reason.message?.includes('Canceled');
      const fromMonaco =
        typeof reason.stack === 'string' && reason.stack.includes('monaco-editor');

      if (isCanceled && fromMonaco) {
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // P5 (Performance budgets): Dynamic import of Monaco Editor
  useEffect(() => {
    let isMounted = true;

    const initMonaco = async () => {
      try {
        // Dynamic import to keep Monaco out of initial bundle
        const monacoModule = await import('monaco-editor');
        await Promise.allSettled([
          import('monaco-editor/esm/vs/basic-languages/bat/bat.contribution'),
          import('monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution'),
          import('monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution'),
          import('monaco-editor/esm/vs/basic-languages/dockerfile/dockerfile.contribution'),
          import('monaco-editor/esm/vs/basic-languages/go/go.contribution'),
          import('monaco-editor/esm/vs/basic-languages/ini/ini.contribution'),
          import('monaco-editor/esm/vs/basic-languages/java/java.contribution'),
          import('monaco-editor/esm/vs/basic-languages/less/less.contribution'),
          import('monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution'),
          import('monaco-editor/esm/vs/basic-languages/php/php.contribution'),
          import('monaco-editor/esm/vs/basic-languages/powershell/powershell.contribution'),
          import('monaco-editor/esm/vs/basic-languages/python/python.contribution'),
          import('monaco-editor/esm/vs/basic-languages/ruby/ruby.contribution'),
          import('monaco-editor/esm/vs/basic-languages/rust/rust.contribution'),
          import('monaco-editor/esm/vs/basic-languages/scss/scss.contribution'),
          import('monaco-editor/esm/vs/basic-languages/shell/shell.contribution'),
          import('monaco-editor/esm/vs/basic-languages/sql/sql.contribution'),
          import('monaco-editor/esm/vs/basic-languages/xml/xml.contribution'),
          import('monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution'),
          import('monaco-editor/esm/vs/language/css/monaco.contribution'),
          import('monaco-editor/esm/vs/language/html/monaco.contribution'),
          import('monaco-editor/esm/vs/language/json/monaco.contribution'),
          import('monaco-editor/esm/vs/language/typescript/monaco.contribution'),
        ]);
        
        if (!isMounted) return;
        
        setMonaco(monacoModule);
      } catch (err) {
        console.error('Failed to load Monaco Editor:', err);
        if (isMounted) {
          setError('Failed to load Monaco Editor. Please refresh the page.');
        }
      }
    };

    initMonaco();

    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize editor instance when Monaco is loaded
  useEffect(() => {
    if (!monaco || !editorRef.current) return;

    // Create editor instance with all features enabled
    // Worker configuration is handled in src/renderer/monaco/monacoWorkers.ts
    const editorInstance = monaco.editor.create(editorRef.current, {
      value: content,
      language: language,
      theme: 'vs-dark',
      automaticLayout: false, // We'll handle layout manually
      readOnly: true, // Read-only for now (save functionality deferred)
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      fontFamily: 'var(--vscode-editor-font-family)',
      fontSize: 14,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      tabSize: 2,
    });

    setEditor(editorInstance);

    // Handle content changes if onChange provided
    if (onChange) {
      const disposable = editorInstance.onDidChangeModelContent(() => {
        onChange(editorInstance.getValue());
      });

      return () => {
        disposable.dispose();
      };
    }
  }, [monaco, content, language, onChange]);

  // Update editor content when filePath or content changes
  useEffect(() => {
    if (!editor || !monaco) return;

    const currentValue = editor.getValue();
    if (currentValue !== content) {
      editor.setValue(content);
    }

    // Update language if changed
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, language);
    }
  }, [editor, monaco, content, language, filePath]);

  // Handle resize events
  useEffect(() => {
    if (!editor) return;

    const handleResize = () => {
      editor.layout();
    };

    window.addEventListener('resize', handleResize);

    // Trigger initial layout
    setTimeout(() => {
      editor.layout();
    }, 0);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [editor]);

  // Cleanup: dispose editor on unmount
  useEffect(() => {
    return () => {
      if (editor) {
        editor.dispose();
      }
    };
  }, [editor]);

  if (error) {
    return (
      <div 
        className="flex items-center justify-center h-full"
        style={{ 
          backgroundColor: 'var(--editor-bg)',
          color: 'var(--error-fg)',
        }}
      >
        <div className="text-center p-4">
          <p className="mb-4">{error}</p>
        </div>
      </div>
    );
  }

  if (!monaco) {
    return (
      <div 
        className="flex items-center justify-center h-full"
        style={{ 
          backgroundColor: 'var(--editor-bg)',
          color: 'var(--secondary-fg)',
        }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" 
               style={{ borderColor: 'var(--primary-fg)' }} />
          <p className="text-sm">Loading Editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={editorRef} 
      className="h-full w-full"
      style={{ backgroundColor: 'var(--editor-bg)' }}
    />
  );
}
