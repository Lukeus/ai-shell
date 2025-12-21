// IMPORTANT: Import Monaco worker configuration FIRST, before any other imports
// This sets up MonacoEnvironment.getWorker() before Monaco is loaded
import './monaco/monacoWorkers';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/codicon.css';
import './styles/globals.css';
import './styles/themes.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
