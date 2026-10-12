// FROSTFALL: вторжение Ледяного Легиона (рейд на базу), случайные события базы, экономика (цены, налоги, стоки), сезонный календарь.
// Состояние: s.ff.inv. Время приходит снаружи (ctx.now() в мс), DPS игрока — ctx.dps().
(function (root) {
  'use strict';
  const FF = root.FF = root.FF || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const INTERVAL = 6 * 3600e3, WARN = 60e3, DURATION = 120, WALL_PENALTY = 600; // секунды; 10 мин ослабленной стены
  const BASE_EVENTS = [
    { id: 'caravan', name: 'Торговый караван', w: 4, text: 'Караван привёз товары: золото +', gold: 0.05 },
    { id: 'snowstorm', name: 'Снежная буря', w: 3, text: 'Буря повредила постройки: расход золота ', gold: -0.02 },
    { id: 'thieves', name: 'Воры в ночи', w: 2, text: 'Воры унесли часть казны: ', gold: -0.03 },
    { id: 'festival', name: 'Местный праздник', w: 2, text: 'Праздник поднял дух: золото +', gold: 0.08 },
    { id: 'wanderer', name: 'Странник', w: 3, text: 'Странник оставил травы: +', herb: 3 },
  ];
  const SEASONS = [ // [месяц, день начала, месяц, день конца, id, название, тема базы]
    [12, 20, 1, 6, 'solstice', 'Зимнее солнцестояние', { sky: '#1b2a55', lights: true }],
    [2, 10, 2, 20, 'carnival', 'Ледяной карнавал', { sky: '#2a3f6b', lights: true }],
    [10, 25, 11, 2, 'shadows', 'Ночь Теней', { sky: '#241636', lights: false }],
  ];

  // ---------- экономика ----------
  const Economy = {
    // цена n-й единицы товара с геометрическим ростом
    price(base, owned, growth) { return Math.round(base * Math.pow(growth || 1.15, owned)); },
    // доход в секунду с затуханием по этапу: чтобы золото не обесценивалось
    income(stage) { return 2 * Math.pow(1.5, stage) * (1 + stage * 0.04); },
    // налог города: 0 до 100к, потом 2% сверху, максимум 10% (сток против инфляции)
    tax(gold) { return gold < 1e5 ? 0 : Math.floor(Math.min(gold * 0.1, (gold - 1e5) * 0.02)); },
    // учёт стоков для статистики (куда ушло золото)
    sink(s, amount, reason) { const e = (s.ff.eco = s.ff.eco || { sinks: {} }); e.sinks[reason] = (e.sinks[reason] || 0) + Math.max(0, amount); return amount; },
    // кристаллы только за победу над вторжением и достижения
    gemsFor(kind, n) { return kind === 'invasion' ? Math.min(10, 1 + Math.floor((n || 0) / 20)) : kind === 'ach' ? 5 : 0; },
    // проверка баланса: время окупаемости покупки при данном доходе
    payback(cost, incomePerSec) { return incomePerSec > 0 ? cost / incomePerSec : Infinity; },
  };

  function seasonOf(date) {
    const m = date.getMonth() + 1, d = date.getDate(), v = m * 100 + d;
    for (const S of SEASONS) { const a = S[0] * 100 + S[1], b = S[2] * 100 + S[3]; if (a <= b ? v >= a && v <= b : v >= a || v <= b) return { id: S[4], name: S[5], theme: S[6] }; }
    return null;
  }

  class Invasion {
    constructor(s, ctx) {
      this.s = s; this.ctx = Object.assign({ now: () => Date.now(), dps: () => 1 }, ctx || {}); this.bus = this.ctx.bus || FF.bus || null; this.rng = FF.Rng(Date.now() & 0xffffff);
      this.fix();
    }
    emit(t, d) { if (this.bus) this.bus.emit(t, d); }
    get st() { return this.s.ff.inv; }
    fix() {
      const s = this.s; s.ff = s.ff || {}; const v = s.ff.inv = (s.ff.inv && typeof s.ff.inv === 'object') ? s.ff.inv : {};
      const now = this.ctx.now(); const n = (k, d) => { if (!Number.isFinite(v[k]) || v[k] < 0) v[k] = d; };
      n('next', now + INTERVAL); n('wins', 0); n('losses', 0); n('wallUntil', 0); n('evNext', now + 20 * 60e3); n('best', 0);
      if (v.next > now + INTERVAL * 2) v.next = now + INTERVAL; // защита от перевода часов вперёд-назад
      if (!(v.act && typeof v.act === 'object' && Number.isFinite(v.act.hp) && Number.isFinite(v.act.max) && Number.isFinite(v.act.left))) v.act = null;
      if (v.act && (v.act.max <= 0 || v.act.left <= 0)) v.act = null;
    }
    warning() { const v = this.st; return !v.act && v.next - this.ctx.now() <= WARN && v.next > this.ctx.now() ? Math.ceil((v.next - this.ctx.now()) / 1000) : 0; }
    wallWeak() { return this.ctx.now() < this.st.wallUntil; }
    // Сила врага: HP = DPS * 105 c: рейд требует почти всего урона за 120 с; в слабую стену +25%
    start(force) {
      const v = this.st; if (v.act) return false; if (!force && this.ctx.now() < v.next) return false;
      const dps = Math.max(1, this.ctx.dps()), max = Math.round(dps * 105 * (this.wallWeak() ? 1.25 : 1) * (1 + Math.min(0.5, v.wins * 0.03)));
      v.act = { hp: max, max, left: DURATION, dealt: 0, weak: this.wallWeak() }; this.emit('invasion.start', { max }); return true;
    }
    // игрок наносит DPS каждую секунду, пока идёт рейд
    update(dt) {
      const v = this.st, now = this.ctx.now();
      if (!v.act) { if (now >= v.next) this.start(); this._baseEvents(now); return; }
      const a = v.act, d = Math.min(a.hp, this.ctx.dps() * dt); a.hp -= d; a.dealt += d; a.left -= dt;
      if (a.hp <= 0) this._end(true); else if (a.left <= 0) this._end(false);
    }
    _end(win) {
      const v = this.st, a = v.act, frac = clamp(a.dealt / a.max, 0, 1), now = this.ctx.now();
      const n = this.s.n || 0; let r;
      if (win) { v.wins++; r = { win: true, frac: 1, gold: Math.round(Economy.income(n) * 600), gems: Economy.gemsFor('invasion', v.wins), essence: 2 + Math.floor(v.wins / 3) }; }
      else { v.losses++; v.wallUntil = now + WALL_PENALTY * 1000; r = { win: false, frac, gold: Math.round(Economy.income(n) * 600 * frac * 0.6), gems: 0, essence: Math.floor(frac * 2) }; } // награда пропорциональна нанесённому урону
      this.s.gold += r.gold; this.s.gems += r.gems; if (this.s.ff.fg) this.s.ff.fg.essence += r.essence;
      v.best = Math.max(v.best, frac); v.act = null; v.next = now + INTERVAL * (0.8 + this.rng() * 0.4); r.wallPenalty = !win; this.emit('invasion.end', r); return r;
    }
    // Бонус к потерям золота при слабой стене: используется хуком H.gold
    goldMult() { return this.wallWeak() ? 0.8 : 1; }
    _baseEvents(now) {
      const v = this.st; if (now < v.evNext) return; v.evNext = now + (15 + this.rng() * 25) * 60e3;
      let tot = 0; for (const e of BASE_EVENTS) tot += e.w; let x = this.rng() * tot, ev = BASE_EVENTS[0]; for (const e of BASE_EVENTS) { if ((x -= e.w) < 0) { ev = e; break; } }
      const base = Math.max(100, Economy.income(this.s.n || 0) * 600); let msg = ev.text;
      if (ev.gold) { const g = Math.round(base * Math.abs(ev.gold) * 10) * (ev.gold < 0 ? -1 : 1); this.s.gold = Math.max(0, this.s.gold + g); msg += Math.abs(g); if (g < 0) Economy.sink(this.s, -g, ev.id); }
      if (ev.herb && this.s.ff.fg) { this.s.ff.fg.herb += ev.herb; msg += ev.herb; }
      this.emit('base.event', { id: ev.id, name: ev.name, text: msg });
    }
    season(date) { return seasonOf(date || new Date(this.ctx.now())); }
    // Дневной бонус сезона: множитель золота
    seasonMult(date) { const s = this.season(date); return s ? 1.1 : 1; }
    // Серия случайных рейдов для проверки баланса: доля побед при DPS, равном ожидаемому
    static balance(runs) {
      let t = 0, wins = 0; for (let i = 0; i < (runs || 200); i++) {
        const s = { gold: 0, gems: 0, n: 10, ff: {} }; const inv = new Invasion(s, { now: () => t, dps: () => 100 * (0.8 + (i % 5) * 0.1) }); inv.start(true); for (let k = 0; k < 130 && inv.st.act; k++) inv.update(1); if (inv.st.wins) wins++;
      } return wins / (runs || 200);
    }
  }
  FF.Invasion = Invasion; FF.Economy = Economy; FF.InvasionData = { BASE_EVENTS, SEASONS, INTERVAL, WARN, DURATION, WALL_PENALTY, seasonOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = FF;
})(typeof window !== 'undefined' ? window : globalThis);
