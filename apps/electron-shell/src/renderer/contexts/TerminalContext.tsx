import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import type {
  TerminalSession,
  CreateTerminalRequest,
  TerminalDataEvent,
  TerminalExitEvent,
} from 'packages-api-contracts';
import { useFileTree } from '../components/explorer/FileTreeContext';

/**
 * TerminalContext - React context for terminal session state management.
 *
 * P1 (Process isolation): Uses window.api.terminal.* for ALL IPC calls (no Node.js access).
 * P2 (Security Defaults): Event listeners properly cleaned up via removeListener on unmount.
 * P3 (Secrets): Terminal I/O never logged (handled by main process).
 *
 * @remarks
 * - Manages terminal sessions, active session, terminal output
 * - Persists session metadata to localStorage per workspace
 * - Subscribes to terminal data/exit events via window.api.terminal
 * - Implements proper event cleanup on unmount
 */

/**
 * Terminal output line (accumulated from data events).
 */
export interface TerminalOutput {
  /** Session ID */
  sessionId: string;
  /** Accumulated output data */
  data: string;
}

/**
 * Terminal context value interface.
 */
export interface TerminalContextValue {
  // Session state
  sessions: TerminalSession[];
  activeSessionId: string | null;
  isLoading: boolean;
  error: string | null;

  // Terminal output (accumulated in renderer)
  outputs: Map<string, string>;

  // Session operations
  createSession: (request: Omit<CreateTerminalRequest, 'cols' | 'rows'>) => Promise<TerminalSession>;
  closeSession: (sessionId: string) => Promise<void>;
  setActiveSession: (sessionId: string) => void;
  writeToSession: (sessionId: string, data: string) => Promise<void>;
  resizeSession: (sessionId: string, cols: number, rows: number) => Promise<void>;
  clearOutput: (sessionId: string) => void;
  
  // Lifecycle
  loadSessions: () => Promise<void>;
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

/**
 * Hook to access TerminalContext.
 *
 * @throws Error if used outside TerminalContextProvider
 */
export function useTerminal(): TerminalContextValue {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal must be used within TerminalContextProvider');
  }
  return context;
}

/**
 * Generate stable hash for workspace path (for localStorage keys).
 * Same algorithm as FileTreeContext for consistency.
 */
