/**
 * URL detection utility for external song reference links.
 *
 * Detects the type of link (Spotify, YouTube, tabs, lyrics, etc.)
 * from a URL and provides display information.
 */

export type LinkType =
  | 'spotify'
  | 'youtube'
  | 'tabs'
  | 'lyrics'
  | 'drive'
  | 'dropbox'
  | 'soundcloud'
  | 'other'

export interface LinkTypeInfo {
  type: LinkType
  name: string
  iconName: string // Lucide icon name
  color: string // Tailwind color class
}

// Link type configuration with brand colors
const linkTypeConfig: Record<LinkType, Omit<LinkTypeInfo, 'type'>> = {
  spotify: {
    name: 'Spotify',
    iconName: 'Music2',
    color: 'text-[#1DB954]',
  },
  youtube: {
    name: 'YouTube',
    iconName: 'Play',
    color: 'text-[#FF0000]',
  },
  tabs: {
    name: 'Tabs',
    iconName: 'Guitar',
    color: 'text-[#FFC600]',
  },
  lyrics: {
    name: 'Lyrics',
    iconName: 'FileText',
    color: 'text-[#9B59B6]',
  },
  drive: {
    name: 'Google Drive',
    iconName: 'HardDrive',
    color: 'text-[#4285F4]',
  },
  dropbox: {
    name: 'Dropbox',
    iconName: 'Cloud',
    color: 'text-[#0061FF]',
  },
  soundcloud: {
    name: 'SoundCloud',
    iconName: 'CloudRain',
    color: 'text-[#FF5500]',
  },
  other: {
    name: 'Link',
    iconName: 'ExternalLink',
    color: 'text-[#a0a0a0]',
  },
}

/**
 * Detects the type of link from a URL.
 *
 * @param url - The URL to analyze
 * @returns LinkTypeInfo object with type, name, icon, and color
 *
 * @example
 * detectLinkType('https://open.spotify.com/track/abc')
 * // Returns: { type: 'spotify', name: 'Spotify', iconName: 'Music2', color: 'text-[#1DB954]' }
 */
export function detectLinkType(url: string): LinkTypeInfo {
  if (!url) {
    return getLinkTypeInfo('other')
  }

  const urlLower = url.toLowerCase()

  // Spotify: spotify.com, open.spotify.com, spoti.fi
  if (
    urlLower.includes('spotify.com') ||
    urlLower.includes('open.spotify.com') ||
    urlLower.includes('spoti.fi')
  ) {
    return getLinkTypeInfo('spotify')
  }

  // YouTube: youtube.com, youtu.be, m.youtube.com, music.youtube.com
  if (
    urlLower.includes('youtube.com') ||
    urlLower.includes('youtu.be') ||
    urlLower.includes('m.youtube.com') ||
    urlLower.includes('music.youtube.com')
  ) {
    return getLinkTypeInfo('youtube')
  }

  // Tabs: ultimate-guitar.com, songsterr.com, guitartabs.cc, .gp[345x] files
  if (
    urlLower.includes('ultimate-guitar.com') ||
    urlLower.includes('tabs.ultimate-guitar.com') ||
    urlLower.includes('songsterr.com') ||
    urlLower.includes('guitartabs.cc') ||
    /\.gp[345x]?$/i.test(url)
  ) {
    return getLinkTypeInfo('tabs')
  }

  // Lyrics: genius.com, azlyrics.com, lyrics.com, metrolyrics.com, musixmatch.com
  if (
    urlLower.includes('genius.com') ||
    urlLower.includes('azlyrics.com') ||
    urlLower.includes('lyrics.com') ||
    urlLower.includes('metrolyrics.com') ||
    urlLower.includes('musixmatch.com')
  ) {
    return getLinkTypeInfo('lyrics')
  }

  // Google Drive: drive.google.com, docs.google.com
  if (
    urlLower.includes('drive.google.com') ||
    urlLower.includes('docs.google.com')
  ) {
    return getLinkTypeInfo('drive')
  }

  // Dropbox: dropbox.com, dropboxusercontent.com
  if (
    urlLower.includes('dropbox.com') ||
    urlLower.includes('dropboxusercontent.com')
  ) {
    return getLinkTypeInfo('dropbox')
  }

  // SoundCloud: soundcloud.com
  if (urlLower.includes('soundcloud.com')) {
    return getLinkTypeInfo('soundcloud')
  }

  // Default to other
  return getLinkTypeInfo('other')
}

/**
 * Gets the display information for a link type.
 *
 * @param type - The LinkType to get info for
 * @returns LinkTypeInfo object with type, name, icon, and color
 *
 * @example
 * getLinkTypeInfo('spotify')
 * // Returns: { type: 'spotify', name: 'Spotify', iconName: 'Music2', color: 'text-[#1DB954]' }
 */
export function getLinkTypeInfo(type: LinkType): LinkTypeInfo {
  const config = linkTypeConfig[type] || linkTypeConfig.other
  return {
    type,
    ...config,
  }
}

/**
 * All available link types.
 */
export const LINK_TYPES: LinkType[] = [
  'spotify',
  'youtube',
  'tabs',
  'lyrics',
  'drive',
  'dropbox',
  'soundcloud',
  'other',
]

/**
 * Get all link type infos for display in dropdowns/menus.
 */
export function getAllLinkTypeInfos(): LinkTypeInfo[] {
  return LINK_TYPES.map(getLinkTypeInfo)
}
