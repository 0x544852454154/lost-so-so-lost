import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HALL_OF_FAME } from './data.js';
import { usePresence } from './presence.jsx';
import { pad, displayName, handleText, bioText, bannerOf, avatarOf, decoUrl, activityLabel, statusLabel, reducedMotion, scramble } from './util.js';

const EASE = 'cubic-bezier(.2,.9,.15,1)';
const since = (id) => {
  try { return new Date(Number(BigInt(id) >> BigInt(22)) + 1420070400000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};
const inset = (card, s) => {
  const r = card.getBoundingClientRect(), f = (v) => Math.max(0, v).toFixed(1) + 'px';
  return `inset(${f(r.top - s.top)} ${f(s.right - r.right)} ${f(s.bottom - r.bottom)} ${f(r.left - s.left)} round 30px)`;
};

export default function HallOfFame() {
  const cache = usePresence();
  const [open, setOpen] = useState(null);
  const cardEls = useRef([]);
  const back = useRef(null);

  const tilt = (e) => {
    if (e.pointerType !== 'mouse' || reducedMotion()) return;
    const c = e.currentTarget, r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    c.style.setProperty('--rx', ((0.5 - py) * 11).toFixed(2) + 'deg');
    c.style.setProperty('--ry', ((px - 0.5) * 14).toFixed(2) + 'deg');
    c.style.setProperty('--tx', ((px - 0.5) * 2).toFixed(3));
    c.style.setProperty('--ty', ((py - 0.5) * 2).toFixed(3));
    c.style.setProperty('--px', (px * 100).toFixed(1) + '%');
    c.style.setProperty('--py', (py * 100).toFixed(1) + '%');
  };
  const settle = (e) => {
    const c = e.currentTarget;
    if (e.relatedTarget && c.contains(e.relatedTarget)) return;
    ['--rx', '--ry'].forEach((k) => c.style.setProperty(k, '0deg'));
    ['--tx', '--ty'].forEach((k) => c.style.setProperty(k, '0'));
  };
  const openCard = (i) => { if (open !== null) return; back.current = i; setOpen(i); };

  return (
    <div className="hall-page">
      <div className="hall-header fade-up fx" style={{ '--i': 0 }}>
        <h1 className="hall-title">HOF</h1>
        <div className="hall-divider" />
        <p className="hall-subtitle">ALL HAIL LOSTBOYS</p>
      </div>

      <div className="fame-grid" id="fameGrid">
        {HALL_OF_FAME.map((m, i) => {
          const d = cache[m.discordId], st = d ? d.discord_status : 'offline', act = d ? activityLabel(d) : null;
          return (
            <div key={i} ref={(el) => { cardEls.current[i] = el; }}
              className={'fame-card fx' + (open === i ? ' hof-src' : '')} style={{ '--i': Math.min(i + 1, 10) }}
              data-id={m.discordId} tabIndex={0} role="button" aria-haspopup="dialog" aria-label={`Open profile ${i + 1}`}
              onClick={() => openCard(i)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCard(i); } }}
              onPointerMove={tilt} onPointerOut={settle}>
              <img className="fame-card-bg" src={bannerOf(m, d)} alt="" loading="lazy" />
              <div className="fame-card-overlay" />
              <div className="fame-card-content">
                <div className="fame-card-header">
                  <div className="fame-card-avatar-wrap">
                    <img className="fame-card-avatar" src={avatarOf(d)} alt="" />
                    <img className={'avatar-deco' + (decoUrl(d && d.discord_user) ? ' is-on' : '')} src={decoUrl(d && d.discord_user) || undefined} alt="" aria-hidden="true" />
                    <span className="fame-card-dot" data-status={st} title={statusLabel(st)} />
                  </div>
                  <div className="fame-card-text">
                    <h3 className="fame-card-name">{displayName(m, d)}</h3>
                    <p className="fame-card-handle">{handleText(m, d)}</p>
                  </div>
                </div>
                <p className="fame-card-status" data-status={st}>{statusLabel(st) + (act ? ' · ' + act.text : '')}</p>
                <p className="fame-card-bio">{bioText(m, d)}</p>
                <div className="fame-card-tags"><div className="fame-card-tag" /><div className="fame-card-tag" /></div>
              </div>
              <i className="hof-foil" /><i className="hof-ring" />
              <span className="hof-rank">{pad(i + 1)}</span><span className="hof-open-hint">view profile</span>
            </div>
          );
        })}
      </div>

      {open !== null && (
        <HofModal idx={open} cards={cardEls.current} cache={cache}
          onGo={(ni) => { back.current = ni; setOpen(ni); }}
          onClosed={() => {
            const i = back.current; setOpen(null);
            requestAnimationFrame(() => { const c = cardEls.current[i]; if (c && c.offsetParent) c.focus({ preventScroll: true }); });
          }} />
      )}
    </div>
  );
}

