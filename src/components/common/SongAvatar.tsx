import { Avatar, type AvatarSize } from './Avatar'

export type SongAvatarSize = AvatarSize

interface SongAvatarProps {
  title: string
  artist?: string
  size?: SongAvatarSize
  className?: string
}

/**
 * Colored circle avatar showing song initials.
 * Initials come from the artist (falling back to title); color is deterministically
 * derived from the title. Thin wrapper over the generic {@link Avatar}.
 */
export function SongAvatar({
  title,
  artist,
  size = 'md',
  className = '',
}: SongAvatarProps) {
  return (
    <Avatar
      label={artist ?? title}
      colorSeed={title}
      size={size}
      className={className}
    />
  )
}
