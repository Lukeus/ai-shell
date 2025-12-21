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

  /** Default size used when double-clicking the splitter to reset */
  defaultSize?: number;
  
  /** Whether the panel is currently collapsed */
  collapsed: boolean;

  /** Which edge owns the resize handle (start = left/top, end = right/bottom) */
  handlePosition?: 'start' | 'end';
  
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
  defaultSize,
  collapsed,
  handlePosition = 'end',
  onResize,
  onToggleCollapse,
  children,
  className = '',
}: ResizablePanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startPosRef = useRef<number>(0);
  const startSizeRef = useRef<number>(0);
  const resetSize = defaultSize ?? Math.max(minSize, Math.min(maxSize, 250));
  const isStartHandle = handlePosition === 'start';

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
        const delta = isStartHandle
          ? startPosRef.current - currentPos
          : currentPos - startPosRef.current;
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
  }, [isDragging, direction, size, clampSize, onResize, isStartHandle]);

  const handleDoubleClick = useCallback(() => {
    const clamped = clampSize(resetSize);
    onResize(clamped);
    if (collapsed) {
      onToggleCollapse();
    }
  }, [clampSize, resetSize, onResize, collapsed, onToggleCollapse]);

  const lineThickness = isDragging ? 2 : 1;

  const handle = (
    <div
      className={`
        group relative flex items-center justify-center select-none shrink-0 z-40
        ${direction === 'horizontal' ? 'cursor-col-resize' : 'cursor-row-resize'}
        ${isDragging ? 'bg-accent/15' : 'hover:bg-surface-hover'}
      `}
      style={{
        cursor: direction === 'horizontal' ? 'col-resize' : 'row-resize',
        touchAction: 'none',
        pointerEvents: 'auto',
        width: direction === 'horizontal' ? '6px' : '100%',
        height: direction === 'horizontal' ? '100%' : '6px',
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      role="separator"
      aria-orientation={direction}
      aria-valuenow={size}
      aria-valuemin={minSize}
      aria-valuemax={maxSize}
    >
      {/* Divider line */}
      <div
        className={`
          absolute
          ${direction === 'horizontal'
            ? `${isStartHandle ? 'right-0' : 'left-0'} top-0 bottom-0`
            : `${isStartHandle ? 'bottom-0' : 'top-0'} left-0 right-0`}
        `}
        style={{
          width: direction === 'horizontal' ? `${lineThickness}px` : '100%',
          height: direction === 'horizontal' ? '100%' : `${lineThickness}px`,
          backgroundColor: isDragging ? 'var(--color-accent)' : 'transparent',
        }}
      />
      {/* Collapse button overlaid on drag handle */}
      <button
        onClick={onToggleCollapse}
        className="
          absolute z-10 p-1 rounded-none
          bg-surface-elevated border border-border
          hover:bg-surface-hover hover:border-accent
          opacity-0 group-hover:opacity-100
          transition-colors duration-150
          left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
        "
        aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
        style={{
          boxShadow: 'var(--vscode-shadow-none)',
        }}
      >
        <svg
          className="w-3 h-3 text-secondary group-hover:text-primary transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {direction === 'horizontal' ? (
            // Chevron indicates collapse/expand for horizontal panels
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={collapsed ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
          ) : (
            // Chevron for vertical panels
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={collapsed ? 'M19 9l-7 7-7-7' : 'M5 15l7-7 7 7'} />
          )}
        </svg>
      </button>
    </div>
  );

  return (
    <div className={`relative flex h-full w-full min-w-0 min-h-0 ${direction === 'horizontal' ? 'flex-row' : 'flex-col'} ${className}`}>
      {isStartHandle ? handle : null}
      {/* Panel content - hidden when collapsed, children handle their own overflow */}
      <div className={`flex-1 overflow-hidden ${collapsed ? 'hidden' : 'block'}`}>
        {children}
      </div>

      {!isStartHandle ? handle : null}
    </div>
  );
});