function HofModal({ idx, cards, cache, onGo, onClosed }) {
  const m = HALL_OF_FAME[idx], d = cache[m.discordId], user = d && d.discord_user, st = d ? d.discord_status : 'offline';
  const [on, setOn] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrap = useRef(), sheet = useRef(), nameEl = useRef(), bodyEl = useRef(), banEl = useRef(), bimg = useRef();
  const busy = useRef(true), closing = useRef(false), dir = useRef(0), lastIdx = useRef(-1), swipe = useRef(null);
  const live = useRef({});
  live.current = { idx, cards, onGo, onClosed };

  /* open: the sheet grows out of the card */
  useLayoutEffect(() => {
    const el = sheet.current, card = cards[idx];
    const sc = innerWidth - document.documentElement.clientWidth;
    document.body.classList.add('hof-lock'); if (sc > 0) document.body.style.paddingRight = sc + 'px';
    el.focus({ preventScroll: true });
    const fin = () => { busy.current = false; el.style.clipPath = ''; };
    if (reducedMotion() || !card) fin();
    else {
      const a = el.animate(
        [{ clipPath: inset(card, el.getBoundingClientRect()), transform: 'scale(.97)' }, { clipPath: 'inset(0px 0px 0px 0px round 36px)', transform: 'scale(1)' }],
        { duration: 640, easing: EASE });
      a.onfinish = a.oncancel = fin;
    }
    let r2; const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setOn(true)); });
    return () => {
      cancelAnimationFrame(r1); cancelAnimationFrame(r2);
      document.body.classList.remove('hof-lock'); document.body.style.paddingRight = '';
    };
  }, []);

  /* name decodes out of noise when the member changes */
  const name = displayName(m, d);
  useEffect(() => {
    const el = nameEl.current;
    if (lastIdx.current !== idx) { lastIdx.current = idx; scramble(el, name, 650); }
    else { el.__scr = (el.__scr || 0) + 1; el.textContent = name; }
  }, [idx, name]);

  /* slide the new content in after a swap */
  useEffect(() => {
    const dr = dir.current; if (!dr) return;
    dir.current = 0; sheet.current.scrollTop = 0;
    if (reducedMotion()) { busy.current = false; return; }
    banEl.current.animate([{ opacity: 0.2, transform: `translateX(${dr * 30}px)` }, { opacity: 1, transform: 'none' }], { duration: 480, easing: EASE });
    const a = bodyEl.current.animate(
      [{ opacity: 0, transform: `translateX(${dr * 46}px)`, filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
      { duration: 520, easing: EASE });
    a.onfinish = () => { busy.current = false; };
  }, [idx]);

  const go = useCallback((dr) => {
    const n = HALL_OF_FAME.length;
    if (busy.current || closing.current || n < 2) return;
    busy.current = true;
    const swap = () => { dir.current = dr; live.current.onGo((live.current.idx + dr + n) % n); };
    if (reducedMotion()) return swap();
    const o = bodyEl.current.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-dr * 46}px)`, filter: 'blur(8px)' }], { duration: 170, easing: 'ease-in', fill: 'forwards' });
    const ob = banEl.current.animate([{ opacity: 1 }, { opacity: 0.2 }], { duration: 170, fill: 'forwards' });
    o.onfinish = () => { o.cancel(); ob.cancel(); swap(); };
  }, []);

  const close = useCallback((instant) => {
    if (closing.current || (busy.current && instant !== true)) return;
    closing.current = true; busy.current = true;
    setOn(false);
    wrap.current.classList.remove('live'); wrap.current.style.setProperty('--wx', '0deg'); wrap.current.style.setProperty('--wy', '0deg');
    const card = live.current.cards[live.current.idx], el = sheet.current;
    if (reducedMotion() || instant === true || !card || !card.offsetParent) return live.current.onClosed();
    const a = el.animate(
      [{ clipPath: 'inset(0px 0px 0px 0px round 36px)', transform: 'scale(1)' }, { clipPath: inset(card, el.getBoundingClientRect()), transform: 'scale(.97)' }],
      { duration: 460, easing: 'cubic-bezier(.6,0,.25,1)', fill: 'forwards' });
    a.onfinish = a.oncancel = () => live.current.onClosed();
  }, []);

  /* keys + focus trap + close on route change */
  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'Tab') {
        const root = sheet.current.closest('.hof-modal');
        const f = [...root.querySelectorAll('button,a[href]')].filter((n) => n.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const hash = () => close(true);
    document.addEventListener('keydown', key); addEventListener('hashchange', hash);
    return () => { document.removeEventListener('keydown', key); removeEventListener('hashchange', hash); };
  }, [go, close]);

  /* 3D tilt + glare + banner parallax */
  const move = (e) => {
    if (e.pointerType !== 'mouse' || reducedMotion() || closing.current) return;
    const r = sheet.current.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    const cx = Math.max(-1, Math.min(1, (e.clientX / innerWidth - 0.5) * 2)), cy = Math.max(-1, Math.min(1, (e.clientY / innerHeight - 0.5) * 2));
    const w = wrap.current;
    w.classList.add('live'); w.style.setProperty('--wx', (-cy * 5).toFixed(2) + 'deg'); w.style.setProperty('--wy', (cx * 7).toFixed(2) + 'deg');
    sheet.current.style.setProperty('--gx', (px * 100).toFixed(1) + '%'); sheet.current.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
    bimg.current.style.translate = (-cx * 8).toFixed(1) + 'px ' + (-cy * 5).toFixed(1) + 'px';
  };
  const leave = () => { wrap.current.classList.remove('live'); wrap.current.style.setProperty('--wx', '0deg'); wrap.current.style.setProperty('--wy', '0deg'); };

  let act = null;
  if (d) {
    if (d.listening_to_spotify && d.spotify) act = { k: 'Listening to', t: d.spotify.song, s: d.spotify.artist, img: d.spotify.album_art_url };
    else if (d.activities) {
      const a = d.activities.filter((x) => x.type !== 4)[0];
      if (a) act = { k: ['Playing', 'Streaming', 'Listening to', 'Watching', '', 'Competing in'][a.type] || 'Now', t: a.name || '', s: a.details || a.state || '', img: null };
    }
  }
  const deco = decoUrl(user);
  const copy = () => {
    const ok = () => { setCopied(true); setTimeout(() => setCopied(false), 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(m.discordId).then(ok, ok); else ok();
  };
  const I = (i) => ({ '--i': i });

  return (
    <div className={'hof-modal' + (on ? ' on' : '')} onPointerMove={move} onPointerLeave={leave}>
      <div className="hof-scrim" onClick={() => close()} />
      <div className="hof-stage" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
        <button className="hof-nav" type="button" aria-label="Previous member" onClick={() => go(-1)}>&#8249;</button>
        <div className="hof-wrap" ref={wrap}>
          <div className="hof-sheet" ref={sheet} data-s={st} role="dialog" aria-modal="true" aria-label="Hall of Fame profile" tabIndex={-1}
            onPointerDown={(e) => { if (e.pointerType !== 'mouse') swipe.current = { x: e.clientX, y: e.clientY }; }}
            onPointerUp={(e) => {
              const s = swipe.current; if (!s) return; swipe.current = null;
              const dx = e.clientX - s.x, dy = e.clientY - s.y;
              if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
              else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5 && sheet.current.scrollTop <= 0) close();
            }}>
            <div className="hof-glare" />
            <div className="hof-banner" ref={banEl}><img className="hof-bannerimg" ref={bimg} src={bannerOf(m, d)} alt="" /></div>
            <div className="hof-tag"><span>HOF // {pad(idx + 1)}</span><i>_</i></div>
            <button className="hof-x" type="button" aria-label="Close" onClick={() => close()}>&times;</button>
            <div className="hof-body" ref={bodyEl}>
              <div className="hof-av" style={I(0)}>
                <img className="hof-avimg" src={avatarOf(d)} alt="" />
                <img className={'avatar-deco' + (deco ? ' is-on' : '')} src={deco || undefined} alt="" aria-hidden="true" />
                <span className="hof-dot" />
              </div>
              <h2 className="hof-name" ref={nameEl} style={I(1)} />
              <p className="hof-handle" style={I(2)}>{handleText(m, d)}</p>
              <div style={I(3)}><span className="hof-chip"><i /><span>{statusLabel(st)}</span></span></div>
              <p className="hof-bio" style={I(4)}>{bioText(m, d)}</p>
              <div className="hof-act" hidden={!act} style={I(5)}>
                <img alt="" hidden={!(act && act.img)} src={(act && act.img) || undefined} />
                <div>
                  <small style={{ color: act && act.img ? '#1db954' : 'rgba(255,255,255,.55)' }}>{act ? act.k.toUpperCase() : ''}</small>
                  <b>{act ? act.t : ''}</b><span>{act ? act.s : ''}</span>
                </div>
              </div>
              <div className="hof-stats" style={I(6)}>
                <div><small>Rank</small><b>#{pad(idx + 1)}</b></div>
                <div><small>Discord since</small><b>{since(m.discordId)}</b></div>
                <div><small>Presence</small><b>{statusLabel(st)}</b></div>
              </div>
              <div className="hof-actions" style={I(7)}>
                <a className="hof-btn primary" target="_blank" rel="noopener noreferrer" href={'https://discord.com/users/' + encodeURIComponent(m.discordId)}>Open in Discord</a>
                <button className="hof-btn" type="button" onClick={copy}>{copied ? 'Copied ✓' : 'Copy ID'}</button>
              </div>
              <div className="hof-hint" style={I(8)}>&larr; &rarr; browse &nbsp;&middot;&nbsp; esc close</div>
            </div>
          </div>
        </div>
        <button className="hof-nav" type="button" aria-label="Next member" onClick={() => go(1)}>&#8250;</button>
      </div>
    </div>
  );
}
