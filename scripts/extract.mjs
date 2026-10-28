// usage: npm run extract -- path/to/original.html
// Copies every <style> block -> src/styles.css and the LOGO path array -> src/logoPaths.js (unchanged).
import fs from 'node:fs';
const file = process.argv[2];
if (!file) { console.error('usage: npm run extract -- path/to/original.html'); process.exit(1); }
const html = fs.readFileSync(file, 'utf8');
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1].trim()).join('\n\n');
fs.writeFileSync('src/styles.css', css + '\n');
const logo = html.match(/var LOGO = (\[[\s\S]*?\]);/);
if (!logo) { console.error('LOGO array not found'); process.exit(1); }
fs.writeFileSync('src/logoPaths.js', 'export const LOGO = ' + logo[1] + ';\n');
console.log('wrote src/styles.css and src/logoPaths.js');
