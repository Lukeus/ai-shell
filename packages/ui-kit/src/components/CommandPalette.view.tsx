import React from 'react';
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
  Dialog,
  DialogBackdrop,
  DialogPanel,
} from '@headlessui/react';
import { CommandPaletteProps, CommandPaletteRenderItemProps } from './CommandPalette.types';

interface CommandPaletteViewProps<T> extends CommandPaletteProps<T> {
  query: string;
  updateQuery: (value: string) => void;
  selectedItem: T | null;
  handleSelect: (item: T | null) => void;
  filteredItems: T[];
  groupedItems: [string, T[]][] | null;
  inputRef: React.RefObject<HTMLInputElement>;
  normalizedQuery: string;
  resolveLabel: (item: T) => string;
  resolveDisabled: (item: T) => boolean;
}

const MAX_VISIBLE_ROWS = 8;
const ROW_HEIGHT = 32;

export function CommandPaletteView<T>(props: CommandPaletteViewProps<T>) {
  const {
    open,
    onClose,
    config,
    query,
    updateQuery,
    selectedItem,
    handleSelect,
    filteredItems,
    groupedItems,
    inputRef,
    normalizedQuery,
    resolveLabel,
    resolveDisabled,
  } = props;

  if (!open) return null;

  const placeholder = config?.placeholder ?? 'Type a command...';
  const emptyText = config?.emptyText;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="relative"
      style={{ zIndex: 'var(--vscode-z-modal)' }}
      aria-label="Command Palette"
    >
      <DialogBackdrop
        className="fixed inset-0 bg-[var(--color-overlay)] transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
        style={{ zIndex: 'var(--vscode-z-modal)' }}
      />
      <div className="fixed inset-0 overflow-y-auto w-screen p-4 sm:p-6 md:p-20" style={{ zIndex: 'var(--vscode-z-modal)' }}>
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
              <CommandPaletteInput
                inputRef={inputRef}
                query={query}
                updateQuery={updateQuery}
                placeholder={placeholder}
              />
              <CommandPaletteList
                emptyText={emptyText}
                filteredItems={filteredItems}
                groupedItems={groupedItems}
                renderGroupHeader={config?.renderGroupHeader}
                renderItem={config?.renderItem}
                getItemIcon={config?.getItemIcon}
                resolveLabel={resolveLabel}
                resolveDisabled={resolveDisabled}
                normalizedQuery={normalizedQuery}
              />
              <CommandPaletteFooter footer={config?.footer} />
            </Combobox>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

function CommandPaletteInput({ inputRef, query, updateQuery, placeholder }: {
  inputRef: React.RefObject<HTMLInputElement>;
  query: string;
  updateQuery: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="px-6 pt-4">
      <div className="grid grid-cols-1 rounded-sm border border-[var(--vscode-input-border)] bg-[var(--vscode-input-background)] focus-within:border-[var(--vscode-focus-border)]">
        <ComboboxInput
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          placeholder={placeholder}
          className="col-start-1 row-start-1 h-11 w-full bg-transparent px-4 py-2 text-primary outline-none placeholder:text-tertiary"
          style={{ fontSize: 'var(--vscode-font-size-ui)' }}
        />
      </div>
    </div>
  );
}

function CommandPaletteList<T>({
  emptyText,
  filteredItems,
  groupedItems,
  renderGroupHeader,
  renderItem,
  getItemIcon,
  resolveLabel,
  resolveDisabled,
  normalizedQuery,
}: {
  emptyText?: string;
  filteredItems: T[];
  groupedItems: [string, T[]][] | null;
  renderGroupHeader?: (group: string) => React.ReactNode;
  renderItem?: (props: CommandPaletteRenderItemProps<T>) => React.ReactNode;
  getItemIcon?: (item: T) => React.ReactNode;
  resolveLabel: (item: T) => string;
  resolveDisabled: (item: T) => boolean;
  normalizedQuery: string;
}) {
  const listHeight = filteredItems.length > 0
    ? `${Math.min(filteredItems.length, MAX_VISIBLE_ROWS) * ROW_HEIGHT}px`
    : undefined;

  const defaultEmptyText = normalizedQuery
    ? 'No results found.'
    : 'Start typing to search commands.';

  return (
    <div
      className="overflow-auto pt-3"
      style={{
        maxHeight: `min(50vh, ${MAX_VISIBLE_ROWS * ROW_HEIGHT}px)`,
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
            <CommandPaletteGroup
              key={group}
              group={group}
              items={groupItems}
              renderGroupHeader={renderGroupHeader}
              renderItem={renderItem}
              getItemIcon={getItemIcon}
              resolveLabel={resolveLabel}
              resolveDisabled={resolveDisabled}
              normalizedQuery={normalizedQuery}
            />
          ))
        ) : (
          filteredItems.map((item) => (
            <CommandPaletteOption
              key={(item as { id?: string }).id ?? resolveLabel(item)}
              item={item}
              renderItem={renderItem}
              getItemIcon={getItemIcon}
              resolveLabel={resolveLabel}
              resolveDisabled={resolveDisabled}
              normalizedQuery={normalizedQuery}
            />
          ))
        )}
      </ComboboxOptions>
    </div>
  );
}

