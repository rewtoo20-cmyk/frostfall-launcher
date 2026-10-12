// FROSTFALL: редактор карт (логика без DOM). Тайлы и слои, кисть/ластик/заливка/пипетка, отмена и возврат, зум и панорама, привязка к сетке,
// коллизии, автосглаживание, проверка карты (достижимость, спавны, выход), шум Перлина (острова, подземелья, рельеф), JSON-экспорт/импорт,
// хранилище в localStorage с защитой сюжетных комнат, пробный прогон карты и преобразование в вылазку.
(function (root) {
  'use strict';
  const FF = root.FF = root.FF || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const MAXW = 128, MAXH = 128, LAYERS = ['bg', 'col', 'obj', 'spn'], LAYER_NAMES = { bg: 'Фон', col: 'Стены', obj: 'Объект', spn: 'Враги' };

  // ---------- палитра ----------
  const TILES = [
    { id: 0, name: 'Снег', solid: false, col: '#e8f2ff', edge: '#cfe0f2' }, { id: 1, name: 'Лёд', solid: false, col: '#9fd0e6', edge: '#74b4d4' }, { id: 2, name: 'Камень', solid: false, col: '#8a93a6', edge: '#6c7488' },
    { id: 3, name: 'Доски', solid: false, col: '#9a7a52', edge: '#6e5236' }, { id: 4, name: 'Вода', solid: true, col: '#2f5d9a', edge: '#1f3f70', auto: true }, { id: 5, name: 'Стена', solid: true, col: '#4a5268', edge: '#2a3042', auto: true },
    { id: 6, name: 'Ель', solid: true, col: '#2f6a58', edge: '#1d4638' }, { id: 7, name: 'Валун', solid: true, col: '#6a7284', edge: '#454c5e' }, { id: 8, name: 'Мох', solid: false, col: '#7fa890', edge: '#5f8870' },
    { id: 9, name: 'Пещера', solid: false, col: '#4e4660', edge: '#383248' }, { id: 10, name: 'Гора', solid: true, col: '#b8c4d8', edge: '#8a98b0', auto: true }, { id: 11, name: 'Лава', solid: true, col: '#d2501e', edge: '#8a2a0a' },
  ];
  const TID = {}; TILES.forEach((t) => { TID[t.id] = t; });
  const OBJS = [
    { id: 0, name: 'Пусто' }, { id: 1, name: 'Старт героя', col: '#5fe08a', one: true }, { id: 2, name: 'Сундук', col: '#ffd24a' }, { id: 3, name: 'Босс', col: '#ff4d6d', one: true },
    { id: 4, name: 'Выход', col: '#5bc0ff', one: true }, { id: 5, name: 'Факел', col: '#ff9c2a' }, { id: 6, name: 'Ящик', col: '#a07a4a', solid: true }, { id: 7, name: 'Костёр', col: '#ff7a2a' },
  ];
  const SPAWNS = [{ id: 0, name: 'Пусто' }, { id: 1, name: 'Слизень', col: '#7fe0ff', type: 'slime', p: 1 }, { id: 2, name: 'Волк', col: '#b0b8c8', type: 'wolf', p: 1.3 }, { id: 3, name: 'Скелет', col: '#e8e8d0', type: 'skeleton', p: 1.5 }, { id: 4, name: 'Голем', col: '#8a98b0', type: 'golem', p: 2 }, { id: 5, name: 'Элита', col: '#ffd24a', type: 'elite', p: 3 }];

  // ---------- шум Перлина ----------
  function Perlin(seed) {
    const r = FF.Rng(seed), P = new Uint8Array(512), base = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = base[i]; base[i] = base[j]; base[j] = t; }
    for (let i = 0; i < 512; i++) P[i] = base[i & 255];
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10), lerp = (a, b, t) => a + (b - a) * t;
    const grad = (h, x, y) => { switch (h & 7) { case 0: return x + y; case 1: return x - y; case 2: return -x + y; case 3: return -x - y; case 4: return x; case 5: return -x; case 6: return y; default: return -y; } };
    const noise = (x, y) => {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, xf = x - Math.floor(x), yf = y - Math.floor(y), u = fade(xf), v = fade(yf);
      const aa = P[P[X] + Y], ab = P[P[X] + Y + 1], ba = P[P[X + 1] + Y], bb = P[P[X + 1] + Y + 1];
      return lerp(lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u), lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u), v);
    };
    noise.fbm = (x, y, oct) => { let a = 1, f = 1, s = 0, n = 0; for (let i = 0; i < (oct || 4); i++) { s += noise(x * f, y * f) * a; n += a; a *= 0.5; f *= 2; } return s / n; };
    return noise;
  }

  // ---------- карта ----------
  class TileMap {
    constructor(o) {
      o = o || {}; this.id = o.id || 'room_' + Math.random().toString(36).slice(2, 8); this.name = String(o.name || 'Новая карта').slice(0, 32);
      this.w = clamp(o.w | 0 || 32, 4, MAXW); this.h = clamp(o.h | 0 || 20, 4, MAXH); this.locked = !!o.locked; this.threat = clamp(o.threat | 0 || 1, 1, 20);
      this.light = { ambient: 1, tint: '#ffffff', ...(o.light || {}) }; const n = this.w * this.h;
      this.bg = new Uint8Array(n); this.col = new Uint8Array(n); this.obj = new Uint8Array(n); this.spn = new Uint8Array(n); this.ver = 1;
    }
    inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    idx(x, y) { return y * this.w + x; }
    // стена: ручная коллизия, твёрдый тайл или твёрдый объект
    solid(x, y) { if (!this.inb(x, y)) return true; const i = this.idx(x, y); return !!this.col[i] || !!(TID[this.bg[i]] && TID[this.bg[i]].solid) || !!(OBJS[this.obj[i]] && OBJS[this.obj[i]].solid); }
    find(code) { const out = []; for (let i = 0; i < this.obj.length; i++) if (this.obj[i] === code) out.push({ x: i % this.w, y: (i / this.w) | 0 }); return out; }
    count(layer, code) { let n = 0; const a = this[layer]; for (let i = 0; i < a.length; i++) if (code == null ? a[i] : a[i] === code) n++; return n; }
    // Генератор коллизий: слой col из твёрдых тайлов и объектов (ручные стены сохраняются)
    genCollision() { let n = 0; for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const i = this.idx(x, y), s = (TID[this.bg[i]] && TID[this.bg[i]].solid) || (OBJS[this.obj[i]] && OBJS[this.obj[i]].solid); if (s && !this.col[i]) { this.col[i] = 1; n++; } } return n; }
    // Автотайлинг: маска 4 соседей (бит=сосед того же типа), используется отрисовкой краёв
    mask(x, y) { const t = this.bg[this.idx(x, y)]; let m = 0; if (this.inb(x, y - 1) && this.bg[this.idx(x, y - 1)] === t) m |= 1; if (this.inb(x + 1, y) && this.bg[this.idx(x + 1, y)] === t) m |= 2; if (this.inb(x, y + 1) && this.bg[this.idx(x, y + 1)] === t) m |= 4; if (this.inb(x - 1, y) && this.bg[this.idx(x - 1, y)] === t) m |= 8; return m; }
    // Сглаживание углов: убираем одиночные «шипы» твёрдых тайлов и закрываем одиночные ямки (клеточный автомат)
    smooth(passes) {
      let ch = 0; const fl = 0;
      for (let p = 0; p < (passes || 1); p++) {
        const nb = this.bg.slice();
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
          const i = this.idx(x, y), t = this.bg[i]; if (this.obj[i]) continue; let sol = 0, kind = 0; const cnt = {};
          for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const xx = x + dx, yy = y + dy; if (!this.inb(xx, yy)) continue; const tt = this.bg[this.idx(xx, yy)]; if (TID[tt].solid) { sol++; cnt[tt] = (cnt[tt] || 0) + 1; } }
          if (TID[t].solid && TID[t].auto && sol <= 1) { nb[i] = 0; ch++; } else if (!TID[t].solid && sol >= 3) { let best = 0, bn = 0; for (const k in cnt) if (cnt[k] > bn) { bn = cnt[k]; best = +k; } if (best) { nb[i] = best; ch++; } }
        }
        this.bg = nb; if (!ch) break;
      }
      return ch;
    }
    clone() { const m = new TileMap({ id: this.id, name: this.name, w: this.w, h: this.h, locked: this.locked, threat: this.threat, light: this.light }); for (const l of LAYERS) m[l] = this[l].slice(); return m; }
    // ---------- сериализация (RLE) ----------
    static rle(a) { const o = []; let i = 0; while (i < a.length) { let j = i; while (j < a.length && a[j] === a[i] && j - i < 65535) j++; o.push(a[i], j - i); i = j; } return o; }
    static unrle(o, n) { const a = new Uint8Array(n); let p = 0; for (let i = 0; i + 1 < o.length && p < n; i += 2) { const v = o[i] & 255, c = o[i + 1] | 0; for (let k = 0; k < c && p < n; k++) a[p++] = v; } return a; }
    toJSON() { return { v: 1, id: this.id, name: this.name, w: this.w, h: this.h, locked: this.locked, threat: this.threat, light: this.light, bg: TileMap.rle(this.bg), col: TileMap.rle(this.col), obj: TileMap.rle(this.obj), spn: TileMap.rle(this.spn) }; }
    // Безопасная загрузка: любые поля приводятся к допустимым значениям
    static fromJSON(j) {
      if (!j || typeof j !== 'object') throw new Error('Карта: не объект'); const w = j.w | 0, h = j.h | 0; if (w < 4 || h < 4 || w > MAXW || h > MAXH) throw new Error('Карта: размер вне 4..' + MAXW);
      if (typeof j.id !== 'string' || !/^[\w-]{1,40}$/.test(j.id)) throw new Error('Карта: плохой id');
      const m = new TileMap({ id: j.id, name: typeof j.name === 'string' ? j.name : 'Карта', w, h, locked: !!j.locked, threat: j.threat, light: { ambient: clamp(+(j.light && j.light.ambient) || 1, 0.2, 1), tint: /^#[0-9a-f]{6}$/i.test(j.light && j.light.tint) ? j.light.tint : '#ffffff' } }); const n = w * h;
      for (const l of LAYERS) { if (!Array.isArray(j[l])) throw new Error('Карта: нет слоя ' + l); m[l] = TileMap.unrle(j[l], n); }
      for (let i = 0; i < n; i++) { if (!TID[m.bg[i]]) m.bg[i] = 0; if (!OBJS[m.obj[i]]) m.obj[i] = 0; if (!SPAWNS[m.spn[i]]) m.spn[i] = 0; m.col[i] = m.col[i] ? 1 : 0; }
      return m;
    }
  }

  // ---------- проверка карты ----------
  function reach(map, sx, sy) { const seen = new Uint8Array(map.w * map.h); if (!map.inb(sx, sy) || map.solid(sx, sy)) return seen; const q = [sx, sy]; seen[map.idx(sx, sy)] = 1; for (let h = 0; h < q.length; h += 2) { const x = q[h], y = q[h + 1]; for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const nx = x + dx, ny = y + dy; if (map.inb(nx, ny) && !seen[map.idx(nx, ny)] && !map.solid(nx, ny)) { seen[map.idx(nx, ny)] = 1; q.push(nx, ny); } } } return seen; }
  function validate(map) {
    const out = [], add = (lvl, msg, x, y) => out.push({ lvl, msg, x, y }); const st = map.find(1), ex = map.find(4), bs = map.find(3), ch = map.find(2);
    if (!st.length) add('error', 'Нет точки старта героя'); if (st.length > 1) st.slice(1).forEach((p) => add('error', 'Лишний старт героя', p.x, p.y));
    if (!ex.length) add('error', 'Нет выхода'); if (ex.length > 1) ex.slice(1).forEach((p) => add('error', 'Лишний выход', p.x, p.y)); if (bs.length > 1) bs.slice(1).forEach((p) => add('error', 'Лишний босс', p.x, p.y));
    if (!map.count('spn') && !bs.length && !ch.length) add('warn', 'На карте нет ни врагов, ни сундуков, ни босса');
    for (let i = 0; i < map.spn.length; i++) if (map.spn[i] && map.solid(i % map.w, (i / map.w) | 0)) add('error', 'Враг стоит в стене', i % map.w, (i / map.w) | 0);
    for (const o of [].concat(ch, bs, ex, st)) if (map.solid(o.x, o.y)) add('error', 'Объект стоит в стене', o.x, o.y);
    if (st.length) { const r = reach(map, st[0].x, st[0].y); for (const o of [].concat(ex, bs, ch)) if (!r[map.idx(o.x, o.y)]) add('error', 'Недостижимо от старта', o.x, o.y); for (let i = 0; i < map.spn.length; i++) if (map.spn[i] && !r[i]) add('warn', 'Враг вне досягаемости', i % map.w, (i / map.w) | 0); }
    if (!map.name.trim()) add('error', 'Пустое название'); return out;
  }

  // ---------- редактор ----------
  class LevelEditor {
    constructor(map) {
      this.map = map || new TileMap({}); this.layer = 'bg'; this.tool = 'brush'; this.tile = 5; this.obj = 1; this.spn = 1; this.size = 1; this.undo = []; this.redo = []; this.stroke = null; this.view = { zoom: 2, ox: 0, oy: 0 }; this.cur = { x: -1, y: -1 }; this.dirty = false; this.issues = []; this.cache = new Map();
      this.maxUndo = 200; this.history = 0;
    }
    get locked() { return this.map.locked; }
    // ---- слой/инструмент/значение ----
    value() { return this.layer === 'bg' ? this.tile : this.layer === 'obj' ? this.obj : this.layer === 'spn' ? this.spn : 1; }
    setLayer(l) { if (LAYERS.includes(l)) this.layer = l; }
    setTool(t) { if (['brush', 'eraser', 'fill', 'pick'].includes(t)) this.tool = t; }
    // ---- штрихи (для отмены) ----
    begin() { this.stroke = []; }
    end() { if (this.stroke && this.stroke.length) { this.undo.push(this.stroke); if (this.undo.length > this.maxUndo) this.undo.shift(); this.redo.length = 0; this.dirty = true; this.map.ver++; } this.stroke = null; }
    put(layer, x, y, v) {
      if (this.locked || !this.map.inb(x, y)) return false; const i = this.map.idx(x, y), a = this.map[layer], old = a[i]; if (old === v) return false;
      // единственные объекты (старт, босс, выход) переезжают, а не дублируются
      if (layer === 'obj' && v && OBJS[v] && OBJS[v].one) { const prev = this.map.find(v)[0]; if (prev) { const pi = this.map.idx(prev.x, prev.y); if (this.stroke) this.stroke.push([layer, pi, v, 0]); a[pi] = 0; } }
      if (this.stroke) this.stroke.push([layer, i, old, v]); a[i] = v; return true;
    }
    // Кисть размером size, привязанная к сетке
    stamp(x, y, v, layer) { let n = 0; const s = this.size, o = -((s - 1) >> 1); for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) if (this.put(layer || this.layer, x + o + dx, y + o + dy, v)) n++; return n; }
    // Действие инструмента в клетке; возвращает число изменённых клеток
    use(x, y) {
      if (this.locked) return 0; const L = this.layer;
      if (this.tool === 'pick') { const v = this.map[L][this.map.idx(x, y)]; if (L === 'bg') this.tile = v; else if (L === 'obj') this.obj = v; else if (L === 'spn') this.spn = v; return 0; }
      if (this.tool === 'fill') return this.fill(x, y, this.tool === 'eraser' ? 0 : this.value());
      return this.stamp(x, y, this.tool === 'eraser' ? 0 : this.value());
    }
    // Заливка области (стек, без рекурсии)
    fill(x, y, v) {
      if (this.locked || !this.map.inb(x, y)) return 0; const m = this.map, a = m[this.layer], from = a[m.idx(x, y)]; if (from === v) return 0; const st = [x, y]; let n = 0; const own = !this.stroke; if (own) this.begin();
      while (st.length) { const cy = st.pop(), cx = st.pop(); if (!m.inb(cx, cy) || a[m.idx(cx, cy)] !== from) continue; this.put(this.layer, cx, cy, v); n++; st.push(cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1); }
      if (own) this.end(); return n;
    }
    // ---- отмена/возврат ----
    undoOne() { const s = this.undo.pop(); if (!s) return false; for (let k = s.length - 1; k >= 0; k--) this.map[s[k][0]][s[k][1]] = s[k][2]; this.redo.push(s); this.map.ver++; return true; }
    redoOne() { const s = this.redo.pop(); if (!s) return false; for (const p of s) this.map[p[0]][p[1]] = p[3]; this.undo.push(s); this.map.ver++; return true; }
    // ---- вид: зум и панорама ----
    cell() { return 8 * this.view.zoom; }
    toCell(px, py) { const c = this.cell(); return { x: Math.floor((px - this.view.ox) / c), y: Math.floor((py - this.view.oy) / c) }; }
    zoomAt(px, py, dir) { const Z = [0.5, 1, 2, 3, 4, 6], i = Z.indexOf(this.view.zoom), ni = clamp(i + dir, 0, Z.length - 1); if (ni === i) return; const before = { x: (px - this.view.ox) / this.cell(), y: (py - this.view.oy) / this.cell() }; this.view.zoom = Z[ni]; this.view.ox = px - before.x * this.cell(); this.view.oy = py - before.y * this.cell(); }
    pan(dx, dy) { this.view.ox += dx; this.view.oy += dy; }
    // ---- сервис ----
    check() { this.issues = validate(this.map); return this.issues; }
    isValid() { return !this.check().some((i) => i.lvl === 'error'); }
    clear() { if (this.locked) return; this.begin(); for (const l of LAYERS) for (let i = 0; i < this.map[l].length; i++) if (this.map[l][i]) this.stroke.push([l, i, this.map[l][i], 0]); for (const l of LAYERS) this.map[l].fill(0); this.end(); }
    // Закрытие редактора: освобождаем кэши и историю, ссылки на карту обнуляем
    dispose() { this.cache.clear(); this.undo.length = 0; this.redo.length = 0; this.stroke = null; this.issues = []; }
  }

  // ---------- процедурные карты ----------
  function place(m, rng) {
    // подбираем свободные клетки на самой большой связной области
    const free = []; for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) if (!m.solid(x, y)) free.push([x, y]); if (free.length < 12) return false;
    const seen = new Uint8Array(m.w * m.h); let best = null;
    for (const [x, y] of free) { const i = m.idx(x, y); if (seen[i]) continue; const r = reach(m, x, y); let n = 0; const cells = []; for (let k = 0; k < r.length; k++) if (r[k]) { seen[k] = 1; n++; cells.push(k); } if (!best || n > best.length) best = cells; }
    if (!best || best.length < 12) return false; const pick = () => best.splice(rng.int(0, best.length - 1), 1)[0], xy = (k) => [k % m.w, (k / m.w) | 0];
    const a = xy(best.splice(0, 1)[0]); m.obj[m.idx(a[0], a[1])] = 1;
    // выход — самая далёкая клетка от старта
    let fi = 0, fd = -1; best.forEach((k, i) => { const [x, y] = xy(k), d = Math.abs(x - a[0]) + Math.abs(y - a[1]); if (d > fd) { fd = d; fi = i; } }); const e = xy(best.splice(fi, 1)[0]); m.obj[m.idx(e[0], e[1])] = 4;
    if (best.length > 5) { const b = xy(pick()); m.obj[m.idx(b[0], b[1])] = 3; }
    const nCh = clamp(Math.floor(best.length / 120) + 1, 1, 8), nEn = clamp(Math.floor(best.length / 40) + 2, 2, 30);
    for (let i = 0; i < nCh && best.length; i++) { const c = xy(pick()); if (!m.obj[m.idx(c[0], c[1])]) m.obj[m.idx(c[0], c[1])] = 2; }
    for (let i = 0; i < nEn && best.length; i++) { const c = xy(pick()); if (!m.obj[m.idx(c[0], c[1])]) m.spn[m.idx(c[0], c[1])] = rng.weighted([[1, 4], [2, 3], [3, 2], [4, 1], [5, 0.6]]); }
    return true;
  }
  // Высотная карта: fbm Перлина + сглаживание перепадов (размытие) + терраса
  function heightmap(w, h, seed, scale, blur) {
    const N = Perlin(seed), H = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) H[y * w + x] = N.fbm(x * (scale || 0.09), y * (scale || 0.09), 4);
    for (let p = 0; p < (blur == null ? 2 : blur); p++) { const C = H.slice(); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += C[yy * w + xx]; n++; } } H[y * w + x] = s / n; } }
    return H;
  }
  const Gen = {
    // Остров: вода по краям, снег и лёд в центре, горы на высоких отметках
    island(w, h, seed, o) {
      const m = new TileMap({ id: 'gen_' + (seed >>> 0).toString(36), name: 'Остров ' + (seed % 1000), w, h }), r = FF.Rng(seed ^ 0x77), H = heightmap(w, h, seed, 0.1, 2);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (x / (w - 1)) * 2 - 1, dy = (y / (h - 1)) * 2 - 1, fall = Math.min(1, Math.sqrt(dx * dx + dy * dy)), v = H[y * w + x] * 1.4 + 0.45 - fall * 0.9; m.bg[m.idx(x, y)] = v < -0.02 ? 4 : v < 0.05 ? 1 : v < 0.38 ? (r() < 0.1 ? 8 : 0) : v < 0.55 ? 2 : 10; }
      m.smooth(2); m.genCollision(); if (!place(m, r)) return Gen.island(w, h, seed + 1, o); return m;
    },
    // Подземелье: пещеры по порогу шума + гарантированный коридор между стартом и выходом
    dungeon(w, h, seed) {
      const m = new TileMap({ id: 'gen_' + (seed >>> 0).toString(36), name: 'Подземелье ' + (seed % 1000), w, h, light: { ambient: 0.55, tint: '#8a7aff' } }), r = FF.Rng(seed ^ 0x99), H = heightmap(w, h, seed, 0.14, 1);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1; m.bg[m.idx(x, y)] = edge || H[y * w + x] > 0.12 ? 5 : r() < 0.06 ? 8 : 9; }
      m.smooth(2); m.genCollision();
      if (!place(m, r)) return Gen.dungeon(w, h, seed + 1);
      // соединяем все свободные островки: прокладываем прямые тоннели к старту
      const st = m.find(1)[0], reachA = reach(m, st.x, st.y); for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (!m.solid(x, y) && !reachA[m.idx(x, y)] && r() < 0.02) { let cx = x, cy = y; while ((cx !== st.x || cy !== st.y) && !reachA[m.idx(cx, cy)]) { m.bg[m.idx(cx, cy)] = m.bg[m.idx(cx, cy)] === 5 ? 9 : m.bg[m.idx(cx, cy)]; m.col[m.idx(cx, cy)] = 0; if (cx !== st.x) cx += Math.sign(st.x - cx); else cy += Math.sign(st.y - cy); } }
      return m;
    },
  };

  // ---------- хранилище ----------
  const KEY = 'ff.maps';
  class MapStore {
    constructor(storage, protectedMaps) { this.st = storage === undefined ? (typeof localStorage !== 'undefined' ? localStorage : null) : storage; this.mem = null; this.maps = new Map(); this.prot = protectedMaps || []; this.mode = 'ls'; this.load(); for (const m of this.prot) { m.locked = true; this.maps.set(m.id, m); } }
    _raw() { try { const r = this.st && this.st.getItem(KEY); return r ? JSON.parse(r) : []; } catch (e) { return null; } }
    load() { this.maps.clear(); let arr = this._raw(); if (arr === null) { this.mode = 'mem'; arr = this.mem || []; } for (const j of Array.isArray(arr) ? arr : []) { try { const m = TileMap.fromJSON(j); this.maps.set(m.id, m); } catch (e) { if (FF.Log) FF.Log.warn('maps', 'карта пропущена: ' + e.message); } } }
    // quota check: пробная запись; при отказе уходим в память
    persist() { const arr = [...this.maps.values()].filter((m) => !this.prot.includes(m)).map((m) => m.toJSON()); this.mem = arr; try { if (this.st) { this.st.setItem(KEY, JSON.stringify(arr)); this.mode = 'ls'; return true; } } catch (e) { /* квота или запрет */ } this.mode = 'mem'; return false; }
    list() { return [...this.maps.values()]; }
    get(id) { return this.maps.get(id) || null; }
    // Уникальный id среди всех комнат (карты и сюжетные)
    uniqueId(base) { base = String(base || 'room').replace(/[^\w-]/g, '_').slice(0, 30) || 'room'; let id = base, n = 2; while (this.maps.has(id)) id = base + '_' + n++; return id; }
    isFree(id) { return !this.maps.has(id); }
    save(map) {
      const ex = this.maps.get(map.id); if (ex && ex.locked) throw new Error('Сюжетная комната защищена от изменений'); if (/^story_/.test(map.id) && !(ex && ex === map)) throw new Error('Префикс story_ зарезервирован');
      const issues = validate(map).filter((i) => i.lvl === 'error'); if (issues.length) throw new Error('Карта не прошла проверку: ' + issues[0].msg); this.maps.set(map.id, map); this.persist(); return true;
    }
    remove(id) { const m = this.maps.get(id); if (!m) return false; if (m.locked) throw new Error('Сюжетная комната нельзя удалить'); this.maps.delete(id); this.persist(); return true; }
    rename(id, name) { const m = this.maps.get(id); if (!m) return false; if (m.locked) throw new Error('Сюжетная комната нельзя переименовать'); m.name = String(name).slice(0, 32) || m.name; this.persist(); return true; }
    exportAll() { const body = JSON.stringify({ v: 1, maps: this.list().filter((m) => !m.locked).map((m) => m.toJSON()) }); return JSON.stringify({ fmt: 'frostfall-maps', sum: FF.hash36 ? FF.hash36(body, 7) : '', body }); }
    importAll(text) {
      const o = JSON.parse(text); let body = o; if (o && o.fmt === 'frostfall-maps') { if (FF.hash36 && o.sum !== FF.hash36(o.body, 7)) throw new Error('Контрольная сумма архива не совпала'); body = JSON.parse(o.body); }
      const arr = Array.isArray(body) ? body : body && Array.isArray(body.maps) ? body.maps : [body]; let n = 0, skipped = 0;
      for (const j of arr) { try { const m = TileMap.fromJSON(j); if (this.maps.has(m.id)) { if (this.maps.get(m.id).locked) { skipped++; continue; } m.id = this.uniqueId(m.id); } m.locked = false; this.maps.set(m.id, m); n++; } catch (e) { skipped++; } }
      this.persist(); return { added: n, skipped };
    }
    // Вылазка из карты: длина по числу «комнат» (враги, сундуки, босс), типы комнат по порядку обхода слева направо
    toExpedition(map) {
      const rooms = []; for (let i = 0; i < map.w * map.h; i++) { const x = i % map.w, y = (i / map.w) | 0; if (map.spn[i]) rooms.push({ x, y, type: 'fight', elite: map.spn[i] === 5 }); else if (map.obj[i] === 2) rooms.push({ x, y, type: 'treasure' }); else if (map.obj[i] === 7) rooms.push({ x, y, type: 'camp' }); }
      rooms.sort((a, b) => a.x - b.x || a.y - b.y); const step = Math.max(1, Math.ceil(rooms.length / 10)), pick = rooms.filter((_, i) => i % step === 0).slice(0, 11);
      const layout = pick.map((r) => ({ type: r.type, elite: !!r.elite })); if (!layout.length || layout[0].type === 'camp') layout.unshift({ type: 'fight', elite: false }); while (layout.length < 2) layout.push({ type: 'fight', elite: false });
      return { id: map.id, name: map.name, len: layout.length + 1, layout, threat: map.threat };
    }
    pool() { return this.list().filter((m) => validate(m).every((i) => i.lvl !== 'error')); }
  }

  // ---------- пробный прогон (Play Test) ----------
  // Герой идёт от старта к выходу по кратчайшему пути (BFS), по пути сражается с ближайшими врагами и открывает сундуки.
  function playtest(map, hero, seed) {
    const st = map.find(1)[0], ex = map.find(4)[0]; if (!st || !ex) return { ok: false, why: 'нет старта или выхода' }; const r = reach(map, st.x, st.y); if (!r[map.idx(ex.x, ex.y)]) return { ok: false, why: 'выход недостижим' };
    // BFS-путь
    const prev = new Int32Array(map.w * map.h).fill(-1), q = [map.idx(st.x, st.y)]; prev[q[0]] = q[0]; for (let h = 0; h < q.length; h++) { const i = q[h], x = i % map.w, y = (i / map.w) | 0; for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const nx = x + dx, ny = y + dy; if (map.inb(nx, ny) && !map.solid(nx, ny) && prev[map.idx(nx, ny)] < 0) { prev[map.idx(nx, ny)] = i; q.push(map.idx(nx, ny)); } } }
    const path = []; for (let i = map.idx(ex.x, ex.y); i !== map.idx(st.x, st.y); i = prev[i]) path.push(i); path.push(map.idx(st.x, st.y)); path.reverse();
    const rng = FF.Rng(seed || 1), res = { ok: true, steps: path.length, kills: 0, chests: 0, boss: false, win: true, hp: 1, path }; let hp = 1;
    const near = (i, k) => { const x = i % map.w, y = (i / map.w) | 0; for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) if (map.inb(x + dx, y + dy)) { const j = map.idx(x + dx, y + dy); if (map.spn[j] && !res._d[j]) return j; if (map.obj[j] === 2 && !res._d[j]) return j; if (map.obj[j] === 3 && !res._d[j]) return j; } return -1; }; res._d = {};
    for (const i of path) {
      const j = near(i, 3); if (j < 0) continue; res._d[j] = 1;
      if (map.obj[j] === 2) { res.chests++; continue; }
      const boss = map.obj[j] === 3, sp = SPAWNS[map.spn[j]] || { p: 3 }, b = new FF.Battle({ seed: rng.int(1, 1e9), bus: null }), power = (boss ? 5 : sp.p) * 40 * Math.pow(1.18, map.threat);
      b.addHero(Object.assign({ name: 'Герой', cls: 'warrior', max: hero.hp * hp, atk: hero.atk, def: hero.def || 0, rate: 1.2, acc: 0.95 }, {})); const foe = boss ? b.makeBoss({ name: 'Босс', max: power * 8, atk: power * 0.12, def: power * 0.02, noSummon: true }) : b.add({ name: 'Враг', max: power, atk: power * 0.07, def: power * 0.02, x: 280 });
      const out = b.run(120, 0.1), me = b.units.find((u) => u.side === 'h'); hp = Math.max(0.05, me.hp / (hero.hp * hp || 1) * hp);
      if (out === 'lose' || out === 'timeout') { res.win = false; res.failedAt = i; break; } res.kills++; if (boss) res.boss = true;
    }
    res.hp = hp; delete res._d; return res;
  }

  FF.TileMap = TileMap; FF.LevelEditor = LevelEditor; FF.MapStore = MapStore; FF.MapGen = Gen; FF.Perlin = Perlin; FF.mapPlaytest = playtest; FF.mapValidate = validate; FF.mapReach = reach;
  FF.MapData = { TILES, TID, OBJS, SPAWNS, LAYERS, LAYER_NAMES, MAXW, MAXH, heightmap };
  if (typeof module !== 'undefined' && module.exports) module.exports = FF;
})(typeof window !== 'undefined' ? window : globalThis);
