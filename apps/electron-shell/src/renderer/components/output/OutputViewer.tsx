import React, { useEffect, useRef, useState } from 'react';
import { VirtualizedList } from 'packages-ui-kit';
import type { OutputLine } from 'packages-api-contracts';

/**
 * OutputViewer - Virtualized output display component.
 *
 * P1 (Process isolation): Pure React component, no Node/OS access.
 * P4 (UI design): Uses Tailwind 4 tokens for styling.
 * P5 (Performance budgets): Uses VirtualizedList to efficiently handle 10K+ lines.
 *
 * @remarks
 * - Displays output lines with virtualization for performance
 * - Auto-scrolls to bottom when new lines are appended (unless user has scrolled up)
 * - Detects manual scroll to disable auto-scroll
 * - Shows severity-based coloring (info, warning, error)
 * - Displays line numbers and timestamps
 */

export interface OutputViewerProps {
  /** Output lines to display */
  lines: OutputLine[];
  
  /** Optional CSS class name */
  className?: string;
  
  /** Height of the viewer (defaults to 100%) */
  height?: string | number;
}

export function OutputViewer({
  lines,
  className = '',
  height = '100%',
}: OutputViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const prevLineCountRef = useRef(lines.length);
  
  // Handle scroll event to detect manual scrolling
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    
    // If user scrolls up more than 50px from bottom, disable auto-scroll
    if (scrollBottom > 50) {
      setAutoScroll(false);
    } else {
      // If user scrolls back to bottom, re-enable auto-scroll
      setAutoScroll(true);
    }
  };
  
  // Auto-scroll to bottom when new lines are added (only if auto-scroll is enabled)
  useEffect(() => {
    if (!autoScroll) return;
    if (lines.length === prevLineCountRef.current) return;
    
    prevLineCountRef.current = lines.length;
    
    // Scroll to bottom on next frame
    requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    });
  }, [lines.length, autoScroll]);
  
  // Render a single output line
  const renderLine = (line: OutputLine, index: number) => {
    // Determine text color based on severity
    let severityClass = 'text-primary';
    if (line.severity === 'error') {
      severityClass = 'text-error';
    } else if (line.severity === 'warning') {
      severityClass = 'text-warning';
    }
    
    return (
      <div
        className={`flex items-start gap-3 px-4 py-1 font-mono text-sm hover:bg-surface-hover ${severityClass}`}
      >
        {/* Line number */}
        <span className="text-secondary text-xs w-12 flex-shrink-0 text-right">
          {line.lineNumber}
        </span>
        
        {/* Timestamp */}
        <span className="text-secondary text-xs w-20 flex-shrink-0">
          {new Date(line.timestamp).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
        
        {/* Content */}
        <span className="flex-1 whitespace-pre-wrap break-words">
          {line.content}
        </span>
      </div>
    );
  };
  
  if (lines.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full bg-surface text-secondary ${className}`}>
        <p className="text-sm">No output</p>
      </div>
    );
  }
  
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <VirtualizedList
        items={lines}
        renderItem={renderLine}
        estimateSize={32}
        getItemKey={(line: OutputLine) => `${line.lineNumber}`}
        height={height}
        scrollClassName="bg-surface"
      />
      
      {/* Auto-scroll indicator */}
      {!autoScroll && (
        <div className="absolute bottom-4 right-4">
          <button
            onClick={() => {
              setAutoScroll(true);
              if (containerRef.current) {
                containerRef.current.scrollTop = containerRef.current.scrollHeight;
              }
            }}
            className="px-3 py-2 bg-primary text-white text-sm rounded shadow-lg hover:bg-primary-hover transition-colors"
            title="Scroll to bottom"
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
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
