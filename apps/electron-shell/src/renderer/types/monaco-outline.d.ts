declare module 'monaco-editor/esm/vs/editor/contrib/documentSymbols/browser/outlineModel' {
  interface BreadcrumbRange {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  }

  interface BreadcrumbSymbol {
    name: string;
    kind: number;
    range: BreadcrumbRange;
    selectionRange?: BreadcrumbRange;
    children?: BreadcrumbSymbol[];
  }

  export const OutlineModel: {
    create: (
      registry: unknown,
      model: unknown,
      token: unknown
    ) => Promise<{ getTopLevelSymbols: () => BreadcrumbSymbol[] }>;
  };
}

declare module 'monaco-editor/esm/vs/editor/standalone/browser/standaloneServices' {
  export const StandaloneServices: {
    get: (service: unknown) => { documentSymbolProvider: unknown };
  };
}

declare module 'monaco-editor/esm/vs/editor/common/services/languageFeatures' {
  export const ILanguageFeaturesService: unknown;
}
