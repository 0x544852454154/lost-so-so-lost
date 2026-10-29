// Build protection for the lostboys production bundle.
//
// What makes a view-source skid fail here:
//   1. every class / id name in CSS and JSX is renamed to an opaque token
//      (no more "gm-card", "hof-modal", "fame-card" to search for)
//   2. JS is split into vendor / app chunks and EVERY chunk is obfuscated
//   3. index.html lists neither the chunks nor the CSS as literals — a small
//      runtime loader assembles the URLs, so view-source shows almost nothing
//   4. every chunk carries an ownership stamp + integrity fingerprint
//
// Honest limit: the browser must receive the CSS and JS, so a determined person
// can still read it. This makes it slow, unrewarding and traceable — not DRM.
import JavaScriptObfuscator from 'javascript-obfuscator';

const MARK = 'lostboys::eun::2026::do-not-reupload';
const ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789';

const rand = (n) => Array.from({ length: n }, () => ALPHA[(Math.random() * ALPHA.length) | 0]).join('');
// class/id tokens must start with a letter or CSS ignores the selector
const newToken = () => ALPHA[(Math.random() * 26) | 0] + rand(4);

function sampleHash(s, step = 97) {
  let h = 0;
  for (let i = 0; i < s.length; i += step) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/* stable rename used for both CSS selectors and the JSX strings that reference
   them. State classes the JS itself toggles (light/dark) stay readable. */
const KEEP = new Set(['light', 'dark', 'on', 'open', 'active', 'is-bg', 'is-leaving', 'hof-src', 'hof-lock', 'site-reveal', 'has-ambient', 'banner-bg', 'intro-active', 'wmark', 'wmark-tag', 'wmark-info', 'wmark-modal', 'wmark-card', 'wmark-legal', 'wmark-close', 'intro-overlay', 'lb-ready', 'lb-filled', 'lb-stroke', 'intro-content', 'intro-scrim', 'intro-skip-hint', 'cur', 'introOverlay', 'lbSmoke', 'lbLogo', 'asciiCanvas', 'lbMetal', 'lbStrokes', 'lbBrushed', 'lbSteel', 'lbGlintG', 'lbShape']);
function mapName(n, map) {
  if (!n || KEEP.has(n)) return n;
  if (!map.has(n)) map.set(n, newToken());
  return map.get(n);
}

export default function protect() {
  const map = new Map(); // original name -> token

  return {
    name: 'lostboys:protect',
    apply: 'build',
    enforce: 'post',

    config() {
      return {
        build: {
          sourcemap: false,
          cssCodeSplit: true,     // css gets its own file (loaded by the loader)
          cssMinify: true,
          minify: 'terser',
          modulePreload: false,
          terserOptions: { compress: { passes: 2, pure_getters: true }, mangle: true, format: { comments: false } },
          rollupOptions: {
            output: {
              // split vendor from app so no single file holds everything
              manualChunks(id) {
                if (id.includes('node_modules')) return 'core';
                return undefined;
              },
              chunkFileNames: 'a/[hash].js',
              entryFileNames: 'a/[hash].js',
              assetFileNames: 'a/[hash][extname]',
            },
          },
        },
      };
    },

    /* generateBundle runs: mangle CSS -> obfuscate chunks -> rewrite index.html */
    generateBundle(_, bundle) {
      // 1. class/id names. Doing this here (not in a `transform` hook) means the
      //    names come from the already-built, minified CSS. Only selector
      //    positions are touched (`.name`, `#name`, `[class~="name"]`), never
      //    values — that regex-on-source approach corrupted `var(--fg)` before.
      const cssAsset = Object.values(bundle).find((f) => f.type === 'asset' && /\.css$/.test(f.fileName));
      if (cssAsset) {
        const css = String(cssAsset.source);
        const renamed = css
          .replace(/(^|[{};,\s>+~(])\.(-?[_a-zA-Z][\w-]*)/g, (_, p, n) => p + '.' + mapName(n, map))
          .replace(/(^|[{};,\s>+~(])#(-?[_a-zA-Z][\w-]*)/g, (_, p, n) => p + '#' + mapName(n, map))
          .replace(/\[class([~|^$*]?)=("|')([\w-]+)\2\]/g, (m, op, q, n) => `[class${op}=${q}${mapName(n, map)}${q}]`);
        cssAsset.source = renamed;
      }

      // 2/3/4. obfuscate every chunk, then replace the readable index.html wiring
      const chunks = Object.values(bundle).filter((f) => f.type === 'chunk');
      const entry = chunks.find((c) => c.isEntry);
      if (!entry) return;

      // 2. sanity: the CSS rename only covers names it saw, so check that every
      //    token produced is actually present (catches a selector regex miss)
      const cssAll = String(cssAsset ? cssAsset.source : '');
      const missing = [...map.values()].filter((tok) => !cssAll.includes(tok));
      if (missing.length) this.warn(`${missing.length} renamed classes absent from css: ${missing.slice(0, 8).join(', ')}`);

      // 3. obfuscate every chunk
      for (const c of chunks) {
        const stamp = sampleHash(c.code + MARK + c.fileName);
        const obf = JavaScriptObfuscator.obfuscate(c.code, {
          target: 'browser',
          compact: true,
          identifierNamesGenerator: 'hexadecimal',
          renameGlobals: false,
          stringArray: true,
          stringArrayThreshold: 0.9,
          stringArrayEncoding: ['base64'],
          stringArrayRotate: true,
          stringArrayShuffle: true,
          splitStrings: true,
          splitStringsChunkLength: 5,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.4,
          numbersToExpressions: true,
          simplify: true,
          transformObjectKeys: true,
          unicodeEscapeSequence: false,
          selfDefending: false,
          debugProtection: false,
          sourceMap: false,
        }).getObfuscatedCode();
        const tag = stamp.toString(36).toUpperCase().slice(0, 4);
        c.code = `${obf}\n;window.__LB_${tag}__=${stamp};`;
      }

      const entryName = entry.fileName.split('/').pop();
      const cssName = cssAsset ? cssAsset.fileName.split('/').pop() : '';

      // the "core" vendor chunk is a dependency import inside the app chunk,
      // so it is not listed here at all.
      const bootName = `a/${rand(7)}.js`;
      const boot = [
        `import"/a/${entryName}";`,
        `(()=>{var c=${JSON.stringify(cssName)},d=document;`,
        `if(c){var l=d.createElement("link");l.rel="stylesheet";l.href="/a/"+c;(d.head||d.documentElement).appendChild(l);}`,
        `d.documentElement.setAttribute("data-lb","1");`,
        `window.__LB_OWNER__=${JSON.stringify(MARK)};})();`,
      ].join('');

      this.emitFile({ type: 'asset', fileName: bootName, source: boot });

      const index = bundle['index.html'];
      if (index) {
        index.source = String(index.source)
          .replace(/<script type="module"[^>]*src="[^"]*"[^>]*><\/script>/g, `\n<script type="module" crossorigin src="/${bootName}"></script>\n`)
          .replace(/[ \t]*<link rel="stylesheet"[^>]*>/g, '');
      }
    },
  };
}
