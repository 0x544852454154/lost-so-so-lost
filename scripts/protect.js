// Build protection for the lostboys production bundle.
//
// What makes a view-source skid fail here:
//   1. structural class / id names in CSS and JSX are renamed to opaque tokens
//      in lockstep, so no more "gm-card", "hof-modal", "fame-card" to search for
//   2. JS is split into vendor / app chunks and EVERY chunk is obfuscated
//   3. index.html lists neither the chunks nor the CSS as literals — a small
//      runtime loader assembles the URLs, so view-source shows almost nothing
//   4. every chunk carries an ownership stamp + integrity fingerprint
//
// Honest limit: the browser must receive the CSS and JS, so a determined person
// can still read it. This makes it slow, unrewarding and traceable — not DRM.
import fs from 'node:fs';
import babel from '@babel/core';
import JavaScriptObfuscator from 'javascript-obfuscator';

const { transformSync } = babel;

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

/* State / utility classes the JS toggles, or stores as values, stay readable.
   Structural names (nav, gm-card, fame-card, hof-*, ...) are renamed. Keeping
   these readable also means the inline theme boot in index.html keeps working. */
const KEEP = new Set([
  'light', 'dark', 'on', 'open', 'active', 'in', 'out', 'hide', 'modal', 'spin', 'far', 'off',
  'ghost', 'primary', 'side', 'r', 'l', 'xr', 'dup', 'sq', 'live', 'is-active',
  'is-bg', 'is-leaving', 'is-on', 'hof-src', 'hof-lock', 'site-reveal', 'has-ambient',
  'banner-bg', 'intro-active',
  'intro-overlay', 'lb-ready', 'lb-filled', 'lb-stroke', 'intro-content', 'intro-scrim',
  'intro-skip-hint', 'cur',
  'introOverlay', 'lbSmoke', 'lbLogo', 'asciiCanvas', 'lbMetal', 'lbStrokes', 'lbBrushed',
  'lbSteel', 'lbGlintG', 'lbShape',
  'md-only', 'md-hide', 'fx', 'fade-up',
]);

/* at-rules whose block contains ordinary style rules */
const NESTED_AT_RULE = /^@(media|supports|layer|container|scope|document)\b/i;

/* Walk a stylesheet and only hand selector preludes to `transformSelector`.
   Declaration values (colours, gradients, urls, var(...)) are copied verbatim,
   which is what keeps #fff and #a1a1aa from being mistaken for id selectors. */
