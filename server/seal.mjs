/* Saved online games: sealed so that the players can keep them but cannot read or change them.
 *
 * A saved game holds the whole game, both hands and the stock included, so it is compressed, then encrypted
 * and signed with AES-GCM under a key only the server knows. A player's file carries the sealed text with a few
 * plain words beside it (which game, when) for the page to show; the server trusts only what it unseals. A file
 * that was changed, or made by another server, does not unseal.
 *
 * The key is the SAVE_KEY secret if one is set (32 random bytes, base64), or else one the server makes for
 * itself the first time it is needed and keeps in a Durable Object of its own (room.mjs, "keys"). */
const AAD = new TextEncoder().encode('librarium-save-v1');
const PREFIX = 'L1.';
const MAX_PLAIN = 4 * 1024 * 1024; // a saved game unpacks to well under a megabyte

const toB64 = u8 => {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64 = s => {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('not base64');
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
};
export const keyFromBase64 = s => { const k = fromB64(String(s).trim().replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')); if (k.length !== 32) throw new Error('SAVE_KEY must be 32 bytes'); return k; };
export const newKey = () => crypto.getRandomValues(new Uint8Array(32));

async function squeeze(u8, kind) {
  const stream = new Blob([u8]).stream().pipeThrough(kind === 'in' ? new CompressionStream('gzip') : new DecompressionStream('gzip'));
  const reader = stream.getReader(), parts = []; let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length; if (n > MAX_PLAIN) { reader.cancel(); throw new Error('too large'); }
    parts.push(value);
  }
  const out = new Uint8Array(n); let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
const aesKey = (raw, use) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, [use]);

// Any plain JSON value → the sealed text.
export async function seal(raw, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = await squeeze(new TextEncoder().encode(JSON.stringify(value)), 'in');
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, await aesKey(raw, 'encrypt'), body));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return PREFIX + toB64(out);
}
// The sealed text → the value; throws if it was changed, or sealed under another key.
export async function unseal(raw, text) {
  if (typeof text !== 'string' || !text.startsWith(PREFIX)) throw new Error('not a sealed game');
  const all = fromB64(text.slice(PREFIX.length));
  if (all.length < 12 + 16) throw new Error('not a sealed game');
  const body = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.subarray(0, 12), additionalData: AAD }, await aesKey(raw, 'decrypt'), all.subarray(12));
  return JSON.parse(new TextDecoder().decode(await squeeze(new Uint8Array(body), 'out')));
}
