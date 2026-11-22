/* A room: one game between two people, as a Durable Object named by the room's code.
 *
 * The room holds the referee (referee.mjs), which holds the game. Players connect by WebSocket; the room
 * uses Cloudflare's hibernation API, so a room whose players are thinking costs nothing, and it keeps the
 * referee in its own storage after every action, so it wakes with the game where it was. Each seat has a
 * token, given when the seat is taken and kept by that player's browser, so the same player can come back
 * after a lost connection and nobody else can take their seat.
 *
 * Every state a player is sent goes through viewOf(game, seat, state) first: today the whole state, as every
 * online table shows everything to both players; for card games it will be that seat's view, with the other
 * hand and the stock face down (docs/online.md).
 *
 * Messages from a player:  { t: 'throw' } { t: 'choose', i } { t: 'pass' } { t: 'again' } { t: 'leave' } and 'ping'
 * Messages to a player:    welcome, snapshot, events, presence, error, full, gone, replaced, left (see docs/online.md) */
import { DurableObject } from 'cloudflare:workers';
import R from '../js/rules.js';
import { Referee, viewOf } from './referee.mjs';

const HOUR = 3600 * 1000;
const WAIT_FOR_FRIEND = 24 * HOUR; // an unused room, or one both players have left, is cleared after a day
const randomToken = () => { const a = new Uint8Array(18); crypto.getRandomValues(a); return btoa(String.fromCharCode(...a)).replace(/[+/=]/g, ''); };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

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

  // What one seat is shown of the game.
  snapshotFor(seat) {
    const s = this.ref.snapshot();
    s.state = viewOf(this.ref.id, seat, s.state);
    if (s.cur !== seat) s.moves = []; // the other player's choices are theirs
    return s;
  }
  eventsFor(seat, events) {
    return events.map(e => {
      if (e.type === 'move') return Object.assign({}, e, { before: viewOf(this.ref.id, seat, e.before), state: viewOf(this.ref.id, seat, e.state) });
      if (e.type === 'turn' && e.seat !== seat) { const o = Object.assign({}, e); delete o.moves; return o; }
      return e;
    });
  }
  broadcast(events) { for (const seat of [0, 1]) this.sendTo(seat, { t: 'events', events: this.eventsFor(seat, events) }); }

  async fetch(req) {
    await this.load();
    const url = new URL(req.url);
    if (url.pathname === '/create') {
      if (this.meta) return json({ error: 'taken' }, 409);
      const { code, game, settings } = await req.json();
      try { new Referee(R, game, settings); } catch (e) { return json({ error: 'That table cannot be played online.' }, 400); }
      this.meta = { code, game, settings, tokens: [randomToken(), null], created: Date.now(), left: [false, false] };
      await this.saveMeta();
      await this.ctx.storage.setAlarm(Date.now() + WAIT_FOR_FRIEND);
      return json({ code, token: this.meta.tokens[0], seat: 0, game, settings });
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
    this.send(server, { t: 'welcome', seat, token: this.meta.tokens[seat], code: this.meta.code, game: this.meta.game, settings: this.meta.settings, opponent: this.online(1 - seat) });
    this.sendTo(1 - seat, { t: 'presence', seat, online: true });
    if (!this.ref && this.meta.tokens[1]) { // both seats taken: the game begins
      this.ref = new Referee(R, this.meta.game, this.meta.settings);
      const events = this.ref.start();
      await this.saveRef();
      for (const s of [0, 1]) this.sendTo(s, { t: 'snapshot', snap: this.snapshotFor(s), events: this.eventsFor(s, events), fresh: true });
    } else if (this.ref) this.send(server, { t: 'snapshot', snap: this.snapshotFor(seat) });
    await this.ctx.storage.setAlarm(Date.now() + WAIT_FOR_FRIEND);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    await this.load();
    const att = ws.deserializeAttachment(); if (!att || !this.meta) return;
    const seat = att.seat;
    if (typeof raw !== 'string' || raw.length > 2000) return;
    let msg; try { msg = JSON.parse(raw); } catch (e) { return; }
    if (msg.t === 'leave') { this.meta.left[seat] = true; await this.saveMeta(); this.sendTo(1 - seat, { t: 'left', seat }); try { ws.close(1000, 'left'); } catch (e) { /* gone */ } return; }
    if (!this.ref) { this.send(ws, { t: 'error', msg: 'Your friend has not joined yet.' }); return; }
    let events;
    try {
      if (msg.t === 'throw') events = this.ref.throw(seat);
      else if (msg.t === 'choose') events = this.ref.choose(seat, msg.i | 0, false);
      else if (msg.t === 'pass') events = this.ref.choose(seat, 0, true);
      else if (msg.t === 'again') {
        if (this.ref.phase !== 'over') throw new Error('the game is still going');
        this.ref = new Referee(R, this.meta.game, this.meta.settings);
        events = this.ref.start();
        await this.saveRef(); await this.saveMeta();
        for (const s of [0, 1]) this.sendTo(s, { t: 'snapshot', snap: this.snapshotFor(s), events: this.eventsFor(s, events), fresh: true, again: seat });
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
