import { describe, it, expect } from 'vitest'
import {
  detectLinkType,
  getLinkTypeInfo,
  LinkType,
  LinkTypeInfo,
} from '../../../src/utils/linkDetection'

describe('linkDetection', () => {
  describe('detectLinkType', () => {
    describe('Spotify URLs', () => {
      it('should detect open.spotify.com track URLs', () => {
        const result = detectLinkType(
          'https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8'
        )
        expect(result.type).toBe('spotify')
        expect(result.name).toBe('Spotify')
      })

      it('should detect open.spotify.com album URLs', () => {
        const result = detectLinkType(
          'https://open.spotify.com/album/4LH4d3cOWNNsVw41Gqt2kv'
        )
        expect(result.type).toBe('spotify')
      })

      it('should detect spotify.com URLs', () => {
        const result = detectLinkType('https://spotify.com/track/abc')
        expect(result.type).toBe('spotify')
      })

      it('should detect spoti.fi short URLs', () => {
        const result = detectLinkType('https://spoti.fi/3xyz123')
        expect(result.type).toBe('spotify')
      })

      it('should be case insensitive', () => {
        const result = detectLinkType('https://OPEN.SPOTIFY.COM/track/abc')
        expect(result.type).toBe('spotify')
      })
    })

    describe('YouTube URLs', () => {
      it('should detect youtube.com watch URLs', () => {
        const result = detectLinkType(
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        )
        expect(result.type).toBe('youtube')
        expect(result.name).toBe('YouTube')
      })

      it('should detect youtu.be short URLs', () => {
        const result = detectLinkType('https://youtu.be/dQw4w9WgXcQ')
        expect(result.type).toBe('youtube')
      })

      it('should detect m.youtube.com mobile URLs', () => {
        const result = detectLinkType('https://m.youtube.com/watch?v=abc')
        expect(result.type).toBe('youtube')
      })

      it('should detect YouTube Music URLs', () => {
        const result = detectLinkType('https://music.youtube.com/watch?v=abc')
        expect(result.type).toBe('youtube')
      })
    })

    describe('Tabs URLs', () => {
      it('should detect ultimate-guitar.com URLs', () => {
        const result = detectLinkType(
          'https://tabs.ultimate-guitar.com/tab/smash-mouth/all-star-chords-2033'
        )
        expect(result.type).toBe('tabs')
        expect(result.name).toBe('Tabs')
      })

      it('should detect songsterr.com URLs', () => {
        const result = detectLinkType(
          'https://www.songsterr.com/a/wsa/smash-mouth-all-star-tab-s27'
        )
        expect(result.type).toBe('tabs')
      })

      it('should detect Guitar Pro files (.gp3)', () => {
        const result = detectLinkType('https://example.com/songs/all-star.gp3')
        expect(result.type).toBe('tabs')
      })

      it('should detect Guitar Pro files (.gp4)', () => {
        const result = detectLinkType('https://example.com/songs/all-star.gp4')
        expect(result.type).toBe('tabs')
      })

      it('should detect Guitar Pro files (.gp5)', () => {
        const result = detectLinkType('https://example.com/songs/all-star.gp5')
        expect(result.type).toBe('tabs')
      })

      it('should detect Guitar Pro files (.gpx)', () => {
        const result = detectLinkType('https://example.com/songs/all-star.gpx')
        expect(result.type).toBe('tabs')
      })

      it('should detect guitartabs.cc URLs', () => {
        const result = detectLinkType(
          'https://www.guitartabs.cc/tabs/s/smash_mouth/all_star.html'
        )
        expect(result.type).toBe('tabs')
      })
    })

    describe('Lyrics URLs', () => {
      it('should detect genius.com URLs', () => {
        const result = detectLinkType(
          'https://genius.com/Smash-mouth-all-star-lyrics'
        )
        expect(result.type).toBe('lyrics')
        expect(result.name).toBe('Lyrics')
      })

      it('should detect azlyrics.com URLs', () => {
        const result = detectLinkType(
          'https://www.azlyrics.com/lyrics/smashmouth/allstar.html'
        )
        expect(result.type).toBe('lyrics')
      })

      it('should detect lyrics.com URLs', () => {
        const result = detectLinkType(
          'https://www.lyrics.com/lyric/1234567/All+Star'
        )
        expect(result.type).toBe('lyrics')
      })

      it('should detect metrolyrics.com URLs', () => {
        const result = detectLinkType(
          'https://www.metrolyrics.com/all-star-lyrics-smash-mouth.html'
        )
        expect(result.type).toBe('lyrics')
      })

      it('should detect musixmatch.com URLs', () => {
        const result = detectLinkType(
          'https://www.musixmatch.com/lyrics/Smash-Mouth/All-Star'
        )
        expect(result.type).toBe('lyrics')
      })
    })

    describe('Cloud Storage URLs', () => {
      it('should detect Google Drive URLs', () => {
        const result = detectLinkType('https://drive.google.com/file/d/abc123')
        expect(result.type).toBe('drive')
        expect(result.name).toBe('Google Drive')
      })

      it('should detect Google Docs URLs', () => {
        const result = detectLinkType(
          'https://docs.google.com/document/d/abc123'
        )
        expect(result.type).toBe('drive')
      })

      it('should detect Dropbox URLs', () => {
        const result = detectLinkType(
          'https://www.dropbox.com/s/abc123/song.mp3'
        )
        expect(result.type).toBe('dropbox')
        expect(result.name).toBe('Dropbox')
      })

      it('should detect Dropbox shared content URLs', () => {
        const result = detectLinkType(
          'https://dl.dropboxusercontent.com/s/abc123/song.mp3'
        )
        expect(result.type).toBe('dropbox')
      })

      it('should detect SoundCloud URLs', () => {
        const result = detectLinkType('https://soundcloud.com/artist/track')
        expect(result.type).toBe('soundcloud')
        expect(result.name).toBe('SoundCloud')
      })
    })

    describe('Other URLs', () => {
      it('should return "other" for unknown URLs', () => {
        const result = detectLinkType('https://example.com/some-page')
        expect(result.type).toBe('other')
        expect(result.name).toBe('Link')
      })

      it('should return "other" for random audio files', () => {
        const result = detectLinkType('https://example.com/song.mp3')
        expect(result.type).toBe('other')
      })
    })

    describe('Edge cases', () => {
      it('should handle URLs with query parameters', () => {
        const result = detectLinkType(
          'https://open.spotify.com/track/abc?si=123&utm_source=copy-link'
        )
        expect(result.type).toBe('spotify')
      })

      it('should handle URLs with fragments', () => {
        const result = detectLinkType(
          'https://www.youtube.com/watch?v=abc#t=120'
        )
        expect(result.type).toBe('youtube')
      })

      it('should handle HTTP URLs (non-HTTPS)', () => {
        const result = detectLinkType('http://www.youtube.com/watch?v=abc')
        expect(result.type).toBe('youtube')
      })

      it('should handle URLs without www', () => {
        const result = detectLinkType('https://youtube.com/watch?v=abc')
        expect(result.type).toBe('youtube')
      })

      it('should handle empty string', () => {
        const result = detectLinkType('')
        expect(result.type).toBe('other')
      })

      it('should handle malformed URLs gracefully', () => {
        const result = detectLinkType('not-a-valid-url')
        expect(result.type).toBe('other')
      })
    })
  })

  describe('getLinkTypeInfo', () => {
    it('should return info for spotify type', () => {
      const info = getLinkTypeInfo('spotify')
      expect(info.type).toBe('spotify')
      expect(info.name).toBe('Spotify')
      expect(info.iconName).toBeDefined()
      expect(info.color).toBeDefined()
    })

    it('should return info for youtube type', () => {
      const info = getLinkTypeInfo('youtube')
      expect(info.type).toBe('youtube')
      expect(info.name).toBe('YouTube')
      expect(info.iconName).toBeDefined()
      expect(info.color).toBeDefined()
    })

    it('should return info for tabs type', () => {
      const info = getLinkTypeInfo('tabs')
      expect(info.type).toBe('tabs')
      expect(info.name).toBe('Tabs')
      expect(info.iconName).toBeDefined()
      expect(info.color).toBeDefined()
    })

    it('should return info for lyrics type', () => {
      const info = getLinkTypeInfo('lyrics')
      expect(info.type).toBe('lyrics')
      expect(info.name).toBe('Lyrics')
      expect(info.iconName).toBeDefined()
      expect(info.color).toBeDefined()
    })

    it('should return info for other type', () => {
      const info = getLinkTypeInfo('other')
      expect(info.type).toBe('other')
      expect(info.name).toBe('Link')
      expect(info.iconName).toBeDefined()
      expect(info.color).toBeDefined()
    })

    it('should have unique colors for brand types', () => {
      const spotify = getLinkTypeInfo('spotify')
      const youtube = getLinkTypeInfo('youtube')
      const tabs = getLinkTypeInfo('tabs')

      // Spotify should have its brand green
      expect(spotify.color).toContain('#1DB954')

      // YouTube should have its brand red
      expect(youtube.color).toContain('#FF0000')
    })
  })

  describe('type exports', () => {
    it('should export LinkType type', () => {
      // This test ensures the type is exported and usable
      const types: LinkType[] = [
        'spotify',
        'youtube',
        'tabs',
        'lyrics',
        'drive',
        'dropbox',
        'soundcloud',
        'other',
      ]
      expect(types).toHaveLength(8)
    })

    it('should export LinkTypeInfo interface', () => {
      // This test ensures the interface is exported and usable
      const info: LinkTypeInfo = {
        type: 'spotify',
        name: 'Spotify',
        iconName: 'Music2',
        color: 'text-[#1DB954]',
      }
      expect(info.type).toBe('spotify')
    })
  })
})
