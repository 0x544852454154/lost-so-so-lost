import { useCallback, useEffect, useRef, useState } from 'react';
import { MEMBERS } from './data.js';
import { usePresence } from './presence.jsx';
import {
  pad, displayName, handleText, roleText, bioText, decoUrl, activityLabel, statusLabel, defaultAvatar,
  getAvatarUrl, getBannerUrl, safeUrl, handleFromUrl, reducedMotion,
} from './util.js';

const ICONS = {
  spotify: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" /><path d="M7 9.4c3.6-1 7.4-.7 10.4 1.1M7.6 12.7c3-.8 6-.5 8.6 1M8.2 15.7c2.4-.6 4.6-.4 6.6.7" /></svg>,
  instagram: <svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".6" /></svg>,
  discord: <svg viewBox="0 0 24 24"><path d="M5 5.5h14A1.5 1.5 0 0 1 20.5 7v9a1.5 1.5 0 0 1-1.5 1.5h-7L8 21v-3.5H5A1.5 1.5 0 0 1 3.5 16V7A1.5 1.5 0 0 1 5 5.5Z" /><path d="M9 11.5h.01M15 11.5h.01" /></svg>,
};

function memberLinks(m) {
  const sp = safeUrl(m.spotify), ig = safeUrl(m.instagram);
  return [
    { t: 'Spotify', s: sp ? 'Listen on Spotify' : 'Not linked yet', u: sp, i: ICONS.spotify },
    { t: 'Instagram', s: ig ? handleFromUrl(ig) || 'View profile' : 'Not linked yet', u: ig, i: ICONS.instagram },
    { t: 'Discord', s: 'Open Discord profile', u: 'https://discord.com/users/' + encodeURIComponent(m.discordId), i: ICONS.discord },
  ];
}

