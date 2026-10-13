// FROSTFALL: визуальные эффекты v1.8 (рисование поверх сцены и интерфейса). Логика лежит в ext.js.
// Погода, свет по времени суток, лучи в лесу, жар над огненными мобами, размытие быстрых ударов, растворение при смерти,
// свечение легенд, искры заточки, сундуки, анимация построек и заданий, перелистывание страниц, растворение вкладок,
// тряска интерфейса, экран загрузки с подсказками, обучающие указатели, джойстик, индикатор сети, хитбоксы.
(function (W) {
  'use strict';
  const FF = W.FF = W.FF || {}, X = FF.Ext, PX = W.PX, A = W.ART, { text, tw, panel } = PX, WD = 384, HT = 216, FEET = 152, HX = 108, MX = 292;
  let T = 0;
  const rr = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const Q = (S) => (S && S.set && S.set.light ? 0 : X.Perf.q);
  const mkc = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const disc = (c, cx, cy, r, col) => { c.fillStyle = col; for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy + 0.25)); c.fillRect(cx - w, cy + dy, 2 * w + 1, 1); } };
  const ring = (c, cx, cy, r, col) => { c.fillStyle = col; for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy + 0.25)), w2 = r - 1 >= Math.abs(dy) ? Math.floor(Math.sqrt((r - 1) * (r - 1) - dy * dy + 0.25)) : -1; if (w2 < 0) c.fillRect(cx - w, cy + dy, 2 * w + 1, 1); else { c.fillRect(cx - w, cy + dy, w - w2, 1); c.fillRect(cx + w2 + 1, cy + dy, w - w2, 1); } } };
  const wrapT = (s, maxW) => { const out = []; let line = ''; for (const wd of String(s).split(' ')) { const t = line ? line + ' ' + wd : wd; if (tw(t) > maxW && line) { out.push(line); line = wd; } else line = t; } if (line) out.push(line); return out; };

  // ---------- погода ----------
  const wx = { flakes: [], inited: false, glints: [] };
  function wxInit() { for (let i = 0; i < 130; i++) wx.flakes.push({ x: Math.random() * WD, y: Math.random() * HT, v: 18 + Math.random() * 30, s: Math.random() * 6, m: new X.Mover(), big: i % 5 === 0 }); wx.inited = true; }
  function weather(c, S, dt, zone) {
    if (!wx.inited) wxInit(); const q = Q(S), kind = X.Time.weather(S), ember = zone === 5 || zone === 8; if (q === 0 && kind !== 'blizzard') return;
    if (kind === 'snow' && !ember) {
      const n = q >= 2 ? 90 : q === 1 ? 40 : 14; c.fillStyle = '#ffffff';
      for (let i = 0; i < n; i++) { const p = wx.flakes[i], s = p.m.step(Math.sin(T * 0.7 + p.s) * 8, p.v * (p.big ? 1.3 : 1), dt); p.x += s.dx; p.y += s.dy; if (p.y > HT) { p.y = -3; p.x = Math.random() * WD; } if (p.x < -3) p.x = WD; if (p.x > WD + 3) p.x = -3; c.globalAlpha = p.big ? 0.95 : 0.7; const z = p.big ? 2 : 1; c.fillRect(Math.round(p.x), Math.round(p.y), z, z); }
      c.globalAlpha = 1;
    } else if (kind === 'blizzard') {
      const n = q >= 2 ? 120 : q === 1 ? 60 : 24; c.globalAlpha = 0.1 + 0.05 * Math.sin(T * 1.3); c.fillStyle = '#dfeeff'; c.fillRect(0, 0, WD, HT); c.globalAlpha = 0.85; c.fillStyle = '#ffffff';
      for (let i = 0; i < n; i++) { const p = wx.flakes[i % wx.flakes.length], s = p.m.step(-130 - p.v * 1.4, 60 + p.v, dt); p.x += s.dx; p.y += s.dy; if (p.y > HT) { p.y -= HT + 4; } if (p.x < -6) { p.x += WD + 8; p.y = Math.random() * HT; } c.fillRect(Math.round(p.x), Math.round(p.y), p.big ? 4 : 3, 1); }
      c.globalAlpha = 1;
    } else if (kind === 'sun' && q >= 1 && !X.Time.isNight(X.Time.hour(S))) {
      c.globalAlpha = 0.06; c.fillStyle = '#ffe9a0'; c.fillRect(0, 0, WD, HT); c.globalAlpha = 1;
      const a = 0.05 + 0.025 * Math.sin(T * 0.8); c.fillStyle = 'rgba(255,240,170,' + a.toFixed(3) + ')'; for (let k = 0; k < 3; k++) for (let y = 0; y < 120; y += 3) { const xx = Math.round(10 + k * 36 + y * 0.8); c.fillRect(xx, y, 10 + k * 3, 3); }
      if (q >= 2) { if (Math.random() < dt * 10 && wx.glints.length < 14) wx.glints.push({ x: Math.random() * WD, y: 150 + Math.random() * 55, t: 0 }); for (let i = wx.glints.length - 1; i >= 0; i--) { const g = wx.glints[i]; g.t += dt; if (g.t > 0.7) { wx.glints.splice(i, 1); continue; } const k = Math.sin(g.t / 0.7 * Math.PI); c.globalAlpha = k; c.fillStyle = '#ffffff'; c.fillRect(Math.round(g.x), Math.round(g.y), 1, 1); if (k > 0.6) { c.fillRect(Math.round(g.x) - 1, Math.round(g.y), 3, 1); c.fillRect(Math.round(g.x), Math.round(g.y) - 1, 1, 3); } } c.globalAlpha = 1; }
    }
  }

  // ---------- освещение по времени суток ----------
  function daylight(c, S, mode, spots, builtFn) {
    const h = X.Time.hour(S), t = X.Time.tint(h); if (!t) return; const k = mode === 'city' ? 1 : 0.9;
    c.fillStyle = 'rgba(' + t.r + ',' + t.g + ',' + t.b + ',' + (t.a * k).toFixed(3) + ')'; c.fillRect(0, 0, WD, HT);
    if (mode === 'city' && X.Time.light(h) < 0.6) {
      const dark = 1 - X.Time.light(h);
      if (dark > 0.4 && Q(S) >= 1) { c.fillStyle = '#ffffff'; for (let i = 0; i < 26; i++) { const tw2 = 0.5 + 0.5 * Math.sin(T * 2 + i * 1.7); c.globalAlpha = 0.5 * tw2 * Math.min(1, (dark - 0.4) * 2); c.fillRect((i * 97) % WD, (i * 53) % 58, 1, 1); } c.globalAlpha = 1; }
      for (const sp of spots || []) { if (sp.h < 40 || !builtFn(sp.id)) continue; const cx = sp.x + 26, by = sp.y + 62, fl = 0.85 + 0.15 * Math.sin(T * 5 + cx); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.16 * dark * fl; c.fillStyle = '#ff9c3a'; c.fillRect(cx - 14, by - 40, 28, 30); c.globalAlpha = 0.22 * dark * fl; c.fillRect(cx - 9, by - 36, 18, 22); c.globalCompositeOperation = 'source-over'; c.globalAlpha = dark * fl; c.fillStyle = '#ffe08a'; c.fillRect(cx - 10, by - 34, 3, 4); c.fillRect(cx + 6, by - 34, 3, 4); c.fillRect(cx - 2, by - 22, 3, 4); c.globalAlpha = 1; }
    }
  }

  // ---------- лучи света в лесу (зоны 0-1) ----------
  function rays(c, S, zone) {
    if (zone > 1 || Q(S) < 1) return; const h = X.Time.hour(S), l = X.Time.light(h); if (l < 0.6 || X.Time.weather(S) === 'blizzard') return;
    for (let i = 0; i < 4; i++) { const x0 = 30 + i * 90 + Math.sin(T * 0.3 + i * 2) * 10, w = 12 + i * 3, a = (0.05 + 0.035 * Math.sin(T * 0.7 + i * 1.3)) * l; c.fillStyle = 'rgba(255,246,200,' + a.toFixed(3) + ')'; for (let y = 0; y < 150; y += 3) c.fillRect(Math.round(x0 + y * 0.45), y, w + Math.round(y * 0.08), 3); }
  }

  // ---------- жар над огненными мобами ----------
  const FIRE = { flame: 1, imp: 1, dragon: 1 }, hcv = mkc(100, 110), hcx = hcv.getContext('2d');
  function heat(c, S) {
    const m = S.rt.mon; if (!m || m.dead || Q(S) < 2 || !FIRE[m.type]) return; const boss = m.boss, w = boss ? 96 : 60, h = boss ? 100 : 62, sx = MX - (w >> 1), sy = FEET + 4 - h;
    hcx.clearRect(0, 0, 100, 110); hcx.drawImage(c.canvas, sx, sy, w, h, 0, 0, w, h);
    for (let y = 0; y < h; y++) { const off = Math.round(Math.sin(T * 7 + y * 0.35) * 1.5 * (0.35 + 0.65 * y / h)); if (off) c.drawImage(hcv, 0, y, w, 1, sx + off, sy + y, w, 1); }
    c.globalAlpha = 0.08 + 0.04 * Math.sin(T * 6); c.fillStyle = '#ff8a2a'; c.fillRect(sx + 6, sy + 10, w - 12, h - 14); c.globalAlpha = 1;
  }

  // ---------- размытие быстрых ударов ----------
  const mb = { t: 0, crit: false }, bcv = mkc(80, 70), bcx = bcv.getContext('2d');
  function blur(c, S) {
    if (mb.t <= 0 || Q(S) < 2) return; const sx = HX - 30, sy = FEET - 50, w = 76, h = 60, k = mb.t / (mb.crit ? 0.22 : 0.09);
    bcx.clearRect(0, 0, 80, 70); bcx.drawImage(c.canvas, sx, sy, w, h, 0, 0, w, h);
    for (let i = 1; i <= 3; i++) { c.globalAlpha = (0.3 - i * 0.07) * Math.min(1, k + 0.3); c.drawImage(bcv, 0, 0, w, h, sx - i * 4, sy, w, h); }
    c.globalAlpha = 1; if (mb.crit) { c.fillStyle = '#ffffff'; for (let i = 0; i < 3; i++) c.fillRect(HX + 8 - i * 7, FEET - 34 + i * 6, 16 + i * 4, 1); }
  }

  // ---------- растворение при смерти ----------
  const pxCache = new WeakMap(), dis = [], tmpc = mkc(64, 64), tmpx = tmpc.getContext('2d', { willReadFrequently: true });
  function pixelsOf(spr) {
    let r = pxCache.get(spr); if (r) return r; const w = spr.width, h = spr.height; tmpc.width = w; tmpc.height = h; tmpx.clearRect(0, 0, w, h); tmpx.drawImage(spr, 0, 0); const d = tmpx.getImageData(0, 0, w, h).data; r = { w, h, p: [] };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (d[i + 3] > 40) r.p.push([x, y, 'rgb(' + d[i] + ',' + d[i + 1] + ',' + d[i + 2] + ')']); }
    pxCache.set(spr, r); return r;
  }
  function dissolve(c, S, dt) {
    const m = S.rt.mon, q = Q(S);
    if (m && m.dead && !m._dis && q >= 1 && A && A.mon) {
      m._dis = 1; const info = W.Core.stageInfo(S.n), spr = A.mon(m.type, 0, m.boss, info.type === 'dragon' ? A.DRAGON_FIRE : null), pr = pixelsOf(spr), fly = m.type === 'bat' || m.type === 'ghost' ? 14 : 0;
      const x0 = MX - Math.round(spr.width / 2), y0 = FEET + 4 - fly - spr.height + 1, step = Math.max(1, Math.ceil(pr.p.length / (q >= 2 ? 700 : 260)));
      for (let i = 0; i < pr.p.length; i += step) { const p = pr.p[i]; dis.push({ x: x0 + p[0], y: y0 + p[1], col: p[2], d: (1 - p[1] / pr.h) * 0.4 + Math.random() * 0.12, vx: (p[0] / pr.w - 0.5) * 22 + rr(-8, 8), vy: -rr(14, 42), a: 1, z: step > 1 || m.boss ? 2 : 1, mv: new X.Mover() }); }
    }
    for (let i = dis.length - 1; i >= 0; i--) {
      const p = dis[i]; if (p.d > 0) { p.d -= dt; } else { const s = p.mv.step(p.vx, p.vy, dt); p.x += s.dx; p.y += s.dy; p.vy += 22 * dt; p.a -= dt * 1.7; if (p.a <= 0) { dis.splice(i, 1); continue; } }
      c.globalAlpha = p.d > 0 ? 1 : p.a; c.fillStyle = p.col; c.fillRect(p.x, p.y, p.z, p.z);
    }
    c.globalAlpha = 1;
  }

  // ---------- свечение легенд ----------
  function glow(c, x, y, w, h, col, t) {
    const p = 0.55 + 0.45 * Math.sin((t || T) * 3); c.fillStyle = col;
    for (let i = 3; i >= 1; i--) { c.globalAlpha = (0.32 / i) * p; c.fillRect(x - i, y - i + 1, w + 2 * i, 1); c.fillRect(x - i, y + h + i - 2, w + 2 * i, 1); c.fillRect(x - i, y - i + 2, 1, h + 2 * i - 4); c.fillRect(x + w + i - 1, y - i + 2, 1, h + 2 * i - 4); }
    c.globalAlpha = 0.9 * p; c.fillStyle = '#ffffff'; const k = Math.floor((t || T) * 2) % 4; c.fillRect(x + (k * 5) % Math.max(1, w - 1), y - 1, 1, 1); c.globalAlpha = 1;
  }
  function heroAura(c, S) {
    if (Q(S) < 1) return; let best = -1, col = null; for (const k in S.equip) { const it = S.equip[k]; if (it && it.rar >= 3 && it.rar > best) { best = it.rar; col = W.Core.RAR[it.rar].col; } } if (!col) return;
    c.globalCompositeOperation = 'lighter'; const p = 0.6 + 0.4 * Math.sin(T * 2.4); c.fillStyle = col;
    for (let r = 3; r >= 1; r--) { c.globalAlpha = 0.045 * p * (4 - r) / 3; for (let dy = -30; dy <= 6; dy++) { const w = Math.floor(Math.sqrt(Math.max(0, 1 - (dy + 12) * (dy + 12) / ((18 + r * 4) * (18 + r * 4)))) * (14 + r * 3)); if (w > 0) c.fillRect(HX - w, FEET + dy - 10, w * 2, 1); } }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    if (Math.random() < 0.25) sparks(HX + rr(-10, 10), FEET - rr(2, 30), 1, [col], 0.6, true);
  }

  // ---------- искры ----------
  const sp = [];
  function sparks(x, y, n, cols, power, soft) {
    cols = cols || ['#ffd24a', '#ff9c2a', '#ffffff']; power = power || 1;
    for (let i = 0; i < n && sp.length < 220; i++) sp.push({ x, y, vx: rr(-90, 90) * power, vy: (soft ? -rr(8, 24) : -rr(30, 150)) * power, life: rr(0.4, 0.9), t: 0, col: cols[i % cols.length], g: soft ? -8 : 320, m: new X.Mover(), fx: 0 });
  }
  function drawSparks(c, dt) {
    for (let i = sp.length - 1; i >= 0; i--) {
      const p = sp[i]; p.t += dt; if (p.t >= p.life) { sp.splice(i, 1); continue; } p.vy += p.g * dt; const s = p.m.step(p.vx, p.vy, dt); p.x += s.dx; p.y += s.dy; const k = 1 - p.t / p.life;
      c.globalAlpha = k; c.fillStyle = p.col; c.fillRect(Math.round(p.x), Math.round(p.y), k > 0.5 ? 2 : 1, k > 0.5 ? 2 : 1); c.globalAlpha = k * 0.4; c.fillRect(Math.round(p.x - p.vx * 0.02), Math.round(p.y - p.vy * 0.02), 1, 1);
    }
    c.globalAlpha = 1;
  }

  // ---------- сундук с анимацией открытия ----------
  const chest = { on: false, t: 0, lines: [], title: '', tier: 0, bits: [] }, TIER = [['#8a5a2a', '#a8703a', '#c9a24a'], ['#7a8aa6', '#a8b8d0', '#e0ecff'], ['#b8801a', '#e0a82a', '#fff2a0']];
  function chestOpen(title, lines, tier) { chest.on = true; chest.t = 0; chest.title = title; chest.lines = lines || []; chest.tier = clamp(tier | 0, 0, 2); chest.bits.length = 0; }
  function chestBody(c, x, y, op, col) { // x,y - центр низа; op 0..1 - угол открытия
    c.fillStyle = '#10182e'; c.fillRect(x - 15, y - 17, 30, 18);
    c.fillStyle = col[0]; c.fillRect(x - 14, y - 16, 28, 16); c.fillStyle = col[1]; c.fillRect(x - 14, y - 16, 28, 3); c.fillStyle = col[2]; c.fillRect(x - 14, y - 9, 28, 2); c.fillRect(x - 2, y - 11, 4, 5); c.fillStyle = '#3a2410'; c.fillRect(x - 1, y - 9, 2, 3);
    if (op > 0.15) { c.fillStyle = '#ffe9a0'; c.globalAlpha = Math.min(1, op); c.fillRect(x - 12, y - 17, 24, 2); c.globalAlpha = 1; }
    const lift = Math.round(op * 6), tilt = 0; // крышка поднимается и откидывается назад
    c.fillStyle = '#10182e'; c.fillRect(x - 15, y - 26 - lift, 30, 9); c.fillStyle = col[1]; c.fillRect(x - 14, y - 25 - lift, 28, 7); c.fillStyle = col[0]; c.fillRect(x - 14, y - 20 - lift, 28, 2); c.fillStyle = col[2]; c.fillRect(x - 14, y - 25 - lift, 28, 1);
    for (let i = 0; i < tilt; i++) { c.fillStyle = col[0]; c.fillRect(x - 14 + i, y - 18 - lift + i, 1, 1); c.fillRect(x + 13 - i, y - 18 - lift + i, 1, 1); }
  }
  function chestDraw(c, dt, push) {
    if (!chest.on) return; chest.t += dt; const t = chest.t, col = TIER[chest.tier], cx = 192, cy = 98;
    c.fillStyle = 'rgba(4,8,20,.78)'; c.fillRect(0, 0, WD, HT); push({ x: 0, y: 0, w: WD, h: HT, fn: () => { if (t > 1.7) chest.on = false; }, block: true });
    text(c, chest.title || 'Награда', cx, 24, '#ffd24a', { align: 'c' });
    c.save(); c.translate(cx, cy); c.scale(3, 3);
    let op = 0, sh = 0; if (t < 0.7) sh = Math.round(Math.sin(t * 50) * (0.5 + t * 1.4)); else op = clamp((t - 0.7) / 0.35, 0, 1);
    chestBody(c, sh, 12, op, col); c.restore();
    if (t >= 0.8) { // лучи и россыпь
      const k = clamp((t - 0.8) / 0.5, 0, 1); c.globalCompositeOperation = 'lighter'; c.fillStyle = col[2];
      for (let i = 0; i < 9; i++) { const a = T * 0.8 + i * 0.7, len = 40 + 30 * k; c.globalAlpha = 0.18 * (1 - k * 0.4); for (let r = 6; r < len; r += 3) c.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy - 28 + Math.sin(a) * r), 2, 2); }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      if (chest.bits.length < 40 && t < 1.7) for (let i = 0; i < 2; i++) chest.bits.push({ x: cx + rr(-14, 14), y: cy - 30, vx: rr(-30, 30), vy: -rr(60, 130), c: i ? '#ffd24a' : '#ff7ae0', t: 0, m: new X.Mover() });
    }
    for (let i = chest.bits.length - 1; i >= 0; i--) { const b = chest.bits[i]; b.t += dt; if (b.t > 1.2) { chest.bits.splice(i, 1); continue; } b.vy += 240 * dt; const s = b.m.step(b.vx, b.vy, dt); b.x += s.dx; b.y += s.dy; c.fillStyle = b.c; c.globalAlpha = 1 - b.t / 1.2; c.fillRect(b.x, b.y, 3, 3); c.fillStyle = '#ffffff'; c.fillRect(b.x, b.y, 1, 1); } c.globalAlpha = 1;
    chest.lines.forEach((l, i) => { const st = 1.2 + i * 0.25; if (t > st) { c.globalAlpha = clamp((t - st) / 0.3, 0, 1); text(c, l, cx, 148 + i * 13, '#eaf3ff', { align: 'c' }); } }); c.globalAlpha = 1;
    if (t > 1.7) text(c, 'Нажми, чтобы закрыть', cx, 200, '#7a86a6', { align: 'c' });
  }

  // ---------- анимация постройки ----------
  const lastLv = {}; let appearInit = false;
  function buildings(dt, Wd, S) {
    const ap = (W.City && (W.City.appear = W.City.appear || {}));
    for (const b of Wd.BLD) { const L = Wd.lvl(S, b.id); if (appearInit && lastLv[b.id] !== undefined && L > lastLv[b.id]) ap[b.id] = { t: 0, n: 0 }; lastLv[b.id] = L; }
    appearInit = true; for (const id in ap) { ap[id].t += dt; if (ap[id].t > 1.5) delete ap[id]; }
  }
  const dust = [];
  function buildFx(c, spots, dt, S) {
    const ap = W.City && W.City.appear; if (!ap) return;
    for (const id in ap) { const s = spots.find((q) => q.id === id && q.h > 20); if (!s) continue; const a = ap[id], cx = s.x + 26, by = s.y + 62;
      if (a.t < 1.0 && Math.random() < dt * 28) dust.push({ x: cx + rr(-22, 22), y: by - rr(0, 4), vx: rr(-12, 12), vy: -rr(6, 22), t: 0, life: rr(0.5, 0.9) });
      if (a.t < 0.9 && a.t - a.n > 0.22) { a.n = a.t; c.fillStyle = '#ffd24a'; c.fillRect(cx - 18 + Math.round(a.t * 30), by - 30 - Math.round(a.t * 40), 3, 1); sparks(cx + rr(-16, 16), by - rr(10, 50), 3, ['#ffd24a', '#ffffff'], 0.4); }
      if (a.t >= 0.9 && !a.done) { a.done = 1; sparks(cx, by - 36, 14, ['#ffd24a', '#ffffff', '#7fe0ff'], 0.8); } }
    for (let i = dust.length - 1; i >= 0; i--) { const p = dust[i]; p.t += dt; if (p.t > p.life) { dust.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; const k = p.t / p.life, z = 2 + Math.round(k * 4); c.globalAlpha = 0.6 * (1 - k); c.fillStyle = '#e8eef8'; c.fillRect(Math.round(p.x - z / 2), Math.round(p.y - z / 2), z, z); }
    c.globalAlpha = 1;
  }

  // ---------- баннер выполненного задания ----------
  const qb = { q: [], cur: null };
  function questBanner(title, sub, col) { qb.q.push({ title: String(title), sub: String(sub || ''), col: col || '#5fe08a', t: 0 }); }
  function questDraw(c, dt) {
    if (!qb.cur) qb.cur = qb.q.shift() || null; const b = qb.cur; if (!b) return; b.t += dt; const IN = 0.35, HOLD = 2.6, OUT = 0.3; if (b.t > IN + HOLD + OUT) { qb.cur = null; return; }
    let k = b.t < IN ? b.t / IN : b.t > IN + HOLD ? 1 - (b.t - IN - HOLD) / OUT : 1; k = k * k * (3 - 2 * k);
    const w = 240, h = 38, x = Math.round((WD - w) / 2), y = Math.round(-h + (h + 22) * k);
    panel(c, x, y, w, h, { fill: '#162038', hi: b.col }); c.fillStyle = b.col; c.fillRect(x + 3, y + 3, 3, h - 6); c.drawImage(A.icons.scroll, x + 12, y + 8);
    const p = clamp((b.t - IN) / 0.5, 0, 1); c.fillStyle = b.col; // галочка рисуется по частям
    const pts = [[0, 4], [1, 5], [2, 6], [3, 7], [4, 6], [5, 5], [6, 4], [7, 3], [8, 2], [9, 1]]; for (let i = 0; i < Math.floor(p * pts.length); i++) c.fillRect(x + 30 + pts[i][0], y + 22 + pts[i][1] - 6, 2, 2);
    text(c, 'Задание выполнено', x + 46, y + 5, b.col); text(c, b.title.length > 34 ? b.title.slice(0, 33) + '…' : b.title, x + 46, y + 17, '#ffffff'); if (b.sub) text(c, b.sub.length > 40 ? b.sub.slice(0, 39) + '…' : b.sub, x + 46, y + 27, '#ffd24a', { sh: null });
    if (b.t > IN && !b.burst) { b.burst = 1; sparks(x + 22, y + 22, 14, [b.col, '#ffffff', '#ffd24a'], 0.7); }
  }

  // ---------- перелистывание страниц ----------
  const book = { page: 0, to: 0, t: 1, dir: 1 };
  function flipTo(p, n) { p = clamp(p, 0, n - 1); if (p === book.page && book.t >= 1) return false; if (book.t < 1) return false; book.to = p; book.dir = p > book.page ? 1 : -1; book.t = 0; return true; }
  // возвращает { page, k }: k - масштаб страницы по X (1 - полная, 0 - ребро), shade - затемнение
  function flipState(dt) {
    if (book.t < 1) { book.t = Math.min(1, book.t + dt / 0.32); if (book.t >= 0.5 && book.page !== book.to) book.page = book.to; }
    const k = book.t >= 1 ? 1 : Math.abs(1 - 2 * book.t); return { page: book.page, k: Math.max(0.04, k), shade: book.t >= 1 ? 0 : 0.35 * (1 - k), flipping: book.t < 1, dir: book.dir };
  }

  // ---------- растворение вкладок ----------
  const fade = { cv: mkc(WD, HT), has: false, t: 1, rect: null };
  function fadeCapture(src, rect) { const g = fade.cv.getContext('2d'); g.clearRect(0, 0, WD, HT); g.drawImage(src, rect.x, rect.y, rect.w, rect.h, rect.x, rect.y, rect.w, rect.h); fade.rect = rect; fade.t = 0; fade.has = true; }
  function fadeDraw(c, dt) { if (!fade.has) return; fade.t += dt / 0.2; if (fade.t >= 1) { fade.has = false; return; } const r = fade.rect; c.globalAlpha = 1 - fade.t; c.drawImage(fade.cv, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h); c.globalAlpha = 1; }

  // ---------- тряска интерфейса ----------
  const shake = { rect: null, t: 0, modal: 0, gold: 0 };
  function kick(rect) { shake.rect = rect ? { x: rect.x, y: rect.y, w: rect.w, h: rect.h } : null; shake.t = 0.32; shake.modal = 0.22; }
  function kickGold() { shake.gold = 0.4; }
  function shakeTick(dt) { shake.t = Math.max(0, shake.t - dt); shake.modal = Math.max(0, shake.modal - dt); shake.gold = Math.max(0, shake.gold - dt); }
  const shakeAt = (x, y) => { const r = shake.rect; if (!r || shake.t <= 0 || Math.abs(r.x - x) > 2 || Math.abs(r.y - y) > 2) return 0; return Math.round(Math.sin(shake.t * 70) * 2.2 * (shake.t / 0.32)); };
  const modalShake = () => (shake.modal > 0 ? Math.round(Math.sin(shake.modal * 80) * 1.6 * (shake.modal / 0.22)) : 0);
  const goldShake = () => (shake.gold > 0 ? Math.round(Math.sin(shake.gold * 70) * 2 * (shake.gold / 0.4)) : 0);

  // ---------- экран загрузки / занавес с подсказками ----------
  function loader(c, pct, label, tip, t) {
    c.fillStyle = '#0b1020'; c.fillRect(0, 0, WD, HT); for (let i = 0; i < 48; i++) { const x = (i * 83 + Math.floor(t * (8 + (i % 4) * 5))) % WD, y = (i * 47 + Math.floor(t * (14 + (i % 3) * 8))) % HT; c.fillStyle = i % 3 ? '#9fb4d8' : '#ffffff'; c.fillRect(x, y, 1 + (i % 2), 1 + (i % 2)); }
    c.save(); c.scale(3, 3); text(c, 'FROSTFALL', 64, 22, '#eaf5ff', { align: 'c' }); c.restore();
    const bw = 220, bx = Math.round((WD - bw) / 2), by = 118; panel(c, bx - 2, by - 2, bw + 4, 13, { fill: '#10182e' });
    const n = 22, on = Math.floor(clamp(pct, 0, 1) * n); for (let i = 0; i < n; i++) { c.fillStyle = i < on ? (i % 2 ? '#5bc0ff' : '#7fd4ff') : '#1c2748'; c.fillRect(bx + 1 + i * 10, by + 1, 9, 9); }
    text(c, label || '', WD / 2, by + 16, '#9fb4d8', { align: 'c' }); text(c, Math.round(pct * 100) + '%', WD / 2, by + 28, '#ffffff', { align: 'c' });
    if (tip) { text(c, 'Совет', WD / 2, 170, '#ffd24a', { align: 'c' }); wrapT(tip, 280).forEach((l, i) => text(c, l, WD / 2, 183 + i * 11, '#c9d6f0', { align: 'c' })); }
  }
  const cur = { t: 0, on: false, tip: '' };
  function curtain(tip) { cur.on = true; cur.t = 0; cur.tip = tip || X.Tips.random(); }
  function curtainDraw(c, dt) {
    if (!cur.on) return; cur.t += dt; const D = 0.55; if (cur.t > D) { cur.on = false; return; } const k = Math.sin(cur.t / D * Math.PI), a = Math.min(1, k * 1.8);
    c.globalAlpha = a * 0.92; c.fillStyle = '#0b1020'; c.fillRect(0, 0, WD, HT); c.globalAlpha = a; text(c, 'Совет', WD / 2, 88, '#ffd24a', { align: 'c' }); wrapT(cur.tip, 280).forEach((l, i) => text(c, l, WD / 2, 101 + i * 11, '#eaf3ff', { align: 'c' })); c.globalAlpha = 1;
  }

  // ---------- обучение: рамка, стрелка и подсказка ----------
  function tutorial(c, step, H) {
    if (!step) return; const R = X.R; let r = step.target === 'scene' ? { x: 250, y: 84, w: 84, h: 70 } : R[step.target], pulse = 0.5 + 0.5 * Math.sin(T * 6), bob = Math.round(Math.sin(T * 6) * 2);
    const lines = wrapT(step.text, 200), bw = 212, bh = 14 + lines.length * 11 + 16;
    let bx = WD / 2 - bw / 2, by = 56;
    if (r) { c.strokeStyle = '#ffd24a'; c.globalAlpha = 0.5 + 0.5 * pulse; c.lineWidth = 1; c.strokeRect(r.x - 1.5, r.y - 1.5, r.w + 3, r.h + 3); c.strokeRect(r.x - 3.5, r.y - 3.5, r.w + 7, r.h + 7); c.globalAlpha = 1;
      const above = r.y > 110, ax = Math.round(r.x + r.w / 2);
      c.fillStyle = '#ffd24a'; if (above) { const ay = r.y - 10 + bob; for (let i = 0; i < 5; i++) c.fillRect(ax - 4 + i, ay + i, 9 - 2 * i, 1); c.fillRect(ax - 1, ay - 5, 3, 5); by = r.y - 14 - bh - 8; if (by < 20) by = 20; } else { const ay = r.y + r.h + 4 - bob; for (let i = 0; i < 5; i++) c.fillRect(ax - 4 + i, ay + 4 - i, 9 - 2 * i, 1); c.fillRect(ax - 1, ay + 5, 3, 5); by = r.y + r.h + 16; if (by + bh > 184) { by = clamp(r.y + 6, 24, 184 - bh); bx = r.x > bw + 14 ? r.x - bw - 8 : r.x + r.w + 8; } }
      if (bx === WD / 2 - bw / 2) bx = clamp(Math.round(r.x + r.w / 2 - bw / 2), 4, WD - bw - 4); }
    panel(c, bx, by, bw, bh, { fill: '#162038', hi: '#ffd24a' }); text(c, 'Обучение ' + step.n + '/' + step.of, bx + 6, by + 3, '#ffd24a'); lines.forEach((l, i) => text(c, l, bx + 6, by + 14 + i * 11, '#ffffff'));
    H.button(bx + bw - 80, by + bh - 14, 76, 12, 'Пропустить', { dy: -1, fn: H.skip });
  }

  // ---------- HUD: время и погода, индикатор сети ----------
  function wicon(c, kind, night, x, y) {
    if (kind === 'sun' && !night) { c.fillStyle = '#ffd24a'; c.fillRect(x + 1, y + 1, 5, 5); c.fillRect(x + 3, y - 1, 1, 9); c.fillRect(x - 1, y + 3, 9, 1); c.fillStyle = '#fff2a0'; c.fillRect(x + 2, y + 2, 3, 3); }
    else if (night) { c.fillStyle = '#e8ecff'; c.fillRect(x + 1, y, 4, 7); c.fillRect(x, y + 1, 6, 5); c.fillStyle = '#162038'; c.fillRect(x + 3, y + 1, 3, 5); c.fillRect(x + 4, y, 2, 7); }
    else if (kind === 'snow') { c.fillStyle = '#ffffff'; c.fillRect(x + 3, y, 1, 7); c.fillRect(x, y + 3, 7, 1); c.fillRect(x + 1, y + 1, 1, 1); c.fillRect(x + 5, y + 1, 1, 1); c.fillRect(x + 1, y + 5, 1, 1); c.fillRect(x + 5, y + 5, 1, 1); }
    else { c.fillStyle = '#b8d4f0'; c.fillRect(x, y + 1, 7, 1); c.fillRect(x + 2, y + 3, 6, 1); c.fillRect(x, y + 5, 5, 1); c.fillStyle = '#ffffff'; c.fillRect(x + 6, y + 1, 1, 1); c.fillRect(x + 8, y + 3, 1, 1); }
  }
  function timeChip(c, S, x, y) {
    const h = X.Time.hour(S), kind = X.Time.weather(S), night = X.Time.isNight(h), t = X.Time.fmt(h) + ' ' + X.Time.wname(S), w = tw(t) + 20;
    panel(c, x, y, w, 13); wicon(c, kind, night, x + 4, y + 3); text(c, t, x + 15, y + 1, '#eaf5ff'); return w;
  }
  function netDot(c, status, x, y) {
    const col = status === 'online' ? '#4ade80' : status === 'offline' ? '#ff5a5a' : '#8a94b0'; c.fillStyle = '#0c1224'; c.fillRect(x - 1, y - 1, 9, 9); disc(c, x + 3, y + 3, 3, col); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x + 2, y + 1, 1, 1);
    if (status === 'online') { c.globalAlpha = 0.25 + 0.2 * Math.sin(T * 3); ring(c, x + 3, y + 3, 5, col); c.globalAlpha = 1; }
  }

  // ---------- отладка: хитбоксы ----------
  function hitboxes(c, hits, spots, mouse) {
    c.lineWidth = 1; let n = 0;
    for (const h of hits) { n++; c.strokeStyle = h.block ? 'rgba(80,140,255,.8)' : h.can === false ? 'rgba(255,70,70,.9)' : h.rep ? 'rgba(255,220,60,.9)' : 'rgba(60,255,120,.8)'; c.strokeRect(h.x + 0.5, h.y + 0.5, h.w - 1, h.h - 1); }
    text(c, 'хитбоксов ' + n + '  мышь ' + Math.round(mouse.x) + ',' + Math.round(mouse.y), 4, 205, '#ffffff', { sh: '#000' });
  }

  // ---------- джойстик ----------
  function joystick(c, S, Jy, mode) {
    c.globalAlpha = 0.55; disc(c, Jy.bx, Jy.by, Jy.R, '#0c1224'); ring(c, Jy.bx, Jy.by, Jy.R, '#5a7cc0'); ring(c, Jy.bx, Jy.by, Jy.R - 8, '#34508a'); c.globalAlpha = 0.85;
    disc(c, Math.round(Jy.bx + Jy.dx * Jy.R * 0.7), Math.round(Jy.by + Jy.dy * Jy.R * 0.7), 9, Jy.id !== null ? '#7fb0ff' : '#4a6aa8'); c.globalAlpha = 1;
    for (const b of Jy.BTN) { const act = Jy.btnId === b.id; c.globalAlpha = act ? 0.95 : 0.6; disc(c, b.x, b.y, b.r, act ? '#3a8ad8' : '#162038'); ring(c, b.x, b.y, b.r, '#5a7cc0'); c.globalAlpha = 1; text(c, b.id === 'hit' ? 'Удар' : b.id.slice(1), b.x, b.y - 5, '#ffffff', { align: 'c' }); }
    const p = Jy.cur; c.fillStyle = '#ffd24a'; c.fillRect(p.x - 5, p.y, 4, 1); c.fillRect(p.x + 2, p.y, 4, 1); c.fillRect(p.x, p.y - 5, 1, 4); c.fillRect(p.x, p.y + 2, 1, 4); c.fillStyle = '#000'; c.fillRect(p.x, p.y, 1, 1);
  }

  // ---------- процедурные спрайты тайлов для палитры редактора (пункт 294) ----------
  const tcache = new Map(), hexN = (s) => parseInt(String(s).slice(1), 16) || 0;
  function tileSprite(it, sz) {
    sz = sz || 16; const k = it.id + '|' + it.col + '|' + sz; let cv = tcache.get(k); if (cv) return cv; cv = mkc(sz, sz); const g = cv.getContext('2d'), base = String(it.col || '#888888'), n = hexN(base), R = n >> 16 & 255, G = n >> 8 & 255, B = n & 255, sh = (d) => 'rgb(' + clamp(R + d, 0, 255) + ',' + clamp(G + d, 0, 255) + ',' + clamp(B + d, 0, 255) + ')', nm = String(it.name || '').toLowerCase();
    g.fillStyle = base; g.fillRect(0, 0, sz, sz); let s = (n * 2654435761 + (it.id | 0) * 97) >>> 0; const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
    const water = /вод|море|озер|лёд|лед|река/.test(nm), stone = /камен|стен|скал|кирпич|гор/.test(nm), tree = /лес|дерев|ёл|ел|куст/.test(nm), sand = /песок|пустын/.test(nm);
    if (water) { g.fillStyle = sh(30); for (let y = 2; y < sz; y += 5) for (let x = (y % 2) * 3; x < sz; x += 7) g.fillRect(x, y, 3, 1); g.fillStyle = sh(-25); for (let y = 4; y < sz; y += 5) g.fillRect(2, y, sz - 4, 1); }
    else if (stone) { g.fillStyle = sh(-35); for (let y = 0; y < sz; y += 5) { g.fillRect(0, y, sz, 1); for (let x = (y / 5 % 2) * 4; x < sz; x += 8) g.fillRect(x, y, 1, 5); } g.fillStyle = sh(25); g.fillRect(1, 1, 3, 1); }
    else if (tree) { g.fillStyle = sh(-40); g.fillRect(sz / 2 - 1, sz - 5, 2, 5); g.fillStyle = sh(20); for (let r = 0; r < sz - 5; r += 2) { const w = Math.floor((r + 2) * 0.45); g.fillRect(sz / 2 - w, r, w * 2, 2); } }
    else if (sand) { g.fillStyle = sh(22); for (let i = 0; i < sz * 1.2; i++) g.fillRect(Math.floor(rnd() * sz), Math.floor(rnd() * sz), 1, 1); g.fillStyle = sh(-22); for (let i = 0; i < sz; i++) g.fillRect(Math.floor(rnd() * sz), Math.floor(rnd() * sz), 1, 1); }
    else { g.fillStyle = sh(20); for (let i = 0; i < sz; i++) g.fillRect(Math.floor(rnd() * sz), Math.floor(rnd() * sz), 1, 1); g.fillStyle = sh(-24); for (let i = 0; i < sz * 0.8; i++) g.fillRect(Math.floor(rnd() * sz), Math.floor(rnd() * sz), 2, 1); }
    g.fillStyle = sh(-60); g.fillRect(0, sz - 1, sz, 1); g.fillRect(sz - 1, 0, 1, sz); g.fillStyle = sh(40); g.fillRect(0, 0, sz, 1); g.fillRect(0, 0, 1, sz);
    tcache.set(k, cv); if (tcache.size > 300) tcache.delete(tcache.keys().next().value); return cv;
  }

  // ---------- события и покадровое обновление ----------
  function onEvent(e) {
    if (e.t === 'dmg' && !e.quiet) { mb.t = e.skill || e.proc ? 0.3 : e.crit ? 0.22 : 0.09; mb.crit = !!(e.skill || e.proc || e.crit); }
  }
  function tick(dt) { T += dt; mb.t = Math.max(0, mb.t - dt); shakeTick(dt); }

  W.FF.Fxx = { weather, daylight, rays, heat, blur, dissolve, glow, heroAura, sparks, drawSparks, chestOpen, chestDraw, chest, buildings, buildFx, questBanner, questDraw, book, flipTo, flipState, fadeCapture, fadeDraw, kick, kickGold, shakeAt, modalShake, goldShake, loader, curtain, curtainDraw, tutorial, timeChip, netDot, hitboxes, joystick, tileSprite, onEvent, tick, disc, ring, wrapT, get T() { return T; } };
})(window);
