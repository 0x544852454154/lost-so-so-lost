import { useCallback, useEffect, useRef, useState } from 'react';
import Intro from './Intro.jsx';
import Nav from './Nav.jsx';
import HallOfFame from './HallOfFame.jsx';
import Members from './Members.jsx';
import { PresenceProvider } from './presence.jsx';
import { useRoute, useTheme, useMusic, useCardGlow, useBannerBackground } from './hooks.js';
import { SONG_URL } from './data.js';
import { reducedMotion } from './util.js';

const TITLES = { '/': 'lostboys', '/hall-of-fame': 'lostboys — Hall of Fame', '/members': 'lostboys — Members' };
const LABELS = { '/': 'Home', '/hall-of-fame': 'Hall of Fame', '/members': 'Members' };

export default function App() {
  const route = useRoute();
  const [theme, setTheme] = useTheme();
  const music = useMusic();
  const navRef = useRef();
  useCardGlow();
  useBannerBackground();

  /* intro -> leaving -> bg (the same overlay stays behind the site as the live background) */
  const [phase, setPhase] = useState('intro');
  const phaseRef = useRef('intro');
  const enter = useCallback(() => {
    if (phaseRef.current !== 'intro') return;
    phaseRef.current = 'leaving'; setPhase('leaving');
    setTimeout(() => { phaseRef.current = 'bg'; setPhase('bg'); }, 560);
  }, []);
  useEffect(() => { const t = setTimeout(enter, 15000); return () => clearTimeout(t); }, [enter]); // safety net

  useEffect(() => {
    document.body.classList.toggle('intro-active', phase === 'intro');
    document.body.classList.toggle('site-reveal', phase === 'bg');
    if (phase === 'bg') document.documentElement.classList.add('has-ambient');
  }, [phase]);

  /* route -> <html data-route>, title, presence */
  useEffect(() => {
    document.documentElement.setAttribute('data-route', route);
    document.title = TITLES[route];
  }, [route]);
  const [wantPresence, setWantPresence] = useState(false);
  useEffect(() => { if (route !== '/') setWantPresence(true); }, [route]);

  /* view swap: old view animates out, new one animates in */
  const [view, setView] = useState({ route, mode: '', base: 0 });
  const shown = useRef(route), swapT = useRef(0), siteIn = useRef(false);
  siteIn.current = phase === 'bg';
  useEffect(() => { if (phase === 'bg') setView((v) => ({ ...v, mode: 'in', base: 550 })); }, [phase]);
  useEffect(() => {
    if (shown.current === route) return;
    clearTimeout(swapT.current);
    const show = () => {
      shown.current = route;
      setView({ route, mode: siteIn.current ? 'in' : '', base: 0 });
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    };
    if (siteIn.current && !reducedMotion()) {
      setView((v) => ({ ...v, mode: 'out' }));
      swapT.current = setTimeout(show, 480);
      const n = navRef.current;
      if (n) { n.classList.remove('sq'); void n.offsetWidth; n.classList.add('sq'); }
    } else show();
    return () => clearTimeout(swapT.current);
  }, [route]);

  return (
    <PresenceProvider active={wantPresence}>
      <Intro phase={phase} route={route} onEnter={enter} />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Nav route={route} theme={theme} onTheme={setTheme} music={music} navRef={navRef} />
      <main id="main-content" tabIndex={-1}>
        <section className={`view active ${view.mode}`} style={{ '--base': view.base + 'ms' }} aria-label={LABELS[view.route]}>
          {view.route === '/hall-of-fame' && <HallOfFame />}
          {view.route === '/members' && <Members />}
        </section>
      </main>
      <audio ref={music.audio} src={SONG_URL} loop preload="metadata" />
    </PresenceProvider>
  );
}
