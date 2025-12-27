import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CommandPaletteProps } from './CommandPalette.types';

const defaultQueryTransform = (query: string) =>
  query.replace(/^>\s*/, '').trim().toLowerCase();

export function useCommandPalette<T>({
  open,
  onClose,
  items,
  onSelect,
  config,
}: CommandPaletteProps<T>) {
  const {
    getItemLabel,
    getItemDisabled,
    groupBy,
    initialQuery = '>',
    queryTransform = defaultQueryTransform,
    onQueryChange,
    closeOnSelect = true,
  } = config ?? {};
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [selectedItem, setSelectedItem] = useState<T | null>(null);

  const updateQuery = useCallback((value: string) => {
    setQuery(value);
    onQueryChange?.(value);
  }, [onQueryChange]);

  useEffect(() => {
    if (!open) return;
    updateQuery(initialQuery);
    setSelectedItem(null);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });
  }, [initialQuery, open, updateQuery]);

  const resolveLabel = useCallback((item: T) => {
    if (getItemLabel) return getItemLabel(item);
    if (typeof item === 'string') return item;
    const label = (item as { label?: string }).label;
    const id = (item as { id?: string }).id;
    return label ?? id ?? '';
  }, [getItemLabel]);

  const resolveDisabled = useCallback((item: T) => {
    if (getItemDisabled) return getItemDisabled(item);
    return Boolean((item as { disabled?: boolean }).disabled);
  }, [getItemDisabled]);

  const normalizedQuery = useMemo(() => queryTransform(query), [query, queryTransform]);

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return items;
    return items.filter((item) =>
      resolveLabel(item).toLowerCase().includes(normalizedQuery)
    );
  }, [items, normalizedQuery, resolveLabel]);

  const groupedItems = useMemo(() => {
    if (!groupBy) return null;
    const groups = new Map<string, T[]>();
    filteredItems.forEach((item) => {
      const key = groupBy(item) ?? '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(item);
    });
    return Array.from(groups.entries());
  }, [filteredItems, groupBy]);

  const handleSelect = (item: T | null) => {
    if (!item || resolveDisabled(item)) return;
    setSelectedItem(item);
    onSelect(item);
    if (closeOnSelect) onClose();
  };

  return {
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
  };
}