function hashWorkspacePath(path: string): string {
  let hash = 0;
  for (let i = 0; i < path.length; i++) {
    const char = path.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Persisted terminal metadata (localStorage).
 */
interface PersistedTerminalState {
  activeSessionId: string | null;
  sessionMetadata: Array<{
    sessionId: string;
    title: string;
  }>;
}

/**
 * TerminalContextProvider - Provider component for terminal state.
 */
export function TerminalContextProvider({ children }: { children: React.ReactNode }) {
  const { workspace } = useFileTree();
  
  // Session state
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Terminal output accumulated in renderer
  const [outputs, setOutputs] = useState<Map<string, string>>(new Map());
  
  // Refs for event cleanup (P2: Security Defaults)
  const dataUnsubscribeRef = useRef<(() => void) | null>(null);
  const exitUnsubscribeRef = useRef<(() => void) | null>(null);
  
  // Generate localStorage key for current workspace
  const storageKey = useMemo(() => {
    if (!workspace) return 'terminal:state:global';
    return `terminal:state:${hashWorkspacePath(workspace.path)}`;
  }, [workspace]);
  
  /**
   * Load persisted state from localStorage for current workspace.
   */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const { activeSessionId: persistedActiveId }: PersistedTerminalState = JSON.parse(stored);
        // Only restore active session ID if it still exists
        if (persistedActiveId && sessions.some(s => s.sessionId === persistedActiveId)) {
          setActiveSessionId(persistedActiveId);
        }
      }
    } catch (err) {
      console.warn('Failed to load persisted terminal state:', err);
    }
  }, [storageKey, sessions]);
  
  /**
   * Persist state to localStorage whenever it changes.
   */
  useEffect(() => {
    try {
      const data: PersistedTerminalState = {
        activeSessionId,
        sessionMetadata: sessions.map(s => ({
          sessionId: s.sessionId,
          title: s.title,
        })),
      };
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (err) {
      console.warn('Failed to persist terminal state:', err);
    }
  }, [storageKey, activeSessionId, sessions]);
  
  /**
   * Handle terminal data events.
   */
  const handleTerminalData = useCallback((event: TerminalDataEvent) => {
    const { sessionId, data } = event;
    
    // Accumulate output in renderer (P3: never logged in main process)
    setOutputs(prev => {
      const next = new Map(prev);
      const existing = next.get(sessionId) || '';
      next.set(sessionId, existing + data);
      return next;
    });
  }, []);
  
  /**
   * Handle terminal exit events.
   */
  const handleTerminalExit = useCallback((event: TerminalExitEvent) => {
    const { sessionId, exitCode } = event;
    
    // Update session status
    setSessions(prev =>
      prev.map(session =>
        session.sessionId === sessionId
          ? { ...session, status: 'exited' as const, exitCode }
          : session
      )
    );
  }, []);
  
  /**
   * Subscribe to terminal events (P1: IPC via window.api).
   * P2 (Security Defaults): Cleanup listeners on unmount.
   */
  useEffect(() => {
    // Subscribe to data events
    const unsubscribeData = window.api.terminal.onData(handleTerminalData);
    dataUnsubscribeRef.current = unsubscribeData;
    
    // Subscribe to exit events
    const unsubscribeExit = window.api.terminal.onExit(handleTerminalExit);
    exitUnsubscribeRef.current = unsubscribeExit;
    
    // P2: Cleanup on unmount
    return () => {
      if (dataUnsubscribeRef.current) {
        dataUnsubscribeRef.current();
        dataUnsubscribeRef.current = null;
      }
      if (exitUnsubscribeRef.current) {
        exitUnsubscribeRef.current();
        exitUnsubscribeRef.current = null;
      }
    };
  }, [handleTerminalData, handleTerminalExit]);
  
  /**
   * Load active sessions from main process.
   */
  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // P1: Use window.api.* for IPC call
      const response = await window.api.terminal.list();
      setSessions(response.sessions);
      
      // If we have sessions but no active one, activate the first
      setActiveSessionId(prev => {
        if (!prev && response.sessions.length > 0) {
          return response.sessions[0].sessionId;
        }
        return prev;
      });
    } catch (err) {
      const message = typeof err === 'object' && err !== null && 'message' in err
        ? (err as Error).message
        : 'Failed to load terminal sessions';
      setError(message);
      console.error('Failed to load terminal sessions:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  /**
   * Create a new terminal session.
   */
  const createSession = useCallback(
    async (request: Omit<CreateTerminalRequest, 'cols' | 'rows'>): Promise<TerminalSession> => {
      setIsLoading(true);
      setError(null);
      try {
        // P1: Use window.api.* for IPC call
        // Default terminal size (will be updated by xterm.js in Task 9)
        const response = await window.api.terminal.create({
          ...request,
          cols: 80,
          rows: 24,
        });
        
        const newSession = response.session;
        setSessions(prev => [...prev, newSession]);
        setActiveSessionId(newSession.sessionId);
        
        // Initialize empty output for this session
        setOutputs(prev => {
          const next = new Map(prev);
          next.set(newSession.sessionId, '');
          return next;
        });
        
        return newSession;
      } catch (err) {
        const message = typeof err === 'object' && err !== null && 'message' in err
          ? (err as Error).message
          : 'Failed to create terminal session';
        setError(message);
        console.error('Failed to create terminal session:', err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );
  
  /**
   * Close a terminal session.
   */
  const closeSession = useCallback(async (sessionId: string) => {
    try {
      // P1: Use window.api.* for IPC call
      await window.api.terminal.close({ sessionId });
      
      // Remove from sessions and update active session in one update
      setSessions(prev => {
        const remaining = prev.filter(s => s.sessionId !== sessionId);
        
        // If closing active session, switch to another or null
        if (activeSessionId === sessionId) {
          setActiveSessionId(remaining.length > 0 ? remaining[0].sessionId : null);
        }
        
        return remaining;
      });
      
      // Clear output
      setOutputs(prev => {
        const next = new Map(prev);
        next.delete(sessionId);
        return next;
      });
    } catch (err) {
      const message = typeof err === 'object' && err !== null && 'message' in err
        ? (err as Error).message
        : 'Failed to close terminal session';
      setError(message);
      console.error('Failed to close terminal session:', err);
      throw err;
    }
  }, [activeSessionId]);
  
  /**
   * Set active terminal session.
   */
  const setActiveSession = useCallback((sessionId: string) => {
    // Validate session exists
    if (sessions.some(s => s.sessionId === sessionId)) {
      setActiveSessionId(sessionId);
    }
  }, [sessions]);
  
  /**
   * Write data to terminal session.
   */
  const writeToSession = useCallback(async (sessionId: string, data: string) => {
    try {
      // P1: Use window.api.* for IPC call
      await window.api.terminal.write({ sessionId, data });
    } catch (err) {
      const message = typeof err === 'object' && err !== null && 'message' in err
        ? (err as Error).message
        : 'Failed to write to terminal';
      setError(message);
      console.error('Failed to write to terminal:', err);
      throw err;
    }
  }, []);
  
  /**
   * Resize terminal session.
   */
  const resizeSession = useCallback(async (sessionId: string, cols: number, rows: number) => {
    try {
      // P1: Use window.api.* for IPC call
      await window.api.terminal.resize({ sessionId, cols, rows });
    } catch (err) {
      const message = typeof err === 'object' && err !== null && 'message' in err
        ? (err as Error).message
        : 'Failed to resize terminal';
      setError(message);
      console.error('Failed to resize terminal:', err);
      throw err;
    }
  }, []);
  
  /**
   * Clear output for a session (renderer-side only).
   */
  const clearOutput = useCallback((sessionId: string) => {
    setOutputs(prev => {
      const next = new Map(prev);
      next.set(sessionId, '');
      return next;
    });
  }, []);
  
  /**
   * Load sessions on mount.
   */
  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount
  
  const value: TerminalContextValue = {
    sessions,
    activeSessionId,
    isLoading,
    error,
    outputs,
    createSession,
    closeSession,
    setActiveSession,
    writeToSession,
    resizeSession,
    clearOutput,
    loadSessions,
  };
  
  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
}
