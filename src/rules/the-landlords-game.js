  /* ------------------------------------------------- The Landlord's Game (1904)
   * Lizzie Magie's patent board, U.S. 748,626: forty spaces read from the drawing,
   * starting at Mother Earth and running clockwise as the patent draws it. */
  const LL_SEQ = ['earth', 1, 'bread', 2, 'trespass', 'rr', 3, 4, 'lux', 5,
    'coal', 6, 7, 'light', 8, 'rr', 9, 'shelter', 10, 11,
    'park', 12, 'lux', 13, 14, 'rr', 15, 'water', 16, 17,
    'blueblood', 18, 'clothing', 19, 20, 'rr', 21, 'legacy', 22, 'lux'];
  const LL_NAME = { earth: 'Mother Earth', bread: 'Bread', coal: 'Coal', shelter: 'Shelter', clothing: 'Clothing', trespass: 'No Trespassing', blueblood: 'No Trespassing', rr: 'the railroad', lux: 'Luxury', light: 'the light franchise', water: 'the water franchise', park: 'the Public Park', legacy: 'Legacy' };
  const LL = LL_SEQ.map((s, i) => typeof s === 'number' ? { i, t: 'lot', n: s, price: 10 * s, rent: s, name: `lot ${s}` }
    : { i, t: { bread: 'need', coal: 'need', shelter: 'need', clothing: 'need', blueblood: 'trespass', light: 'franchise', water: 'franchise' }[s] || s, key: s, name: LL_NAME[s] });
  const LL_JAIL = 10, LL_PARK = 20, LL_LOT = n => LL.findIndex(sp => sp.n === n);
  const LANDLORD = {
    id: 'landlord', name: 'The Landlord\'s Game', dice: true, pipDice: true, autoMove: true, first: 0, N: 1,
    SPACES: LL, JAIL: LL_JAIL, PARK: LL_PARK, lotAt: LL_LOT,
    get followPrompt() {
      const p = this.pend; if (!p) return 'Buy another of your ticket lots, or start.';
      const sp = LL[p.at];
      return p.kind === 'lot' ? `Lot ${sp.n} is for sale at $${sp.price}, or to rent at $${sp.rent}.` : 'Luxury: buy a ticket for $50, or decline and lose the move.';
    },
    extraNote: '',
    variants: [{ id: '3', label: 'Three rounds' }, { id: '5', label: 'Five rounds' }],
    variant: '3', variantLabel: 'Rounds', ROUNDS: 3, // the patent plays five times round; three is the default here
    setVariant(id) { this.variant = id === '5' ? '5' : '3'; this.ROUNDS = +this.variant; },
    rules: [
      'Throw two dice and move your checker that many spaces clockwise. Each time you pass Mother Earth you draw $100 in wages, for five times round the board (three in the short game).',
      'A green lot can be bought for its price or rented for its rent, both paid to the Public Treasury. On a lot someone owns, pay the rent to the owner; on your own, pay nothing. At the start you draw lot tickets and may buy those lots before your first throw.',
      'Bread, Coal, Shelter and Clothing are absolute necessities: $5 tax. A railroad costs $5 fare. Luxury costs $50 for a ticket worth $60 at the end, or decline and lose the move. The first to land on a franchise takes its charter free, and charges $5 to anyone else who lands there. Legacy pays $100. The Public Park is free.',
      'No Trespassing sends you to jail, in the Coal corner. To leave, pay a $50 fine or throw a double. A double that would carry you past a railroad lets you ride to the next one instead (and pay its fare).',
      'Short of cash, you borrow $100 notes from the Bank against your lots (worth $10 more than the loan) and pay $5 interest on each note at every wage; notes are repaid before you pass Mother Earth when you can. With nothing to borrow against, you go to the poorhouse.',
      'When both players have been round five times (or three) the game ends. Your worth is your cash, your lots at their price and $60 a luxury ticket, less any notes. The richer player wins. Once round and free of debt, you may move either way.'
    ],
    source: 'U.S. Patent 748,626, granted to Lizzie J. Magie on January 5, 1904: the board is read from the patent drawing and the rules from its text, for two players. The patent\'s rule for two checkers sharing a lot is left out.',
    init() {
      this.pos = [0, 0]; this.cash = [500, 500]; this.notes = [0, 0]; this.laps = [0, 0]; this.lux = [0, 0]; this.legacies = [0, 0];
      this.human = [true, false]; // seats a person plays (the hall sets the second for a game against a friend)
      this.jailed = [false, false]; this.owner = new Array(23).fill(-1); this.fran = { 13: -1, 27: -1 };
      const t = Array.from({ length: 22 }, (_, k) => k + 1);
      for (let k = t.length - 1; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; [t[k], t[j]] = [t[j], t[k]]; }
      this.tickets = [[], []]; for (let k = 0; k < 12; k++) this.tickets[k % 2].push(t[k]);
      this.tickets.forEach(a => a.sort((x, y) => x - y));
      this.ticketsOpen = [true, true]; this.pend = null; this.turnsTaken = 0;
    },
    roll() { const a = 1 + ((Math.random() * 6) | 0), b = 1 + ((Math.random() * 6) | 0); return { value: a + b, faces: [a, b] }; },
    lotValue(pl) { let v = 0; for (let n = 1; n <= 22; n++) if (this.owner[n] === pl) v += 10 * n; return v; },
    worth(pl) { return this.cash[pl] + this.lotValue(pl) + 60 * this.lux[pl] - 100 * this.notes[pl]; },
    canBorrow(pl) { return this.lotValue(pl) >= (this.notes[pl] + 1) * 110; },
    // Pay amt to the other player (to = 0 or 1) or to the Treasury or railroad (to = null), borrowing if need be.
    pay(pl, amt, to, notes) {
      let borrowed = 0;
      while (this.cash[pl] < amt && this.canBorrow(pl)) { this.notes[pl]++; this.cash[pl] += 100; borrowed++; }
      if (borrowed) notes.push(`${pl === 0 ? 'You borrow' : 'The Scribe borrows'} $${100 * borrowed} from the Bank.`);
      if (this.cash[pl] >= amt) { this.cash[pl] -= amt; if (to !== null) this.cash[to] += amt; return true; }
      const paid = this.cash[pl]; this.cash[pl] = 0; if (to !== null) this.cash[to] += paid;
      this.pos[pl] = LL_PARK; this.jailed[pl] = false;
      notes.push(pl === 0 ? 'You cannot pay, and have nothing to borrow against: off to the poorhouse.' : 'The Scribe cannot pay and goes to the poorhouse.');
      return false;
    },
    // Choices before throwing: lot tickets at the start, or the way out of jail.
    preThrow(pl) {
      if (this.pend) return null;
      if (this.ticketsOpen[pl]) {
        const ms = this.tickets[pl].filter(n => this.owner[n] < 0 && this.cash[pl] >= 10 * n).map(n => ({ pl, kind: 'ticket', n, pre: true, label: `Buy lot ${n}: $${10 * n}` }));
        return ms.concat([{ pl, kind: 'endTickets', pre: true, label: ms.length ? 'Done buying' : 'Start' }]);
      }
      if (this.jailed[pl]) return [{ pl, kind: 'fine', pre: true, label: 'Pay the $50 fine' }, { pl, kind: 'tryDouble', pre: true, label: 'Throw for a double' }];
      return null;
    },
    passesRR(from, steps) { for (let k = 1; k < steps; k++) if (LL[(from + k) % 40].t === 'rr') return (from + k) % 40; return -1; },
    nextRR(at) { for (let k = 1; k <= 40; k++) if (LL[(at + k) % 40].t === 'rr') return (at + k) % 40; return at; },
    legal(pl, value, roll) {
      if (this.pend) return this.pendMoves();
      const from = this.pos[pl];
      if (this.jailed[pl]) return roll && roll.faces[0] === roll.faces[1] ? [{ pl, kind: 'move', from, steps: value, dir: 1, to: (from + value) % 40, free: true }] : [{ pl, kind: 'stay', from, to: from }];
      const ms = [{ pl, kind: 'move', from, steps: value, dir: 1, to: (from + value) % 40 }];
      const rr = this.passesRR(from, value);
      if (roll && roll.faces[0] === roll.faces[1] && rr >= 0) { const to = this.nextRR(rr); ms.push({ pl, kind: 'move', from, steps: (to - from + 40) % 40, dir: 1, to, ride: rr }); }
      if (this.laps[pl] >= this.ROUNDS && !this.notes[pl]) ms.push({ pl, kind: 'move', from, steps: value, dir: -1, to: (from - value + 40) % 40 });
      return ms;
    },
    steps(m) { // the spaces the checker passes through, for the animation
      if (m.kind !== 'move') return [];
      if (m.ride !== undefined) { const a = []; for (let k = 1; k <= (m.ride - m.from + 40) % 40; k++) a.push((m.from + k) % 40); a.push(m.to); return a; }
      return Array.from({ length: m.steps }, (_, k) => (m.from + m.dir * (k + 1) + 40) % 40);
    },
    pendMoves() {
      const { pl, kind, at } = this.pend, sp = LL[at];
      if (kind === 'lot') return [{ pl, kind: 'buyLot', at, label: `Buy lot ${sp.n} for $${sp.price}` }, { pl, kind: 'rentLot', at, label: `Rent it for $${sp.rent}` }];
      return [{ pl, kind: 'buyLux', at, label: 'Buy a luxury ticket: $50' }, { pl, kind: 'declineLux', at, back: this.pend.back, label: 'Decline, and lose the move' }];
    },
    who(pl) { return pl === 0 ? 'You' : 'The Scribe'; },
    apply(m) {
      const pl = m.pl, notes = [], me = this.who(pl), mine = pl === 0 ? 'your' : 'its';
      const out = () => ({ note: notes.join(' '), moved: [], caps: 0 });
      switch (m.kind) {
        case 'ticket': {
          this.cash[pl] -= 10 * m.n; this.owner[m.n] = pl;
          notes.push(`${me} ${pl === 0 ? 'buy' : 'buys'} lot ${m.n}.`);
          const r = out(); if (this.human[pl]) r.followUp = this.preThrow(pl); return r;
        }
        case 'endTickets': this.ticketsOpen[pl] = false; return Object.assign(out(), { thenThrow: true });
        case 'fine': this.pay(pl, 50, null, notes); this.jailed[pl] = false; notes.unshift(`${me} ${pl === 0 ? 'pay' : 'pays'} the $50 fine.`); return Object.assign(out(), { thenThrow: true });
        case 'tryDouble': return Object.assign(out(), { thenThrow: true });
        case 'stay': notes.push(pl === 0 ? 'No double: you stay in jail.' : 'No double: the Scribe stays in jail.'); return out();
        case 'buyLot': { const sp = LL[m.at]; this.pend = null; this.cash[pl] -= sp.price; this.owner[sp.n] = pl; notes.push(`${me} ${pl === 0 ? 'buy' : 'buys'} lot ${sp.n} for $${sp.price}.`); return out(); }
        case 'rentLot': { const sp = LL[m.at]; this.pend = null; this.pay(pl, sp.rent, null, notes); notes.unshift(`${me} ${pl === 0 ? 'rent' : 'rents'} lot ${sp.n} for $${sp.rent}.`); return out(); }
        case 'buyLux': this.pend = null; this.cash[pl] -= 50; this.lux[pl]++; notes.push(`${me} ${pl === 0 ? 'buy' : 'buys'} a luxury ticket.`); return out();
        case 'declineLux': this.pend = null; this.pos[pl] = m.back; notes.push(`${me} ${pl === 0 ? 'decline' : 'declines'} the luxury and ${pl === 0 ? 'go' : 'goes'} back.`); return Object.assign(out(), { back: true });
      }
      // A move round the board.
      this.turnsTaken++;
      if (m.free) { this.jailed[pl] = false; notes.push(`A double: ${pl === 0 ? 'you are' : 'the Scribe is'} out of jail.`); }
      this.pos[pl] = m.to;
      if (m.ride !== undefined) notes.push(`${me} ${pl === 0 ? 'ride' : 'rides'} the railroad.`);
      if (m.dir === 1 && m.from + m.steps >= 40) this.wages(pl, notes);
      if (this.pos[pl] === m.to) this.land(pl, m.to, m.from, notes);
      const r = out();
      if (this.pend) r.followUp = this.pendMoves();
      return r;
    },
    wages(pl, notes) {
      // Repay notes before passing, to save the interest.
      while (this.notes[pl] && this.cash[pl] >= 150) { this.notes[pl]--; this.cash[pl] -= 100; notes.push(`${this.who(pl)} ${pl === 0 ? 'repay' : 'repays'} a $100 note.`); }
      this.laps[pl]++;
      if (this.laps[pl] <= this.ROUNDS) {
        this.cash[pl] += 100;
        notes.push(`${this.who(pl)} ${pl === 0 ? 'pass' : 'passes'} Mother Earth and ${pl === 0 ? 'draw' : 'draws'} $100 wages (round ${this.laps[pl]} of ${this.ROUNDS}).`);
        if (this.notes[pl]) this.pay(pl, 5 * this.notes[pl], null, notes);
      }
    },
    land(pl, at, from, notes) {
      const sp = LL[at], me = this.who(pl), other = 1 - pl;
      switch (sp.t) {
        case 'lot': {
          const o = this.owner[sp.n];
          if (o === pl) { notes.push(`Lot ${sp.n} is ${pl === 0 ? 'yours' : 'the Scribe\'s own'}.`); return; }
          if (o === other) { this.pay(pl, sp.rent, other, notes); notes.unshift(`${me} ${pl === 0 ? 'pay' : 'pays'} $${sp.rent} rent on lot ${sp.n}.`); return; }
          if (this.cash[pl] >= sp.price) { this.pend = { pl, kind: 'lot', at }; return; }
          this.pay(pl, sp.rent, null, notes); notes.unshift(`${me} ${pl === 0 ? 'rent' : 'rents'} lot ${sp.n} for $${sp.rent}.`); return;
        }
        case 'need': this.pay(pl, 5, null, notes); notes.unshift(`${sp.name}: $5 tax.`); return;
        case 'rr': this.pay(pl, 5, null, notes); notes.unshift('Railroad fare: $5.'); return;
        case 'lux':
          if (this.cash[pl] >= 50) { this.pend = { pl, kind: 'lux', at, back: from }; return; }
          this.pos[pl] = from; notes.push(`${me} cannot afford the luxury and ${pl === 0 ? 'lose' : 'loses'} the move.`); return;
        case 'franchise': {
          const h = this.fran[at];
          if (h < 0) { this.fran[at] = pl; notes.push(`${me} ${pl === 0 ? 'take' : 'takes'} the charter for ${sp.name}.`); }
          else if (h === other) { this.pay(pl, 5, other, notes); notes.unshift(`${me} ${pl === 0 ? 'pay' : 'pays'} $5 for ${sp.name}.`); }
          return;
        }
        case 'trespass': this.pos[pl] = LL_JAIL; this.jailed[pl] = true; notes.push(`No Trespassing! ${pl === 0 ? 'You go' : 'The Scribe goes'} to jail.`); return;
        case 'legacy': this.cash[pl] += 100; this.legacies[pl]++; notes.push(`A legacy: ${pl === 0 ? 'you receive' : 'the Scribe receives'} $100.`); return;
        case 'park': notes.push('The Public Park is free.'); return;
        default: return;
      }
    },
    done() { return this.laps[0] >= this.ROUNDS && this.laps[1] >= this.ROUNDS; },
    final() {
      const a = this.worth(0), b = this.worth(1);
      return { winner: a > b ? 0 : b > a ? 1 : -1, text: `${this.ROUNDS === 5 ? 'Five' : 'Three'} times round. You are worth $${a}, the Scribe $${b}.` };
    },
    home(pl) { return this.laps[pl]; },
    extra() { return false; },
    snapshot() { return JSON.stringify([this.pos, this.cash, this.notes, this.laps, this.lux, this.legacies, this.jailed, this.owner, this.fran, this.tickets, this.ticketsOpen, this.pend, this.turnsTaken]); },
    restore(s) { [this.pos, this.cash, this.notes, this.laps, this.lux, this.legacies, this.jailed, this.owner, this.fran, this.tickets, this.ticketsOpen, this.pend, this.turnsTaken] = JSON.parse(s); },
    // The Scribe's judgement: how much cash to keep in hand for rents and taxes still to come.
    reserve() { return LEVEL.name === 'sharp' ? 0 : 40; }, // land pays: Sharp buys whatever it can afford
    decide(m) { // for a pending choice or a pre-throw choice, which to take
      const pl = m[0].pl, G = LEVEL.name === 'gentle';
      const by = k => m.find(x => x.kind === k);
      if (by('buyLot')) { const sp = LL[by('buyLot').at]; return (G ? Math.random() < 0.5 : this.cash[pl] - sp.price >= this.reserve(pl)) ? by('buyLot') : by('rentLot'); }
      if (by('buyLux')) return (G ? Math.random() < 0.4 : this.cash[pl] - 50 >= this.reserve(pl) + (LEVEL.name === 'sharp' ? 0 : 40)) ? by('buyLux') : by('declineLux');
      if (by('fine')) {
        if (G) return Math.random() < 0.5 ? by('fine') : by('tryDouble');
        const unowned = this.owner.slice(1).filter(o => o < 0).length;
        if (LEVEL.name === 'sharp') { // jail is a safe harbour once the other side owns the streets
          const theirs = this.owner.filter(o => o === 1 - pl).length;
          return unowned >= 4 && this.cash[pl] >= 120 && theirs < 8 ? by('fine') : by('tryDouble');
        }
        return this.cash[pl] >= 150 ? by('fine') : by('tryDouble');
      }
      return m[0];
    },
    aiPre(pl) { // tickets or the way out of jail
      const plan = [];
      if (this.ticketsOpen[pl]) {
        const want = this.tickets[pl];
        let cash = this.cash[pl];
        for (const n of want) if (this.owner[n] < 0 && (LEVEL.name === 'gentle' ? Math.random() < 0.5 : cash - 10 * n >= (LEVEL.name === 'sharp' ? 0 : 200))) { plan.push({ pl, kind: 'ticket', n, pre: true }); cash -= 10 * n; }
        plan.push({ pl, kind: 'endTickets', pre: true });
        return plan;
      }
      const pre = this.preThrow(pl);
      return pre ? [this.decide(pre)] : [];
    },
    // Value of landing on a space, for choosing between a ride, a plain move or going backward.
    landValue(pl, m) {
      const snap = this.snapshot(), w0 = this.worth(pl) - this.worth(1 - pl);
      const r = this.apply(m);
      if (r.followUp) this.apply(this.decide(r.followUp));
      const v = this.worth(pl) - this.worth(1 - pl) - w0 + (this.pos[pl] === LL_PARK && m.to !== LL_PARK ? -30 : 0) + (this.jailed[pl] ? -15 : 0);
      this.restore(snap); return v;
    },
    aiPlan(pl, moves) {
      let m = moves[0];
      if (moves.length > 1) m = LEVEL.name === 'gentle' ? moves[(Math.random() * moves.length) | 0] : moves.reduce((a, b) => (this.landValue(pl, b) > this.landValue(pl, a) ? b : a));
      const snap = this.snapshot(), plan = [m], r = this.apply(m);
      if (r.followUp) plan.push(this.decide(r.followUp));
      this.restore(snap);
      return plan;
    },
  };

