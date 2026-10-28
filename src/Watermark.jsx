import { useState } from 'react';
import { OWNER } from './guard.js';

/* Permanent, visible credit. If someone removes it, the site visibly says so
   (and the build's integrity check refuses to run on a stripped copy). */
const MARK = '\u00a9 ' + OWNER + ' \u00b7 do not copy';

export default function Watermark({ phase }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className={'wmark' + (phase === 'intro' ? ' hide' : '')} aria-hidden="true">
        {MARK.split('').map((ch, i) => <span key={i} style={{ '--i': i }}>{ch === ' ' ? '\u00a0' : ch}</span>)}
        <i className="wmark-tag">ORIGINAL</i>
      </div>
      <button className="wmark-info" type="button" aria-label="Credits and usage rights" onClick={() => setOpen(true)}>?</button>
      {open && (
        <div className="wmark-modal" role="dialog" aria-modal="true" aria-label="Credits and usage rights" onClick={() => setOpen(false)}>
          <div className="wmark-card" onClick={(e) => e.stopPropagation()}>
            <h2>{OWNER}</h2>
            <p>Design, code, animations, logo and artwork &copy; {OWNER}. All rights reserved.</p>
            <p>
              You may browse and link to this site. You may <b>not</b> copy, clone, re-upload or reuse any part of it
              &mdash; source, styles, effects, tags, member data or images &mdash; with or without credit, without written permission.
            </p>
            <p className="wmark-legal">Removing this notice or the ownership markers does not make a copy legal.</p>
            <button type="button" className="wmark-close" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
