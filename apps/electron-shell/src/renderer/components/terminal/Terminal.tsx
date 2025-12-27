import React, { useEffect, useRef, useState } from 'react';
import { useTerminal } from '../../contexts/TerminalContext';

/**
 * Terminal - Terminal emulator component with xterm.js.
 *
 * P1 (Process isolation): Runs in sandboxed renderer, communicates via window.api.terminal (IPC).
 * P5 (Performance budgets): xterm.js loaded via dynamic import (not in initial bundle).
 * P4 (UI design): Uses Tailwind 4 tokens for styling.
 *
 * @remarks
 * - xterm.js instance is properly disposed on unmount to prevent memory leaks
 * - Handles resize events to maintain correct terminal layout
 * - Connects to TerminalContext for session management
 * - Terminal I/O never logged (P3: Secrets)
 */

export interface TerminalProps {
  /** Terminal session ID to display */
  sessionId: string;
}

const getThemeValue = (
  styles: CSSStyleDeclaration,
  name: string,
  fallback: string
): string => {
  const value = styles.getPropertyValue(name).trim();
  return value || fallback;
};

const buildTerminalTheme = () => {
  const styles = getComputedStyle(document.documentElement);
  const foreground = getThemeValue(styles, '--vscode-foreground', '#cccccc');

  return {
    background: getThemeValue(styles, '--vscode-editor-background', '#1e1e1e'),
    foreground,
    cursor: foreground,
    selection: getThemeValue(styles, '--vscode-selection-background', '#264f78'),
  };
};

export function Terminal({ sessionId }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [terminal, setTerminal] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [xterm, setXterm] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [fitAddon, setFitAddon] = useState<any>(null);
  const fitAddonRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const lastOutputLengthRef = useRef(0);
  
  const { outputs, writeToSession, resizeSession } = useTerminal();
  
  // P5 (Performance budgets): Dynamic import of xterm.js
  useEffect(() => {
    let isMounted = true;

    const initXterm = async () => {
      try {
        // Dynamic import to keep xterm.js out of initial bundle
        const [xtermModule, fitModule] = await Promise.all([
          import('xterm'),
          import('xterm-addon-fit'),
        ]);
        
        if (!isMounted) return;
        
        setXterm(xtermModule);
        setFitAddon(() => fitModule.FitAddon);
      } catch (err) {
        console.error('Failed to load xterm.js:', err);
        if (isMounted) {
          setError('Failed to load terminal. Please refresh the page.');
        }
      }
    };

    initXterm();

    return () => {
      isMounted = false;
    };
  }, []);
  
  // Initialize terminal instance when xterm.js is loaded
  useEffect(() => {
    if (!xterm || !fitAddon || !terminalRef.current) return;

    // Create terminal instance
    let term: any;
    let disposable: { dispose: () => void } | null = null;
    try {
      console.log(`[DEBUG_LOG] Creating terminal instance for session ${sessionId}`);
      term = new xterm.Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: '"Cascadia Code", "Courier New", monospace',
        theme: buildTerminalTheme(),
        scrollback: 10000,
        allowTransparency: false,
      });

      // Create fit addon
      const fit = new fitAddon();
      fitAddonRef.current = fit;
      term.loadAddon(fit);

      // Open terminal in DOM
      term.open(terminalRef.current);
      
      // Fit terminal to container
      try {
        fit.fit();
        
        // Send initial size to backend
        resizeSession(sessionId, term.cols, term.rows).catch(err => {
          console.error('Failed to send initial terminal size:', err);
        });
      } catch (err) {
        console.error('Failed to fit terminal:', err);
      }

      setTerminal(term);
      lastOutputLengthRef.current = 0;

      // Handle user input - send to main process via IPC
      disposable = term.onData((data: string) => {
        // P1: Use IPC to send data to main process (no direct PTY access)
        writeToSession(sessionId, data).catch(err => {
          console.error('Failed to write to terminal:', err);
        });
      });
    } catch (err) {
      console.error('Failed to initialize terminal:', err);
      setError('Failed to load terminal. Please refresh the page.');
      return;
    }

    return () => {
      console.log(`[DEBUG_LOG] Disposing terminal instance for session ${sessionId}`);
      disposable?.dispose();
      term?.dispose();
    };
  }, [xterm, fitAddon, sessionId, writeToSession, resizeSession]);

  useEffect(() => {
    if (!terminal) return;

    const applyTheme = () => {
      terminal.options.theme = buildTerminalTheme();
    };

    applyTheme();

    const observer = new MutationObserver(() => applyTheme());
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMediaChange = () => applyTheme();

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
  }, [terminal]);

  useEffect(() => {
    lastOutputLengthRef.current = 0;
  }, [sessionId]);
  
  // Write output from context to terminal
  useEffect(() => {
    if (!terminal) return;
    
    const output = outputs.get(sessionId);
    if (typeof output !== 'string') {
      console.log(`[DEBUG_LOG] No output for session ${sessionId}`);
      return;
    }

    if (output.length === 0) {
      if (lastOutputLengthRef.current > 0 && typeof terminal.clear === 'function') {
        console.log(`[DEBUG_LOG] Clearing terminal for session ${sessionId} because output is empty`);
        terminal.clear();
      }
      lastOutputLengthRef.current = 0;
      return;
    }

    if (output.length < lastOutputLengthRef.current) {
      console.log(`[DEBUG_LOG] Resetting lastOutputLengthRef for session ${sessionId} (output.length: ${output.length}, last: ${lastOutputLengthRef.current})`);
      lastOutputLengthRef.current = 0;
    }

    const delta = output.slice(lastOutputLengthRef.current);
    if (delta) {
      console.log(`[DEBUG_LOG] Writing ${delta.length} chars to terminal for session ${sessionId}`);
      terminal.write(delta);
      lastOutputLengthRef.current = output.length;
    }
  }, [terminal, outputs, sessionId]);
  
  // Handle resize events
  useEffect(() => {
    if (!terminal || !fitAddonRef.current) return;

    const handleResize = () => {
      try {
        fitAddonRef.current.fit();
        // Send new size to backend
        resizeSession(sessionId, terminal.cols, terminal.rows).catch(err => {
          console.error('Failed to resize terminal:', err);
        });
      } catch (err) {
        console.error('Failed to fit terminal on resize:', err);
      }
    };

    window.addEventListener('resize', handleResize);

    // Trigger initial fit
    setTimeout(() => {
      handleResize();
    }, 0);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [terminal, fitAddon, sessionId, resizeSession]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-surface text-error">
        <div className="text-center p-4">
          <p className="mb-4">{error}</p>
        </div>
      </div>
    );
  }

  if (!xterm || !fitAddon) {
    return (
      <div className="flex items-center justify-center h-full bg-surface text-secondary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-4" />
          <p className="text-sm">Loading Terminal...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={terminalRef}
      className="h-full w-full"
      style={{ backgroundColor: 'var(--vscode-editor-background)' }}
    />
  );
}
