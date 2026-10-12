// Сцена боя: слои фона по зонам, герой, союзники, монстры, эффекты. Размер мира 384x216.
(function (W) {
  'use strict';
  const { text, tw, panel, bar, COL, hex, rgb, shade, mix } = W.PX, A = W.ART;
  const WD = 384, HT = 216, GY = 138, FEET = 152, HX = 108, MX = 292;
  let snow = [], parts = [], floats = [], clouds = [], T = 0, scr = 0, heroAtk = 0, shake = 0, flash = 0, light = false, zoneK = -1, layers = null, fxStorm = 0, hitFlash = 0;
  const tmp = document.createElement('canvas'), tx = tmp.getContext('2d');
  let seed = 1; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; const rr = (a, b) => a + Math.random() * (b - a);

  // ---------- фон ----------
  const PI2 = Math.PI * 2;
  function mk() { const c = document.createElement('canvas'); c.width = WD; c.height = HT; const x = c.getContext('2d'); return [c, x]; }
  function pine(g, x, y, h, c1, c2, snowc) { // ёлка из ярусов, y = низ ствола
    const tiers = Math.max(3, Math.round(h / 8)), tw2 = Math.round(h * 0.17);
    g.fillStyle = '#4a3220'; g.fillRect(x - 1, y - 3, 3, 4);
    for (let t = 0; t < tiers; t++) {
      const ty = y - 3 - Math.round((h - 3) * (t / tiers)), th = Math.round(h / tiers) + 4, wmax = Math.round(h * 0.42 * (1 - t / (tiers + 1.2))) + 3;
      for (let r = 0; r < th; r++) { const wr = Math.max(1, Math.round(wmax * (r + 1) / th)), yy = ty - th + r + 1; g.fillStyle = r < 2 ? snowc : (x + r) % 2 ? c1 : c2; g.fillRect(x - wr, yy, wr * 2 + 1, 1); if (r >= 2 && r < th - 1) { g.fillStyle = snowc; g.fillRect(x - wr + ((r * 3 + t) % 3), yy, 2, 1); } }
    }
  }
  function ridge(g, base, amp, per, ph, col, light2, capCol, capY, jag) {
    for (let x = 0; x < WD; x++) {
      const a = Math.sin(PI2 * per * x / WD + ph), b = Math.sin(PI2 * per * 2 * x / WD + ph * 2.3), c2 = Math.sin(PI2 * per * 5 * x / WD + ph * 1.7);
      const y = Math.round(base - amp * (0.55 + 0.3 * a + 0.2 * b + (jag || 0.08) * c2));
      const a2 = Math.sin(PI2 * per * (x + 1) / WD + ph), slope = y > Math.round(base - amp * (0.55 + 0.3 * a2 + 0.2 * Math.sin(PI2 * per * 2 * (x + 1) / WD + ph * 2.3) + (jag || 0.08) * Math.sin(PI2 * per * 5 * (x + 1) / WD + ph * 1.7)));
      g.fillStyle = slope ? light2 : col; g.fillRect(x, y, 1, HT - y);
      if (capCol && y < capY) { g.fillStyle = capCol; g.fillRect(x, y, 1, Math.min(capY - y, 4 + (x % 3))); }
    }
  }
  function build(zi) {
    const z = W.Core.ZONES[zi]; seed = 77 + zi * 31;
    const L = { sky: mk(), far: mk(), mid: mk(), near: mk(), ground: mk() };
    // небо полосами
    { const g = L.sky[1], b0 = hex(z.sky[0]), b1 = hex(z.sky[1]), n = 12, hh = GY - 10;
      for (let i = 0; i < n; i++) { const t = i / (n - 1), y0 = Math.round(hh * i / n), y1 = Math.round(hh * (i + 1) / n); g.fillStyle = rgb(b0.map((v, k) => v + (b1[k] - v) * t)); g.fillRect(0, y0, WD, y1 - y0 + 1);
        if (i < n - 1) { const t2 = (i + 0.5) / (n - 1); g.fillStyle = rgb(b0.map((v, k) => v + (b1[k] - v) * t2)); for (let x = 0; x < WD; x += 2) g.fillRect(x + (y1 % 2), y1, 1, 1); } }
      g.fillStyle = z.sky[1]; g.fillRect(0, hh, WD, HT - hh);
      if (zi >= 4) { for (let i = 0; i < 70; i++) { g.fillStyle = rnd() > 0.7 ? '#ffffff' : '#a9b8e8'; g.fillRect(Math.floor(rnd() * WD), Math.floor(rnd() * 80), 1, 1); } }
      const sx = zi === 5 ? 300 : 70 + zi * 40, sy = zi >= 4 ? 40 : 34, sc = zi === 5 ? '#ffd0a0' : zi >= 4 ? '#e8ecff' : '#fffbe0';
      g.fillStyle = mix(sc, z.sky[0], 0.5); g.fillRect(sx - 12, sy - 6, 24, 12); g.fillRect(sx - 8, sy - 10, 16, 20); g.fillStyle = sc; g.fillRect(sx - 8, sy - 6, 16, 12); g.fillRect(sx - 5, sy - 8, 10, 16); }
    // дальние горы
    { const g = L.far[1]; ridge(g, 96, 62, zi === 3 ? 4 : 3, zi, z.hill[0], shade(z.hill[0], 16), zi === 5 ? null : '#ffffff', zi === 3 ? 90 : 70, 0.1);
      if (zi === 4) { const g2 = g; g2.fillStyle = '#232b52'; for (const [cx, w, h] of [[250, 40, 70], [300, 24, 54], [200, 22, 48]]) { g2.fillRect(cx - w / 2, GY - 10 - h, w, h + 10); for (let k = 0; k < w; k += 8) g2.fillRect(cx - w / 2 + k, GY - 14 - h, 5, 4); g2.fillStyle = '#ffd24a'; g2.fillRect(cx - 2, GY - h + 8, 4, 6); g2.fillStyle = '#232b52'; } }
      if (zi === 5) { g.fillStyle = '#4a1a22'; for (let y = 0; y < 60; y++) { const wv = 18 + Math.round(y * 0.9); g.fillRect(310 - wv, 60 + y, wv * 2, 1); } g.fillStyle = '#ff7a1a'; g.fillRect(300, 56, 20, 5); g.fillStyle = '#ffd24a'; g.fillRect(304, 54, 12, 3); } }
    // средний план
    { const g = L.mid[1]; ridge(g, 128, 36, 5, zi * 1.3 + 2, z.hill[1], shade(z.hill[1], 14), zi === 5 ? null : '#ffffff', 100, 0.15);
      const n = zi === 1 ? 22 : zi === 3 || zi === 5 ? 6 : 13; for (let i = 0; i < n; i++) { const x = Math.floor(rnd() * WD), h = 22 + Math.floor(rnd() * 22); if (zi === 2 && i > 5) continue; pine(g, x, GY - 8 - Math.floor(rnd() * 8), h, zi === 5 ? '#3a2a30' : zi === 4 ? '#243050' : '#2f6a6a', zi === 5 ? '#2a1a22' : zi === 4 ? '#1a2440' : '#235252', '#ffffff'); } }
    // земля
    { const g = L.ground[1], gc = [['#f6fbff', '#e2f0fb', '#cfe3f3', '#bcd5ea'], ['#e9f3fb', '#d6e8f6', '#c2dbef', '#aecbe4'], ['#bfe6f6', '#a8d8ee', '#92c8e4', '#7db8d8'], ['#d8d9ee', '#c4c6e2', '#b0b3d4', '#9ca0c4'], ['#8a90b8', '#7a80a8', '#6a7098', '#5a6088'], ['#5a3a3e', '#4a2f34', '#3c262a', '#2e1e22']][zi];
      const top = GY - 2; for (let i = 0; i < 4; i++) { const y0 = top + Math.round((HT - top) * i / 4), y1 = top + Math.round((HT - top) * (i + 1) / 4); g.fillStyle = gc[i]; g.fillRect(0, y0, WD, y1 - y0 + 1); if (i < 3) { g.fillStyle = gc[i + 1]; for (let x = 0; x < WD; x += 2) g.fillRect(x + (y1 % 2), y1 - 1, 1, 1); } }
      for (let x = 0; x < WD; x++) { const dy = Math.round(2 * Math.sin(PI2 * 4 * x / WD) + 1.5 * Math.sin(PI2 * 11 * x / WD)); g.fillStyle = gc[0]; g.fillRect(x, top - 3 + dy, 1, 4); g.fillStyle = zi >= 4 ? gc[1] : '#ffffff'; g.fillRect(x, top - 3 + dy, 1, 1); }
      for (let i = 0; i < 90; i++) { const x = Math.floor(rnd() * WD), y = top + 8 + Math.floor(rnd() * (HT - top - 10)); g.fillStyle = i % 3 ? gc[0] : gc[3]; g.fillRect(x, y, 2 + (i % 3), 1); }
      if (zi === 2) { g.fillStyle = '#e8f8ff'; for (let i = 0; i < 12; i++) { let x = Math.floor(rnd() * WD), y = top + 10 + Math.floor(rnd() * 60); for (let k = 0; k < 8; k++) { g.fillRect(x, y, 2, 1); x += rnd() > 0.5 ? 2 : -2; y += 1; } } }
      if (zi === 4) { g.fillStyle = '#6a7098'; for (let y = top + 6; y < HT; y += 14) g.fillRect(0, y, WD, 1); for (let x = 0; x < WD; x += 28) for (let y = top + 6, r = 0; y < HT; y += 14, r++) g.fillRect(x + (r % 2) * 14, y, 1, 14); }
      if (zi === 5) { for (let i = 0; i < 9; i++) { let x = Math.floor(rnd() * WD), y = top + 8 + Math.floor(rnd() * 50); for (let k = 0; k < 14; k++) { g.fillStyle = k % 3 ? '#ff6a1a' : '#ffd24a'; g.fillRect(x, y, 2, 2); x += rnd() > 0.4 ? 2 : -1; y += rnd() > 0.5 ? 1 : 0; } } } }
    // передний план: сугробы и ёлки по краям
    { const g = L.near[1]; if (zi < 4) { pine(g, 14, HT + 6, 76, '#1f5a5a', '#184848', '#ffffff'); pine(g, 372, HT + 4, 64, '#1f5a5a', '#184848', '#ffffff'); }
      else { g.fillStyle = zi === 4 ? '#3a4068' : '#2a181c'; g.fillRect(0, 196, 40, 20); g.fillRect(344, 190, 40, 26); } }
    return L;
  }

  function init(w) { for (let i = 0; i < 110; i++) snow.push({ x: Math.random() * WD, y: Math.random() * HT, d: 1 + (i % 3), s: Math.random() * 6 }); for (let i = 0; i < 6; i++) clouds.push({ x: Math.random() * WD, y: 10 + Math.random() * 50, w: 24 + Math.random() * 30, v: 2 + Math.random() * 4 }); }
  const setLight = (v) => { light = !!v; };

  // ---------- события ----------
  const num = W.Core.fmt;
  function addFloat(x, y, t, col, vy) { if (floats.length < (light ? 8 : 18)) floats.push({ x, y, t, col, vy: vy || -26, life: 1 }); }
  function burst(x, y, n, col, sp) { if (light) n = Math.ceil(n / 3); for (let i = 0; i < n && parts.length < 80; i++) { const a = rr(0, PI2), v = rr(15, sp || 70); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: rr(0.4, 0.9), col, s: Math.random() > 0.6 ? 2 : 1 }); } }
  function fx(e, S) {
    const m = S.rt.mon, boss = m && m.boss, my = FEET - (boss ? 40 : 18);
    if (e.t === 'dmg' && !e.quiet) {
      if (e.skill) { addFloat(MX + rr(-8, 8), my - 20, num(e.v), '#7fe0ff', -30); fxStorm = 0.7; shake = 3; }
      else { heroAtk = 0.14; addFloat(MX + rr(-22, 22), my - rr(0, 16), num(e.v) + (e.crit ? '!' : ''), e.crit ? '#ffd24a' : '#ffffff'); burst(MX + rr(-8, 8), my + 6, e.crit ? 7 : 3, e.crit ? '#ffd24a' : '#e8f4ff', 60); if (e.crit) shake = 2; }
    } else if (e.t === 'gold') { for (let i = 0; i < (light ? 2 : 6); i++) parts.push({ x: MX + rr(-6, 6), y: my + 10, vx: rr(-40, 40), vy: rr(-110, -50), life: 1.2, col: '#ffd24a', s: 2, g: 260, coin: 1 }); }
    else if (e.t === 'level') { addFloat(HX, FEET - 56, 'Уровень ' + e.v + '!', '#7dffb0', -20); burst(HX, FEET - 22, 20, '#7dffb0', 90); }
    else if (e.t === 'gems') addFloat(MX - 20, my - 34, '+' + e.v + ' самоцв.', '#ff7ae0', -18);
    else if (e.t === 'fail') { flash = 0.5; addFloat(WD / 2, 60, 'Босс победил!', '#ff7a7a', -8); }
    else if (e.t === 'skill') { burst(HX, FEET - 22, 14, e.v === 'rain' ? '#ffd24a' : e.v === 'cry' ? '#ff9c2a' : '#7fe0ff', 80); }
  }

  // ---------- кадр ----------
  function drawSpr(c, s, x, y, o) { // якорь: низ по центру
    o = o || {}; c.globalAlpha = o.a == null ? 1 : o.a; c.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height + 1)); c.globalAlpha = 1;
  }
  function tint(c, s, x, y, col, a) {
    if (tmp.width !== s.width || tmp.height !== s.height) { tmp.width = s.width; tmp.height = s.height; }
    tx.clearRect(0, 0, tmp.width, tmp.height); tx.globalCompositeOperation = 'source-over'; tx.drawImage(s, 0, 0); tx.globalCompositeOperation = 'source-atop'; tx.globalAlpha = a; tx.fillStyle = col; tx.fillRect(0, 0, tmp.width, tmp.height); tx.globalAlpha = 1; tx.globalCompositeOperation = 'source-over';
    c.drawImage(tmp, Math.round(x - s.width / 2), Math.round(y - s.height + 1));
  }
  function wrapDraw(c, cv, off, par) { const o = Math.round(((off * par) % WD + WD) % WD); c.drawImage(cv, -o, 0); c.drawImage(cv, WD - o, 0); }

  function frame(c, S, dt) {
    T += dt; heroAtk = Math.max(0, heroAtk - dt); shake = Math.max(0, shake - dt * 10); flash = Math.max(0, flash - dt); fxStorm = Math.max(0, fxStorm - dt);
    const rt = S.rt, info = W.Core.stageInfo(S.n), zi = info.zone, m = rt.mon;
    if (zi !== zoneK) { layers = build(zi); zoneK = zi; }
    const running = m && (m.dead || m.t < 0.5); if (running) scr += dt * 40;
    c.save(); if (shake > 0.3) c.translate(Math.round(rr(-shake, shake)), Math.round(rr(-shake, shake)));
    c.drawImage(layers.sky[0], 0, 0);
    for (const k of clouds) { k.x += k.v * dt; if (k.x > WD + 40) k.x = -k.w; const col = zi >= 4 ? 'rgba(160,170,220,.35)' : zi === 5 ? 'rgba(255,180,140,.4)' : 'rgba(255,255,255,.75)'; c.fillStyle = col; c.fillRect(Math.round(k.x), Math.round(k.y), Math.round(k.w), 4); c.fillRect(Math.round(k.x + 4), Math.round(k.y - 3), Math.round(k.w - 12), 3); c.fillRect(Math.round(k.x + 8), Math.round(k.y + 4), Math.round(k.w - 18), 2); }
    wrapDraw(c, layers.far[0], scr, 0.1); wrapDraw(c, layers.mid[0], scr, 0.3); wrapDraw(c, layers.ground[0], scr, 0.0);
    // ёлочки на земле, которые бегут быстрее
    c.drawImage(layers.near[0], 0, 0);
    // снег / искры
    const ember = zi === 5, ns = light ? 36 : snow.length; c.fillStyle = ember ? '#ffb15c' : '#ffffff';
    for (let i = 0; i < ns; i++) { const p = snow[i]; p.y += (ember ? -14 : 14 + p.d * 8) * dt; p.x += Math.sin(T * 0.8 + p.s) * 6 * dt - (running ? 20 * dt : 0); if (p.y > HT) p.y = -2; if (p.y < -2) p.y = HT; if (p.x < 0) p.x = WD; if (p.x > WD) p.x = 0; c.globalAlpha = p.d === 1 ? 0.6 : 1; c.fillRect(Math.round(p.x), Math.round(p.y), p.d === 3 ? 2 : 1, p.d === 3 ? 2 : 1); }
    c.globalAlpha = 1;

    // союзники и герой (сортировка по y)
    const draws = [];
    S.allies.forEach((lv, i) => {
      if (lv <= 0) return;
      if (i === 7) { const fl = Math.floor(T * 5 + i) % 2, y = FEET - 46 + Math.round(Math.sin(T * 2) * 3); draws.push({ y: 0, f: () => { const s = A.allyDragon(fl); drawSpr(c, s, 66, y); } }); return; }
      const col = i % 4, row = i < 4 ? 0 : 1, x = 18 + col * 21 + row * 10, y = FEET - 16 + row * 22 + (col % 2) * 5;
      const atk = Math.floor(T * 1.7 + i * 0.37) % 2 === 1 && !!(m && !m.dead), f = running ? Math.floor(T * 7 + i) % 2 : 0, bob = running ? 0 : (Math.floor(T * 2 + i) % 2 ? 0 : 0);
      draws.push({ y, f: () => drawSpr(c, A.hum(i, f, atk), x, y + bob) });
    });
    (S.city ? S.city.squad : []).forEach((id, i) => { const x = 62 + i * 22, y = FEET + 10 + (i % 2) * 8, f = running ? Math.floor(T * 7 + i) % 2 : 0, atk = Math.floor(T * 1.9 + i * 0.5) % 2 === 1 && !!(m && !m.dead); draws.push({ y, f: () => drawSpr(c, A.hum(id, f, atk), x, y) }); });
    { const f = running ? Math.floor(T * 9) % 2 : 0, atk = heroAtk > 0; draws.push({ y: FEET, f: () => { c.fillStyle = 'rgba(20,40,80,.25)'; c.fillRect(HX - 14, FEET - 1, 28, 3); if (S.buff.cry > 0) { c.fillStyle = 'rgba(255,156,42,.35)'; c.fillRect(HX - 14, FEET - 52, 28, 52); } drawSpr(c, A.hum('hero', f, atk), HX, FEET + (running && f ? -1 : 0)); } }); }
    draws.sort((a, b) => a.y - b.y).forEach((d) => d.f());

    // монстр
    if (m) {
      const boss = m.boss, info2 = info, dead = m.dead, enter = dead ? 0 : Math.max(0, 0.5 - m.t) * 90, f = Math.floor(T * 3 + m.seed * 7) % 2;
      let s; const dcol = info2.type === 'dragon' ? A.DRAGON_FIRE : null; s = A.mon(m.type, f, boss, dcol);
      const y = FEET + 4 - (m.type === 'bat' || m.type === 'ghost' ? 14 + Math.round(Math.sin(T * 3 + m.seed * 5) * 3) : 0), x = MX + enter;
      c.fillStyle = 'rgba(20,40,80,.25)'; const sw = boss ? 60 : 30; c.fillRect(Math.round(MX - sw / 2 + enter), FEET + 3, sw, 3);
      if (!dead || m.t < 0.4) { const a = dead ? 1 - m.t / 0.4 : 1;         if (dead) { c.globalAlpha = a; drawSpr(c, s, x, y - Math.round(m.t * 20)); c.globalAlpha = 1; } else if (m.hitT > 0) tint(c, s, x, y, '#ffffff', 0.7); else if (boss && Math.sin(T * 5) > 0.6) tint(c, s, x, y, '#ff3050', 0.22); else drawSpr(c, s, x, y); }
      if (!dead) {
        const bw = boss ? 76 : 48, bx = Math.round(MX - bw / 2), by = y - s.height - 10;
        text(c, m.name, MX, by - 12, boss ? '#ffb1bd' : '#eaf5ff', { align: 'c' });
        bar(c, bx, by, bw, 7, m.hp / m.max, boss ? '#ff4d6d' : '#e8564f');
        text(c, num(Math.max(0, m.hp)), MX, by + 8, '#ffffff', { align: 'c' });
        if (boss) { text(c, Math.ceil(rt.bossT) + ' с', bx + bw + 6, by - 2, rt.bossT < 8 ? '#ff6b6b' : '#ffffff'); c.drawImage(A.icons.crown, MX - 4, by - 22); }
      }
    }
    if (fxStorm > 0) { c.fillStyle = '#9fe8ff'; for (let k = 0; k < 16; k++) { const x = MX - 40 + k * 5 + Math.round(Math.sin(k * 3 + T * 30) * 3), y = ((1 - fxStorm / 0.7) * 260 + k * 22) % 150; c.fillRect(x, y, 2, 6); } }
    // частицы и числа
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += (p.g || 160) * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.coin && p.y > FEET + 2) { p.y = FEET + 2; p.vy *= -0.4; p.vx *= 0.6; } c.fillStyle = p.col; c.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }
    for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.life -= dt * 0.9; if (f.life <= 0) { floats.splice(i, 1); continue; } f.y += f.vy * dt; c.globalAlpha = Math.min(1, f.life * 2); text(c, f.t, f.x, f.y, f.col, { align: 'c' }); }
    c.globalAlpha = 1;
    if (flash > 0) { c.fillStyle = 'rgba(255,40,40,' + (flash * 0.4).toFixed(2) + ')'; c.fillRect(0, 0, WD, HT); }
    c.restore();
  }
  function backdrop(c, dt, zi) { // фон без персонажей (для столицы)
    T += dt; if (zi !== zoneK) { layers = build(zi); zoneK = zi; }
    c.drawImage(layers.sky[0], 0, 0);
    for (const k of clouds) { k.x += k.v * dt; if (k.x > WD + 40) k.x = -k.w; c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(Math.round(k.x), Math.round(k.y), Math.round(k.w), 4); c.fillRect(Math.round(k.x + 4), Math.round(k.y - 3), Math.round(k.w - 12), 3); }
    c.drawImage(layers.far[0], 0, 0); c.drawImage(layers.mid[0], 0, 0); c.drawImage(layers.ground[0], 0, 0);
  }
  function snowfall(c, dt) { c.fillStyle = '#ffffff'; const ns = light ? 36 : snow.length; for (let i = 0; i < ns; i++) { const p = snow[i]; p.y += (14 + p.d * 8) * dt; p.x += Math.sin(T * 0.8 + p.s) * 6 * dt; if (p.y > HT) p.y = -2; if (p.x < 0) p.x = WD; if (p.x > WD) p.x = 0; c.globalAlpha = p.d === 1 ? 0.6 : 1; c.fillRect(Math.round(p.x), Math.round(p.y), p.d === 3 ? 2 : 1, p.d === 3 ? 2 : 1); } c.globalAlpha = 1; }
  W.Scene = { backdrop, snowfall, drawSpr, init, frame, fx, setLight, WD, HT, GY, FEET };
})(window);
