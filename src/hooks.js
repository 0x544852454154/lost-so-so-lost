import { useCallback, useEffect, useRef, useState } from 'react';
import { isLowPower } from './util.js';

const parse = () => {
  const h = location.hash.replace(/^#/, '') || '/';
  return h === '/hall-of-fame' || h === '/members' ? h : '/';
};
export function useRoute() {
  const [r, setR] = useState(parse);
  useEffect(() => {
    const f = () => setR(parse());
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return r;
}

export function useTheme() {
  const [theme, setT] = useState(() => (document.documentElement.classList.contains('light') ? 'light' : 'dark'));
  const set = useCallback((t) => {
    const r = document.documentElement;
    r.classList.toggle('light', t === 'light'); r.classList.toggle('dark', t !== 'light');
    r.style.colorScheme = t === 'light' ? 'light' : 'dark';
    try { localStorage.setItem('theme', t); } catch {}
    setT(t);
  }, []);
  return [theme, set];
}

export function useMusic() {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const play = useCallback(() => {
    const a = audio.current; if (!a) return;
    a.volume = 0.35;
    const p = a.play();
    if (p && p.then) p.then(() => { try { localStorage.setItem('music', 'on'); } catch {} }).catch(() => setPlaying(false));
  }, []);
  const toggle = useCallback(() => {
    const a = audio.current; if (!a) return;
    if (a.paused) play(); else { a.pause(); try { localStorage.setItem('music', 'off'); } catch {} }
  }, [play]);

  useEffect(() => {
    const a = audio.current; if (!a) return;
    const on = () => setPlaying(true), off = () => setPlaying(false);
    a.addEventListener('play', on); a.addEventListener('pause', off);
    let wanted = false; try { wanted = localStorage.getItem('music') === 'on'; } catch {}
    const kick = () => { if (a.paused) play(); };
    if (wanted) {
      play();
      ['pointerdown', 'keydown', 'touchstart'].forEach((e) => document.addEventListener(e, kick, { once: true }));
    }
    return () => {
      a.removeEventListener('play', on); a.removeEventListener('pause', off);
      ['pointerdown', 'keydown', 'touchstart'].forEach((e) => document.removeEventListener(e, kick));
    };
  }, [play]);

  return { audio, playing, toggle };
}

/* cursor glow on cards */
export function useCardGlow() {
  useEffect(() => {
    if (isLowPower() || matchMedia('(hover:none)').matches) return;
    let raf = 0, ev = null;
    const apply = () => {
      raf = 0;
      const e = ev; if (!e) return;
      const t = e.target.closest && e.target.closest('.aff-card,.grid-card,.fame-card'); if (!t) return;
      const r = t.getBoundingClientRect();
      t.style.setProperty('--mx', e.clientX - r.left + 'px'); t.style.setProperty('--my', e.clientY - r.top + 'px');
    };
    const f = (e) => { ev = e; if (!raf) raf = requestAnimationFrame(apply); };
    document.addEventListener('pointermove', f, { passive: true });
    return () => { document.removeEventListener('pointermove', f); cancelAnimationFrame(raf); };
  }, []);
}

/* hovering a banner turns it into the page background; leaving fades back to the ASCII */
export function useBannerBackground() {
  useEffect(() => {
    if (isLowPower() || matchMedia('(hover:none)').matches) return;
    const L = [document.createElement('div'), document.createElement('div')], root = document.documentElement;
    let k = 0, cur = null;
    L.forEach((d) => { d.className = 'bgban'; d.setAttribute('aria-hidden', 'true'); document.body.appendChild(d); });
    const reset = () => { cur = null; L.forEach((d) => d.classList.remove('on')); root.classList.remove('banner-bg'); };
    const src = (c) => { const im = c.querySelector('.fame-card-bg') || c.querySelector('img'); return im && (im.currentSrc || im.src); };
    const over = (e) => {
      if (e.pointerType === 'touch') return;
      const c = e.target.closest && e.target.closest('.carousel-card,.fame-card,.gm-card');
      if (c === cur) return;
      if (!c) { reset(); return; }
      const u = src(c); if (!u) return;
      cur = c; k ^= 1;
      L[k].style.backgroundImage = 'url("' + u.replace(/"/g, '%22') + '")';
      L[k].classList.add('on'); L[k ^ 1].classList.remove('on'); root.classList.add('banner-bg');
    };
    document.addEventListener('pointerover', over, { passive: true });
    root.addEventListener('mouseleave', reset);
    return () => {
      document.removeEventListener('pointerover', over); root.removeEventListener('mouseleave', reset);
      reset(); L.forEach((d) => d.remove());
    };
  }, []);
}
