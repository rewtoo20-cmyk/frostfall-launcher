/* FROSTFALL: UX и служебные модули (раздел 12): консоль, Gear Score, NG+, имена, лог сессии, длинные задачи, дымовой тест, титры. */
(function (W) {
  'use strict';
  const FF = W.FF = W.FF || {};
  const ff = (S) => (S.ff = S.ff || {});
  // ---------- Gear Score (418) ----------
  const Gear = {
    score(S, itemVal) {
      const iv = itemVal || ((it) => it.val || 0); let g = 0;
      for (const k in S.equip) if (S.equip[k]) g += iv(S.equip[k]) * (1 + (S.equip[k].rar || 0) * 0.15);
      g += (S.hero.lvl || 1) * 40; (S.allies || []).forEach((n) => { g += (n || 0) * 3; });
      return Math.round(g);
    },
  };
  // ---------- сортировка отряда (420) ----------
  const Squad = {
    power(h) { return (h.lvl || 1) * (1 + (h.star || 0) * 0.5); },
    sort(S, by) { const c = S.city; if (!c || !c.squad) return []; const H = c.heroes || {}; c.squad.sort((a, b) => by === 'lvl' ? (H[b].lvl || 1) - (H[a].lvl || 1) : Squad.power(H[b] || {}) - Squad.power(H[a] || {})); return c.squad.slice(); },
  };
  // ---------- имена деревни и королевства (416) ----------
  const Names = {
    A: ['Фрост', 'Иль', 'Брен', 'Сне', 'Вол', 'Арн', 'Дэр', 'Ост', 'Кел', 'Тор', 'Гарм', 'Ул'], B: ['гард', 'хейм', 'вик', 'форд', 'мор', 'дал', 'берг', 'стад', 'ейн'], K: ['Север', 'Лёд', 'Заря', 'Вьюг', 'Иней'], K2: ['ское королевство', 'ская держава', 'ский край', 'ская марка'],
    gen(seed) { const r = FF.Rng ? FF.Rng(seed >>> 0) : Math.random, p = (a) => a[Math.floor(r() * a.length)]; return { village: p(Names.A) + p(Names.B), kingdom: p(Names.K) + p(Names.K2) }; },
    ensure(S) { const f = ff(S); if (!f.names) f.names = Names.gen((S.uid * 2654435761) ^ (Date.now() & 0xffff)); return f.names; },
  };
  // ---------- Новая игра+ (434-435) ----------
  const NG = {
    NEED: 60,
    st(S) { const f = ff(S); return (f.ng = f.ng || { n: 0, ready: false }); },
    check(S) { const g = NG.st(S); if (!g.ready && S.maxN >= NG.NEED) { g.ready = true; return true; } return false; }, // true = только что открыт
    mult(S) { const n = NG.st(S).n; return { hp: 1 + 0.6 * n, gold: 1 + 0.35 * n, xp: 1 + 0.35 * n }; },
    can(S) { return NG.st(S).ready; },
    start(S, C) {
      const g = NG.st(S); if (!g.ready) return false;
      const sh = C.shardGain ? C.shardGain(S) : 0; S.shards += sh; S.st.prestiges++; g.n++; g.ready = false;
      S.gold = 0; S.up = { str: 0, crit: 0, critd: 0, gold: 0 }; S.allies = C.ALLIES.map(() => 0); S.n = 0; S.kills = 0; S.maxN = 0; S.cd = { storm: 0, cry: 0, rain: 0 }; S.buff = { cry: 0, rain: 0 };
      if (S.rt) { S.rt.farm = false; C.ensureRt && C.ensureRt(S); } return true;
    },
  };
  // ---------- консоль (398-401) ----------
  const RES = { gold: (S, n) => { S.gold += n; }, gems: (S, n) => { S.gems += n; }, shards: (S, n) => { S.shards += n; }, debris: (S, n, M) => { M.forge.st.debris += n; }, essence: (S, n, M) => { M.forge.st.essence += n; }, scroll: (S, n, M) => { M.forge.st.scroll += n; }, herb: (S, n, M) => { M.forge.st.herb += n; } };
  const Console = {
    hist: [],
    run(line, ctx) {
      line = String(line || '').trim().replace(/^\//, ''); if (!line) return []; Console.hist.push(line); if (Console.hist.length > 50) Console.hist.shift();
      const a = line.split(/\s+/), cmd = a[0].toLowerCase(), S = ctx.S, C = ctx.C, M = ctx.Main, out = [];
      const mark = () => { ff(S).cheat = 1; };
      try {
        if (cmd === 'help') return ['give <gold|gems|shards|debris|essence|scroll|herb> <n>', 'stage <n>   boss   finish   ng   score   names', 'fps   net   time   log   cheats'];
        if (cmd === 'give') { const f = RES[(a[1] || '').toLowerCase()], n = +a[2]; if (!f || !isFinite(n) || n <= 0 || n > 1e15) return ['Формат: give gold 99999']; f(S, n, M); mark(); return ['Выдано ' + a[1] + ' +' + n]; }
        if (cmd === 'stage') { const n = Math.floor(+a[1]); if (!(n >= 0 && n <= 5000)) return ['stage 0..5000']; S.n = n; S.maxN = Math.max(S.maxN, n); C.ensureRt(S); mark(); return ['Этаж ' + n]; }
        if (cmd === 'boss') { const n = Math.floor(S.n / 10) * 10 + 9; S.n = n; S.maxN = Math.max(S.maxN, n); if (C.callBoss) C.callBoss(S); mark(); return ['Босс этажа ' + n]; }
        if (cmd === 'finish') { const x = M.x; let k = 0; if (x && x.s && x.s.runs) for (let i = x.s.runs.length - 1; i >= 0; i--) { const r = x.s.runs[i]; r.start = -1e12; x.claim(i); k++; } mark(); return ['Вылазок завершено: ' + k]; }
        if (cmd === 'ng') { NG.st(S).ready = true; mark(); return ['NG+ разблокирован (кнопка в настройках)']; }
        if (cmd === 'score') return ['Gear Score: ' + Gear.score(S, M.forge && ((it) => M.forge.itemVal(it)))];
        if (cmd === 'names') { const n = Names.ensure(S); return [n.village + ', ' + n.kingdom]; }
        if (cmd === 'fps') return ['FPS ' + M.fps + ', задач >50мс: ' + LongTasks.count + ', макс ' + LongTasks.max + 'мс'];
        if (cmd === 'net') return [M.net ? M.net.status + ' ' + M.net.ping + 'мс, ник ' + (M.net.nick || '-') : 'нет'];
        if (cmd === 'time') return [new Date().toLocaleTimeString('ru-RU') + ', сессия ' + Math.round((Date.now() - SessionLog.t0) / 1000) + ' с'];
        if (cmd === 'log') return SessionLog.text(M).split('\n').slice(-8);
        if (cmd === 'cheats') return [ff(S).cheat ? 'Читы использовались: рейтинг не отправляется' : 'Читов не было'];
      } catch (e) { return ['Ошибка: ' + (e && e.message)]; }
      return ['Неизвестная команда: ' + cmd + ' (help)'];
    },
  };
  // ---------- лог сессии (402) ----------
  const SessionLog = {
    t0: Date.now(),
    text(M) {
      const L = ['FROSTFALL лог сессии', 'Версия ' + (M && M.VERSION), 'Начало ' + new Date(SessionLog.t0).toISOString(), 'Окружение ' + (typeof navigator !== 'undefined' ? navigator.userAgent : 'node'), ''];
      (FF.Log && FF.Log.buf || []).forEach((r) => L.push(new Date(r.t).toISOString().slice(11, 19) + ' ' + r.lv + ' [' + r.tag + '] ' + r.msg + (r.x ? '\n   ' + r.x.split('\n')[0] : '')));
      if (M && M.net) L.push('', 'Сеть:', M.net.debugDump());
      return L.join('\n');
    },
    download(M) { try { const b = new Blob([SessionLog.text(M)], { type: 'text/plain;charset=utf-8' }), u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = 'frostfall-log.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); return true; } catch (e) { return false; } },
  };
  // ---------- Long Tasks (403) ----------
  const LongTasks = {
    count: 0, max: 0, started: false,
    start() { if (LongTasks.started) return; LongTasks.started = true; try { const o = new PerformanceObserver((l) => { for (const e of l.getEntries()) { LongTasks.count++; LongTasks.max = Math.max(LongTasks.max, Math.round(e.duration)); if (e.duration > 200 && FF.Log) FF.Log.warn('perf', 'долгая задача ' + Math.round(e.duration) + ' мс'); } }); o.observe({ entryTypes: ['longtask'] }); LongTasks.obs = o; } catch (e) { /* не поддерживается */ } },
  };
  // ---------- титры (390, 433) ----------
  const CREDITS = ['F R O S T F A L L', '', 'Идея и руководство', '5VINCI', '', 'Игровой дизайн и код', 'Claude (Anthropic) + 5VINCI', '', 'Движок', 'Canvas 2D, чистый JavaScript', 'Пиксельный шрифт и графика - в коде', 'Звук - синтез на лету (WebAudio)', '', 'Сервер', 'Cloudflare Workers + D1', '', 'Спасибо, что играешь!', 'Зима не закончится никогда.', '', '', 'Нажми Esc, чтобы закрыть'];
  // ---------- дымовой тест (436-440) ----------
  function smoke(M) {
    const t0 = Date.now(), items = [], T = (name, fn) => { let ok = false, info = ''; try { const r = fn(); ok = r === true || (r && r.ok === true) || r === undefined ? r !== false : !!r; info = r && r.info ? r.info : ''; } catch (e) { info = String(e && e.message || e).slice(0, 80); } items.push({ name, ok, info }); };
    const mods = ['util', 'bus', 'anim', 'fx', 'audio', 'save', 'quests', 'expedition', 'battle', 'forge', 'invasion', 'editor', 'net', 'UX', 'Main'];
    const names = { util: 'Rng', bus: 'EventBus', anim: 'SpriteAnimator', fx: 'Fx', audio: 'audio', save: 'SaveManager', quests: 'QuestSystem', expedition: 'ExpeditionManager', battle: 'Battle', forge: 'Forge', invasion: 'Invasion', editor: 'TileMap', net: 'Net', UX: 'UX', Main: 'Main' };
    mods.forEach((m) => T('модуль ' + m, () => !!FF[names[m]]));
    T('Rng детерминирован', () => { const a = FF.Rng(7), b = FF.Rng(7); for (let i = 0; i < 1000; i++) if (a() !== b()) return false; return true; });
    T('EventBus', () => { let n = 0; const b = new FF.EventBus(); b.on('x', () => n++); for (let i = 0; i < 1000; i++) b.emit('x', i); return n === 1000; });
    T('Forge selfTest', () => FF.Forge.selfTest().ok);
    T('Вторжения баланс', () => { const v = FF.Invasion.balance(100); return v >= 0 && v <= 1; });
    T('Сохранение туда-обратно', () => { const C = W.Core, s = C.newState(); s.gold = 123; const r = C.load(C.save(s)); return r.gold === 123; });
    T('Карта: генерация и проверка', () => { const m = FF.MapGen.island(24, 24, 5); return !FF.mapValidate(m).some((i) => i.lvl === 'error'); });
    T('Звук: синтез', () => { const r = FF.AudioSynth.renderSfx('click', 22050); return !!r && r.length > 0; });
    T('Net создаётся офлайн', () => new FF.Net({ fetch: null }).status === 'off');
    T('Нет ошибок в журнале', () => !(FF.Log && FF.Log.buf || []).some((r) => r.lv === 'ERROR'));
    const bad = items.filter((i) => !i.ok);
    return { ok: bad.length === 0, ms: Date.now() - t0, total: items.length, bad, items, text: 'Готовность FROSTFALL v' + (M && M.VERSION) + ': ' + (items.length - bad.length) + '/' + items.length + ' проверок' + (bad.length ? '\nПровалены: ' + bad.map((b) => b.name + (b.info ? ' (' + b.info + ')' : '')).join(', ') : '') + '\n' + (Date.now() - t0) + ' мс' };
  }
  FF.UX = { Gear, Squad, Names, NG, Console, SessionLog, LongTasks, CREDITS, smoke };
  if (typeof module !== 'undefined' && module.exports) module.exports = FF;
})(typeof window !== 'undefined' ? window : globalThis);
