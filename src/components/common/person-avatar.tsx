import { Avatar } from '@/components/base/avatar/avatar'
import { avatarTint, initials } from '@/lib/format'

interface PersonAvatarProps {
  name: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

/** Initials avatar with a deterministic tint per person (BoardUI Avatar). */
export function PersonAvatar({ name, size = 'sm', className }: PersonAvatarProps) {
  return (
    <Avatar
      size={size}
      initials={initials(name)}
      alt={name}
      className={[avatarTint(name), className].filter(Boolean).join(' ')}
    />
  )
}
