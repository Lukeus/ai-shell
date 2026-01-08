import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as monacoType from 'monaco-editor';
import { EDITOR_SELECTION_EVENT } from '../../hooks/useEditorContext';

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
  /** Editor font size */
  fontSize?: number;
  /** Tab size in spaces */
  tabSize?: number;
  /** Whether line numbers are shown */
  lineNumbers?: boolean;
  /** Whether minimap is enabled */
  minimap?: boolean;
  /** Whether word wrap is enabled */
  wordWrap?: boolean;
  /** Optional callback when content changes (for future save functionality) */
  onChange?: (content: string) => void;
  /** Optional callback when editor instance is ready */
  onEditorReady?: (handle: MonacoEditorHandle) => void;
  /** Optional callback when cursor position changes */
  onCursorChange?: (position: BreadcrumbPosition) => void;
  /** Optional callback when document symbols change */
  onSymbolsChange?: (symbols: BreadcrumbSymbol[]) => void;
}

const MAX_SELECTION_SNIPPET_CHARS = 4000;

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
  fontSize = 14,
  tabSize = 2,
  lineNumbers = true,
  minimap = true,
  wordWrap = false,
  onChange,
  onEditorReady,
  onCursorChange,
  onSymbolsChange,
}: MonacoEditorProps) {
  const editorRef = useRef<React.ElementRef<'div'>>(null);
  const [editor, setEditor] = useState<monacoType.editor.IStandaloneCodeEditor | null>(null);
  const [monaco, setMonaco] = useState<typeof monacoType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const modelUsageRef = useRef<Map<string, number>>(new Map());
  const MAX_MODELS = 50;
  
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

    // Set default compiler options for TypeScript
    const typescriptDefaults = (monaco.languages.typescript as any).typescriptDefaults;
    typescriptDefaults.setCompilerOptions({
      target: (monaco.languages.typescript as any).ScriptTarget.ES2022,
      module: (monaco.languages.typescript as any).ModuleKind.ESNext,
      moduleResolution: (monaco.languages.typescript as any).ModuleResolutionKind.NodeJs,
      jsx: (monaco.languages.typescript as any).JsxEmit.React,
      allowNonTsExtensions: true,
      resolveJsonModule: true,
      esModuleInterop: true,
      skipLibCheck: true,
      allowJs: true,
      typeRoots: ['node_modules/@types'],
    });

    // Enable eager model sync to help with cross-model diagnostics
    typescriptDefaults.setEagerModelSync(true);

    const uri = monaco.Uri.file(filePath);
    let model = monaco.editor.getModel(uri);

    if (!model) {
      model = monaco.editor.createModel(content, undefined, uri);
    }

    // Create editor instance with all features enabled
    // Worker configuration is handled in src/renderer/monaco/monacoWorkers.ts
    const editorInstance = monaco.editor.create(editorRef.current, {
      model: model,
      theme: resolveMonacoTheme(),
      automaticLayout: false, // We'll handle layout manually
      readOnly: false,
      minimap: { enabled: minimap },
      scrollBeyondLastLine: false,
      fontFamily: 'var(--vscode-editor-font-family)',
      fontSize: fontSize,
      lineNumbers: lineNumbers ? 'on' : 'off',
      renderWhitespace: 'selection',
      tabSize: tabSize,
      wordWrap: wordWrap ? 'on' : 'off',
    });

    setEditor(editorInstance);
  }, [monaco, editor, filePath, content, minimap, lineNumbers, wordWrap, fontSize, tabSize]);

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
    if (!editor) {
      return;
    }

    const emitSelection = () => {
      const model = editor.getModel?.();
      if (!model) {
        return;
      }

      const selection = editor.getSelection?.();
      if (!selection || selection.isEmpty()) {
        window.dispatchEvent(
          new CustomEvent(EDITOR_SELECTION_EVENT, {
            detail: { filePath, selection: null },
          })
        );
        return;
      }

      const start = selection.getStartPosition();
      const end = selection.getEndPosition();
      const snippet = model.getValueInRange(selection);
      const trimmed = snippet.length > MAX_SELECTION_SNIPPET_CHARS
        ? snippet.slice(0, MAX_SELECTION_SNIPPET_CHARS)
        : snippet;

      window.dispatchEvent(
        new CustomEvent(EDITOR_SELECTION_EVENT, {
          detail: {
            filePath,
            selection: {
              range: {
                startLineNumber: start.lineNumber,
                startColumn: start.column,
                endLineNumber: end.lineNumber,
                endColumn: end.column,
              },
              snippet: trimmed,
            },
          },
        })
      );
    };

    emitSelection();
    const disposable = editor.onDidChangeCursorSelection(() => {
      emitSelection();
    });

    return () => {
      disposable.dispose();
    };
  }, [editor, filePath]);

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

  // Update editor content and model when filePath or content changes
  useEffect(() => {
    if (!editor || !monaco) return;

    const uri = monaco.Uri.file(filePath);
    let model = monaco.editor.getModel(uri);

    if (!model) {
      // P5 (Performance budgets): Leverage Monaco's built-in language detection from extension
      model = monaco.editor.createModel(content, undefined, uri);
    } else {
      if (model.getValue() !== content) {
        model.setValue(content);
      }
    }

    // Update model usage for LRU cache
    modelUsageRef.current.set(filePath, Date.now());

    // Clean up old models if limit exceeded
    if (modelUsageRef.current.size > MAX_MODELS) {
      const sortedModels = Array.from(modelUsageRef.current.entries())
        .sort((a, b) => a[1] - b[1]);
      
      const toRemoveCount = modelUsageRef.current.size - MAX_MODELS;
      for (let i = 0; i < toRemoveCount; i++) {
        const [pathToRemove] = sortedModels[i];
        if (pathToRemove !== filePath) {
          const modelToRemove = monaco.editor.getModel(monaco.Uri.file(pathToRemove));
          if (modelToRemove) {
            modelToRemove.dispose();
          }
          modelUsageRef.current.delete(pathToRemove);
        }
      }
    }

    if (editor.getModel() !== model) {
      editor.setModel(model);
    }

    // Update options if changed
    editor.updateOptions({
      lineNumbers: lineNumbers ? 'on' : 'off',
      minimap: { enabled: minimap },
      wordWrap: wordWrap ? 'on' : 'off',
      fontSize: fontSize,
      tabSize: tabSize,
    });

    scheduleSymbolUpdate(0);
  }, [editor, monaco, content, filePath, lineNumbers, minimap, wordWrap, fontSize, tabSize, scheduleSymbolUpdate]);

  // Handle resize events
  useEffect(() => {
    if (!editor) return;

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
      // Models are kept in memory for performance as requested in the task.
      // They are indexed by URI (filePath) and will be reused if the file is reopened.
      // This allows Monaco to maintain diagnostic state across file switches.
      // Note: We don't dispose models here because we want to preserve their state (markers, undo stack)
      // when switching between tabs in the UI.
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
        className="flex items-center justify-center h-full animate-pulse"
        style={{ 
          backgroundColor: 'var(--vscode-editor-background)',
          color: 'var(--vscode-descriptionForeground)',
        }}
      >
        <div className="text-center">
          <div className="h-8 w-8 border-2 mx-auto mb-4 border-t-accent rounded-full animate-spin" 
               style={{ borderColor: 'var(--vscode-editor-foreground) var(--vscode-editor-foreground) var(--vscode-editor-foreground) var(--vscode-button-background)' }} />
          <p className="text-sm opacity-80">Loading Editor...</p>
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
