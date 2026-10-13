// FROSTFALL: FF.Main. Точка входа модулей FF: проверка среды, сохранение через SaveManager, модули (квесты, вылазки, кузница, вторжения),
// мост «события ядра -> шина», хуки Core.H, клавиши с переназначением, отладочная панель, полноэкранный режим, самотесты.
(function (root) {
  'use strict';
  const FF = root.FF = root.FF || {};
  const VERSION = '1.8.0', KEY = 'frostfall.save.v3', LEGACY = ['frostfall.save.v2'], OFFLINE_CAP = 12 * 3600;
  const UPDATE_URL = 'https://raw.githubusercontent.com/rewtoo20-cmyk/frostfall/main/version.json';
  const DEF_KEYS = { click: 'Space', skill1: 'Digit1', skill2: 'Digit2', skill3: 'Digit3', fullscreen: 'KeyF', debug: 'F3', mute: 'KeyM', close: 'Escape' };
  const KEYNAMES = { click: 'Удар', skill1: 'Умение 1', skill2: 'Умение 2', skill3: 'Умение 3', fullscreen: 'Полный экран', debug: 'Отладка', mute: 'Звук вкл/выкл', close: 'Закрыть окно' };

  const Main = {
    VERSION, KEY, DEF_KEYS, KEYNAMES, S: null, C: null, saver: null, q: null, x: null, forge: null, inv: null, host: {}, debug: false, keys: Object.assign({}, DEF_KEYS), env: null, legSeen: 0, fps: 60, _fa: 0, _fn: 0, dirty: false, lastGather: -1, update: null,

    // ---- вызывается один раз до создания состояния ----
    boot() {
      FF.Log.hook(); Main.env = FF.Env.check(); if (!Main.env.ok) FF.Log.warn('env', 'нет возможностей: ' + Main.env.missing.join(', '));
      Main.saver = new FF.SaveManager(); Main.saver.cleanup(KEY); FF.Clock.init(0); FF.Config.load && FF.Config.load();
      try { const k = JSON.parse(localStorage.getItem('ff.keys') || 'null'); if (k && typeof k === 'object') for (const a in DEF_KEYS) if (typeof k[a] === 'string') Main.keys[a] = k[a]; } catch (e) { /* ключи по умолчанию */ }
      FF.UX.LongTasks.start(); try { Main.net = new FF.Net({ storage: localStorage }); setTimeout(() => Main.net.check(), 1500); } catch (e) { Main.net = null; }
      if (typeof addEventListener === 'function') addEventListener('error', (ev) => { const n = Main.net; if (!n || !n.registered || (Main._crashN = (Main._crashN || 0) + 1) > 5) return; n.crash(VERSION, String(ev.message || '') + ' @' + String(ev.filename || '').split('/').pop() + ':' + ev.lineno); });
      return Main;
    },
    // Загрузка: JSON сейва или null
    loadJson() { const r = Main.saver.load(KEY, LEGACY); if (!r) return null; if (r.error === 'newer') { Main.newer = r.version; return null; } return r.json; },
    persist(S) { Main.dirty = false; return Main.saver.save(KEY, Main.C.save(S)); },
    wipe() { Main.saver.wipe(KEY); for (const k of LEGACY) try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },

    // ---- подключение модулей к состоянию игры ----
    attach(S, C, host) {
      if (Main.q) Main.q.detach(); Main.S = S; Main.C = C; Main.host = host || {}; S.ff = (S.ff && typeof S.ff === 'object') ? S.ff : {};
      for (const k of ['q', 'x']) if (!S.ff[k] || typeof S.ff[k] !== 'object') S.ff[k] = {};
      FF.Clock.init(S.seen || 0);
      const grant = (rw) => {
        if (!rw) return; const f = Main.forge, scale = 1 + (S.maxN || 0) * 0.15;
        if (rw.gold) S.gold += Math.round(rw.gold * scale); if (rw.gems) S.gems += Math.round(rw.gems); if (rw.shards) S.shards += Math.round(rw.shards);
        if (rw.herb) f.st.herb += rw.herb; if (rw.debris) f.st.debris += rw.debris; if (rw.essence) f.st.essence += rw.essence; if (rw.scroll) f.st.scroll += rw.scroll;
        if (rw.unlock) f.unlock(rw.unlock);
        if (Main.host.toast && (rw.gems || rw.gold)) Main.host.toast('Награда: ' + (rw.gold ? Math.round(rw.gold * scale) + ' зол. ' : '') + (rw.gems ? rw.gems + ' самоцв.' : ''), '#ffd24a');
      };
      Main.forge = new FF.Forge(S, { bus: FF.bus, price: (it) => C.itemPrice(it), makeItem: (rar, slot) => { const it = C.makeItem ? C.makeItem(S, S.n, false, rar) : null; if (it) it.slot = slot; return it; } });
      Main.q = new FF.QuestSystem(S.ff.q, FF.bus, { act: () => 1 + Math.floor((S.maxN || 0) / 40), now: () => FF.Clock.safeNow(), grant });
      const hall = () => (S.city && S.city.b ? S.city.b.hall | 0 : 1) || 1;
      Main.x = new FF.ExpeditionManager(S.ff.x, FF.bus, {
        now: () => FF.Clock.safeNow(), hallLvl: hall,
        grant: (loot) => { S.gold += Math.round(loot.gold || 0); if (loot.res && S.city) { S.city.res.wood = (S.city.res.wood || 0) + Math.round(loot.res / 2); S.city.res.stone = (S.city.res.stone || 0) + Math.round(loot.res / 2); } const f = Main.forge; f.st.debris += Math.round((loot.items || 0) * 4); f.st.essence += loot.frags || 0; f.st.herb += Math.round((loot.res || 0) / 40); },
        xp: (id, n) => { if (C.addXp) C.addXp(S, n); },
      });
      Main.inv = new FF.Invasion(S, { now: () => FF.Clock.safeNow(), dps: () => Math.max(1, C.dps(S) * C.dmgMult(S) + C.clickDmg(S) * 4), bus: FF.bus });
      Main._hooks(S, C); Main._bridge(); Main._keys();
      FF.bus.emit('start', { n: 1 });
      return Main;
    },
    // Хуки Core.H: оборачиваем уже установленные (мир, лор, события)
    _hooks(S, C) {
      if (Main._hooked) return; Main._hooked = true; const H = C.H, f = () => Main.forge;
      const pd = H.dmg, pg = H.gold, pc = H.crit, pk = H.kill, pt = H.tick, po = H.offline;
      H.dmg = (s) => { const F = f(), m = F.mods(), cls = F.baseStats(s.hero.lvl), war = F.baseStats(s.hero.lvl, 'warrior'); return pd(s) * (1 + m.atkP) * (cls.atk / war.atk) * (1 + m.critd * 0.1) / FF.UX.NG.mult(s).hp; };
      H.gold = (s) => pg(s) * FF.UX.NG.mult(s).gold * f().goldFactor() * (Main.inv ? Main.inv.goldMult() * Main.inv.seasonMult() : 1);
      H.crit = (s) => pc(s) + f().mods().crit + (f().baseStats(s.hero.lvl).crit - 0.05);
      H.kill = (s, i) => {
        pk(s, i); { const g = FF.UX.NG.mult(s).xp; if (g > 1) s.hero.xp += i.xp * (g - 1); } FF.bus.emit('kill', { elite: !!i.elite, boss: !!i.boss, n: 1 });
        if (i.boss) {
          FF.bus.emit('boss', { n: 1 }); const F = f(); F.wearDown(2);
          if (s.st.legend > Main.legSeen) { Main.legSeen = s.st.legend; F.bossPity(true); } else if (F.bossPity(false)) { C.dropItem(s, 3); Main.legSeen = s.st.legend; if (Main.host.toast) Main.host.toast('Гарантированная легендарка!', '#ff9c2a'); }
        }
        Main.dirty = true;
      };
      H.tick = (s, dt) => {
        pt(s, dt); FF.Timers.update(dt); Main.syncBattle(s, dt); Main.forge.update(dt); Main.q.update(dt); Main.x.update(); Main.inv.update(dt);
        if (s.city && s.city.res) { let t = 0; for (const k in s.city.res) t += s.city.res[k] || 0; if (Main.lastGather >= 0 && t > Main.lastGather) FF.bus.emit('gather', { n: Math.max(1, Math.floor(t - Main.lastGather)) }); Main.lastGather = t; }
      };
      H.offline = (s, o, secs) => { po(s, o, secs); Main.forge.offline(Math.min(secs, OFFLINE_CAP)); };
      Main.legSeen = S.st.legend || 0;
    },
    // Ядро -> шина: события игры (получаем в game.events)
    onEvents(ev) {
      for (const e of ev) {
        if (e.t === 'skill') FF.bus.emit('skill', { n: 1, id: e.v });
        else if (e.t === 'fail') Main.forge.wearDown(1);
        else if (e.t === 'evt' && e.k === 'reward') FF.bus.emit('event', { n: 1 });
        else if (e.t === 'level') FF.bus.emit('level', { lvl: e.v });
        if (FF.audio && FF.audio.ctx) { const m = { drop: 'coin', level: 'level', ach: 'quest', zone: 'boom', fail: 'fail', skill: 'skill', equip: 'equip' }[e.t]; if (m) FF.audio.play(m); }
      }
    },
    // ---- бой с боссом: Battle повторяет фазы и зоны поражения поверх обычного боя ----
    // Здоровье босса берётся из ядра; зона, накрывшая героя, отнимает секунды таймера босса; умение даёт неуязвимость на 0,8 с.
    syncBattle(S, dt) {
      const m = S.rt && S.rt.mon, B = Main.battle;
      if (!m || !m.boss || m.dead) { if (B && (!m || m.dead || !m.boss)) { Main.battle = null; Main.zones = []; Main.phase = 1; Main.bossTint = null; } return; }
      if (!B || Main.bm !== m) {
        const b = new FF.Battle({ seed: (S.n * 7919) ^ (S.st.bosses | 0), bus: null }); Main.bm = m; Main.battle = b; Main.phase = 1;
        Main.hero = b.addHero({ name: 'Герой', cls: 'warrior', max: 1e9, atk: 0, x: 108, range: 0, acc: 0, speed: 0 });
        Main.boss = b.makeBoss({ name: m.name, max: 1000, atk: 1, x: 292, noSummon: true, noSplit: true, vampAura: 0, regen: false, rate: 0.0001 }); Main.boss.cd = 1e9; Main.boss.range = 1e9;
        b.events = []; if (FF.bus) FF.bus.emit('boss.cry', { text: Main.boss.cryText }); if (Main.host.toast) Main.host.toast('«' + Main.boss.cryText + '»', '#ff9c6b'); return;
      }
      B.events.length = 0; Main.boss.hp = Math.max(1, Math.min(Main.boss.max, m.hp / m.max * Main.boss.max)); Main.boss.cd = 1e9; Main.hero.hp = Main.hero.max;
      const hz = B.zones.length; B.update(Math.min(dt, 0.1));
      for (const e of B.events) {
        if (e.t === 'phase') { Main.phase = e.d.phase; Main.bossTint = '#ff4a3a'; if (FF.audio && FF.audio.setTempo) FF.audio.setTempo(e.d.tempo); if (Main.host.toast) Main.host.toast('Босс в ярости!', '#ff5c5c'); if (FF.fx) { FF.fx.flash('#ff3030', 0.3); FF.fx.hit(4); } }
        else if (e.t === 'hit' && e.d.tgt === Main.hero.id && e.d.v > 0) { S.rt.bossT = Math.max(1, S.rt.bossT - 3); if (FF.fx) { FF.fx.hit(3); FF.fx.number(108, 120, '-3 с', '#ff6b6b'); } if (FF.audio && FF.audio.ctx) FF.audio.play('fail'); }
        else if (e.t === 'telegraph' && FF.audio && FF.audio.ctx) FF.audio.play('warn');
        else if (e.t === 'cast' && Main.host.toast) Main.host.toast('Босс готовит удар! Используй умение (1-3)', '#ffd24a');
      }
      Main.zones = B.zones;
    },
    onSkillUsed() { if (Main.battle && Main.hero) Main.battle.invuln(Main.hero, 0.8); },
    onClick() { FF.bus.emit('click', { n: 1 }); if (FF.audio && FF.audio.ctx) FF.audio.play('click'); },
    uiSound(can) { if (FF.audio && FF.audio.ctx) FF.audio.ui(can === false ? 'deny' : 'tick'); },
    // Часть событий шины -> тосты и звук
    _bridge() {
      if (Main._bridged) return; Main._bridged = true; const t = (m, c) => Main.host.toast && Main.host.toast(m, c), P = (n) => FF.audio && FF.audio.ctx && FF.audio.play(n);
      FF.bus.on('quest.done', (q) => { t('Задание выполнено!', '#5fe08a'); P('quest'); });
      FF.bus.on('invasion.start', () => { t('ВТОРЖЕНИЕ ЛЕДЯНОГО ЛЕГИОНА! Защити базу!', '#ff5c5c'); P('siren'); });
      FF.bus.on('invasion.end', (r) => { t(r.win ? 'Вторжение отбито! +' + r.gems + ' самоцв.' : 'Стена пала. Слабая стена 10 мин.', r.win ? '#5fe08a' : '#ff5c5c'); if (r.win && Main.forge) Main.forge.unlock('paladin'); P(r.win ? 'win' : 'lose'); });
      FF.bus.on('base.event', (e) => t(e.name + ': ' + e.text, '#5bc0ff'));
      FF.bus.on('enhance', (e) => { t(e.ok ? 'Заточка +' + e.to + '!' : (e.res === 'break' ? 'Предмет сломан!' : e.res === 'protected' ? 'Свиток спас предмет' : 'Заточка не удалась'), e.ok ? '#ffd24a' : '#ff8a8a'); P(e.ok ? 'ok' : 'fail'); });
      FF.bus.on('potion.end', () => t('Зелье закончило действие', '#9fb4d8'));
      FF.bus.on('class.unlock', (e) => t('Открыт класс: ' + FF.ForgeData.CLASSES[e.id].name, '#b66cff'));
      FF.bus.on('exp.done', (e) => { t(e.win ? 'Вылазка удалась' : 'Вылазка провалена', e.win ? '#5fe08a' : '#ff8a8a'); P(e.win ? 'win' : 'lose'); });
      FF.bus.on('craft', (e) => P(e && e.what === 'potion' ? 'potion' : 'forge')); FF.bus.on('exp.chest', () => P('chest'));
    },
    // ---- клавиши ----
    _keys() {
      if (Main._kd || typeof addEventListener !== 'function') return; Main._kd = true;
      addEventListener('keydown', (e) => {
        if (e.repeat || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
        if (Main.rebind) { e.preventDefault(); if (e.code !== 'Escape') { Main.keys[Main.rebind] = e.code; try { localStorage.setItem('ff.keys', JSON.stringify(Main.keys)); } catch (x) { /* ignore */ } } Main.rebind = null; return; }
        if (e.code === Main.keys.fullscreen) Main.fullscreen(); else if (e.code === Main.keys.debug) { e.preventDefault(); Main.debug = !Main.debug; } else if (e.code === Main.keys.mute && FF.audio) { FF.audio.setEnabled(!FF.audio.enabled); }
      });
      addEventListener('pointerdown', () => { if (FF.audio) { try { if (!FF.audio.ctx) FF.audio.init(); else FF.audio.unlock(); } catch (e) { /* без звука */ } } }, { once: false, passive: true });
      document.addEventListener('visibilitychange', () => { if (FF.audio && FF.audio.setHidden) FF.audio.setHidden(document.hidden); if (document.hidden && Main.S) Main.persist(Main.S); });
    },
    // Секунды отсутствия с защитой от перевода часов и потолком 12 ч
    offlineSecs(S) { return FF.Clock.elapsed(S.seen || FF.Clock.safeNow(), OFFLINE_CAP); },
    // Действие по коду клавиши: имя действия или null
    action(code) { for (const a in Main.keys) if (Main.keys[a] === code) return a; return null; },
    resetKeys() { Main.keys = Object.assign({}, DEF_KEYS); try { localStorage.removeItem('ff.keys'); } catch (e) { /* ignore */ } },
    fullscreen() { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { /* не поддерживается */ } },
    // ---- отладочная панель ----
    // Музыка: столица и бой спокойные, бой с боссом — своя тема; смена фазы ускоряет темп
    music(dt) {
      const au = FF.audio; if (!au || !au.ctx || !Main.S) return; const S = Main.S, m = S.rt && S.rt.mon;
      // шаги: пока герой бежит между монстрами
      const run = !!(m && (m.dead || m.t < 0.5)) && S.rt.mode !== 'city'; Main._st = (Main._st || 0) - dt;
      if (run && Main._st <= 0) { Main._st = 0.28; au.step(S.rt.mode === 'city' ? 'stone' : 'snow', 0.35); }
      Main._mt = (Main._mt || 0) - dt; if (Main._mt > 0) return; Main._mt = 0.5;
      const boss = !!(m && m.boss && !m.dead), inv = !!(Main.inv && Main.inv.st && Main.inv.st.act), trek = !!(Main.x && Main.x.s && Main.x.s.runs && Main.x.s.runs.length);
      const want = inv ? 'alarm' : boss ? 'boss' : trek ? 'trek' : 'calm';
      if (au.cur !== want) { au.music(want); if (!boss && !inv) au.setTempo(1); } if (!boss && !inv && au.tempo > 1) au.setTempo(1);
      if (au.ambient && !Main._amb) { Main._amb = true; au.ambient(true); }
    },
    // раз в минуту отправляем рекорды (только если вырос и игрок зарегистрирован)
    netTick(dt) { const n = Main.net, S = Main.S; if (S) { Main._ng = (Main._ng || 0) + dt; if (Main._ng > 5) { Main._ng = 0; if (FF.UX.NG.check(S) && Main.host.toast) { Main.host.toast('Финал пройден! Открыт режим Новая игра+', '#ffd24a'); if (Main.host.credits) Main.host.credits(); } } } if (!n || !n.registered || !S) return; Main._nt = (Main._nt || 0) + dt; if (Main._nt < 60) return; Main._nt = 0; if (S.ff && S.ff.cheat) return; n.submit('stage', S.maxN || 0); n.submit('level', S.hero.lvl || 0); n.submit('kills', S.st.kills || 0); },
    frame(dt) { Main.netTick(dt); Main.music(dt); Main._fa += dt; Main._fn++; if (Main._fa >= 0.5) { Main.fps = Math.round(Main._fn / Main._fa); Main._fa = 0; Main._fn = 0; } },
    smoke() { return FF.UX.smoke(Main); },
    debugLines(fx) {
      const L = ['FPS ' + Main.fps + '  v' + VERSION + (Main.net ? '  сеть ' + Main.net.status + (Main.net.ping ? ' ' + Main.net.ping + 'мс' : '') : ''), 'Таймеры ' + FF.Timers.count + '  Шина ' + FF.bus.types().length + ' типов'];
      if (typeof performance !== 'undefined' && performance.memory) L.push('Память ' + (performance.memory.usedJSHeapSize / 1048576).toFixed(1) + ' МБ');
      if (fx) { const s = fx.stats(); L.push('Частицы ' + s.parts + '/' + s.partsCap + ' кач.' + s.quality); }
      L.push('Ошибок ' + FF.Log.count('ERROR') + '  Предупр. ' + FF.Log.count('WARN'));
      if (Main.saver) L.push('Сейв: ' + (Main.saver.lastSource || '-') + ' ошибок записи ' + Main.saver.fails);
      return L;
    },
    // ---- обновления ----
    async checkUpdate() {
      try { const r = await fetch(UPDATE_URL, { cache: 'no-store' }); if (!r.ok) return null; const j = await r.json(); const cmp = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
        Main.update = cmp(j.version, VERSION) > 0 ? j.version : null; return Main.update; } catch (e) { return null; }
    },
    // ---- самотесты баланса ----
    selfTest() {
      const r = { forge: FF.Forge.selfTest(), invasion: FF.Invasion.balance(100), quests: FF.QuestSystem.checkIds ? FF.QuestSystem.checkIds() : null, expedition: null };
      try { const e = new FF.ExpeditionEngine(); const p = [{ id: 'a', name: 'a', cls: 'paladin', hp: 900, atk: 90, def: 10, crit: 0.1, vamp: 0, skills: [] }]; let w = 0; for (let i = 0; i < 100; i++) if (e.run(p, { threat: 1, len: 4, seed: i, provisions: 3 }).win) w++; r.expedition = w / 100; } catch (x) { r.expedition = 'ошибка: ' + x.message; }
      r.ok = r.forge.ok && r.invasion >= 0 && r.invasion <= 1; return r;
    },
    // Журнал ошибок для отладки/экспорта
    errorLog() { return FF.Log.buf.filter((r) => r.lv !== 'INFO').slice(-30).concat(FF.Log.saved()); },
  };

  FF.Main = Main;
  if (typeof module !== 'undefined' && module.exports) module.exports = FF;
})(typeof window !== 'undefined' ? window : globalThis);
