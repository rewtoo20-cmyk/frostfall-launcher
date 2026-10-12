// FROSTFALL: базовые утилиты window.FF (логика без DOM, работает и в Node).
// Log, Rng, hash, Config, Timers, Cooldown, throttle/debounce, Loc, Clock, Env, Balance.
(function (root) {
  'use strict';
  const FF = root.FF = root.FF || {};
  const hasLS = () => { try { return typeof localStorage !== 'undefined' && !!localStorage; } catch (e) { return false; } };
  const lsGet = (k) => { try { return hasLS() ? localStorage.getItem(k) : null; } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (hasLS()) localStorage.setItem(k, v); return true; } catch (e) { return false; } };

  // ---------- Log: уровни, кольцевой буфер, сохранение аварий ----------
  const LV = { INFO: 0, WARN: 1, ERROR: 2 }, LNAME = ['INFO', 'WARN', 'ERROR'];
  const Log = {
    level: 0, max: 200, buf: [], sinks: [],
    write(lv, tag, msg, extra) {
      if (lv < Log.level) return;
      const rec = { t: Date.now(), lv: LNAME[lv], tag: String(tag), msg: String(msg).slice(0, 300) };
      if (extra !== undefined) { try { rec.x = String(extra && extra.stack ? extra.stack : extra).slice(0, 400); } catch (e) { /* ignore */ } }
      Log.buf.push(rec); if (Log.buf.length > Log.max) Log.buf.shift();
      for (const s of Log.sinks) { try { s(rec); } catch (e) { /* sink не должен ломать игру */ } }
      if (lv >= LV.ERROR) Log.persist();
      if (typeof console !== 'undefined' && lv >= LV.WARN && !Log.quiet) (lv >= LV.ERROR ? console.error : console.warn)('[' + rec.tag + ']', rec.msg);
    },
    info(tag, msg, x) { Log.write(0, tag, msg, x); },
    warn(tag, msg, x) { Log.write(1, tag, msg, x); },
    error(tag, msg, x) { Log.write(2, tag, msg, x); },
    // аварийный клиентский лог: последние 30 ошибок живут между запусками
    persist() { const errs = Log.buf.filter((r) => r.lv === 'ERROR').slice(-30); lsSet('ff.errlog', JSON.stringify(errs)); },
    saved() { try { return JSON.parse(lsGet('ff.errlog') || '[]'); } catch (e) { return []; } },
    count(lv) { return Log.buf.filter((r) => r.lv === lv).length; },
    hook() { // глобальный перехват ошибок
      if (Log._hooked || typeof root.addEventListener !== 'function') return; Log._hooked = true;
      root.addEventListener('error', (e) => Log.error('window', e.message || 'error', e.error));
      root.addEventListener('unhandledrejection', (e) => Log.error('promise', (e.reason && e.reason.message) || 'rejection', e.reason));
    },
  };

  // ---------- хэши и случайные числа ----------
  // cyrb53: 53-битный хэш строки (число). Для идентификации типов и контрольных сумм.
  function cyrb53(str, seed) {
    seed = seed | 0; str = String(str);
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  const hash36 = (s, seed) => cyrb53(s, seed).toString(36);
  const hash32 = (s) => cyrb53(s, 7) >>> 0; // быстрый 32-бит id типа
  // Mulberry32: PRNG с фиксированным сидом
  function Rng(seed) {
    let a = (typeof seed === 'string' ? hash32(seed) : seed) | 0;
    const f = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
    f.range = (lo, hi) => lo + f() * (hi - lo);
    f.pick = (arr) => arr[Math.floor(f() * arr.length)];
    f.chance = (p) => f() < p;
    f.shuffle = (arr) => { const a2 = arr.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); const t = a2[i]; a2[i] = a2[j]; a2[j] = t; } return a2; };
    f.weighted = (pairs) => { let s = 0; for (const p of pairs) s += p[1]; let v = f() * s; for (const p of pairs) { if ((v -= p[1]) < 0) return p[0]; } return pairs[pairs.length - 1][0]; };
    return f;
  }

  // ---------- Config: реестр контента с валидацией ----------
  const Config = {
    kinds: new Map(),
    register(kind, items, validator) { // validator(item) -> строка ошибки или null
      const m = new Map(); const errs = [];
      for (const it of items) {
        if (!it || typeof it.id !== 'string') { errs.push(kind + ': запись без id'); continue; }
        if (m.has(it.id)) { errs.push(kind + ': повтор id ' + it.id); continue; }
        const e = validator ? validator(it) : null; if (e) { errs.push(kind + '/' + it.id + ': ' + e); continue; }
        m.set(it.id, it);
      }
      Config.kinds.set(kind, m);
      for (const e of errs) Log.warn('config', e);
      return errs;
    },
    get(kind, id) { const m = Config.kinds.get(kind); return m ? m.get(id) : undefined; },
    all(kind) { const m = Config.kinds.get(kind); return m ? Array.from(m.values()) : []; },
    has(kind, id) { return !!Config.get(kind, id); },
  };

  // ---------- Timers: пул таймеров вместо setTimeout, Cooldown ----------
  const Timers = {
    list: [], free: [], nid: 1,
    after(delay, fn, repeat) { const t = Timers.free.pop() || {}; t.id = Timers.nid++; t.left = delay; t.fn = fn; t.rep = repeat || 0; t.dead = false; Timers.list.push(t); return t.id; },
    every(period, fn) { return Timers.after(period, fn, period); },
    cancel(id) { for (const t of Timers.list) if (t.id === id) { t.dead = true; return true; } return false; },
    clear() { for (const t of Timers.list) t.dead = true; },
    update(dt) {
      const L = Timers.list;
      for (let i = L.length - 1; i >= 0; i--) {
        const t = L[i];
        if (!t.dead) { t.left -= dt; if (t.left <= 1e-9) { try { t.fn(); } catch (e) { Log.error('timer', 'callback', e); } if (t.rep > 0 && !t.dead) t.left += t.rep; else t.dead = true; } }
        if (t.dead) { t.fn = null; L[i] = L[L.length - 1]; L.pop(); Timers.free.push(t); }
      }
    },
    get count() { return Timers.list.length; },
  };
  class Cooldown {
    constructor(dur) { this.dur = dur; this.left = 0; }
    ready() { return this.left <= 0; }
    start(d) { this.left = d == null ? this.dur : d; }
    update(dt) { if (this.left > 0) this.left = Math.max(0, this.left - dt); }
    frac() { return this.dur > 0 ? this.left / this.dur : 0; }
  }

  // ---------- защита от частых нажатий ----------
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  function throttle(fn, ms) { let last = -Infinity; return function () { const n = nowMs(); if (n - last < ms) return undefined; last = n; return fn.apply(this, arguments); }; }
  function debounce(fn, ms) { let id = 0; return function () { const a = arguments, self = this; Timers.cancel(id); id = Timers.after(ms / 1000, () => fn.apply(self, a)); }; }
  // Анти-кликер: скорость кликов выше порога (человек физически не может) не засчитывается.
  const ClickGuard = {
    stamps: [], maxCps: 18, window: 1000, flagged: 0,
    allow(t) {
      t = t == null ? nowMs() : t; const a = ClickGuard.stamps; a.push(t);
      while (a.length && t - a[0] > ClickGuard.window) a.shift();
      if (a.length > ClickGuard.maxCps * ClickGuard.window / 1000) { ClickGuard.flagged++; a.pop(); return false; }
      return true;
    },
  };

  // ---------- Loc: локализация ----------
  const Loc = {
    lang: 'ru', dict: { ru: {}, en: {} },
    add(lang, obj) { Loc.dict[lang] = Object.assign(Loc.dict[lang] || {}, obj); },
    set(lang) { if (Loc.dict[lang]) Loc.lang = lang; },
    tr(key, vars) {
      let s = (Loc.dict[Loc.lang] && Loc.dict[Loc.lang][key]) || (Loc.dict.ru && Loc.dict.ru[key]) || key;
      if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
      return s;
    },
    plural(n, one, few, many) { n = Math.abs(n) % 100; const d = n % 10; if (n > 10 && n < 20) return many; if (d > 1 && d < 5) return few; if (d === 1) return one; return many; },
  };

  // ---------- Clock: защита от переноса времени устройства ----------
  // safeNow() не идёт назад. Если системные часы убежали вперёд больше чем на допуск, а монотонное время нет,
  // лишнее не засчитывается (смещение копится в skew).
  const Clock = {
    last: 0, skew: 0, mono0: nowMs(), wall0: Date.now(), tolerance: 5 * 60 * 1000, flags: 0,
    init(lastSeen) { Clock.last = lastSeen || 0; Clock.mono0 = nowMs(); Clock.wall0 = Date.now(); Clock.skew = 0; },
    // Время по монотонным часам с момента запуска + wall0
    expected() { return Clock.wall0 + (nowMs() - Clock.mono0); },
    safeNow() {
      const wall = Date.now(), exp = Clock.expected(), drift = wall - exp;
      if (Math.abs(drift) > Clock.tolerance) { Clock.skew = drift; Clock.flags++; }
      let t = wall - Clock.skew; if (t < Clock.last) t = Clock.last; Clock.last = t; return t;
    },
    // Сколько секунд можно засчитать за время отсутствия (не больше cap, и не отрицательно)
    elapsed(since, capSec) { const d = (Clock.safeNow() - since) / 1000; return Math.max(0, Math.min(capSec, d)); },
    dayKey(t) { const d = new Date(t == null ? Clock.safeNow() : t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); },
    dayNumber(t) { const d = new Date(t == null ? Clock.safeNow() : t); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); },
    weekNumber(t) { return Math.floor((Clock.dayNumber(t) + 3) / 7); },
  };

  // ---------- Env: проверка возможностей браузера ----------
  const Env = {
    check() {
      const r = { ok: true, missing: [], accel: null, ls: hasLS() };
      const need = [['Promise', typeof Promise !== 'undefined'], ['Map', typeof Map !== 'undefined'], ['requestAnimationFrame', typeof root.requestAnimationFrame === 'function'], ['canvas', typeof document !== 'undefined' && !!document.createElement && !!document.createElement('canvas').getContext]];
      for (const [n, ok] of need) if (!ok) { r.ok = false; r.missing.push(n); }
      if (!r.ls) r.missing.push('localStorage(необязательно)');
      r.compression = typeof CompressionStream !== 'undefined';
      r.audio = typeof (root.AudioContext || root.webkitAudioContext) !== 'undefined';
      r.accel = Env.canvasSpeed();
      return r;
    },
    // измеряем скорость canvas: если 2000 drawImage занимают слишком много, включаем экономный режим
    canvasSpeed() {
      try {
        if (typeof document === 'undefined') return null;
        const a = document.createElement('canvas'), b = document.createElement('canvas'); a.width = b.width = 384; a.height = b.height = 216;
        const x = a.getContext('2d'), y = b.getContext('2d'); y.fillStyle = '#4af'; y.fillRect(0, 0, 384, 216);
        const t0 = nowMs(); for (let i = 0; i < 300; i++) x.drawImage(b, i % 7, i % 5); x.getImageData(0, 0, 1, 1); const dt = nowMs() - t0;
        return { ms: Math.round(dt * 10) / 10, slow: dt > 120 };
      } catch (e) { return null; }
    },
    deviceId() {
      let id = lsGet('ff.device');
      if (!id) { const r = Rng(Date.now() ^ ((typeof performance !== 'undefined' ? performance.now() : 1) * 1e3)); id = ''; for (let i = 0; i < 16; i++) id += '0123456789abcdef'[r.int(0, 15)]; id = id.slice(0, 8) + '-' + id.slice(8, 12) + '-4' + id.slice(13, 16) + '-' + id.slice(0, 4) + id.slice(4, 12); lsSet('ff.device', id); }
      return id;
    },
  };

  // ---------- Balance: самопроверка формул ----------
  const Balance = {
    tests: [],
    add(name, fn) { Balance.tests.push({ name, fn }); },
    run() {
      const out = [];
      for (const t of Balance.tests) { let r; try { r = t.fn(); } catch (e) { r = 'исключение: ' + e.message; } out.push({ name: t.name, ok: r === true || r === undefined || r === null, msg: typeof r === 'string' ? r : '' }); }
      const bad = out.filter((o) => !o.ok); Log[bad.length ? 'warn' : 'info']('balance', out.length - bad.length + '/' + out.length + ' проверок пройдено');
      return { total: out.length, bad: bad.length, results: out };
    },
  };

  Object.assign(FF, { Log, Rng, cyrb53, hash36, hash32, Config, Timers, Cooldown, throttle, debounce, ClickGuard, Loc, Clock, Env, Balance, lsGet, lsSet, nowMs });
  if (typeof module !== 'undefined' && module.exports) module.exports = FF;
})(typeof window !== 'undefined' ? window : globalThis);
