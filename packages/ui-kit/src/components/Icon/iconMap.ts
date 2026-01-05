import {
  FolderIcon,
  MagnifyingGlassIcon,
  ArrowsRightLeftIcon,
  BugAntIcon,
  PuzzlePieceIcon,
  ClipboardDocumentCheckIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

export const iconMap = {
  explorer: FolderIcon,
  search: MagnifyingGlassIcon,
  'source-control': ArrowsRightLeftIcon,
  'run-debug': BugAntIcon,
  extensions: PuzzlePieceIcon,
  sdd: ClipboardDocumentCheckIcon,
  settings: Cog6ToothIcon,
} as const;

export type IconName = keyof typeof iconMap;
