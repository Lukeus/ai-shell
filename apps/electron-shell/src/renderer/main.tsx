import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConnectionsProvider } from './contexts/ConnectionsContext';
import { installGlobalErrorHandlers } from './diagnostics/installGlobalErrorHandlers';
import './styles/codicon.css';
import './styles/globals.css';
import './styles/themes.css';

installGlobalErrorHandlers();

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConnectionsProvider>
        <App />
      </ConnectionsProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
