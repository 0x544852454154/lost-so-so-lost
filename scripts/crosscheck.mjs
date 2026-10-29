// Cross-check the class/id rename: every selector name in the source CSS must
// survive the build either unchanged (KEEP) or as a 5-character token.
// usage: npm run build && node scripts/crosscheck.mjs
import fs from 'node:fs';
import { collectNames, KEEP } from './protect.js';

const cssDir = 'dist/a';
const css = fs.readFileSync(
  fs.readdirSync(cssDir).filter((f) => f.endsWith('.css')).map((f) => cssDir + '/' + f)[0],
  'utf8',
);
const srcCss = fs.readFileSync('src/styles.css', 'utf8');

const before = collectNames(srcCss);
const after = collectNames(css);
const kept = [...before].filter((n) => after.has(n));
const renamed = [...before].filter((n) => !after.has(n));
const added = [...after].filter((n) => !before.has(n));

let fail = 0;
const check = (ok, label, extra = '') => {
  console.log(`${label}: ${ok ? 'ok' : 'FAIL'}${extra ? ' ' + extra : ''}`);
  if (!ok) fail++;
};

console.log(`selector names: source ${before.size} -> built ${after.size}`);
console.log(`renamed: ${renamed.length}`);
console.log(`left readable (state/a11y hooks): ${kept.join(' ') || '(none)'}`);

check(after.size === before.size, 'selector count preserved', `${after.size} / ${before.size}`);
check(added.length === renamed.length, 'one token per renamed selector', `${added.length} / ${renamed.length}`);
check(added.every((t) => /^[a-z][a-z0-9]{4}$/.test(t)), 'tokens are 5 chars',
  added.filter((t) => !/^[a-z][a-z0-9]{4}$/.test(t)).slice(0, 8).join(' '));
check(renamed.every((n) => !KEEP.has(n)), 'KEEP names were not renamed',
  renamed.filter((n) => KEEP.has(n)).slice(0, 8).join(' '));
check([...KEEP].every((n) => !before.has(n) || after.has(n)), 'all KEEP names survived');

// minification may merge identical rules, so rule count is informational only
const rules = (s) => (s.match(/\{/g) || []).length;
console.log(`rule blocks: source ${rules(srcCss)} -> built ${rules(css)}`);

if (fail) { console.error(`\n${fail} check(s) failed`); process.exit(1); }
console.log('\nall checks passed');
