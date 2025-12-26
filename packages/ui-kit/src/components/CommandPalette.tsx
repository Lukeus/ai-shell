import React, { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Dialog,
  DialogBackdrop,
  DialogPanel,
} from '@headlessui/react';

export type CommandPaletteRenderItemProps<T> = {
  item: T;
  active: boolean;
  selected: boolean;
  disabled: boolean;
  label: string;
  query: string;
  icon?: ReactNode;
};

export interface CommandPaletteProps<T> {
  open: boolean;
  onClose: () => void;
  items: T[];
  onSelect: (item: T) => void;
  placeholder?: string;
  emptyText?: string;
  getItemLabel?: (item: T) => string;
  getItemIcon?: (item: T) => ReactNode;
  getItemDisabled?: (item: T) => boolean;
  renderItem?: (props: CommandPaletteRenderItemProps<T>) => ReactNode;
  groupBy?: (item: T) => string;
  renderGroupHeader?: (group: string) => ReactNode;
  footer?: ReactNode;
  initialQuery?: string;
  queryTransform?: (query: string) => string;
  onQueryChange?: (query: string) => void;
  closeOnSelect?: boolean;
}

const defaultQueryTransform = (query: string) =>
  query.replace(/^>\s*/, '').trim().toLowerCase();

export function CommandPalette<T>({
  open,
  onClose,
  items,
  onSelect,
  placeholder = 'Type a command...',
  emptyText,
  getItemLabel,
  getItemIcon,
  getItemDisabled,
  renderItem,
  groupBy,
  renderGroupHeader,
  footer,
  initialQuery = '>',
  queryTransform = defaultQueryTransform,
  onQueryChange,
  closeOnSelect = true,
}: CommandPaletteProps<T>) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [selectedItem, setSelectedItem] = useState<T | null>(null);
  const updateQuery = useCallback((value: string) => {
    setQuery(value);
    onQueryChange?.(value);
  }, [onQueryChange]);

  useEffect(() => {
    if (!open) {
      return;
    }
    updateQuery(initialQuery);
    setSelectedItem(null);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const input = inputRef.current;
      if (input) {
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });
  }, [initialQuery, open, updateQuery]);

  const resolveLabel = useCallback((item: T) => {
    if (getItemLabel) {
      return getItemLabel(item);
    }
    if (typeof item === 'string') {
      return item;
    }
    const label = (item as { label?: string }).label;
    const id = (item as { id?: string }).id;
    return label ?? id ?? '';
  }, [getItemLabel]);

  const resolveDisabled = useCallback((item: T) => {
    if (getItemDisabled) {
      return getItemDisabled(item);
    }
    return Boolean((item as { disabled?: boolean }).disabled);
  }, [getItemDisabled]);

  const normalizedQuery = queryTransform(query);

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) {
      return items;
    }
    return items.filter((item) =>
      resolveLabel(item).toLowerCase().includes(normalizedQuery)
    );
  }, [items, normalizedQuery, resolveLabel]);

  const groupedItems = useMemo(() => {
    if (!groupBy) {
      return null;
    }
    const groups = new Map<string, T[]>();
    filteredItems.forEach((item) => {
      const key = groupBy(item) ?? '';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)?.push(item);
    });
    return Array.from(groups.entries());
  }, [filteredItems, groupBy]);

  const handleSelect = (item: T | null) => {
    if (!item || resolveDisabled(item)) {
      return;
    }
    onSelect(item);
    if (closeOnSelect) {
      onClose();
    }
  };

  if (!open) {
    return null;
  }

  const maxVisibleRows = 8;
  const rowHeight = 32;
  const listHeight = filteredItems.length > 0
    ? `${Math.min(filteredItems.length, maxVisibleRows) * rowHeight}px`
    : undefined;
  const defaultEmptyText = normalizedQuery
    ? 'No results found.'
    : 'Start typing to search commands.';

  return (
    <Dialog
      open={open}
      onClose={() => onClose()}
      className="relative"
      style={{ zIndex: 'var(--vscode-z-modal)' }}
      aria-label="Command Palette"
    >
      <DialogBackdrop
        className="fixed inset-0 bg-[var(--color-overlay)] transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
        style={{ zIndex: 'var(--vscode-z-modal)' }}
      />
      <div className="fixed inset-0 overflow-y-auto w-screen overflow-y-auto p-4 sm:p-6 md:p-20" style={{ zIndex: 'var(--vscode-z-modal)' }}>
        <div className="flex min-h-full items-start justify-center p-4 sm:p-6 md:p-10">
          <DialogPanel
            className="mx-auto transform divide-y overflow-hidden rounded-sm border shadow-lg"
            style={{
              width: 'min(680px, 92vw)',
              backgroundColor: 'var(--vscode-menu-background)',
              color: 'var(--vscode-menu-foreground)',
              borderColor: 'var(--vscode-editorWidget-border)',
              boxShadow: 'var(--vscode-widget-shadow)',
              marginTop: 'var(--vscode-space-4)',
            }}
          >
            <Combobox value={selectedItem} onChange={handleSelect} immediate>
              <div
                className="px-6 pt-4"
              >
                <div
                  className="
                    grid grid-cols-1 rounded-sm border border-[var(--vscode-input-border)]
                    bg-[var(--vscode-input-background)] focus-within:border-[var(--vscode-focus-border)]
                  "
                >
                  <ComboboxInput
                    ref={inputRef}
                    autoFocus
                    value={query}
                    onChange={(event) => updateQuery(event.target.value)}
                    placeholder={placeholder}
                    className="col-start-1 row-start-1 h-11 w-full bg-transparent px-4 py-2 text-primary outline-none placeholder:text-tertiary"
                    style={{
                      fontSize: 'var(--vscode-font-size-ui)',
                    }}
                  />
                </div>
              </div>

              <div
                className="overflow-auto pt-3"
                style={{
                  maxHeight: `min(50vh, ${maxVisibleRows * rowHeight}px)`,
                  height: listHeight,
                }}
              >
                <ComboboxOptions className="py-1 max-h-72 scroll-py-2 overflow-y-auto py-2 text-sm" static>
                  {filteredItems.length === 0 ? (
                    <div className="px-7 py-3 text-[13px] text-secondary">
                      {emptyText ?? defaultEmptyText}
                    </div>
                  ) : groupedItems ? (
                    groupedItems.map(([group, groupItems]) => (
                      <div key={group} className="py-2">
                        {renderGroupHeader ? (
                          renderGroupHeader(group)
                        ) : (
                          <div className="px-7 py-1 text-[11px] font-bold text-accent uppercase tracking-wider opacity-80">
                            {group}
                          </div>
                        )}
                        <div className="space-y-1">
                          {groupItems.map((item) => {
                            const label = resolveLabel(item);
                            const icon = getItemIcon?.(item);
                            const isDisabled = resolveDisabled(item);
                            return (
                              <ComboboxOption
                                key={(item as { id?: string }).id ?? label}
                                value={item}
                                disabled={isDisabled}
                                className={({ active }) => `
                                  flex w-full min-h-[32px] items-center gap-3 px-7 py-2 text-[13px]
                                  border-b border-border-subtle last:border-b-0
                                  ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                  ${active ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-menu-selectionForeground)]' : 'text-primary'}
                                `}
                              >
                                {({ active, selected, disabled }) => {
                                  const content = renderItem
                                    ? renderItem({
                                        item,
                                        active,
                                        selected,
                                        disabled,
                                        label,
                                        query: normalizedQuery,
                                        icon,
                                      })
                                    : (
                                      <>
                                        {icon && (
                                          <span className="text-secondary">{icon}</span>
                                        )}
                                        <span className="flex-1 truncate">
                                          {normalizedQuery ? (
                                            label.split(new RegExp(`(${normalizedQuery})`, 'gi')).map((part, i) => (
                                              part.toLowerCase() === normalizedQuery.toLowerCase() ? (
                                                <mark key={i} className="bg-accent/30 text-primary rounded-xs px-0.5">{part}</mark>
                                              ) : (
                                                <span key={i}>{part}</span>
                                              )
                                            ))
                                          ) : (
                                            label
                                          )}
                                        </span>
                                      </>
                                    );
                                  return <>{content}</>;
                                }}
                              </ComboboxOption>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    filteredItems.map((item) => {
                      const label = resolveLabel(item);
                      const icon = getItemIcon?.(item);
                      const isDisabled = resolveDisabled(item);
                      return (
                        <ComboboxOption
                          key={(item as { id?: string }).id ?? label}
                          value={item}
                          disabled={isDisabled}
                          className={({ active }) => `
                            flex w-full min-h-[32px] items-center gap-3 px-7 py-2 text-[13px]
                            border-b border-border-subtle last:border-b-0
                            ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                            ${active ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-menu-selectionForeground)]' : 'text-primary'}
                          `}
                        >
                          {({ active, selected, disabled }) => {
                            const content = renderItem
                              ? renderItem({
                                  item,
                                  active,
                                  selected,
                                  disabled,
                                  label,
                                  query: normalizedQuery,
                                  icon,
                                })
                              : (
                                <>
                                  {icon && (
                                    <span className="text-secondary">{icon}</span>
                                  )}
                                  <span className="flex-1 truncate">
                                    {normalizedQuery ? (
                                      label.split(new RegExp(`(${normalizedQuery})`, 'gi')).map((part, i) => (
                                        part.toLowerCase() === normalizedQuery.toLowerCase() ? (
                                          <mark key={i} className="bg-accent/30 text-primary rounded-xs px-0.5">{part}</mark>
                                        ) : (
                                          <span key={i}>{part}</span>
                                        )
                                      ))
                                    ) : (
                                      label
                                    )}
                                  </span>
                                </>
                              );
                            return <>{content}</>;
                          }}
                        </ComboboxOption>
                      );
                    })
                  )}
                </ComboboxOptions>
              </div>

              {footer && (
                <div className="border-t border-border-subtle px-4 py-2 text-xs text-secondary">
                  {footer}
                </div>
              )}
            </Combobox>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
