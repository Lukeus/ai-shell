import { ReactNode } from 'react';

export type CommandPaletteRenderItemProps<T> = {
  item: T;
  active: boolean;
  selected: boolean;
  disabled: boolean;
  label: string;
  query: string;
  icon?: ReactNode;
};

export type CommandPaletteConfig<T> = {
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
};

export interface CommandPaletteProps<T> {
  open: boolean;
  onClose: () => void;
  items: T[];
  onSelect: (item: T) => void;
  config?: CommandPaletteConfig<T>;
}
