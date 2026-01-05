import { useCallback, useEffect, useState } from 'react';
import type { CommandContribution } from 'packages-api-contracts';
import { CommandPalette as UiCommandPalette } from 'packages-ui-kit';
import { useFileTree } from '../explorer/FileTreeContext';
import { useCommandPaletteItems, BuiltInCommand, CommandItem, PaletteItem } from './useCommandPaletteItems';
import { CommandPaletteItem } from './CommandPaletteItem.view';
import { CommandPaletteFooter } from './CommandPaletteFooter.view';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  builtInCommands?: BuiltInCommand[];
}

export function CommandPalette({ isOpen, onClose, builtInCommands = [] }: CommandPaletteProps) {
  const { openFile } = useFileTree();
  const { query, setQuery, isCommandMode, searchQuery, items, isLoading, error } = useCommandPaletteItems(isOpen, builtInCommands);
  const [actionError, setActionError] = useState<string | null>(null);

  const executeCommand = useCallback(async (command: CommandItem | undefined) => {
    if (!command || !command.enabled) return;
    setActionError(null);
    try {
      if (command.source === 'built-in') {
        const builtIn = command.command as BuiltInCommand;
        await builtIn.action();
      } else {
        const extension = command.command as CommandContribution;
        const result = await window.api.extensions.executeCommand({
          commandId: extension.id,
        });
        if (!result.ok) {
          console.error('Failed to execute command:', result.error);
          setActionError(result.error.message || 'Failed to execute command.');
          return;
        }
      }
      onClose();
    } catch (err) {
      console.error('Failed to execute command:', err);
      setActionError('Failed to execute command.');
    }
  }, [onClose]);

  const executeFileOpen = useCallback((filePath: string) => {
    openFile(filePath);
    onClose();
  }, [onClose, openFile]);

  useEffect(() => {
    if (!isOpen) return;
    setActionError(null);
  }, [isOpen]);

  const emptyText = isLoading
    ? (isCommandMode ? 'Loading commands...' : 'Indexing workspace files...')
    : error ? error : isCommandMode
      ? 'No commands found.'
      : searchQuery ? 'No files matched your search.' : 'Start typing to search workspace files.';

    const footer = (
    <CommandPaletteFooter actionError={actionError} isCommandMode={isCommandMode} />
  );

  return (
    <UiCommandPalette
      open={isOpen}
      onClose={onClose}
      items={items}
      onSelect={(item: PaletteItem) => {
        if (item.kind === 'command') {
          void executeCommand(item);
          return;
        }
        executeFileOpen(item.path);
      }}
      config={{
        placeholder: isCommandMode ? 'Type a command...' : 'Type to search files...',
        emptyText,
        onQueryChange: setQuery,
        closeOnSelect: false,
        getItemLabel: (item: PaletteItem) => item.searchText,
        getItemDisabled: (item: PaletteItem) =>
          item.kind === 'command' ? !item.enabled : false,
        renderItem: ({ item, query }: { item: PaletteItem; query: string }) => (
          <CommandPaletteItem item={item} query={query} />
        ),
        footer,
        initialQuery: '>',
      }}
    />
  );
}

