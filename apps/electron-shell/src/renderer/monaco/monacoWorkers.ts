/**
 * Monaco Editor Web Worker Configuration
 * 
 * This file configures Monaco Editor to use web workers via Vite's native ?worker import.
 * It MUST be imported before any Monaco Editor code is loaded.
 * 
 * Vite automatically handles bundling these workers correctly when using the ?worker suffix.
 * This is the standard approach for using Monaco with Vite.
 * 
 * @see https://vitejs.dev/guide/features.html#web-workers
 * @see https://github.com/vitejs/vite/discussions/1791
 */

import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

/**
 * Configure Monaco's worker resolution.
 * Monaco looks for this on the global "self" object.
 */
// eslint-disable-next-line no-undef
(self as any).MonacoEnvironment = {
  // eslint-disable-next-line no-undef
  getWorker(_workerId: unknown, label: string): Worker {
    switch (label) {
      case 'json':
        return new JsonWorker();
      case 'css':
      case 'scss':
      case 'less':
        return new CssWorker();
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker();
      case 'typescript':
      case 'javascript':
        return new TsWorker();
      default:
        return new EditorWorker();
    }
  },
};
