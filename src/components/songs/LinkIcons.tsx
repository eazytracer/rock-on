import React, { useState } from 'react'
import {
  Music2,
  Play,
  Guitar,
  FileText,
  ExternalLink,
  HardDrive,
  Cloud,
  CloudRain,
  MoreHorizontal,
  LucideIcon,
} from 'lucide-react'
import type { ReferenceLink } from '../../types'
import { getLinkTypeInfo, LinkType } from '../../utils/linkDetection'

interface LinkIconsProps {
  links: ReferenceLink[]
  size?: 'sm' | 'md'
  showEmpty?: boolean
  maxVisible?: number // Max icons to show before "..." (default: 3)
}

interface LinkIconProps {
  type: LinkType
  size?: 'sm' | 'md'
}

const iconComponents: Record<string, LucideIcon> = {
  Music2,
  Play,
  Guitar,
  FileText,
  ExternalLink,
  HardDrive,
  Cloud,
  CloudRain,
}

const sizeConfig = {
  sm: {
    iconSize: 16,
    padding: 'p-1.5',
    gap: 'gap-1',
  },
  md: {
    iconSize: 20,
    padding: 'p-2',
    gap: 'gap-1.5',
  },
}

/**
 * Renders a single link type icon with the appropriate brand color.
 */
export const LinkIcon: React.FC<LinkIconProps> = ({ type, size = 'sm' }) => {
  const info = getLinkTypeInfo(type)
  const IconComponent = iconComponents[info.iconName]
  const config = sizeConfig[size]

  if (!IconComponent) {
    return null
  }

  return (
    <IconComponent
      className={info.color}
      width={config.iconSize}
      height={config.iconSize}
    />
  )
}

/**
 * Renders a single clickable link icon button.
 */
const LinkIconButton: React.FC<{
  link: ReferenceLink
  size: 'sm' | 'md'
  onLinkClick?: () => void
}> = ({ link, size, onLinkClick }) => {
  const config = sizeConfig[size]
  const iconType = link.icon as LinkType
  const info = getLinkTypeInfo(iconType)
  const tooltip = link.description || info.name

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onLinkClick?.()
  }

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      title={tooltip}
      className={`
        ${config.padding}
        inline-flex items-center justify-center
        rounded-md
        border border-[#404040]
        bg-[#252525]
        text-[#909090]
        hover:bg-[#353535]
        hover:border-[#505050]
        hover:text-white
        active:bg-[#404040]
        transition-all duration-150
        cursor-pointer
        shadow-sm
        flex-shrink-0
      `}
      onClick={handleClick}
      data-testid={`link-icon-${iconType}`}
    >
      <LinkIcon type={iconType} size={size} />
    </a>
  )
}

/**
 * Renders clickable link icons for a list of reference links.
 *
 * Used in song lists to provide quick access to external resources
 * without opening the edit modal.
 *
 * Icons are always displayed in a single row. If there are more links
 * than maxVisible, a "..." button shows a popover with all links.
 *
 * @example
 * <LinkIcons
 *   links={song.referenceLinks}
 *   size="sm"
 *   maxVisible={2}
 * />
 */
export const LinkIcons: React.FC<LinkIconsProps> = ({
  links,
  size = 'sm',
  showEmpty = false,
  maxVisible = 3,
}) => {
  const [showPopover, setShowPopover] = useState(false)

  // Handle empty state
  if (!links || links.length === 0) {
    if (showEmpty) {
      return <span className="text-xs text-[#606060] italic">No links</span>
    }
    return null
  }

  const config = sizeConfig[size]
  const hasMore = links.length > maxVisible
  const visibleLinks = hasMore ? links.slice(0, maxVisible) : links

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowPopover(!showPopover)
  }

  const closePopover = () => {
    setShowPopover(false)
  }

  return (
    <div className={`relative flex items-center ${config.gap} flex-nowrap`}>
      {visibleLinks.map((link, index) => (
        <LinkIconButton key={`${link.url}-${index}`} link={link} size={size} />
      ))}
      {hasMore && (
        <>
          <button
            onClick={handleMoreClick}
            title={`Show all ${links.length} links`}
            className={`
              ${config.padding}
              inline-flex items-center justify-center
              rounded-md
              border border-[#404040]
              bg-[#252525]
              text-[#707070]
              hover:bg-[#353535]
              hover:border-[#505050]
              hover:text-white
              active:bg-[#404040]
              transition-all duration-150
              cursor-pointer
              shadow-sm
              flex-shrink-0
            `}
            data-testid="link-icon-more"
          >
            <MoreHorizontal width={config.iconSize} height={config.iconSize} />
          </button>
          {showPopover && (
            <>
              {/* Backdrop to close popover */}
              <div className="fixed inset-0 z-[100]" onClick={closePopover} />
              {/* Popover with all links in a single row */}
              <div className="absolute top-full left-0 mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-[101] p-2">
                <div className={`flex items-center ${config.gap} flex-nowrap`}>
                  {links.map((link, index) => (
                    <LinkIconButton
                      key={`popover-${link.url}-${index}`}
                      link={link}
                      size={size}
                      onLinkClick={closePopover}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default LinkIcons
