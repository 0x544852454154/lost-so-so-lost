# lostboys (React + Vite)

1. `npm install`
2. `npm run extract -- path/to/your-original.html`
   (copies the CSS -> `src/styles.css` and the logo paths -> `src/logoPaths.js`, untouched)
3. `npm run dev`

Edit members / hall of fame / song in `src/data.js`.

## Site protection

Everything here is © lostboys, all rights reserved — see `LICENSE`.

`npm run build` runs `scripts/protect.js`, which:

- **renames structural class / id names** to opaque 5-letter tokens
  (`.gm-card`, `.hof-modal`, `.fame-card` are gone). CSS selectors and the JSX /
  JS references are renamed together, so the page cannot end up with a token in
  the stylesheet and the old name in the DOM. Only selector positions are
  touched, so values like `var(--fg)`, `#fff` and `url(#lbShape)` stay intact.
  State classes the JS toggles (`light`, `open`, `is-on`, …) are kept readable
  — see `KEEP` in the plugin.
- splits the app into **3 chunk files** (vendor / app / loader) and obfuscates
  every one: base64 string array, control-flow flattening, object keys
  transformed (no readable names or strings anywhere)
- writes **no chunk list into `index.html`**: a small random-named loader
  imports the app and injects the stylesheet at runtime, so View Source shows
  almost nothing (no CSS link, no module names)
- ships **no sourcemaps**, minified with terser
- stamps every chunk with an ownership fingerprint (`window.__LB_*__`,
  `window.__LB_OWNER__`, `data-lb` on `<html>`)

Runtime side (`src/guard.js`, `src/Watermark.jsx`):

- visible `© lostboys · do not copy` credit bottom-right (always on the page),
  plus a `?` button with a clear “no copying, with or without credit” notice
- console ownership notice, re-printed when DevTools is opened
- `data-lb-copy="<host>"` on `<html>` when served from a domain not in
  `OWNER_HOSTS` (add your real domain there)

`npm run smoke` (after a build) asserts all of the above on the real output:
chunks parse, no sourcemaps, no chunk list or CSS link in the HTML, source names
and class tokens gone, the loader injects the stylesheet and stamps the page.
`node scripts/crosscheck.mjs` compares the built CSS against `src/styles.css`
to prove no selector was lost in the rename.

**Honest limit:** HTML/CSS/JS served to a browser can always be viewed. This
makes copying slow, obvious and legally traceable — it does not make it
impossible. For real deterrence keep assets (fonts, logo SVG, song) on your own
origin with hotlink protection, and keep the visible credit on.

## Deploy

`dist/` is intentionally git-ignored. Vercel builds the site from source
(`npm run build`) on every push to `main`; do not commit the generated bundle.
If a deploy ever looks unstyled, run `npm run build && npm run smoke &&
node scripts/crosscheck.mjs` locally — those checks catch a CSS/JS class-name
mismatch before it ships.
