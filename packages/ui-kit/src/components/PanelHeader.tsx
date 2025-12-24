import { Disclosure, DisclosureButton } from '@headlessui/react';
import { ChevronUpIcon } from '@heroicons/react/20/solid';

/**
 * Props for the PanelHeader component.
 */
export interface PanelHeaderProps {
  /** Panel title text */
  title: string;
  
  /** Whether the panel is currently collapsed */
  collapsed: boolean;
  
  /** Callback when collapse/expand button is clicked */
  onToggleCollapse: () => void;
}

/**
 * PanelHeader component - Header for panels with title and collapse/expand button.
 * 
 * Features:
 * - Displays panel title
 * - Collapse/expand button with chevron icon
 * - Button icon changes based on collapsed state
 * - Used by Primary Sidebar, Secondary Sidebar, and Bottom Panel
 * 
 * Uses Tailwind 4 tokens for styling (P4: UI design system).
 * Pure React component with no Electron/Node.js dependencies (P1: Process isolation).
 * 
 * @example
 * ```tsx
 * <PanelHeader
 *   title="Explorer"
 *   collapsed={false}
 *   onToggleCollapse={() => setCollapsed(!collapsed)}
 * />
 * ```
 */
export function PanelHeader({ title, collapsed, onToggleCollapse }: PanelHeaderProps) {
  // Remount to keep Disclosure open state aligned with controlled collapsed prop.
  const disclosureKey = collapsed ? 'collapsed' : 'open';

  return (
    <Disclosure
      key={disclosureKey}
      defaultOpen={!collapsed}
      as="div"
      className="flex items-center justify-between border-b border-border-subtle bg-surface-secondary"
      style={{
        height: 'var(--vscode-panelHeader-height)',
        paddingLeft: 'var(--vscode-space-2)',
        paddingRight: 'var(--vscode-space-2)',
      }}
    >
      {({ open }) => (
        <>
          {/* Panel title with icon */}
          <div className="flex items-center gap-2">
            <h2
              className="font-semibold text-secondary uppercase"
              style={{
                fontSize: 'var(--vscode-font-size-small)',
                letterSpacing: '0.08em',
              }}
            >
              {title}
            </h2>
          </div>

          {/* Collapse/expand button */}
          <DisclosureButton
            onClick={onToggleCollapse}
            className="
              p-1 rounded-none transition-colors duration-150
              hover:bg-surface-hover
              group focus:outline-none focus:ring-1 focus:ring-accent
            "
            aria-label={open ? 'Collapse panel' : 'Expand panel'}
          >
            <ChevronUpIcon
              className="w-4 h-4 text-secondary transition-transform duration-200 group-hover:text-primary"
              style={{
                transform: open ? 'rotate(0deg)' : 'rotate(180deg)',
              }}
            />
          </DisclosureButton>
        </>
      )}
    </Disclosure>
  );
}
