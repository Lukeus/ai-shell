/**
 * AIAssistantPanel component - Placeholder for the AI assistant secondary sidebar.
 * 
 * Displays the AI Assistant title in a centered layout.
 * This component will be replaced with actual AI agent UI in future tasks.
 * 
 * Pure React component (P1: Process isolation - no Node.js, no IPC).
 * Styled with Tailwind 4 tokens (P4: UI design system).
 * 
 * @example
 * ```tsx
 * <AIAssistantPanel />
 * ```
 */
export function AIAssistantPanel() {
  return (
    <div className="flex items-center justify-center h-full text-gray-400">
      <div className="text-center">
        <p className="text-sm">AI Assistant</p>
      </div>
    </div>
  );
}
