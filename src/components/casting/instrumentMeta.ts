import {
  MicVocal,
  Mic2,
  Guitar,
  Drum,
  Piano,
  Music,
  type LucideIcon,
} from 'lucide-react'
import { INSTRUMENT_COLOR, token } from '../../utils/tokens'

/**
 * Role key → instrument color + icon for the color spine on each part row.
 * Shared across cast surfaces (SongCastPanel list + EventCastGrid) so they
 * use the same visual vocabulary instead of redefining it.
 */
export const INSTRUMENT_META: Record<
  string,
  { color: string; Icon: LucideIcon }
> = {
  // v1 event instrument set (band-less events): guitar/bass/drums/vox/keys/other.
  vox: { color: INSTRUMENT_COLOR.vox, Icon: MicVocal },
  other: { color: token.ink4, Icon: Music },
  // Band role vocabulary (setlist casting still uses these).
  lead_vocals: { color: INSTRUMENT_COLOR.vox, Icon: MicVocal },
  backing_vocals: { color: INSTRUMENT_COLOR.bvox, Icon: Mic2 },
  guitar: { color: INSTRUMENT_COLOR.gtr, Icon: Guitar },
  bass: { color: INSTRUMENT_COLOR.bass, Icon: Guitar },
  drums: { color: INSTRUMENT_COLOR.drums, Icon: Drum },
  keys: { color: INSTRUMENT_COLOR.keys, Icon: Piano },
}

export const FALLBACK_INSTRUMENT = { color: token.ink4, Icon: Music }
