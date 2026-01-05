
import type { CSSProperties } from 'react';

import { iconMap, type IconName } from './iconMap';

export type IconProps = {
  name: IconName;
  className?: string;
  size?: number | string;
  title?: string;
  style?: CSSProperties;
};

/**
 * Icon component backed by Heroicons.
 * Maps stable app icon names to Heroicon SVGs.
 */
export function Icon({ name, className, size = 20, title, style }: IconProps) {
  const Component = iconMap[name];
  const sizeStyle: CSSProperties = { width: size, height: size };
  const mergedStyle = style ? { ...sizeStyle, ...style } : sizeStyle;

  return (
    <Component
      className={className}
      style={mergedStyle}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    />
  );
}
