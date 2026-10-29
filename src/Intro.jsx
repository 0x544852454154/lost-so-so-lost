import { useEffect, useRef, useState } from 'react';
import { LOGO } from './logoPaths.js';
import { isLowPower, reducedMotion } from './util.js';

const T = { start: 0.45, draw: 1.5, spread: 1.1, hold: 0.5, glint: 0.25 };
const RAMP = ' .,:;-=+*#%@', NK = RAMP.length;

/* Full-screen overlay: tag outline draws -> brushed-steel fill + glint, over live ASCII smoke.
   After entering, the same overlay drops behind the site (phase "bg") and stays as the background. */
export default function Intro({ phase, route, onEnter }) {
  const cvRef = useRef(), svgRef = useRef(), glintRef = useRef();
  const paths = useRef([]);
  const api = useRef({});
  const live = useRef({});
  live.current = { phase, route };
  const [ready, setReady] = useState(false);
  const [filled, setFilled] = useState(false);

  /* logo outline -> fill -> glint */
  useEffect(() => {
    const low = isLowPower();
    const timers = [];
    const after = (s, fn) => timers.push(setTimeout(fn, s * 1000));
    const items = paths.current.filter(Boolean)
      .map((p) => ({ p, x: p.getBBox().x, len: p.getTotalLength() }))
      .sort((a, b) => a.x - b.x); // write left -> right
    let sweeping = false;

    const sweep = () => {
      if (low || sweeping || !glintRef.current) return;
      sweeping = true;
      const t0 = performance.now(), dur = 1500, from = -400, to = 1900;
      (function f(t) {
        const k = Math.min(1, (t - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        if (glintRef.current) glintRef.current.setAttribute('x', from + (to - from) * e);
        if (k < 1) requestAnimationFrame(f); else sweeping = false;
      })(t0);
    };
    const finish = (quick) => {
      timers.forEach(clearTimeout);
      items.forEach((it) => { it.p.style.transition = quick ? 'stroke-dashoffset .35s ease' : 'none'; it.p.style.strokeDashoffset = 0; });
      setReady(true); setFilled(true);
    };
    api.current = { sweep, finish };

    const n = items.length;
    items.forEach((it, i) => {
      const { p, len } = it;
      p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
      void p.getBoundingClientRect();
      const delay = T.start + (i / Math.max(1, n - 1)) * T.spread;
      const dur = T.draw * (0.55 + 0.45 * Math.min(1, len / 1800));
      p.style.transition = `stroke-dashoffset ${dur}s cubic-bezier(.45,.05,.2,1) ${delay}s, opacity 1s ease, stroke-width 1s ease`;
      requestAnimationFrame(() => requestAnimationFrame(() => { p.style.strokeDashoffset = 0; }));
    });
    const fillAt = T.start + T.spread + T.draw + T.hold;
    after(fillAt, () => setFilled(true));
    after(fillAt + T.glint, sweep);
    after(fillAt + 0.2, () => setReady(true));
    if (reducedMotion()) finish(false);
    else if (low) finish(true);

    const iv = low ? 0 : setInterval(() => {              // re-glint now and then while Home is the background
      if (document.hidden || live.current.phase !== 'bg' || live.current.route !== '/') return;
      sweep();
    }, 9000);
    return () => { timers.forEach(clearTimeout); if (iv) clearInterval(iv); };
  }, []);

  useEffect(() => { if (phase === 'leaving' && api.current.sweep) api.current.sweep(); }, [phase]);

  /* ASCII smoke */
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const svgEl = svgRef.current;
    const low = isLowPower();
    let CELL = 12, cols = 0, rows = 0, W = 0, H = 0, dpr = 1, kArr = null, last = 0, raf = 0, resizeT = 0;
    let mx = -1, my = -1, tx = 0, ty = 0, px = 0, py = 0, depth = 0.75;
    const reduce = reducedMotion();
    const styles = Array.from({ length: NK }, (_, q) => `rgba(255,255,255,${(0.06 + 0.2 * (q / NK)).toFixed(3)})`);

    const fit = () => {
      W = window.innerWidth; H = window.innerHeight;
      // Keep the number of animated cells (and backing pixels) roughly constant
      // instead of growing with the screen. This is what keeps 4K / low-end GPUs
      // from trying to paint tens of thousands of glyphs every frame.
      const targetCells = low ? 3500 : 10000;
      const baseCell = W < 700 ? 14 : 12;
      CELL = Math.max(baseCell, Math.ceil(Math.sqrt((W * H) / targetCells)));
      const maxPx = low ? 1.1e6 : 2.4e6;
      dpr = Math.min(window.devicePixelRatio || 1, low ? 1 : 1.35, Math.sqrt(maxPx / Math.max(1, W * H)));
      dpr = Math.max(0.5, dpr);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(W / CELL); rows = Math.ceil(H / CELL);
      kArr = new Uint8Array(cols * rows);
      ctx.font = CELL + 'px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      ctx.textBaseline = 'top';
      last = 0;
    };
    const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
    const vnoise = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi,
        u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      return hash(xi, yi) * (1 - u) * (1 - v) + hash(xi + 1, yi) * u * (1 - v) + hash(xi, yi + 1) * (1 - u) * v + hash(xi + 1, yi + 1) * u * v;
    };
    const fbm = low
      ? (x, y) => vnoise(x, y) * 0.65 + vnoise(x * 2.3, y * 2.3) * 0.35
      : (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3) * 0.15;

    const frame = (t) => {
      if (document.hidden) { raf = 0; return; }
      raf = requestAnimationFrame(frame);
      const gap = low ? (live.current.phase === 'bg' ? 120 : 80) : (live.current.phase === 'bg' ? 55 : 40);
      if (t - last < gap) return;
      last = t;
      const s = reduce ? 0 : t * (low ? 0.00004 : 0.00006), cx = W / 2, cy = H / 2;
      depth += ((live.current.route === '/' ? 0.75 : 0.35) - depth) * 0.06;  // Home keeps the centre clear for the tag
      if (!low && svgEl) {
        px += (tx - px) * 0.08; py += (ty - py) * 0.08;
        svgEl.style.translate = (px * 16).toFixed(2) + 'px ' + (py * 10).toFixed(2) + 'px';
      }

      let i, j, idx = 0;
      for (j = 0; j < rows; j++) {
        for (i = 0; i < cols; i++, idx++) {
          const nx = i * 0.045, ny = j * 0.075;
          const w = fbm(nx + s * 3, ny - s * 2);
          let v = fbm(nx + w * 1.8 - s * 4, ny + w * 1.8 + s * 2.5);
          v = Math.max(0, (v - 0.38) * 2.2);
          const dx = (i * CELL - cx) / W, dy = (j * CELL - cy) / H;
          const vign = Math.min(1, Math.sqrt(dx * dx * 1.6 + dy * dy * 2.4) * 1.5);
          v *= 1 - depth + depth * vign;
          if (!low && mx >= 0) {
            const ddx = i * CELL - mx, ddy = j * CELL - my, d2 = ddx * ddx + ddy * ddy;
            if (d2 < 22500) v += (1 - Math.sqrt(d2) / 150) * 0.45;
          }
          const k = (v * NK) | 0; kArr[idx] = k >= NK ? NK - 1 : k;
        }
      }
      ctx.clearRect(0, 0, W, H);
      for (let k2 = 1; k2 < NK; k2++) {                    // one fillStyle per brightness bucket
        ctx.fillStyle = styles[k2]; const ch = RAMP[k2];
        for (idx = 0, j = 0; j < rows; j++) for (i = 0; i < cols; i++, idx++) if (kArr[idx] === k2) ctx.fillText(ch, i * CELL, j * CELL);
      }
      if (reduce) { cancelAnimationFrame(raf); raf = 0; }
    };

    const onResize = () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => { fit(); if (!raf) raf = requestAnimationFrame(frame); }, low ? 250 : 150);
    };
    const onMove = (e) => {
      if (low) return;
      mx = e.clientX; my = e.clientY;
      tx = e.clientX / window.innerWidth - 0.5; ty = e.clientY / window.innerHeight - 0.5;
    };
    const onLeave = () => { mx = my = -1; tx = ty = 0; };
    const onVis = () => {
      if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
      else if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
    };
    addEventListener('resize', onResize);
    addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
    document.addEventListener('visibilitychange', onVis);
    fit(); raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf); clearTimeout(resizeT);
      removeEventListener('resize', onResize);
      removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const intro = phase === 'intro';
  const cls = ['intro-overlay', phase !== 'intro' && 'is-leaving', phase === 'bg' && 'is-bg', ready && 'lb-ready', filled && 'lb-filled']
    .filter(Boolean).join(' ');
  const click = () => { if (!intro) return; api.current.finish(true); onEnter(); };

  return (
    <div id="introOverlay" className={cls}
      role={intro ? 'button' : undefined} tabIndex={intro ? 0 : -1}
      aria-label={intro ? 'Enter site' : undefined} aria-hidden={intro ? undefined : true}
      onClick={click}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); click(); } }}>
      <div className="intro-content">
        <div id="lbSmoke"><canvas id="asciiCanvas" ref={cvRef} aria-hidden="true" /></div>
        <svg id="lbLogo" ref={svgRef} viewBox="150 215 1395 500" aria-hidden="true" focusable="false">
          <defs>
            <filter id="lbBrushed" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.004 0.55" numOctaves="3" seed="7" result="n" />
              <feColorMatrix in="n" type="matrix" values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 1.6 -.35" result="grain" />
              <feComposite in="grain" in2="SourceGraphic" operator="in" />
            </filter>
            <linearGradient id="lbSteel" gradientUnits="userSpaceOnUse" x1="150" y1="215" x2="1545" y2="715">
              <stop offset="0" stopColor="#5d5d5d" /><stop offset=".18" stopColor="#e8e8e8" />
              <stop offset=".34" stopColor="#7c7c7c" /><stop offset=".52" stopColor="#f6f6f6" />
              <stop offset=".70" stopColor="#6a6a6a" /><stop offset=".86" stopColor="#d4d4d4" />
              <stop offset="1" stopColor="#8a8a8a" />
            </linearGradient>
            <linearGradient id="lbGlintG" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="240" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset=".5" stopColor="#fff" stopOpacity=".95" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <clipPath id="lbShape"><path clipRule="evenodd" d={LOGO.join('')} /></clipPath>
          </defs>
          <g id="lbMetal" clipPath="url(#lbShape)">
            <rect x="150" y="215" width="1395" height="500" fill="url(#lbSteel)" />
            <rect className="lb-brushed" x="150" y="215" width="1395" height="500" fill="#fff" filter="url(#lbBrushed)" opacity=".28" />
            <rect className="lb-glint" ref={glintRef} x="-400" y="150" width="240" height="640" fill="url(#lbGlintG)" transform="skewX(-18)" style={{ mixBlendMode: 'overlay' }} />
          </g>
          <g id="lbStrokes">
            {LOGO.map((d, i) => <path key={i} ref={(el) => { paths.current[i] = el; }} d={d} className="lb-stroke" />)}
          </g>
        </svg>
      </div>
      <div className="intro-scrim" aria-hidden="true" />
      <span className="intro-skip-hint">click to enter<span className="cur">_</span></span>
    </div>
  );
}
