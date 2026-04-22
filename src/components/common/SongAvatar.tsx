import { generateAvatarColor, generateInitials } from '../../utils/songAvatar'

export type SongAvatarSize = 'xs' | 'sm' | 'md' | 'lg'

interface SongAvatarProps {
  title: string
  artist?: string
  size?: SongAvatarSize
  className?: string
}

const SIZE_CLASSES: Record<SongAvatarSize, string> = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
}

/**
 * Colored circle avatar showing song initials.
 * Color is deterministically derived from the song title.
 */
export function SongAvatar({
  title,
  artist,
  size = 'md',
  className = '',
}: SongAvatarProps) {
  // Use artist for the initials display if available, title for the color hash
  const initials = generateInitials(artist ?? title)
  const color = generateAvatarColor(title)

  return (
    <div
      className={`flex-shrink-0 rounded-full flex items-center justify-center font-semibold text-white uppercase ${SIZE_CLASSES[size]} ${className}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initials}
    </div>
  )
}
