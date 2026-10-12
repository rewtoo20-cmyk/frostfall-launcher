// FROSTFALL: EventBus (подписки с приоритетом, once, изоляция ошибок, счётчик подписок против утечек).
(function (root) {
  'use strict';
  const FF = root.FF = root.FF || {};
  const warn = (m) => { if (FF.Log) FF.Log.warn('bus', m); };

  class EventBus {
    constructor(opts) { this.map = new Map(); this.total = 0; this.leakLimit = (opts && opts.leakLimit) || 40; this.emitting = 0; this.stats = new Map(); }
    // fn(data, type). priority: чем больше, тем раньше. Возвращает функцию отписки.
    on(type, fn, priority) { return this._add(type, fn, priority, false); }
    once(type, fn, priority) { return this._add(type, fn, priority, true); }
    _add(type, fn, priority, once) {
      if (typeof fn !== 'function') throw new TypeError('EventBus.on: нужен обработчик');
      let a = this.map.get(type); if (!a) this.map.set(type, a = []);
      const rec = { fn, p: priority || 0, once, dead: false }; this._insert(a, rec); this.total++;
      if (a.length > this.leakLimit) warn('много подписчиков на "' + type + '": ' + a.length + ' (возможна утечка)');
      return () => this._remove(type, rec);
    }
    off(type, fn) { const a = this.map.get(type); if (!a) return false; const r = a.find((x) => x.fn === fn && !x.dead); return r ? this._remove(type, r) : false; }
    _insert(a, rec) { let i = a.length; while (i > 0 && a[i - 1].p < rec.p) i--; a.splice(i, 0, rec); } // стабильно: равные приоритеты в порядке подписки
    _remove(type, rec) {
      if (rec.dead) return false; rec.dead = true; this.total--;
      if (this.emitting === 0) this._sweep(type); else (this._dirty || (this._dirty = new Set())).add(type);
      return true;
    }
    _sweep(type) { const a = this.map.get(type); if (!a) return; const b = a.filter((r) => !r.dead); if (b.length) this.map.set(type, b); else this.map.delete(type); }
    emit(type, data) {
      this.stats.set(type, (this.stats.get(type) || 0) + 1);
      const a = this.map.get(type); if (!a) return 0; let n = 0;
      this.emitting++;
      try {
        for (let i = 0; i < a.length; i++) {
          const r = a[i]; if (r.dead) continue;
          if (r.once) this._remove(type, r);
          try { r.fn(data, type); n++; } catch (e) { if (FF.Log) FF.Log.error('bus', 'ошибка в обработчике "' + type + '"', e); } // один сбойный подписчик не ломает остальных
        }
      } finally {
        this.emitting--;
        if (this.emitting === 0 && this._dirty) { for (const t of this._dirty) this._sweep(t); this._dirty = null; }
      }
      return n;
    }
    count(type) { if (type) { const a = this.map.get(type); return a ? a.filter((r) => !r.dead).length : 0; } return this.total; }
    types() { return Array.from(this.map.keys()); }
    clear(type) { if (type) { const a = this.map.get(type); if (a) { for (const r of a) if (!r.dead) { r.dead = true; this.total--; } this.map.delete(type); } } else { this.map.clear(); this.total = 0; } }
  }
  FF.EventBus = EventBus;
  FF.bus = FF.bus || new EventBus();
  if (typeof module !== 'undefined' && module.exports) module.exports = EventBus;
})(typeof window !== 'undefined' ? window : globalThis);
