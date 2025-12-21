// IMPORTANT: Import Monaco worker configuration FIRST, before any other imports
// This sets up MonacoEnvironment.getWorker() before Monaco is loaded
import './monaco/monacoWorkers';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/codicon.css';
import './styles/globals.css';
import './styles/themes.css';

window.addEventListener(
  'unhandledrejection',
  (event) => {
    const reason = event.reason as { name?: string; message?: string; stack?: string } | null;
    if (!reason || typeof reason !== 'object') {
      return;
    }

    const isCanceled = reason.name === 'Canceled' || reason.message?.includes('Canceled');
    const fromMonaco = typeof reason.stack === 'string' && reason.stack.includes('monaco-editor');
    if (isCanceled && fromMonaco) {
      event.preventDefault();
    }
  },
  { capture: true }
);

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
