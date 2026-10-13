/* FROSTFALL: сетевой клиент. Всё необязательно: без сервера игра работает офлайн. */
(function (W) {
  'use strict';
  const FF = W.FF = W.FF || {};
  const DEFAULT_BASE = 'https://frostfall-api.rewtoo20.workers.dev';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  class Net {
    constructor(o) {
      o = o || {}; this.store = o.storage || null; this.fetch = o.fetch !== undefined ? o.fetch : (typeof fetch === 'function' ? fetch.bind(W) : null);
      this.base = o.base || this._get('ff.net.base') || DEFAULT_BASE; this.timeout = o.timeout || 8000; this.retries = o.retries == null ? 2 : o.retries; this.backoff = o.backoff == null ? 400 : o.backoff;
      this.minGap = o.minGap == null ? 400 : o.minGap; this.now = o.now || (() => Date.now());
      const p = this._json('ff.net') || {}; this.id = p.id || null; this.token = p.token || null; this.nick = p.nick || null; this.cloudTs = p.cloudTs || {}; this.sent = p.sent || {};
      this.status = this.fetch ? 'unknown' : 'off'; this.ping = 0; this.log = []; this.cache = {}; this.last = {}; this.queue = []; this.stats = { ok: 0, fail: 0, retry: 0, throttled: 0 };
      this.listeners = [];
    }
    // Сжатие тела (gzip) для больших запросов; сервер понимает заголовок x-enc. Без CompressionStream или при отказе сервера шлём как есть.
    async _gz(str) { try { if (typeof CompressionStream === 'undefined' || typeof Response === 'undefined') return null; const cs = new CompressionStream('gzip'), w = cs.writable.getWriter(); w.write(new TextEncoder().encode(str)); w.close(); return new Uint8Array(await new Response(cs.readable).arrayBuffer()); } catch (e) { return null; } }
    _get(k) { try { return this.store && this.store.getItem(k); } catch (e) { return null; } }
    _json(k) { try { const t = this._get(k); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
    _save() { try { if (this.store) this.store.setItem('ff.net', JSON.stringify({ id: this.id, token: this.token, nick: this.nick, cloudTs: this.cloudTs, sent: this.sent })); } catch (e) { /* квота */ } }
    on(fn) { this.listeners.push(fn); }
    _set(st) { if (st !== this.status) { this.status = st; this.listeners.forEach((f) => { try { f(st); } catch (e) { /* ignore */ } }); } }
    get registered() { return !!(this.id && this.token); }
    // ---- запрос: таймаут, повторы с нарастающей паузой только при сетевых ошибках и 5xx, троттлинг по пути
    async req(method, path, body, o) {
      o = o || {}; if (!this.fetch) return { ok: false, error: 'offline', offline: true };
      const key = method + path.split('?')[0], t0 = this.now();
      if (!o.nothrottle && this.last[key] && t0 - this.last[key] < this.minGap) { this.stats.throttled++; await sleep(this.minGap - (t0 - this.last[key])); }
      this.last[key] = this.now();
      const headers = { 'content-type': 'application/json' }; if (o.auth !== false && this.registered) { headers['x-id'] = this.id; headers['x-token'] = this.token; }
      let payload = body == null ? undefined : JSON.stringify(body), gz = false;
      if (payload && payload.length >= (this.gzMin || 1024) && !this.noGzip && o.gzip !== false) { const z = await this._gz(payload); if (z && z.length < payload.length) { this.stats.saved = (this.stats.saved || 0) + payload.length - z.length; payload = z; headers['x-enc'] = 'gzip'; gz = true; } }
      let lastErr = 'network';
      for (let a = 0; a <= this.retries; a++) {
        const ac = typeof AbortController === 'function' ? new AbortController() : null, tm = ac ? setTimeout(() => ac.abort(), this.timeout) : null, s = this.now();
        try {
          const r = await this.fetch(this.base + path, { method, headers, body: payload, signal: ac ? ac.signal : undefined }); if (tm) clearTimeout(tm);
          let j = null; try { j = await r.json(); } catch (e) { j = null; }
          this.ping = this.now() - s; this._log(method, path, r.status, this.ping);
          if (r.status >= 500 && a < this.retries) { this.stats.retry++; await sleep(this.backoff * Math.pow(2, a)); continue; }
          if (gz && r.status === 400) { this.noGzip = true; return this.req(method, path, body, Object.assign({}, o, { gzip: false, nothrottle: true })); } // старый сервер не понял сжатие
          this._set('online'); const ok = r.ok && j && j.ok !== false; if (ok) this.stats.ok++; else this.stats.fail++;
          return Object.assign({ status: r.status }, j || { ok: false, error: 'bad response' });
        } catch (e) {
          if (tm) clearTimeout(tm); lastErr = e && e.name === 'AbortError' ? 'timeout' : 'network'; this._log(method, path, 0, this.now() - s, lastErr);
          if (a < this.retries) { this.stats.retry++; await sleep(this.backoff * Math.pow(2, a)); }
        }
      }
      this.stats.fail++; this._set('offline'); return { ok: false, error: lastErr, offline: true };
    }
    _log(m, p, st, ms, e) { this.log.push({ t: this.now(), m, p: p.split('?')[0], st, ms, e }); if (this.log.length > 100) this.log.shift(); }
    async check() { const r = await this.req('GET', '/api/ping', null, { auth: false, nothrottle: true }); if (r.ok) { this.skew = r.t - this.now(); if (this.queue.length) this.flush(); } return !!r.ok; }
    async register(nick) {
      const r = await this.req('POST', '/api/register', { nick }, { auth: false });
      if (r.ok) { this.id = r.id; this.token = r.token; this.nick = r.nick; this._save(); }
      return r;
    }
    // Перенос аккаунта на другое устройство: код = id + токен (хранить как пароль!)
    exportKey() { if (!this.registered) return null; try { return btoa(unescape(encodeURIComponent(JSON.stringify({ i: this.id, t: this.token, n: this.nick })))); } catch (e) { return null; } }
    async importKey(code) {
      let o; try { o = JSON.parse(decodeURIComponent(escape(atob(String(code).trim())))); } catch (e) { return { ok: false, error: 'Код не подошёл' }; }
      if (!o || !/^[0-9a-f-]{36}$/.test(o.i || '') || !o.t || !o.n) return { ok: false, error: 'Код не подошёл' };
      const old = { id: this.id, token: this.token, nick: this.nick }; this.id = o.i; this.token = o.t; this.nick = o.n;
      const r = await this.req('GET', '/api/save?slot=0', null, { nothrottle: true });
      if (!r.ok) { this.id = old.id; this.token = old.token; this.nick = old.nick; return { ok: false, error: r.offline ? 'Нет связи с сервером' : 'Код недействителен' }; }
      this.cloudTs = {}; this.sent = {}; this._save(); return { ok: true, nick: this.nick };
    }
    logout() { this.id = this.token = this.nick = null; this.cloudTs = {}; this.sent = {}; this._save(); }
    // ---- рейтинг: шлём только если значение выросло; при офлайне складываем в очередь
    async submit(board, value) {
      if (!this.registered || !(value > (this.sent[board] || 0))) return null;
      if (this.blocked) return { ok: false, error: 'blocked', blocked: this.blocked };
      const r = await this.req('POST', '/api/score', { board, value, ver: this.build && this.build.ver, bh: this.build && this.build.bh });
      if (r.status === 403) { this.blocked = 'modified'; return r; }
      if (r.ok) { this.sent[board] = value; this._save(); return r; }
      if (r.offline && !this.queue.some((q) => q.board === board)) this.queue.push({ board, value }); else if (r.offline) this.queue.find((q) => q.board === board).value = value;
      return r;
    }
    async flush() { const q = this.queue.splice(0); for (const x of q) await this.submit(x.board, x.value); return this.queue.length; }
    async top(board, n, force) {
      const k = board + ':' + (n || 10), c = this.cache[k];
      if (!force && c && this.now() - c.t < 60000) return Object.assign({ cached: true }, c.r);
      const r = await this.req('GET', '/api/top?board=' + encodeURIComponent(board) + '&n=' + (n || 10), null, { auth: false });
      if (r.ok) { this.cache[k] = { t: this.now(), r }; return r; }
      return c ? Object.assign({ stale: true }, c.r) : r;
    }
    async news() { const c = this.cache.news; if (c && this.now() - c.t < 300000) return c.r; const r = await this.req('GET', '/api/news', null, { auth: false }); if (r.ok) this.cache.news = { t: this.now(), r }; return r; }
    // ---- облако: base = метка, которую клиент видел последней; при расхождении сервер отвечает 409
    async cloudPush(slot, data, force) {
      const r = await this.req('PUT', '/api/save?slot=' + (slot | 0), { data, base: this.cloudTs[slot] || 0, force: !!force });
      if (r.ok) { this.cloudTs[slot] = r.ts; this._save(); }
      return r.status === 409 ? { ok: false, conflict: true, server: r.server } : r;
    }
    async cloudPull(slot) { const r = await this.req('GET', '/api/save?slot=' + (slot | 0)); if (r.ok && r.save) { this.cloudTs[slot] = r.save.ts; this._save(); } return r; }
    // ---- ежедневный бонус, мировой босс, сезоны, друзья
    daily() { return this.req('GET', '/api/daily'); }
    dailyClaim() { return this.req('POST', '/api/daily', {}); }
    boss() { return this.req('GET', '/api/boss'); }
    bossHit(pts) { return this.req('POST', '/api/boss/hit', { pts }, { nothrottle: true }); }
    bossClaim(day) { return this.req('POST', '/api/boss/claim', { day }); }
    season(board) { return this.req('GET', '/api/season?board=' + encodeURIComponent(board || 'stage')); }
    seasonClaim(board) { return this.req('POST', '/api/season/claim', { board: board || 'stage' }); }
    friends(nicks, board) { return this.req('GET', '/api/friends?board=' + encodeURIComponent(board || 'stage') + '&nicks=' + encodeURIComponent((nicks || []).join(',')), null, { auth: false }); }
    promo(code) { return this.req('POST', '/api/promo', { code }); }
    feedback(text) { return this.req('POST', '/api/feedback', { text }); }
    crash(ver, text) { return this.req('POST', '/api/crash', { ver, text }, { nothrottle: true, }); }
    debugDump() { return JSON.stringify({ base: this.base, status: this.status, ping: this.ping, nick: this.nick, stats: this.stats, queue: this.queue, log: this.log }, null, 1); }
  }
  FF.Net = Net; FF.NET_BASE = DEFAULT_BASE;
  if (typeof module !== 'undefined' && module.exports) module.exports = FF;
})(typeof window !== 'undefined' ? window : globalThis);
