// FROSTFALL: Pool (без аллокаций в бою) и Fx: частицы, числа урона, тряска, hit stop, пыль, следы, вспышки, ограничитель по FPS.
(function (root) {
  'use strict';
  const FF = root.FF = root.FF || {};
  const rr = (a, b) => a + Math.random() * (b - a);

  // Живые объекты лежат в [0..live). Взять = O(1), вернуть = swap с последним живым = O(1).
  class Pool {
    constructor(n, make) { this.items = Array.from({ length: n }, make); this.live = 0; this.peak = 0; this.dropped = 0; }
    get cap() { return this.items.length; }
    spawn() { if (this.live >= this.items.length) { this.dropped++; return null; } const o = this.items[this.live++]; if (this.live > this.peak) this.peak = this.live; return o; }
    // fn(o) вернёт false -> объект умер
    update(fn) { const a = this.items; for (let i = this.live - 1; i >= 0; i--) { if (fn(a[i]) === false) { const last = --this.live, t = a[i]; a[i] = a[last]; a[last] = t; } } }
    each(fn) { for (let i = 0; i < this.live; i++) fn(this.items[i]); }
    clear() { this.live = 0; }
    resizeCap(n) { n = Math.max(1, Math.floor(n)); this.limit = n; }
  }

  // виды чисел: цвет по смыслу
  const KIND = { hit: '#ffffff', crit: '#ffd24a', heal: '#7dffb0', block: '#9fb4d8', skill: '#7fe0ff', gold: '#ffd24a', info: '#eaf5ff' };

  class Fx {
    constructor(opts) {
      opts = opts || {};
      this.parts = new Pool(opts.parts || 400, () => ({ x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 0, max: 0, col: '#fff', s: 1, bounce: 0, floor: 0, kind: 0 }));
      this.nums = new Pool(opts.nums || 32, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, t: '', col: '#fff', scale: 1 }));
      this.marks = new Pool(opts.marks || 64, () => ({ x: 0, y: 0, life: 0, max: 1, w: 2, col: 'rgba(20,40,80,.35)' })); // следы на снегу
      this.shake = 0; this.stop = 0; this.flashT = 0; this.flashCol = '#fff'; this.pulseT = 0;
      this.quality = 1;       // 1 = полный, 0.5 = половина частиц, 0.25 = минимум
      this.maxParts = this.parts.cap; this.fpsAvg = 60; this.lowT = 0; this.highT = 0; this.maxShake = 8;
    }
    // ---- частицы ----
    burst(x, y, n, col, speed, g, o) {
      o = o || {}; n = Math.ceil(n * this.quality);
      for (let i = 0; i < n; i++) {
        if (this.parts.live >= this.maxParts) { this.parts.dropped++; return; }
        const p = this.parts.spawn(); if (!p) return;
        const a = o.dir != null ? o.dir + rr(-(o.spread || 0.6), o.spread || 0.6) : rr(0, Math.PI * 2), v = rr(15, speed || 70);
        p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - (o.up == null ? 20 : o.up); p.g = g == null ? 160 : g;
        p.life = p.max = rr(o.min || 0.3, o.max || 0.8); p.col = Array.isArray(col) ? col[i % col.length] : col; p.s = Math.random() < 0.3 ? 2 : 1;
        p.bounce = o.bounce || 0; p.floor = o.floor || 0; p.kind = o.kind || 0;
      }
    }
    coins(x, y, n, floor) { this.burst(x, y, n, ['#ffd24a', '#ffe98a', '#c8901a'], 90, 260, { up: 90, bounce: 0.45, floor: floor || 150, min: 0.8, max: 1.3 }); } // отскок монет от земли
    sparks(x, y, n, col) { this.burst(x, y, n, col || ['#ffb15c', '#ffe27a', '#fff'], 110, 220, { up: 60, min: 0.2, max: 0.5 }); } // искры кузницы и неудачной заточки
    dust(x, y, n) { this.burst(x, y, n || 2, ['#cfe0f2', '#e8f2ff'], 18, -10, { dir: -Math.PI / 2, spread: 0.9, up: 4, min: 0.25, max: 0.5 }); } // пыль из-под ног
    shards(x, y, n, col) { this.burst(x, y, n, col || ['#9fb0c8', '#6c7f9c', '#cfd8e8'], 120, 300, { up: 80, bounce: 0.3, floor: 150, min: 0.6, max: 1.1 }); } // осколки стен
    trail(x, y, col) { const p = this.parts.live < this.maxParts ? this.parts.spawn() : null; if (!p) return; p.x = x; p.y = y; p.vx = 0; p.vy = 0; p.g = 0; p.life = p.max = 0.18; p.col = col || '#ffffff'; p.s = 2; p.bounce = 0; p.kind = 1; } // размытие быстрых атак
    footprint(x, y) { const m = this.marks.spawn(); if (!m) return; m.x = x; m.y = y; m.life = m.max = 4; m.w = 2; }
    // ---- числа урона ----
    // power: во сколько раз удар сильнее обычного (1 = обычный), масштаб числа растёт, но не больше 2
    number(x, y, text, kind, power) {
      const n = this.nums.spawn(); if (!n) return null;
      n.x = x + rr(-8, 8); n.y = y; n.vx = rr(-20, 20); n.vy = kind === 'crit' ? -78 : -54; n.life = n.max = kind === 'crit' ? 1.1 : 0.85; n.t = String(text); n.col = KIND[kind] || kind || '#fff';
      n.scale = Math.max(1, Math.min(2, power || 1)) >= 1.5 ? 2 : 1; return n;
    }
    // ---- камера и время ----
    hit(power) { this.shake = Math.min(this.maxShake, Math.max(this.shake, power)); if (power >= 2) this.stop = Math.max(this.stop, power >= 5 ? 0.08 : 0.045); } // 45-80 мс
    flash(col, t) { this.flashT = t || 0.25; this.flashCol = col || '#fff'; }
    bossKill() { this.flash('#ffffff', 0.45); this.hit(6); }
    shakeOffset() { const s = this.shake; return s > 0.3 ? [Math.round(rr(-s, s)), Math.round(rr(-s, s))] : [0, 0]; }
    // Возвращает dt для МИРА (во время hit stop почти 0). UI должен брать обычный dt.
    update(dt) {
      this.shake = Math.max(0, this.shake - dt * 10); this.flashT = Math.max(0, this.flashT - dt); this.pulseT += dt;
      let wdt = dt; if (this.stop > 0) { this.stop -= dt; wdt = dt * 0.04; }
      this.parts.update((p) => {
        p.life -= wdt; if (p.life <= 0) return false;
        p.vy += p.g * wdt; p.x += p.vx * wdt; p.y += p.vy * wdt;
        if (p.bounce && p.floor && p.y > p.floor && p.vy > 0) { p.y = p.floor; p.vy *= -p.bounce; p.vx *= 0.7; if (Math.abs(p.vy) < 8) p.bounce = 0; }
      });
      this.nums.update((n) => { n.life -= dt; if (n.life <= 0) return false; n.vy += 100 * dt; n.x += n.vx * dt; n.y += n.vy * dt; });
      this.marks.update((m) => { m.life -= dt; return m.life > 0; });
      this._governor(dt); return wdt;
    }
    // Авто-понижение количества частиц, если FPS падает ниже 30; возвращает назад, когда стабильно выше 50.
    _governor(dt) {
      if (dt <= 0) return; const fps = 1 / Math.min(dt, 0.25); this.fpsAvg += (fps - this.fpsAvg) * 0.05;
      if (this.fpsAvg < 30) { this.lowT += dt; this.highT = 0; if (this.lowT > 1.5 && this.quality > 0.25) { this.quality = Math.max(0.25, this.quality / 2); this.lowT = 0; } }
      else if (this.fpsAvg > 50) { this.highT += dt; this.lowT = 0; if (this.highT > 8 && this.quality < 1) { this.quality = Math.min(1, this.quality * 2); this.highT = 0; } }
      else { this.lowT = 0; this.highT = 0; }
      this.maxParts = Math.max(20, Math.floor(this.parts.cap * this.quality));
    }
    drawMarks(c) { this.marks.each((m) => { c.globalAlpha = Math.min(0.5, m.life / m.max * 0.5); c.fillStyle = m.col; c.fillRect(Math.round(m.x), Math.round(m.y), m.w, 1); }); c.globalAlpha = 1; }
    draw(c, text) { // text = PX.text
      this.parts.each((p) => { c.globalAlpha = Math.min(1, p.life / p.max * 1.6); c.fillStyle = p.col; c.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); });
      this.nums.each((n) => { c.globalAlpha = Math.min(1, n.life * 2.2); if (n.scale > 1) { text(c, n.t, n.x + 1, n.y + 1, '#000000', { align: 'c', sh: null }); } text(c, n.t, n.x, n.y, n.col, { align: 'c' }); });
      c.globalAlpha = 1;
      if (this.flashT > 0) { c.globalAlpha = Math.min(0.5, this.flashT * 1.6); c.fillStyle = this.flashCol; c.fillRect(0, 0, 384, 216); c.globalAlpha = 1; }
    }
    // Пульсация экрана при низком HP/угрозе: красная виньетка (intensity 0..1)
    vignette(c, intensity) {
      if (intensity <= 0) return; const k = (0.5 + 0.5 * Math.sin(this.pulseT * 5)) * intensity;
      c.fillStyle = 'rgba(200,20,40,' + (k * 0.25).toFixed(3) + ')'; c.fillRect(0, 0, 384, 4); c.fillRect(0, 212, 384, 4); c.fillRect(0, 0, 4, 216); c.fillRect(380, 0, 4, 216);
    }
    stats() { return { parts: this.parts.live, partsCap: this.maxParts, peak: this.parts.peak, nums: this.nums.live, marks: this.marks.live, dropped: this.parts.dropped, quality: this.quality, fps: Math.round(this.fpsAvg) }; }
    // Стресс-тест: 500 частиц одновременно, без роста памяти пула
    static stress(n) { const f = new Fx({ parts: Math.max(500, n || 500) }); f.quality = 1; f.burst(100, 100, n || 500, '#fff', 80); const live = f.parts.live; for (let i = 0; i < 120; i++) f.update(1 / 60); return { spawned: live, afterSecs2: f.parts.live, cap: f.parts.cap }; }
  }

  FF.fx = FF.fx || new Fx({ parts: 400 });
  FF.Pool = Pool; FF.Fx = Fx; FF.FxKind = KIND;
  if (typeof module !== 'undefined' && module.exports) module.exports = FF;
})(typeof window !== 'undefined' ? window : globalThis);
