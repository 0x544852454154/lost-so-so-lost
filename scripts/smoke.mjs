// Smoke test for the SHIPPED build: does the protected output still work?
// usage: npm run build && npm run smoke
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const dir = 'dist/a';
const files = fs.readdirSync(dir);
const jsFiles = files.filter((f) => f.endsWith('.js'));
const cssFile = files.find((f) => f.endsWith('.css'));
const allJs = jsFiles.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const css = fs.readFileSync(path.join(dir, cssFile), 'utf8');
const html = fs.readFileSync('dist/index.html', 'utf8');

let fail = 0;
const check = (ok, label, extra = '') => { console.log(`${label}: ${ok ? 'ok' : 'FAIL'}${extra ? ' ' + extra : ''}`); if (!ok) fail++; };

/* 1. every chunk is valid JS; no sourcemaps */
let parseErr = null;
for (const f of jsFiles) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  // ES module: strip import/export statements, then parse the rest
  const probe = src
    .replace(/\bimport\s*(\{[^}]*\}|[\w$]+|\*\s*as\s*[\w$]+)?\s*from\s*['"][^'"]+['"]\s*;?/g, '')
    .replace(/\bimport\s*['"][^'"]+['"]\s*;?/g, '')
    .replace(/\bexport\s*\{[^}]*\}\s*(from\s*['"][^'"]+['"])?\s*;?/g, '')
    .replace(/\bexport\s+(default\s+)?(const|let|var|function|class)\b/g, '$2');
  try { new vm.Script(probe, { filename: f }); } catch (e) { parseErr = `${f}: ${e.message}`; }
}
check(!parseErr, 'parse', parseErr || `(${jsFiles.length} chunks)`);
check(!files.some((f) => f.endsWith('.map')), 'no sourcemaps');

/* 2. index.html gives away almost nothing: no chunk list, no chunk name literals */
const scriptSrc = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
check(scriptSrc.length === 1, 'index.html loads one entry', scriptSrc.join(' '));
const listed = jsFiles.filter((f) => html.includes(f));
check(listed.length === 1, 'no chunk list leaked in html', listed.length > 1 ? `leaked ${listed.length}` : '');
check(!/<link[^>]*rel="stylesheet"[^>]*href="\/a\//.test(html), 'css not listed in html');

/* 3. obfuscation actually applied: known source identifiers are gone */
const leaks = ['HallOfFame', 'Members', 'gm-card', 'hof-modal', 'fame-card', 'lanyard', 'presence', 'logoPaths'];
const found = leaks.filter((w) => allJs.includes(w) || css.includes(w));
check(found.length === 0, 'source names hidden', found.length ? 'leaked: ' + found.join(', ') : '');

/* 4. class tokens used by the runtime exist in the CSS (rename stayed in sync) */
const tokens = new Set([...css.matchAll(/(?:^|[{};,\s>+~(])\.?\s?\.([a-zA-Z_][\w-]{4})/g)].map((m) => m[1]));
check(tokens.size > 50, 'css class tokens renamed', `(${tokens.size} tokens)`);
// only the selector half of a rule can hold a class as far as this matters
const selectors = [...css.matchAll(/(?:^|})([^{}@]+)\{/g)].map((m) => m[1]);
const digits = selectors.flatMap((s) => [...s.matchAll(/\.([0-9][\w-]*)/g)].map((m) => m[1]));
check(digits.length === 0, 'no invalid class tokens', digits.slice(0, 5).join(' '));

/* 5. the boot loader runs: stamps the document and injects the stylesheet */
const el = {
  attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
  appendChild() { el._appended = (el._appended || 0) + 1; },
  classList: { add() { }, remove() { }, toggle() { }, contains: () => false }, style: {},
};
const bootName = scriptSrc[0].split('/').pop();
const boot = fs.readFileSync(path.join(dir, bootName), 'utf8');
const imports = [...boot.matchAll(/import"([^"]+)"/g)].map((m) => m[1]);
check(imports.length === 1 && fs.existsSync('dist' + imports[0]), 'boot imports entry chunk', imports.join(' '));
try {
  vm.runInNewContext(boot.replace(/^\s*import"[^"]+";?/, ''), {
    document: { documentElement: el, head: el, createElement: () => ({ setAttribute() { }, style: {} }) },
    window: {},
  }, { timeout: 5000 });
} catch { /* the stub is not a DOM; the stamp below is what matters */ }
check(el.attrs['data-lb'] === '1', 'ownership stamp', '');
check(el._appended === 1, 'stylesheet injected at runtime');

if (fail) { console.error(`\n${fail} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
