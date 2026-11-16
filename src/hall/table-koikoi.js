
// Hanafuda cards, drawn here in our own simple style: the month's plant, its emblem and a label.
const HF_W = 0.056, HF_H = 0.09;
const HF_PLANT = ['松', '梅', '桜', '藤', '菖', '牡丹', '萩', '芒', '菊', '紅葉', '柳', '桐'];
const HF_COLOR = ['#2f6b3a', '#b0305a', '#e58aa8', '#7a5aa8', '#4a5ab0', '#c0304a', '#a05a8a', '#c8b070', '#d8a020', '#c8401a', '#5a8a3a', '#7a4a9a'];
const HF_EMBLEM = { crane: '鶴', curtain: '幕', moon: '月', 'rain man': '雨', phoenix: '鳳凰', 'bush warbler': '鶯', cuckoo: '時鳥', 'eight-plank bridge': '八橋', butterflies: '蝶', boar: '猪', geese: '雁', 'sake cup': '盃', deer: '鹿', swallow: '燕' };
const hfFaceCache = new Map();
function hfFace(c) {
  if (hfFaceCache.has(c)) return hfFaceCache.get(c);
  const R = window.LibrariumRules.koikoi, mo = c >> 2, kind = R.kind(c), name = R.cardName(c).slice(R.MONTH[mo].length + 1);
  const map = cardTex((g, w, h) => {
    g.fillStyle = '#f3ead2'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1a1410'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = HF_COLOR[mo]; g.globalAlpha = 0.85; g.fillRect(10, h * 0.62, w - 20, h * 0.3); g.globalAlpha = 1; // the month's colour, low on the card
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#1a1410';
    g.font = `bold ${HF_PLANT[mo].length > 1 ? 46 : 64}px "Noto Serif CJK JP","Noto Serif CJK SC","Yu Mincho","MS Mincho",serif`; g.fillText(HF_PLANT[mo], w / 2, h * 0.17);
    if (kind === 'b') { g.fillStyle = '#c8281e'; g.beginPath(); g.arc(w / 2, h * 0.42, 34, 0, TAU); g.fill(); g.fillStyle = '#f3ead2'; g.font = `bold ${HF_EMBLEM[name].length > 1 ? 26 : 40}px "Noto Serif CJK JP","Noto Serif CJK SC",serif`; g.fillText(HF_EMBLEM[name], w / 2, h * 0.42); }
    else if (kind === 'a') { g.fillStyle = '#1a1410'; g.font = `bold ${HF_EMBLEM[name].length > 1 ? 34 : 50}px "Noto Serif CJK JP","Noto Serif CJK SC",serif`; g.fillText(HF_EMBLEM[name], w / 2, h * 0.42); }
    else if (kind[0] === 'r') {
      g.fillStyle = kind === 'rb' ? '#2a46a0' : '#c8281e'; g.fillRect(w / 2 - 17, h * 0.27, 34, h * 0.34);
      if (kind === 'rp') { g.fillStyle = '#1a1410'; g.font = 'bold 18px "Noto Serif CJK JP","Noto Serif CJK SC",serif'; [...(mo === 2 ? 'みよしの' : 'あかよろし')].forEach((ch, k) => g.fillText(ch, w / 2, h * 0.3 + k * 17)); }
    } else if (name === 'lightning') { g.strokeStyle = '#c8281e'; g.lineWidth = 6; g.beginPath(); g.moveTo(w * 0.6, h * 0.28); g.lineTo(w * 0.42, h * 0.42); g.lineTo(w * 0.56, h * 0.44); g.lineTo(w * 0.38, h * 0.58); g.stroke(); }
    g.fillStyle = '#f3ead2'; g.font = '600 15px "Montserrat",sans-serif'; g.fillText(R.MONTH[mo], w / 2, h * 0.71);
    g.font = '600 13px "Montserrat",sans-serif'; g.fillText(name, w / 2, h * 0.82);
    g.fillStyle = '#1a1410'; g.font = '700 14px "Montserrat",sans-serif'; g.fillText(kind === 'b' ? '20' : kind === 'a' ? '10' : kind[0] === 'r' ? '5' : '1', w - 22, h - 22);
  }, 128, 206);
  hfFaceCache.set(c, map); return map;
}
const hfGeo = new THREE.BoxGeometry(HF_W, 0.0016, HF_H);
const hfBackMat = new THREE.MeshStandardMaterial({ roughness: 0.6, map: cardTex((g, w, h) => { g.fillStyle = '#1a1210'; g.fillRect(0, 0, w, h); g.fillStyle = '#8a1a12'; g.fillRect(12, 12, w - 24, h - 24); }, 64, 104) });
const hfEdgeMat = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.6 });
function hfCard(c) { const face = new THREE.MeshStandardMaterial({ map: hfFace(c), roughness: 0.55 }); const m = new THREE.Mesh(hfGeo, [hfEdgeMat, hfEdgeMat, face, hfBackMat, hfEdgeMat, hfEdgeMat]); m.userData.mats = [face]; m.userData.c = c; return m; }
const KOIKOI_P = {
  camW: 1.1,
  intro() { return 'You deal the first month and play first. ' + this.prompt(); },
  prompt() {
    const G = GAMES.koikoi;
    if (G.need === 'next') return G.notes.join(' ') + ' Press the button when you are ready.';
    if (G.need === 'koi') return G.followPrompt;
    if (G.need === 'draw') return G.followPrompt;
    return 'Play a card from your hand. A ring shows the card it takes; with no match it stays on the table.';
  },
  setup(ex) { ex.group.userData.display.forEach(m => { m.visible = false; }); this.ex = ex; this.redeal(); },
  leave(ex) { ex.group.userData.display.forEach(m => { m.visible = true; }); (this.cards || []).forEach(m => ex.group.remove(m)); this.cards = []; },
  y: () => GAMES.koikoi.surface + 0.001,
  card(c) { let m = this.mesh.get(c); if (!m) { m = hfCard(c); this.ex.group.add(m); this.cards.push(m); this.mesh.set(c, m); } return m; },
  handSpot(pl, i, n) { return V3((i - (n - 1) / 2) * (pl ? 0.036 : 0.062), this.y() + i * 0.0003, pl ? -0.31 : 0.31); },
  fieldSpot(i) { return V3(-0.2 + (i % 8) * 0.062, this.y() + ((i / 16) | 0) * 0.002, (i % 16) < 8 ? -0.07 : 0.045); },
  pileSpot: k => V3(-0.45, GAMES.koikoi.surface + 0.001 + k * 0.0012, -0.01),
  // Captured cards lie in four small fans by kind: brights, animals, ribbons, chaff.
  wonSpot(pl, c, k) { const g = 'barkk'.indexOf(window.LibrariumRules.koikoi.kind(c)[0]); return V3(0.3 + g * 0.05 + Math.min(k, 10) * 0.007, this.y() + k * 0.0004, pl ? -0.17 : 0.18); },
  redeal() {
    const G = GAMES.koikoi;
    (this.cards || []).forEach(m => this.ex.group.remove(m));
    this.cards = []; this.mesh = new Map();
    G.pile.forEach((c, k) => { const m = this.card(c); m.rotation.set(0, 0, Math.PI); m.position.copy(this.pileSpot(G.pile.length - 1 - k)); });
    this.layField(true); this.layHand(0, true); this.layHand(1, true); this.layWon(true);
  },
  layHand(pl, instant) {
    const G = GAMES.koikoi, h = G.hands[pl], jobs = [];
    h.forEach((c, i) => { const m = this.card(c), to = this.handSpot(pl, i, h.length); m.rotation.set(0, pl ? Math.PI : 0, pl ? Math.PI : 0); if (instant) m.position.copy(to); else jobs.push(hop(m, to, 0.2, 0.01)); });
    return Promise.all(jobs);
  },
  layField(instant) {
    const G = GAMES.koikoi, jobs = [];
    G.field.forEach((c, i) => { const m = this.card(c), to = this.fieldSpot(i); m.rotation.set(0, 0, 0); if (instant) m.position.copy(to); else if (m.position.distanceTo(to) > 0.002) jobs.push(hop(m, to, 0.25, 0.02)); });
    return Promise.all(jobs);
  },
  layWon(instant) {
    const G = GAMES.koikoi, jobs = [];
    for (const pl of [0, 1]) {
      const n = {}; G.won[pl].slice().sort((a, b) => a - b).forEach(c => { const g = G.kind(c)[0]; n[g] = (n[g] || 0) + 1; const m = this.card(c), to = this.wonSpot(pl, c, n[g] - 1); m.rotation.set(0, 0, 0); if (instant) m.position.copy(to); else if (m.position.distanceTo(to) > 0.002) jobs.push(hop(m, to, 0.3, 0.03)); });
    }
    return Promise.all(jobs);
  },
  meshesFor(m) { return m.kind === 'play' && m.pl === 0 ? [this.mesh.get(m.c)] : []; },
  ringFor(m) {
    if (m.kind === 'draw') return this.mesh.get(m.take).position.clone();
    if (m.kind !== 'play' || m.pl !== 0) return null;
    return m.take !== null && m.take !== undefined ? this.mesh.get(m.take).position.clone() : this.fieldSpot(GAMES.koikoi.field.length);
  },
  ringScale: 0.55,
  fromFor: () => null,
  async play(m) {
    const G = GAMES.koikoi, tok = play.token;
    const res = G.apply(m);
    for (const e of res.events || []) {
      if (tok !== play.token) return res;
      if (e.type === 'deal') { this.redeal(); continue; }
      if (e.type === 'drawn') { const mc = this.card(e.c); sfx.card(); tween(0.3, k => { mc.rotation.z = Math.PI * (1 - k); }); await hop(mc, V3(-0.36, this.y() + 0.01, -0.01), 0.3, 0.04); await wait(250); continue; }
      if (e.type === 'toField' || e.type === 'capture') {
        const mc = this.card(e.type === 'capture' ? e.cards[0] : e.c); sfx.card();
        if (mc.rotation.z) tween(0.3, k => { mc.rotation.z = Math.PI * (1 - k); });
        await this.layField(); await this.layWon(); await this.layHand(e.pl);
      }
    }
    await this.layField(); await this.layWon();
    return res;
  },
  score() { const G = GAMES.koikoi; return [['You', G.total[0]], ['Scribe', G.total[1]], `month ${Math.min(G.month, G.rounds)} of ${G.rounds}${G.koi[0] ? ' · you called koi-koi' : ''}${G.koi[1] ? ' · the Scribe called koi-koi' : ''}`]; },
};

