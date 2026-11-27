# Platform notes · web vs native

What the design assumes from the device, and how it differs between the web app (React, now) and the
iOS / Android apps (Flutter, next). Both call the same server operations (`OPERATIONS.md`). Nothing here
changes an operation. These notes cover the client only.

**Rule for every row:** the web app ships the behaviour in the Web column. Where web can't do it, the design
already shows the fallback. Native adds what the Native column says, at Flutter planning.

## Stage screens (chart reader, practice session, jam host)

| Capability | Where the design uses it | Web | Native (iOS / Android) |
|---|---|---|---|
| **Keep the screen awake** | Chart reader, practice session, jam host console, bar TV, counter iPad | Screen Wake Lock API (`navigator.wakeLock.request('screen')`). Release it on leave and take it again on `visibilitychange`. Not available on every browser: there is no fallback, and the screen may dim | Platform wake lock (`wakelock_plus`) for as long as the screen is open |
| **Page-turn pedals** (Bluetooth: AirTurn, PageFlip and similar) | Chart reader Back / Next, practice session Prev / Next | Pedals pair as a keyboard. Listen for ← → ↑ ↓, PageUp / PageDown and Space. Ignore keys while a text field has focus | Same keys arrive as hardware key events. Some pedals have a "media" mode (volume keys): treat volume up / down as Next / Back on stage screens only, as an opt-in in Settings |
| **Tap zones** | Chart reader page turns (zones as drawn in Song Chart) | Pointer events | Same. Turn edge swipe-back **off** on the chart reader so a page turn never leaves the chart |
| **Landscape, two columns** | Chart reader | CSS media query on orientation and width | Same layout. Allow rotation on the chart reader. Phones stay portrait elsewhere |
| **Full screen** | Practice session and chart reader on desktop; bar TV | Fullscreen API on a button. Never automatic | Immersive mode on the TV and kiosk screens only |
| **Kiosk (counter iPad)** | Jam Venue | A full-screen page running under the host's signed-in session. Exit is behind a host action | Same, plus Guided Access (iOS) or screen pinning (Android), which the host turns on. Explain how in the kiosk setup sheet |

## Audio

| Capability | Where the design uses it | Web | Native |
|---|---|---|---|
| **Microphone (tuner)** | Tools → Tuner, Tune buttons on retune lines and in practice | `getUserMedia({audio:{echoCancellation:false, noiseSuppression:false, autoGainControl:false}})`. Pitch detection (YIN or autocorrelation) runs in an `AudioWorklet`. Ask on first use from a button press; if refused, the tuner shows "Microphone is off · Turn on in browser settings", and Play reference notes still works | Platform permission prompt with the reason string "Rock On listens to tune your instrument. Nothing is recorded." Run the detector on the native audio thread. Same refused state, linking to the app's settings |
| **Metronome clock** | Tools → Metronome, count-in | Schedule every click on the `AudioContext` clock with about 1 s of lookahead, re-filled every 25 ms. Drive visuals from `requestAnimationFrame` and read `audioContext.currentTime`. **Never** time clicks with `setTimeout` or `setInterval`. Create or resume the context from a user tap (autoplay rules) | Native audio engine with sample-accurate scheduling. Same lookahead model. Visuals follow the audio clock, never the reverse |
| **Background audio** | Metronome while the screen is locked (practice) | Not dependable: browsers suspend audio in background tabs, and iOS Safari stops it on lock. The design promises nothing here | Keep the metronome running when the screen locks or the app goes to the background (iOS audio background mode, Android foreground service). Stop on pause |
| **Silent switch / audio session** | Synth (pluck, chord, starting note), metronome | Plays through the media channel. iOS Safari may stay silent with the ring switch on silent. No fix | Playback audio category, so sound plays with the ring switch on silent |
| **In-app synth** | Starting note, chord viewer Play, tuner reference notes | Web Audio: Karplus-Strong pluck, sine note (`demo/desktop-tools.js` has a reference) | Same algorithm in the native engine. No sample files needed |

## Sharing, codes and links

