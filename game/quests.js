// FROSTFALL: QuestSystem. Ежедневные (3) и еженедельные квесты по дате, поручения с дедлайном, сезонные квесты,
// цепочки (в т.ч. открытие классов), ежедневная серия входов, репутация, кодекс мира, слухи в таверне.
// Всё на событиях EventBus. Состояние лежит в одном объекте (S.ff.q) и сохраняется вместе с игрой.
(function (root) {
  'use strict';
  const FF = root.FF = root.FF || {};
  const Log = () => FF.Log;

  // ---------- шаблоны ----------
  // ev: событие шины; match(e,q) уточняет; base/per: количество = base + per*акт; fac: фракция репутации
  const TPL = [
    { id: 'kill',    ev: 'kill',    title: (q) => 'Убей ' + q.n + ' монстров',            base: 40, per: 25, fac: 'guard' },
    { id: 'elite',   ev: 'kill',    match: (e) => !!e.elite, title: (q) => 'Победи ' + q.n + ' элитных монстров', base: 3, per: 1, fac: 'guard' },
    { id: 'boss',    ev: 'boss',    title: (q) => 'Победи ' + q.n + ' боссов',             base: 2, per: 1, fac: 'guard' },
    { id: 'gather',  ev: 'gather',  match: (e, q) => !q.res || e.res === q.res, res: ['wood', 'stone', 'iron'], title: (q) => 'Добудь ' + q.n + ' ' + (RES_NAME[q.res] || 'ресурса'), base: 60, per: 40, fac: 'merchants' },
    { id: 'craft',   ev: 'craft',   title: (q) => 'Создай предметов: ' + q.n,              base: 1, per: 0.5, fac: 'mages' },
    { id: 'event',   ev: 'event',   title: (q) => 'Поймай событий: ' + q.n,                base: 2, per: 0.6, fac: 'merchants' },
    { id: 'skill',   ev: 'skill',   title: (q) => 'Используй умения ' + q.n + ' раз',      base: 6, per: 2, fac: 'mages' },
    { id: 'click',   ev: 'click',   title: (q) => 'Сделай кликов: ' + q.n,                 base: 150, per: 60, fac: 'guard' },
    { id: 'enhance', ev: 'enhance', title: (q) => 'Заточи оружие ' + q.n + ' раз',         base: 2, per: 1, fac: 'mages' },
    { id: 'raid',    ev: 'expedition', match: (e) => !!e.win, title: (q) => 'Заверши вылазок: ' + q.n, base: 1, per: 0.5, fac: 'merchants' },
  ];
  const RES_NAME = { wood: 'дерева', stone: 'камня', iron: 'железа' };

  // Сезонные квесты: окно по календарю [m1,d1]-[m2,d2], переходящее через год допустимо
  const SEASONS = [
    { id: 'newyear',  name: 'Новый год',        from: [12, 15], to: [1, 10], ev: 'event', n: 12, rw: { gems: 8, gold: 5 } },
    { id: 'spring',   name: 'Весенняя оттепель', from: [3, 20],  to: [4, 5],  ev: 'gather', n: 400, rw: { gems: 5, gold: 4 } },
    { id: 'midsummer',name: 'Долгий день',      from: [6, 18],  to: [6, 28], ev: 'boss', n: 8, rw: { gems: 5, gold: 4 } },
    { id: 'harvest',  name: 'Праздник урожая',  from: [9, 20],  to: [10, 5], ev: 'kill', n: 600, rw: { gems: 5, gold: 4 } },
    { id: 'shades',   name: 'Ночь теней',       from: [10, 25], to: [11, 2], ev: 'kill', n: 300, match: (e) => !!e.elite, rw: { gems: 6, gold: 4 } },
  ];
  const inWindow = (m, d, from, to) => { const v = m * 100 + d, a = from[0] * 100 + from[1], b = to[0] * 100 + to[1]; return a <= b ? v >= a && v <= b : v >= a || v <= b; };

  // Цепочки: шаги по порядку; onDone-награда. Используются и для открытия классов.
  const CHAINS = [
    { id: 'ch_ranger', name: 'Путь следопыта', rw: { gems: 10, unlock: 'ranger' }, steps: [{ ev: 'kill', n: 150, t: 'Убей 150 монстров' }, { ev: 'gather', n: 200, t: 'Добудь 200 ресурсов' }, { ev: 'boss', n: 3, t: 'Победи 3 боссов' }] },
    { id: 'ch_necro',  name: 'Шёпот мертвых',  rw: { gems: 12, unlock: 'necro' },  steps: [{ ev: 'kill', n: 200, t: 'Убей 200 монстров' }, { ev: 'skill', n: 40, t: 'Используй умения 40 раз' }, { ev: 'boss', n: 5, t: 'Победи 5 боссов' }] },
    { id: 'ch_rogue',  name: 'Тени гильдии',   rw: { gems: 12, unlock: 'rogue' },  steps: [{ ev: 'click', n: 1500, t: 'Сделай 1500 кликов' }, { ev: 'event', n: 6, t: 'Поймай 6 событий' }, { ev: 'kill', n: 40, match: (e) => !!e.elite, t: 'Победи 40 элитных' }] },
    { id: 'ch_priest', name: 'Свет Святилища', rw: { gems: 15, unlock: 'priest' }, steps: [{ ev: 'craft', n: 5, t: 'Создай 5 предметов' }, { ev: 'enhance', n: 10, t: 'Заточи 10 раз' }, { ev: 'expedition', n: 5, match: (e) => !!e.win, t: 'Заверши 5 вылазок' }] },
  ];

  // Фракции: ранги по очкам
  const FACTIONS = { guard: { name: 'Дозор ярла', ranks: [0, 50, 200, 600, 1500] }, merchants: { name: 'Торговцы', ranks: [0, 50, 200, 600, 1500] }, mages: { name: 'Круг рун', ranks: [0, 50, 200, 600, 1500] } };
  const RANK_NAME = ['Чужак', 'Знакомый', 'Друг', 'Союзник', 'Почётный'];

  // Кодекс: статьи открываются событиями
  const CODEX = [
    { id: 'war',    t: 'Война Тьмы', text: 'Триста лет назад лорд Скальд украл сердце Рассветных рун. С тех пор на Севере вечная зима.', on: 'start' },
    { id: 'runes',  t: 'Рассветные руны', text: 'Пять рун держали лето над Севером. Целой осталась лишь одна, у ярла Гуннара.', on: 'start' },
    { id: 'legion', t: 'Морозный Легион', text: 'Павшие воины, которые встают и идут за Скальдом. Они приходят волнами.', on: 'boss1' },
    { id: 'elite',  t: 'Элита', text: 'Монстры с золотой короной сильнее и ценнее. Дозор платит за их головы.', on: 'elite1' },
    { id: 'goblin', t: 'Гоблины-воры', text: 'Тащат всё, что плохо лежит. Убежавший гоблин забирает добычу с собой.', on: 'event1' },
    { id: 'forge',  t: 'Заточка', text: 'Чем выше уровень, тем выше риск. Свиток защиты спасёт вещь от поломки.', on: 'enhance1' },
    { id: 'raid',   t: 'Вылазки', text: 'Отряд идёт по комнатам. Туман войны скрывает всё, кроме следующей двери.', on: 'raid1' },
    { id: 'skald',  t: 'Скальд', text: 'Теперь он носит корону изо льда. Говорят, он ждёт в Пустоте.', on: 'act5' },
  ];

  const NAMES_A = ['Ульф', 'Бьёрн', 'Гуннар', 'Ингрид', 'Сигурд', 'Хильда', 'Торвальд', 'Астрид', 'Эйнар', 'Рагнхильд'], NAMES_B = ['Рыжий', 'Седой', 'Меткий', 'Тихий', 'Железнорукий', 'Хромой', 'Весёлый', 'Хмурый'];
  const TIPS = ['Элитные монстры с короной дают в 4 раза больше золота.', 'Золотую снежинку нужно успеть поймать кликом.', 'Свиток защиты спасает оружие от поломки при неудачной заточке.', 'Метель удваивает золото на 30 секунд.', 'У боссов с 20-го этапа бывает броня, регенерация или ярость.', 'Серия входов даёт всё больше самоцветов, не пропускай дни.', 'Отряд с разными классами получает бонус синергии.', 'Привал в вылазке лечит 35% здоровья, но тратит провизию.'];
  const ULT = [['Ярл ждёт ответа!', 'Дозор теряет терпение.', 'Задержка вредит репутации.']];

  const mkRng = (s) => FF.Rng(s);
  const cid = (kind, key, i) => kind[0] + key + '_' + i;

  // Порядок шаблонов на день: перестановка фиксирована, индекс (3*n + k) mod T даёт 3 разных шаблона,
  // а соседние дни не пересекаются (диапазоны длиной 3 и 3 внутри 10).
  const PERM = (() => { const r = mkRng('daily-perm'); return r.shuffle(TPL.map((_, i) => i)); })();
  function dailyIds(dayNum) { const out = []; for (let k = 0; k < 3; k++) out.push(PERM[(((3 * dayNum + k) % TPL.length) + TPL.length) % TPL.length]); return out; }

  class QuestSystem {
    // st: хранимый объект (S.ff.q); bus: EventBus; ctx: { act():число, grant(rw), now():мс }
    constructor(st, bus, ctx) {
      this.s = st; this.bus = bus; this.ctx = ctx || {}; this.subs = [];
      this.heal(); this.refresh(); this.attach();
      this._t = 0;
    }
    now() { return this.ctx.now ? this.ctx.now() : (FF.Clock ? FF.Clock.safeNow() : Date.now()); }
    act() { return Math.max(0, this.ctx.act ? this.ctx.act() : 0); }

    // ---- самовосстановление (структура могла испортиться) ----
    heal() {
      const s = this.s;
      if (!Array.isArray(s.list)) s.list = [];
      const ok = (q) => q && typeof q === 'object' && typeof q.id === 'string' && TPL.some((t) => t.id === q.tpl || q.kind === 'chain' || q.kind === 'season') && Number.isFinite(q.n) && q.n > 0 && Number.isFinite(q.p);
      const seen = new Set(), before = s.list.length;
      s.list = s.list.filter((q) => { if (!ok(q) || seen.has(q.id)) return false; seen.add(q.id); q.p = Math.max(0, Math.min(q.n, q.p)); q.done = !!q.done; q.claimed = !!q.claimed; q.rw = q.rw && typeof q.rw === 'object' ? q.rw : { gold: 0, gems: 0 }; return true; });
      if (s.list.length !== before && Log()) Log().warn('quests', 'удалено повреждённых квестов: ' + (before - s.list.length));
      for (const k of ['day', 'week', 'maxDay']) if (!Number.isFinite(s[k])) s[k] = 0;
      s.stats = Object.assign({ done: 0, claimed: 0, daily: 0, weekly: 0, failed: 0, chains: 0 }, s.stats && typeof s.stats === 'object' ? s.stats : {});
      for (const k in s.stats) if (!Number.isFinite(s.stats[k])) s.stats[k] = 0;
      if (!s.rep || typeof s.rep !== 'object') s.rep = {}; for (const f in FACTIONS) if (!Number.isFinite(s.rep[f])) s.rep[f] = 0;
      if (!s.codex || typeof s.codex !== 'object') s.codex = {};
      if (!s.chain || typeof s.chain !== 'object') s.chain = {};
      if (!s.streak || typeof s.streak !== 'object') s.streak = {}; for (const k of ['last', 'n', 'best', 'claimedDay']) if (!Number.isFinite(s.streak[k])) s.streak[k] = 0;
      if (!s.unlocked || typeof s.unlocked !== 'object') s.unlocked = {};
      if (!s.seasonDone || typeof s.seasonDone !== 'object') s.seasonDone = {};
    }

    // ---- дата с защитой от отката часов ----
    today() { const n = Math.max(FF.Clock.dayNumber(this.now()), this.s.maxDay || 0); this.s.maxDay = n; return n; }

    // ---- генерация ----
    make(tpl, kind, rng, id, mult, ttl) {
      const a = this.act(), n = Math.max(1, Math.round((tpl.base + tpl.per * a) * (mult || 1)));
      const q = { id, tpl: tpl.id, kind, n, p: 0, done: false, claimed: false, fac: tpl.fac, ttl: ttl || 0 };
      if (tpl.res) q.res = tpl.res[Math.floor(rng() * tpl.res.length)];
      const k = kind === 'weekly' ? 5 : 1;
      q.rw = { gold: Math.round(n * 8 * (1 + a) * k), gems: kind === 'weekly' ? 6 : 1 + (rng() < 0.2 ? 1 : 0), rep: { [tpl.fac]: kind === 'weekly' ? 40 : 10 } };
      return q;
    }
    refresh() {
      const s = this.s, d = this.today(), w = Math.floor((d + 3) / 7), a = this.act();
      let changed = false;
      if (s.day !== d) {
        // непринятые награды вчерашних квестов сгорают; прогресс по ним нет
        s.list = s.list.filter((q) => q.kind !== 'daily'); const r = mkRng('d' + d);
        for (const [i, ti] of dailyIds(d).entries()) s.list.push(this.make(TPL[ti], 'daily', r, cid('daily', d, i), 1, 0));
        s.day = d; changed = true; this._login(d);
      }
      if (s.week !== w) {
        s.list = s.list.filter((q) => q.kind !== 'weekly'); const r = mkRng('w' + w);
        s.list.push(this.make(r.pick(TPL), 'weekly', r, cid('weekly', w, 0), 6, 0)); s.week = w; changed = true;
      }
      // сезонный квест на текущую дату
      const dt = new Date(this.now()), m = dt.getMonth() + 1, dd = dt.getDate();
      for (const se of SEASONS) {
        const key = se.id + ':' + dt.getFullYear(), id = 's_' + key;
        if (inWindow(m, dd, se.from, se.to) && !s.seasonDone[key] && !s.list.some((q) => q.id === id)) { s.list.push({ id, tpl: se.id, kind: 'season', n: se.n, p: 0, done: false, claimed: false, ev: se.ev, season: se.id, rw: { gems: se.rw.gems, gold: se.rw.gold * 100 * (1 + a), rep: {} }, ttl: 0 }); changed = true; }
        else if (!inWindow(m, dd, se.from, se.to)) { const n0 = s.list.length; s.list = s.list.filter((q) => q.season !== se.id || q.claimed); if (s.list.length !== n0) changed = true; }
      }
      if (changed && this.bus) this.bus.emit('quest.refresh', { day: d });
      return changed;
    }
    // Ежедневный вход: серия растёт, если вчера тоже заходили; пропуск сбрасывает до 1
    _login(d) {
      const st = this.s.streak; if (st.last === d) return;
      st.n = st.last === d - 1 ? st.n + 1 : 1; st.last = d; st.best = Math.max(st.best, st.n);
      if (this.bus) this.bus.emit('streak', { n: st.n });
    }
    streakReward(n) { n = n || this.s.streak.n; return { gems: Math.min(6, 1 + Math.floor(n / 3)), gold: 200 * (1 + this.act()) * Math.min(n, 14) }; }
    streakClaimable() { return this.s.streak.n > 0 && this.s.streak.claimedDay !== this.s.streak.last; }
    claimStreak() { if (!this.streakClaimable()) return null; const r = this.streakReward(); this.s.streak.claimedDay = this.s.streak.last; this.ctx.grant && this.ctx.grant(r); if (this.bus) this.bus.emit('quest.claimed', { streak: true, rw: r }); return r; }

    // ---- события ----
    attach() {
      const evs = new Set(TPL.map((t) => t.ev)); for (const se of SEASONS) evs.add(se.ev); for (const ch of CHAINS) for (const st of ch.steps) evs.add(st.ev);
      for (const ev of evs) this.subs.push(this.bus.on(ev, (e) => this.onEvent(ev, e || {}), 5));
      this.subs.push(this.bus.on('kill', (e) => { if (e && e.elite) this.codex('elite1'); }));
      this.subs.push(this.bus.on('boss', () => this.codex('boss1')));
      this.subs.push(this.bus.on('event', () => this.codex('event1')));
      this.subs.push(this.bus.on('enhance', () => this.codex('enhance1')));
      this.subs.push(this.bus.on('expedition', () => this.codex('raid1')));
      this.codex('start');
    }
    detach() { for (const u of this.subs) u(); this.subs.length = 0; }
    onEvent(ev, e) {
      const add = Math.max(1, e.n || 1);
      for (const q of this.s.list) {
        if (q.done || q.failed) continue;
        let match = true, qev;
        if (q.kind === 'season') { const se = SEASONS.find((x) => x.id === q.season); if (!se) continue; qev = se.ev; match = !se.match || se.match(e, q); }
        else { const t = TPL.find((x) => x.id === q.tpl); if (!t) continue; qev = t.ev; match = !t.match || t.match(e, q); }
        if (qev !== ev || !match) continue;
        q.p = Math.min(q.n, q.p + add); if (q.p >= q.n) this._done(q);
      }
      this._chains(ev, e, add);
    }
    _done(q) { q.done = true; this.s.stats.done++; if (q.kind === 'daily') this.s.stats.daily++; if (q.kind === 'weekly') this.s.stats.weekly++; if (this.bus) this.bus.emit('quest.done', q); }
    _chains(ev, e, add) {
      for (const ch of CHAINS) {
        const c = this.s.chain[ch.id] || (this.s.chain[ch.id] = { step: 0, p: 0, done: false, active: false }); if (!c.active || c.done) continue;
        const st = ch.steps[c.step]; if (!st || st.ev !== ev || (st.match && !st.match(e))) continue;
        c.p = Math.min(st.n, c.p + add);
        if (c.p >= st.n) { c.step++; c.p = 0; if (this.bus) this.bus.emit('quest.step', { chain: ch.id, step: c.step }); if (c.step >= ch.steps.length) { c.done = true; this.s.stats.chains++; this._reward(ch.rw); if (ch.rw.unlock) { this.s.unlocked[ch.rw.unlock] = 1; if (this.bus) this.bus.emit('class.unlock', { id: ch.rw.unlock }); } if (this.bus) this.bus.emit('quest.done', { id: ch.id, chain: true }); } }
      }
    }
    startChain(id) { const ch = CHAINS.find((c) => c.id === id); if (!ch) return false; const c = this.s.chain[id] || (this.s.chain[id] = { step: 0, p: 0, done: false, active: false }); if (c.done || c.active) return false; c.active = true; return true; }
    chainInfo(id) { const ch = CHAINS.find((c) => c.id === id), c = this.s.chain[id] || { step: 0, p: 0, done: false, active: false }; if (!ch) return null; const st = ch.steps[Math.min(c.step, ch.steps.length - 1)]; return { name: ch.name, active: c.active, done: c.done, step: c.step, steps: ch.steps.length, text: st.t, p: c.p, n: st.n }; }

    // ---- выдача наград ----
    _reward(rw) { if (this.ctx.grant) this.ctx.grant(rw); if (rw && rw.rep) for (const f in rw.rep) this.addRep(f, rw.rep[f]); }
    claim(id) {
      const q = this.s.list.find((x) => x.id === id); if (!q || !q.done || q.claimed || q.failed) return false;
      q.claimed = true; this.s.stats.claimed++; this._reward(q.rw);
      if (q.kind === 'season') this.s.seasonDone[q.season + ':' + new Date(this.now()).getFullYear()] = 1;
      if (this.bus) this.bus.emit('quest.claimed', q); return true;
    }
    claimAll() { let n = 0; for (const q of this.s.list.slice()) if (this.claim(q.id)) n++; return n; }
    // ---- поручения с дедлайном (ультиматум жителей) ----
    // ttl в секундах игрового времени; по истечении репутация падает, награда не выдаётся
    addBounty(tplId, ttl) { const t = TPL.find((x) => x.id === tplId); if (!t) return null; const r = mkRng('b' + this.now() + this.s.list.length), q = this.make(t, 'bounty', r, 'b' + this.now() + '_' + this.s.list.length, 1.3, ttl || 600); q.giver = this.npcName(r); this.s.list.push(q); return q; }
    npcName(r) { r = r || mkRng(this.now()); return r.pick(NAMES_A) + ' ' + r.pick(NAMES_B); }
    update(dt) {
      this._t += dt; for (const q of this.s.list) { if (q.ttl > 0 && !q.done && !q.failed) { q.ttl -= dt; if (q.ttl <= 0) { q.failed = true; this.s.stats.failed++; this.addRep(q.fac || 'guard', -15); if (this.bus) this.bus.emit('quest.failed', q); } } }
      if (this._t >= 10) { this._t = 0; this.refresh(); } // смена суток отслеживается без перезапуска игры
    }
    // ---- репутация ----
    addRep(f, v) { if (!FACTIONS[f]) return; const old = this.rank(f); this.s.rep[f] = Math.max(0, this.s.rep[f] + v); if (this.rank(f) > old && this.bus) this.bus.emit('rep.rank', { f, rank: this.rank(f) }); }
    rank(f) { const r = FACTIONS[f].ranks, v = this.s.rep[f] || 0; let k = 0; for (let i = 0; i < r.length; i++) if (v >= r[i]) k = i; return k; }
    rankName(f) { return RANK_NAME[this.rank(f)]; }
    discount(f) { return 1 - 0.03 * this.rank(f); } // цены у фракции дешевле с рангом
    // ---- кодекс ----
    codex(on) { for (const c of CODEX) if (c.on === on && !this.s.codex[c.id]) { this.s.codex[c.id] = 1; if (on !== 'start' && this.bus) this.bus.emit('codex', { id: c.id }); } }
    codexList() { return CODEX.map((c) => ({ id: c.id, t: c.t, text: this.s.codex[c.id] ? c.text : '???', known: !!this.s.codex[c.id] })); }
    // ---- слухи (таверна): 3 в день, с наводкой на зону ----
    rumors(zones) {
      const r = mkRng('rum' + this.today()), z = zones && zones.length ? zones : ['Ледяной лес'], out = [];
      const T = ['Говорят, в зоне «{z}» видели меч в сугробе.', 'Купец клянётся, что в «{z}» гоблины прячут сундук.', 'В «{z}» босс стал сильнее, берегите таймер.', 'Стражник шепчет: в «{z}» метель приходит чаще.', 'В «{z}» руны светятся по ночам.', 'Кто-то видел золотую снежинку над «{z}».'];
      for (let i = 0; i < 3; i++) out.push(T[(r.int(0, T.length - 1) + i) % T.length].replace('{z}', r.pick(z))); return out;
    }
    tip() { return FF.Rng(this.now() >> 12).pick(TIPS); }
    // ---- статистика и отладка ----
    info(q) { return TPL.find((t) => t.id === q.tpl) ? TPL.find((t) => t.id === q.tpl).title(q) : (SEASONS.find((x) => x.id === q.season) || { name: q.tpl }).name + ': ' + q.n; }
    marker() { return this.s.list.some((q) => q.done && !q.claimed && !q.failed) || this.streakClaimable() ? '?' : this.s.list.some((q) => !q.done && !q.failed) ? '...' : ''; }
    // Для консоли: FF.q.debug.reset(), .complete(), .claim()
    get debug() { const self = this; return { reset() { self.s.list.length = 0; self.s.day = 0; self.s.week = 0; self.refresh(); return self.s.list.length; }, complete() { for (const q of self.s.list) if (!q.done) { q.p = q.n; self._done(q); } return self.s.list.length; }, claim() { return self.claimAll(); } }; }
  }

  // Проверки целостности контента (пункты 137 и 140)
  QuestSystem.checkIds = function () { const ids = new Set(), errs = []; for (const t of TPL) { if (ids.has(t.id)) errs.push('повтор ' + t.id); ids.add(t.id); } for (const c of CHAINS) { if (ids.has(c.id)) errs.push('повтор ' + c.id); ids.add(c.id); } for (const s of SEASONS) { if (ids.has(s.id)) errs.push('повтор ' + s.id); ids.add(s.id); } return errs; };
  // Ни один ежедневный квест не повторяется два дня подряд; 3 разных шаблона в день на год вперёд
  QuestSystem.checkYear = function (startDay, days) { const errs = []; let prev = null; for (let i = 0; i < (days || 365); i++) { const d = (startDay || 20000) + i, cur = dailyIds(d); if (new Set(cur).size !== 3) errs.push('день ' + d + ': одинаковые шаблоны'); if (prev && cur.some((x) => prev.includes(x))) errs.push('день ' + d + ': повтор со вчера'); prev = cur; } return errs; };

  FF.QuestSystem = QuestSystem; FF.QuestData = { TPL, SEASONS, CHAINS, FACTIONS, CODEX, TIPS, dailyIds, RANK_NAME };
  if (typeof module !== 'undefined' && module.exports) module.exports = FF;
})(typeof window !== 'undefined' ? window : globalThis);
