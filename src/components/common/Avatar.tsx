import { generateAvatarColor, generateInitials } from '../../utils/songAvatar'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg'

const AVATAR_SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
}

export interface AvatarProps {
  /** Text to derive initials from when `initials` is not provided. */
  label?: string
  /** Explicit initials (overrides label-derived). */
  initials?: string
  /** Explicit background color. If omitted, derived deterministically from `colorSeed ?? label`. */
  color?: string
  /** Seed for the deterministic color hash when `color` is omitted. */
  colorSeed?: string
  /** Photo URL — renders the image instead of initials. */
  photo?: string
  size?: AvatarSize
  /** Tailwind rounding class (default fully round). */
  rounded?: string
  className?: string
  title?: string
  'data-testid'?: string
}

/**
 * Generic colored avatar (mobile-redesign-port).
 *
 * Deterministic color + initials for people/bands/songs, or a photo if given.
 * `SongAvatar` is a thin wrapper over this; member avatars should use it directly
 * instead of hand-rolling `<div>` circles.
 */
export function Avatar({
  label,
  initials,
  color,
  colorSeed,
  photo,
  size = 'md',
  rounded = 'rounded-full',
  className = '',
  title,
  'data-testid': testId,
}: AvatarProps) {
  const bg = color ?? generateAvatarColor(colorSeed ?? label ?? '')
  const text = initials ?? generateInitials(label ?? '')

  return (
    <div
      className={`flex-shrink-0 ${rounded} flex items-center justify-center font-semibold text-white uppercase overflow-hidden ${AVATAR_SIZE_CLASSES[size]} ${className}`}
      style={
        photo
          ? {
              backgroundImage: `url(${photo})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : { backgroundColor: bg }
      }
      title={title}
      data-testid={testId}
      aria-hidden={photo ? undefined : true}
    >
      {!photo && text}
    </div>
  )
}
