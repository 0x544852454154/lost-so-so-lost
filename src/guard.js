/* Ownership notice + host check. Runs once, before React mounts.
   Not "security" — it makes a copy obvious and catches lazy re-uploads. */

export const OWNER = 'lostboys';

// hosts allowed to serve this build (add your real domain here)
export const OWNER_HOSTS = ['lostboys', 'localhost', '127.0.0.1', 'vercel.app', 'netlify.app', 'pages.dev'];

const STYLE = 'font:600 12px/1.5 ui-monospace,monospace;color:#fff;background:#000;padding:8px 12px;border-radius:6px';
const SOFT = 'font:400 12px/1.5 ui-monospace,monospace;color:#9a9a9a';
const SIGN = '%clostboys \u00b7 \u00a9 ' + OWNER + ' \u2014 the code, styles, effects and artwork on this site are not free to copy or reuse.\n%cAnywhere other than the official site, this is a copy.';

export function installGuard() {
  /* console signature */
  try {
    console.log('%c\u200b', STYLE);
    console.log(SIGN, STYLE, SOFT);
  } catch {}

  /* repeat the notice when DevTools is opened after load */
  let opened = false;
  setInterval(() => {
    const t0 = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    if (!opened && performance.now() - t0 > 120) {
      opened = true;
      try { console.log(SIGN, STYLE, SOFT); } catch {}
    }
  }, 3000);

  /* host check: flag builds served from a domain that isn't ours */
  try {
    const host = location.hostname.toLowerCase();
    const mine = !host || OWNER_HOSTS.some((h) => host === h || host.endsWith('.' + h));
    if (!mine) document.documentElement.setAttribute('data-lb-copy', host);
  } catch {}
}
