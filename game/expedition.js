// FROSTFALL: ExpeditionEngine и ExpeditionManager. Вылазки считаются детерминированно по seed (шаг боя 0.5 с, без нагрузки на кадр),
// игроку показывается таймлайн. Состояние запущенной вылазки хранится как {seed, params, party, start}: результат пересчитывается точно так же.
(function (root) {
  'use strict';
  const FF = root.FF = root.FF || {};

  // 6 типов комнат; элитный мини-босс появляется в середине как вариант боя
  const ROOMS = [['fight', 40], ['event', 20], ['treasure', 15], ['camp', 12], ['trap', 13]]; // 'boss' всегда последняя
  const ROOM_NAMES = { fight: 'Бой', event: 'Событие', treasure: 'Сокровищница', camp: 'Привал', trap: 'Ловушка', boss: 'Босс', elite: 'Элита' };
  // Случайные модификаторы вылазки: погода и условия
  const MODS = [
    { id: 'clear',   name: 'Ясно',            enemy: 1,    loot: 1,    trap: 1 },
    { id: 'blizzard',name: 'Метель',          enemy: 1.12, loot: 1.2,  trap: 1.3 },
    { id: 'night',   name: 'Тёмная ночь',     enemy: 1.2,  loot: 1.3,  trap: 1 },
    { id: 'thaw',    name: 'Оттепель',        enemy: 0.92, loot: 0.9,  trap: 0.8 },
    { id: 'ghosts',  name: 'Шёпот призраков', enemy: 1.1,  loot: 1.1,  trap: 1.1, event: 1.5 },
    { id: 'lucky',   name: 'Счастливый день', enemy: 1,    loot: 1.4,  trap: 1 },
  ];
  const ZN_A = ['Ледяной', 'Забытый', 'Шепчущий', 'Тёмный', 'Мёртвый', 'Золотой', 'Проклятый', 'Белый'], ZN_B = ['перевал', 'склеп', 'овраг', 'чертог', 'лес', 'рудник', 'мост', 'курган'];
  const CLASSES = ['paladin', 'ranger', 'necro', 'rogue', 'priest'];

  const mulb = (s) => FF.Rng(s);
  const enemyPower = (T, mod) => 40 * Math.pow(1.18, T) * (mod ? mod.enemy : 1);

  class ExpeditionEngine {
    zoneName(seed) { const r = mulb(seed ^ 0x51ED); return r.pick(ZN_A) + ' ' + r.pick(ZN_B); } // процедурное название зоны
    modifier(seed) { const r = mulb(seed ^ 0x3C6E); return MODS[r.weighted([[0, 3], [1, 2], [2, 1.5], [3, 2], [4, 1.2], [5, 1]])]; }
    // threat 1..20, len >= 3, seed: число. Возвращает { rooms, mod, name }
    generate(threat, len, seed, layout) {
      const r = mulb(seed), mod = this.modifier(seed), rooms = [], mid = Math.floor((len - 1) / 2);
      if (Array.isArray(layout) && layout.length >= 2) { // карта из редактора задаёт порядок комнат
        layout.slice(0, 11).forEach((l, i) => rooms.push({ type: ['fight', 'treasure', 'camp', 'trap', 'event'].includes(l.type) && ROOMS.some((q) => q[0] === l.type) ? l.type : 'fight', elite: !!l.elite, T: threat + Math.floor(i / 2) + (l.elite ? 2 : 0), seen: false }));
        rooms.push({ type: 'boss', elite: false, T: threat + rooms.length, seen: false }); return { rooms, mod, name: this.zoneName(seed) };
      }
      for (let i = 0; i < len - 1; i++) {
        let type = r.weighted(ROOMS); if (i === 0 && type === 'camp') type = 'fight'; // в самой первой комнате привала не бывает
        const elite = i === mid && len >= 5; if (elite) type = 'fight';
        rooms.push({ type, elite, T: threat + Math.floor(i / 2) + (elite ? 2 : 0), seen: false });
      }
      rooms.push({ type: 'boss', elite: false, T: threat + len, seen: false });
      return { rooms, mod, name: this.zoneName(seed) };
    }
    // Туман войны: видна комната, в которой стоит отряд, и следующая (разведка видит дальше)
    revealed(rooms, pos, scouts) { return rooms.map((r, i) => i <= pos + 1 + (scouts || 0)); }
    // Синергия классов в отряде: множители
    synergy(party) {
      const cls = new Set(party.map((h) => h.cls).filter(Boolean)), s = { atk: 1, def: 1, heal: 1, crit: 0 };
      if (cls.size >= 3) s.atk *= 1.08; if (cls.size >= 5) s.atk *= 1.07;
      if (cls.has('paladin')) s.def *= 1.15; if (cls.has('priest')) s.heal *= 1.5; if (cls.has('rogue') && cls.has('ranger')) s.crit += 0.06; if (cls.has('necro') && cls.has('priest')) s.atk *= 1.05;
      return s;
    }
    enemy(room, mod) { const E = enemyPower(room.T, mod) * (room.type === 'boss' ? 3 : room.elite ? 1.8 : 1); return { power: E, hp: E * 6, atk: E * 0.08 }; }
    makeHero(h, syn, fatigueMult) {
      const f = fatigueMult(h);
      return { id: h.id, name: h.name || h.id, cls: h.cls, hp: Math.max(1, h.hp), cur: Math.max(1, (h.cur != null ? h.cur : h.hp)), atk: h.atk * syn.atk * f, def: h.def * syn.def, crit: Math.min(0.9, (h.crit || 0.05) + syn.crit), vamp: h.vamp || 0, skills: (h.skills || []).map((s) => ({ cd: s.cd, mul: s.mul })), cds: (h.skills || []).map(() => 0), alive: true, xp: 0, injured: 0, temp: !!h.temp };
    }
    // Один бой по шагам 0.5 с. Возвращает true, если отряд победил.
    fight(party, en, r, log) {
      let ehp = en.hp; const syn = party._syn;
      for (let step = 0; step < 160 && ehp > 0; step++) {
        const live = party.filter((h) => h.alive); if (!live.length) return false;
        for (const h of live) {
          let d = h.atk * 0.5 * (r() < h.crit ? 2 : 1);
          for (let i = 0; i < h.skills.length; i++) { h.cds[i] -= 0.5; if (h.cds[i] <= 0) { d += h.atk * h.skills[i].mul; h.cds[i] = h.skills[i].cd; } } // кулдауны навыков
          ehp -= d; if (h.vamp > 0) h.cur = Math.min(h.hp, h.cur + d * Math.min(0.25, h.vamp));            // вампиризм
        }
        if (ehp <= 0) break;
        const t = live[Math.floor(r() * live.length)];
        t.cur -= Math.max(en.atk * 0.05, en.atk - t.def * 0.4);                                           // броня режет урон, но не до нуля
        if (syn && syn.heal > 1) { const pr = live.find((h) => h.cls === 'priest'); if (pr) { const w = live.reduce((a, b) => (b.cur / b.hp < a.cur / a.hp ? b : a)); w.cur = Math.min(w.hp, w.cur + pr.atk * 0.02 * syn.heal); } }
        if (t.cur <= 0) { t.alive = false; t.cur = 0; }
      }
      return ehp <= 0 && party.some((h) => h.alive);
    }
    // params: { threat, len, seed, provisions, scouts, fatigue:(h)=>mult }
    run(partyIn, params) {
      const p = Object.assign({ threat: 1, len: 6, seed: 1, provisions: 3 }, params), gen = this.generate(p.threat, p.len, p.seed, p.layout), rooms = gen.rooms, mod = gen.mod;
      const r = mulb(p.seed ^ 0x9E3779B1), log = [], loot = { gold: 0, res: 0, items: 0, frags: 0 }, fm = p.fatigue || ((h) => 1);
      const tmp = partyIn.map((h) => Object.assign({}, h)), syn = this.synergy(tmp);
      const party = tmp.map((h) => this.makeHero(h, syn, fm)); party._syn = syn;
      let prov = p.provisions, reached = 0, bossKilled = false, wipedAt = -1, chests = 0, kills = 0;
      const timeline = []; let tt = 0;
      const mk = (i, text, dur) => { timeline.push({ i, t0: tt, t1: tt + dur, type: rooms[i].elite ? 'elite' : rooms[i].type, text }); tt += dur; log.push(text); };
      for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i], alive = party.filter((h) => h.alive); if (!alive.length) break; reached++;
        const lootK = mod.loot * (1 + 0.04 * i);
        if (room.type === 'camp') {
          if (prov > 0) { prov--; for (const h of alive) h.cur = Math.min(h.hp, h.cur + h.hp * 0.35); mk(i, 'Привал: отряд лечится на 35% за провизию', 12); } else { for (const h of alive) h.cur = Math.min(h.hp, h.cur + h.hp * 0.1); mk(i, 'Привал без провизии: лечение лишь 10%', 12); }
        } else if (room.type === 'trap') {
          const dmg = enemyPower(room.T, mod) * 0.06 * mod.trap; for (const h of alive) { h.cur -= Math.max(0, dmg - h.def * 0.5); if (h.cur <= 0) { h.alive = false; h.cur = 0; } } mk(i, 'Ловушка! Отряд получает урон', 8);
        } else if (room.type === 'treasure') {
          const g = 30 * Math.pow(1.12, room.T) * (0.8 + 0.4 * r()) * lootK; loot.gold += g; if (r() < 0.3) loot.items++; chests++; mk(i, 'Сокровищница: найден сундук', 10);
        } else if (room.type === 'event') {
          const x = r(); if (x < 0.1 * (mod.event || 1)) { const v = alive[Math.floor(r() * alive.length)]; v.injured = 1; v.cur = Math.max(1, v.cur - v.hp * 0.3); mk(i, 'Событие: герой ' + v.name + ' получил травму', 10); }  // травма при критической неудаче
          else if (x < 0.55) { loot.res += (20 + room.T * 4) * lootK; mk(i, 'Событие: удача, найдены припасы', 10); } else { for (const h of alive) { h.cur -= h.hp * 0.1; if (h.cur <= 0) { h.alive = false; h.cur = 0; } } mk(i, 'Событие: засада, отряд ранен', 10); }
        } else { // fight, elite, boss
          const en = this.enemy(room, mod), win = this.fight(party, en, r, log); const lab = room.type === 'boss' ? 'Босс' : room.elite ? 'Элитный страж' : 'Бой';
          if (!win) { mk(i, lab + ': отряд разбит', 14); if (reached === 1) wipedAt = 0; break; } // отряд разбит в первой же комнате: добыча не засчитывается
          const k = room.type === 'boss' ? 4 : room.elite ? 2.2 : 1; loot.gold += 40 * k * Math.pow(1.12, room.T) * (0.8 + 0.4 * r()) * lootK; loot.res += (12 * k + room.T * 3) * lootK;
          if (r() < 0.2 * k) loot.items++; if (room.type === 'boss' || (room.elite && r() < 0.5)) loot.frags += room.type === 'boss' ? 2 : 1; kills++;
          if (room.type === 'boss') bossKilled = true; mk(i, lab + ' повержен', room.type === 'boss' ? 22 : room.elite ? 18 : 14);
        }
        for (const h of party) if (h.alive) h.xp += 10 + room.T * 2; // опыт выжившим за каждую комнату
      }
      if (reached <= 1 && !party.some((h) => h.alive)) wipedAt = 0; // весь отряд погиб в первой комнате (ловушка, засада)
      const win = bossKilled && party.some((h) => h.alive);
      const mult = win ? 1 : wipedAt === 0 ? 0 : 0.4; // поражение спасает 40% добычи, а гибель в первой комнате не оставляет ничего
      loot.gold = Math.round(loot.gold * mult); loot.res = Math.round(loot.res * mult); loot.items = win ? loot.items : 0; loot.frags = win ? loot.frags : 0; if (mult === 0) loot.items = 0;
      const heal = party.map((h) => ({ id: h.id, hp: h.hp })); // при возвращении в лагерь здоровье восстанавливается
      const surv = party.filter((h) => h.alive);
      return { win, reached, bossKilled, wiped: wipedAt === 0, log, timeline, duration: tt, loot, mod: mod.id, name: gen.name, chests, kills, provLeft: prov,
        survivors: surv.map((h) => ({ id: h.id, name: h.name, xp: Math.round(h.xp), injured: h.injured })), dead: party.filter((h) => !h.alive).map((h) => h.id), heal, rooms: rooms.map((x) => x.type) };
    }
    // Оценка шанса успеха для интерфейса: 40 прогонов с другими seed (детерминированно)
    estimate(party, params, n) {
      n = n || 40; let w = 0; for (let i = 0; i < n; i++) if (this.run(party, Object.assign({}, params, { seed: (params.seed || 1) * 7919 + i * 104729 + 13 })).win) w++;
      return w / n;
    }
    // Состояние таймлайна на момент elapsed (сек): какая комната идёт, доля пути, маркер для фишки отряда
    progress(res, elapsed) {
      const tl = res.timeline; let cur = -1;
      for (let i = 0; i < tl.length; i++) if (elapsed >= tl[i].t0) cur = i;
      const done = elapsed >= res.duration, room = tl[Math.max(0, cur)], frac = room ? Math.min(1, Math.max(0, (elapsed - room.t0) / Math.max(0.01, room.t1 - room.t0))) : 0;
      return { room: Math.max(0, cur), frac, done, pos: cur + (done ? 1 : frac), t: Math.min(elapsed, res.duration) };
    }
    // Авто-разведчики: небольшой безопасный сбор базового ресурса
    scout(minutes, seed, level) { const r = mulb(seed ^ 0x77), ok = r() > 0.12; const base = (level || 1) * minutes * 6; return { ok, res: ok ? Math.round(base * (0.8 + 0.4 * r())) : Math.round(base * 0.2) }; }
    // Наёмник на одну вылазку: стоит золота, слабее героя того же уровня
    mercenary(threat, seed) { const r = mulb(seed ^ 0xA5), cls = r.pick(CLASSES), E = enemyPower(threat); return { hero: { id: 'merc' + seed, name: r.pick(['Наёмник', 'Охотник', 'Вольный']), cls, atk: E * 0.09, hp: E * 0.9, def: E * 0.01, crit: 0.08, vamp: cls === 'priest' ? 0.05 : 0, skills: [{ cd: 4, mul: 1.5 }], temp: true }, cost: Math.round(E * 8) }; }
  }

  // ----- менеджер: слоты, лимит отряда по Ратуше, статистика, усталость, эвакуация, сохранение -----
  class ExpeditionManager {
    // st: хранимый объект (S.ff.exp); ctx: { now(), hallLvl(), grant(loot), heroes(id) -> герой, xp(id, n) }
    constructor(st, bus, ctx, engine) { this.s = st; this.bus = bus; this.ctx = ctx; this.eng = engine || new ExpeditionEngine(); this.cache = new Map(); this._heal(); }
    _heal() {
      const s = this.s; if (!Array.isArray(s.runs)) s.runs = [];
      s.runs = s.runs.filter((q) => q && Number.isFinite(q.start) && Number.isFinite(q.seed) && Array.isArray(q.party) && q.party.length && q.party.length <= 6 && q.party.every((h) => h && Number.isFinite(h.atk) && Number.isFinite(h.hp)) && q.threat >= 1 && q.len >= 3);
      s.stats = Object.assign({ runs: 0, wins: 0, losses: 0, rooms: 0, gold: 0, evac: 0, chests: 0 }, s.stats && typeof s.stats === 'object' ? s.stats : {});
      for (const k in s.stats) if (!Number.isFinite(s.stats[k])) s.stats[k] = 0;
      if (!s.fat || typeof s.fat !== 'object') s.fat = {}; if (!Number.isFinite(s.seedN)) s.seedN = 1;
    }
    slots() { return Math.min(4, 1 + Math.floor(((this.ctx.hallLvl ? this.ctx.hallLvl() : 1) - 1) / 3)); }            // слоты вылазок растут с Ратушей
    squadCap() { return Math.min(5, 2 + Math.floor((this.ctx.hallLvl ? this.ctx.hallLvl() : 1) / 3)); }               // лимит отряда
    free() { return this.slots() - this.s.runs.length; }
    // Усталость: каждая вылазка +15%, спад 1% в минуту реального времени; штраф урона до 25%
    fatigue(id) { const f = this.s.fat[id]; if (!f) return 0; const now = this.ctx.now(), left = Math.max(0, f.v - (now - f.t) / 60000 * 1); return left; }
    fatigueMult(id) { return 1 - Math.min(25, this.fatigue(id)) / 100; }
    _addFat(id) { const now = this.ctx.now(); this.s.fat[id] = { v: Math.min(60, this.fatigue(id) + 15), t: now }; }
    start(party, o) {
      o = o || {}; if (this.free() <= 0) return { error: 'Нет свободных слотов' }; if (!party || !party.length) return { error: 'Пустой отряд' }; if (party.length > this.squadCap()) return { error: 'Слишком большой отряд (максимум ' + this.squadCap() + ')' };
      if (new Set(party.map((h) => h.id)).size !== party.length) return { error: 'Один герой дважды' };
      for (const h of party) if (!h.temp && this.s.runs.some((q) => q.party.some((x) => x.id === h.id))) return { error: 'Герой ' + (h.name || h.id) + ' уже в походе' };
      const seed = (this.s.seedN++ * 2654435761 + (this.ctx.now() % 100000)) >>> 0;
      const run = { seed, threat: Math.max(1, Math.min(20, o.threat | 0 || 1)), len: Math.max(3, Math.min(12, o.len | 0 || 6)), provisions: Math.max(0, o.provisions == null ? 3 : o.provisions | 0), scouts: o.scouts | 0, start: this.ctx.now(), layout: Array.isArray(o.layout) ? o.layout.slice(0, 11).map((l) => ({ type: String(l.type).slice(0, 8), elite: !!l.elite })) : undefined, mapName: o.mapName ? String(o.mapName).slice(0, 32) : undefined,
        party: party.map((h) => ({ id: h.id, name: h.name, cls: h.cls, hp: h.hp, cur: h.cur, atk: h.atk, def: h.def, crit: h.crit, vamp: h.vamp, skills: h.skills, temp: !!h.temp, fm: this.fatigueMult(h.id) })) };
      for (const h of party) if (!h.temp) this._addFat(h.id);
      this.s.runs.push(run); this.s.stats.runs++; if (this.bus) this.bus.emit('exp.start', { seed }); return { run };
    }
    result(run) { let r = this.cache.get(run.seed); if (!r) { r = this.eng.run(run.party, { threat: run.threat, len: run.len, seed: run.seed, provisions: run.provisions, scouts: run.scouts, layout: run.layout, fatigue: (h) => (h.fm != null ? h.fm : 1) }); this.cache.set(run.seed, r); if (this.cache.size > 20) this.cache.delete(this.cache.keys().next().value); } return r; }
    elapsed(run) { return Math.max(0, Math.min(this.ctx.now() - run.start, 1e9)) / 1000 * (this.speed || 1); }   // защита от переноса времени: now() идёт через FF.Clock.safeNow
    state(run) { const res = this.result(run), el = this.elapsed(run); return Object.assign({ res }, this.eng.progress(res, el), { fog: this.eng.revealed(res.rooms.map((t) => ({ type: t })), this.eng.progress(res, el).room, run.scouts) }); }
    // Смена комнаты: сообщаем шине (звук, анимации)
    update() { for (const run of this.s.runs) { const st = this.state(run); if (run._room !== st.room) { run._room = st.room; if (this.bus) this.bus.emit('exp.room', { type: st.res.timeline[st.room] && st.res.timeline[st.room].type, i: st.room }); } } }
    ready(run) { return this.elapsed(run) >= this.result(run).duration; }
    _finish(idx, loot, res, evac) {
      const run = this.s.runs[idx]; this.s.runs.splice(idx, 1); this.s.stats.rooms += res.reached || 0; this.s.stats.chests += res.chests || 0;
      if (res.win && !evac) this.s.stats.wins++; else this.s.stats.losses++; if (evac) this.s.stats.evac++;
      this.s.stats.gold += Math.round(loot.gold || 0);
      if (this.ctx.grant) this.ctx.grant(loot, res, run); if (this.ctx.xp) for (const h of res.survivors) if (!String(h.id).startsWith('merc')) this.ctx.xp(h.id, h.xp);
      if (this.bus) { this.bus.emit('expedition', { win: !!res.win && !evac, n: 1 }); this.bus.emit('exp.done', { win: res.win, evac: !!evac, loot }); }
      return { res, loot, evac: !!evac };
    }
    claim(idx) { const run = this.s.runs[idx]; if (!run || !this.ready(run)) return null; const res = this.result(run); return this._finish(idx, res.loot, res, false); }
    // Экстренная эвакуация: забираем только половину того, что успели собрать к этому моменту
    evacuate(idx) {
      const run = this.s.runs[idx]; if (!run || this.ready(run)) return this.claim(idx); const res = this.result(run), st = this.eng.progress(res, this.elapsed(run)), k = Math.max(0, Math.min(1, (st.room + st.frac) / Math.max(1, res.timeline.length)));
      const loot = { gold: Math.round(res.loot.gold * k * 0.5), res: Math.round(res.loot.res * k * 0.5), items: 0, frags: 0 };
      return this._finish(idx, loot, Object.assign({}, res, { win: false, survivors: res.survivors.map((h) => ({ id: h.id, name: h.name, xp: Math.round(h.xp * k), injured: h.injured })) }), true);
    }
    // Мгновенный просчёт для отладки (ничего не меняет в сохранении)
    instant(party, o) { return this.eng.run(party, Object.assign({ threat: 1, len: 6, seed: 12345 }, o)); }
  }

  FF.ExpeditionEngine = ExpeditionEngine; FF.ExpeditionManager = ExpeditionManager; FF.ExpData = { ROOM_NAMES, MODS, CLASSES, enemyPower };
  if (typeof module !== 'undefined' && module.exports) module.exports = FF;
})(typeof window !== 'undefined' ? window : globalThis);
