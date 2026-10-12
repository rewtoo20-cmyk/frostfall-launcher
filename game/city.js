// Экран столицы: постройки, прогуливающиеся герои, дым.
(function (W) {
  'use strict';
  const A = W.ART, Sc = W.Scene, Wd = W.Core.World, { text, tw, panel } = W.PX;
  const SPOTS = [
    { id: 'mage', x: 38, y: 126 }, { id: 'walls', x: 108, y: 126 }, { id: 'hall', x: 192, y: 128 }, { id: 'walls', x: 276, y: 126, flip: true }, { id: 'temple', x: 346, y: 126 },
    { id: 'sawmill', x: 34, y: 172 }, { id: 'quarry', x: 96, y: 172 }, { id: 'tavern', x: 158, y: 172 }, { id: 'mine', x: 220, y: 172 }, { id: 'forge', x: 282, y: 172 }, { id: 'treasury', x: 344, y: 172 },
  ];
  let T = 0, smoke = [], walkers = {};
  const tier = (L) => (L >= 15 ? 3 : L >= 10 ? 2 : L >= 5 ? 1 : 0);
  function frame(c, S, dt, hoverId) {
    T += dt; const spots = [];
    Sc.backdrop(c, dt, 0);
    const drawSpot = (sp) => {
      const L = Wd.lvl(S, sp.id), info = Wd.bldInfo(S, sp.id), built = L > 0, spr = A.bld(sp.id, tier(L), built), bob = sp.id === 'mage' && built ? Math.round(Math.sin(T * 2)) : 0;
      const x0 = Math.round(sp.x - 36), y0 = Math.round(sp.y - 74 + bob);
      c.fillStyle = '#f2f8ff'; c.fillRect(sp.x - 28, sp.y - 2, 56, 4); c.fillRect(sp.x - 24, sp.y - 4, 48, 2); c.fillRect(sp.x - 24, sp.y + 2, 48, 2); c.fillStyle = '#d6e8f8'; c.fillRect(sp.x - 20, sp.y + 4, 40, 1);
      if (sp.flip) { c.save(); c.translate(sp.x * 2, 0); c.scale(-1, 1); c.drawImage(spr, x0, y0); c.restore(); } else c.drawImage(spr, x0, y0);
      if (!info.reqOk && !built) { c.globalAlpha = 0.55; c.fillStyle = '#10182e'; c.fillRect(sp.x - 18, sp.y - 20, 36, 20); c.globalAlpha = 1; c.drawImage(A.icons.lock, sp.x - 4, sp.y - 16); }
      // метка уровня
      const lab = built ? String(L) : info.reqOk ? '+' : 'Р' + Wd.BID[sp.id].req;
      const w = Math.max(14, tw(lab) + 6), bx = Math.round(sp.x - w / 2), by = sp.y + 3 - (sp.y > 170 ? 0 : 0);
      panel(c, bx, by, w, 12, { fill: hoverId === sp.id ? '#3a8ad8' : built ? '#243459' : '#3a2a2a' }); text(c, lab, sp.x, by + 1, built ? '#ffffff' : '#ffb1a0', { align: 'c', sh: null });
      if (info.can) { const up = Math.round(Math.sin(T * 5 + sp.x) * 2); c.drawImage(A.icons.up, sp.x - 4, sp.y - 70 + up - (sp.id === 'hall' ? 8 : 0)); }
      spots.push({ id: sp.id, x: sp.x - 28, y: sp.y - 66, w: 56, h: 82 });
      // дым
      if (built && (sp.id === 'forge' || sp.id === 'tavern' || sp.id === 'sawmill') && Math.random() < dt * 3) smoke.push({ x: sp.x + (sp.id === 'forge' ? 6 : sp.id === 'tavern' ? 8 : 6), y: sp.y - (sp.id === 'forge' ? 66 : sp.id === 'tavern' ? 62 : 56), l: 1.6, v: 0 });
    };
    SPOTS.filter((sp) => sp.y < 150).forEach(drawSpot);
    SPOTS.filter((sp) => sp.y >= 150).forEach(drawSpot);
    S.city.squad.forEach((id, i) => { const base = [65, 127, 189, 251][i] || 313, x = base + Math.sin(T * 0.7 + i * 2) * 12, f = Math.floor(T * 5 + i) % 2; Sc.drawSpr(c, A.hum(id, f, false), x, 187); });
    for (let i = smoke.length - 1; i >= 0; i--) { const p = smoke[i]; p.l -= dt; if (p.l <= 0) { smoke.splice(i, 1); continue; } p.y -= 9 * dt; p.x += Math.sin(T * 2 + p.y) * 4 * dt; c.globalAlpha = Math.min(0.7, p.l * 0.6); c.fillStyle = '#dfe9f5'; c.fillRect(Math.round(p.x), Math.round(p.y), 3, 3); }
    c.globalAlpha = 1;
    Sc.snowfall(c, dt);
    return spots;
  }
  W.City = { frame, SPOTS };
})(window);
