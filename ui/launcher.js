// Интерфейс лаунчера FROSTFALL (пиксельный, на холсте 384x216).
(function () {
  'use strict';
  const W = window, PX = W.PX, A = W.ART, Sc = W.Scene, { text, tw, panel } = PX, COL = PX.COL;
  const cv = document.getElementById('cv'), c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  const big = document.createElement('canvas'), bx = big.getContext('2d'); big.width = 100; big.height = 14;
  let st = { game: '', notes: [], launcher: '', settings: { fullscreen: false, lowpower: false, nogpu: false, autoupdate: true }, upd: { state: 'idle', text: '', progress: 0 } };
  let hits = [], mouse = { x: -1, y: -1 }, showSet = false, last = performance.now(), T = 0, needRestart = false;
  const api = W.api || { state: async () => st, play() {}, update() {}, set: async () => st.settings, min() {}, close() {}, restart() {}, onUpd() {} };

  function hit(x, y, w, h, fn) { hits.push({ x, y, w, h, fn }); return mouse.x >= x && mouse.x < x + w && mouse.y >= y && mouse.y < y + h; }
  function button(x, y, w, h, label, o) {
    o = o || {}; const hv = hit(x, y, w, h, o.fn), can = o.can !== false, fill = o.on ? '#3a8ad8' : !can ? '#262e48' : o.green ? '#2f8f5f' : '#34508a';
    panel(c, x, y, w, h, { fill: hv && can ? PX.shade(fill, 22) : fill, hi: PX.shade(fill, 50), lo: PX.shade(fill, -40) });
    text(c, label, x + w / 2, y + Math.round((h - 11) / 2) - 1, can ? '#fff' : '#7a86a6', { align: 'c' }); return hv;
  }
  const G = { F: ['#####', '#....', '####.', '#....', '#....', '#....', '#....'], R: ['####.', '#...#', '#...#', '####.', '#..#.', '#...#', '#...#'], O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'], T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'], A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'] };
  function title(s, x, y, k) { // крупный пиксельный заголовок из своих букв
    const w = s.length * 6 - 1; let ox = Math.round(x - w * k / 2);
    for (const ch of s) { const g = G[ch]; for (let j = 0; j < 7; j++) for (let i = 0; i < 5; i++) if (g[j][i] === '#') { const px = ox + i * k, py = y + j * k; c.fillStyle = '#1c3a8a'; c.fillRect(px + k * 0.6, py + k * 0.6, k, k); c.fillStyle = j < 3 ? '#ffffff' : j < 5 ? '#cfeaff' : '#8fd0ff'; c.fillRect(px, py, k, k); } ox += 6 * k; }
  }
  function toggle(x, y, label, val, fn) { button(x, y, 150, 15, '', { fn }); panel(c, x + 132, y + 2, 13, 11, { fill: '#10182e' }); if (val) { c.fillStyle = '#5fe08a'; c.fillRect(x + 135, y + 5, 7, 5); } text(c, label, x + 5, y + 2, '#fff'); }

  function draw(dt) {
    T += dt; hits = [];
    Sc.backdrop(c, dt, 0);
    // персонажи
    const f = Math.floor(T * 2) % 2;
    Sc.drawSpr(c, A.hum('hero', 0, false), 86, 160); Sc.drawSpr(c, A.hum(2, 0, false), 58, 168); Sc.drawSpr(c, A.hum(3, 0, false), 40, 156); Sc.drawSpr(c, A.hum('skadi', 0, false), 118, 170);
    Sc.drawSpr(c, A.allyDragon(f), 330, 100 + Math.round(Math.sin(T * 2) * 3)); Sc.drawSpr(c, A.mon('snowman', f, false), 214, 184);
    Sc.snowfall(c, dt);
    // заголовок
    panel(c, 48, 10, 288, 80, { fill: '#10182e', hi: '#5bc0ff' }); title('FROSTFALL', 192, 22, 5); text(c, 'Зимняя пиксельная RPG', 192, 74, '#9fd8ff', { align: 'c' });
    // кнопки
    const u = st.upd, busy = u.state === 'check' || u.state === 'load';
    button(132, 98, 120, 26, 'ИГРАТЬ', { green: true, fn: () => api.play() });
    button(132, 130, 58, 15, 'Обновить', { can: !busy, fn: () => api.update() }); button(194, 130, 58, 15, 'Настройки', { on: showSet, fn: () => { showSet = !showSet; } });
    // статус внизу
    panel(c, 4, 196, 376, 16, { fill: '#162038' }); text(c, 'Игра ' + st.game + '  ·  Лаунчер ' + st.launcher, 10, 198, COL.mut);
    if (u.text) text(c, u.text, 376, 198, u.state === 'err' ? '#ff9c8a' : u.state === 'ok' ? '#5fe08a' : '#ffd24a', { align: 'r' });
    if (u.state === 'load') { c.fillStyle = '#0c1224'; c.fillRect(132, 150, 120, 5); c.fillStyle = '#5bc0ff'; c.fillRect(133, 151, Math.round(118 * u.progress), 3); }
    // что нового
    if (st.notes && st.notes.length && !showSet) { const h = 20 + st.notes.length * 11; panel(c, 256, 124, 124, h); text(c, 'Что нового', 262, 128, '#5bc0ff'); st.notes.slice(0, 5).forEach((n, i) => text(c, PX.fit(n, 112), 262, 140 + i * 11, '#eaf3ff')); }
    if (showSet) {
      panel(c, 100, 60, 184, 126, { fill: '#162038', hi: '#5bc0ff' }); text(c, 'Настройки', 192, 65, '#5bc0ff', { align: 'c' });
      const s = st.settings, set = (k) => async () => { st.settings = await api.set(k, !s[k]); if (k === 'nogpu') needRestart = true; };
      toggle(117, 82, 'Полный экран', s.fullscreen, set('fullscreen')); toggle(117, 100, 'Экономный режим', s.lowpower, set('lowpower')); toggle(117, 118, 'Без видеокарты', s.nogpu, set('nogpu')); toggle(117, 136, 'Автообновление', s.autoupdate, set('autoupdate'));
      text(c, needRestart ? 'Нужен перезапуск лаунчера' : 'F11 в игре: полный экран', 192, 157, needRestart ? '#ffd24a' : COL.mut, { align: 'c' });
      if (needRestart) button(142, 169, 100, 14, 'Перезапустить', { green: true, fn: () => api.restart() }); else button(142, 169, 100, 14, 'Закрыть', { fn: () => { showSet = false; } });
    }
    c.fillStyle = 'rgba(0,0,0,.0)';
  }
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * 384 / r.width, y: (e.clientY - r.top) * 216 / r.height }; };
  cv.addEventListener('pointermove', (e) => { mouse = pos(e); cv.style.cursor = hits.some((h) => mouse.x >= h.x && mouse.x < h.x + h.w && mouse.y >= h.y && mouse.y < h.y + h.h) ? 'pointer' : 'default'; });
  cv.addEventListener('pointerdown', (e) => { mouse = pos(e); for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (mouse.x >= h.x && mouse.x < h.x + h.w && mouse.y >= h.y && mouse.y < h.y + h.h) { h.fn && h.fn(); return; } } });
  document.getElementById('wm').onclick = () => api.min(); document.getElementById('wc').onclick = () => api.close();
  addEventListener('keydown', (e) => { if (e.key === 'Enter') api.play(); if (e.key === 'Escape') showSet = false; });
  api.onUpd((u) => { st.upd = u; if (u.state === 'ok') api.state().then((s) => { if (s) { st.game = s.game; st.notes = s.notes; } }); });
  function loop(now) { requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000); last = now; draw(dt); }
  api.state().then((s) => { if (s) st = s; Sc.init(); last = performance.now(); requestAnimationFrame(loop); });
})();
