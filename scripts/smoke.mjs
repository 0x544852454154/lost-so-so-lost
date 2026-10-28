// Smoke test: does the SHIPPED (obfuscated) bundle still parse and boot?
// usage: npm run build && node scripts/smoke.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const dir = 'dist/assets';
const file = path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith('.js')));
const code = fs.readFileSync(file, 'utf8');

// 1. parses at all
try { new vm.Script(code, { filename: file }); }
catch (e) { console.error('PARSE FAIL', e.message); process.exit(1); }
console.log('parse: ok');

// 2. the integrity guard boots and stamps the document
const el = {
  attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
  classList: { add() { }, remove() { }, toggle() { }, contains: () => false }, style: {}
};
const noop = () => { };
const sandbox = {
  window: {}, console: { log: noop, warn: noop, error: noop, info: noop },
  document: {
    documentElement: el, body: { classList: el.classList, appendChild: noop, style: {} },
    createElement: () => ({ classList: el.classList, style: {}, setAttribute: noop, appendChild: noop, getContext: () => null }),
    querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, removeEventListener: noop,
    // React's createRoot needs a real-looking container
    getElementById: () => ({ nodeType: 1, tagName: 'DIV', namespaceURI: 'http://www.w3.org/1999/xhtml',
      firstChild: null, appendChild: noop, insertBefore: noop, removeChild: noop, addEventListener: noop, removeEventListener: noop,
      setAttribute: noop, getAttribute: () => null, style: {}, classList: el.classList })
  },
  localStorage: { getItem: () => null, setItem: noop },
  location: { hash: '', hostname: 'localhost', href: 'http://localhost/' },
  navigator: { userAgent: 'node' }, performance,
  requestAnimationFrame: () => 0, cancelAnimationFrame: noop, setInterval: () => 0, clearInterval: noop,
  setTimeout: () => 0, clearTimeout: noop, addEventListener: noop, removeEventListener: noop,
  matchMedia: () => ({ matches: false, addEventListener() { } }),
  WebSocket: function () { throw new Error('no ws'); }, fetch: () => Promise.reject(new Error('offline')),
  MutationObserver: function () { return { observe: noop, disconnect: noop, takeRecords: () => [] }; },
  Node: function () {}, Element: function () {}, HTMLElement: function () {},
  Image: function () { }, URL, URLSearchParams, BigInt, Intl, Math, JSON, Date, Error, Promise,
};
// the guard only needs document + window; run just that tail so a stub DOM
// can't mask the result (React mounting needs a real browser, not this test)
const tail = code.slice(code.lastIndexOf(';(function(){'));
let guardErr = null;
try { vm.runInNewContext(tail, { document: sandbox.document, window: {} }, { timeout: 5000 }); }
catch (e) { guardErr = e; }
const stamp = sandbox.document.documentElement.attrs['data-lb'];
console.log('integrity stamp:', stamp ?? '(guard did not run)', guardErr ? '-> ' + guardErr.message : '');
if (stamp !== '1') process.exit(1);

// and the whole bundle parses + is a single self-contained module
console.log('single file:', fs.readdirSync(dir).filter((f) => f.endsWith('.js')).length === 1);

// 3. the fingerprint that catches a re-uploaded "fixed" copy (JS flipped back to 2 lanes)
let h = 0;
for (let i = 0; i < code.length; i += 97) h = (h * 31 + code.charCodeAt(i)) >>> 0;
const flipped = code.replace('!', '!0');   // any edit at all re-rolls the fingerprint
let h2 = 0;
for (let i = 0; i < flipped.length; i += 97) h2 = (h2 * 31 + flipped.charCodeAt(i)) >>> 0;
console.log('edit detection:', h === h2 ? 'FAILED (same fingerprint)' : `ok (${h.toString(36)} -> ${h2.toString(36)})`);