/* ---- palette: the page takes on the colour of the member on top ---- */
const hsl = (h, s, l) => `hsl(${Math.round(((h % 360) + 360) % 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
const makePalette = (h, s) => [hsl(h, s * 0.7, 0.09), hsl(h, s * 0.75, 0.22), hsl(h, s * 0.65, 0.38), hsl(h + 8, s * 0.45, 0.68)];
const hashPalette = (id) => { let n = 0; for (const ch of String(id)) n = (n * 31 + ch.charCodeAt(0)) % 360; return makePalette(n, 0.6); };

function paletteFrom(im) {
  const N = 48, B = 24, c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(im, 0, 0, N, N);
  const px = x.getImageData(0, 0, N, N).data;           // throws if the image taints the canvas
  const W = Array(B).fill(0), SX = Array(B).fill(0), SY = Array(B).fill(0), SS = Array(B).fill(0);
  let energy = 0, seen = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
    seen++;
    if (d < 0.02) continue;
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    const sat = d / (1 - Math.abs(2 * l - 1) || 1), w = d * d, k = Math.min(B - 1, Math.floor((h / 360) * B)), rad = (h * Math.PI) / 180;
    W[k] += w; SX[k] += w * Math.cos(rad); SY[k] += w * Math.sin(rad); SS[k] += w * sat; energy += w;
  }
  if (!seen || energy / seen < 0.004) return makePalette(220, 0.06);   // greyscale: stay neutral
  let best = 0, bestW = -1;
  for (let k = 0; k < B; k++) { const tw = W[k] + W[(k + 1) % B] + W[(k + B - 1) % B]; if (tw > bestW) { bestW = tw; best = k; } }
  let ax = 0, ay = 0, as = 0, aw = 0;
  [(best + B - 1) % B, best, (best + 1) % B].forEach((j) => { ax += SX[j]; ay += SY[j]; as += SS[j]; aw += W[j]; });
  const hue = ((Math.atan2(ay, ax) * 180) / Math.PI + 360) % 360;
  return makePalette(hue, Math.max(0.25, Math.min(0.85, aw ? as / aw : 0.5)));
}
function loadSample(url, cb) {
  const im = new Image(); im.crossOrigin = 'anonymous';
  im.onload = () => { let p = null; try { p = paletteFrom(im); } catch {} cb(p); };
  im.onerror = () => cb(null);
  im.src = url;
}

export default function Members() {
  const cache = usePresence();
  const total = MEMBERS.length;
  const [index, setIndex] = useState(0);
  const [modal, setModal] = useState(false);
  const [spin, setSpin] = useState(false);
  const gm = useRef(), stage = useRef(), pfp = useRef(), closeBtn = useRef(), i0 = useRef(), iL = useRef(), iR = useRef();
  const pal = useRef({}), firstFocus = useRef(true);
  const live = useRef({});
  live.current = { index, cache, modal };

  const go = useCallback((i) => {
    if (live.current.modal) return;
    setIndex(Math.max(0, Math.min(total - 1, i)));
  }, [total]);

  /* palette */
  const setVars = (cols) => cols.forEach((c, i) => gm.current && gm.current.style.setProperty('--c' + (i + 1), c));
  const ensure = useCallback((i) => {
    if (i < 0 || i >= total) return;
    const st = pal.current[i] || (pal.current[i] = { cols: null, src: '', busy: false, banner: false, avatar: false });
    const cur = () => i === live.current.index;
    if (st.cols && cur()) setVars(st.cols);
    if (st.busy || st.src === 'banner') return;
    const m = MEMBERS[i], user = (live.current.cache[m.discordId] || {}).discord_user;
    let url = '', kind = '';
    if (m.banner && !st.banner) { url = m.banner; kind = 'banner'; }
    else if (!st.avatar && user && user.avatar) { url = getAvatarUrl(user.id, user.avatar); kind = 'avatar'; }
    if (!url) {
      if (!st.cols) { st.cols = hashPalette(m.discordId); st.src = 'hash'; if (cur()) setVars(st.cols); }
      return;
    }
    st[kind] = true; st.busy = true;
    loadSample(url, (cols) => {
      st.busy = false;
      if (cols && st.src !== 'banner') { st.cols = cols; st.src = kind; if (cur()) setVars(cols); }
      ensure(i);                                        // this source failed or was upgraded: try the next one
    });
  }, [total]);
  useEffect(() => {
    ensure(index);
    const t = setTimeout(() => { ensure(index + 1); ensure(index - 1); }, 500);
    return () => clearTimeout(t);
  }, [index, cache, ensure]);

  /* ring spin while the island is open */
  useEffect(() => {
    if (!modal) return;
    const st = stage.current; st.style.setProperty('--rot', '0deg');
    if (matchMedia('(max-width:800px)').matches || reducedMotion()) return;
    let raf = 0, rot = 0, t0 = 0;
    const tick = (t) => { rot = (rot - Math.min(t - t0, 250) * 0.012) % 360; t0 = t; st.style.setProperty('--rot', rot + 'deg'); raf = requestAnimationFrame(tick); };
    const timer = setTimeout(() => { setSpin(true); t0 = performance.now(); raf = requestAnimationFrame(tick); }, 950);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); setSpin(false); };
  }, [modal]);

  useEffect(() => { [i0, iL, iR].forEach((r) => { if (r.current) r.current.inert = !modal; }); }, [modal]);
  useEffect(() => {
    if (firstFocus.current) { firstFocus.current = false; return; }
    (modal ? closeBtn : pfp).current.focus({ preventScroll: true });
  }, [modal]);

  /* keys, wheel, hash */
  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape' && live.current.modal) { setModal(false); return; }
      if (live.current.modal || (e.target.matches && e.target.matches('input, textarea, select'))) return;
      const ix = live.current.index;
      if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); go(ix - 1); }
      if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); go(ix + 1); }
    };
    let acc = 0, idle = null;
    const wheel = (e) => {
      if (e.ctrlKey || live.current.modal) return;
      e.preventDefault();
      acc += e.deltaY;
      if (Math.abs(acc) >= 80) { go(live.current.index + (acc > 0 ? 1 : -1)); acc = 0; }
      clearTimeout(idle); idle = setTimeout(() => { acc = 0; }, 200);
    };
    const hash = () => setModal(false);
    document.addEventListener('keydown', key);
    addEventListener('wheel', wheel, { passive: false });
    addEventListener('hashchange', hash);
    return () => { document.removeEventListener('keydown', key); removeEventListener('wheel', wheel); removeEventListener('hashchange', hash); clearTimeout(idle); };
  }, [go]);

  const touch = useRef([0, 0]);
  const onTouchEnd = (e) => {
    if (modal) return;
    const t = e.changedTouches[0], dx = touch.current[0] - t.clientX, dy = touch.current[1] - t.clientY;
    const mo = matchMedia('(max-width:800px)').matches ? [dx, dy] : [dy, dx];
    if (Math.abs(mo[0]) > 40 && Math.abs(mo[0]) > Math.abs(mo[1])) go(index + (mo[0] > 0 ? 1 : -1));
  };

  /* derived for the member on top */
  const m = MEMBERS[index], data = cache[m.discordId], user = data && data.discord_user;
  const status = data ? data.discord_status : 'offline';
  const avatar = user && user.avatar ? getAvatarUrl(user.id, user.avatar) : defaultAvatar(m.discordId);
  const name = displayName(m, data), handle = handleText(m, data) || 'id ' + m.discordId;
  const deco = decoUrl(user);
  const actInfo = data ? activityLabel({
    listening_to_spotify: data.listening_to_spotify, spotify: data.spotify,
    activities: (data.activities || []).filter((a) => a && a.type !== 4),   // custom status is the bio, not an activity
  }) : null;
  const links = memberLinks(m);
  const cardSrc = (mm) => {
    if (mm.banner) return mm.banner;
    const d = cache[mm.discordId], u = d && d.discord_user;
    return u ? getBannerUrl(u.id, u.banner) || getAvatarUrl(u.id, u.avatar) : defaultAvatar(mm.discordId);
  };

  /* ring: 9 slots around the member on top; gaps are filled with copies */
  const rel = (i) => { let w = (((i - index) % total) + total) % total; if (w > total / 2) w -= total; return w; };
  const ghosts = [];
  if (modal) {
    const seen = {};
    MEMBERS.forEach((_, i) => { const w = rel(i); if (Math.abs(w) <= 4) seen[w] = true; });
    for (let k = -4; k <= 4; k++) {
      if (seen[k]) continue;
      const j = (((index + k) % total) + total) % total;
      ghosts.push(
        <div key={k} className="gm-card ghost" aria-hidden="true" style={{ '--m': k }}>
          <img src={cardSrc(MEMBERS[j])} alt="" draggable="false" /><span className="gm-tag">MEMBER / {pad(j + 1)}</span>
        </div>);
    }
  }

  return (
    <div className={'gm' + (modal ? ' modal' : '') + (spin ? ' spin' : '')} id="gm" ref={gm}
      onTouchStart={(e) => { touch.current = [e.touches[0].clientX, e.touches[0].clientY]; }} onTouchEnd={onTouchEnd}>
      <div className="gm-bg" aria-hidden="true"><i /><i /><i /></div>

      <div className="gm-main">
        <div className="gm-me fx" style={{ '--i': 0 }}>
          <button className="gm-pfp" ref={pfp} type="button" aria-label="Open member profile" aria-haspopup="dialog" onClick={() => setModal(true)}>
            <img className="gm-av" alt="Profile picture" src={avatar} /><span className="gm-dot" data-s={status} title={statusLabel(status)} />
          </button>
          <div><h1>{name}</h1><small className="gm-hd">{handle}</small></div>
        </div>

        <div className="gm-stage fx" style={{ '--i': 1 }} ref={stage} role="listbox" aria-label="Members" aria-live="polite">
          {MEMBERS.map((mm, i) => {
            const d = i - index, a = Math.abs(d), w = rel(i);
            return (
              <div key={i} className={'gm-card' + (a === 0 ? ' on' : '') + (Math.abs(w) > 4 ? ' far' : '')}
                role="option" aria-label={'Member ' + (i + 1)} aria-selected={a === 0}
                style={{ '--d': d, '--a': a, '--m': w, opacity: a > 1 ? 0 : a ? 0.4 : 1, filter: a ? 'brightness(.55) saturate(.8)' : 'none', pointerEvents: a > 1 ? 'none' : 'auto' }}
                onClick={() => go(i)}>
                <img src={cardSrc(mm)} alt="" draggable="false" /><span className="gm-tag">MEMBER / {pad(i + 1)}</span>
              </div>
            );
          })}
          <div className="gm-ring">{ghosts}</div>
        </div>
      </div>

      <nav className="gm-ticks" style={{ '--n': total }} aria-label="Members">
        {MEMBERS.map((_, i) => <button key={i} type="button" className={i === index ? 'on' : ''} aria-label={'Member ' + (i + 1)} onClick={() => go(i)} />)}
      </nav>
      <div className="gm-scrim" onClick={() => setModal(false)} />

      <div className={'gm-island xr' + (modal ? ' open' : '')} id="gmIsland" ref={i0} role="dialog" aria-label="Member profile">
        <div className="gm-in">
          <button className="gm-x" ref={closeBtn} type="button" aria-label="Close" onClick={() => setModal(false)}>&times;</button>
          <div className="gm-who">
            <div className="gm-pic">
              <img className="gm-av" alt="Profile picture" src={avatar} />
              <img className={'gm-deco' + (deco ? ' is-on' : '')} src={deco || undefined} alt="" aria-hidden="true" />
              <span className="gm-dot" data-s={status} />
            </div>
            <h2>{name}</h2>
            <div className="gm-un">{handle}</div>
            <div className="gm-role">{roleText(m, data)}</div>
            <div className="gm-stat" data-s={status}><i /><span>{statusLabel(status)}</span></div>
            <div className="gm-cs">{bioText(m, data)}</div>
            <div className="gm-cs gm-act">{actInfo ? (actInfo.type === 'spotify' ? 'Spotify · ' : '') + actInfo.text : ''}</div>
          </div>
          <div className="gm-rows">
            {links.map((l, i) => {
              const inner = <><i>{l.i}</i><span><b>{l.t}</b><small>{l.s}</small></span></>;
              const dup = i < 2 ? ' dup' : '';   // Spotify + Instagram get their own side modals on wide screens
              return l.u
                ? <a key={l.t} className={'gm-row' + dup} href={l.u} target="_blank" rel="noopener noreferrer">{inner}<em>&#8599;</em></a>
                : <div key={l.t} className={'gm-row off' + dup} aria-disabled="true">{inner}</div>;
            })}
          </div>
        </div>
      </div>

      {[0, 1].map((k) => {
        const l = links[k];
        const inner = <><i className="gm-sico">{l.i}</i><b className="gm-stt">{l.t}</b><small className="gm-sub">{l.s}</small></>;
        return (
          <div key={k} ref={k ? iR : iL} className={'gm-island side ' + (k ? 'r' : 'l') + (modal ? ' open' : '')} role="group" aria-label={l.t}>
            {l.u
              ? <a className="gm-in" href={l.u} target="_blank" rel="noopener noreferrer">{inner}<span className="gm-go">Open &#8599;</span></a>
              : <div className="gm-in off">{inner}<span className="gm-go">Coming soon</span></div>}
          </div>
        );
      })}
    </div>
  );
}
