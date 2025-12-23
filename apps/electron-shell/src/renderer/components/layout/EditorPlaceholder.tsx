/**
 * EditorPlaceholder component - Placeholder for the main editor area.
 * 
 * Displays a centered message when no file is open for editing.
 * This component will be replaced with Monaco editor integration in future tasks.
 * 
 * Pure React component (P1: Process isolation - no Node.js, no IPC).
 * Styled with Tailwind 4 tokens (P4: UI design system).
 * Monaco remains lazy-loaded and NOT in this component.
 * 
 * @example
 * ```tsx
 * <EditorPlaceholder />
 * ```
 */
export function EditorPlaceholder() {
  return (
    <div className="flex items-center justify-center h-full text-tertiary">
      <div className="text-center">
        <p className="text-md">Open a file to start editing</p>
      </div>
    </div>
  );
}
