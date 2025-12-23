import React, { useCallback, useEffect, useRef, useState } from 'react';

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
 * - Content is editable; save lifecycle handled by EditorArea + FileTreeContext
 */

export interface BreadcrumbPosition {
  lineNumber: number;
  column: number;
}

export interface BreadcrumbRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface BreadcrumbSymbol {
  name: string;
  kind: number;
  range: BreadcrumbRange;
  selectionRange?: BreadcrumbRange;
  children?: BreadcrumbSymbol[];
}

export interface MonacoEditorHandle {
  focus: () => void;
  setPosition: (position: BreadcrumbPosition) => void;
  revealRangeInCenter: (range: BreadcrumbRange) => void;
  layout: () => void;
}

export interface MonacoEditorProps {
  /** Absolute path to the file being edited */
  filePath: string;
  /** File content to display in editor */
  content: string;
  /** Monaco language identifier (e.g., 'typescript', 'javascript', 'json') */
  language: string;
  /** Optional callback when content changes (for future save functionality) */
  onChange?: (content: string) => void;
  /** Optional callback when editor instance is ready */
  onEditorReady?: (handle: MonacoEditorHandle) => void;
  /** Optional callback when cursor position changes */
  onCursorChange?: (position: BreadcrumbPosition) => void;
  /** Optional callback when document symbols change */
  onSymbolsChange?: (symbols: BreadcrumbSymbol[]) => void;
}

const resolveMonacoTheme = (): string => {
  const theme = document.documentElement.getAttribute('data-theme') ?? 'dark';

  if (theme === 'light') {
    return 'vs';
  }
  if (theme === 'high-contrast-dark') {
    return 'hc-black';
  }
  if (theme === 'high-contrast-light') {
    return 'hc-light';
  }
  if (theme === 'system') {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'vs-dark';
    }
    return 'vs';
  }

  return 'vs-dark';
};

