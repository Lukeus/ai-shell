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

export function Terminal({ sessionId }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [terminal, setTerminal] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [xterm, setXterm] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [fitAddon, setFitAddon] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
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
    const term = new xterm.Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Cascadia Code", "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#cccccc',
        selection: '#264f78',
      },
      scrollback: 10000,
      allowTransparency: false,
    });

    // Create fit addon
    const fit = new fitAddon();
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

    // Handle user input - send to main process via IPC
    const disposable = term.onData((data: string) => {
      // P1: Use IPC to send data to main process (no direct PTY access)
      writeToSession(sessionId, data).catch(err => {
        console.error('Failed to write to terminal:', err);
      });
    });

    return () => {
      disposable.dispose();
      term.dispose();
    };
  }, [xterm, fitAddon, sessionId, writeToSession, resizeSession]);
  
  // Write output from context to terminal
  useEffect(() => {
    if (!terminal) return;
    
    const output = outputs.get(sessionId);
    if (output) {
      // Write accumulated output to terminal
      terminal.write(output);
      // Note: We don't clear the output here as it's managed by TerminalContext
    }
  }, [terminal, outputs, sessionId]);
  
  // Handle resize events
  useEffect(() => {
    if (!terminal || !fitAddon) return;

    const fit = new fitAddon();
    terminal.loadAddon(fit);

    const handleResize = () => {
      try {
        fit.fit();
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm">Loading Terminal...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={terminalRef}
      className="h-full w-full"
      style={{ backgroundColor: '#1e1e1e' }}
    />
  );
}
