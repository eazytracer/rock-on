/**
 * Song link glyphs (Song Row · "Small tile, clear glyph"): one per category,
 * coloured by service where people already know the colour.
 */
import React from 'react'
import { AudioLines, Guitar, Play, Mic, Cloud, Link2 } from 'lucide-react'
import type { ReferenceLink } from '../../types'
import { linkCategory, type LinkCategory } from '../../domain/songs'

const LINK_GLYPH: Record<
  LinkCategory,
  { icon: React.ReactNode; tone: string; name: string }
> = {
  audio: { icon: <AudioLines />, tone: 'text-[#1DB954]', name: 'Audio' },
  tabs: { icon: <Guitar />, tone: 'text-[#E8B923]', name: 'Tabs' },
  video: {
    icon: <Play className="fill-current" />,
    tone: 'text-[#FF2D2D]',
    name: 'Video',
  },
  lyrics: { icon: <Mic />, tone: 'text-ink-2', name: 'Lyrics' },
  cloud: { icon: <Cloud />, tone: 'text-ink-2', name: 'Cloud file' },
  link: { icon: <Link2 />, tone: 'text-ink-2', name: 'Link' },
}

export function linkGlyph(link: Pick<ReferenceLink, 'icon'>) {
  return LINK_GLYPH[linkCategory(link)]
}
