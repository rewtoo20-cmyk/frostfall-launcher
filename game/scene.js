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
      if (zi >= 4 && zi !== 8) { for (let i = 0; i < 70; i++) { g.fillStyle = rnd() > 0.7 ? '#ffffff' : '#a9b8e8'; g.fillRect(Math.floor(rnd() * WD), Math.floor(rnd() * 80), 1, 1); } }
      const sx = zi === 5 ? 300 : zi >= 6 ? 90 + (zi - 6) * 90 : 70 + zi * 40, sy = zi >= 4 ? 40 : 34, sc = zi === 5 ? '#ffd0a0' : zi === 8 ? '#fff6c8' : zi >= 4 ? '#e8ecff' : '#fffbe0';
      g.fillStyle = mix(sc, z.sky[0], 0.5); g.fillRect(sx - 12, sy - 6, 24, 12); g.fillRect(sx - 8, sy - 10, 16, 20); g.fillStyle = sc; g.fillRect(sx - 8, sy - 6, 16, 12); g.fillRect(sx - 5, sy - 8, 10, 16); }
    if (zi === 7) { const g = L.sky[1]; for (const [col, y0, ph] of [['#3affb0', 22, 0], ['#8a6aff', 34, 2], ['#3acfff', 46, 4]]) for (let x = 0; x < WD; x++) { const y = Math.round(y0 + 9 * Math.sin(x / 26 + ph) + 4 * Math.sin(x / 9 + ph * 2)); g.globalAlpha = 0.16; g.fillStyle = col; g.fillRect(x, y, 1, 22); g.globalAlpha = 0.3; g.fillRect(x, y, 1, 3); } g.globalAlpha = 1; }
    // дальние горы
    { const g = L.far[1]; ridge(g, 96, 62, zi === 3 ? 4 : 3, zi, z.hill[0], shade(z.hill[0], 16), zi === 5 || zi === 8 ? null : '#ffffff', zi === 3 ? 90 : 70, 0.1);
      if (zi === 4) { const g2 = g; g2.fillStyle = '#232b52'; for (const [cx, w, h] of [[250, 40, 70], [300, 24, 54], [200, 22, 48]]) { g2.fillRect(cx - w / 2, GY - 10 - h, w, h + 10); for (let k = 0; k < w; k += 8) g2.fillRect(cx - w / 2 + k, GY - 14 - h, 5, 4); g2.fillStyle = '#ffd24a'; g2.fillRect(cx - 2, GY - h + 8, 4, 6); g2.fillStyle = '#232b52'; } }
      if (zi === 5) { g.fillStyle = '#4a1a22'; for (let y = 0; y < 60; y++) { const wv = 18 + Math.round(y * 0.9); g.fillRect(310 - wv, 60 + y, wv * 2, 1); } g.fillStyle = '#ff7a1a'; g.fillRect(300, 56, 20, 5); g.fillStyle = '#ffd24a'; g.fillRect(304, 54, 12, 3); } }
    if (zi === 6) { const g = L.far[1]; for (const [cx, h, w, col] of [[40, 70, 34, '#7a5ac8'], [120, 90, 44, '#6a4ab8'], [210, 76, 36, '#8a6ad8'], [300, 96, 46, '#6a4ab8'], [360, 64, 30, '#7a5ac8']]) for (let r = 0; r < h; r++) { const ww = Math.round(w * (1 - r / h) / 2); g.fillStyle = r % 9 < 2 ? '#c8b0ff' : col; g.fillRect(cx - ww, GY - 10 - r, ww * 2 + 1, 1); } }
    // средний план
    { const g = L.mid[1]; ridge(g, 128, 36, 5, zi * 1.3 + 2, z.hill[1], shade(z.hill[1], 14), zi === 5 || zi === 8 ? null : '#ffffff', 100, 0.15);
      const n = zi === 6 || zi === 8 ? 0 : zi === 1 ? 22 : zi === 3 || zi === 5 ? 6 : 13; for (let i = 0; i < n; i++) { const x = Math.floor(rnd() * WD), h = 22 + Math.floor(rnd() * 22); if (zi === 2 && i > 5) continue; pine(g, x, GY - 8 - Math.floor(rnd() * 8), h, zi === 5 ? '#3a2a30' : zi === 4 ? '#243050' : zi === 7 ? '#1c4a58' : '#2f6a6a', zi === 5 ? '#2a1a22' : zi === 4 ? '#1a2440' : zi === 7 ? '#143a48' : '#235252', '#ffffff'); } }
    if (zi === 6) { const g = L.mid[1]; for (let i = 0; i < 9; i++) { const cx = 14 + i * 44 + Math.floor(rnd() * 16), h = 22 + Math.floor(rnd() * 20), by = GY - 4; for (let r = 0; r < h; r++) { const ww = Math.max(1, Math.round(5 * (1 - r / h)) + (r < 3 ? 1 : 0)); g.fillStyle = r % 7 < 2 ? '#e8dcff' : '#a88af0'; g.fillRect(cx - ww, by - r, ww * 2 + 1, 1); } } }
    if (zi === 8) { const g = L.mid[1]; g.fillStyle = '#d8aa50'; for (let x = 0; x < WD; x++) { const y = Math.round(GY - 12 - 8 * Math.sin(x / 40) - 4 * Math.sin(x / 13)); g.fillRect(x, y, 1, 14); } g.fillStyle = '#f0d890'; for (let x = 0; x < WD; x++) { const y = Math.round(GY - 12 - 8 * Math.sin(x / 40) - 4 * Math.sin(x / 13)); g.fillRect(x, y, 1, 1); } }
    // земля
    { const g = L.ground[1], gc = [['#f6fbff', '#e2f0fb', '#cfe3f3', '#bcd5ea'], ['#e9f3fb', '#d6e8f6', '#c2dbef', '#aecbe4'], ['#bfe6f6', '#a8d8ee', '#92c8e4', '#7db8d8'], ['#d8d9ee', '#c4c6e2', '#b0b3d4', '#9ca0c4'], ['#8a90b8', '#7a80a8', '#6a7098', '#5a6088'], ['#5a3a3e', '#4a2f34', '#3c262a', '#2e1e22'], ['#6a5ab0', '#5a4aa0', '#4a3a8a', '#3a2c70'], ['#6a8aa8', '#5a7a98', '#4a6a88', '#3a5a78'], ['#f0d890', '#e6c878', '#d8b862', '#c8a64e']][zi];
      const top = GY - 2; for (let i = 0; i < 4; i++) { const y0 = top + Math.round((HT - top) * i / 4), y1 = top + Math.round((HT - top) * (i + 1) / 4); g.fillStyle = gc[i]; g.fillRect(0, y0, WD, y1 - y0 + 1); if (i < 3) { g.fillStyle = gc[i + 1]; for (let x = 0; x < WD; x += 2) g.fillRect(x + (y1 % 2), y1 - 1, 1, 1); } }
      for (let x = 0; x < WD; x++) { const dy = Math.round(2 * Math.sin(PI2 * 4 * x / WD) + 1.5 * Math.sin(PI2 * 11 * x / WD)); g.fillStyle = gc[0]; g.fillRect(x, top - 3 + dy, 1, 4); g.fillStyle = zi >= 4 ? gc[1] : '#ffffff'; g.fillRect(x, top - 3 + dy, 1, 1); }
      for (let i = 0; i < 90; i++) { const x = Math.floor(rnd() * WD), y = top + 8 + Math.floor(rnd() * (HT - top - 10)); g.fillStyle = i % 3 ? gc[0] : gc[3]; g.fillRect(x, y, 2 + (i % 3), 1); }
      if (zi === 2) { g.fillStyle = '#e8f8ff'; for (let i = 0; i < 12; i++) { let x = Math.floor(rnd() * WD), y = top + 10 + Math.floor(rnd() * 60); for (let k = 0; k < 8; k++) { g.fillRect(x, y, 2, 1); x += rnd() > 0.5 ? 2 : -2; y += 1; } } }
      if (zi === 4) { g.fillStyle = '#6a7098'; for (let y = top + 6; y < HT; y += 14) g.fillRect(0, y, WD, 1); for (let x = 0; x < WD; x += 28) for (let y = top + 6, r = 0; y < HT; y += 14, r++) g.fillRect(x + (r % 2) * 14, y, 1, 14); }
      if (zi === 5) { for (let i = 0; i < 9; i++) { let x = Math.floor(rnd() * WD), y = top + 8 + Math.floor(rnd() * 50); for (let k = 0; k < 14; k++) { g.fillStyle = k % 3 ? '#ff6a1a' : '#ffd24a'; g.fillRect(x, y, 2, 2); x += rnd() > 0.4 ? 2 : -1; y += rnd() > 0.5 ? 1 : 0; } } } }
    // передний план: сугробы и ёлки по краям
    { const g = L.near[1]; if (zi < 4) { pine(g, 14, HT + 6, 76, '#1f5a5a', '#184848', '#ffffff'); pine(g, 372, HT + 4, 64, '#1f5a5a', '#184848', '#ffffff'); }
      else { g.fillStyle = zi === 4 ? '#3a4068' : zi === 6 ? '#2a2050' : zi === 7 ? '#10243a' : zi === 8 ? '#a8843a' : '#2a181c'; g.fillRect(0, 196, 40, 20); g.fillRect(344, 190, 40, 26); } }
    return L;
  }

  function init(w) { for (let i = 0; i < 110; i++) snow.push({ x: Math.random() * WD, y: Math.random() * HT, d: 1 + (i % 3), s: Math.random() * 6 }); for (let i = 0; i < 6; i++) clouds.push({ x: Math.random() * WD, y: 10 + Math.random() * 50, w: 24 + Math.random() * 30, v: 2 + Math.random() * 4 }); }
  const setLight = (v) => { light = !!v; X().quality = light ? 0.25 : 1; };

  // ---------- события ----------
  const num = W.Core.fmt;
  // Частицы, числа урона, тряска и hit stop живут в FF.fx (пул без аллокаций); без модуля — заглушка (лаунчер)
  const NOFX = { burst() {}, coins() {}, number() { return null; }, hit() {}, flash() {}, bossKill() {}, dust() {}, footprint() {}, shakeOffset: () => [0, 0], drawMarks() {}, draw() {}, vignette() {}, marks: { each() {} }, quality: 1 };
  const X = () => (W.FF && W.FF.fx) || NOFX;
  function addFloat(x, y, t, col, vy, life) { const n = X().number(x, y, t, col); if (n) { if (vy) n.vy = vy; if (life) n.life = n.max = life; } }
  function burst(x, y, n, col, sp) { X().burst(x, y, n, col, sp); }
  // Герой: состояния через SpriteAnimator, слои экипировки через Paperdoll (кэш LRU); без модулей — обычный спрайт
  let hAnim = null, hDoll = null;
  const px = (x, col, X0, Y0, w, h, al) => { x.globalAlpha = al == null ? 1 : al; x.fillStyle = col; x.fillRect(X0, Y0, w, h); x.globalAlpha = 1; };
  const rc = (id) => W.Core.RAR[Math.max(0, Math.min(W.Core.RAR.length - 1, +String(id).slice(1) || 0))].col;
  function heroSprite(S, f, atk, artId) {
    const F = W.FF; if (!F || !F.Paperdoll) return A.hum('hero', f, atk, artId);
    if (!hDoll) hDoll = new F.Paperdoll({
      body: (x, id, fr, ex) => { const q = ex.split(':'); x.drawImage(A.hum('hero', fr, q[0] === '1', q[1] || ''), 0, 0); },
      armor: (x, id) => { const col = rc(id), r = +id.slice(1); px(x, col, 15, 19, 10, 1, 0.9); if (r >= 2) { px(x, col, 12, 17, 3, 2); px(x, col, 25, 17, 3, 2); } if (r >= 3) px(x, '#ffffff', 13, 17, 1, 1, 0.8); },
      cape: (x, id) => { const col = rc(id); px(x, col, 19, 20, 2, 2); px(x, '#ffffff', 19, 20, 1, 1, 0.8); },
      weapon: (x, id) => { const col = rc(id); px(x, col, 26, 10, 1, 5, 0.85); },
      head: (x) => { for (let i = 0; i < 5; i++) px(x, '#ffd24a', 14 + i * 2, i % 2 ? 4 : 3, 1, i % 2 ? 1 : 2); },
    }, 38, 38, 160);
    const e = S.equip, tag = (k, t) => (e[k] ? t + e[k].rar : ''), mx = Math.max(e.weapon ? e.weapon.rar : 0, e.armor ? e.armor.rar : 0, e.amulet ? e.amulet.rar : 0);
    return hDoll.get({ body: 'b', armor: e.armor && e.armor.rar >= 1 ? tag('armor', 'a') : '', cape: e.amulet && e.amulet.rar >= 1 ? tag('amulet', 'c') : '', weapon: e.weapon && e.weapon.rar >= 3 ? tag('weapon', 'w') : '', head: mx >= 4 ? 'h' : '' }, f, (atk ? 1 : 0) + ':' + artId);
  }
  function heroPose(running) {
    const F = W.FF; if (!F || !F.SpriteAnimator) return null; if (!hAnim) hAnim = new F.SpriteAnimator();
    hAnim.update(dt0); hAnim.play(running ? 'walk' : 'idle'); const fr = hAnim.frame(); return { f: fr === 1 ? 1 : 0, atk: fr === 2 || fr === 3 };
  }
  let procFx = null;
  function fx(e, S) {
    const m = S.rt.mon, boss = m && m.boss, my = FEET - (boss ? 40 : 18);
    if (e.t === 'dmg' && !e.quiet) {
      if (e.skill) { if (hAnim) hAnim.play('skill'); addFloat(MX + rr(-8, 8), my - 20, num(e.v), '#7fe0ff', -30); fxStorm = 0.7; X().hit(3); }
      else if (e.proc) { heroAtk = 0.2; procFx = { t: 0.35, col: e.proc.col, id: e.proc.id }; addFloat(MX, my - 34, e.proc.name, e.proc.col, -22); addFloat(MX + rr(-14, 14), my - 6, num(e.v) + '!', '#ffffff', -34); burst(MX, my + 4, 16, e.proc.col, 110); X().hit(4); }
      else { heroAtk = 0.14; if (hAnim) hAnim.play('attack'); addFloat(MX + rr(-22, 22), my - rr(0, 16), num(e.v) + (e.crit ? '!' : ''), e.crit ? '#ffd24a' : '#ffffff'); burst(MX + rr(-8, 8), my + 6, e.crit ? 7 : 3, e.crit ? '#ffd24a' : '#e8f4ff', 60); if (e.crit) X().hit(1.6); }
    } else if (e.t === 'gold') { X().coins(MX + rr(-6, 6), my + 10, light ? 2 : 6, FEET + 2); }
    else if (e.t === 'level') { addFloat(HX, FEET - 56, 'Уровень ' + e.v + '!', '#7dffb0', -20); burst(HX, FEET - 22, 20, '#7dffb0', 90); }
    else if (e.t === 'gems') addFloat(MX - 20, my - 34, '+' + e.v + ' самоцв.', '#ff7ae0', -18);
    else if (e.t === 'zone') X().bossKill();
    else if (e.t === 'fail') { flash = 0.5; X().hit(5); addFloat(WD / 2, 60, 'Босс победил!', '#ff7a7a', -8); }
    else if (e.t === 'evt') { if (e.k === 'reward') { const ex = Math.max(70, Math.min(WD - 70, e.x)); addFloat(ex, Math.max(30, e.y - 8), e.text, e.col, -12, 2.4); burst(e.x, e.y, light ? 6 : 16, e.col, 90); } else if (e.k === 'hit') burst(e.x, e.y, 6, '#ffd24a', 70); }
    else if (e.t === 'skill') { burst(HX, FEET - 22, 14, e.v === 'rain' ? '#ffd24a' : e.v === 'cry' ? '#ff9c2a' : '#7fe0ff', 80); }
  }

  // ---------- кадр ----------
  // аура «Боевого клича»: огненное кольцо под ногами и языки пламени (без прямоугольников)
  let dt0 = 0.016, dustT = 0, stepL = false;
  function rageFx(c, S, dt) {
    if (!(S.buff.cry > 0)) return; const k = 0.6 + 0.4 * Math.sin(T * 8);
    c.globalAlpha = 0.5 * k; c.fillStyle = '#ff7a2a'; c.fillRect(HX - 16, FEET, 32, 1); c.fillRect(HX - 12, FEET + 1, 24, 1); c.globalAlpha = 0.25; c.fillRect(HX - 18, FEET - 1, 36, 3); c.globalAlpha = 1;
    if (Math.random() < (light ? 0.25 : 0.7)) X().burst(HX + rr(-9, 9), FEET - rr(2, 26), 1, Math.random() < 0.5 ? '#ff9c2a' : '#ffd24a', 12, -30, { up: 30, min: 0.35, max: 0.7 });
  }
  // искры вокруг зачарованного клинка
  function bladeFx(c, ar, x, y0, y1) {
    const n = light ? 1 : ar.rar >= 3 ? 4 : ar.rar === 2 ? 3 : 2;
    for (let i = 0; i < n; i++) { const ph = (T * (0.9 + i * 0.31) + i * 1.7) % 1, yy = y1 - ph * (y1 - y0 + 8), xx = x + Math.sin(T * 3 + i * 2) * 4 + (i % 2 ? 3 : -3); c.globalAlpha = Math.max(0, 1 - ph); c.fillStyle = i % 2 ? ar.pal[0] : ar.pal[1]; c.fillRect(Math.round(xx), Math.round(yy), 1 + (i % 2), 1 + (i % 2)); }
    c.globalAlpha = 1;
  }
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
    T += dt; dt0 = dt; heroAtk = Math.max(0, heroAtk - dt); flash = Math.max(0, flash - dt); fxStorm = Math.max(0, fxStorm - dt);
    const rt = S.rt, info = W.Core.stageInfo(S.n), zi = info.zone, m = rt.mon;
    if (zi !== zoneK) { layers = build(zi); zoneK = zi; }
    const running = m && (m.dead || m.t < 0.5); if (running) scr += dt * 40;
    c.save(); { const so = X().shakeOffset(); if (so[0] || so[1]) c.translate(so[0], so[1]); }
    c.drawImage(layers.sky[0], 0, 0);
    for (const k of clouds) { k.x += k.v * dt; if (k.x > WD + 40) k.x = -k.w; const col = zi >= 4 ? 'rgba(160,170,220,.35)' : zi === 5 ? 'rgba(255,180,140,.4)' : 'rgba(255,255,255,.75)'; c.fillStyle = col; c.fillRect(Math.round(k.x), Math.round(k.y), Math.round(k.w), 4); c.fillRect(Math.round(k.x + 4), Math.round(k.y - 3), Math.round(k.w - 12), 3); c.fillRect(Math.round(k.x + 8), Math.round(k.y + 4), Math.round(k.w - 18), 2); }
    wrapDraw(c, layers.far[0], scr, 0.1); wrapDraw(c, layers.mid[0], scr, 0.3); wrapDraw(c, layers.ground[0], scr, 0.0);
    // ёлочки на земле, которые бегут быстрее
    c.drawImage(layers.near[0], 0, 0);
    // снег / искры
    const ember = zi === 5 || zi === 8, ns = light ? 36 : snow.length; c.fillStyle = zi === 8 ? '#fff0b0' : ember ? '#ffb15c' : '#ffffff';
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
    { const pose = heroPose(running), f = pose ? pose.f : running ? Math.floor(T * 9) % 2 : 0, atk = pose ? pose.atk : heroAtk > 0; draws.push({ y: FEET, f: () => { c.fillStyle = 'rgba(20,40,80,.25)'; c.fillRect(HX - 14, FEET - 1, 28, 3); const Lr = W.Core.Lore, eq = Lr && Lr.equipped(S), hs = heroSprite(S, f, atk, eq ? eq.id : ''), hy = FEET + (running && f ? -1 : 0); rageFx(c, S, dt0); if (S.buff.cry > 0 && Math.sin(T * 9) > -0.2) tint(c, hs, HX, hy, '#ff7a2a', 0.38); else drawSpr(c, hs, HX, hy); if (eq && !atk) bladeFx(c, eq, HX + 3, FEET - 44, FEET - 26); } }); }
    draws.sort((a, b) => a.y - b.y).forEach((d) => d.f());

    // красные зоны поражения босса (предупреждение за 1-2 с до удара)
    { const M2 = W.FF && W.FF.Main; if (M2 && M2.zones && M2.zones.length) for (const z of M2.zones) { const k = 1 - z.t / z.max, x0 = Math.round(z.x - z.w / 2); c.globalAlpha = 0.15 + 0.35 * k * (0.6 + 0.4 * Math.sin(T * 18)); c.fillStyle = '#ff2a2a'; c.fillRect(x0, FEET - 2, z.w, 8); c.globalAlpha = 0.9; c.fillRect(x0, FEET - 2, z.w, 1); c.fillRect(x0, FEET + 5, z.w, 1); c.globalAlpha = 1; text(c, '!', Math.round(z.x), FEET - 14, '#ffd24a', { align: 'c' }); } }
    // монстр
    if (m) {
      const boss = m.boss, info2 = info, dead = m.dead, enter = dead ? 0 : Math.max(0, 0.5 - m.t) * 90, f = Math.floor(T * 3 + m.seed * 7) % 2;
      let s; const dcol = info2.type === 'dragon' ? A.DRAGON_FIRE : null; s = A.mon(m.type, f, boss, dcol);
      const y = FEET + 4 + (boss && W.FF && W.FF.Battle ? W.FF.Battle.idleBob(T, m.seed * 9, 2).dy : 0) - (m.type === 'bat' || m.type === 'ghost' ? 14 + Math.round(Math.sin(T * 3 + m.seed * 5) * 3) : 0), x = MX + enter;
      c.fillStyle = m.elite ? 'rgba(255,210,74,.35)' : 'rgba(20,40,80,.25)'; const sw = boss ? 60 : 30; c.fillRect(Math.round(MX - sw / 2 + enter), FEET + 3, sw, 3); if (m.elite) c.fillRect(Math.round(MX - sw / 2 + enter) + 3, FEET + 6, sw - 6, 1);
      if (!dead || m.t < 0.4) { const a = dead ? 1 - m.t / 0.4 : 1;         if (dead) { c.globalAlpha = a; drawSpr(c, s, x, y - Math.round(m.t * 20)); c.globalAlpha = 1; } else if (m.hitT > 0) tint(c, s, x, y, '#ffffff', 0.7); else if (boss && W.FF && W.FF.Main && W.FF.Main.bossTint && Math.sin(T * 9) > -0.3) tint(c, s, x, y, '#ff2a1a', 0.35); else if (boss && Math.sin(T * 5) > 0.6) tint(c, s, x, y, m.aff === 'rage' ? '#ff7a2a' : '#ff3050', 0.22); else if (m.elite && Math.sin(T * 4) > 0.3) tint(c, s, x, y, '#ffd24a', 0.3); else drawSpr(c, s, x, y); }
      if (!dead) {
        const bw = boss ? 76 : 48, bx = Math.round(MX - bw / 2), by = y - s.height - 10;
        text(c, m.name, MX, by - 12, boss ? '#ffb1bd' : m.elite ? '#ffd24a' : '#eaf5ff', { align: 'c' }); if (m.elite) c.drawImage(A.icons.crown, MX - 4, by - 22); if (m.aff) { const BA = W.Core.BAFF.find((q) => q.id === m.aff); if (BA) text(c, BA.name, MX, by + 17, '#ff9c6b', { align: 'c' }); }
        bar(c, bx, by, bw, 7, m.hp / m.max, boss ? '#ff4d6d' : '#e8564f');
        text(c, num(Math.max(0, m.hp)), MX, by + 8, '#ffffff', { align: 'c' });
        if (boss) { text(c, Math.ceil(rt.bossT) + ' с', bx + bw + 6, by - 2, rt.bossT < 8 ? '#ff6b6b' : '#ffffff'); c.drawImage(A.icons.crown, MX - 4, by - 22); }
      }
    }
    drawEvents(c, S);
    if (procFx && procFx.t > 0) { procFx.t -= dt; const k = Math.max(0, procFx.t / 0.35), ar = W.Core.Lore && W.Core.Lore.AID[procFx.id], bolt = procFx.id === 'thunder' || procFx.id === 'eye' || procFx.id === 'heart', by = FEET - (m && m.boss ? 40 : 18);
      c.globalAlpha = Math.min(1, k * 1.6); c.fillStyle = procFx.col;
      if (bolt) { let x = MX + 6, y = 0; while (y < by) { const nx = MX + rr(-9, 9), ny = Math.min(by, y + rr(10, 20)); const steps = Math.ceil(Math.abs(ny - y)); for (let q = 0; q < steps; q++) c.fillRect(Math.round(x + (nx - x) * q / steps), Math.round(y + q), 2, 1); x = nx; y = ny; } c.fillStyle = '#ffffff'; c.fillRect(MX - 1, by - 3, 3, 3); }
      else { const r = Math.round((1 - k) * 30) + 4; c.fillRect(MX - r, by - 1, r * 2, 2); c.fillRect(MX - 1, by - r, 2, r * 2); c.fillRect(MX - Math.round(r * 0.7), by - Math.round(r * 0.7), 2, 2); c.fillRect(MX + Math.round(r * 0.7), by - Math.round(r * 0.7), 2, 2); c.fillRect(MX - Math.round(r * 0.7), by + Math.round(r * 0.7), 2, 2); c.fillRect(MX + Math.round(r * 0.7), by + Math.round(r * 0.7), 2, 2); }
      c.globalAlpha = 1; }
    if (fxStorm > 0) { c.fillStyle = '#9fe8ff'; for (let k = 0; k < 16; k++) { const x = MX - 40 + k * 5 + Math.round(Math.sin(k * 3 + T * 30) * 3), y = ((1 - fxStorm / 0.7) * 260 + k * 22) % 150; c.fillRect(x, y, 2, 6); } }
    // частицы и числа
    { const x = X(); if (running) { dustT -= dt; if (dustT <= 0) { dustT = 0.16; x.dust(HX - 8, FEET + 1, 2); if (!light) x.footprint(HX - 5 + rr(-1, 1), FEET + 3 + (stepL = !stepL ? 1 : 0)); } x.marks.each((mk) => { mk.x -= 40 * dt; }); }
      x.drawMarks(c); x.draw(c, text); const mm = S.rt.mon; x.vignette(c, mm && mm.boss && !mm.dead && S.rt.bossT > 0 && S.rt.bossT < 6 ? 1 - S.rt.bossT / 6 : 0); }
    c.globalAlpha = 1;
    if (procFx && procFx.t > 0) { c.globalAlpha = Math.min(0.22, procFx.t * 0.6); c.fillStyle = procFx.col; c.fillRect(0, 0, WD, HT); c.globalAlpha = 1; }
    if (flash > 0) { c.fillStyle = 'rgba(255,40,40,' + (flash * 0.4).toFixed(2) + ')'; c.fillRect(0, 0, WD, HT); }
    c.restore();
  }
  // ---------- события в походе: золотая снежинка, гоблин, караван ----------
  const FLK = ['....X....', '..X.X.X..', '...XXX...', '.XXXXXXX.', 'XXXXXXXXX', '.XXXXXXX.', '...XXX...', '..X.X.X..', '....X....'];
  function drawEvents(c, S) {
    const E = S.rt.E; if (!E) return;
    for (const o of E.objs) {
      const blink = o.t < 3 && Math.floor(T * 8) % 2; if (blink) continue;
      const x = Math.round(o.x), y = Math.round(o.y);
      if (o.k === 'flake') {
        const pu = Math.sin(T * 6) > 0 ? '#ffd24a' : '#fff2a0';
        c.globalAlpha = 0.28; c.fillStyle = '#ffd24a'; c.fillRect(x - 8, y - 2, 17, 5); c.fillRect(x - 2, y - 8, 5, 17); c.globalAlpha = 1;
        c.fillStyle = '#6b4a10'; for (let r = 0; r < 9; r++) for (let q = 0; q < 9; q++) if (FLK[r][q] === 'X') c.fillRect(x - 5 + q, y - 5 + r, 1, 1);
        c.fillStyle = pu; for (let r = 0; r < 9; r++) for (let q = 0; q < 9; q++) if (FLK[r][q] === 'X') c.fillRect(x - 4 + q, y - 4 + r, 1, 1);
        c.fillStyle = '#fff'; c.fillRect(x - 1, y - 1, 3, 3);
      } else if (o.k === 'goblin') {
        const g = A.mon('goblin', Math.floor(T * 8) % 2, false); drawSpr(c, g, x, y); c.fillStyle = 'rgba(20,40,80,.25)'; c.fillRect(x - 8, FEET + 3, 16, 2);
        c.drawImage(A.icons.coin, x - 4, y - g.height - 8 + Math.round(Math.sin(T * 8)));
      } else {
        c.fillStyle = 'rgba(20,40,80,.25)'; c.fillRect(x - 10, y + 1, 20, 3);
        c.fillStyle = '#0e1428'; c.fillRect(x - 9, y - 12, 18, 14); c.fillStyle = '#8a5a2a'; c.fillRect(x - 8, y - 11, 16, 12); c.fillStyle = '#a8703a'; c.fillRect(x - 8, y - 11, 16, 4);
        c.fillStyle = '#ffd24a'; c.fillRect(x - 8, y - 7, 16, 2); c.fillRect(x - 1, y - 8, 3, 5); c.fillStyle = '#5a3a1a'; c.fillRect(x, y - 6, 1, 2);
        c.globalAlpha = 0.5 + 0.5 * Math.sin(T * 5); c.fillStyle = '#fff'; c.fillRect(x + 5, y - 14, 1, 3); c.fillRect(x + 4, y - 13, 3, 1); c.globalAlpha = 1;
      }
    }
    if (E.bliz > 0) { c.globalAlpha = Math.min(0.35, E.bliz * 0.1); c.fillStyle = '#dfeeff'; c.fillRect(0, 0, WD, HT); c.globalAlpha = 1; c.fillStyle = '#fff'; for (let i = 0; i < (light ? 20 : 60); i++) c.fillRect(Math.round(((T * 260 + i * 53) % (WD + 40)) * -1 + WD + 20 - (i * 7) % 11), Math.round((i * 37 + T * 90) % HT), 3, 1); }
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
