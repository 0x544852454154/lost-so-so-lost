import { createContext, useContext, useEffect, useState } from 'react';
import { MEMBERS, HALL_OF_FAME } from './data.js';

const REST = 'https://api.lanyard.rest/v1/users/';
const WS_URL = 'wss://api.lanyard.rest/socket';

export const ALL_IDS = [...new Set(MEMBERS.concat(HALL_OF_FAME).map((m) => m.discordId).filter((id) => id && !id.startsWith('REPLACE_WITH')))];

const Ctx = createContext({});
export const usePresence = () => useContext(Ctx);

/* Lanyard websocket (falls back to REST). Connects once `active` is true. */
export function PresenceProvider({ active, children }) {
  const [cache, setCache] = useState({});

  useEffect(() => {
    if (!active || !ALL_IDS.length) return;
    let ws = null, hb = null, rt = null, it = null, closed = false, got = false;
    const put = (id, d) => setCache((c) => ({ ...c, [id]: d }));
    const rest = () => ALL_IDS.forEach((id) =>
      fetch(REST + id).then((r) => r.json()).then((j) => { if (j && j.success && j.data) put(id, j.data); }).catch(() => {}));

    const connect = () => {
      ws = new WebSocket(WS_URL); got = false;
      it = setTimeout(() => { if (!got) rest(); }, 5000);
      ws.onopen = () => ws.send(JSON.stringify({ op: 2, d: { subscribe_to_ids: ALL_IDS } }));
      ws.onmessage = (ev) => {
        let msg; try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.op === 1 && msg.d && msg.d.heartbeat_interval) {
          clearInterval(hb);
          hb = setInterval(() => ws && ws.readyState === 1 && ws.send(JSON.stringify({ op: 3 })), msg.d.heartbeat_interval);
        }
        if (msg.op === 0 && msg.t === 'INIT_STATE') { got = true; clearTimeout(it); setCache((c) => ({ ...c, ...(msg.d || {}) })); }
        if (msg.op === 0 && msg.t === 'PRESENCE_UPDATE' && msg.d && msg.d.user_id) put(msg.d.user_id, msg.d);
      };
      ws.onclose = () => {
        clearTimeout(it); clearInterval(hb);
        if (closed) return;
        rest();
        rt = setTimeout(connect, 10000);
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => { closed = true; clearTimeout(it); clearTimeout(rt); clearInterval(hb); if (ws) ws.close(); };
  }, [active]);

  return <Ctx.Provider value={cache}>{children}</Ctx.Provider>;
}
