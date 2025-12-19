import { memo, useCallback, useEffect, useRef, useState } from 'react';

/**
 * Props for the ResizablePanel component.
 */
export interface ResizablePanelProps {
  /** Direction of resize: 'horizontal' (left/right) or 'vertical' (top/bottom) */
  direction: 'horizontal' | 'vertical';
  
  /** Current size in pixels */
  size: number;
  
  /** Minimum allowed size in pixels */
  minSize: number;
  
  /** Maximum allowed size in pixels */
  maxSize: number;
  
  /** Whether the panel is currently collapsed */
  collapsed: boolean;
  
  /** Callback when panel is resized */
  onResize: (newSize: number) => void;
  
  /** Callback when collapse/expand button is clicked */
  onToggleCollapse: () => void;
  
  /** Panel content */
  children: React.ReactNode;
  
  /** Optional CSS class name */
  className?: string;
}

/**
 * ResizablePanel component - Provides drag-to-resize functionality for layout panels.
 * 
 * Features:
 * - Drag handle for resizing (horizontal or vertical)
 * - Size constraints (min/max)
 * - Collapse/expand button
 * - Smooth 60fps drag updates using requestAnimationFrame
 * - Visual feedback on hover/drag
 * 
 * Performance optimizations (P5: Performance budgets):
 * - Uses React.memo to prevent unnecessary re-renders
 * - Batches resize updates with requestAnimationFrame
 * - Clamps size to min/max before emitting events
 * 
 * @example
 * ```tsx
 * <ResizablePanel
 *   direction="horizontal"
 *   size={300}
 *   minSize={200}
 *   maxSize={600}
 *   collapsed={false}
 *   onResize={handleResize}
 *   onToggleCollapse={handleToggle}
 * >
 *   <SidebarContent />
 * </ResizablePanel>
 * ```
 */
export const ResizablePanel = memo(function ResizablePanel({
  direction,
  size,
  minSize,
  maxSize,
  collapsed,
  onResize,
  onToggleCollapse,
  children,
  className = '',
}: ResizablePanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startPosRef = useRef<number>(0);
  const startSizeRef = useRef<number>(0);

  /**
   * Clamps a size value to min/max bounds.
   */
  const clampSize = useCallback((value: number) => {
    return Math.max(minSize, Math.min(maxSize, Math.round(value)));
  }, [minSize, maxSize]);

  /**
   * Handles mouse down on drag handle - starts drag operation.
   */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
    startSizeRef.current = size;
  }, [direction, size]);

  /**
   * Handles mouse move during drag - updates panel size.
   * Uses requestAnimationFrame for smooth 60fps updates.
   */
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Cancel any pending animation frame
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      // Schedule update on next animation frame
      rafRef.current = requestAnimationFrame(() => {
        const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
        const delta = currentPos - startPosRef.current;
        const newSize = clampSize(startSizeRef.current + delta);
        
        // Only emit if size actually changed (avoid unnecessary updates)
        if (newSize !== size) {
          onResize(newSize);
        }
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    // Attach global listeners for drag operation
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isDragging, direction, size, clampSize, onResize]);

  if (collapsed) {
    // When collapsed, render only the expand button
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-surface-secondary rounded transition-colors"
          aria-label="Expand panel"
        >
          <svg
            className="w-4 h-4 text-secondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {direction === 'horizontal' ? (
              // Chevron right for horizontal collapsed panels
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            ) : (
              // Chevron down for vertical collapsed panels
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            )}
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className={`relative flex ${direction === 'horizontal' ? 'flex-row' : 'flex-col'} ${className}`}>
      {/* Panel content - NO scrollbar on container, children handle their own overflow */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>

      {/* Drag handle - VS Code style with better visibility */}
      <div
        className={`
          group relative flex items-center justify-center z-10
          ${direction === 'horizontal' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
          ${isDragging ? 'bg-accent' : 'bg-border hover:bg-accent'}
          transition-colors duration-150
        `}
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation={direction}
        aria-valuenow={size}
        aria-valuemin={minSize}
        aria-valuemax={maxSize}
        style={{
          backgroundColor: isDragging ? 'var(--color-accent)' : undefined,
        }}
      >
        {/* Visual feedback area - wider hit target (5px for easier grabbing) */}
        <div
          className={`
            absolute
            ${direction === 'horizontal' ? 'inset-y-0 -left-2 w-5' : 'inset-x-0 -top-2 h-5'}
            ${isDragging ? 'bg-accent/20' : 'hover:bg-accent/10'}
            transition-colors duration-150
          `}
        />
        
        {/* Collapse button overlaid on drag handle */}
        <button
          onClick={onToggleCollapse}
          className="
            absolute z-10 p-1 rounded
            bg-surface-elevated border border-border
            hover:bg-surface-hover hover:border-accent
            opacity-0 group-hover:opacity-100
            transition-all duration-200
            shadow-md
          "
          aria-label="Collapse panel"
          style={{
            boxShadow: '0 2px 8px var(--color-shadow-sm)',
          }}
        >
          <svg
            className="w-3 h-3 text-secondary group-hover:text-primary transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {direction === 'horizontal' ? (
              // Chevron left for horizontal panels
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            ) : (
              // Chevron up for vertical panels
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            )}
          </svg>
        </button>
      </div>
    </div>
  );
});
