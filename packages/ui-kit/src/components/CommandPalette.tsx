import React from 'react';
import { CommandPaletteProps } from './CommandPalette.types';
import { useCommandPalette } from './useCommandPalette';
import { CommandPaletteView } from './CommandPalette.view';

export * from './CommandPalette.types';

export function CommandPalette<T>(props: CommandPaletteProps<T>) {
  const logic = useCommandPalette(props);
  return <CommandPaletteView {...props} {...logic} />;
}
