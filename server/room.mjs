/* A room: two people and the game between them, as a Durable Object named by the room's code.
 *
 * A room is opened in one of two ways. From a table (the Opponent row's Online), it is that table's room: the
 * game begins when the friend joins, and Play again starts another of the same. From the Games Desk, it is a
 * room with no game yet: either player suggests one (or a saved game to carry on), the other accepts or
 * declines, and once a game is over, or whenever they like, they can suggest the next.
 *
 * The room holds the referee (referee.mjs), which holds the game. Players connect by WebSocket; the room
 * uses Cloudflare's hibernation API, so a room whose players are thinking costs nothing, and it keeps the
 * referee in its own storage after every action, so it wakes with the game where it was. Each seat has a
 * token, given when the seat is taken and kept by that player's browser, so the same player can come back
 * after a lost connection and nobody else can take their seat.
 *
 * Room seats and game seats: seat 0 is the player who opened the room, seat 1 the friend who joined. In the
 * game, the one who suggested it moves first (game seat 0), and a saved game puts each player back in the
 * seat they had, so a game can have the two the other way round (meta.flip). Every message about the game is
 * in game seats, and the page is told which is its own (snapshot.you).
 *
 * Every state a player is sent is that seat's view (Referee.snapshotFor, eventsFor): at a card table, the other
 * hand, the stock and anything else face down are sent as card backs, never as the cards (docs/online.md).
 *
 * Messages from a player:  { t: 'throw' } { t: 'choose', i } { t: 'pass' } { t: 'again' } { t: 'leave' } { t: 'sync' }
 *                          { t: 'propose', game, variant, toggles } or { t: 'propose', save } { t: 'answer', yes } { t: 'withdraw' }
 *                          { t: 'save' } and 'ping'
 * Messages to a player:    welcome, snapshot, events, proposal, saved, presence, error, full, gone, replaced, left
 *                          (see docs/online.md) */
import { DurableObject } from 'cloudflare:workers';
import R from '../js/rules.js';
import { Referee, ONLINE, cleanSettings } from './referee.mjs';
import { seal, unseal, newKey, keyFromBase64 } from './seal.mjs';

