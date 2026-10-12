// FROSTFALL: Battle. Боевой симулятор реального времени: FSM боссов и элиты, фазы, зоны поражения с предупреждением, статусы (оглушение, заморозка,
// отталкивание, яды/горение/кровотечение, слепота), щиты и барьеры, сопротивления стихиям, таунт паладина, рикошет и разброс, пробитие брони,
// добивание, ярость затянувшегося боя, раскол босса, воскрешение миньонов, привязка душ, DPS-метр. Чистая логика: работает в Node.
(function (root) {
  'use strict';
  const FF = root.FF = root.FF || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ELEM = ['phys', 'fire', 'ice', 'magic'];
  const MAXX = 384, ARENA_Y = 152;

  // Сопротивления по типам монстров: >0 сопротивление, <0 уязвимость (доли)
  const RES = {
    slime: { fire: -0.3, ice: 0.3 }, wolf: { phys: 0.1, ice: 0.4, fire: -0.2 }, bat: { magic: -0.2, phys: -0.1 }, golem: { phys: 0.4, magic: -0.3, ice: 0.5, fire: -0.2 },
    skeleton: { phys: 0.2, magic: -0.3, fire: -0.2 }, demon: { fire: 0.6, ice: -0.3, magic: 0.1 }, wisp: { phys: 0.5, magic: -0.4 }, dragon: { fire: 0.4, ice: -0.4 }, boss: { magic: 0.1 }, minion: {},
  };
  // Мутации элиты
  const MUTS = {
    vampiric: { name: 'Вампирский', col: '#d04060', vamp: 0.35 },
    shielded: { name: 'Щитовой', col: '#6ab4ff', shield: 0.5 },
    reflect: { name: 'Отражающий', col: '#c8c8ff', reflect: 0.2 },
    swift: { name: 'Быстрый', col: '#7dffb0', speed: 1.5 },
    toxic: { name: 'Ядовитый', col: '#7ad04a', dot: 'poison' },
  };
  const CRIES = {
    a: ['Склонитесь', 'Дрожите', 'Падите ниц', 'Прочь с моей земли', 'Ваш путь окончен', 'Лёд поглотит вас'], b: ['смертные!', 'жалкие герои!', 'у подножия трона!', 'и сгиньте!', 'в вечной мерзлоте!', 'под моей пятой!'],
  };
  const cry = (rng) => CRIES.a[rng.int(0, CRIES.a.length - 1)] + ', ' + CRIES.b[rng.int(0, CRIES.b.length - 1)];

  let UID = 1;
  // ---------- юнит ----------
  function unit(o) {
    const u = Object.assign({ id: UID++, side: 'e', name: '?', cls: 'warrior', type: 'minion', x: 200, hp: 100, max: 100, shield: 0, atk: 10, def: 0, crit: 0.05, critd: 1.5, acc: 0.95, rate: 1, range: 60, elem: 'phys', res: {}, pierce: 0, vamp: 0, reflect: 0, speed: 1, mana: 50, maxMana: 50,
      alive: true, st: [], t: 0, cd: 0, dealt: 0, healed: 0, taken: 0, iframes: 0, tint: null, cast: null, rageT: 0, lastHit: 0, mods: [], summoned: false, soulBound: false, boss: false, elite: false, healer: false, size: 1, scale: 1 }, o);
    u.max = Math.max(1, u.max); u.hp = o.hp == null ? u.max : Math.min(u.hp, u.max); u.res = Object.assign({}, RES[u.type] || {}, o.res || {});
    if (u.cls === 'priest') u.healer = true; return u;
  }

  class Battle {
    constructor(opts) {
      opts = opts || {}; this.rng = FF.Rng(opts.seed == null ? 1 : opts.seed); this.bus = opts.bus === undefined ? (FF.bus || null) : opts.bus; this.t = 0; this.units = []; this.zones = []; this.barriers = []; this.walls = []; this.fx = []; this.over = false; this.result = null;
      this.dtMax = 0.1; this.cooldownRage = opts.rageAfter || 60; this.events = []; this.tempo = 1; this.maxUnits = 80; this.log = [];
    }
    emit(t, d) { this.events.push({ t, d }); if (this.bus) this.bus.emit('battle.' + t, d); }
    add(o) { if (this.units.length >= this.maxUnits) return null; const u = unit(o); this.units.push(u); return u; }
    heroes() { return this.units.filter((u) => u.side === 'h' && u.alive); }
    foes() { return this.units.filter((u) => u.side === 'e' && u.alive); }
    // ---------- создание ----------
    addHero(o) { return this.add(Object.assign({ side: 'h', x: 60 + this.rng() * 50, range: o.cls === 'ranger' || o.cls === 'necro' || o.cls === 'priest' ? 140 : 40, mana: 60, maxMana: 60 }, o)); }
    // Элита: случайные мутации (1–2)
    makeElite(o, count) {
      const u = this.add(Object.assign({ side: 'e', elite: true, x: 280 + this.rng() * 80 }, o)); if (!u) return null; const keys = this.rng.shuffle(Object.keys(MUTS)).slice(0, count || (this.rng() < 0.3 ? 2 : 1));
      for (const k of keys) { const m = MUTS[k]; u.mods.push(k); u.tint = m.col; if (m.vamp) u.vamp += m.vamp; if (m.shield) u.shield += u.max * m.shield; if (m.reflect) u.reflect += m.reflect; if (m.speed) u.speed *= m.speed; }
      u.name = MUTS[keys[0]].name + ' ' + String(u.name).toLowerCase(); return u;
    }
    // Босс: FSM с фазами. phases — конфиг (по умолчанию двухфазный)
    makeBoss(o) {
      const u = this.add(Object.assign({ side: 'e', boss: true, type: 'boss', x: 300, size: 2, range: 90, name: 'Босс' }, o)); if (!u) return null;
      u.fsm = { state: 'idle', t: 0, phase: 1, summonT: 6, aoeT: 5, splitDone: false, enraged: false, regenT: 0, calledHalf: false, stealT: 8 };
      u.cryText = cry(this.rng); u.noSplit = !!o.noSplit; u.vampAura = o.vampAura == null ? 0.15 : o.vampAura; u.vulnT = 0;
      this.emit('cry', { id: u.id, text: u.cryText }); return u;
    }
    // Случайная уязвимость босса (вылазки): раз в бой на одну из стихий
    rollVuln(u) { const e = ELEM[this.rng.int(1, 3)]; u.res[e] = (u.res[e] || 0) - 0.4; u.vulnElem = e; return e; }
    addWall(x, hp) { this.walls.push({ x, hp, max: hp, w: 10 }); }
    // ---------- статусы ----------
    has(u, k) { for (const s of u.st) if (s.k === k) return s; return null; }
    status(u, k, dur, o) {
      if (!u.alive) return; if (u.iframes > 0 && k !== 'barrierfx') return; const ex = this.has(u, k);
      if (u.boss && (k === 'stun' || k === 'freeze')) dur *= 0.4; // боссы устойчивы к контролю
      if (k === 'freeze' && (u.res.ice || 0) >= 0.5) return;
      if (ex) { ex.left = Math.max(ex.left, dur); if (o) Object.assign(ex, o, { left: ex.left }); } else u.st.push(Object.assign({ k, left: dur, tick: 0 }, o || {}));
      if (k === 'stun' || k === 'freeze') { if (u.cast) { u.cast = null; this.emit('interrupt', { id: u.id, by: 'control' }); } }
    }
    knock(u, from, force) { if (!u.alive || u.boss) return; u.x = clamp(u.x + (u.x >= from ? 1 : -1) * force, 0, MAXX); this.status(u, 'stun', 0.3); }
    // ---------- урон ----------
    // Универсальный конвейер: щит/барьер, стихии, броня, добивание, таунт, отражение, вампиризм, прерывание
    damage(src, tgt, raw, o) {
      o = o || {}; if (!tgt || !tgt.alive || raw <= 0) return 0; if (tgt.iframes > 0 && !o.true) return 0;
      let d = raw; const el = o.elem || (src && src.elem) || 'phys';
      // таунт паладина: 30% урона по союзникам уходит в паладина
      if (!o.noTaunt && tgt.side === 'h' && !tgt.taunting) { const p = this.units.find((u) => u.alive && u.side === tgt.side && u.taunting); if (p && p !== tgt) { const part = d * 0.3; d -= part; this.damage(src, p, part, Object.assign({}, o, { noTaunt: true })); } }
      // стихии
      d *= 1 - clamp(tgt.res[el] || 0, -1, 0.9);
      // броня: защита снижает физ.; пробитие игнорирует долю защиты
      if (el === 'phys' && !o.dot) { const def = tgt.def * (1 - clamp((src && src.pierce) || 0, 0, 0.8)); d *= 100 / (100 + Math.max(0, def)); }
      // добивание
      if (!o.dot && tgt.hp / tgt.max < 0.2 && src && src.exec) { d *= 1.5; o.exec = true; }
      if (this.has(tgt, 'vuln')) d *= 1.25;
      if (src && !o.dot && this.has(src, 'rage')) d *= 1.3;
      d = Math.max(1, d);
      // барьер перед юнитом: ближайший по x, принимает урон
      if (!o.dot && !o.true) for (const b of this.barriers) if (b.side === tgt.side && b.t > 0 && Math.abs(b.x - tgt.x) < b.w) { const take = Math.min(b.hp, d); b.hp -= take; d -= take; if (b.hp <= 0) b.t = 0; if (d <= 0) return 0; break; }
      // щит
      if (tgt.shield > 0) { const take = Math.min(tgt.shield, d); tgt.shield -= take; d -= take; if (tgt.shield <= 0) this.emit('shield.break', { id: tgt.id }); }
      let dealt = 0; if (d > 0) { dealt = Math.min(tgt.hp, d); tgt.hp -= dealt; tgt.taken += dealt; tgt.lastHit = this.t; }
      if (src) { src.dealt += raw >= 0 ? dealt : 0; }
      if (src && dealt > 0 && !o.dot && !o.reflected) {
        if (src.vamp > 0) this.heal(src, dealt * src.vamp, src);
        if (tgt.reflect > 0 && o.melee) this.damage(tgt, src, dealt * tgt.reflect, { reflected: true, true: false });
        const boss = this.units.find((u) => u.alive && u.boss && u.side !== src.side); if (boss && boss.vampAura && src.side !== boss.side) this.heal(boss, dealt * boss.vampAura, boss, true);
      }
      if (o.crit && tgt.cast) { tgt.cast = null; this.emit('interrupt', { id: tgt.id, by: 'crit' }); this.status(tgt, 'stun', 0.8); }
      this.emit('hit', { src: src && src.id, tgt: tgt.id, v: dealt, crit: !!o.crit, elem: el, exec: !!o.exec, dot: !!o.dot });
      if (tgt.hp <= 0.5) this._die(tgt, src);
      return dealt;
    }
    heal(u, v, by, aura) { if (!u.alive || v <= 0) return 0; const add = Math.min(u.max - u.hp, v); u.hp += add; if (by) by.healed += add; if (add > 0 && !aura) this.emit('heal', { id: u.id, v: add }); return add; }
    _die(u, killer) {
      if (!u.alive) return; u.hp = 0; u.alive = false; u.st.length = 0; this.emit('die', { id: u.id, side: u.side, boss: u.boss, by: killer && killer.id });
      // раскол босса: две копии по 30% HP
      if (u.boss && !u.noSplit && !u.fsm.splitDone) {
        for (let i = 0; i < 2; i++) { const c = this.makeBoss({ name: u.name + ' (осколок)', max: Math.round(u.max * 0.3), atk: u.atk * 0.7, def: u.def, x: u.x + (i ? 30 : -30), type: 'minion', size: 1.3, noSplit: true, elem: u.elem, rate: u.rate, tint: u.tint }); if (c) { c.boss = false; c.split = true; c.fsm = null; } }
        u.fsm.splitDone = true; this.emit('split', { id: u.id });
      }
      // привязка душ: союзник-жрец/некромант оживляет павшего за ману
      if (u.side === 'h') { const sav = this.units.find((s) => s.alive && s.side === 'h' && (s.cls === 'priest' || s.cls === 'necro') && s.mana >= 30); if (sav) { u.soulBound = sav.id; } }
      // некромантия: убитые миньоны возрождаются, пока жив некромант
      if (u.summoned && u.necroId) { const n = this.units.find((x) => x.id === u.necroId && x.alive); if (n) this.fx.push({ k: 'respawn', t: 4, tpl: u.tpl, x: u.x, necro: n.id }); }
    }
    // ---------- призыв ----------
    summon(owner, n, tpl) {
      if (owner.noSummon) return 0; let k = 0; tpl = tpl || { name: 'Миньон', max: owner.max * 0.04, atk: owner.atk * 0.25, def: 0, type: 'minion' };
      for (let i = 0; i < n; i++) { const u = this.add(Object.assign({ side: owner.side, x: owner.x + this.rng.range(-50, 50), summoned: true, necroId: owner.necro ? owner.id : 0, tpl }, tpl)); if (u) { u.tpl = tpl; k++; } }
      if (k) this.emit('summon', { id: owner.id, n: k }); return k;
    }
    // ---------- барьеры и неуязвимость ----------
    barrier(side, x, hp, dur) { this.barriers.push({ side, x, w: 24, hp, max: hp, t: dur }); this.emit('barrier', { x }); }
    invuln(u, dur) { u.iframes = Math.max(u.iframes, dur); }
    // ---------- выбор цели ----------
    pickTarget(u) {
      const foes = this.units.filter((x) => x.alive && x.side !== u.side); if (!foes.length) return null;
      if (u.side === 'e') { // ИИ врага: провокация > лекарь > самый слабый по доле HP
        const tn = foes.find((f) => f.taunting && Math.abs(f.x - u.x) < u.range * 3); if (tn) return tn;
        const healer = foes.find((f) => f.healer); if (healer && this.rng() < 0.6) return healer;
        let best = foes[0]; for (const f of foes) if (f.hp / f.max < best.hp / best.max) best = f; return best;
      }
      // герои: ближайший, боссу приоритет если он в радиусе
      let best = null, bd = 1e9; for (const f of foes) { const d = Math.abs(f.x - u.x) - (f.boss ? 30 : 0); if (d < bd) { bd = d; best = f; } } return best;
    }
    // ---------- атака ----------
    attack(u, tgt) {
      const ranged = u.range > 60, blind = this.has(u, 'blind'); let acc = clamp(u.acc - (blind ? 0.5 : 0), 0.05, 1);
      const crit = this.rng() < u.crit, base = u.atk * (crit ? u.critd : 1);
      if (ranged) { // разброс: меткость влияет на шанс попасть в цель
        const spread = (1 - acc) * 60, off = this.rng.range(-spread, spread), dist = Math.abs(off);
        if (dist > 12 + tgt.size * 6) { this.emit('miss', { src: u.id, tgt: tgt.id }); return; }
      } else if (this.rng() > acc) { this.emit('miss', { src: u.id, tgt: tgt.id }); return; }
      this.damage(u, tgt, base, { crit, melee: !ranged, elem: u.elem });
      if (u.chain > 0) this.chain(u, tgt, base * 0.6, u.chain); // рикошет
      if (u.cleave) for (const f of this.units) if (f.alive && f.side === tgt.side && f !== tgt && Math.abs(f.x - tgt.x) < 28) this.damage(u, f, base * 0.4, { elem: u.elem });
      if (u.dotKind && tgt.alive) this.dot(tgt, u.dotKind, u.atk * 0.25, 4);
      if (u.stunHit && this.rng() < u.stunHit) this.status(tgt, 'stun', 0.6);
    }
    chain(src, from, dmg, n) {
      const hit = new Set([from.id]); let cur = from;
      for (let i = 0; i < n; i++) {
        let nx = null, bd = 90; for (const f of this.units) if (f.alive && f.side === from.side && !hit.has(f.id)) { const d = Math.abs(f.x - cur.x); if (d < bd) { bd = d; nx = f; } }
        if (!nx) break; hit.add(nx.id); dmg *= 0.7; this.damage(src, nx, dmg, { elem: 'magic' }); cur = nx;
      }
    }
    dot(u, kind, dps, dur) { this.status(u, kind, dur, { dps, tick: 0 }); }
    // ---------- зоны поражения ----------
    telegraph(src, x, w, delay, dmg, o) { this.zones.push({ src: src.id, side: src.side, x, w, t: delay, max: delay, dmg, o: o || {} }); this.emit('telegraph', { x, w, t: delay }); }
    // ---------- FSM босса ----------
    _boss(u, dt) {
      const f = u.fsm, hpf = u.hp / u.max; f.t += dt; f.regenT += dt;
      if (u.cast) { u.cast.t -= dt; if (u.cast.t <= 0) { const c = u.cast; u.cast = null; if (c.k === 'aoe') { const hs = this.heroes(); const tgt = hs.length ? hs[this.rng.int(0, hs.length - 1)] : null; if (tgt) this.telegraph(u, tgt.x, 50, 1.5, u.atk * 2.2, { elem: u.elem }); } else if (c.k === 'steal') { for (const h of this.heroes()) { const take = Math.min(h.mana, 15); h.mana -= take; u.mana = Math.min(u.maxMana, u.mana + take); this.heal(u, take * 2, u, true); } this.emit('steal', { id: u.id }); } } return; }
      // фаза 2 при HP < 50%: ярость, подкрепление, красный оттенок
      if (f.phase === 1 && hpf < 0.5) { f.phase = 2; u.tint = '#ff4a3a'; u.rate *= 1.35; u.atk *= 1.25; this.status(u, 'rage', 1e9); f.state = 'berserk'; this.summon(u, 3 + Math.floor(u.max / 3000), null); this.tempo = 1.25; this.emit('phase', { id: u.id, phase: 2, tempo: 1.25 }); this.invuln(u, 0.8); }
      // призыв по таймеру в фазе 1, чаще в фазе 2
      f.summonT -= dt; if (f.summonT <= 0) { f.summonT = f.phase === 1 ? 12 : 8; if (this.foes().filter((x) => x.summoned).length < 6) this.summon(u, f.phase === 1 ? 2 : 3); }
      f.aoeT -= dt; if (f.aoeT <= 0) { f.aoeT = f.phase === 1 ? 9 : 5; if (f.phase === 2) { u.cast = { k: 'aoe', t: 0.8 }; this.emit('cast', { id: u.id, k: 'aoe' }); } else if (this.rng() < 0.5) { u.cast = { k: 'aoe', t: 0.6 }; this.emit('cast', { id: u.id, k: 'aoe' }); } }
      f.stealT -= dt; if (u.stealer && f.stealT <= 0) { f.stealT = 12; u.cast = { k: 'steal', t: 1 }; this.emit('cast', { id: u.id, k: 'steal' }); }
      // регенерация: если 6 с не получал урон и фаза 1
      if (this.t - u.lastHit > 6 && f.phase === 1 && u.regen) this.heal(u, u.max * 0.01 * dt, u, true);
      f.state = f.phase === 2 ? 'berserk' : 'attack';
    }
    // ---------- шаг ----------
    update(dt) {
      if (this.over) return; dt = Math.min(dt, this.dtMax); this.t += dt;
      // статусы и ДОТ
      for (const u of this.units) {
        if (!u.alive) continue; u.t += dt; u.cd -= dt; if (u.iframes > 0) u.iframes -= dt; if (u.mana < u.maxMana) u.mana = Math.min(u.maxMana, u.mana + dt * 2);
        for (let i = u.st.length - 1; i >= 0; i--) {
          const s = u.st[i]; s.left -= dt;
          if ((s.k === 'poison' || s.k === 'bleed' || s.k === 'burn') && s.dps) { s.tick -= dt; if (s.tick <= 0) { s.tick += 1; this.damage(null, u, s.dps, { dot: true, elem: s.k === 'burn' ? 'fire' : 'phys', true: false }); if (!u.alive) break; } }
          if (s.left <= 0) u.st.splice(i, 1);
        }
        if (!u.alive) continue;
        if (u.side === 'e' && !u.boss) { u.rageT += dt; if (u.rageT > this.cooldownRage && !this.has(u, 'rage')) { this.status(u, 'rage', 1e9); u.tint = u.tint || '#ff6a4a'; this.emit('enrage', { id: u.id }); } }
        if (u.fsm) this._boss(u, dt);
        if (this.has(u, 'stun') || this.has(u, 'freeze') || u.cast) continue;
        // привязка душ
        if (u.side === 'h' && (u.cls === 'priest' || u.cls === 'necro') && u.mana >= 30 && u.cd <= 0) { const dead = this.units.find((x) => !x.alive && x.side === 'h' && x.soulBound === u.id && !x.revived); if (dead) { u.mana -= 30; dead.revived = true; dead.alive = true; dead.hp = dead.max * 0.4; dead.soulBound = false; dead.iframes = 1; u.cd = 2; this.emit('revive', { id: dead.id, by: u.id }); continue; } }
        // лекарь лечит слабейшего
        if (u.healer && u.cd <= 0) { const al = this.units.filter((x) => x.alive && x.side === u.side && x.hp < x.max); if (al.length) { al.sort((a, b) => a.hp / a.max - b.hp / b.max); this.heal(al[0], u.atk * 1.5, u); u.cd = 1 / u.rate; continue; } }
        const tgt = this.pickTarget(u); if (!tgt) continue;
        const dist = Math.abs(tgt.x - u.x), spd = 30 * u.speed * (this.has(u, 'freeze') ? 0 : 1);
        if (dist > u.range) { u.x += (tgt.x > u.x ? 1 : -1) * Math.min(spd * dt, dist - u.range + 0.01); }
        else if (u.cd <= 0) { this.attack(u, tgt); u.cd = 1 / (u.rate * (u.fsm && u.fsm.phase === 2 ? 1 : 1)); }
      }
      // зоны
      for (let i = this.zones.length - 1; i >= 0; i--) {
        const z = this.zones[i]; z.t -= dt; if (z.t > 0) continue; this.zones.splice(i, 1); const src = this.units.find((u) => u.id === z.src);
        for (const u of this.units) if (u.alive && u.side !== z.side && Math.abs(u.x - z.x) < z.w / 2) { this.damage(src || null, u, z.dmg, Object.assign({ elem: 'phys' }, z.o)); if (u.alive) this.knock(u, z.x, 14); }
        for (const w of this.walls) if (w.hp > 0 && Math.abs(w.x - z.x) < z.w / 2) { w.hp -= z.dmg; if (w.hp <= 0) this.emit('wall.break', { x: w.x }); }
        this.emit('boom', { x: z.x, w: z.w });
      }
      for (let i = this.barriers.length - 1; i >= 0; i--) { const b = this.barriers[i]; b.t -= dt; if (b.t <= 0) this.barriers.splice(i, 1); }
      // отложенные эффекты (возрождение миньонов)
      for (let i = this.fx.length - 1; i >= 0; i--) { const e = this.fx[i]; e.t -= dt; if (e.t <= 0) { this.fx.splice(i, 1); const n = this.units.find((x) => x.id === e.necro && x.alive); if (n && e.k === 'respawn') { const u = this.add(Object.assign({ side: n.side, x: e.x, summoned: true, necroId: n.id, tpl: e.tpl }, e.tpl)); if (u) { u.hp = u.max * 0.6; this.emit('respawn', { id: u.id }); } } } }
      this._check();
      // чистка мёртвых миньонов, чтобы массив не рос
      if (this.units.length > 60) this.units = this.units.filter((u) => u.alive || u.boss || u.side === 'h');
    }
    // Завершение боя: одновременная гибель = победа героев, если босс пал в этот же тик
    _check() {
      const h = this.units.some((u) => u.side === 'h' && u.alive), e = this.units.some((u) => u.side === 'e' && u.alive && !u.summoned && !u.split) || this.units.some((u) => u.side === 'e' && u.alive && u.split);
      const anyE = this.units.some((u) => u.side === 'e' && u.alive);
      if (!anyE) { this.over = true; this.result = h ? 'win' : 'win-mutual'; }
      else if (!h) { const any = this.units.some((u) => u.side === 'h' && !u.alive && u.soulBound && !u.revived); this.over = true; this.result = any ? 'lose' : 'lose'; }
      if (this.over) { this.emit('end', { result: this.result, t: this.t }); }
    }
    run(maxT, dt) { dt = dt || 0.05; while (!this.over && this.t < (maxT || 120)) this.update(dt); if (!this.over) { this.over = true; this.result = 'timeout'; } return this.result; }
    // ---------- DPS-метр ----------
    meter() { return this.units.filter((u) => u.side === 'h').map((u) => ({ id: u.id, name: u.name, dps: this.t > 0 ? u.dealt / this.t : 0, dealt: u.dealt, healed: u.healed, taken: u.taken })).sort((a, b) => b.dealt - a.dealt); }
    // Процедурное дыхание и покачивание крупного босса: смещение и масштаб по времени
    static idleBob(t, seed, size) { const k = (size || 1), s = seed || 0; return { dy: Math.round(Math.sin(t * 1.6 + s) * 1.5 * k), sx: 1 + Math.sin(t * 1.6 + s) * 0.015 * k, sy: 1 - Math.sin(t * 1.6 + s) * 0.02 * k, sway: Math.round(Math.sin(t * 0.8 + s) * k) }; }
  }
  FF.Battle = Battle; FF.BattleData = { RES, MUTS, ELEM, cry };
  if (typeof module !== 'undefined' && module.exports) module.exports = FF;
})(typeof window !== 'undefined' ? window : globalThis);
