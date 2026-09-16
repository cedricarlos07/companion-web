import { HugeiconsIcon } from '@hugeicons/react'
import type { IconSvgElement } from '@hugeicons/react'
import type { ComponentType } from 'react'

/**
 * Central Hugeicons wrapper — the ONLY way Companion renders icons.
 * Normalizes size (semantic steps), stroke weight (1.5, absolute so it stays
 * crisp at every size), color (currentColor), and accessibility (decorative
 * icons are hidden from assistive tech; pass `label` for meaningful icons).
 */

const SIZES = { xs: 14, sm: 16, md: 20, lg: 24, xl: 32 } as const

export type HugeIconSize = keyof typeof SIZES

export interface HugeIconProps {
  icon: IconSvgElement
  size?: HugeIconSize | number
  strokeWidth?: number
  className?: string
  /** Accessible name. Omit for purely decorative icons. */
  label?: string
}

export function HugeIcon({
  icon,
  size = 'md',
  strokeWidth = 1.5,
  className,
  label,
}: HugeIconProps) {
  const px = typeof size === 'number' ? size : SIZES[size]
  return (
    <HugeiconsIcon
      icon={icon}
      size={px}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  )
}

/**
 * Adapts a Hugeicons glyph to the component-reference icon shape BoardUI
 * components expect (`leadingIcon={SomeIcon}` where the prop renders
 * `<Icon className aria-hidden />`).
 *
 *   <Button leadingIcon={adaptIcon(PlusSignIcon)} … />
 */
export function adaptIcon(
  icon: IconSvgElement,
  px: number = 20,
): ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }> {
  function AdaptedIcon({
    className,
    'aria-hidden': ariaHidden,
  }: {
    className?: string
    'aria-hidden'?: boolean | 'true' | 'false'
  }) {
    return (
      <HugeiconsIcon
        icon={icon}
        size={px}
        strokeWidth={1.5}
        absoluteStrokeWidth
        className={className}
        aria-hidden={ariaHidden}
      />
    )
  }
  return AdaptedIcon
}
