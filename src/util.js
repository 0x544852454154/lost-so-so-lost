export const pad = (n) => (n < 10 ? '0' + n : String(n));
export const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';
let rmQuery;
export const reducedMotion = () => {
  if (typeof window === 'undefined') return false;
  if (!rmQuery) rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  return rmQuery.matches;
};

/* Touch / low-memory / reduced-motion devices get the calm version of the site:
   fewer canvas cells, lower frame rate and no expensive blur/filter effects.
   index.html sets data-perf before first paint so CSS can opt in immediately. */
let lowPower;
export function isLowPower() {
  if (lowPower !== undefined) return lowPower;
  try {
    if (typeof document !== 'undefined') {
      const attr = document.documentElement.getAttribute('data-perf');
      if (attr) return (lowPower = attr === 'low');
    }
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return (lowPower = false);
    const m = window.matchMedia ? window.matchMedia.bind(window) : null;
    const n = navigator;
    lowPower = !!(
      reducedMotion() ||
      (m && m('(pointer: coarse)').matches) ||
      (n.connection && n.connection.saveData) ||
      (typeof n.deviceMemory === 'number' && n.deviceMemory <= 4) ||
      (typeof n.hardwareConcurrency === 'number' && n.hardwareConcurrency <= 4)
    );
    if (lowPower && typeof document !== 'undefined') document.documentElement.setAttribute('data-perf', 'low');
  } catch {
    lowPower = false;
  }
  return lowPower;
}
export const calmMotion = () => reducedMotion() || isLowPower();

export function displayName(member, data) {
  const u = data && data.discord_user;
  if (u) { const n = u.global_name || u.display_name || u.username; if (n && String(n).trim()) return n; }
  return (member && member.name) || '...';
}
export function handleText(member, data) {
  const u = data && data.discord_user;
  if (u && u.username) return '@' + u.username;
  return (member && member.handle) || '';
}
const kv = (data, key) => {
  const k = data && data.kv;
  return k && k[key] && String(k[key]).trim() ? String(k[key]).trim() : '';
};
export const roleText = (m, d) => kv(d, 'role') || (m && m.role) || '';
export function decoUrl(user) {
  if (!user) return null;
  const d = user.avatar_decoration_data;
  const asset = d && d.asset ? d.asset : user.avatar_decoration || null;
  return asset ? 'https://cdn.discordapp.com/avatar-decoration-presets/' + asset + '.png' : null;
}
export function customStatusText(data) {
  if (!data || !Array.isArray(data.activities)) return '';
  for (const a of data.activities) {
    if (a && a.type === 4) return ((a.emoji && a.emoji.name ? a.emoji.name + ' ' : '') + (a.state || '')).trim();
  }
  return '';
}
export const bioText = (m, d) => customStatusText(d) || kv(d, 'bio') || (m && m.bio) || '';

export const getAvatarUrl = (id, hash) =>
  hash ? `https://cdn.discordapp.com/avatars/${id}/${hash}.${hash.startsWith('a_') ? 'gif' : 'png'}?size=512` : DEFAULT_AVATAR;
export const getBannerUrl = (id, hash) =>
  hash ? `https://cdn.discordapp.com/banners/${id}/${hash}.${hash.startsWith('a_') ? 'gif' : 'png'}?size=600` : null;
export function defaultAvatar(id) {
  try { return 'https://cdn.discordapp.com/embed/avatars/' + Number((BigInt(id) >> BigInt(22)) % BigInt(6)) + '.png'; }
  catch { return DEFAULT_AVATAR; }
}
export const avatarOf = (d) => (d && d.discord_user ? getAvatarUrl(d.discord_user.id, d.discord_user.avatar) : DEFAULT_AVATAR);
export const bannerOf = (m, d) => {
  const u = d && d.discord_user;
  return m.banner || (u ? getBannerUrl(u.id, u.banner) || getAvatarUrl(u.id, u.avatar) : defaultAvatar(m.discordId));
};

export const statusLabel = (s) => (s === 'online' ? 'Online' : s === 'idle' ? 'Idle' : s === 'dnd' ? 'Do Not Disturb' : 'Offline');

export function activityLabel(data) {
  if (!data) return null;
  if (data.listening_to_spotify && data.spotify)
    return { type: 'spotify', text: data.spotify.song + ' — ' + data.spotify.artist, icon: data.spotify.album_art_url };
  const acts = data.activities;
  if (!acts || !acts.length) return null;
  const a = acts[0];
  const prefix = ['Playing', 'Streaming', 'Listening', 'Watching', 'Doing', 'Competing'][a.type] || 'Doing';
  return { type: 'activity', text: prefix + ' ' + (a.name || ''), icon: null };
}

export const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u.trim()) ? u.trim() : '');
export function handleFromUrl(u) {
  try { const p = new URL(u).pathname.split('/').filter(Boolean); return p.length ? '@' + p[0] : ''; }
  catch { return ''; }
}

/* text that decodes out of ASCII noise */
export function scramble(el, text, dur) {
  const tok = (el.__scr = (el.__scr || 0) + 1);
  if (calmMotion() || !text) { el.textContent = text; return; }
  const set = '.:-=+*#%@01/\\', t0 = performance.now();
  (function f(t) {
    if (el.__scr !== tok) return;
    const k = Math.min(1, (t - t0) / dur), n = Math.floor(k * text.length);
    let s = '';
    for (let i = 0; i < text.length; i++) s += i < n || text[i] === ' ' ? text[i] : set[(Math.random() * set.length) | 0];
    el.textContent = s;
    if (k < 1) requestAnimationFrame(f);
  })(t0);
}
