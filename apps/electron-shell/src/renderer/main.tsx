// IMPORTANT: Import Monaco worker configuration FIRST, before any other imports
// This sets up MonacoEnvironment.getWorker() before Monaco is loaded
import './monaco/monacoWorkers';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import 'monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css';
import './styles/themes.css';
import './styles/globals.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
