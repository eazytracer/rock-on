# 01 · Foundations: tokens, type, theme, context, tuning colour

The app already routes almost every colour through channel variables in `src/index.css` and the Tailwind
mappings in `tailwind.config.js` (the mobile-redesign-port work). That makes the base re-skin mostly a
token edit. Source of truth for every value below: `source/kit/rock.css` and `source/Foundations.html` in
the design project.

## 1. Surfaces and ink

The kit names surfaces by role; the app names them by step. Today the app paints the page with `bg-1`
(`background`, `surface`) and cards with `bg-2`, so map one step up:

| Kit token | Dark | Light | App variable (`src/index.css`) |
|---|---|---|---|
| `--bg` page | `#0c0b0a` | `#f7f3ee` | `--bg-1-rgb` (page) |
| `--s1` card / group | `#151311` | `#fffdfa` | `--bg-2-rgb` |
| `--s2` control fill, chips, segmented | `#1d1a17` | `#ebe4dc` | `--bg-3-rgb` |
| `--s3` raised fill, avatars | `#26221e` | `#ffffff` | `--bg-4-rgb` |
| (deeper than page: stage, TV) | `#080706` | `#efe9e2` | `--bg-0-rgb` |
| `--line` borders | `#2a2522` | `#ddd4ca` | `--border-1-rgb` |
| `--div` row dividers | `#221f1b` | `#ece6de` | `--border-2-rgb` (re-purpose; today it's a stronger border) |
| `--tx` primary text | `#f4efe9` | `#1a1512` | `--ink-1-rgb` |
| `--tx2` secondary | `#cfc6bd` | `#3d352f` | `--ink-2-rgb` |
| `--mu` muted (labels, meta) | `#a69c92` | `#6b6158` | `--ink-3-rgb` |
| `--mu2` | `#8a8178` | `#7a6f65` | `--ink-4-rgb` |
| `--dim` | `#6e655d` | `#a39788` | `--ink-5-rgb` |

Note the palette is **warm**: every neutral leans brown. Leaving one cold grey (`#1a1a1a`, `#2a2a2a`) in a
component is the most visible way to break it, so grep for raw hex after the swap (`npm run lint` already
flags some; add `#1[0-9a-f]{5}` greys to the check).

Check before shipping: `--border-2` is used today as the stronger of two borders. Audit its ~call sites
(`grep -rn "border-2" src`) before re-pointing it at the divider value.

## 2. Accent, semantic and type colours

| Kit | Dark | Light | App |
|---|---|---|---|
| `--acc` band accent | `#ff7a1a` | `#ff7a1a` | `--accent-rgb` (already 255 122 26) |
| `--onacc` text on accent | `#1a0c02` | `#1a0c02` | **new** `--on-accent-rgb` |
| `--accink` accent as text / icon | `#ff7a1a` | `#b84d00` | **new** `--accent-ink-rgb` (light needs a darker ink for 4.5:1) |
| `--chord` chord names | `#ffb070` | `#b84d00` | **new** `--chord-rgb` |
| `--ok` | `#3ec986` | `#1c8050` | `--success-rgb` |
| `--warn` | `#ffd166` | `#9a6200` | `--warn-rgb` (today 255 182 72) |
| `--danger` | `#ff5d5d` | `#cc3333` | `--danger-rgb` |
| `--dangerfill` destructive button | `#cc3333` | `#cc3333` | **new** `--danger-fill-rgb` |
| `--ty-show` | `#ff9a4d` | `#b84d00` | **new** `--type-show-rgb` (replace `SHOW_TONE` in `utils/tokens.ts`) |
| `--ty-prac` | `#6cb8ff` | `#1f5fae` | **new** `--type-practice-rgb` (replace `PRACTICE_TONE`) |
| `--ty-evt` jam | `#c58bff` | `#7a3cc0` | **new** `--type-jam-rgb` |

Event types are always **icon + word + colour** (ticket = SHOW, calendar = PRACTICE, party popper = JAM).
The colour goes on the icon and label only, never the date block. Never colour alone.

## 3. Context accent (Personal vs band)

GitHub-style contexts are the backbone (DECISIONS → Context switcher). The accent swaps with the context:

```css
/* src/index.css */
[data-ctx='personal'] {
  --accent-rgb: 124 134 245;      /* #7c86f5 indigo */
  --on-accent-rgb: 11 13 43;      /* #0b0d2b */
  --accent-ink-rgb: 154 162 255;  /* #9aa2ff */
}
[data-theme='light'][data-ctx='personal'] { --accent-ink-rgb: 63 73 201; } /* #3f49c9 */
```

Set `data-ctx` on the layout root from whatever `ContextSwitcher` already reads (the current band id vs the
personal context). Because every accent utility resolves through `--accent-rgb`, nothing else changes.

## 4. Light theme

The app is dark-only today. Add a `[data-theme='light']` block that overrides every channel variable with the
Light column above, and a small theme provider:

- `src/contexts/ThemeContext.tsx`: `theme: 'system' | 'light' | 'dark'`, resolves `system` with
  `matchMedia('(prefers-color-scheme: light)')`, writes `data-theme` on `<html>`.
- Stored per user (synced): see `user_preferences` in [04-data.md](04-data.md). Until that lands, localStorage is fine.
- Settings → Appearance: System / Light / Dark. More (mobile) and the sidebar footer (desktop) get a sun / moon toggle.
- Stage screens (chart reader, practice session, jam host, bar TV) suggest dark but don't force it.
- `color-scheme` follows the theme so native scrollbars and date inputs match (we don't use native pickers, but form autofill does).

## 5. Type

Swap Geist / JetBrains Mono for the three locked families (all on Google Fonts):

```html
<!-- index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800;900&family=Atkinson+Hyperlegible+Next:wght@400;500;600;700&family=Martian+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

```js
// tailwind.config.js → theme.extend.fontFamily
display: ['"Big Shoulders Display"', 'sans-serif'],      // titles: 800–900, UPPERCASE, line-height .9
sans: ['"Atkinson Hyperlegible Next"', 'system-ui', 'sans-serif'], // all UI text
mono: ['"Martian Mono"', 'ui-monospace', 'monospace'],   // meta, labels, times, keys, codes
```

Scale used across the demos: display H1 50 px (mobile) / 46 px (desktop header), H2 36–40, card titles 30–34;
UI body 16 (never under 13), row titles 15–16, captions 12.5; mono labels 10.5 px, `letter-spacing: .12em`, uppercase.
For the PWA, self-host the three families once the screens settle (offline at gigs).

## 6. Shape, space, motion

- Spacing: 4, 8, 12, 16, 20, 24, 32, 40, 56.
- Radii: 6 (xs), 12 (sm), 16 (fields, banners), 20 (groups, cards), 28 (sheets), pill. Buttons are pills (44 px tall, 52 lg, 60 xl).
- Groups: one surface per section with 1 px dividers between rows, a mono label above (`r-grp` + `r-gl`).
- Motion: 100 / 200 / 280 / 400 ms, `cubic-bezier(.2,0,0,1)`; Reduce Motion turns slides into fades.
- Press feedback (kit-wide): a single 320 ms accent fade on the pressed control, no `:active` flash on nodes that re-render.
- Content shorter than the viewport is centred vertically (editors, empty states); lists stay top-aligned.

## 7. Tuning colour spine

Replace "Palette A" in `src/utils/tunings.ts` with the pitch-ordered OKLCH spine from `source/kit/rock.js`
(`SPINE`, `okhex`, `customTuning`): low tunings are deep magenta, Standard is bright lime, and each tuning has
a dark and a light value. It skips brand orange and danger red.

- Port `okhex` (OKLCH → sRGB hex with gamut clipping) and `SPINE` verbatim; map ids:
  `standard→std`, `half-step-down→half`, `whole-step-down→whole`, `drop-d→dd`, `drop-db→ddb`, `drop-c→dc`,
  `drop-b→db`, `open-g→og`, `open-d→od`, `dadgad→dad`, plus **C Standard** (`cstd`, the lowest built-in).
- Pills read the way players say it: `E STD`, `E♭ STD`, `D DROP`, `C STD`; 7-string and 5-string bass add a
  superscript string count (`B STD⁷`, `A DROP⁷`). Colour **and** name, always.
- Custom tunings (the `tunings` table already has `color`): default colour = `customTuning(pitches)` from the
  MIDI sum; the user can override with one of 12 picks.
- The pill: tinted fill `color-mix(in oklch, <tuning> 16%, var(--s1))`, label in the tuning colour, mono 11.5 px bold.

## 8. Icons

The kit's icons are inline SVG paths on a 24 px grid, 1.8 stroke, round caps (`ICONS` in `source/kit/rock.js`).
The app uses lucide-react, which matches that grid. Keep lucide and only add the custom glyphs it lacks:
**tabs** (staff + nut), **chordbox**, **metro** (metronome), **party** (jam), **hand** (raise a hand). Copy their paths into
`src/components/common/icons/` as small components.
