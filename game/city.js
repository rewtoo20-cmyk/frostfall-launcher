// Экран столицы: постройки, прогуливающиеся герои, дым.
(function (W) {
  'use strict';
  const A = W.ART, Sc = W.Scene, Wd = W.Core.World, { text, tw, panel } = W.PX;
  const SPOTS = [
    { id: 'mage', x: 38, y: 126 }, { id: 'walls', x: 108, y: 126 }, { id: 'hall', x: 192, y: 128 }, { id: 'walls', x: 276, y: 126, flip: true }, { id: 'temple', x: 346, y: 126 },
    { id: 'sawmill', x: 34, y: 172 }, { id: 'quarry', x: 96, y: 172 }, { id: 'tavern', x: 158, y: 172 }, { id: 'mine', x: 220, y: 172 }, { id: 'forge', x: 282, y: 172 }, { id: 'treasury', x: 344, y: 172 },
  ];
  const WD = 384;
  let T = 0, smoke = [], walkers = {};
  const tier = (L) => (L >= 15 ? 3 : L >= 10 ? 2 : L >= 5 ? 1 : 0);
  function frame(c, S, dt, hoverId) {
    T += dt; const spots = [], badges = [];
    Sc.backdrop(c, dt, 0);
    const drawSpot = (sp) => {
      const L = Wd.lvl(S, sp.id), info = Wd.bldInfo(S, sp.id), built = L > 0, spr = A.bld(sp.id, tier(L), built), bob = sp.id === 'mage' && built ? Math.round(Math.sin(T * 2)) : 0;
      const x0 = Math.round(sp.x - 36), y0 = Math.round(sp.y - 74 + bob);
      c.fillStyle = '#f2f8ff'; c.fillRect(sp.x - 28, sp.y - 2, 56, 4); c.fillRect(sp.x - 24, sp.y - 4, 48, 2); c.fillRect(sp.x - 24, sp.y + 2, 48, 2); c.fillStyle = '#d6e8f8'; c.fillRect(sp.x - 20, sp.y + 4, 40, 1);
      const ap = W.City.appear && W.City.appear[sp.id], rv = ap && ap.t < 0.9 ? ap.t / 0.9 : 1, bnc = ap && ap.t >= 0.9 ? Math.round(Math.sin((ap.t - 0.9) / 0.6 * Math.PI) * 3) : 0, y1 = y0 - bnc;
      if (rv < 1) { c.save(); c.beginPath(); c.rect(sp.x - 40, y0 + Math.round((1 - rv) * spr.height), 80, spr.height); c.clip(); }
      if (sp.flip) { c.save(); c.translate(sp.x * 2, 0); c.scale(-1, 1); c.drawImage(spr, x0, y1); c.restore(); } else c.drawImage(spr, x0, y1);
      if (rv < 1) { c.restore(); const ty = y0 + Math.round((1 - rv) * spr.height); c.fillStyle = '#8a6a3a'; c.fillRect(x0 + 8, ty, 2, y0 + spr.height - ty); c.fillRect(x0 + spr.width - 10, ty, 2, y0 + spr.height - ty); c.fillRect(x0 + 8, ty, spr.width - 16, 2); c.fillStyle = '#c9a24a'; c.fillRect(x0 + 8, ty, spr.width - 16, 1); }
      if (!info.reqOk && !built) { c.globalAlpha = 0.55; c.fillStyle = '#10182e'; c.fillRect(sp.x - 18, sp.y - 20, 36, 20); c.globalAlpha = 1; c.drawImage(A.icons.lock, sp.x - 4, sp.y - 16); }
      // метка уровня
      const lab = built ? String(L) : info.reqOk ? '+' : 'Р' + Wd.BID[sp.id].req;
      const w = Math.max(14, tw(lab) + 6), bx = Math.round(sp.x - w / 2), by = sp.y + 2;
      panel(c, bx, by, w, 11, { fill: hoverId === sp.id ? '#3a8ad8' : built ? '#243459' : '#3a2a2a' }); text(c, lab, sp.x, by, built ? '#ffffff' : '#ffb1a0', { align: 'c', sh: null });
      if (info.can) { const up = Math.round(Math.sin(T * 5 + sp.x) * 2); c.drawImage(A.icons.up, sp.x - 4, sp.y - 70 + up - (sp.id === 'hall' ? 8 : 0)); }
      spots.push({ id: sp.id, x: sp.x - 26, y: sp.y - 62, w: 52, h: 62 }); badges.push({ id: sp.id, x: sp.x - 13, y: by - 2, w: 26, h: 15 });
      // дым
      if (built && (sp.id === 'forge' || sp.id === 'tavern' || sp.id === 'sawmill') && Math.random() < dt * 3) smoke.push({ x: sp.x + (sp.id === 'forge' ? 6 : sp.id === 'tavern' ? 8 : 6), y: sp.y - (sp.id === 'forge' ? 66 : sp.id === 'tavern' ? 62 : 56), l: 1.6, v: 0 });
    };
    SPOTS.filter((sp) => sp.y < 150).forEach(drawSpot);
    SPOTS.filter((sp) => sp.y >= 150).forEach(drawSpot);
    for (const bd of badges) spots.push(bd); // значки «+» и уровни: выше по приоритету, чем тела зданий
    // жители столицы
    const Lr = W.Core.Lore;
    if (Lr) for (const n of Lr.NPCS) {
      if (!Lr.npcVisible(S, n)) continue; const md = Lr.npcMode(S, n.id).mode, f = Math.floor(T * 1.2 + n.x) % 2, by = n.ghost ? Math.round(Math.sin(T * 2) * 2) : 0, spr = A.hum(n.key, f, false), hv = hoverId === 'npc:' + n.id;
      c.fillStyle = 'rgba(20,40,80,.25)'; c.fillRect(n.x - 10, 184, 20, 3);
      if (n.ghost) c.globalAlpha = 0.72; Sc.drawSpr(c, spr, n.x, 186 + by); c.globalAlpha = 1;
      const top = 186 + by - 31;
      if (md !== 'idle' && md !== 'wait') { const up = Math.round(Math.sin(T * 4 + n.x) * 2), ch = md === 'offer' ? '!' : '?', col = md === 'offer' ? '#ffd24a' : '#5fe08a'; panel(c, n.x - 6, top - 14 + up, 12, 13, { fill: '#162038', hi: col }); text(c, ch, n.x, top - 14 + up, col, { align: 'c', sh: null }); }
      else if (md === 'wait') { const up = Math.round(Math.sin(T * 3 + n.x)); text(c, '...', n.x, top - 10 + up, '#9aa4c0', { align: 'c' }); }
      if (hv) { const t = n.name + ', ' + n.title.toLowerCase(), w = tw(t) + 10; panel(c, Math.max(2, Math.min(WD - w - 2, n.x - w / 2)), top - 30, w, 14); text(c, t, Math.max(2, Math.min(WD - w - 2, n.x - w / 2)) + 5, top - 29, '#fff'); }
      spots.push({ id: 'npc:' + n.id, npc: n.id, x: n.x - 13, y: top - 2, w: 26, h: 186 - top + 4 });
    }
    for (let i = smoke.length - 1; i >= 0; i--) { const p = smoke[i]; p.l -= dt; if (p.l <= 0) { smoke.splice(i, 1); continue; } p.y -= 9 * dt; p.x += Math.sin(T * 2 + p.y) * 4 * dt; c.globalAlpha = Math.min(0.7, p.l * 0.6); c.fillStyle = '#dfe9f5'; c.fillRect(Math.round(p.x), Math.round(p.y), 3, 3); }
    c.globalAlpha = 1;
    Sc.snowfall(c, dt);
    return spots;
  }
  W.City = { frame, SPOTS };
})(window);
