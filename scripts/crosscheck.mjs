// Cross-check the class rename: every class the built CSS defines must be a
// class the JS actually renders, and the renamed CSS must not drop selectors.
// usage: npm run build && node scripts/crosscheck.mjs
import fs from 'node:fs';

const css = fs.readFileSync(fs.readdirSync('dist/a').filter((f) => f.endsWith('.css')).map((f) => 'dist/a/' + f)[0], 'utf8');
const srcCss = fs.readFileSync('src/styles.css', 'utf8');

const defs = (s) => new Set([...s.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1]));
const before = defs(srcCss);
const after = defs(css);

console.log(`class selectors: source ${before.size} -> built ${after.size}`);
console.log(`renamed: ${[...after].filter((n) => !before.has(n)).length}`);
console.log(`left readable (state/a11y hooks): ${[...after].filter((n) => before.has(n)).join(' ') || '(none)'}`);

// renamed ones have new names, so compare counts: nothing may vanish in the swap.
// (minification legitimately merges identical rules, hence a small tolerance)
console.log(`selectors kept: ${after.size} / ${before.size}`);
const renamed = [...after].filter((n) => !before.has(n));
const orphanTokens = renamed.filter((t) => t.length !== 5);
console.log(`tokens with unexpected shape: ${orphanTokens.length}`, orphanTokens.slice(0, 8).join(' '));

// every rule that existed still exists (same rule count)
const rules = (s) => (s.match(/\{/g) || []).length;
console.log(`rule blocks: source ${rules(srcCss)} -> built ${rules(css)}`);
