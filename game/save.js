// FROSTFALL: SaveManager. Версии и миграции, два слота (main и .bak) + tmp против потери при выключении питания,
// контрольная сумма cyrb53, лёгкое шифрование (XOR-поток), экспорт/импорт Base64 со сжатием deflate-raw,
// запрет открытия более новых сейвов, валидатор, автосохранение, просмотрщик структуры.
(function (root) {
  'use strict';
  const FF = root.FF = root.FF || {};
  const VERSION = 3, SALT = 'frostfall-2026', MAX_SIZE = 4 * 1024 * 1024;
  const log = (lv, m, x) => { if (FF.Log) FF.Log[lv]('save', m, x); };
  const hash = (s) => FF.hash36(SALT + s, 11);
  const enc = (s) => new TextEncoder().encode(s), dec = (u) => new TextDecoder().decode(u);
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (b) => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  // XOR-поток от Mulberry32: не защита от взломщика, а от лёгкой правки чисел в localStorage
  function xor(u8) { const r = FF.Rng(SALT), out = new Uint8Array(u8.length); for (let i = 0; i < u8.length; i++) out[i] = u8[i] ^ ((r() * 256) | 0); return out; }
  const pipe = async (stream, u8) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(stream)).arrayBuffer());

  // Миграции структуры внутри JSON-строки игры: ключ = версия, с которой переходим на следующую
  const MIGRATE = {
    1: (d) => { d.set = (d.set && typeof d.set === 'object') ? d.set : {}; return d; },        // v1 -> v2: появились настройки
    2: (d) => { if (!d.ff || typeof d.ff !== 'object') d.ff = {}; return d; },                  // v2 -> v3: блок состояния модулей FF
  };
  function migrate(obj, from) { let v = from; while (v < VERSION) { if (MIGRATE[v]) obj = MIGRATE[v](obj); v++; } return obj; }

  // Валидатор: что вообще можно считать сейвом игры
  function validate(obj) {
    const err = [];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['не объект'];
    for (const k of ['gold', 'gems', 'shards', 'n', 'maxN']) if (k in obj && !Number.isFinite(obj[k])) err.push('поле ' + k + ' не число');
    if ('gold' in obj && obj.gold < 0) err.push('gold < 0');
    if ('hero' in obj && (!obj.hero || !Number.isFinite(obj.hero.lvl) || obj.hero.lvl < 1)) err.push('hero.lvl');
    if ('bag' in obj && !Array.isArray(obj.bag)) err.push('bag не массив');
    if ('ff' in obj && (typeof obj.ff !== 'object' || obj.ff === null)) err.push('ff не объект');
    return err;
  }

  class SaveManager {
    constructor(opts) {
      opts = opts || {}; this.st = opts.storage || (typeof localStorage !== 'undefined' ? localStorage : null); this.busy = false; this.lastSaved = 0; this.lastHash = ''; this.timer = 0; this.fails = 0; this.lastSource = '';
    }
    _get(k) { try { return this.st ? this.st.getItem(k) : null; } catch (e) { return null; } }
    _set(k, v) { try { if (!this.st) return false; this.st.setItem(k, v); return true; } catch (e) { log('warn', 'не удалось записать ' + k, e); return false; } }
    _del(k) { try { if (this.st) this.st.removeItem(k); } catch (e) { /* ignore */ } }
    record(json) { const u = xor(enc(json)); return JSON.stringify({ v: VERSION, h: hash(json), d: b64(u) }); }
    // Разбор записи: { json, v } или { error }
    parse(raw) {
      if (!raw) return { error: 'пусто' };
      let r; try { r = JSON.parse(raw); } catch (e) { return { error: 'не JSON' }; }
      if (r && typeof r === 'object' && 'd' in r && 'h' in r) {
        if (!Number.isFinite(r.v)) return { error: 'нет версии' };
        if (r.v > VERSION) return { error: 'newer', v: r.v };
        let json; try { json = dec(xor(unb64(r.d))); } catch (e) { return { error: 'повреждено' }; }
        if (hash(json) !== r.h) return { error: 'контрольная сумма' };
        return { json, v: r.v };
      }
      if (r && typeof r === 'object' && !Array.isArray(r)) return { json: raw, v: 1, legacy: true }; // старый формат: просто JSON без обёртки
      return { error: 'неизвестный формат' };
    }
    // Запись: сначала tmp, потом main, старый main уезжает в .bak. Если питание пропадёт посередине, останется валидная копия.
    save(key, json) {
      if (typeof json !== 'string' || json.length > MAX_SIZE) { log('error', 'сейв слишком большой или не строка'); return false; }
      const old = this._get(key), hh = hash(json), rec = this.record(json);
      if (!this._set(key + '.tmp', rec)) { this.fails++; return false; }
      if (old && this.parse(old).json) this._set(key + '.bak', old); // в бэкап кладём только заведомо рабочую копию
      if (!this._set(key, rec)) { this.fails++; return false; }
      this._del(key + '.tmp'); this.lastSaved = Date.now(); this.lastHash = hh;
      if (FF.bus) FF.bus.emit('save', { size: json.length, hash: hh, t: this.lastSaved }); // задел под облако: подписчик отправит на сервер
      return true;
    }
    // Чтение: main -> tmp -> .bak -> старые ключи. Нашли в запасном слоте: чиним main.
    load(key, legacyKeys) {
      const tries = [[key, 'main'], [key + '.tmp', 'tmp'], [key + '.bak', 'bak']].concat((legacyKeys || []).map((k) => [k, 'legacy']));
      let newer = null;
      for (const [k, src] of tries) {
        const p = this.parse(this._get(k));
        if (p.error === 'newer') { newer = p; continue; }
        if (p.error) { if (p.error !== 'пусто') log('warn', 'слот ' + src + ': ' + p.error); continue; }
        let obj; try { obj = JSON.parse(p.json); } catch (e) { continue; }
        const errs = validate(obj); if (errs.length) { log('warn', 'слот ' + src + ' не прошёл проверку: ' + errs.join(', ')); continue; }
        obj = migrate(obj, p.v); const out = JSON.stringify(obj);
        this.lastSource = src;
        if (src !== 'main') { log('warn', 'восстановлено из слота ' + src); if (FF.bus) FF.bus.emit('save.restored', { from: src }); this.save(key, out); }
        return { json: out, from: src, version: p.v };
      }
      if (newer) return { error: 'newer', version: newer.v }; // не трогаем: сейв от более новой версии игры
      return null;
    }
    // Чистка: убираем хвосты tmp и мусор; возвращает число удалённых ключей
    cleanup(key) {
      let n = 0; const tmp = this._get(key + '.tmp');
      if (tmp) { if (this.parse(tmp).json && !this.parse(this._get(key)).json) { /* tmp ещё нужен */ } else { this._del(key + '.tmp'); n++; } }
      const bak = this._get(key + '.bak'); if (bak && !this.parse(bak).json) { this._del(key + '.bak'); n++; }
      return n;
    }
    // ---- экспорт / импорт в строку ----
    async pack(json) {
      this.busy = true;
      try {
        const raw = enc(json); let z = null, flag = 'r';
        if (typeof CompressionStream !== 'undefined') { try { z = await pipe(new CompressionStream('deflate-raw'), raw); flag = 'z'; } catch (e) { z = null; } }
        return 'FF' + VERSION + flag + '.' + hash(json) + '.' + b64(xor(z || raw));
      } finally { this.busy = false; }
    }
    async unpack(code) {
      this.busy = true;
      try {
        const m = /^FF(\d+)([zr])\.([0-9a-z]+)\.([A-Za-z0-9+/=]+)$/.exec(String(code).trim()); if (!m) throw new Error('Неверный формат кода');
        const v = +m[1]; if (v > VERSION) throw new Error('Код создан более новой версией игры');
        let u = xor(unb64(m[4])); if (m[2] === 'z') u = await pipe(new DecompressionStream('deflate-raw'), u);
        const json = dec(u); if (hash(json) !== m[3]) throw new Error('Контрольная сумма не совпала');
        let obj = JSON.parse(json); const errs = validate(obj); if (errs.length) throw new Error('Сейв повреждён: ' + errs[0]);
        obj = migrate(obj, v); return JSON.stringify(obj);
      } finally { this.busy = false; }
    }
    // ---- просмотрщик структуры (отладка) ----
    view(json, maxDepth) {
      const out = []; maxDepth = maxDepth || 2; let o; try { o = JSON.parse(json); } catch (e) { return ['не JSON']; }
      const walk = (v, key, depth) => {
        const pad = '  '.repeat(depth);
        if (v && typeof v === 'object') { const isA = Array.isArray(v), n = isA ? v.length : Object.keys(v).length; out.push(pad + key + (isA ? ' [' + n + ']' : ' {' + n + '}') + '  ' + JSON.stringify(v).length + ' б'); if (depth < maxDepth) for (const k in v) walk(v[k], k, depth + 1); }
        else out.push(pad + key + ': ' + String(v).slice(0, 40));
      };
      walk(o, 'save', 0); return out;
    }
    // ---- автосохранение ----
    // getJson() -> строка. Сохраняет каждые sec секунд через FF.Timers (нужен вызов FF.Timers.update(dt) в цикле).
    autosave(key, getJson, sec) { this.stopAutosave(); this.timer = FF.Timers.every(sec || 60, () => { try { this.save(key, getJson()); } catch (e) { log('error', 'автосохранение', e); } }); return this.timer; }
    stopAutosave() { if (this.timer) FF.Timers.cancel(this.timer); this.timer = 0; }
    // Синхронный бэкап при закрытии страницы и сворачивании (async там не успевает)
    hookExit(key, getJson) {
      if (typeof root.addEventListener !== 'function') return; const go = () => { try { this.save(key, getJson()); } catch (e) { /* ignore */ } };
      root.addEventListener('beforeunload', go); root.addEventListener('pagehide', go);
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) go(); });
    }
    wipe(key) { for (const k of [key, key + '.bak', key + '.tmp']) this._del(k); this.lastHash = ''; }
  }

  FF.SaveManager = SaveManager; FF.SaveFmt = { VERSION, validate, migrate, hash, xor, MAX_SIZE };
  if (typeof module !== 'undefined' && module.exports) module.exports = FF;
})(typeof window !== 'undefined' ? window : globalThis);
