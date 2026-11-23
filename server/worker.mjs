/* Librarium Online: the Cloudflare Worker in front of the game rooms.
 *
 *   POST /rooms               { game, variant, toggles }  → { code, token, seat: 0 }   a new room for that game, you in seat 0
 *   POST /rooms               {}                          → { code, token, seat: 0 }   a room with no game yet: either player suggests one
 *   GET  /rooms/CODE          (WebSocket)  ?token=…         join, or come back to, a room
 *   GET  /health              → ok
 *
 * Each room is a Durable Object of its own (room.mjs), named by its code. Everything runs on Cloudflare's free
 * plan: see docs/online.md for what it allows and what happens at its limits. */
import { Room } from './room.mjs';
import { ONLINE, cleanSettings } from './referee.mjs';
export { Room };

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L: easy to read out and type
const randomCode = (n = 6) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => CODE_CHARS[b % CODE_CHARS.length]).join(''); };
export const validCode = c => typeof c === 'string' && c.length === 6 && [...c].every(ch => CODE_CHARS.includes(ch));

// Which pages may use this server: ALLOWED_ORIGINS in wrangler.toml, a comma-separated list, or * for any.
function originOk(req, env) {
  const allowed = String(env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.includes('*')) return true;
  const o = req.headers.get('Origin');
  return !!o && allowed.includes(o);
}
function cors(req, env) {
  const o = req.headers.get('Origin');
  return { 'Access-Control-Allow-Origin': originOk(req, env) && o ? o : 'null', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}
const json = (body, status, headers) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url), h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (url.pathname === '/health') return json({ ok: true }, 200, h);
    if (!originOk(req, env)) return json({ error: 'This page may not use this server.' }, 403, h);

    if (url.pathname === '/rooms' && req.method === 'POST') {
      let body; try { body = await req.json(); } catch (e) { return json({ error: 'Bad request.' }, 400, h); }
      if (!body || typeof body !== 'object') return json({ error: 'Bad request.' }, 400, h);
      const game = body.game == null ? null : body.game; // no game: a room where the players choose one together
      if (game !== null && !ONLINE.has(game)) return json({ error: 'That table cannot be played online.' }, 400, h);
      const settings = cleanSettings(body);
      for (let tries = 0; tries < 5; tries++) { // a fresh code; another try in the unlikely case it is taken
        const code = randomCode(), stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const r = await stub.fetch('https://room/create', { method: 'POST', body: JSON.stringify({ code, game, settings }) });
        if (r.status === 409) continue;
        const out = await r.json();
        return json(out, r.status, h);
      }
      return json({ error: 'Could not open a room. Try again.' }, 503, h);
    }

    const m = /^\/rooms\/([A-Z0-9]{6})$/.exec(url.pathname);
    if (m && validCode(m[1])) {
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'Expected a WebSocket.' }, 426, h);
      return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
    }
    return json({ error: 'Not found.' }, 404, h);
  },
};
