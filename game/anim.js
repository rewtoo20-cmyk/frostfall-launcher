// FROSTFALL: SpriteAnimator (состояния, приоритеты, dt), Paperdoll (слои + LRU-кэш), перекраска, отражение, вспышка.
(function (root) {
  'use strict';
  const FF = root.FF = root.FF || {};
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // кадры, скорость, зацикленность, следующее состояние; hold: застыть на последнем кадре
  const STATES = {
    idle:   { frames: [0, 1],       fps: 2,  loop: true },
    walk:   { frames: [0, 1],       fps: 9,  loop: true },
    attack: { frames: [2, 3, 3, 0], fps: 16, loop: false, next: 'idle' },
    skill:  { frames: [3, 3, 2, 0], fps: 10, loop: false, next: 'idle' },
    hit:    { frames: [4, 0],       fps: 12, loop: false, next: 'idle' },
    death:  { frames: [4, 5, 5],    fps: 6,  loop: false, hold: true },
  };
  // Удар и получение урона прерывают ход; смерть не прерывается ничем.
  const PRIORITY = { idle: 0, walk: 0, attack: 2, skill: 3, hit: 3, death: 9 };

  class SpriteAnimator {
    constructor(states) { this.S = states || STATES; this.state = 'idle'; this.t = 0; this.done = false; this.flip = false; this.speed = 1; this.onEnd = null; }
    // Возвращает true, если состояние сменилось.
    play(name, force) {
      const ns = this.S[name]; if (!ns) return false;
      const cur = this.S[this.state], busy = !this.done && cur.loop === false;
      if (!force) {
        if (this.state === 'death') return false;
        if (busy && (PRIORITY[name] || 0) < (PRIORITY[this.state] || 0)) return false;
        if (name === this.state && ns.loop) return false;
      }
      this.state = name; this.t = 0; this.done = false; return true;
    }
    face(dir) { this.flip = dir < 0; } // горизонтальное отражение при повороте
    update(dt) {
      const st = this.S[this.state]; this.t += dt * this.speed;
      if (st.loop) return;
      if (Math.floor(this.t * st.fps) >= st.frames.length) {
        if (st.hold) { this.done = true; return; }
        const fin = this.state; this.done = true;
        if (this.onEnd) this.onEnd(fin);
        if (st.next) this.play(st.next, true);
      }
    }
    // Номер кадра по времени (не зависит от FPS)
    frame() { const st = this.S[this.state], n = st.frames.length, i = Math.floor(this.t * st.fps); return st.frames[st.loop ? i % n : Math.min(i, n - 1)]; }
    progress() { const st = this.S[this.state]; return st.loop ? (this.t * st.fps) % st.frames.length / st.frames.length : Math.min(1, this.t * st.fps / st.frames.length); }
  }

  // Перекраска спрайта: заменяет цвета по таблице {'#aabbcc': '#112233'} либо сдвигает оттенок (hue, градусы).
  function hexRgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function rgb2hsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return [h, s, l]; }
  function hsl2rgb(h, s, l) { h = ((h % 360) + 360) % 360 / 360; if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; } const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)]; }
  function recolor(src, opt) {
    const w = src.width, h = src.height, out = mk(w, h), x = out.getContext('2d'); x.drawImage(src, 0, 0);
    const im = x.getImageData(0, 0, w, h), d = im.data, map = {};
    if (opt.map) for (const k in opt.map) { const a = hexRgb(k), b = hexRgb(opt.map[k]); map[(a[0] << 16) | (a[1] << 8) | a[2]] = b; }
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue; const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      if (map[key]) { d[i] = map[key][0]; d[i + 1] = map[key][1]; d[i + 2] = map[key][2]; }
      else if (opt.hue || opt.sat || opt.light) { const hsl = rgb2hsl(d[i], d[i + 1], d[i + 2]), c = hsl2rgb(hsl[0] + (opt.hue || 0), Math.max(0, Math.min(1, hsl[1] * (1 + (opt.sat || 0)))), Math.max(0, Math.min(1, hsl[2] + (opt.light || 0)))); d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; }
    }
    x.putImageData(im, 0, 0); return out;
  }
  const flipH = (src) => { const o = mk(src.width, src.height), x = o.getContext('2d'); x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return o; };
  // Белая/красная вспышка: закрашивает только непрозрачные пиксели
  function flash(src, col, a) { const o = mk(src.width, src.height), x = o.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = a == null ? 0.7 : a; x.fillStyle = col || '#fff'; x.fillRect(0, 0, o.width, o.height); return o; }

  // LRU-кэш: Map сохраняет порядок вставки, чтение переносит ключ в конец, переполнение выбрасывает самый старый.
  class LRU {
    constructor(max) { this.max = max; this.m = new Map(); this.hits = 0; this.miss = 0; }
    get(k) { const v = this.m.get(k); if (v === undefined) { this.miss++; return undefined; } this.hits++; this.m.delete(k); this.m.set(k, v); return v; }
    set(k, v) { if (this.m.has(k)) this.m.delete(k); this.m.set(k, v); while (this.m.size > this.max) this.m.delete(this.m.keys().next().value); return v; }
    get size() { return this.m.size; }
    clear() { this.m.clear(); }
  }

  const ORDER = ['cape', 'body', 'armor', 'head', 'weapon', 'fx'];
  class Paperdoll {
    // drawers[слой](ctx, id, кадр, состояние): рисует слой в общий холст
    constructor(drawers, w, h, max) { this.D = drawers || {}; this.w = w || 36; this.h = h || 36; this.cache = new LRU(max || 300); }
    key(equip, frame, extra) { let k = frame + '|' + (extra || '') + '|'; for (let i = 0; i < ORDER.length; i++) k += (equip[ORDER[i]] || '') + ','; return k; }
    get(equip, frame, extra) {
      const k = this.key(equip, frame, extra), hit = this.cache.get(k); if (hit) return hit;
      const c = mk(this.w, this.h), x = c.getContext('2d');
      for (const l of ORDER) if (equip[l] && this.D[l]) this.D[l](x, equip[l], frame, extra);
      return this.cache.set(k, c);
    }
    // Предпрогрев: собрать заранее все кадры наборов экипировки, чтобы не было микрофризов в бою
    warm(equips, frames) { let n = 0; for (const e of equips) for (const f of frames || [0, 1, 2, 3]) { this.get(e, f); n++; } return n; }
    // Нарисовать с отражением и целыми координатами
    draw(c, equip, frame, x, y, flip, extra) { const s = this.get(equip, frame, extra); c.drawImage(flip ? this._flip(s) : s, Math.round(x - s.width / 2), Math.round(y - s.height + 1)); }
    _flip(s) { return s._f || (s._f = flipH(s)); }
  }

  FF.SpriteAnimator = SpriteAnimator; FF.Paperdoll = Paperdoll; FF.LRU = LRU; FF.Sprites = { recolor, flipH, flash, STATES, PRIORITY, ORDER };
  if (typeof module !== 'undefined' && module.exports) module.exports = FF;
})(typeof window !== 'undefined' ? window : globalThis);
