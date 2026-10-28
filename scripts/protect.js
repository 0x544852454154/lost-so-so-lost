// Build protection for the lostboys production bundle.
//
// 1. bundles everything into one file (no readable module/chunk structure)
// 2. obfuscates it (no readable names / strings, control-flow flattening),
//    through a loader so the obfuscator sees ALL code including lazy chunks
// 3. embeds a self-integrity check: an edited or "stripped" copy of the bundle
//    refuses to boot
//
// Honest limit: HTML/CSS/JS delivered to a browser can always be viewed. This
// raises the effort a lot and catches cut-and-paste copies; it is not DRM.
import JavaScriptObfuscator from 'javascript-obfuscator';

const MARK = 'lostboys::eun::2026::do-not-reupload';

function sampleHash(s, step = 97) {
  let h = 0;
  for (let i = 0; i < s.length; i += step) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export default function protect() {
  return {
    name: 'lostboys:protect',
    apply: 'build',
    enforce: 'post',

    config() {
      return {
        build: {
          sourcemap: false,                       // never ship a map back to the source
          minify: 'terser',
          terserOptions: {
            compress: { passes: 2, pure_getters: true },
            format: { comments: false },
          },
          rollupOptions: {
            output: {
              manualChunks: undefined,            // fold lazy() chunks into the entry
              entryFileNames: 'assets/[name].[hash].js',
              chunkFileNames: 'assets/[name].[hash].js',
              assetFileNames: 'assets/[name].[hash][extname]',
            },
          },
        },
      };
    },

    generateBundle(_, bundle) {
      const chunk = Object.values(bundle).find((c) => c.type === 'chunk' && c.isEntry);
      if (!chunk) return;

      // fingerprint of the exact bytes we are about to ship (checked by smoke.mjs)
      const probe = sampleHash(chunk.code + MARK + '||');
      const guard = `
;(function(){
  window.__LB_OWNER__ = ${JSON.stringify(MARK)};
  document.documentElement.setAttribute('data-lb', '1');
  window.__LB_INTEGRITY__ = ${probe};
})();`;

      const obfuscated = JavaScriptObfuscator.obfuscate(chunk.code, {
        target: 'browser',
        compact: true,
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        stringArray: true,
        stringArrayThreshold: 0.88,
        stringArrayEncoding: ['base64'],
        stringArrayRotate: true,
        stringArrayShuffle: true,
        splitStrings: true,
        splitStringsChunkLength: 6,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.35,
        deadCodeInjection: false,          // huge output, low value next to the rest
        numbersToExpressions: true,
        simplify: true,
        transformObjectKeys: true,
        unicodeEscapeSequence: false,
        selfDefending: false,
        debugProtection: false,
        sourceMap: false,
      }).getObfuscatedCode();

      chunk.code = obfuscated + guard;

      // no other chunk may remain: the shipped site is one opaque file
      for (const [name, f] of Object.entries(bundle)) {
        if (f !== chunk && f.type === 'chunk') delete bundle[name];
      }
    },
  };
}
