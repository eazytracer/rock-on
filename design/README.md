# Rock On redesign · design project

The locked redesign (Nov 2026) as plain files. This is the reference the build works from. The guides in
`docs/redesign/` explain how to apply it to this app.

## Open it

Double-click any `.html` file. Each one opens straight from disk, with no server and no sign-in. They need an
internet connection only for Google Fonts.

| File | What it is |
|---|---|
| `demo/Rock On Mobile.html` | Every phone screen, linked, with a checklist down the side that jumps to each one |
| `demo/Rock On Desktop.html` | The desktop app at 1024 px and up, fully clickable |
| `demo/Jam Night.html` | A working jam: host, guest, bar TV and counter iPad. **Open a guest window** syncs across windows; **Simulate the room** fills it with people |
| `demo/Song Page.html` | **Proposal (Nov 7), not decided:** a song opened as a full page, edited in place, with Back named after where you came from. Answers `docs/redesign/09` |
| `demo/screens/*.html` | The locked phone screens, one page per area. `Final Pass.html` holds the Nov 7 additions ("FP n" in the guides) |
| `source/Foundations.html`, `source/Components.html` | Tokens, type, colour, tunings, and the component catalog |
| `source/index.html` | Index of the source pages |

Jam Night syncs windows with `BroadcastChannel`. Some browsers don't share it between `file://` windows. If the
guest window doesn't follow the host, serve the folder instead:

```bash
cd design && python3 -m http.server 8080   # then open http://localhost:8080/demo/Jam%20Night.html
```

## What wins when two files disagree

1. `source/DECISIONS.md`: every rule, dated, with its UX law. The last section ("Nov 7 2026 · build handoff, Part A") holds the decisions made with Eric for the build.
2. `OPERATIONS.md`: the server operations, which form the API contract for web and Flutter.
3. `PLATFORM-NOTES.md`: what differs between web and the native apps.
4. `source/PARITY.md`: mobile vs desktop, and the deliberate exceptions.
5. `source/CHART-DATA-MODEL.md` and `design_handoff_rock_on_refresh/DATA-IMPLICATIONS.md`: what the design needs stored. `docs/redesign/04-data.md` diffs this against the schema.
6. The demos.

The demos are reference, not code to paste. They use string templates and inline mock data.

## Kit

`source/kit/` is shared by every page:

- `rock.css`: tokens, with the `r-` prefix.
- `rock.js`:
  - `Rock` builders.
  - `T`: tunings, with the decided colours in `PALETTE`. `SPINE`, `okhex` and `customTuning` stay for ordering and for the swatch picker.
  - `ICONS`.
- `pickers.css` and `pickers.js`: the date, time, key and tuning pickers.
- `jam.css` and `jam.js`: the jam screens' pieces.
- `page.css`, `page.js` and `Template.html`: the frame the screen pages are drawn in.

## After changing a screen or the kit

The mobile demo loads each screen page into a frame. To work from disk it uses a bundle of every screen with the
kit inlined. Regenerate the bundle after any edit to `demo/screens/` or `source/kit/`:

```bash
python3 design/tools/build-screens-bundle.py
```

Commit the regenerated `demo/screens-bundle.js` with the change.
