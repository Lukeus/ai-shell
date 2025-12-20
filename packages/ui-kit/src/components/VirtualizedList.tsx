import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

/**
 * Props for the VirtualizedList component.
 */
export interface VirtualizedListProps<T> {
  /** Array of items to render */
  items: T[];
  
  /** Function to render each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  
  /** Estimated height of each item in pixels (improves scroll performance) */
  estimateSize?: number;
  
  /** Optional function to get a unique key for each item */
  getItemKey?: (item: T, index: number) => string | number;
  
  /** Optional CSS class name for the container */
  className?: string;
  
  /** Optional CSS class name for the scrollable area */
  scrollClassName?: string;
  
  /** Optional height for the list container (defaults to 100%) */
  height?: string | number;
  
  /** Optional callback when scrolling near the end (for infinite scroll) */
  onEndReached?: () => void;
  
  /** Distance from the end to trigger onEndReached (in pixels) */
  endReachedThreshold?: number;
}

/**
 * VirtualizedList component - Efficiently render large lists with virtualization.
 * 
 * Features:
 * - Renders only visible items for optimal performance
 * - Handles 10K+ items efficiently using @tanstack/react-virtual
 * - Supports custom item height estimation
 * - Supports infinite scroll with onEndReached callback
 * - Maintains scroll position when items change
 * 
 * Uses Tailwind 4 tokens for styling (P4: UI design system).
 * Pure React component with no Electron/Node.js dependencies (P1: Process isolation).
 * 
 * @example
 * ```tsx
 * <VirtualizedList
 *   items={diagnostics}
 *   renderItem={(diagnostic) => (
 *     <DiagnosticRow diagnostic={diagnostic} />
 *   )}
 *   estimateSize={40}
 *   height="400px"
 * />
 * ```
 */
export function VirtualizedList<T>({
  items,
  renderItem,
  estimateSize = 32,
  getItemKey,
  className = '',
  scrollClassName = '',
  height = '100%',
  onEndReached,
  endReachedThreshold = 100,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Initialize virtualizer
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 5, // Render 5 extra items above/below viewport for smooth scrolling
  });
  
  // Handle scroll for infinite loading
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!onEndReached) return;
    
    const target = e.currentTarget;
    const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    
    if (scrollBottom < endReachedThreshold) {
      onEndReached();
    }
  };
  
  const virtualItems = virtualizer.getVirtualItems();
  
  return (
    <div
      ref={parentRef}
      onScroll={handleScroll}
      className={`overflow-auto ${scrollClassName}`}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          const key = getItemKey
            ? getItemKey(item, virtualItem.index)
            : virtualItem.index;
          
          return (
            <div
              key={key}
              data-index={virtualItem.index}
              className={className}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