function transformCss(css, transformSelector) {
  let out = '';
  let i = 0;

  const skipBlock = () => {
    let depth = 1;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
  };

  const parse = (untilBrace) => {
    while (i < css.length) {
      const start = i;
      while (i < css.length && css[i] !== '{' && css[i] !== '}' && css[i] !== ';') i++;
      const prelude = css.slice(start, i);
      if (i >= css.length) {
        out += prelude;
        return;
      }
      if (css[i] === ';') {
        out += prelude + ';';
        i++;
        continue;
      }
      if (css[i] === '}') {
        out += prelude + '}';
        i++;
        if (untilBrace) return;
        continue;
      }

      i++; // consume '{'
      const text = prelude.replace(/\/\*[\s\S]*?\*\//g, '').trim();
      out += (text.startsWith('@') ? prelude : transformSelector(prelude)) + '{';

      if (text.startsWith('@') && !NESTED_AT_RULE.test(text)) {
        // @keyframes / @font-face / @page: keyframe steps and declarations only
        const before = i;
        skipBlock();
        out += css.slice(before, i);
      } else if (text.startsWith('@')) {
        parse(true);
      } else {
        const before = i;
        skipBlock();
        out += css.slice(before, i);
      }
    }
  };

  parse(false);
  return out;
}

/* Run `fn` for every class/id name in a selector prelude. Quoted attribute
   values are skipped, so [data-route="/"] is never touched. */
function eachSelectorName(text, fn) {
  text.replace(/\[class([~|^$*]?)=(["'])([\w-]+)\2\]/g, (m, _op, _q, n) => {
    fn(n);
    return m;
  });
  text.replace(/(["'])(?:\\.|(?!\1)[\s\S])*\1|([.#])(-?[_a-zA-Z][\w-]*)/g, (m, q, _p, n) => {
    if (!q) fn(n);
    return m;
  });
}

function collectNames(css) {
  const names = new Set();
  transformCss(css, (selector) => {
    eachSelectorName(selector.replace(/\/\*[\s\S]*?\*\//g, ''), (n) => names.add(n));
    return selector;
  });
  return names;
}

function renameSelectorText(text, map) {
  let out = text.replace(/\[class([~|^$*]?)=(["'])([\w-]+)\2\]/g,
    (m, op, q, n) => `[class${op}=${q}${map.get(n) || n}${q}]`);
  out = out.replace(/(["'])(?:\\.|(?!\1)[\s\S])*\1|([.#])(-?[_a-zA-Z][\w-]*)/g,
    (m, q, p, n) => (q ? m : map.has(n) ? p + map.get(n) : m));
  return out;
}

function buildMap(css) {
  const names = collectNames(css);
  const map = new Map();
  const used = new Set(KEEP);
  for (const name of names) {
    if (KEEP.has(name)) continue;
    let token;
    do { token = newToken(); } while (used.has(token) || names.has(token));
    used.add(token);
    map.set(name, token);
  }
  return map;
}

/* Rename class/id references in JSX and JS in the same pass, so the DOM and
   the stylesheet always agree. Only class/id positions are touched:
   className, id, classList.*, querySelector/closest, .className = ..., and
   setAttribute('class'|'id', ...). */
const CLASS_LIST_METHODS = new Set(['add', 'remove', 'toggle', 'contains']);
const SELECTOR_METHODS = new Set(['querySelector', 'querySelectorAll', 'closest', 'matches']);

function renameSource(code, id, map) {
  const renameClasses = (s) => s.split(/(\s+)/).map((part) => map.get(part) || part).join('');
  const renameId = (s) => map.get(s) || s;
  const renameSelector = (s) => renameSelectorText(s, map);

  const setString = (node, fn) => {
    if (node.type === 'StringLiteral') {
      const value = fn(node.value);
      if (value !== node.value) {
        node.value = value;
        node.extra = undefined;
      }
    } else if (node.type === 'TemplateLiteral') {
      for (const q of node.quasis) {
        const value = fn(q.value.cooked);
        if (value !== q.value.cooked) {
          q.value.cooked = value;
          q.value.raw = value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
        }
      }
    }
  };

  const setArg = (argPath, fn) => {
    if (!argPath) return;
    const node = argPath.node;
    if (node.type === 'StringLiteral' || node.type === 'TemplateLiteral') {
      setString(node, fn);
      return;
    }
    argPath.traverse({
      StringLiteral(p) { setString(p.node, fn); },
      TemplateLiteral(p) { setString(p.node, fn); },
    });
  };

  const result = transformSync(code, {
    filename: id,
    configFile: false,
    babelrc: false,
    sourceMaps: false,
    retainLines: true,
    parserOpts: { sourceType: 'module', plugins: ['jsx'] },
    plugins: [() => ({
      visitor: {
        JSXAttribute(path) {
          const name = path.node.name;
          if (!name || name.type !== 'JSXIdentifier') return;
          if (name.name !== 'className' && name.name !== 'id') return;
          const fn = name.name === 'className' ? renameClasses : renameId;
          const value = path.node.value;
          if (!value) return;
          if (value.type === 'StringLiteral') {
            setString(value, fn);
          } else if (value.type === 'JSXExpressionContainer') {
            const expr = value.expression;
            if (expr.type === 'StringLiteral' || expr.type === 'TemplateLiteral') {
              setString(expr, fn);
            } else {
              path.get('value.expression').traverse({
                StringLiteral(p) { setString(p.node, fn); },
                TemplateLiteral(p) { setString(p.node, fn); },
              });
            }
          }
        },

        CallExpression(path) {
          const callee = path.node.callee;
          if (callee.type !== 'MemberExpression' || callee.computed) return;
          const prop = callee.property.name;
          if (!prop) return;
          const args = path.get('arguments');

          if (CLASS_LIST_METHODS.has(prop) && callee.object.type === 'MemberExpression' &&
              !callee.object.computed && callee.object.property.name === 'classList') {
            if (prop === 'toggle' || prop === 'contains') setArg(args[0], renameClasses);
            else args.forEach((a) => setArg(a, renameClasses));
          } else if (SELECTOR_METHODS.has(prop)) {
            setArg(args[0], renameSelector);
          } else if (prop === 'getElementById') {
            setArg(args[0], renameId);
          } else if (prop === 'setAttribute') {
            const first = args[0] && args[0].node;
            if (first && first.type === 'StringLiteral') {
              if (first.value === 'class') setArg(args[1], renameClasses);
              else if (first.value === 'id') setArg(args[1], renameId);
            }
          }
        },

        AssignmentExpression(path) {
          const left = path.node.left;
          if (left.type !== 'MemberExpression' || left.computed) return;
          if (left.property.name === 'className') setArg(path.get('right'), renameClasses);
          else if (left.property.name === 'id') setArg(path.get('right'), renameId);
        },
      },
    })],
  });

  return result && result.code !== code ? { code: result.code, map: null } : null;
}

export default function protect() {
  let map = null;
  const getMap = () => {
    if (!map) map = buildMap(fs.readFileSync('src/styles.css', 'utf8'));
    return map;
  };

  return [
    {
      name: 'lostboys:rename-source',
      apply: 'build',
      enforce: 'pre',

      transform(code, id) {
        const file = id.split('?')[0].replace(/\\/g, '/');
        if (!file.includes('/src/') || !/\.[jt]sx?$/.test(file)) return null;
        if (!/\bclassName\b|\bclassList\b|\bquerySelector\b|\bclosest\b|\bgetElementById\b|\bsetAttribute\b|\bid=/.test(code)) return null;
        const m = getMap();
        return m.size ? renameSource(code, file, m) : null;
      },
    },

    {
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

      /* generateBundle runs: rename CSS -> obfuscate chunks -> rewrite index.html */
      generateBundle(_, bundle) {
        const m = getMap();

        // 1. rename class/id selectors only. Values such as #fff, var(--fg) and
        //    url(#lbShape) are left untouched.
        const cssAsset = Object.values(bundle).find((f) => f.type === 'asset' && /\.css$/.test(f.fileName));
        if (cssAsset) cssAsset.source = transformCss(String(cssAsset.source), (selector) => renameSelectorText(selector, m));

        // 2/3/4. obfuscate every chunk, then replace the readable index.html wiring
        const chunks = Object.values(bundle).filter((f) => f.type === 'chunk');
        const entry = chunks.find((c) => c.isEntry);
        if (!entry) return;

        // 2. sanity: every token produced must actually be present in the CSS
        const cssAll = String(cssAsset ? cssAsset.source : '');
        const missing = [...m.values()].filter((tok) => !cssAll.includes(tok));
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
    },
  ];
}

export { KEEP, collectNames, buildMap, transformCss, renameSelectorText };
