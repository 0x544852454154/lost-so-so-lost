import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SONG_TITLE } from './data.js';

const MOON = ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'];
const SUN = ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M12 2v2', 'M12 20v2', 'M4.93 4.93l1.41 1.41', 'M17.66 17.66l1.41 1.41', 'M2 12h2', 'M20 12h2', 'M4.93 19.07l1.41-1.41', 'M17.66 6.34l1.41-1.41'];
const LINKS = [['/', 'Home'], ['/hall-of-fame', 'Hall of Fame'], ['/members', 'Members']];
const svgProps = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export default function Nav({ route, theme, onTheme, music, navRef }) {
  const [menu, setMenu] = useState(false);
  const linksRef = useRef(), pillRef = useRef();

  const place = () => {
    const pill = pillRef.current, a = linksRef.current && linksRef.current.querySelector('[aria-current="page"]');
    if (!pill) return;
    if (!a || !a.offsetWidth) { pill.style.opacity = 0; return; }
    pill.style.width = a.offsetWidth + 'px'; pill.style.transform = `translateX(${a.offsetLeft}px)`; pill.style.opacity = 1;
  };
  useLayoutEffect(place, [route]);
  useEffect(() => {
    const onResize = () => { place(); if (innerWidth >= 768) setMenu(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenu(false); };
    addEventListener('resize', onResize); document.addEventListener('keydown', onKey);
    if (document.fonts) document.fonts.ready.then(place);
    return () => { removeEventListener('resize', onResize); document.removeEventListener('keydown', onKey); };
  }, []);

  const link = (r, label, i, nav = true) => (
    <a key={r + label} className="nav-link" href={'#' + r} data-route={r} data-nav={nav ? '' : undefined}
      aria-current={nav && route === r ? 'page' : undefined} style={{ '--n': i }}>{label}</a>
  );
  const playing = music.playing;
  const label = playing ? 'Pause background music' : 'Play background music';

  return (
    <nav className="nav" ref={navRef} aria-label="Main">
      <div className="nav-inner">
        <div className="nav-right">
          <div className="nav-links" ref={linksRef}>
            <i className="nav-pill" ref={pillRef} aria-hidden="true" />
            {LINKS.map(([r, l], i) => link(r, l, i))}
          </div>
          <span className="divider" aria-hidden="true" />
          <button className="icon-btn md-only" type="button" aria-label="Sign in" title="Sign in" style={{ '--n': 3 }}>
            <svg {...svgProps}><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></svg>
          </button>
          <span className="divider" aria-hidden="true" />
          <button className="icon-btn" type="button" id="musicBtn" aria-label={label} title={label} aria-pressed={playing} onClick={music.toggle} style={{ '--n': 4 }}>
            <svg {...svgProps}>
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
              {!playing && <line x1="2" y1="2" x2="22" y2="22" />}
            </svg>
          </button>
          <button className="icon-btn" type="button" id="themeBtn" aria-label="Toggle theme" title="Toggle theme" style={{ '--n': 5 }}
            onClick={() => onTheme(theme === 'light' ? 'dark' : 'light')}>
            <svg {...svgProps}>{(theme === 'light' ? SUN : MOON).map((d) => <path key={d} d={d} />)}</svg>
          </button>
          <button className="icon-btn md-hide" type="button" aria-label="Open menu" aria-expanded={menu} aria-controls="mobileMenu" onClick={() => setMenu((m) => !m)}>
            <svg {...svgProps}><path d="M4 5h16" /><path d="M4 12h16" /><path d="M4 19h16" /></svg>
          </button>
        </div>
      </div>
      <div className={'island-live' + (playing ? ' on' : '')} id="islandLive" aria-live="polite">
        <span className="eq" aria-hidden="true"><i /><i /><i /><i /></span>
        <span>Now playing · <b id="islandTitle">{SONG_TITLE}</b></span>
      </div>
      <div className={'mobile-menu' + (menu ? ' open' : '')} id="mobileMenu" onClick={(e) => { if (e.target.closest('a')) setMenu(false); }}>
        {LINKS.map(([r, l], i) => link(r, l, i))}
        {link('/login', 'Sign in', 3, false)}
      </div>
    </nav>
  );
}
