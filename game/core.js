// FROSTFALL: ядро игры (без интерфейса). Работает и в браузере, и в Node для проверки баланса.
(function (root) {
  'use strict';

  // ---------- данные ----------
  const ZONES = [
    { name: 'Снежная опушка', sky: ['#7fb8f0', '#dff0ff'], hill: ['#c9e2f7', '#a9cbe8'], mon: ['slime', 'snowman'], boss: ['yeti', 'Белый великан'] },
    { name: 'Ледяной лес', sky: ['#4f86c6', '#bfdcf5'], hill: ['#8fb7d9', '#6c9bc4'], mon: ['wolf', 'bat'], boss: ['wolf', 'Вожак стаи'] },
    { name: 'Замёрзшее озеро', sky: ['#3a6ea5', '#a7d7f2'], hill: ['#9fd0e6', '#74b4d4'], mon: ['ghost', 'slime'], boss: ['golem', 'Хранитель озера'] },
    { name: 'Горный перевал', sky: ['#5b5f97', '#c3c9ee'], hill: ['#a4a9d4', '#7e84b8'], mon: ['yeti', 'golem'], boss: ['ghost', 'Король вьюги'] },
    { name: 'Ледяной замок', sky: ['#2b3a67', '#8a9bd1'], hill: ['#6a7bb5', '#4b5a92'], mon: ['knight', 'ghost'], boss: ['knight', 'Лорд Мороза'] },
    { name: 'Вулкан во льдах', sky: ['#5a1f2b', '#e0733e'], hill: ['#8b3a3a', '#5e2a2e'], mon: ['flame', 'bat'], boss: ['dragon', 'Древний дракон'] },
  ];
  const MON_NAMES = { slime: 'Ледяной слизень', snowman: 'Злой снеговик', wolf: 'Белый волк', bat: 'Морозная летучка', ghost: 'Призрак вьюги', golem: 'Ледяной голем', yeti: 'Йети', knight: 'Проклятый рыцарь', flame: 'Огненный дух', dragon: 'Ледяной дракон' };
  const UPS = [
    { id: 'str', name: 'Сила удара', desc: 'Урон от каждого клика', c0: 10, g: 1.16, icon: 'sword' },
    { id: 'crit', name: 'Меткость', desc: 'Шанс крита +0,5% за уровень (до 50%)', c0: 120, g: 1.28, max: 100, icon: 'target' },
    { id: 'critd', name: 'Мощь крита', desc: 'Критический урон +10% за уровень', c0: 180, g: 1.24, icon: 'bolt' },
    { id: 'gold', name: 'Жадность', desc: 'Золото +5% за уровень', c0: 250, g: 1.3, icon: 'coin' },
  ];
  const ALLIES = [
    { name: 'Юный лучник', c0: 25, dps: 1.2 }, { name: 'Охотник', c0: 260, dps: 10 }, { name: 'Рыцарь', c0: 2800, dps: 90 },
    { name: 'Маг льда', c0: 3.2e4, dps: 800 }, { name: 'Валькирия', c0: 4.2e5, dps: 7e3 }, { name: 'Страж севера', c0: 6e6, dps: 6e4 },
    { name: 'Архимаг', c0: 9e7, dps: 5.2e5 }, { name: 'Ледяной дракон', c0: 1.5e9, dps: 4.6e6 },
  ];
  const ALLY_G = 1.15;
  const SKILLS = [
    { id: 'storm', name: 'Ледяной шторм', desc: 'Мощный удар по врагу', lvl: 3, cd: 25, dur: 0 },
    { id: 'cry', name: 'Боевой клич', desc: 'Весь урон ×2', lvl: 8, cd: 80, dur: 15 },
    { id: 'rain', name: 'Золотой дождь', desc: 'Золото ×3', lvl: 15, cd: 100, dur: 20 },
  ];
  const GEMUPS = [
    { id: 'auto', name: 'Дух-помощник', desc: 'Автоудар: +1 клик в секунду', max: 10, cost: (l) => 5 + l * 6 },
    { id: 'power', name: 'Эликсир силы', desc: 'Весь урон +10%', max: 50, cost: (l) => 10 + l * 5 },
    { id: 'gold', name: 'Золотая жила', desc: 'Золото +10%', max: 50, cost: (l) => 8 + l * 4 },
    { id: 'off', name: 'Тёплый лагерь', desc: 'Время добычи в офлайне +2 часа', max: 5, cost: (l) => 15 + l * 10 },
  ];
  const RAR = [
    { id: 'c', name: 'Обычный', col: '#aab4c0', w: 60, m: 1 }, { id: 'r', name: 'Редкий', col: '#4aa3ff', w: 28, m: 1.6 },
    { id: 'e', name: 'Эпический', col: '#b66cff', w: 9, m: 2.6 }, { id: 'l', name: 'Легендарный', col: '#ff9c2a', w: 2.5, m: 4.4 },
    { id: 'm', name: 'Мифический', col: '#ff4d6d', w: 0.5, m: 8 },
  ];
  const SLOTS = {
    weapon: { name: 'Оружие', stat: 'Весь урон', nouns: ['Меч', 'Топор', 'Посох', 'Молот', 'Клинок'] },
    armor: { name: 'Броня', stat: 'Урон союзников', nouns: ['Броня', 'Кольчуга', 'Плащ', 'Панцирь'] },
    amulet: { name: 'Амулет', stat: 'Золото', nouns: ['Амулет', 'Кулон', 'Талисман', 'Перстень'] },
  };
  const ADJ = ['Опушки', 'Мороза', 'Озера', 'Вершин', 'Замка', 'Пламени'];
  const PRE = ['Старый', 'Закалённый', 'Заговорённый', 'Королевский', 'Божественный'];
  const HPG = 1.5, GOLD_RATIO = 0.08, KILLS_PER_STAGE = 5, BOSS_TIME = 30;
  const BAG_MAX = 24, OFFLINE_BASE_H = 4;

  const H = { dmg: () => 1, gold: () => 1, dps: () => 0, crit: () => 0, boss: () => 0, cd: () => 1, storm: () => 1, shard: () => 1, gear: () => 1, click: () => 1, ally: () => 1, tick: () => {}, kill: () => {}, newCity: () => null, loadCity: () => null, offline: () => {} };
  const ACH = [
    { id: 'k100', name: 'Охотник', desc: 'Победи 100 монстров', gems: 2, ok: (s) => s.st.kills >= 100 },
    { id: 'k2000', name: 'Истребитель', desc: 'Победи 2 000 монстров', gems: 6, ok: (s) => s.st.kills >= 2000 },
    { id: 'k30000', name: 'Гроза севера', desc: 'Победи 30 000 монстров', gems: 20, ok: (s) => s.st.kills >= 30000 },
    { id: 'c500', name: 'Быстрые пальцы', desc: 'Сделай 500 кликов', gems: 2, ok: (s) => s.st.clicks >= 500 },
    { id: 'c10000', name: 'Мозоли на пальцах', desc: 'Сделай 10 000 кликов', gems: 10, ok: (s) => s.st.clicks >= 10000 },
    { id: 's10', name: 'Первый босс', desc: 'Дойди до 11 этапа', gems: 3, ok: (s) => s.maxN >= 10 },
    { id: 's30', name: 'Горный перевал', desc: 'Дойди до 31 этапа', gems: 8, ok: (s) => s.maxN >= 30 },
    { id: 's60', name: 'Покоритель льдов', desc: 'Дойди до 61 этапа', gems: 25, ok: (s) => s.maxN >= 60 },
    { id: 'leg', name: 'Легенда', desc: 'Получи легендарный предмет', gems: 10, ok: (s) => s.st.legend > 0 },
    { id: 'pre1', name: 'Новое начало', desc: 'Соверши первое перерождение', gems: 15, ok: (s) => s.st.prestiges >= 1 },
    { id: 'ally5', name: 'Отряд собран', desc: 'Найми 5 разных союзников', gems: 5, ok: (s) => s.allies.filter((x) => x > 0).length >= 5 },
  ];

  // ---------- числа ----------
  function fmt(n) {
    if (!Number.isFinite(n)) return '∞';
    if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1).replace('.', ',') : String(Math.floor(n));
    const U = ['', 'К', 'М', 'Б', 'Т', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
    const e = Math.min(U.length - 1, Math.floor(Math.log10(n) / 3));
    const v = n / Math.pow(1000, e);
    return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)).replace('.', ',') + U[e];
  }
  const fmtTime = (s) => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? h + ' ч ' + m + ' мин' : m ? m + ' мин ' + (s % 60) + ' с' : (s % 60) + ' с'; };

  // ---------- состояние ----------
  function newState() {
    return {
      v: 1, gold: 0, gems: 0, shards: 0, hero: { lvl: 1, xp: 0 },
      up: { str: 0, crit: 0, critd: 0, gold: 0 }, allies: ALLIES.map(() => 0),
      n: 0, kills: 0, maxN: 0, bag: [], equip: { weapon: null, armor: null, amulet: null },
      gemUp: { auto: 0, power: 0, gold: 0, off: 0 }, ach: {}, uid: 1,
      set: { bulk: 1, autoBoss: true, autoEquip: true, light: false, sound: true },
      st: { kills: 0, clicks: 0, bosses: 0, legend: 0, prestiges: 0, best: 0, play: 0 },
      cd: { storm: 0, cry: 0, rain: 0 }, buff: { cry: 0, rain: 0 }, seen: Date.now(), city: H.newCity(),
      rt: null,
    };
  }
  function ensureRt(s) {
    if (!s.rt) { s.rt = { mon: null, bossT: 0, ev: [], acc: 0, auto: 0, sec: 0, farm: false, saveT: 0, autoAcc: 0 }; spawn(s); }
    return s.rt;
  }

  // ---------- этапы ----------
  function stageInfo(n) {
    const zi = Math.floor(n / 10) % ZONES.length, loop = Math.floor(n / (10 * ZONES.length)), stage = n % 10 + 1;
    const boss = stage === 10, z = ZONES[zi];
    const hpN = 10 * Math.pow(HPG, n);
    const type = boss ? z.boss[0] : z.mon[(n * 7 + stage) % z.mon.length];
    return {
      n, zone: zi, loop, stage, boss, zoneName: z.name + (loop ? ' ' + toRoman(loop + 1) : ''), z,
      hp: boss ? hpN * 9 : hpN, hpN, type, name: boss ? z.boss[1] : MON_NAMES[type],
      gold: hpN * GOLD_RATIO * (boss ? 7 : 1), xp: 3 * Math.pow(1.11, n) * (boss ? 5 : 1), need: boss ? 1 : KILLS_PER_STAGE,
    };
  }
  const toRoman = (n) => ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n);

  function spawn(s) {
    const rt = s.rt, i = stageInfo(s.n);
    rt.mon = { hp: i.hp, max: i.hp, type: i.type, name: i.name, boss: i.boss, dead: false, t: 0, hitT: 0, seed: Math.random() };
    rt.bossT = i.boss ? BOSS_TIME + H.boss(s) : 0;
  }

  // ---------- расчёты ----------
  const eqv = (s, slot) => (s.equip[slot] ? s.equip[slot].val : 0);
  const sk = (s) => 1 + 0.03 * (s.hero.lvl - 1);
  const eqe = (s, slot) => eqv(s, slot) * H.gear(s);
  function dmgMult(s) { return sk(s) * (1 + 0.05 * s.shards) * (1 + 0.1 * s.gemUp.power) * (1 + eqe(s, 'weapon') / 100) * (s.buff.cry > 0 ? 2 : 1) * H.dmg(s); }
  function goldMult(s) { return (1 + 0.05 * s.up.gold) * (1 + 0.1 * s.gemUp.gold) * (1 + eqe(s, 'amulet') / 100) * (1 + 0.02 * s.shards) * (s.buff.rain > 0 ? 3 : 1) * H.gold(s); }
  const critChance = (s) => Math.min(0.75, 0.05 + 0.005 * Math.min(100, s.up.crit) + H.crit(s));
  const critMult = (s) => 2 + 0.1 * s.up.critd;
  function clickBase(s) { const L = s.up.str; return (1 + L) * Math.pow(2, Math.floor(L / 25)); }
  const clickDmg = (s) => clickBase(s) * dmgMult(s) * H.click(s);
  function allyDps(s, i) { const L = s.allies[i]; return L ? ALLIES[i].dps * L * Math.pow(2, Math.floor(L / 25)) : 0; }
  function dps(s) { let d = 0; for (let i = 0; i < ALLIES.length; i++) d += allyDps(s, i); return (d * H.ally(s) + H.dps(s)) * dmgMult(s) * (1 + eqe(s, 'armor') / 100); }
  const xpNeed = (l) => 12 * Math.pow(1.28, l - 1);

  // ---------- покупки ----------
  const upCost = (id, L) => { const u = UPS.find((x) => x.id === id); return u.c0 * Math.pow(u.g, L); };
  const allyCost = (i, L) => ALLIES[i].c0 * Math.pow(ALLY_G, L);
  function bulkCalc(gold, c0, g, L, mode, max) {
    // сколько уровней можно купить и за сколько
    const cap = max == null ? Infinity : max - L;
    let want = mode === 'max' ? Infinity : mode;
    want = Math.min(want, cap);
    if (want <= 0) return { k: 0, cost: 0 };
    let k = 0, cost = 0, c = c0 * Math.pow(g, L);
    while (k < want && cost + c <= gold && k < 1000) { cost += c; c *= g; k++; }
    if (k === 0) return { k: 0, cost: c0 * Math.pow(g, L), need: true };
    return { k, cost };
  }
  function buyUp(s, id) {
    const u = UPS.find((x) => x.id === id), L = s.up[id], r = bulkCalc(s.gold, u.c0, u.g, L, s.set.bulk, u.max);
    if (!r.k) return false; s.gold -= r.cost; s.up[id] += r.k; return true;
  }
  function buyAlly(s, i) {
    const r = bulkCalc(s.gold, ALLIES[i].c0, ALLY_G, s.allies[i], s.set.bulk);
    if (!r.k) return false; s.gold -= r.cost; s.allies[i] += r.k; return true;
  }
  function priceNow(s, kind, key) { // что показать на кнопке: цена и сколько уровней
    if (kind === 'up') { const u = UPS.find((x) => x.id === key); const r = bulkCalc(s.gold, u.c0, u.g, s.up[key], s.set.bulk, u.max); return r.k ? { k: r.k, cost: r.cost, can: true } : { k: s.set.bulk === 'max' ? 1 : s.set.bulk, cost: upCost(key, s.up[key]), can: false, maxed: u.max != null && s.up[key] >= u.max }; }
    const r = bulkCalc(s.gold, ALLIES[key].c0, ALLY_G, s.allies[key], s.set.bulk);
    return r.k ? { k: r.k, cost: r.cost, can: true } : { k: s.set.bulk === 'max' ? 1 : s.set.bulk, cost: allyCost(key, s.allies[key]), can: false };
  }
  function buyGem(s, id) {
    const g = GEMUPS.find((x) => x.id === id), L = s.gemUp[id];
    if (L >= g.max) return false; const c = g.cost(L); if (s.gems < c) return false;
    s.gems -= c; s.gemUp[id]++; return true;
  }

  // ---------- бой ----------
  function ev(s, o) { const e = s.rt.ev; if (e.length < 60) e.push(o); }
  function dealDamage(s, dmg, o) {
    const rt = ensureRt(s), m = rt.mon; if (!m || m.dead) return;
    m.hp -= dmg; m.hitT = 0.18;
    ev(s, Object.assign({ t: 'dmg', v: dmg }, o));
    if (m.hp <= 0) kill(s);
  }
  function hit(s, auto) {
    const rt = ensureRt(s); if (!rt.mon || rt.mon.dead) return 0;
    const crit = Math.random() < critChance(s);
    const d = clickDmg(s) * (crit ? critMult(s) : 1);
    if (!auto) s.st.clicks++;
    dealDamage(s, d, { crit, auto: !!auto });
    return d;
  }
  function kill(s) {
    const rt = s.rt, m = rt.mon, i = stageInfo(s.n);
    m.dead = true; m.t = 0; m.hp = 0;
    const g = i.gold * goldMult(s); s.gold += g;
    s.st.kills++; if (i.boss) s.st.bosses++;
    ev(s, { t: 'gold', v: g });
    addXp(s, i.xp);
    if (i.boss) { const gm = 1 + i.zone + Math.floor(s.n / 30); s.gems += gm; ev(s, { t: 'gems', v: gm }); }
    // выпадение предмета
    if (i.boss || Math.random() < 0.07) drop(s, i.boss);
    H.kill(s, i);
        // продвижение
    s.kills++;
    if (s.kills >= i.need) {
      s.kills = 0;
      if (!i.boss && i.stage === 9 && !s.set.autoBoss) { /* ждём вызова босса: фармим 9 этап */ }
      else { s.n++; rt.farm = false; }
      s.maxN = Math.max(s.maxN, s.n);
      if (i.boss) ev(s, { t: 'zone', v: s.n });
    }
    rt.respawn = 0.45;
  }
  function addXp(s, x) {
    s.hero.xp += x;
    while (s.hero.xp >= xpNeed(s.hero.lvl)) { s.hero.xp -= xpNeed(s.hero.lvl); s.hero.lvl++; ev(s, { t: 'level', v: s.hero.lvl }); }
  }
  function failBoss(s) {
    const rt = s.rt; s.n = Math.max(0, s.n - 1); s.kills = 0; rt.farm = true; ev(s, { t: 'fail' }); spawn(s);
  }
  function callBoss(s) {
    const rt = ensureRt(s), i = stageInfo(s.n);
    if (i.boss) return false;
    const bossN = s.n - (s.n % 10) + 9; if (bossN < s.n) return false;
    s.n = bossN; s.kills = 0; rt.farm = false; spawn(s); return true;
  }
  function tick(s, dt) {
    const rt = ensureRt(s);
    s.st.play += dt;
    // таймеры
    for (const k of ['storm', 'cry', 'rain']) { if (s.cd[k] > 0) s.cd[k] = Math.max(0, s.cd[k] - dt); }
    for (const k of ['cry', 'rain']) { if (s.buff[k] > 0) s.buff[k] = Math.max(0, s.buff[k] - dt); }
    const m = rt.mon;
    if (m && m.dead) {
      m.t += dt; rt.respawn -= dt;
      if (rt.respawn <= 0) spawn(s);
    } else if (m) {
      if (m.hitT > 0) m.hitT -= dt;
      m.t += dt;
      // союзники
      const d = dps(s);
      if (d > 0) { rt.acc += d * dt; if (rt.acc >= 1e-9) { const dd = rt.acc; rt.acc = 0; dealDamage(s, dd, { ally: true, quiet: true }); } }
      // автоудар
      if (s.gemUp.auto > 0 && !(rt.mon && rt.mon.dead)) { rt.autoAcc += s.gemUp.auto * dt; while (rt.autoAcc >= 1) { rt.autoAcc -= 1; hit(s, true); } }
      // таймер босса
      if (m.boss && !m.dead) { rt.bossT -= dt; if (rt.bossT <= 0) failBoss(s); }
    }
    H.tick(s, dt);
    // достижения раз в секунду
    rt.sec += dt;
    if (rt.sec >= 1) { rt.sec = 0; checkAch(s); }
  }
  function useSkill(s, id) {
    const sd = SKILLS.find((x) => x.id === id), rt = ensureRt(s);
    if (!sd || s.hero.lvl < sd.lvl || s.cd[id] > 0) return false;
    s.cd[id] = sd.cd * H.cd(s);
    if (id === 'storm') { const d = (clickDmg(s) * 20 + dps(s) * 4) * H.storm(s); dealDamage(s, d, { skill: true, crit: true }); }
    else s.buff[id] = sd.dur;
    ev(s, { t: 'skill', v: id });
    return true;
  }

  // ---------- предметы ----------
  function pickRarity(boss, s) {
    const bonus = boss ? 3 : 1; let tot = 0; const ws = RAR.map((r, i) => { const w = i > 0 ? r.w * bonus : r.w; tot += w; return w; });
    let x = Math.random() * tot; for (let i = 0; i < RAR.length; i++) { x -= ws[i]; if (x <= 0) return i; } return 0;
  }
  function makeItem(s, n, boss) {
    const slotKeys = Object.keys(SLOTS), slot = slotKeys[Math.floor(Math.random() * 3)];
    const ri = pickRarity(boss), r = RAR[ri], zi = Math.floor(n / 10) % ZONES.length;
    const noun = SLOTS[slot].nouns[Math.floor(Math.random() * SLOTS[slot].nouns.length)];
    const val = Math.round(6 * r.m * (1 + n * 0.16) * (0.9 + Math.random() * 0.3));
    return { id: s.uid++, slot, rar: ri, name: (ri > 0 ? PRE[ri - 1] + ' ' : '') + noun + ' ' + ADJ[zi], val, lvl: n + 1 };
  }
  function drop(s, boss) {
    const it = makeItem(s, s.n, boss);
    if (it.rar >= 3) s.st.legend++;
    ev(s, { t: 'drop', v: it });
    if (s.set.autoEquip && it.val > eqv(s, it.slot)) { const old = s.equip[it.slot]; s.equip[it.slot] = it; if (old) sellValue(s, old, true); ev(s, { t: 'equip', v: it }); return; }
    if (s.bag.length >= BAG_MAX) { // продаём самый слабый
      let w = 0; for (let i = 1; i < s.bag.length; i++) if (s.bag[i].val < s.bag[w].val) w = i;
      const [x] = s.bag.splice(w, 1); sellValue(s, x, true);
    }
    s.bag.push(it);
  }
  const itemPrice = (it) => Math.round(it.val * 10 * Math.pow(1.2, it.lvl / 3));
  function sellValue(s, it, silent) { s.gold += itemPrice(it); }
  function equipItem(s, id) {
    const i = s.bag.findIndex((x) => x.id === id); if (i < 0) return false;
    const it = s.bag.splice(i, 1)[0], old = s.equip[it.slot]; s.equip[it.slot] = it; if (old) s.bag.push(old); return true;
  }
  function sellItem(s, id) { const i = s.bag.findIndex((x) => x.id === id); if (i < 0) return false; const it = s.bag.splice(i, 1)[0]; sellValue(s, it); return true; }
  function sellWeak(s) { let n = 0; s.bag = s.bag.filter((it) => { if (it.val <= eqv(s, it.slot)) { sellValue(s, it); n++; return false; } return true; }); return n; }

  // ---------- перерождение ----------
  const shardGain = (s) => (s.maxN >= 29 ? Math.floor(Math.pow(s.maxN / 10, 1.8) * H.shard(s)) : 0);
  const canPrestige = (s) => shardGain(s) > 0;
  function prestige(s) {
    if (!canPrestige(s)) return 0;
    const g = shardGain(s); s.shards += g; s.st.prestiges++;
    s.gold = 0; s.up = { str: 0, crit: 0, critd: 0, gold: 0 }; s.allies = ALLIES.map(() => 0);
    s.n = 0; s.kills = 0; s.maxN = 0; s.cd = { storm: 0, cry: 0, rain: 0 }; s.buff = { cry: 0, rain: 0 };
    if (s.rt) { s.rt.farm = false; spawn(s); }
    return g;
  }

  // ---------- достижения, офлайн ----------
  function checkAch(s) { for (const a of ACH) { if (!s.ach[a.id] && a.ok(s)) { s.ach[a.id] = 1; s.gems += a.gems; ev(s, { t: 'ach', v: a }); } } }
  function offlineGain(s, secs) {
    const cap = (OFFLINE_BASE_H + 2 * s.gemUp.off) * 3600; secs = Math.min(secs, cap);
    const d = dps(s) + (s.gemUp.auto ? clickDmg(s) * s.gemUp.auto : 0); if (d <= 0 || secs < 30) return null;
    const i = stageInfo(s.n), ttk = Math.max(0.8, (i.hpN) / d), kills = secs / ttk;
    const gold = kills * i.gold * goldMult(s) * 0.6, xp = kills * i.xp * 0.6;
    const o = { secs, kills: Math.floor(kills), gold, xp }; H.offline(s, o, secs); return o;
  }
  function applyOffline(s, o) { s.gold += o.gold; addXp(s, o.xp); s.st.kills += o.kills; if (o.res && s.city) for (const k in o.res) s.city.res[k] = (s.city.res[k] || 0) + o.res[k]; }

  // ---------- сохранение ----------
  function save(s) { const c = Object.assign({}, s); delete c.rt; c.seen = Date.now(); return JSON.stringify(c); }
  function load(str) {
    const d = JSON.parse(str), b = newState(); if (!d || typeof d !== 'object') throw new Error('bad');
    const num = (v, def) => (Number.isFinite(v) ? v : def);
    const s = b;
    s.gold = num(d.gold, 0); s.gems = num(d.gems, 0); s.shards = num(d.shards, 0);
    s.hero = { lvl: Math.max(1, num(d.hero && d.hero.lvl, 1)), xp: num(d.hero && d.hero.xp, 0) };
    for (const k of Object.keys(s.up)) s.up[k] = Math.max(0, num(d.up && d.up[k], 0));
    s.allies = ALLIES.map((_, i) => Math.max(0, num(d.allies && d.allies[i], 0)));
    s.n = Math.max(0, num(d.n, 0)); s.maxN = Math.max(s.n, num(d.maxN, 0)); s.kills = Math.max(0, num(d.kills, 0));
    s.bag = Array.isArray(d.bag) ? d.bag.filter(okItem).slice(0, BAG_MAX) : [];
    for (const k of Object.keys(s.equip)) s.equip[k] = d.equip && okItem(d.equip[k]) ? d.equip[k] : null;
    for (const k of Object.keys(s.gemUp)) s.gemUp[k] = Math.max(0, Math.min(GEMUPS.find((x) => x.id === k).max, num(d.gemUp && d.gemUp[k], 0)));
    s.ach = d.ach && typeof d.ach === 'object' ? d.ach : {}; s.uid = Math.max(1, num(d.uid, 1));
    Object.assign(s.set, d.set || {}); Object.assign(s.st, d.st || {});
    for (const k of ['storm', 'cry', 'rain']) { s.cd[k] = Math.max(0, num(d.cd && d.cd[k], 0)); }
    s.seen = num(d.seen, Date.now()); s.city = H.loadCity(d.city);
    return s;
  }
  function okItem(it) { return it && typeof it === 'object' && SLOTS[it.slot] && Number.isFinite(it.val) && Number.isFinite(it.rar) && RAR[it.rar] && typeof it.name === 'string'; }

  root.Core = { H, ev, ZONES, UPS, ALLIES, SKILLS, GEMUPS, RAR, SLOTS, ACH, BAG_MAX, BOSS_TIME, KILLS_PER_STAGE, fmt, fmtTime, newState, ensureRt, spawn, stageInfo, clickDmg, dps, allyDps, dmgMult, goldMult, critChance, critMult, clickBase, xpNeed,
    upCost, allyCost, priceNow, buyUp, buyAlly, buyGem, hit, tick, useSkill, callBoss, equipItem, sellItem, sellWeak, itemPrice, shardGain, canPrestige, prestige, offlineGain, applyOffline, save, load, checkAll: checkAch, eqv };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Core;
})(typeof window !== 'undefined' ? window : globalThis);
