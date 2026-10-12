// FROSTFALL: Forge. Классы и формулы характеристик, деревья навыков (3 ветки, респек), заточка +1..+20 (свитки защиты, жалость),
// руны и сокеты, алхимия (до 3 эффектов), найм в таверне, прочность и ремонт, склад, замок предмета, чертежи, гарантия легендарки.
// Состояние: s.ff.fg (ресурсы, зелья, очки, наёмники, склад); на предметах лежат поля enh / dur / sock / lock.
(function (root) {
  'use strict';
  const FF = root.FF = root.FF || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------- классы ----------------
  // base: стартовые значения на 1 уровне; gr: рост за уровень. atk/hp/def — числа, crit/critd/block/vamp — доли.
  const CLASSES = {
    warrior: { id: 'warrior', name: 'Воин', desc: 'Крепкий боец без слабых мест.', base: { atk: 10, hp: 120, def: 4, crit: 0.05, critd: 1.5, block: 0.05, vamp: 0 }, gr: { atk: 1.0, hp: 12, def: 0.5 }, req: null },
    paladin: { id: 'paladin', name: 'Паладин', desc: 'Щит и свет: блок и лечение.', base: { atk: 9, hp: 150, def: 7, crit: 0.03, critd: 1.4, block: 0.18, vamp: 0.02 }, gr: { atk: 0.8, hp: 16, def: 0.8 }, req: 'ch_paladin' },
    ranger: { id: 'ranger', name: 'Следопыт', desc: 'Дальний бой, высокий шанс крита.', base: { atk: 12, hp: 95, def: 2, crit: 0.14, critd: 1.6, block: 0.02, vamp: 0 }, gr: { atk: 1.15, hp: 9, def: 0.3 }, req: 'ch_ranger' },
    necro: { id: 'necro', name: 'Некромант', desc: 'Вампиризм и проклятия.', base: { atk: 11, hp: 100, def: 2, crit: 0.06, critd: 1.5, block: 0.02, vamp: 0.09 }, gr: { atk: 1.1, hp: 10, def: 0.3 }, req: 'ch_necro' },
    rogue: { id: 'rogue', name: 'Убийца', desc: 'Огромный урон крита.', base: { atk: 13, hp: 90, def: 2, crit: 0.12, critd: 1.9, block: 0.03, vamp: 0 }, gr: { atk: 1.2, hp: 8, def: 0.25 }, req: 'ch_rogue' },
    priest: { id: 'priest', name: 'Жрец', desc: 'Поддержка: лечение и золото.', base: { atk: 8, hp: 110, def: 3, crit: 0.04, critd: 1.4, block: 0.06, vamp: 0.04 }, gr: { atk: 0.75, hp: 11, def: 0.45 }, req: 'ch_priest' },
  };
  const CAPS = { crit: 0.75, block: 0.6, vamp: 0.3, critd: 5 };

  // ---------------- деревья навыков ----------------
  // Узел: [id, ветка, ярус(0..4), название, ранги, эффект за ранг {stat: значение}]. Ярус n открывается, когда в ветке вложено >= n*2 очков.
  const T = (cls, a, b, c) => ({ cls, branches: [a, b, c] });
  const node = (id, tier, name, max, fx) => ({ id, tier, name, max, fx });
  const mk = (cls, defs) => defs.map((br) => ({ name: br.name, nodes: br.n.map((n, i) => node(cls + '_' + br.k + i, i, n[0], n[1], n[2])) }));
  const TREES = {
    warrior: mk('warrior', [
      { k: 'a', name: 'Ярость', n: [['Острый клинок', 5, { atkP: 0.04 }], ['Размах', 3, { critd: 0.05 }], ['Кровожадность', 3, { vamp: 0.01 }], ['Берсерк', 3, { atkP: 0.05 }], ['Мастер войны', 1, { atkP: 0.15, crit: 0.05 }]] },
      { k: 'b', name: 'Стойкость', n: [['Закалка', 5, { hpP: 0.05 }], ['Броня', 3, { def: 2 }], ['Щитовик', 3, { block: 0.02 }], ['Несгибаемый', 3, { hpP: 0.06 }], ['Бастион', 1, { block: 0.08, hpP: 0.1 }]] },
      { k: 'c', name: 'Добыча', n: [['Мародёр', 5, { goldP: 0.04 }], ['Опыт', 3, { xpP: 0.04 }], ['Удача', 3, { crit: 0.015 }], ['Охотник', 3, { goldP: 0.05 }], ['Король бродяг', 1, { goldP: 0.2, xpP: 0.1 }]] },
    ]),
    paladin: mk('paladin', [
      { k: 'a', name: 'Свет', n: [['Святой удар', 5, { atkP: 0.035 }], ['Благословение', 3, { vamp: 0.01 }], ['Кара', 3, { critd: 0.05 }], ['Сияние', 3, { atkP: 0.05 }], ['Десница', 1, { atkP: 0.15, vamp: 0.03 }]] },
      { k: 'b', name: 'Щит', n: [['Большой щит', 5, { block: 0.015 }], ['Латы', 3, { def: 3 }], ['Крепость духа', 3, { hpP: 0.06 }], ['Стена', 3, { block: 0.02 }], ['Неприступный', 1, { block: 0.1, def: 10 }]] },
      { k: 'c', name: 'Вера', n: [['Милосердие', 5, { hpP: 0.04 }], ['Покровитель', 3, { goldP: 0.04 }], ['Обет', 3, { xpP: 0.05 }], ['Исцеление', 3, { vamp: 0.01 }], ['Чудо', 1, { hpP: 0.2, vamp: 0.04 }]] },
    ]),
    ranger: mk('ranger', [
      { k: 'a', name: 'Меткость', n: [['Глаз', 5, { crit: 0.012 }], ['Прицел', 3, { critd: 0.07 }], ['Бронебойные', 3, { atkP: 0.04 }], ['Мастер лука', 3, { crit: 0.015 }], ['Снайпер', 1, { critd: 0.35, crit: 0.05 }]] },
      { k: 'b', name: 'Ловкость', n: [['Лёгкость', 5, { hpP: 0.03 }], ['Уклон', 3, { block: 0.02 }], ['Скрытность', 3, { def: 1.5 }], ['Следы', 3, { goldP: 0.04 }], ['Тень леса', 1, { block: 0.08, hpP: 0.1 }]] },
      { k: 'c', name: 'Охота', n: [['Следопыт', 5, { goldP: 0.04 }], ['Трофеи', 3, { xpP: 0.05 }], ['Ловушки', 3, { atkP: 0.04 }], ['Зверь', 3, { vamp: 0.01 }], ['Вожак', 1, { atkP: 0.15, goldP: 0.1 }]] },
    ]),
    necro: mk('necro', [
      { k: 'a', name: 'Смерть', n: [['Проклятие', 5, { atkP: 0.04 }], ['Жатва', 3, { vamp: 0.012 }], ['Костяной шип', 3, { critd: 0.06 }], ['Чума', 3, { atkP: 0.05 }], ['Жнец', 1, { atkP: 0.15, vamp: 0.04 }]] },
      { k: 'b', name: 'Тьма', n: [['Покров', 5, { hpP: 0.04 }], ['Теневой щит', 3, { block: 0.02 }], ['Тлен', 3, { def: 2 }], ['Дух', 3, { hpP: 0.05 }], ['Лич', 1, { hpP: 0.15, block: 0.06 }]] },
      { k: 'c', name: 'Прислужники', n: [['Скелеты', 5, { goldP: 0.04 }], ['Гули', 3, { xpP: 0.05 }], ['Вечные', 3, { crit: 0.012 }], ['Армия', 3, { atkP: 0.04 }], ['Повелитель', 1, { goldP: 0.15, atkP: 0.1 }]] },
    ]),
    rogue: mk('rogue', [
      { k: 'a', name: 'Убийство', n: [['Удар в спину', 5, { critd: 0.08 }], ['Яд', 3, { atkP: 0.04 }], ['Точка', 3, { crit: 0.015 }], ['Казнь', 3, { critd: 0.1 }], ['Тень смерти', 1, { critd: 0.5, crit: 0.05 }]] },
      { k: 'b', name: 'Скрытность', n: [['Плащ', 5, { block: 0.015 }], ['Рефлексы', 3, { hpP: 0.04 }], ['Исчезновение', 3, { def: 1.5 }], ['Фантом', 3, { block: 0.02 }], ['Призрак', 1, { block: 0.1, hpP: 0.1 }]] },
      { k: 'c', name: 'Воровство', n: [['Карманник', 5, { goldP: 0.05 }], ['Разведка', 3, { xpP: 0.04 }], ['Тайник', 3, { goldP: 0.05 }], ['Контрабанда', 3, { atkP: 0.03 }], ['Король воров', 1, { goldP: 0.25, crit: 0.04 }]] },
    ]),
    priest: mk('priest', [
      { k: 'a', name: 'Кара', n: [['Священный огонь', 5, { atkP: 0.035 }], ['Луч', 3, { critd: 0.05 }], ['Искупление', 3, { vamp: 0.012 }], ['Гнев небес', 3, { atkP: 0.05 }], ['Серафим', 1, { atkP: 0.15, crit: 0.05 }]] },
      { k: 'b', name: 'Исцеление', n: [['Молитва', 5, { hpP: 0.05 }], ['Покой', 3, { def: 2 }], ['Благодать', 3, { vamp: 0.012 }], ['Оберег', 3, { block: 0.02 }], ['Святость', 1, { hpP: 0.2, vamp: 0.03 }]] },
      { k: 'c', name: 'Милость', n: [['Дары', 5, { goldP: 0.05 }], ['Мудрость', 3, { xpP: 0.06 }], ['Пожертвования', 3, { goldP: 0.05 }], ['Просвещение', 3, { xpP: 0.06 }], ['Архиепископ', 1, { goldP: 0.2, xpP: 0.15 }]] },
    ]),
  };

  // ---------------- заточка ----------------
  // Шанс успеха по целевому уровню (+1..+20). До +3 гарантия; дальше растёт риск падения и поломки.
  const ENH_RATE = [1, 1, 1, 0.92, 0.85, 0.78, 0.7, 0.62, 0.55, 0.48, 0.42, 0.36, 0.3, 0.25, 0.2, 0.16, 0.12, 0.09, 0.07, 0.05];
  const ENH_MAX = 20;
  const enhRisk = (to) => (to <= 5 ? { drop: 0, brk: 0 } : to <= 10 ? { drop: 1, brk: 0 } : to <= 15 ? { drop: 1, brk: 0.08 } : { drop: 2, brk: 0.2 });
  const enhCost = (it, to) => Math.round(50 * Math.pow(1.38, to) * (1 + it.rar * 0.6));
  const enhBonus = (to) => 0.08 * to + (to >= 10 ? 0.1 : 0) + (to >= 15 ? 0.15 : 0) + (to >= 20 ? 0.3 : 0); // доля к значению предмета

  // ---------------- руны ----------------
  const RUNES = {
    ruby: { name: 'Рубин', col: '#ff5c5c', stat: 'atkP', v: [0.03, 0.07, 0.14] },
    sapphire: { name: 'Сапфир', col: '#5ca8ff', stat: 'crit', v: [0.01, 0.025, 0.05] },
    emerald: { name: 'Изумруд', col: '#5cff9a', stat: 'goldP', v: [0.04, 0.09, 0.18] },
    topaz: { name: 'Топаз', col: '#ffd24a', stat: 'vamp', v: [0.005, 0.012, 0.025] },
    onyx: { name: 'Оникс', col: '#a98cff', stat: 'block', v: [0.01, 0.025, 0.05] },
    pearl: { name: 'Жемчуг', col: '#e8f2ff', stat: 'hpP', v: [0.03, 0.07, 0.14] },
  };
  const RUNE_IDS = Object.keys(RUNES);
  const socketsFor = (it) => Math.min(3, Math.max(0, it.rar)); // c:0 r:1 e:2 l/m:3 (rar 0..4)

  // ---------------- алхимия ----------------
  const POTIONS = {
    power: { name: 'Зелье силы', desc: '+25% урона', dur: 180, fx: { atkP: 0.25 }, herb: 3, gold: 200 },
    fury: { name: 'Зелье ярости', desc: '+12% шанса крита', dur: 180, fx: { crit: 0.12 }, herb: 3, gold: 200 },
    greed: { name: 'Зелье жадности', desc: '+40% золота', dur: 240, fx: { goldP: 0.4 }, herb: 4, gold: 250 },
    stone: { name: 'Каменная кожа', desc: '+25% здоровья, +10% блока', dur: 240, fx: { hpP: 0.25, block: 0.1 }, herb: 4, gold: 250 },
    blood: { name: 'Кровавый эликсир', desc: '+6% вампиризма', dur: 120, fx: { vamp: 0.06 }, herb: 5, gold: 300 },
    wisdom: { name: 'Эликсир мудрости', desc: '+50% опыта', dur: 300, fx: { xpP: 0.5 }, herb: 4, gold: 300 },
  };
  const MAX_POTIONS = 3;

  // ---------------- чертежи ----------------
  const BLUEPRINTS = {
    bp_blade: { name: 'Чертёж: закалённый клинок', slot: 'weapon', rar: 2, cost: { debris: 40, essence: 6, gold: 1500 } },
    bp_plate: { name: 'Чертёж: ледяной панцирь', slot: 'armor', rar: 2, cost: { debris: 40, essence: 6, gold: 1500 } },
    bp_charm: { name: 'Чертёж: оберег удачи', slot: 'amulet', rar: 2, cost: { debris: 40, essence: 6, gold: 1500 } },
    bp_relic: { name: 'Чертёж: реликвия Севера', slot: 'weapon', rar: 3, cost: { debris: 120, essence: 20, gold: 15000 } },
  };

  const BAG_BASE = 24, STASH_MAX = 40;
  const LEGEND_PITY = 8; // каждый N-й босс акта без легендарки гарантированно даёт её

  class Forge {
    // s — состояние игры; ctx: {price(it) -> золото за продажу, makeItem(rar, slot) -> предмет, bus}
    constructor(s, ctx) {
      this.s = s; this.ctx = ctx || {}; this.bus = this.ctx.bus || FF.bus || null;
      this.rng = FF.Rng ? FF.Rng(Date.now() & 0xffffff) : Math.random;
      this.fix();
    }
    emit(t, d) { if (this.bus) this.bus.emit(t, d); }
    get st() { return this.s.ff.fg; }
    // привести состояние к допустимому виду (защита от битого сейва)
    fix() {
      const s = this.s; s.ff = s.ff || {}; const g = s.ff.fg = (s.ff.fg && typeof s.ff.fg === 'object') ? s.ff.fg : {};
      const n = (k, d) => { if (!Number.isFinite(g[k]) || g[k] < 0) g[k] = d; g[k] = Math.floor(g[k]); };
      n('debris', 0); n('essence', 0); n('scroll', 0); n('herb', 0); n('pity', 0); n('fails', 0); n('respecs', 0); n('bpMask', 0);
      if (!CLASSES[g.cls]) g.cls = 'warrior';
      if (!g.unlocked || typeof g.unlocked !== 'object') g.unlocked = {}; g.unlocked.warrior = 1;
      if (!g.nodes || typeof g.nodes !== 'object') g.nodes = {};
      if (!g.runes || typeof g.runes !== 'object') g.runes = {};
      if (!Array.isArray(g.pot)) g.pot = []; g.pot = g.pot.filter((p) => p && POTIONS[p.id] && Number.isFinite(p.left) && p.left > 0).slice(0, MAX_POTIONS);
      if (!Array.isArray(g.team)) g.team = []; g.team = g.team.filter((h) => h && typeof h.name === 'string' && Number.isFinite(h.atk)).slice(0, 6);
      if (!Array.isArray(g.stash)) g.stash = []; g.stash = g.stash.slice(0, STASH_MAX);
      if (!g.bp || typeof g.bp !== 'object') g.bp = {};
      // очки навыков не могут превышать уровень героя
      for (const id of Object.keys(g.nodes)) { if (!this._node(id) || !(g.nodes[id] > 0)) delete g.nodes[id]; else g.nodes[id] = Math.min(g.nodes[id], this._node(id).max); }
      if (this.spent() > this.s.hero.lvl) { g.nodes = {}; }
    }
    // ---------- класс и характеристики ----------
    cls() { return CLASSES[this.st.cls]; }
    canPick(id) { const c = CLASSES[id]; if (!c) return false; return !c.req || !!this.st.unlocked[id]; }
    unlock(id) { if (CLASSES[id]) { this.st.unlocked[id] = 1; this.emit('class.unlock', { id }); } }
    pickClass(id, free) {
      if (!this.canPick(id)) return { ok: false, why: 'Класс не открыт' }; if (id === this.st.cls) return { ok: false, why: 'Уже выбран' };
      const cost = free ? 0 : Math.round(500 * Math.pow(1.5, this.st.respecs)); if (this.s.gold < cost) return { ok: false, why: 'Не хватает золота' };
      this.s.gold -= cost; this.st.cls = id; this.st.nodes = {}; if (!free) this.st.respecs++; this.emit('class.pick', { id, cost }); return { ok: true, cost };
    }
    // Базовые характеристики класса на уровне lvl (без предметов и навыков)
    baseStats(lvl, clsId) {
      const c = CLASSES[clsId || this.st.cls], L = Math.max(1, lvl) - 1;
      return { atk: c.base.atk + c.gr.atk * L, hp: c.base.hp + c.gr.hp * L, def: c.base.def + c.gr.def * L, crit: c.base.crit, critd: c.base.critd, block: c.base.block, vamp: c.base.vamp };
    }
    // Суммарные модификаторы от навыков, рун на экипировке, зелий и прочности
    mods() {
      const m = { atkP: 0, hpP: 0, def: 0, crit: 0, critd: 0, block: 0, vamp: 0, goldP: 0, xpP: 0 };
      const add = (fx, k) => { for (const st in fx) m[st] = (m[st] || 0) + fx[st] * (k == null ? 1 : k); };
      const tr = TREES[this.st.cls];
      for (const br of tr) for (const n of br.nodes) { const r = this.st.nodes[n.id] || 0; if (r) add(n.fx, r); }
      for (const slot in this.s.equip) { const it = this.s.equip[slot]; if (!it || !it.sock) continue; for (const r of it.sock) if (r) { const d = RUNES[r.k]; if (d) m[d.stat] += d.v[clamp(r.t, 1, 3) - 1] * this.wear(it); } }
      for (const p of this.st.pot) add(POTIONS[p.id].fx);
      return m;
    }
    // ATK = (база + бонус оружия) * (1 + atkP); Crit/Block/Vamp ограничены потолком; CritDmg = множитель
    stats(lvl) {
      lvl = lvl || this.s.hero.lvl; const b = this.baseStats(lvl), m = this.mods();
      const w = this.s.equip.weapon, a = this.s.equip.armor;
      const wv = w ? this.itemVal(w) : 0, av = a ? this.itemVal(a) : 0;
      return {
        atk: (b.atk + wv * 0.5) * (1 + m.atkP),
        hp: (b.hp + av * 2) * (1 + m.hpP),
        def: b.def + m.def + av * 0.2,
        crit: Math.min(CAPS.crit, b.crit + m.crit),
        critd: Math.min(CAPS.critd, b.critd + m.critd),
        block: Math.min(CAPS.block, b.block + m.block),
        vamp: Math.min(CAPS.vamp, b.vamp + m.vamp),
        goldP: m.goldP, xpP: m.xpP,
      };
    }
    // Множитель урона для хука H.dmg: ATK и ожидаемый крит относительно базового воина того же уровня
    dmgFactor() { const st = this.stats(), b = this.baseStats(this.s.hero.lvl, 'warrior'); return Math.max(0.1, (st.atk * (1 + st.crit * (st.critd - 1))) / (b.atk * (1 + b.crit * (b.critd - 1)))); }
    goldFactor() { return 1 + this.mods().goldP; }
    xpFactor() { return 1 + this.mods().xpP; }
    // Эффективное значение предмета: заточка и прочность
    itemVal(it) { return it.val * (1 + enhBonus(it.enh || 0)) * this.wear(it); }
    wear(it) { return Number.isFinite(it.dur) && it.dur <= 0 ? 0.5 : 1; }
    // ---------- навыки ----------
    points() { return Math.max(0, this.s.hero.lvl - this.spent()); }
    free() { return this.points(); }
    spent() { let n = 0; for (const k in this.st.nodes) n += this.st.nodes[k]; return n; }
    _node(id) { for (const cl in TREES) for (const br of TREES[cl]) for (const n of br.nodes) if (n.id === id) return n; return null; }
    branchSpent(bi) { let n = 0; for (const nd of TREES[this.st.cls][bi].nodes) n += this.st.nodes[nd.id] || 0; return n; }
    tierOpen(bi, tier) { return this.branchSpent(bi) >= tier * 3; }
    canLearn(id) {
      const tr = TREES[this.st.cls]; let bi = -1, nd = null;
      tr.forEach((br, i) => br.nodes.forEach((n) => { if (n.id === id) { bi = i; nd = n; } })); if (!nd) return 'Нет такого навыка';
      if ((this.st.nodes[id] || 0) >= nd.max) return 'Максимум'; if (this.points() <= 0) return 'Нет очков'; if (!this.tierOpen(bi, nd.tier)) return 'Нужно ' + nd.tier * 3 + ' очков в ветке'; return '';
    }
    learn(id) { const why = this.canLearn(id); if (why) return { ok: false, why }; this.st.nodes[id] = (this.st.nodes[id] || 0) + 1; this.emit('skill.learn', { id, rank: this.st.nodes[id] }); return { ok: true }; }
    respecCost() { return Math.round(200 * Math.pow(Math.max(1, this.s.hero.lvl), 1.3) * (1 + this.st.respecs * 0.5)); }
    respec() { const c = this.respecCost(); if (!this.spent()) return { ok: false, why: 'Нечего сбрасывать' }; if (this.s.gold < c) return { ok: false, why: 'Не хватает золота' }; this.s.gold -= c; this.st.nodes = {}; this.st.respecs++; this.emit('skill.respec', { cost: c }); return { ok: true, cost: c }; }
    // ---------- заточка ----------
    enhInfo(it) {
      const to = (it.enh || 0) + 1; if (to > ENH_MAX) return null; const pity = Math.min(0.2, this.st.fails * 0.02), r = enhRisk(to);
      return { to, rate: Math.min(1, ENH_RATE[to - 1] + (ENH_RATE[to - 1] < 1 ? pity : 0)), cost: enhCost(it, to), debris: Math.ceil(to / 2), drop: r.drop, brk: r.brk, scrollNeeded: r.drop > 0 || r.brk > 0, bonus: enhBonus(to) };
    }
    // useScroll: свитком защищаем от падения и поломки (свиток тратится при провале)
    enhance(it, useScroll, rnd) {
      if (!it) return { ok: false, why: 'Нет предмета' }; const inf = this.enhInfo(it); if (!inf) return { ok: false, why: 'Максимум +20' };
      if (this.s.gold < inf.cost) return { ok: false, why: 'Не хватает золота' }; if (this.st.debris < inf.debris) return { ok: false, why: 'Не хватает обломков' };
      if (useScroll && this.st.scroll < 1) return { ok: false, why: 'Нет свитка защиты' };
      this.s.gold -= inf.cost; this.st.debris -= inf.debris;
      const roll = rnd == null ? this.rng() : rnd;
      if (roll < inf.rate) {
        it.enh = inf.to; this.st.fails = 0; this.emit('enhance', { id: it.id, to: inf.to, ok: true }); return { ok: true, res: 'success', to: inf.to };
      }
      this.st.fails++;
      let res = 'fail';
      if (inf.scrollNeeded && useScroll) { this.st.scroll--; res = 'protected'; }
      else if (inf.brk > 0 && (rnd == null ? this.rng() : 0) < inf.brk) {
        if (it.lock) { res = 'fail'; } else { res = 'break'; this._destroy(it); this.st.debris += 5 * inf.to; this.st.essence += 1; }
      } else if (inf.drop > 0) { it.enh = Math.max(0, (it.enh || 0) - inf.drop); res = 'drop'; }
      this.emit('enhance', { id: it.id, to: inf.to, ok: false, res }); return { ok: false, res };
    }
    _destroy(it) { const s = this.s; for (const k in s.equip) if (s.equip[k] === it) s.equip[k] = null; let i = s.bag.indexOf(it); if (i >= 0) s.bag.splice(i, 1); i = this.st.stash.indexOf(it); if (i >= 0) this.st.stash.splice(i, 1); }
    // ---------- распыление и ресурсы ----------
    dismantle(it) {
      if (!it || it.lock) return { ok: false, why: it ? 'Предмет заблокирован' : 'Нет предмета' }; if (this.s.equip[it.slot] === it) return { ok: false, why: 'Предмет надет' };
      const d = Math.round(2 + it.rar * 4 + (it.enh || 0) * 2), e = it.rar >= 2 ? it.rar - 1 : 0;
      this._destroy(it); this.st.debris += d; this.st.essence += e; if (it.sock) for (const r of it.sock) if (r) this.addRune(r.k, r.t, 1);
      this.emit('dismantle', { debris: d, essence: e }); return { ok: true, debris: d, essence: e };
    }
    // ---------- руны ----------
    runeKey(k, t) { return k + ':' + t; }
    addRune(k, t, n) { const key = this.runeKey(k, t); this.st.runes[key] = (this.st.runes[key] || 0) + (n || 1); }
    runeCount(k, t) { return this.st.runes[this.runeKey(k, t)] || 0; }
    craftRune(k) { if (!RUNES[k]) return { ok: false, why: 'Нет такой руны' }; if (this.st.essence < 3) return { ok: false, why: 'Нужно 3 эссенции' }; this.st.essence -= 3; this.addRune(k, 1, 1); this.emit('craft', { what: 'rune' }); return { ok: true }; }
    // 3 руны одного вида и уровня -> 1 руна уровнем выше
    combineRune(k, t) { if (!RUNES[k] || t < 1 || t >= 3) return { ok: false, why: 'Нельзя' }; if (this.runeCount(k, t) < 3) return { ok: false, why: 'Нужно 3 руны' }; this.st.runes[this.runeKey(k, t)] -= 3; this.addRune(k, t + 1, 1); this.emit('craft', { what: 'rune+' }); return { ok: true }; }
    socket(it, k, t) {
      if (!it) return { ok: false, why: 'Нет предмета' }; it.sock = Array.isArray(it.sock) ? it.sock : []; const max = socketsFor(it);
      if (it.sock.filter(Boolean).length >= max) return { ok: false, why: max ? 'Нет свободных гнёзд' : 'В предмете нет гнёзд' };
      if (this.runeCount(k, t) < 1) return { ok: false, why: 'Нет руны' }; this.st.runes[this.runeKey(k, t)]--; it.sock.push({ k, t }); return { ok: true };
    }
    unsocket(it, idx) {
      if (!it || !it.sock || !it.sock[idx]) return { ok: false, why: 'Пусто' }; const cost = 300 * it.rar + 200; if (this.s.gold < cost) return { ok: false, why: 'Не хватает золота' };
      this.s.gold -= cost; const r = it.sock.splice(idx, 1)[0]; if (this.rng() < 0.7) { this.addRune(r.k, r.t, 1); return { ok: true, cost, kept: true }; } return { ok: true, cost, kept: false };
    }
    // ---------- алхимия ----------
    brew(id) {
      const p = POTIONS[id]; if (!p) return { ok: false, why: 'Нет рецепта' }; if (this.st.herb < p.herb) return { ok: false, why: 'Не хватает трав' }; if (this.s.gold < p.gold) return { ok: false, why: 'Не хватает золота' };
      const ex = this.st.pot.find((x) => x.id === id);
      if (!ex && this.st.pot.length >= MAX_POTIONS) return { ok: false, why: 'Одновременно не больше ' + MAX_POTIONS + ' эффектов' };
      this.st.herb -= p.herb; this.s.gold -= p.gold; if (ex) ex.left = p.dur; else this.st.pot.push({ id, left: p.dur }); this.emit('craft', { what: 'potion', id }); return { ok: true };
    }
    update(dt) { // тикают зелья и (по минуте) всё остальное
      const P = this.st.pot; for (let i = P.length - 1; i >= 0; i--) { P[i].left -= dt; if (P[i].left <= 0) { this.emit('potion.end', { id: P[i].id }); P.splice(i, 1); } }
    }
    // ---------- прочность и ремонт ----------
    durMax(it) { return 60 + it.rar * 20; }
    initDur(it) { if (!Number.isFinite(it.dur)) it.dur = this.durMax(it); return it; }
    // удар по броне/оружию: вызывать за бой с боссом или смерть
    wearDown(amount) { for (const k in this.s.equip) { const it = this.s.equip[k]; if (!it) continue; this.initDur(it); it.dur = Math.max(0, it.dur - amount); } }
    repairCost(it) { this.initDur(it); const lost = this.durMax(it) - it.dur; return Math.round(lost * (3 + it.rar * 2) * (1 + Math.floor(this.s.n / 20) * 0.1)); }
    repair(it) { if (!it) return { ok: false }; const c = this.repairCost(it); if (c <= 0) return { ok: false, why: 'Не требует ремонта' }; if (this.s.gold < c) return { ok: false, why: 'Не хватает золота' }; this.s.gold -= c; it.dur = this.durMax(it); return { ok: true, cost: c }; }
    repairAll() { let t = 0; for (const k in this.s.equip) { const it = this.s.equip[k]; if (it) { const c = this.repairCost(it); if (c > 0 && this.s.gold >= c) { this.s.gold -= c; it.dur = this.durMax(it); t += c; } } } return t; }
    // ---------- склад, замок, продажа ----------
    toggleLock(it) { if (!it) return false; it.lock = it.lock ? 0 : 1; return !!it.lock; }
    bagCap() { return BAG_BASE + (this.st.bagUp || 0) * 4; }
    bagUpCost() { return Math.round(2000 * Math.pow(2.2, this.st.bagUp || 0)); }
    upgradeBag() { if ((this.st.bagUp || 0) >= 5) return { ok: false, why: 'Максимум' }; const c = this.bagUpCost(); if (this.s.gold < c) return { ok: false, why: 'Не хватает золота' }; this.s.gold -= c; this.st.bagUp = (this.st.bagUp || 0) + 1; return { ok: true, cost: c }; }
    stash(it) { const s = this.s, i = s.bag.indexOf(it); if (i < 0) return false; if (this.st.stash.length >= STASH_MAX) return false; s.bag.splice(i, 1); this.st.stash.push(it); return true; }
    unstash(it) { const s = this.s, i = this.st.stash.indexOf(it); if (i < 0) return false; if (s.bag.length >= this.bagCap()) return false; this.st.stash.splice(i, 1); s.bag.push(it); return true; }
    // Цена продажи: базовая * (1 + заточка) * износ; налог города 10%; торговец дня меняет цену ±15%
    merchant(dayNum) { const r = FF.Rng ? FF.Rng('merchant' + dayNum) : Math.random; return { name: ['Бьорн', 'Ильза', 'Торвальд', 'Сигрид'][r.int ? r.int(0, 3) : 0], mult: r.range ? 0.85 + r.range(0, 0.3) : 1 }; }
    sellPrice(it, dayNum) { const base = (this.ctx.price ? this.ctx.price(it) : it.val * 10); const m = this.merchant(dayNum || 0).mult; return Math.max(1, Math.round(base * (1 + (it.enh || 0) * 0.25) * this.wear(it) * m * 0.9)); }
    sell(it, dayNum) {
      if (!it) return { ok: false }; if (it.lock) return { ok: false, why: 'Предмет заблокирован' }; if (this.s.equip[it.slot] === it) return { ok: false, why: 'Предмет надет' };
      const p = this.sellPrice(it, dayNum); this._destroy(it); this.s.gold += p; return { ok: true, gold: p };
    }
    // Фильтр сумки: {slot, rar(min), sort:'val'|'rar'|'enh'}; заблокированные всегда видны
    filter(f) { f = f || {}; let a = this.s.bag.filter((it) => (!f.slot || it.slot === f.slot) && (f.rar == null || it.rar >= f.rar)); const key = f.sort || 'val'; a = a.slice().sort((x, y) => (key === 'rar' ? y.rar - x.rar : key === 'enh' ? (y.enh || 0) - (x.enh || 0) : y.val - x.val) || x.id - y.id); return a; }
    // Сравнение с надетым: разница эффективного значения (+/-)
    compare(it) { const cur = this.s.equip[it.slot]; return { diff: this.itemVal(it) - (cur ? this.itemVal(cur) : 0), better: this.itemVal(it) > (cur ? this.itemVal(cur) : 0) }; }
    // ---------- чертежи и крафт ----------
    learnBp(id) { if (!BLUEPRINTS[id]) return false; this.st.bp[id] = 1; return true; }
    craft(id) {
      const b = BLUEPRINTS[id]; if (!b) return { ok: false, why: 'Нет чертежа' }; if (!this.st.bp[id]) return { ok: false, why: 'Чертёж не изучен' };
      const c = b.cost; if (this.st.debris < c.debris || this.st.essence < c.essence) return { ok: false, why: 'Не хватает материалов' }; if (this.s.gold < c.gold) return { ok: false, why: 'Не хватает золота' };
      if (!this.ctx.makeItem) return { ok: false, why: 'Нет генератора предметов' };
      const it = this.ctx.makeItem(b.rar, b.slot); if (!it) return { ok: false, why: 'Ошибка крафта' };
      if (this.s.bag.length >= this.bagCap()) return { ok: false, why: 'Сумка полна' };
      this.st.debris -= c.debris; this.st.essence -= c.essence; this.s.gold -= c.gold; this.s.bag.push(it); this.emit('craft', { what: 'item', id }); return { ok: true, item: it };
    }
    // ---------- гарантия легендарки ----------
    // вызывать при убийстве босса; возвращает true, если нужно принудительно выдать rar>=3
    bossPity(gotLegend) { if (gotLegend) { this.st.pity = 0; return false; } this.st.pity++; if (this.st.pity >= LEGEND_PITY) { this.st.pity = 0; return true; } return false; }
    // ---------- таверна ----------
    // Список кандидатов детерминирован от дня: дневной набор
    tavern(dayNum) {
      const r = FF.Rng('tavern' + dayNum + ':' + this.s.hero.lvl), list = [], names = ['Эрик', 'Лейф', 'Ингрид', 'Хельга', 'Ульф', 'Свен', 'Астрид', 'Рагнар', 'Фрея', 'Гуннар'], cl = Object.keys(CLASSES);
      for (let i = 0; i < 4; i++) {
        const c = r.pick(cl), q = r.weighted([[0, 60], [1, 28], [2, 10], [3, 2]]), L = Math.max(1, Math.round(this.s.hero.lvl * r.range(0.6, 0.95))), b = this.baseStats(L, c), k = 0.7 + q * 0.18 + r.range(-0.1, 0.15);
        list.push({ uid: dayNum * 10 + i, name: r.pick(names), cls: c, q, lvl: L, atk: Math.round(b.atk * k), hp: Math.round(b.hp * k), def: Math.round(b.def * k), price: Math.round((300 + L * 60) * (1 + q * 0.9)) });
      }
      return list;
    }
    hire(cand) {
      const t = this.st.team; if (t.length >= 6) return { ok: false, why: 'Отряд полон (6)' }; if (t.some((h) => h.uid === cand.uid)) return { ok: false, why: 'Уже нанят' };
      if (this.s.gold < cand.price) return { ok: false, why: 'Не хватает золота' }; this.s.gold -= cand.price; t.push(Object.assign({}, cand)); this.emit('hire', { uid: cand.uid }); return { ok: true };
    }
    dismiss(uid) { const i = this.st.team.findIndex((h) => h.uid === uid); if (i < 0) return false; this.st.team.splice(i, 1); return true; }
    teamPower() { return this.st.team.reduce((a, h) => a + h.atk, 0); }
    // ---------- офлайн ----------
    offline(secs) { this.update(secs); }
    // ---------- самопроверка математики для баланса ----------
    static selfTest() {
      const out = { ok: true, errs: [] };
      const fake = (lvl, cls) => ({ gold: 1e9, gems: 0, n: 0, hero: { lvl }, equip: { weapon: null, armor: null, amulet: null }, bag: [], ff: { fg: { cls } } });
      let prev = 0;
      for (let L = 1; L <= 50; L++) { const f = new Forge(fake(L, 'warrior')), st = f.stats(); if (!(st.atk > prev) || !(st.hp > 0)) { out.ok = false; out.errs.push('lvl ' + L); } prev = st.atk; if (st.crit > CAPS.crit || st.block > CAPS.block) { out.ok = false; out.errs.push('cap ' + L); } }
      return out;
    }
  }

  FF.Forge = Forge; FF.ForgeData = { CLASSES, TREES, RUNES, RUNE_IDS, POTIONS, BLUEPRINTS, ENH_RATE, ENH_MAX, MAX_POTIONS, STASH_MAX, LEGEND_PITY, CAPS, enhBonus, enhCost, enhRisk, socketsFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = FF;
})(typeof window !== 'undefined' ? window : globalThis);
