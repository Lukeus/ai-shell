import React, { useEffect, useState, useCallback } from 'react';
import { OutputChannelSelector } from './OutputChannelSelector';
import { OutputViewer } from './OutputViewer';
import type { OutputChannel, OutputLine, OutputAppendEvent, OutputClearEvent } from 'packages-api-contracts';

/**
 * OutputView - Main output panel container component.
 *
 * P1 (Process isolation): Subscribes to window.api.output IPC events; no Node/OS access.
 * P2 (Security Defaults): Properly cleans up event listeners on unmount.
 * P4 (UI design): Uses Tailwind 4 tokens for styling.
 *
 * @remarks
 * - Manages output channels and lines
 * - Subscribes to onAppend and onClear events via IPC
 * - Displays channel selector and output viewer
 * - Persists selected channel to localStorage per workspace
 */

export interface OutputViewProps {
  /** Optional CSS class name */
  className?: string;
}

const MOCK_CHANNEL: OutputChannel = {
  id: 'build',
  name: 'Build',
  lineCount: 6,
  createdAt: '2024-01-01T12:00:00.000Z',
};

const MOCK_LINES: OutputLine[] = [
  {
    lineNumber: 1,
    content: '> pnpm -r build',
    timestamp: '2024-01-01T12:00:00.000Z',
    severity: 'info',
  },
  {
    lineNumber: 2,
    content: 'apps/electron-shell build: vite build',
    timestamp: '2024-01-01T12:00:01.000Z',
    severity: 'info',
  },
  {
    lineNumber: 3,
    content: 'apps/electron-shell build: rendering chunks...',
    timestamp: '2024-01-01T12:00:02.000Z',
    severity: 'info',
  },
  {
    lineNumber: 4,
    content: 'apps/electron-shell build: done in 2.4s',
    timestamp: '2024-01-01T12:00:03.000Z',
    severity: 'info',
  },
  {
    lineNumber: 5,
    content: 'apps/electron-shell build: warnings 0, errors 0',
    timestamp: '2024-01-01T12:00:04.000Z',
    severity: 'info',
  },
  {
    lineNumber: 6,
    content: 'Build finished successfully.',
    timestamp: '2024-01-01T12:00:05.000Z',
    severity: 'info',
  },
];

export function OutputView({ className = '' }: OutputViewProps) {
  const [channels, setChannels] = useState<OutputChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);

  // Load channels on mount
  useEffect(() => {
    const loadChannels = async () => {
      try {
        setIsLoading(true);
        const response = await window.api.output.listChannels();
        if (response.channels.length === 0) {
          setChannels([MOCK_CHANNEL]);
          setSelectedChannelId(MOCK_CHANNEL.id);
          setLines(MOCK_LINES);
          setUsingMockData(true);
          return;
        }

        setChannels(response.channels);
        setUsingMockData(false);

        // Auto-select first channel if available
        if (response.channels.length > 0 && !selectedChannelId) {
          setSelectedChannelId(response.channels[0].id);
        }
      } catch (err) {
        console.error('Failed to load output channels:', err);
        setError('Failed to load output channels');
      } finally {
        setIsLoading(false);
      }
    };

    loadChannels();
  }, [selectedChannelId]);

  // Load lines when selected channel changes
  useEffect(() => {
    if (usingMockData) {
      return;
    }

    if (!selectedChannelId) {
      setLines([]);
      return;
    }

    const loadLines = async () => {
      try {
        const response = await window.api.output.read({
          channelId: selectedChannelId,
          startLine: 1,
          maxLines: 10000, // Load up to 10K lines
        });
        setLines(response.lines);
      } catch (err) {
        console.error('Failed to load output lines:', err);
        setError('Failed to load output lines');
      }
    };

    loadLines();
  }, [selectedChannelId, usingMockData]);

  // Subscribe to output append events
  useEffect(() => {
    const handleAppend = (event: OutputAppendEvent) => {
      // Only update if the event is for the currently selected channel
      if (event.channelId === selectedChannelId) {
        setLines(prev => [...prev, ...event.lines]);
      }
      
      // Update channel line count
      setChannels(prev =>
        prev.map(ch =>
          ch.id === event.channelId
            ? { ...ch, lineCount: ch.lineCount + event.lines.length }
            : ch
        )
      );
    };

    const unsubscribe = window.api.output.onAppend(handleAppend);

    return () => {
      // P2: Clean up event listener on unmount
      unsubscribe();
    };
  }, [selectedChannelId]);

  // Subscribe to output clear events
  useEffect(() => {
    const handleClear = (event: OutputClearEvent) => {
      // Clear lines if the event is for the currently selected channel
      if (event.channelId === selectedChannelId) {
        setLines([]);
      }
      
      // Update channel line count
      setChannels(prev =>
        prev.map(ch =>
          ch.id === event.channelId
            ? { ...ch, lineCount: 0 }
            : ch
        )
      );
    };

    const unsubscribe = window.api.output.onClear(handleClear);

    return () => {
      // P2: Clean up event listener on unmount
      unsubscribe();
    };
  }, [selectedChannelId]);

  // Handle channel selection
  const handleChannelChange = useCallback((channelId: string) => {
    setSelectedChannelId(channelId);
  }, []);

  // Handle clear channel
  const handleClearChannel = useCallback(async () => {
    if (!selectedChannelId) return;

    try {
      await window.api.output.clear({ channelId: selectedChannelId });
      setLines([]);
    } catch (err) {
      console.error('Failed to clear output channel:', err);
      setError('Failed to clear output channel');
    }
  }, [selectedChannelId]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full bg-surface text-secondary ${className}`}>
        <p className="text-sm">Loading output...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full bg-surface text-error ${className}`}>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-surface ${className}`}>
      {/* Header with channel selector and actions */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface-elevated">
        <span className="text-sm text-secondary font-medium">Channel:</span>
        
        <OutputChannelSelector
          channels={channels}
          selectedChannelId={selectedChannelId}
          onChange={handleChannelChange}
          className="flex-1 max-w-xs"
        />
        
        {/* Clear button */}
        {selectedChannelId && lines.length > 0 && (
          <button
            onClick={handleClearChannel}
            className="px-3 py-2 text-sm text-secondary hover:text-primary border border-border rounded hover:border-primary transition-colors"
            title="Clear output"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Output viewer */}
      <div className="flex-1 overflow-hidden">
        {selectedChannelId ? (
          <OutputViewer lines={lines} height="100%" />
        ) : (
          <div className="flex items-center justify-center h-full text-secondary">
            <p className="text-sm">
              {channels.length === 0
                ? 'No output channels available'
                : 'Select a channel to view output'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