export function MonacoEditor({
  filePath,
  content,
  language,
  onChange,
  onEditorReady,
  onCursorChange,
  onSymbolsChange,
}: MonacoEditorProps) {
  const editorRef = useRef<React.ElementRef<'div'>>(null);
  const [editor, setEditor] = useState<any>(null);
  const [monaco, setMonaco] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const symbolUpdateTimeoutRef = useRef<number | null>(null);
  const symbolRequestIdRef = useRef(0);
  const symbolTokenRef = useRef<{ cancel?: () => void; dispose?: () => void } | null>(null);
  const outlineSupportRef = useRef<{
    OutlineModel: { create: (registry: unknown, model: unknown, token: unknown) => Promise<{ getTopLevelSymbols: () => BreadcrumbSymbol[] }> };
    StandaloneServices: { get: (service: unknown) => { documentSymbolProvider: unknown } };
    ILanguageFeaturesService: unknown;
  } | null>(null);

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

  const loadOutlineSupport = useCallback(async () => {
    if (outlineSupportRef.current) {
      return outlineSupportRef.current;
    }

    const [outlineModule, servicesModule, languageModule] = await Promise.all([
      import('monaco-editor/esm/vs/editor/contrib/documentSymbols/browser/outlineModel'),
      import('monaco-editor/esm/vs/editor/standalone/browser/standaloneServices'),
      import('monaco-editor/esm/vs/editor/common/services/languageFeatures'),
    ]);

    const support = {
      OutlineModel: outlineModule.OutlineModel,
      StandaloneServices: servicesModule.StandaloneServices,
      ILanguageFeaturesService: languageModule.ILanguageFeaturesService,
    };

    outlineSupportRef.current = support;
    return support;
  }, []);

  const requestSymbols = useCallback(async () => {
    if (!editor || !monaco || !onSymbolsChange) {
      return;
    }

    const model = editor.getModel?.();
    if (!model) {
      onSymbolsChange([]);
      return;
    }

    const requestId = symbolRequestIdRef.current + 1;
    symbolRequestIdRef.current = requestId;

    symbolTokenRef.current?.cancel?.();
    symbolTokenRef.current?.dispose?.();

    const tokenSource = new monaco.CancellationTokenSource();
    symbolTokenRef.current = tokenSource;

    try {
      const support = await loadOutlineSupport();
      const languageFeaturesService = support.StandaloneServices.get(support.ILanguageFeaturesService);
      const outline = await support.OutlineModel.create(
        languageFeaturesService.documentSymbolProvider,
        model,
        tokenSource.token
      );

      if (symbolRequestIdRef.current !== requestId) {
        return;
      }

      onSymbolsChange(outline.getTopLevelSymbols());
    } catch (err) {
      if (tokenSource.token?.isCancellationRequested) {
        return;
      }
      if (symbolRequestIdRef.current === requestId) {
        console.warn('Failed to load document symbols:', err);
        onSymbolsChange([]);
      }
    } finally {
      tokenSource.dispose?.();
      if (symbolTokenRef.current === tokenSource) {
        symbolTokenRef.current = null;
      }
    }
  }, [editor, monaco, onSymbolsChange, loadOutlineSupport]);

  const scheduleSymbolUpdate = useCallback(
    (delay = 200) => {
      if (!onSymbolsChange) {
        return;
      }

      if (symbolUpdateTimeoutRef.current) {
        window.clearTimeout(symbolUpdateTimeoutRef.current);
      }

      symbolUpdateTimeoutRef.current = window.setTimeout(() => {
        void requestSymbols();
      }, delay);
    },
    [onSymbolsChange, requestSymbols]
  );

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
    if (!monaco || !editorRef.current || editor) return;

    // Create editor instance with all features enabled
    // Worker configuration is handled in src/renderer/monaco/monacoWorkers.ts
    const editorInstance = monaco.editor.create(editorRef.current, {
      value: content,
      language: language,
      theme: resolveMonacoTheme(),
      automaticLayout: false, // We'll handle layout manually
      readOnly: false,
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      fontFamily: 'var(--vscode-editor-font-family)',
      fontSize: 14,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      tabSize: 2,
    });

    setEditor(editorInstance);
  }, [monaco, editor, content, language]);

  useEffect(() => {
    if (!monaco) {
      return;
    }

    const applyTheme = () => {
      monaco.editor.setTheme(resolveMonacoTheme());
    };

    applyTheme();

    const observer = new MutationObserver(() => applyTheme());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => {
      if (document.documentElement.getAttribute('data-theme') === 'system') {
        applyTheme();
      }
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else {
      mediaQuery.addListener(handleMediaChange);
    }

    return () => {
      observer.disconnect();
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } else {
        mediaQuery.removeListener(handleMediaChange);
      }
    };
  }, [monaco]);

  useEffect(() => {
    if (!editor || !onChange) {
      return;
    }

    const disposable = editor.onDidChangeModelContent(() => {
      onChange(editor.getValue());
    });

    return () => {
      disposable.dispose();
    };
  }, [editor, onChange]);

  useEffect(() => {
    if (!editor || !onEditorReady) {
      return;
    }

    const handle: MonacoEditorHandle = {
      focus: () => editor.focus(),
      setPosition: (position) => editor.setPosition(position),
      revealRangeInCenter: (range) => editor.revealRangeInCenter(range),
      layout: () => editor.layout(),
    };

    onEditorReady(handle);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor || !onCursorChange) {
      return;
    }

    const disposable = editor.onDidChangeCursorPosition((event: { position: BreadcrumbPosition }) => {
      onCursorChange({
        lineNumber: event.position.lineNumber,
        column: event.position.column,
      });
    });

    const initialPosition = editor.getPosition?.();
    if (initialPosition) {
      onCursorChange({
        lineNumber: initialPosition.lineNumber,
        column: initialPosition.column,
      });
    }

    return () => {
      disposable.dispose();
    };
  }, [editor, onCursorChange]);

  useEffect(() => {
    if (!editor || !onSymbolsChange) {
      return;
    }

    const contentDisposable = editor.onDidChangeModelContent(() => {
      scheduleSymbolUpdate();
    });
    const modelDisposable = editor.onDidChangeModel(() => {
      scheduleSymbolUpdate();
    });

    scheduleSymbolUpdate(0);

    return () => {
      contentDisposable.dispose();
      modelDisposable.dispose();
    };
  }, [editor, onSymbolsChange, scheduleSymbolUpdate]);

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

    scheduleSymbolUpdate(0);
  }, [editor, monaco, content, language, filePath, scheduleSymbolUpdate]);

  // Handle resize events
  useEffect(() => {
    if (!editor) return;

    const handleResize = () => {
      editor.layout();
    };

    window.addEventListener('resize', handleResize);

    let observer: ResizeObserver | null = null;
    if (editorRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        editor.layout();
      });
      observer.observe(editorRef.current);
    }

    // Trigger initial layout
    const layoutTimer = window.setTimeout(() => {
      editor.layout();
    }, 0);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) {
        observer.disconnect();
      }
      window.clearTimeout(layoutTimer);
    };
  }, [editor]);

  // Cleanup: dispose editor on unmount
  useEffect(() => {
    return () => {
      if (symbolUpdateTimeoutRef.current) {
        window.clearTimeout(symbolUpdateTimeoutRef.current);
      }
      symbolTokenRef.current?.cancel?.();
      symbolTokenRef.current?.dispose?.();
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
          <p className="text-md">Loading Editor...</p>
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
