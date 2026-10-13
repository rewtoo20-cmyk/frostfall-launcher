// FROSTFALL: расширения v1.8 (логика без рисования): время суток и погода, защита от кликеров и дребезга, кэш статов (dirty flag),
// автосохранение раз в минуту, проверка хранилища, подсказки, обучение, журнал диалогов, проверка дубликатов легенд, проверка заданий акта,
// друзья, проверка целостности файлов, WebRTC-канал, виртуальный джойстик, субпиксельное движение, адаптивное качество.
(function (root) {
  'use strict';
  const FF = root.FF = root.FF || {};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad = (n) => (n < 10 ? '0' : '') + n;
  function cyrb53(str, seed) { // тот же алгоритм, что в util.js и pack.py
    seed = seed | 0; str = String(str); let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  const rng = (seed) => (FF.Rng ? FF.Rng(seed) : { weighted: (p) => p[0][0], pick: (a) => a[0], range: (a) => a });
  const ffs = (S) => (S.ff && typeof S.ff === 'object' ? S.ff : (S.ff = {}));

  // ---------- игровое время и погода (пункты 62, 100, 417) ----------
  const DAY_SECS = 720; // 12 минут игры = игровые сутки
  const WNAME = { sun: 'Ясно', snow: 'Снег', blizzard: 'Метель' };
  const Time = {
    DAY_SECS,
    hour(S) { const p = (S && S.st && S.st.play) || 0; return (((p / DAY_SECS) * 24 + 8) % 24 + 24) % 24; },
    dayIdx(S) { const p = (S && S.st && S.st.play) || 0; return Math.floor(((p / DAY_SECS) * 24 + 8) / 24); },
    isNight(h) { return h >= 21 || h < 5.5; },
    light(h) { if (h >= 7 && h <= 18) return 1; if (h >= 5 && h < 7) return 0.25 + 0.75 * (h - 5) / 2; if (h > 18 && h < 21) return 1 - 0.75 * (h - 18) / 3; return 0.25; },
    // цвет затемнения: ночью синий, на рассвете и закате оранжевый
    tint(h) { const l = this.light(h), dusk = (h >= 5 && h < 7.5) || (h > 17.5 && h < 21.5), k = 1 - l; if (k <= 0.001) return null; return dusk && l > 0.3 ? { r: 255, g: 130, b: 60, a: 0.22 * Math.sin(Math.PI * clamp(k / 0.6, 0, 1)) + 0.04 } : { r: 10, g: 20, b: 64, a: 0.62 * k }; },
    fmt(h) { const hh = Math.floor(h), mm = Math.floor((h - hh) * 6) * 10; return pad(hh) + ':' + pad(mm); },
    weather(S) { const blk = Math.floor(this.hour(S) / 6), r = rng('wx' + this.dayIdx(S) + ':' + blk); return r.weighted([['sun', 40], ['snow', 38], ['blizzard', 22]]); },
    wname(S) { const h = this.hour(S), w = this.weather(S); return w === 'sun' && this.isNight(h) ? 'Ясная ночь' : WNAME[w]; },
  };

  // ---------- защита от кликеров и дребезга (пункты 20, 24) ----------
  class ClickGuard {
    constructor(o) { o = o || {}; this.max = o.max || 15; this.uiMs = o.uiMs || 60; this.t = []; this.iv = []; this.last = 0; this.flags = 0; this.until = 0; this.uiT = Object.create(null); this.blocked = 0; }
    // удары по сцене: не больше max в секунду; ровный как часы ритм (разброс < 2 мс) = автокликер, лимит режется до 6/с на минуту
    allow(now) {
      const t = this.t; while (t.length && now - t[0] > 1000) t.shift();
      if (this.last) { this.iv.push(now - this.last); if (this.iv.length > 40) this.iv.shift(); } this.last = now;
      if (this.iv.length >= 25) { const n = this.iv.length, m = this.iv.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(this.iv.reduce((a, b) => a + (b - m) * (b - m), 0) / n); if (m < 120 && sd < 2) { this.flags++; this.until = now + 60000; this.iv.length = 0; } }
      const cap = now < this.until ? Math.min(this.max, 6) : this.max;
      if (t.length >= cap) { this.blocked++; return false; } t.push(now); return true;
    }
    get suspicious() { return this.flags > 0; }
    // кнопки интерфейса: один и тот же элемент нельзя нажать чаще раза в uiMs
    ui(key, now, ms) { const l = this.uiT[key]; if (l !== undefined && now - l < (ms || this.uiMs)) { this.blocked++; return false; } this.uiT[key] = now; if (++this._n > 400) { this.uiT = Object.create(null); this._n = 0; } return true; }
  }
  ClickGuard.prototype._n = 0;
  const debounce = (fn, ms) => { let t = null; return function () { const a = arguments, th = this; clearTimeout(t); t = setTimeout(() => fn.apply(th, a), ms); }; };

  // ---------- кэш производных статов с dirty flag (пункт 13) ----------
  const Stats = {
    ver: 0, c: null, hits: 0, calc: 0, ttl: 250,
    mark() { this.ver++; },
    get(S, C, now) {
      const c = this.c; if (c && c.v === this.ver && now - c.t < this.ttl) { this.hits++; return c; }
      this.calc++; return (this.c = { v: this.ver, t: now, click: C.clickDmg(S), dps: C.dps(S), crit: C.critChance(S), critm: C.critMult(S) });
    },
    // оборачиваем действия, меняющие характеристики, чтобы помечать кэш «грязным»
    install(C) { for (const n of ['buyUp', 'buyAlly', 'buyGem', 'equipItem', 'sellItem', 'sellWeak', 'prestige', 'useSkill', 'callBoss', 'load', 'newState']) { const f = C[n]; if (typeof f === 'function' && !f.__dirty) { C[n] = function () { Stats.mark(); return f.apply(this, arguments); }; C[n].__dirty = 1; } } return this; },
  };

  // ---------- автосохранение раз в минуту (пункт 30) ----------
  const Autosave = { MS: 60000, due(now, last) { return now - last >= this.MS; } };

  // ---------- проверка локального хранилища (пункт 406) ----------
  const Storage = {
    info: { ok: null, err: null, used: 0, quota: 0 },
    check(st) {
      const i = this.info; try { st = st || root.localStorage; const k = 'ff.__probe'; st.setItem(k, 'x'.repeat(2048)); const back = st.getItem(k); st.removeItem(k); i.ok = back && back.length === 2048; } catch (e) { i.ok = false; i.err = (e && e.name) || 'error'; }
      try { let n = 0; const s2 = st || root.localStorage; for (let q = 0; q < s2.length; q++) { const k = s2.key(q); if (/^(frostfall|ff\.)/.test(k)) n += k.length + (s2.getItem(k) || '').length; } i.used = n * 2; } catch (e) { /* ignore */ }
      return i;
    },
    async estimate() { try { if (root.navigator && navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); this.info.quota = e.quota || 0; this.info.usage = e.usage || 0; } } catch (e) { /* ignore */ } return this.info; },
    // текст предупреждения или null
    warning() { const i = this.info; if (i.ok === false) return 'Хранилище браузера недоступно: прогресс не сохранится. Делай Экспорт в настройках.'; if (i.quota && i.usage / i.quota > 0.9) return 'Хранилище почти заполнено: освободи место'; if (i.used > 4.5e6) return 'Сохранения занимают много места (' + (i.used / 1048576).toFixed(1) + ' МБ)'; return null; },
  };

  // ---------- подсказки на экранах загрузки (пункт 134) ----------
  const TIPS = [
    'Лучшие вещи надеваются сами: включи это в настройках.', 'Каждые 25 уровней силы клик удваивается.', 'Золотая снежинка на сцене даёт золото, самоцветы или редкую вещь. Лови её кликом.',
    'Гоблин-вор убегает с добычей: бей его быстрее.', 'Метель удваивает золото на 30 секунд.', 'Боссов можно вызвать самому кнопкой с короной.', 'В столице жители дают задания: ищи «!» над головой.',
    'Герои из отряда воюют в походе, остальные ходят в вылазки.', 'Перерождение даёт осколки льда: +5% урона навсегда за каждый.', 'Ремонтируй оружие в Кузнице: изношенное бьёт слабее.',
    'Заточка выше +10 может сбросить уровень. Бери свиток защиты.', 'Руны вставляются в гнёзда предметов: чем реже вещь, тем больше гнёзд.', 'Зелья дают временные бонусы: готовь их перед боссом.',
    'Мечи прокачиваются за железо и самоцветы, у каждого свой особый удар.', 'Ночью и в метель на сцене всё выглядит иначе, но урон тот же.', 'Ежедневные дела и серия дают самоцветы каждый день.',
    'Закрыл игру? Отряд продолжит бить монстров до 12 часов.', 'Таверна меняет набор наёмников каждый день.', 'Экспорт сохранения в настройках спасёт прогресс при смене устройства.',
    'Телефон: поверни экран горизонтально и добавь игру на домашний экран.', 'Кнопки 1, 2, 3 на клавиатуре применяют умения.', 'Раз в день заходи за ежедневным бонусом в настройках («Онлайн»).',
    'Мировой босс общий для всех игроков: чем больше бьют, тем быстрее падает.', 'Топ игроков и облако работают только онлайн, без сети игра идёт как раньше.', 'Редактор карт открывается значком кисти рядом с кнопкой «Столица».',
  ];
  const Tips = { list: TIPS, pick(n) { return TIPS[Math.abs(n | 0) % TIPS.length]; }, random() { return TIPS[Math.floor(Math.random() * TIPS.length)]; } };

  // ---------- подсказки при первом открытии сложных вкладок (пункт 431) ----------
  const HINTS = {
    forge: ['Кузница', 'Здесь пять дел: выбери Класс и Навыки, точи вещи в «Заточке», вставляй руны и вари зелья в «Алхимии». Начни с Класса.'],
    'forge:gear': ['Заточка', 'Выше +5 возможна потеря уровней, выше +15 вещь может сломаться. Свиток защиты спасает от поломки. Неудача копит шанс на следующую попытку.'],
    'forge:runes': ['Руны', 'Руну крафтят из эссенции. Три одинаковые руны объединяются в руну уровнем выше. Вставляй их в гнёзда предметов: гнёзда зависят от редкости.'],
    'forge:alch': ['Алхимия', 'Нужны травы и золото. Зелья действуют ограниченное время и складываются до трёх эффектов, повторное зелье продлевает действие.'],
    daily: ['Дела', 'Ежедневные задания, серия входов и кодекс. Зайди завтра: серия растёт, и награда за неё тоже.'],
    raid: ['Рейды', 'Вторжения угрожают столице. Собери отряд из героев и наёмников. Вылазки приносят добычу, пока ты занят другим.'],
    prest: ['Перерождение', 'Сбрасывает золото, прокачку и этап, но даёт осколки льда: +5% урона навсегда. Лучше всего делать это, когда прогресс замедлился.'],
    arts: ['Мечи', 'Мечи коллекционируются: каждый даёт бонус и особый удар. Надеть можно один, прокачка стоит железо и самоцветы.'],
  };
  const Hints = {
    list: HINTS,
    // вернёт [заголовок, текст] один раз для ключа; seen хранится в S.ff.seen
    take(S, key) { const f = ffs(S), seen = f.seen || (f.seen = {}); if (seen[key] || !HINTS[key]) return null; seen[key] = 1; return HINTS[key]; },
  };

  // ---------- обучение с указателями (пункт 391) ----------
  const STEPS = [
    { id: 'click', t: 'Кликай по сцене или жми пробел: это удар', tg: () => 'scene', done: (S) => S.st.clicks >= 6 },
    { id: 'hero', t: 'Открой вкладку «Герой» (внизу)', tg: () => 'dock:hero', done: (S, x) => x.tab === 'hero' },
    { id: 'buy', t: 'Купи «Силу клика»: золото падает с монстров', tg: (S, x) => (x.tab === 'hero' ? 'buy0' : 'dock:hero'), done: (S) => S.up.str >= 1 },
    { id: 'ally', t: 'Во вкладке «Армия» найми союзника: он бьёт сам', tg: (S, x) => (x.tab === 'allies' ? 'buy0' : 'dock:allies'), done: (S) => S.allies.some((l) => l > 0) },
    { id: 'skill', t: 'Умения: клавиши 1, 2, 3 или кнопки справа внизу', tg: () => 'skills', opt: (S, x) => S.hero.lvl < x.C.SKILLS[0].lvl, done: (S) => S.st.skills >= 1 },
    { id: 'city', t: 'Нажми «Столица»: там строят здания и нанимают героев', tg: () => 'switch', done: (S, x) => x.mode === 'city' },
    { id: 'build', t: 'Нажми на здание и построй Лесопилку', tg: () => 'bld:sawmill', opt: (S, x) => !x.Wd, done: (S, x) => x.Wd.lvl(S, 'sawmill') > 0 },
    { id: 'back', t: 'Отлично! Вернись «В поход». Награда за обучение: 3 самоцвета', tg: () => 'switch', done: (S, x) => x.mode === 'battle' },
  ];
  const Tutorial = {
    STEPS,
    st(S) { const f = ffs(S); if (!f.tut) f.tut = { i: 0, done: S.st.clicks > 30 || S.maxN > 3 ? 1 : 0 }; return f.tut; }, // у игроков с прогрессом обучения нет
    // продвигает шаги и возвращает текущий (или null, когда всё пройдено). x = { tab, mode, C, Wd }
    current(S, x) {
      const t = this.st(S); if (t.done) return null;
      for (let g = 0; g < STEPS.length; g++) {
        const st = STEPS[t.i]; if (!st) { this.finish(S, true); return null; }
        if (st.opt && st.opt(S, x)) { t.i++; continue; } // необязательный шаг пока недоступен
        if (st.done(S, x)) { t.i++; continue; }
        return { id: st.id, text: st.t, target: st.tg(S, x), n: t.i + 1, of: STEPS.length };
      }
      return null;
    },
    finish(S, reward) { const t = this.st(S); if (t.done) return false; t.done = 1; if (reward) { S.gems += 3; return true; } return false; },
    reset(S) { ffs(S).tut = { i: 0, done: 0 }; },
  };

  // ---------- журнал диалогов (пункт 427) ----------
  const Journal = {
    MAX: 200,
    add(S, who, text, kind) { const f = ffs(S), jr = f.jr || (f.jr = []); text = String(text || '').slice(0, 400); if (!text) return false; const l = jr[jr.length - 1]; if (l && l.x === text && l.w === who) return false; jr.push({ w: String(who || ''), x: text, k: kind || 'd', p: Math.floor((S.st && S.st.play) || 0) }); while (jr.length > this.MAX) jr.shift(); return true; },
    list(S) { return ffs(S).jr || []; },
    clear(S) { ffs(S).jr = []; },
  };

  // ---------- дубликаты легендарных вещей (пункт 422) ----------
  const Dupes = {
    find(S) {
      const key = (it) => it.slot + '|' + it.name, seen = new Set(), out = [];
      for (const k in S.equip) { const it = S.equip[k]; if (it && it.rar >= 3) seen.add(key(it)); }
      for (const it of S.bag) { if (it.rar < 3 || it.lock) continue; const k = key(it); if (seen.has(k)) out.push(it); else seen.add(k); }
      return out;
    },
    // дубликаты переплавляются: золото по цене + 1 самоцвет
    resolve(S, C) { const d = this.find(S); if (!d.length) return { n: 0, gold: 0 }; const ids = new Set(d.map((i) => i.id)); let gold = 0; for (const it of d) gold += C.itemPrice ? C.itemPrice(it) : 0; S.bag = S.bag.filter((i) => !ids.has(i.id)); S.gold += gold; S.gems += d.length; return { n: d.length, gold }; },
  };

  // ---------- проверка заданий акта перед новым биомом (пункт 428) ----------
  const Acts = {
    _first: {},
    firstStage(C, zone) { if (this._first[zone] != null) return this._first[zone]; let n = 0; while (n < 3000 && C.stageInfo(n).zone < zone) n++; return (this._first[zone] = n); },
    // задания, которые доступны до первого этапа нового биома и ещё не сданы
    pending(S, Lr, C, zone) {
      if (!Lr) return []; const first = this.firstStage(C, zone);
      return Lr.QS.filter((q) => { const need = Math.max(0, ...q.req.filter((r) => r.k === 'stage').map((r) => r.v)); return need < first && Lr.qst(S, q.id) !== 2 && (!q.pre || Lr.qst(S, q.pre) === 2); });
    },
  };

  // ---------- друзья и уведомления о рекордах (пункт 373) ----------
  const Friends = {
    MAX: 10,
    st(S) { const f = ffs(S); if (!f.fr) f.fr = { list: [], v: {} }; return f.fr; },
    add(S, nick) { nick = String(nick || '').trim().slice(0, 16); const f = this.st(S); if (nick.length < 3) return { ok: false, why: 'Ник от 3 символов' }; if (f.list.some((x) => x.toLowerCase() === nick.toLowerCase())) return { ok: false, why: 'Уже в списке' }; if (f.list.length >= this.MAX) return { ok: false, why: 'Максимум ' + this.MAX }; f.list.push(nick); return { ok: true }; },
    remove(S, nick) { const f = this.st(S); f.list = f.list.filter((x) => x !== nick); delete f.v[nick]; },
    // первое чтение запоминает базу; дальше возвращает тех, у кого рекорд вырос
    diff(S, rows) { const f = this.st(S), out = []; for (const r of rows) { const old = f.v[r.nick]; if (old !== undefined && r.value > old) out.push({ nick: r.nick, from: old, to: r.value }); f.v[r.nick] = r.value; } return out; },
  };

  // ---------- целостность файлов клиента (пункты 371, 372) ----------
  const Integrity = {
    state: 'unknown', bad: [], bh: null, ver: null, checked: 0,
    hash(text) { return cyrb53(text).toString(36); },
    // fetchFn(url) -> Promise<{ok, text(), json()}>; base: каталог игры
    async verify(fetchFn, base) {
      this.state = 'unknown'; this.bad = []; base = base || '';
      try {
        const vr = await fetchFn(base + 'version.json?i=' + Date.now()); if (!vr || !vr.ok) return this.state; const vj = await vr.json();
        if (!vj || !vj.hashes || !Array.isArray(vj.files)) return this.state;
        const got = {}; for (const f of vj.files) { const r = await fetchFn(base + f + '?i=' + Date.now()); if (!r || !r.ok) return this.state; got[f] = this.hash(await r.text()); this.checked++; if (got[f] !== vj.hashes[f]) this.bad.push(f); }
        this.ver = vj.version; this.bh = this.hash(vj.files.map((f) => got[f]).join('|')); this.state = this.bad.length ? 'tampered' : 'ok';
      } catch (e) { this.state = 'unknown'; }
      return this.state;
    },
  };

  // ---------- субпиксельное накопление скорости (пункт 47) ----------
  class Mover {
    constructor() { this.fx = 0; this.fy = 0; }
    // накапливает дробную часть и отдаёт только целые пиксели
    step(vx, vy, dt) { this.fx += vx * dt; this.fy += vy * dt; const dx = Math.trunc(this.fx), dy = Math.trunc(this.fy); this.fx -= dx; this.fy -= dy; return { dx, dy }; }
  }

  // ---------- адаптивное качество эффектов (пункт 439) ----------
  const Perf = {
    q: 2, fps: 60, acc: 0, n: 0, low: 0, high: 0, min: 60, log: [],
    // раз в 2 секунды: ниже 48 к/с два раза подряд — снижаем качество, выше 57 пятнадцать раз — возвращаем
    sample(dt) {
      this.acc += dt; this.n++; if (this.acc < 2) return null; const fps = this.n / this.acc; this.fps = fps; this.acc = 0; this.n = 0; this.min = Math.min(this.min, fps);
      if (fps < 48) { this.low++; this.high = 0; } else if (fps > 57) { this.high++; this.low = 0; } else { this.low = 0; this.high = 0; }
      if (this.low >= 2 && this.q > 0) { this.q--; this.low = 0; this.log.push('down:' + this.q); return 'down'; }
      if (this.high >= 15 && this.q < 2) { this.q++; this.high = 0; this.log.push('up:' + this.q); return 'up'; }
      return null;
    },
  };

  // ---------- виртуальный джойстик (пункт 394) ----------
  const Joy = {
    on: false, id: null, bx: 44, by: 168, R: 26, dx: 0, dy: 0, cur: { x: 192, y: 100 }, m: new Mover(), btnId: null,
    // кнопки справа: удар и три умения
    BTN: [{ id: 'hit', x: 326, y: 128, r: 20 }, { id: 's1', x: 292, y: 150, r: 12 }, { id: 's2', x: 318, y: 164, r: 12 }, { id: 's3', x: 352, y: 160, r: 12 }],
    inBase(x, y) { return (x - this.bx) * (x - this.bx) + (y - this.by) * (y - this.by) <= (this.R + 12) * (this.R + 12); },
    btnAt(x, y) { for (const b of this.BTN) if ((x - b.x) * (x - b.x) + (y - b.y) * (y - b.y) <= (b.r + 3) * (b.r + 3)) return b; return null; },
    start(id, x, y) { this.id = id; this.move(x, y); },
    move(x, y) { let dx = (x - this.bx) / this.R, dy = (y - this.by) / this.R; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } this.dx = dx; this.dy = dy; },
    end() { this.id = null; this.dx = this.dy = 0; },
    // двигает курсор джойстика по сцене (скорость до 140 px/с, дробные шаги копятся)
    update(dt) { const sp = 140; const s = this.m.step(this.dx * sp, this.dy * sp, dt); this.cur.x = clamp(this.cur.x + s.dx, 2, 381); this.cur.y = clamp(this.cur.y + s.dy, 2, 184); return this.cur; },
    isTouch() { try { return !!(root.matchMedia && root.matchMedia('(pointer:coarse)').matches) || ('ontouchstart' in root); } catch (e) { return false; } },
  };

  // ---------- WebRTC для будущей кооперативной игры (пункт 369) ----------
  // Обмен кодами вручную (без сервера сигналинга). Канал шифруется DTLS; сверка отпечатков защищает от подмены.
  const RTC_TYPES = { hello: 1, ping: 1, pong: 1, chat: 1, state: 1 };
  const clean = (v, d) => { d = d || 0; if (typeof v === 'string') return v.replace(/[\u0000-\u001f<>]/g, '').slice(0, 200); if (typeof v === 'number') return Number.isFinite(v) ? v : 0; if (typeof v === 'boolean' || v == null) return v; if (d > 2) return null; if (Array.isArray(v)) return v.slice(0, 20).map((x) => clean(x, d + 1)); if (typeof v === 'object') { const o = {}; let n = 0; for (const k of Object.keys(v)) { if (++n > 20) break; if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue; o[String(k).slice(0, 24)] = clean(v[k], d + 1); } return o; } return null; };
  class RTCLink {
    constructor(o) { o = o || {}; this.RTC = o.RTC || root.RTCPeerConnection; this.ice = o.ice || [{ urls: 'stun:stun.l.google.com:19302' }]; this.state = 'idle'; this.pc = null; this.dc = null; this.seq = 0; this.rseq = 0; this.onmessage = null; this.onstate = null; this.stamps = []; this.dropped = 0; this.fp = null; this.rttMs = 0; this._ping = {}; this.maxRate = o.maxRate || 30; }
    static encode(d) { return btoa(unescape(encodeURIComponent(JSON.stringify({ t: d.type, s: d.sdp })))); }
    static decode(code) { const o = JSON.parse(decodeURIComponent(escape(atob(String(code).trim())))); if (!o || (o.t !== 'offer' && o.t !== 'answer') || typeof o.s !== 'string' || o.s.length > 20000 || !/^v=0/.test(o.s)) throw new Error('bad code'); return { type: o.t, sdp: o.s }; }
    static fingerprint(...sdps) { const m = sdps.map(String).join('\n').match(/a=fingerprint:\S+ ([0-9A-Fa-f:]+)/g) || []; const h = cyrb53(m.sort().join('|')).toString(36).toUpperCase().padStart(8, '0').slice(0, 8); return h.slice(0, 4) + '-' + h.slice(4); }
    _set(s) { this.state = s; if (this.onstate) try { this.onstate(s); } catch (e) { /* ignore */ } }
    _mk() { if (!this.RTC) throw new Error('WebRTC недоступен'); const pc = new this.RTC({ iceServers: this.ice }); this.pc = pc; pc.onconnectionstatechange = () => { const s = pc.connectionState; if (s === 'connected') this._set('open'); else if (s === 'failed' || s === 'closed' || s === 'disconnected') this._set('closed'); }; return pc; }
    _wait(pc) { return new Promise((res) => { if (pc.iceGatheringState === 'complete') return res(); const t = setTimeout(res, 4000); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); }); }
    _chan(dc) { this.dc = dc; dc.onopen = () => { this._set('open'); this.send('hello', { v: 1 }); }; dc.onclose = () => this._set('closed'); dc.onmessage = (e) => this._in(e.data); }
    async host() { const pc = this._mk(); this._chan(pc.createDataChannel('ff', { ordered: true })); await pc.setLocalDescription(await pc.createOffer()); await this._wait(pc); this._set('waiting'); return RTCLink.encode(pc.localDescription); }
    async join(code) { const d = RTCLink.decode(code); if (d.type !== 'offer') throw new Error('Нужен код приглашения'); const pc = this._mk(); pc.ondatachannel = (e) => this._chan(e.channel); await pc.setRemoteDescription(d); await pc.setLocalDescription(await pc.createAnswer()); await this._wait(pc); this._set('joining'); this.fp = RTCLink.fingerprint(pc.localDescription.sdp, d.sdp); return RTCLink.encode(pc.localDescription); }
    async accept(code) { const d = RTCLink.decode(code); if (d.type !== 'answer') throw new Error('Нужен код ответа'); await this.pc.setRemoteDescription(d); this.fp = RTCLink.fingerprint(this.pc.localDescription.sdp, d.sdp); }
    send(type, data) { if (!RTC_TYPES[type]) return false; if (!this.dc || this.dc.readyState !== 'open') return false; const s = JSON.stringify({ t: type, n: ++this.seq, d: clean(data) }); if (s.length > 4096) return false; this.dc.send(s); return true; }
    ping() { const id = ++this.seq; this._ping[id] = Date.now(); this.send('ping', { id }); }
    _in(raw) {
      if (typeof raw !== 'string' || raw.length > 4096) { this.dropped++; return; }
      const now = Date.now(); this.stamps = this.stamps.filter((t) => now - t < 1000); if (this.stamps.length >= this.maxRate) { this.dropped++; return; } this.stamps.push(now);
      let m; try { m = JSON.parse(raw); } catch (e) { this.dropped++; return; }
      if (!m || typeof m !== 'object' || !RTC_TYPES[m.t] || !Number.isInteger(m.n) || m.n <= this.rseq) { this.dropped++; return; } // чужой тип, мусор или повтор старого номера
      this.rseq = m.n; const d = clean(m.d);
      if (m.t === 'ping') { this.send('pong', { id: d && d.id }); return; }
      if (m.t === 'pong') { const t0 = this._ping[d && d.id]; if (t0) { this.rttMs = Date.now() - t0; delete this._ping[d.id]; } return; }
      if (this.onmessage) try { this.onmessage(m.t, d); } catch (e) { /* ignore */ }
    }
    close() { try { if (this.dc) this.dc.close(); if (this.pc) this.pc.close(); } catch (e) { /* ignore */ } this._set('closed'); }
  }

  FF.Ext = { cyrb53, Time, ClickGuard, debounce, Stats, Autosave, Storage, Tips, Hints, Tutorial, Journal, Dupes, Acts, Friends, Integrity, Mover, Perf, Joy, RTCLink, clean, R: {}, guard: new ClickGuard() };
  if (typeof module !== 'undefined' && module.exports) module.exports = FF.Ext;
})(typeof window !== 'undefined' ? window : globalThis);