const HOUR = 3600 * 1000;
const WAIT_FOR_FRIEND = 24 * HOUR; // an unused room, or one both players have left, is cleared after a day
const MAX_MSG = 2000, MAX_SAVE_MSG = 200000; // a saved game's sealed text is at most about 40 KB
const SAVE_VERSION = 1;
const randomToken = () => { const a = new Uint8Array(18); crypto.getRandomValues(a); return btoa(String.fromCharCode(...a)).replace(/[+/=]/g, ''); };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// The key that seals saved games: the SAVE_KEY secret, or the server's own, kept by the "keys" object.
let sealKey = null;
async function keyFor(env) {
  if (sealKey) return sealKey;
  if (env.SAVE_KEY) return (sealKey = keyFromBase64(env.SAVE_KEY));
  const r = await env.ROOMS.get(env.ROOMS.idFromName('__keys')).fetch('https://room/key');
  return (sealKey = new Uint8Array(await r.arrayBuffer()));
}

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.meta = undefined; this.ref = undefined;
    // A bare "ping" is answered without waking the room, so keeping a connection alive is free.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }
  async load() {
    if (this.meta !== undefined) return;
    this.meta = (await this.ctx.storage.get('meta')) || null;
    const p = await this.ctx.storage.get('ref');
    this.ref = p ? Referee.unpack(R, p) : null;
  }
  async saveMeta() { this.meta.touched = Date.now(); await this.ctx.storage.put('meta', this.meta); }
  async saveRef() { await this.ctx.storage.put('ref', this.ref ? this.ref.pack() : null); }
  sockets(seat) { return this.ctx.getWebSockets(seat === undefined ? undefined : 'seat' + seat); }
  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch (e) { /* closed */ } }
  sendTo(seat, msg) { for (const ws of this.sockets(seat)) this.send(ws, msg); }
  online(seat) { return this.sockets(seat).length > 0; }

  // A room seat's seat in the game.
  gs(seat) { return this.meta.flip ? 1 - seat : seat; }
  // What one seat is shown of the game: the referee's view for that seat (the other hand face down).
  snapshotFor(seat) { const s = this.ref.snapshotFor(this.gs(seat)); s.you = this.gs(seat); return s; }
  eventsFor(seat, events) { return this.ref.eventsFor(this.gs(seat), events); }
  broadcast(events) { for (const seat of [0, 1]) this.sendTo(seat, { t: 'events', events: this.eventsFor(seat, events) }); }
  // The suggestion on the table, as the players see it: who made it (room seat), the game and its settings,
  // and for a saved game, when it was saved and how far it had got.
  proposalView() { const p = this.meta.proposal; return p ? { by: p.by, game: p.game, settings: p.settings, resume: p.resume || null } : null; }
  sendProposal(extra) { for (const s of [0, 1]) this.sendTo(s, Object.assign({ t: 'proposal', proposal: this.proposalView() }, extra)); }

  // A game begins: a new one, or a saved one where it was.
  async begin(game, settings, flip, packed) {
    let events;
    if (packed) { this.ref = Referee.unpack(R, packed); events = []; } else { this.ref = new Referee(R, game, settings); events = this.ref.start(); }
    Object.assign(this.meta, { game, settings: this.ref.settings, flip: !!flip, proposal: null });
    await this.ctx.storage.delete('pending');
    await this.saveRef(); await this.saveMeta();
    for (const s of [0, 1]) this.sendTo(s, { t: 'snapshot', snap: this.snapshotFor(s), events: this.eventsFor(s, events), fresh: true, resumed: !!packed });
  }

  async fetch(req) {
    const url = new URL(req.url);
    // The server's own key for sealing saved games (only ever asked for by a room, under the name "__keys").
    if (url.pathname === '/key') {
      let k = await this.ctx.storage.get('sealKey');
      if (!k) { k = newKey(); await this.ctx.storage.put('sealKey', k); }
      return new Response(k);
    }
    await this.load();
    if (url.pathname === '/create') {
      if (this.meta) return json({ error: 'taken' }, 409);
      const { code, game, settings } = await req.json();
      if (game !== null) { try { new Referee(R, game, settings); } catch (e) { return json({ error: 'That table cannot be played online.' }, 400); } }
      this.meta = { code, game, settings, lobby: game === null, flip: false, proposal: null, tokens: [randomToken(), null], created: Date.now(), left: [false, false] };
      await this.saveMeta();
      await this.ctx.storage.setAlarm(Date.now() + WAIT_FOR_FRIEND);
      return json({ code, token: this.meta.tokens[0], seat: 0, game, settings, lobby: this.meta.lobby });
    }

    // A player connecting.
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    const token = url.searchParams.get('token') || '';
    if (!this.meta) {
      this.ctx.acceptWebSocket(server, ['gone']); this.send(server, { t: 'gone' }); server.close(4404, 'gone');
      return new Response(null, { status: 101, webSocket: client });
    }
    let seat = token ? this.meta.tokens.indexOf(token) : -1;
    if (seat < 0) {
      if (this.meta.tokens[1] === null) { seat = 1; this.meta.tokens[1] = randomToken(); await this.saveMeta(); }
      else { this.ctx.acceptWebSocket(server, ['full']); this.send(server, { t: 'full' }); server.close(4409, 'full'); return new Response(null, { status: 101, webSocket: client }); }
    }
    for (const old of this.sockets(seat)) { this.send(old, { t: 'replaced' }); try { old.close(4000, 'replaced'); } catch (e) { /* gone */ } }
    this.ctx.acceptWebSocket(server, ['seat' + seat]);
    server.serializeAttachment({ seat });
    this.meta.left[seat] = false; await this.saveMeta();
    this.send(server, { t: 'welcome', seat, token: this.meta.tokens[seat], code: this.meta.code, game: this.meta.game, settings: this.meta.settings, lobby: !!this.meta.lobby,
      opponent: this.online(1 - seat), friendJoined: !!this.meta.tokens[1], playing: !!this.ref && this.ref.phase !== 'over', proposal: this.proposalView() });
    this.sendTo(1 - seat, { t: 'presence', seat, online: true });
    if (!this.ref && this.meta.tokens[1] && !this.meta.lobby) await this.begin(this.meta.game, this.meta.settings, false); // a table's room: the game begins
    else if (this.ref) this.send(server, { t: 'snapshot', snap: this.snapshotFor(seat) }); // the game as it is (the page decides whether to sit down)
    await this.ctx.storage.setAlarm(Date.now() + WAIT_FOR_FRIEND);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    await this.load();
    const att = ws.deserializeAttachment(); if (!att || !this.meta) return;
    const seat = att.seat;
    if (typeof raw !== 'string' || raw.length > MAX_SAVE_MSG) return;
    let msg; try { msg = JSON.parse(raw); } catch (e) { return; }
    if (!msg || typeof msg !== 'object' || (msg.t !== 'propose' && raw.length > MAX_MSG)) return;
    const refuse = text => this.send(ws, { t: 'error', msg: text });
    if (msg.t === 'leave') { this.meta.left[seat] = true; await this.saveMeta(); this.sendTo(1 - seat, { t: 'left', seat }); try { ws.close(1000, 'left'); } catch (e) { /* gone */ } return; }

    // The game as it is, for a page coming back to the table (or the room's suggestion, when there is no game).
    if (msg.t === 'sync') {
      if (this.ref) this.send(ws, { t: 'snapshot', snap: this.snapshotFor(seat) });
      else this.send(ws, { t: 'proposal', proposal: this.proposalView() });
      return;
    }

    // Suggesting a game: a new one at a table and its settings, or a saved game (its sealed text).
    if (msg.t === 'propose') {
      if (!this.meta.lobby) return refuse('This room is for one table. Open a room at the Games Desk to choose games together');
      let proposal;
      if (msg.save !== undefined) {
        let d;
        try { d = await unseal(await keyFor(this.env), msg.save); } catch (e) { return refuse('That file is not a saved game from these Archives, or it has been changed'); }
        let ref;
        try {
          if (!d || d.v !== SAVE_VERSION || !d.ref || !ONLINE.has(d.ref.id)) throw new Error('old');
          ref = Referee.unpack(R, d.ref);
        } catch (e) { return refuse('That saved game cannot be carried on here'); }
        if (ref.phase === 'over') return refuse('That game was already over');
        await this.ctx.storage.put('pending', d.ref);
        proposal = { by: seat, game: ref.id, settings: ref.settings, seatWanted: d.seat === 1 ? 1 : 0, resume: { saved: String(d.at || ''), turns: ref.turns | 0 } };
      } else {
        if (!ONLINE.has(msg.game)) return refuse('That table cannot be played online');
        const settings = cleanSettings(msg);
        try { new Referee(R, msg.game, settings); } catch (e) { return refuse('That table cannot be played online'); }
        proposal = { by: seat, game: msg.game, settings };
      }
      this.meta.proposal = proposal; await this.saveMeta();
      this.sendProposal();
      return;
    }
    if (msg.t === 'withdraw') {
      const p = this.meta.proposal;
      if (!p || p.by !== seat) return;
      this.meta.proposal = null; await this.saveMeta(); await this.ctx.storage.delete('pending');
      this.sendProposal({ withdrawn: seat });
      return;
    }
    // Accepting or declining the other player's suggestion. The one who suggested a new game moves first; a
    // saved game puts the one who brought it back in the seat they had.
    if (msg.t === 'answer') {
      const p = this.meta.proposal;
      if (!p || p.by === seat) return refuse('There is no suggestion to answer');
      if (!msg.yes) { this.meta.proposal = null; await this.saveMeta(); await this.ctx.storage.delete('pending'); this.sendProposal({ declined: seat }); return; }
      if (p.resume) {
        const packed = await this.ctx.storage.get('pending');
        if (!packed) { this.meta.proposal = null; await this.saveMeta(); this.sendProposal(); return refuse('That saved game is no longer here. Ask your friend to upload it again'); }
        await this.begin(p.game, p.settings, p.by !== p.seatWanted, packed);
      } else await this.begin(p.game, p.settings, p.by === 1);
      return;
    }

    if (!this.ref) return refuse(this.meta.lobby ? 'No game has been chosen yet' : 'Your friend has not joined yet');
    // The game so far, sealed into a file for this player to keep.
    if (msg.t === 'save') {
      if (this.ref.phase === 'over') return refuse('The game is over: there is nothing to save');
      const at = new Date().toISOString();
      try {
        const sealed = await seal(await keyFor(this.env), { v: SAVE_VERSION, at, seat: this.gs(seat), ref: this.ref.pack() });
        this.send(ws, { t: 'saved', game: this.ref.id, settings: this.ref.settings, at, seat: this.gs(seat), turns: this.ref.turns, sealed });
      } catch (e) { refuse('The game could not be saved just now. Try again in a moment'); }
      return;
    }
    let events;
    try {
      const me = this.gs(seat);
      if (msg.t === 'throw') events = this.ref.throw(me);
      else if (msg.t === 'choose') events = this.ref.choose(me, msg.i | 0, false);
      else if (msg.t === 'pass') events = this.ref.choose(me, 0, true);
      else if (msg.t === 'again') {
        if (this.ref.phase !== 'over') throw new Error('the game is still going');
        await this.begin(this.meta.game, this.meta.settings, this.meta.flip);
        return;
      } else return;
    } catch (e) {
      // Out of turn, or a move that was not offered: say so, and send the game as it is, in case the page drifted.
      this.send(ws, { t: 'error', msg: String(e && e.message || e) });
      this.send(ws, { t: 'snapshot', snap: this.snapshotFor(seat) });
      return;
    }
    await this.saveRef(); await this.saveMeta();
    this.broadcast(events);
  }

  async webSocketClose(ws) {
    const att = ws.deserializeAttachment();
    if (!att) return;
    await this.load();
    if (!this.sockets(att.seat).some(x => x !== ws && x.readyState === 1)) this.sendTo(1 - att.seat, { t: 'presence', seat: att.seat, online: false });
  }
  async webSocketError(ws) { return this.webSocketClose(ws); }

  // A room nobody has used for a day is cleared, game and all.
  async alarm() {
    await this.load();
    if (!this.meta) return;
    const idle = Date.now() - (this.meta.touched || this.meta.created);
    if (this.sockets().some(ws => ws.readyState === 1) || idle < WAIT_FOR_FRIEND) { await this.ctx.storage.setAlarm(Date.now() + WAIT_FOR_FRIEND); return; }
    await this.ctx.storage.deleteAll();
    this.meta = null; this.ref = null;
  }
}
