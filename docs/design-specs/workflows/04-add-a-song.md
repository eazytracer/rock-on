# Workflow: Add a song

**Goal:** a new song is in the catalog with the details the band actually uses (tuning, length, links) in seconds, typed or pre-filled.

## Flow

1. **Start:**
   - **Add song** on Songs or from Home's quick actions, into the current context.
   - Or **Add to setlist** → new song, from inside a setlist.
2. **Type the title:**
   - Matching Spotify results appear quietly as suggestions ("Pre-fill from Spotify?").
   - Pick one to fill title, artist, album and duration, and to add a Spotify link.
   - Or just keep typing and fill it in by hand. Spotify is never forced or front-and-centre.
3. **Fill in what matters:**
   - **Tuning:** pick one, or create a new tuning right there.
   - **Duration** (m:ss).
   - Optionally key, BPM, tags.
4. **Add links:**
   - URL, label, and a type: Link / Tabs / Lyrics / Video / Audio / Cloud file.
   - The type is detected automatically for Spotify, YouTube, Drive, Dropbox and SoundCloud.
5. **Band only:** "Also add to My Songs" makes a linked copy.
6. **Save:** the song appears in the list, and bandmates get a gentle "Sarah added _Song_" banner.

## Must

- Only the title is required.
- Tuning picker:
  - Shows each tuning's colour and name.
  - Offers **New tuning**: instrument, string count, a note per string, name, colour.
- Key picker:
  - Fast, and covers minor keys.
  - The Circle of Fifths is preferred, but not required if a better touch design emerges.
- Links can be added, edited and removed inline.
- Notes are added after saving, from the song view: band notes (shared) and my notes (private), both Markdown.

## Must not

- Force or emphasise the Spotify search.
- Require fields beyond the title.
- Lose typed input if the Spotify lookup fails or is slow.

## Future

- [Future] Structured parts per song (Lead guitar, Harmony vocals…), only when casting is on.
- [Explore] Adding a **new version** of an existing song instead of a new song (`explorations/song-versions.md`).
