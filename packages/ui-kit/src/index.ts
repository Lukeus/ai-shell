/**
 * UI Kit Package
 * 
 * Pure React component library for ai-shell layout system.
 * All components are renderer-only (no Electron/Node.js dependencies).
 * 
 * Following P1 (Process isolation): No OS access, browser APIs only.
 * Following P4 (UI design system): Tailwind 4 token-based styling.
 * Following P6 (Contracts-first): Imports types from api-contracts.
 */

// Export layout components
export * from './components/ShellLayout';
export * from './components/ResizablePanel';
export * from './components/ActivityBar';
export * from './components/StatusBar';
export * from './components/PanelHeader';

// Export form control components
export * from './components/ToggleSwitch';
export * from './components/Select';
export * from './components/Input';

// Export navigation and list components
export * from './components/TabBar';
export * from './components/VirtualizedList';
export * from './components/Icon';

// Package version
export const UI_KIT_VERSION = '0.0.1';
