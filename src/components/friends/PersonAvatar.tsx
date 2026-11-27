import { Avatar, type AvatarSize } from '../common/Avatar'

/**
 * A person's avatar in their personal colour (dark lettering, as the band
 * mark), or the derived colour when they haven't picked one.
 */
export function PersonAvatar({
  name,
  color,
  size = 'md',
}: {
  name: string
  color: string | null
  size?: AvatarSize
}) {
  return (
    <Avatar
      label={name}
      color={color ?? undefined}
      size={size}
      className={color ? '!text-[#1a0c02] font-bold' : 'font-bold'}
    />
  )
}
