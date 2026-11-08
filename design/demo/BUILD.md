# Demo build

- `Rock On Mobile.html` shows the locked phone designs in `screens/` and links them. Routing and the checklist live in `mobile.js`.
- `Rock On Desktop.html` is the desktop app (`desktop*.js`, `desktop.css`).
- `Jam Night.html` is the working jam (`jam-night.*`).
- All three use the kit in `../source/kit/`.

## screens-bundle.js

`screens-bundle.js` holds every screen page with the kit inlined. With it, the mobile demo fills each frame
with `srcdoc`, which works when opened from disk (`file://`). Without it, the demo falls back to `src`, which
needs a local server.

After changing any screen or kit file, regenerate it:

```bash
python3 design/tools/build-screens-bundle.py
```

Never edit the bundle by hand.

The single-file `dist/` export from the design tool isn't kept in the repo. The pages here open as they are.