function CommandPaletteFooter({ footer }: { footer?: React.ReactNode }) {
  if (!footer) return null;
  return (
    <div className="border-t border-border-subtle px-4 py-2 text-xs text-secondary">
      {footer}
    </div>
  );
}

function CommandPaletteGroup<T>({
  group,
  items,
  renderGroupHeader,
  renderItem,
  getItemIcon,
  resolveLabel,
  resolveDisabled,
  normalizedQuery,
}: {
  group: string;
  items: T[];
  renderGroupHeader?: (group: string) => React.ReactNode;
  renderItem?: (props: CommandPaletteRenderItemProps<T>) => React.ReactNode;
  getItemIcon?: (item: T) => React.ReactNode;
  resolveLabel: (item: T) => string;
  resolveDisabled: (item: T) => boolean;
  normalizedQuery: string;
}) {
  return (
    <div className="py-2">
      {renderGroupHeader ? renderGroupHeader(group) : (
        <div className="px-7 py-1 text-[11px] font-bold text-accent uppercase tracking-wider opacity-80">
          {group}
        </div>
      )}
      <div className="space-y-1">
        {items.map((item) => (
          <CommandPaletteOption
            key={(item as { id?: string }).id ?? resolveLabel(item)}
            item={item}
            renderItem={renderItem}
            getItemIcon={getItemIcon}
            resolveLabel={resolveLabel}
            resolveDisabled={resolveDisabled}
            normalizedQuery={normalizedQuery}
          />
        ))}
      </div>
    </div>
  );
}

function CommandPaletteOption<T>({
  item,
  renderItem,
  getItemIcon,
  resolveLabel,
  resolveDisabled,
  normalizedQuery,
}: {
  item: T;
  renderItem?: (props: CommandPaletteRenderItemProps<T>) => React.ReactNode;
  getItemIcon?: (item: T) => React.ReactNode;
  resolveLabel: (item: T) => string;
  resolveDisabled: (item: T) => boolean;
  normalizedQuery: string;
}) {
  const label = resolveLabel(item);
  const icon = getItemIcon?.(item);
  const isDisabled = resolveDisabled(item);

  return (
    <ComboboxOption
      value={item}
      disabled={isDisabled}
      className={({ active }) => `
        flex w-full min-h-[32px] items-center gap-3 px-7 py-2 text-[13px]
        border-b border-border-subtle last:border-b-0
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${active ? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-menu-selectionForeground)]' : 'text-primary'}
      `}
    >
      {(optionProps) => {
        if (renderItem) {
          return <>{renderItem({ ...optionProps, item, label, query: normalizedQuery, icon })}</>;
        }
        return (
          <>
            {icon && <span className="text-secondary">{icon}</span>}
            <span className="flex-1 truncate">
              {normalizedQuery ? (
                label.split(new RegExp(`(${normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, i) => (
                  part.toLowerCase() === normalizedQuery.toLowerCase() ? (
                    <mark key={i} className="bg-accent/30 text-primary rounded-xs px-0.5">{part}</mark>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                ))
              ) : label}
            </span>
          </>
        );
      }}
    </ComboboxOption>
  );
}