| Capability | Where the design uses it | Web | Native |
|---|---|---|---|
| **Share sheet** | Band invite, friend code, jam code / link, Save tonight as a setlist | `navigator.share({title, text, url})` where it exists (mobile browsers). Otherwise Copy link, with a "Copied" toast | Platform share sheet |
| **Copy** | Every code and link | `navigator.clipboard.writeText` from a tap | Platform clipboard |
| **Show a QR code** | Band invite, friend code, jam access card, table tent, bar TV | Drawn in the page from the link. No network | Same |
| **Scan a QR code** | Join a band, Add a friend, Got a jam code? | Not drawn as an in-app scanner on web. People scan with their phone camera, which opens the link. Typing the code is always there | In-app scanner (camera permission: "Scan a Rock On code") next to "Type the code" |
| **Links that open the app** | Invite, friend and jam links | One https link per code opens the web app (paths are for the API-conventions step; e.g. `/join/<code>`, `/jam/<code>`). Not signed in: the jam opens the web-guest join; the band and friend links go to sign in, then back to the preview | Universal Links (iOS) and App Links (Android) on the same URLs open the app straight to the preview. No app installed: the web page loads |
| **Printable table tent** | Jam access card | Print stylesheet (A6 / Letter half). `window.print()` from a button | Platform print, or share as PDF |

## Notifications and feedback

| Capability | Where the design uses it | Web | Native |
|---|---|---|---|
| **Push** | Settings → Push (master, per type, per-band mute, quiet hours) | Preferences are stored now. **Delivery is a later phase** (05-plan, Not in scope). If web push comes, it needs a service worker, a permission request from a button, and is limited on iOS (home-screen web apps only) | APNs / FCM via the same preferences. Ask for permission after the user's first band or jam, never at launch. Quiet hours are enforced on the server |
| **In-app live updates** | Activity dot, jam queue, hands, pitches, Ask the room | Supabase realtime (`audit_log` and the jam tables) | Same channel |
| **Haptics** | Hold-to-move in lists, metronome accent (optional), raising a hand, calling up a song | `navigator.vibrate` on Android Chrome only. iOS Safari has none. Never needed to understand anything | Light impact on hold and drop, selection tick on the steppers, success on hand raised and on call up. A Settings switch turns haptics off |
| **Badges** | Bell dot | Dot in the app | Optional app-icon badge, with push |

## Input

| Capability | Web | Native |
|---|---|---|
| **Row actions** | Desktop: hover actions, right-click menu, keyboard. Mobile web: swipe left (Hide, Add to set) and long-press for the menu, as drawn | Swipe and long-press, as drawn. Long-press also lifts the row for dragging |
| **Drag to reorder** | Grip on desktop; 300 ms hold on touch; the Move sheet is the accessible path everywhere | Same, with haptics on lift and drop |
| **Keyboard shortcuts** | ⌘K / Ctrl K search; ← → / PgUp PgDn on stage screens; N for notes in the practice session | Hardware keyboards on tablets get the same keys |
| **Hover** | Desktop only. Nothing may depend on hover alone | None |

## Look and layout

| Capability | Web | Native |
|---|---|---|
| **Theme** | System / light / dark (`prefers-color-scheme` + `user_preferences.theme`) | Same three choices, from the platform theme |
| **Safe areas** | `env(safe-area-inset-*)` on the header, bottom nav, docked buttons and stage controls | Platform safe-area insets |
| **Fonts** | Self-host the three families in production rather than Google Fonts (the demos load them from Google) | Bundle them in the app |
| **Back** | Browser back. On stage screens, back asks nothing and loses nothing (everything saves as you go) | Android back button and iOS edge swipe, except the chart reader (see above) |
| **Status bar** | Theme colour meta tag follows the theme | Status bar style follows the theme. Hidden on the TV and kiosk screens |

## Offline (Part A · 3)

**Web:** online-only. Reads always go to the database, with TanStack Query as the in-memory cache and ordinary
HTTP caching for static files. With no connection, the one offline banner shows and edits are blocked
("You're offline. Changes need a connection."). There is no local database, sync queue or per-row sync icon.

**Native:** decided at Flutter planning. The design's earlier "works offline" lines are the candidates to
consider there: the chart reader, practice session, next show and next practice, read-only. They're listed here so
the question isn't lost. The server contract doesn't depend on the answer, since every operation already carries
`version` for conflict checks.

## Already decided elsewhere, not platform-specific

- Targets: 44 px minimum, 64 px on stage screens. Body text 16, never under 13 (01-foundations).
- System dialogs, native scrollbars and `console.*` are banned in the web app (CLAUDE.md). The Flutter equivalents are the app's own sheet, dialog and toast components.
