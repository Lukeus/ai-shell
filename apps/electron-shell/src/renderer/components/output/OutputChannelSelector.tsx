import React from 'react';
import type { OutputChannel } from 'packages-api-contracts';

/**
 * OutputChannelSelector - Dropdown selector for output channels.
 *
 * P1 (Process isolation): Pure React component, no Node/OS access.
 * P4 (UI design): Uses Tailwind 4 tokens for styling.
 *
 * @remarks
 * - Displays list of available output channels
 * - Shows channel name and line count
 * - Calls onChange when user selects a channel
 */

export interface OutputChannelSelectorProps {
  /** Available output channels */
  channels: OutputChannel[];
  
  /** Currently selected channel ID */
  selectedChannelId: string | null;
  
  /** Callback when channel is selected */
  onChange: (channelId: string) => void;
  
  /** Optional CSS class name */
  className?: string;
}

export function OutputChannelSelector({
  channels,
  selectedChannelId,
  onChange,
  className = '',
}: OutputChannelSelectorProps) {

  return (
    <div className={`relative ${className}`}>
      <select
        value={selectedChannelId || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-6 px-2 bg-surface border border-border text-primary text-[12px] rounded-sm focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
        disabled={channels.length === 0}
      >
        {channels.length === 0 && (
          <option value="">No channels available</option>
        )}
        {channels.map((channel) => (
          <option key={channel.id} value={channel.id}>
            {channel.name} ({channel.lineCount} lines)
          </option>
        ))}
      </select>
      
      {/* Dropdown arrow icon */}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-secondary">
        <span className="codicon codicon-chevron-down text-[12px]" aria-hidden="true" />
      </div>
    </div>
  );
}
