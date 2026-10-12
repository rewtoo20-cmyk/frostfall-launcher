// FROSTFALL: Столица (постройки, герои, экспедиции). Работает поверх Core через хуки, без интерфейса.
(function (root) {
  'use strict';
  const Core = root.Core, H = Core.H, F = Core.fmt;
  const RES = { wood: { name: 'Дерево', col: '#d8a860' }, stone: { name: 'Камень', col: '#b8c4d4' }, iron: { name: 'Железо', col: '#8fb0f0' } };
  const ZONE_RES = ['wood', 'wood', 'stone', 'stone', 'iron', 'iron', 'stone', 'iron', 'iron'];
  // g0/gg: золото (база и рост на уровень), m: материалы [база, рост]; req: нужный уровень Ратуши
  const BLD = [
    { id: 'hall', name: 'Ратуша', desc: 'Открывает постройки. +4% золота, +2% урона за ур.', g0: 400, gg: 2.1, m: { wood: [25, 1.6], stone: [15, 1.6] }, req: 0, max: 20 },
    { id: 'sawmill', name: 'Лесопилка', desc: 'Добывает дерево', g0: 120, gg: 1.8, m: { wood: [12, 1.5] }, req: 1 },
    { id: 'quarry', name: 'Каменоломня', desc: 'Добывает камень', g0: 160, gg: 1.8, m: { wood: [15, 1.5], stone: [6, 1.5] }, req: 1 },
    { id: 'tavern', name: 'Таверна', desc: 'Места в отряде героев: ур. 1, 3, 6, 10', g0: 300, gg: 1.9, m: { wood: [30, 1.55], stone: [18, 1.55] }, req: 1 },
    { id: 'mine', name: 'Железный рудник', desc: 'Добывает железо', g0: 600, gg: 1.85, m: { wood: [40, 1.5], stone: [30, 1.5] }, req: 3 },
    { id: 'forge', name: 'Кузница', desc: 'Снаряжение сильнее: +5% за ур.', g0: 700, gg: 1.9, m: { stone: [40, 1.55], iron: [14, 1.55] }, req: 2 },
    { id: 'treasury', name: 'Казна', desc: 'Золото само капает: +1% этапа в секунду за ур.', g0: 900, gg: 1.95, m: { stone: [50, 1.55], iron: [18, 1.55] }, req: 3 },
    { id: 'walls', name: 'Стены', desc: 'Больше времени на босса: +1,5 с за ур.', g0: 500, gg: 1.85, m: { stone: [60, 1.55], wood: [30, 1.5] }, req: 2 },
    { id: 'mage', name: 'Башня магов', desc: 'Умения быстрее (-2% откат) и сильнее шторм', g0: 1500, gg: 1.95, m: { stone: [70, 1.55], iron: [30, 1.55] }, req: 4 },
    { id: 'temple', name: 'Храм льда', desc: '+3% урона и +6% осколков за ур.', g0: 2500, gg: 2.0, m: { stone: [90, 1.6], iron: [50, 1.6] }, req: 5 },
  ];
  const BID = {}; BLD.forEach((b) => { BID[b.id] = b; });
  const bmax = (s, b) => (b.id === 'hall' ? 20 : Math.min(20, 2 * lvl(s, 'hall') + 2));
  const lvl = (s, id) => (s.city.b[id] | 0);
  function bldCost(s, id) { const b = BID[id], L = lvl(s, id), c = { gold: Math.round(b.g0 * Math.pow(b.gg, L)) }; for (const k in b.m) c[k] = Math.round(b.m[k][0] * Math.pow(b.m[k][1], L)); return c; }
  function canPay(s, c) { if (s.gold < c.gold) return false; for (const k in RES) if (c[k] && s.city.res[k] < c[k]) return false; return true; }
  function pay(s, c) { s.gold -= c.gold; for (const k in RES) if (c[k]) s.city.res[k] -= c[k]; }
  function bldInfo(s, id) {
    const b = BID[id], L = lvl(s, id), mx = bmax(s, b), cost = bldCost(s, id), reqOk = lvl(s, 'hall') >= b.req;
    return { b, L, max: mx, cost, reqOk, maxed: L >= mx, capped: L >= mx && L < 20 && id !== 'hall', can: reqOk && L < mx && canPay(s, cost) };
  }
  function bldBuy(s, id) { const i = bldInfo(s, id); if (!i.can) return false; pay(s, i.cost); s.city.b[id] = i.L + 1; bump(s); return true; }

  // ---------- герои ----------
  const HEROES = [
    { id: 'eirik', name: 'Эйрик Северный', cls: 'Воин', rar: 0, atk: 4, p: [['dmg', 6]] },
    { id: 'lira', name: 'Лира Меткая', cls: 'Лучница', rar: 0, atk: 5, p: [['crit', 2.5]] },
    { id: 'brunn', name: 'Брунн Щитоносец', cls: 'Страж', rar: 0, atk: 3, p: [['boss', 2]] },
    { id: 'helm', name: 'Хельм Ледяной', cls: 'Рыцарь', rar: 0, atk: 4, p: [['ally', 8]] },
    { id: 'solv', name: 'Сольвейг', cls: 'Маг льда', rar: 1, atk: 9, p: [['cd', 3]] },
    { id: 'torg', name: 'Торгрим', cls: 'Кузнец', rar: 1, atk: 7, p: [['gear', 6]] },
    { id: 'freya', name: 'Фрейя', cls: 'Валькирия', rar: 1, atk: 8, p: [['gold', 7]] },
    { id: 'ragnar', name: 'Рагнар', cls: 'Берсерк', rar: 2, atk: 16, p: [['click', 15]] },
    { id: 'ingrid', name: 'Ингрид', cls: 'Ведьма вьюги', rar: 2, atk: 18, p: [['dmg', 10]] },
    { id: 'skadi', name: 'Скади', cls: 'Королева льда', rar: 2, atk: 22, p: [['dmg', 6], ['gold', 8]] },
  ];
  const HID = {}; HEROES.forEach((h) => { HID[h.id] = h; });
  const HRAR = [{ name: 'Редкий', col: '#4aa3ff', unlock: 10, w: 70 }, { name: 'Эпический', col: '#b66cff', unlock: 20, w: 25 }, { name: 'Легендарный', col: '#ff9c2a', unlock: 40, w: 5 }];
  const STAR_COST = [0, 0, 15, 30, 60, 120];            // осколки для ★2..★5 (индекс = целевая звезда)
  const PASS = { dmg: ['Урон', '%'], gold: ['Золото', '%'], crit: ['Шанс крита', '%'], boss: ['Время босса', ' с'], cd: ['Откат умений', '%'], gear: ['Снаряжение', '%'], click: ['Урон клика', '%'], ally: ['Урон союзников', '%'] };
  const HNAME = { dmg: 'Урон', gold: 'Золото', crit: 'Шанс крита', boss: 'Время босса', cd: 'Быстрее умения', gear: 'Сила снаряжения', click: 'Урон клика', ally: 'Урон союзников' };
  const hs = (s, id) => s.city.heroes[id] || null;
  const starMul = (st) => Math.pow(1.45, st - 1);
  const hLvlCap = (st) => 10 + 10 * st;
  const hPower = (s, id) => { const h = hs(s, id), d = HID[id]; return h && h.star ? d.atk * 4 * Math.pow(1.22, h.lvl) * Math.pow(2.2, h.star - 1) : 0; };
  const hCost = (s, id) => { const h = hs(s, id); return Math.round(150 * Math.pow(1.28, h.lvl) * (1 + HID[id].rar * 0.6)); };
  const pVal = (s, id, k) => { const h = hs(s, id), d = HID[id]; const p = d.p.find((x) => x[0] === k); return p ? p[1] * starMul(h.star) * (1 + 0.02 * h.lvl) : 0; };
  const squadSlots = (s) => { const t = lvl(s, 'tavern'); return t >= 10 ? 4 : t >= 6 ? 3 : t >= 3 ? 2 : t >= 1 ? 1 : 0; };
  function heroInfo(s, id) {
    const h = hs(s, id), d = HID[id], fr = s.city.frag[id] | 0, r = HRAR[d.rar];
    if (!h || !h.star) return { d, owned: false, frag: fr, need: r.unlock, can: fr >= r.unlock };
    const next = h.star < 5 ? STAR_COST[h.star + 1] : 0;
    return { d, owned: true, h, frag: fr, star: h.star, lvl: h.lvl, cap: hLvlCap(h.star), cost: hCost(s, id), canLvl: h.lvl < hLvlCap(h.star) && s.gold >= hCost(s, id), nextStar: next, canStar: h.star < 5 && fr >= next, inSquad: s.city.squad.includes(id), busy: s.city.exp.some((e) => e.heroes.includes(id)), power: hPower(s, id) };
  }
  function heroUnlock(s, id) { const i = heroInfo(s, id); if (i.owned || !i.can) return false; s.city.frag[id] -= i.need; s.city.heroes[id] = { star: 1, lvl: 1 }; bump(s); return true; }
  function heroLevel(s, id, n) { let k = 0; n = n || 1; for (let j = 0; j < n; j++) { const i = heroInfo(s, id); if (!i.owned || !i.canLvl) break; s.gold -= i.cost; i.h.lvl++; k++; } if (k) bump(s); return k; }
  function heroStar(s, id) { const i = heroInfo(s, id); if (!i.owned || !i.canStar) return false; s.city.frag[id] -= i.nextStar; i.h.star++; bump(s); return true; }
  function squadToggle(s, id) { const c = s.city, i = heroInfo(s, id); if (!i.owned) return false; const k = c.squad.indexOf(id); if (k >= 0) { c.squad.splice(k, 1); bump(s); return true; } if (i.busy || c.squad.length >= squadSlots(s)) return false; c.squad.push(id); bump(s); return true; }
  function addFrag(s, id, n) { s.city.frag[id] = (s.city.frag[id] | 0) + n; }
  function randHero(w) { let tot = 0; const ws = HEROES.map((h) => { const x = HRAR[h.rar].w * (w && w[h.rar] || 1); tot += x; return x; }); let x = Math.random() * tot; for (let i = 0; i < HEROES.length; i++) { x -= ws[i]; if (x <= 0) return HEROES[i]; } return HEROES[0]; }
  // призыв: gold (за золото), gems (королевский)
  const SUMMON = { gold: { name: 'Обычный призыв', qty: [2, 3], w: [1, 0.5, 0] }, gems: { name: 'Королевский призыв', qty: [4, 6], w: [0.6, 1.4, 3] } };
  const summonCost = (s, k) => (k === 'gold' ? Math.round(3000 * Math.pow(1.35, lvl(s, 'hall'))) : 12);
  function summon(s, k) {
    const c = summonCost(s, k); if (lvl(s, 'tavern') < 1) return null;
    if (k === 'gold') { if (s.gold < c) return null; s.gold -= c; } else { if (s.gems < c) return null; s.gems -= c; }
    const h = randHero(SUMMON[k].w), q = SUMMON[k].qty[0] + Math.floor(Math.random() * (SUMMON[k].qty[1] - SUMMON[k].qty[0] + 1));
    addFrag(s, h.id, q); return { h, q };
  }

  // ---------- экспедиции ----------
  const EXPS = [
    { id: 'forest', name: 'Лесной обоз', min: 5, tier: 1, res: 'wood', rb: 40 },
    { id: 'quarry', name: 'Каменная жила', min: 15, tier: 2, res: 'stone', rb: 35 },
    { id: 'mines', name: 'Железные копи', min: 30, tier: 3, res: 'iron', rb: 28 },
    { id: 'ruins', name: 'Древние руины', min: 60, tier: 4, res: null, rb: 0 },
  ];
  const EID = {}; EXPS.forEach((e) => { EID[e.id] = e; });
  const expSlots = (s) => Math.min(4, 1 + Math.floor(lvl(s, 'hall') / 5));
  const recPower = (s, e) => (20 + 6 * s.maxN) * e.tier;
  const scaleOf = (s) => 1 + s.maxN * 0.12 + lvl(s, 'hall') * 0.5;
  function expRewards(s, e, power) {
    const m = Math.max(0.4, Math.min(2, power / recPower(s, e))), sc = scaleOf(s) * (e.min / 5 > 1 ? Math.pow(e.min / 5, 0.8) : 1);
    const r = { m: +m.toFixed(2), res: {}, gold: 0, frag: 0, gems: 0 };
    if (e.res) r.res[e.res] = Math.round(e.rb * sc * m);
    r.gold = Math.round(Core.stageInfo(s.maxN).gold * 12 * (e.min / 5) * m);
    if (e.id === 'ruins') { r.frag = Math.round(5 * m + s.maxN / 12); r.gems = Math.max(1, Math.round(2 * m)); }
    return r;
  }
  function idleHeroes(s) { return Object.keys(s.city.heroes).filter((id) => { const i = heroInfo(s, id); return i.owned && !i.inSquad && !i.busy; }); }
  function expStart(s, key, ids) {
    const c = s.city, e = EID[key]; if (!e || !ids.length || c.exp.length >= expSlots(s)) return false;
    for (const id of ids) { const i = heroInfo(s, id); if (!i.owned || i.inSquad || i.busy) return false; }
    const power = ids.reduce((a, id) => a + hPower(s, id), 0), now = Date.now();
    c.exp.push({ k: key, heroes: ids.slice(0, 3), t0: now, t1: now + e.min * 60000, power }); bump(s); return true;
  }
  const expLeft = (x) => Math.max(0, (x.t1 - Date.now()) / 1000);
  function expClaim(s, idx) {
    const c = s.city, x = c.exp[idx]; if (!x || expLeft(x) > 0) return null; const e = EID[x.k], r = expRewards(s, e, x.power);
    for (const k in r.res) c.res[k] += r.res[k]; s.gold += r.gold; s.gems += r.gems; let hid = null;
    if (r.frag) { const ids = x.heroes.length ? x.heroes : [HEROES[0].id]; hid = randHero().id; addFrag(s, hid, r.frag); r.hero = hid; }
    c.exp.splice(idx, 1); bump(s); return r;
  }
  function expSkip(s, idx) { const x = s.city.exp[idx]; if (!x || s.gems < 5) return false; s.gems -= 5; x.t1 = Date.now() - 1; return true; }

  // ---------- общие бонусы (кэш по версии) ----------
  const MC = new WeakMap();
  const bump = (s) => { s.city.ver = (s.city.ver | 0) + 1; };
  function mods(s) {
    const c = s.city, hit = MC.get(c); if (hit && hit.v === c.ver) return hit.m;
    const m = { dmg: 1, gold: 1, crit: 0, boss: 0, cd: 1, storm: 1, shard: 1, gear: 1, click: 1, ally: 1, dps: 0, wood: 0, stone: 0, iron: 0, gps: 0 };
    const L = (id) => lvl(s, id);
    m.gold *= 1 + 0.04 * L('hall'); m.dmg *= 1 + 0.02 * L('hall'); m.dmg *= 1 + 0.03 * L('temple'); m.shard *= 1 + 0.06 * L('temple');
    m.gear *= 1 + 0.05 * L('forge'); m.boss += 1.5 * L('walls'); m.cd *= 1 - Math.min(0.4, 0.02 * L('mage')); m.storm *= 1 + 0.05 * L('mage');
    m.wood = 0.15 * L('sawmill'); m.stone = 0.12 * L('quarry'); m.iron = 0.08 * L('mine'); m.gps = 0.01 * L('treasury');
    let hd = 0; const cd = [];
    for (const id of c.squad) { const h = c.heroes[id]; if (!h || !h.star) continue; hd += hPower(s, id); for (const [k] of HID[id].p) { const v = pVal(s, id, k); if (k === 'dmg') m.dmg *= 1 + v / 100; else if (k === 'gold') m.gold *= 1 + v / 100; else if (k === 'crit') m.crit += v / 100; else if (k === 'boss') m.boss += v; else if (k === 'cd') cd.push(v); else if (k === 'gear') m.gear *= 1 + v / 100; else if (k === 'click') m.click *= 1 + v / 100; else if (k === 'ally') m.ally *= 1 + v / 100; } }
    if (Core.World.modFns) for (const f of Core.World.modFns) f(s, m, cd);
    for (const v of cd) m.cd *= 1 - Math.min(0.2, v / 100); m.cd = Math.max(0.35, m.cd); m.dps = hd;
    MC.set(c, { v: c.ver, m }); return m;
  }
  H.dmg = (s) => mods(s).dmg; H.gold = (s) => mods(s).gold; H.crit = (s) => mods(s).crit; H.boss = (s) => mods(s).boss; H.cd = (s) => mods(s).cd; H.storm = (s) => mods(s).storm;
  H.shard = (s) => mods(s).shard; H.gear = (s) => mods(s).gear; H.click = (s) => mods(s).click; H.ally = (s) => mods(s).ally; H.dps = (s) => mods(s).dps;
  H.tick = (s, dt) => {
    const c = s.city, m = mods(s); c.res.wood += m.wood * dt; c.res.stone += m.stone * dt; c.res.iron += m.iron * dt;
    if (m.gps) s.gold += Core.stageInfo(s.n).gold * m.gps * dt * H.gold(s);
  };
  H.kill = (s, i) => {
    const c = s.city, pr = ZONE_RES[i.zone], a = (1 + i.n * 0.1) * 0.35 * (i.boss ? 8 : 1);
    c.res[pr] += a; for (const k in RES) if (k !== pr) c.res[k] += a * 0.2;
    if (i.boss) { const h = randHero(), q = 1 + (Math.random() < 0.4 ? 1 : 0) + Math.floor(i.zone / 3); addFrag(s, h.id, q); if (s.rt) Core.ev(s, { t: 'frag', id: h.id, q }); }
  };
  H.offline = (s, o, secs) => { const m = mods(s), k = 0.6; o.res = { wood: m.wood * secs * k, stone: m.stone * secs * k, iron: m.iron * secs * k }; o.gold += Core.stageInfo(s.n).gold * m.gps * secs * k * H.gold(s); };
  H.newCity = () => ({ b: { hall: 1 }, res: { wood: 30, stone: 20, iron: 0 }, heroes: {}, frag: { eirik: 10 }, squad: [], exp: [], ver: 1 });
  H.loadCity = (d) => {
    const c = H.newCity(); if (!d || typeof d !== 'object') return c; const n = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
    for (const b of BLD) c.b[b.id] = Math.max(b.id === 'hall' ? 1 : 0, Math.min(20, n(d.b && d.b[b.id]) | 0)); for (const k in RES) c.res[k] = n(d.res && d.res[k]);
    for (const h of HEROES) { const x = d.heroes && d.heroes[h.id]; if (x && x.star > 0) c.heroes[h.id] = { star: Math.min(5, x.star | 0), lvl: Math.max(1, Math.min(60, x.lvl | 0)) }; c.frag[h.id] = n(d.frag && d.frag[h.id]) | 0; }
    c.squad = (Array.isArray(d.squad) ? d.squad : []).filter((id, i, a2) => c.heroes[id] && a2.indexOf(id) === i).slice(0, 4);
    c.exp = (Array.isArray(d.exp) ? d.exp : []).filter((x) => x && EID[x.k] && Array.isArray(x.heroes) && Number.isFinite(x.t1)).slice(0, 4).map((x) => ({ k: x.k, heroes: x.heroes.filter((id) => c.heroes[id] && !c.squad.includes(id)).slice(0, 3), t0: x.t0 | 0, t1: x.t1, power: n(x.power) }));
    return c;
  };
  Core.World = { RES, BLD, BID, HEROES, HID, HRAR, STAR_COST, PASS, HNAME, SUMMON, EXPS, EID, lvl, bldInfo, bldBuy, bldCost, heroInfo, heroUnlock, heroLevel, heroStar, squadToggle, squadSlots, hPower, pVal, summon, summonCost, expSlots, expStart, expClaim, expSkip, expLeft, expRewards, recPower, idleHeroes, mods, bump, canPay, addFrag, bmax };
  Core.ACH.push({ id: 'hall5', name: 'Столичный житель', desc: 'Подними Ратушу до 5 уровня', gems: 5, ok: (s) => lvl(s, 'hall') >= 5 }, { id: 'hall10', name: 'Градоначальник', desc: 'Подними Ратушу до 10 уровня', gems: 15, ok: (s) => lvl(s, 'hall') >= 10 },
    { id: 'hero1', name: 'Первый герой', desc: 'Найми героя', gems: 5, ok: (s) => Object.keys(s.city.heroes).length >= 1 }, { id: 'hero5', name: 'Отряд героев', desc: 'Найми 5 героев', gems: 12, ok: (s) => Object.keys(s.city.heroes).length >= 5 },
    { id: 'star3', name: 'Закалённый', desc: 'Подними героя до 3 звёзд', gems: 15, ok: (s) => Object.values(s.city.heroes).some((h) => h.star >= 3) });
  // подмешиваем в меню Core
  if (typeof module !== 'undefined' && module.exports) module.exports = Core.World;
})(typeof window !== 'undefined' ? window : globalThis);
