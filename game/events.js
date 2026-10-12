// FROSTFALL: случайные события в походе (золотая снежинка, гоблин-вор, метель, караван). Только логика.
(function (root) {
  'use strict';
  const Core = root.Core, H = Core.H, F = Core.fmt, FEET = 152;
  const st = (s) => { const rt = Core.ensureRt(s); if (!rt.E) rt.E = { next: 40, objs: [], bliz: 0, fz: 0 }; return rt.E; };
  const ev = (s, o) => { o.t = 'evt'; Core.ev(s, o); };
  const goldNow = (s) => Core.stageInfo(s.n).gold * Core.goldMult(s);

  function spawnEvent(s) {
    const E = st(s), r = Math.random();
    if (r < 0.45 || s.n < 3) { E.objs.push({ k: 'flake', x: -12, y0: 34 + Math.random() * 46, y: 40, vx: 36, t: 14, ph: Math.random() * 6 }); ev(s, { k: 'spawn', what: 'flake' }); }
    else if (r < 0.65) { E.objs.push({ k: 'goblin', x: 400, y: FEET + 2, vx: -52, t: 10, hp: 3 }); ev(s, { k: 'spawn', what: 'goblin' }); }
    else if (r < 0.85) { E.bliz = 30; s.st.events++; ev(s, { k: 'bliz' }); }
    else if (s.n >= 5) { E.objs.push({ k: 'chest', x: 150 + Math.random() * 120, y: FEET + 3, vx: 0, t: 16 }); ev(s, { k: 'spawn', what: 'chest' }); }
    else { E.objs.push({ k: 'flake', x: -12, y0: 40, y: 40, vx: 36, t: 14, ph: 0 }); ev(s, { k: 'spawn', what: 'flake' }); }
  }
  function say(s, o, text, col) { ev(s, { k: 'reward', text, col, x: o.x, y: o.y }); }
  function reward(s, o) {
    const E = st(s), L = Core.Lore, W = Core.World;
    if (o.k === 'flake') {
      s.st.events++; const r = Math.random();
      if (r < 0.46) { const g = goldNow(s) * (40 + Math.random() * 40); s.gold += g; say(s, o, '+' + F(g) + ' золота', '#ffd24a'); }
      else if (r < 0.70) { E.fz = 20; say(s, o, 'Безумие льда: урон ×5, 20 с', '#7fe0ff'); }
      else if (r < 0.85) { const g = 1 + Math.floor(Math.random() * 2) + Math.floor(s.maxN / 40); s.gems += g; say(s, o, '+' + g + ' самоцв.', '#ff7ae0'); }
      else if (r < 0.985) { Core.dropItem(s, 2 + (Math.random() < 0.25 ? 1 : 0)); say(s, o, 'Редкая находка!', '#b66cff'); }
      else if (L) { L.dropArt(s, 'event'); say(s, o, 'Меч в снежинке!', '#ff4d6d'); }
    } else if (o.k === 'goblin') {
      s.st.events++; s.st.goblins++; const g = goldNow(s) * (110 + Math.random() * 60); s.gold += g; say(s, o, '+' + F(g) + ' золота', '#ffd24a');
      if (Math.random() < 0.4) { s.gems += 2; ev(s, { k: 'reward', text: '+2 самоцв.', col: '#ff7ae0', x: o.x, y: o.y - 12 }); }
    } else if (o.k === 'chest') {
      s.st.events++; const sc = 1 + (W ? W.lvl(s, 'hall') * 0.5 : 0) + s.maxN * 0.1, res = s.city && s.city.res;
      if (res) { res.wood += 35 * sc; res.stone += 28 * sc; res.iron += 18 * sc; }
      const g = goldNow(s) * 60; s.gold += g; say(s, o, 'Караван: ' + F(g) + ' золота и материалы', '#d8a860');
      if (Math.random() < 0.25) Core.dropItem(s, 2);
    }
  }
  function tick(s, dt) {
    const E = st(s), rt = s.rt; E.fz = Math.max(0, E.fz - dt); E.bliz = Math.max(0, E.bliz - dt);
    if (!s.set.events) { E.objs.length = 0; return; }
    if (rt.mode !== 'city') { E.next -= dt; if (E.next <= 0) { spawnEvent(s); E.next = 80 + Math.random() * 80; } }
    for (let i = E.objs.length - 1; i >= 0; i--) {
      const o = E.objs[i]; o.t -= dt; o.x += o.vx * dt; if (o.k === 'flake') o.y = o.y0 + Math.sin(o.x / 22 + o.ph) * 12;
      if (o.t <= 0 || o.x < -40 || o.x > 430) { E.objs.splice(i, 1); if (o.k === 'goblin') ev(s, { k: 'miss', what: 'goblin' }); }
    }
  }
  function click(s, x, y) {
    const E = st(s); if (!s.set.events) return false;
    for (let i = E.objs.length - 1; i >= 0; i--) {
      const o = E.objs[i]; let hit = false;
      if (o.k === 'flake') hit = Math.abs(x - o.x) < 15 && Math.abs(y - o.y) < 15;
      else if (o.k === 'goblin') hit = Math.abs(x - o.x) < 16 && y > o.y - 34 && y < o.y + 6;
      else hit = Math.abs(x - o.x) < 15 && y > o.y - 20 && y < o.y + 4;
      if (!hit) continue;
      if (o.k === 'goblin' && --o.hp > 0) { ev(s, { k: 'hit', x: o.x, y: o.y - 14 }); o.vx *= 1.25; return true; }
      E.objs.splice(i, 1); reward(s, o); return true;
    }
    return false;
  }
  const prevTick = H.tick; H.tick = (s, dt) => { prevTick(s, dt); tick(s, dt); };
  const od = H.dmg, og = H.gold;
  H.dmg = (s) => od(s) * (s.rt && s.rt.E && s.rt.E.fz > 0 ? 5 : 1);
  H.gold = (s) => og(s) * (s.rt && s.rt.E && s.rt.E.bliz > 0 ? 2 : 1);
  Core.Events = { st, click, FEET, spawnEvent };
  if (typeof module !== 'undefined' && module.exports) module.exports = Core.Events;
})(typeof window !== 'undefined' ? window : globalThis);
