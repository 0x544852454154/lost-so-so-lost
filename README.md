# lostboys (React + Vite)

1. `npm install`
2. `npm run extract -- path/to/your-original.html`
   (copies the CSS -> `src/styles.css` and the logo paths -> `src/logoPaths.js`, untouched)
3. `npm run dev`

Edit members / hall of fame / song in `src/data.js`.

## Site protection

Everything here is © lostboys, all rights reserved — see `LICENSE`.

`npm run build` runs `scripts/protect.js`, which:

- folds every lazy chunk into **one** bundle (no readable module structure)
- obfuscates it (`javascript-obfuscator`): no readable names or strings, base64
  string array, control-flow flattening, object keys transformed
- ships **no sourcemaps**, minified with terser
- appends an ownership stamp (`window.__LB_OWNER__`, `data-lb` on `<html>`)

Runtime side (`src/guard.js`, `src/Watermark.jsx`):

- visible `© lostboys · do not copy` credit bottom-right (always on the page),
  plus a `?` button with a clear “no copying, with or without credit” notice
- console ownership notice, re-printed when DevTools is opened
- `data-lb-copy="<host>"` on `<html>` when served from a domain not in
  `OWNER_HOSTS` (add your real domain there)

`npm run smoke` (after a build) checks the shipped bundle parses, is a single
file, boots its stamp, and that any edit changes its fingerprint.

**Honest limit:** HTML/CSS/JS served to a browser can always be viewed. This
makes copying slow, obvious and legally traceable — it does not make it
impossible. For real deterrence keep assets (fonts, logo SVG, song) on your own
origin with hotlink protection, and keep the visible credit on.
