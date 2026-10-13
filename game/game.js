// FROSTFALL: игровой интерфейс (всё рисуется на холсте 384x216 в пиксельном стиле).
(function () {
  'use strict';
  const C = window.Core, Sc = window.Scene, A = window.ART, PX = window.PX, COL = PX.COL, { text, tw, fit, panel, bar } = PX, F = C.fmt;
  const WD = 384, HT = 216, KEY = 'frostfall.save.v2';
  const cv = document.getElementById('cv'), view = cv.getContext('2d', { alpha: false }), off = document.createElement('canvas'); off.width = WD; off.height = HT;
  const c = off.getContext('2d', { alpha: false }); c.imageSmoothingEnabled = false; view.imageSmoothingEnabled = false; // рисуем в 384x216, на экран — один масштабированный кадр
  let mode = 'battle', bldDlg = null, hoverSpot = null, spots = [], S, tab = null, hits = [], clip = null, hitsOff = false, mouse = { x: -1, y: -1 }, scroll = {}, wheelArea = null, dialog = null, toasts = [], hold = null, talk = null, notified = {};
  let last = 0, lastSave = 0;

  // ---------- сохранение ----------
  const FFm = window.FF.Main, Ex = window.FF.Ext, Fx = window.FF.Fxx; let ready = false, dbgHit = false, lastTab = null, lastZone = -1, curDt = 0.016, stickyTip = null, pendTip = null, lastNetChk = 0, upCache = { t: 0, v: false }, lastRepair = 0, onl = { daily: 0, fr: 0, init: 0 };
  const persist = () => { try { FFm.persist(S); } catch (e) { window.FF.Log.error('save', 'persist', e); } };
  const loadSave = () => { try { const t = FFm.loadJson(); if (t) return C.load(t); } catch (e) { window.FF.Log.error('save', 'load', e); } return null; };

  // ---------- масштаб окна ----------
  let SK = 1;
  function fitScreen() {
    const vv = window.visualViewport, d = window.devicePixelRatio || 1, W = Math.round(vv ? vv.width : innerWidth), H = Math.round(vv ? vv.height : innerHeight);
    document.documentElement.style.height = H + 'px'; document.body.style.height = H + 'px'; document.body.style.width = W + 'px'; window.scrollTo(0, 0); if (H > W * 1.1 && !window.__rot) { window.__rot = true; setTimeout(() => toast('Поверни телефон горизонтально', '#ffd24a'), 800); } else if (W >= H) window.__rot = false;
    const f = Math.min(W / WD, H / HT);             // css-масштаб: занимаем максимум окна
    const k = Math.max(1, Math.ceil(f * d - 1e-6)); // внутренний буфер не меньше экрана -> чёткий текст
    if (k !== SK || cv.width !== WD * k) { SK = k; cv.width = WD * k; cv.height = HT * k; }
    view.setTransform(1, 0, 0, 1, 0, 0); view.imageSmoothingEnabled = false;
    cv.style.width = Math.round(WD * f) + 'px'; cv.style.height = Math.round(HT * f) + 'px';
    cv.style.imageRendering = (f * d) % 1 < 0.001 || (f * d) % 1 > 0.999 ? 'pixelated' : 'auto';
  }
  let lowWarn = false; addEventListener('resize', () => { if (!lowWarn && (innerWidth < 512 || innerHeight < 288)) { lowWarn = true; toast('Окно слишком маленькое: интерфейс может быть мелким', '#ffd24a'); } });
  addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0', '_'].includes(e.key)) e.preventDefault(); });
  addEventListener('resize', fitScreen); addEventListener('orientationchange', () => { fitScreen(); setTimeout(fitScreen, 300); setTimeout(fitScreen, 900); });
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', fitScreen); window.visualViewport.addEventListener('scroll', () => window.scrollTo(0, 0)); }
  setTimeout(fitScreen, 400);

  // ---------- кнопки (мгновенный режим) ----------
  function hit(x, y, w, h, fn, o) {
    if (hitsOff) return false;
    let r = { x, y, w, h };
    if (clip) { const x0 = Math.max(x, clip.x), y0 = Math.max(y, clip.y), x1 = Math.min(x + w, clip.x + clip.w), y1 = Math.min(y + h, clip.y + clip.h); if (x1 <= x0 || y1 <= y0) return false; r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
    hits.push({ x: r.x, y: r.y, w: r.w, h: r.h, fn, rep: o && o.rep, can: !o || o.can !== false, gold: !!(o && o.gold) });
    return mouse.x >= r.x && mouse.x < r.x + r.w && mouse.y >= r.y && mouse.y < r.y + r.h;
  }
  function button(x, y, w, h, label, o) {
    o = o || {}; const hv = hit(x, y, w, h, o.fn, o), on = o.on, can = o.can !== false, shx = Fx.shakeAt(x, y); x += shx;
    const fill = shx ? '#9a3030' : on ? '#3a8ad8' : can ? (o.green ? '#2f8f5f' : o.pink ? '#9a3f8a' : '#34508a') : '#262e48';
    panel(c, x, y, w, h, { fill: hv && can ? PX.shade(fill, 22) : fill, hi: can ? PX.shade(fill, 50) : '#3a4468', lo: PX.shade(fill, -40) });
    const col = can ? '#ffffff' : '#7a86a6';
    if (o.icon) { c.drawImage(o.icon, x + 4, y + Math.round((h - o.icon.height) / 2)); }
    if (label !== undefined && label !== null) text(c, label, x + Math.round(w / 2) + (o.icon ? 4 : 0), y + Math.round((h - 11) / 2) + (o.dy || 0), col, { align: 'c' });
    return hv;
  }

  // ---------- верхняя часть ----------
  const Lr = window.Core.Lore;
  const MENU = [['hero', 'sword', 'Герой'], ['allies', 'shield', 'Армия'], ['items', 'bag', 'Вещи'], ['arts', 'blade', 'Мечи'], ['skills', 'bolt', 'Умения'], ['quests', 'scroll', 'Задания'], ['shop', 'shop', 'Лавка']];
  const MENU_C = [['bld', 'house', 'Постройки'], ['heroes', 'helm', 'Герои'], ['exp', 'map', 'Вылазки'], ['tavern', 'mug', 'Таверна'], ['arts', 'blade', 'Мечи'], ['quests', 'scroll', 'Задания'], ['shop', 'shop', 'Лавка']];
  const CORNER = [['editor', 'blade', 'Редактор карт'], ['forge', 'gem', 'Кузница'], ['daily', 'target', 'Дела'], ['raid', 'map', 'Рейды'], ['ach', 'trophy', 'Награды'], ['prest', 'snow', 'Перерождение'], ['set', 'gear', 'Настройки']];
  const SUB = { hero: 'Сила клика, крит и золото', allies: 'Союзники бьют сами, пока ты занят', items: 'Надевай лучшее, лишнее продавай', arts: 'Зачарованные мечи: бонусы и особые удары', skills: 'Сильные умения с откатом', quests: 'Поручения жителей столицы', shop: 'Постоянные улучшения за самоцветы', prest: 'Начать заново, но сильнее', ach: 'Награды за достижения', set: 'Сохранение и режимы', bld: 'Строй и улучшай столицу', heroes: 'Твои герои и отряд', tavern: 'Призыв героев за золото и самоцветы', exp: 'Герои приносят добычу за время', jr: 'Всё, что говорили жители столицы', forge: 'Классы, навыки, заточка, руны, зелья', daily: 'Ежедневные задания, серия, кодекс', raid: 'Вторжения, вылазки, сезоны' };
  function chip(x, y, icon, val, col, tip) { const w = Math.max(52, tw(val) + 20); const hv = hit(x, y, w, 13, null); const gs = icon === 'coin' || icon === 'gem' ? Fx.goldShake() : 0; x += gs; panel(c, x, y, w, 13, gs ? { fill: '#5a2020' } : undefined); c.drawImage(A.icons[icon], x + 4, y + 3); text(c, val, x + 15, y + 1, col); if (hv && tip) tipAt(x + w + 4, y, tip); return w; }
  function tipAt(x, y, lab) { const w = tw(lab) + 8, tx = Math.max(2, Math.min(WD - w - 2, x)); panel(c, tx, y, w, 13, { fill: '#0c1224', hi: '#5bc0ff' }); text(c, lab, tx + 4, y + 1, '#fff'); }
  function tabToggle(t) { tab = tab === t ? null : t; scroll[tab] = 0; if (tab) { const hn = Ex.Hints.take(S, tab); if (hn) dialog = { title: hn[0], lines: [hn[1]], buttons: [{ t: 'Понятно', ok: 1 }] }; } }
  function dock() {
    const M = mode === 'city' ? MENU_C : MENU, ws = M.map((m) => Math.max(38, tw(m[2]) + 10)), gap = 3, tot = ws.reduce((a, b) => a + b, 0) + gap * (M.length - 1), by = 189;
    panel(c, 0, 186, WD, 30, { fill: '#0f1830', hi: '#2a3a66' });
    let x = Math.round((WD - tot) / 2);
    M.forEach((m, i) => { const w = ws[i], on = tab === m[0], hv = button(x, by, w, 25, null, { on, fn: () => tabToggle(m[0]) }); Ex.R['dock:' + m[0]] = { x, y: by, w, h: 25 };
      c.drawImage(A.icons[m[1]], x + Math.round((w - 8) / 2), by + 3); text(c, m[2], x + Math.round(w / 2), by + 12, on || hv ? '#ffffff' : '#c9d6f0', { align: 'c' });
      if (m[0] === 'quests' && Lr) { const hn = Lr.nextHint(S); if (hn && (hn.ready || hn.offer)) { const up = Math.round(Math.sin(performance.now() / 160)); panel(c, x + w - 9, by - 5 + up, 10, 11, { fill: '#162038', hi: hn.ready ? '#5fe08a' : '#ffd24a' }); text(c, hn.ready ? '?' : '!', x + w - 4, by - 5 + up, hn.ready ? '#5fe08a' : '#ffd24a', { align: 'c', sh: null }); } }
      if (m[0] === 'arts' && Lr && !Lr.owned(S).length) { /* пока нет мечей */ }
      x += w + gap; });
  }
  function corner(x0, y) {
    CORNER.forEach((m, i) => { const x = x0 + i * 16, hv = button(x, y, 14, 14, null, { on: tab === m[0], fn: () => { if (m[0] === 'editor') { tab = null; window.FF.EditorUI.show(); return; } tabToggle(m[0]); } }); c.drawImage(A.icons[m[1]], x + 3, y + 3); if (hv) tipAt(x - tw(m[2]) / 2 - 4, y + 16, m[2]); });
  }
  const mm = (v) => String(v).replace('.', ',');
  function hud(info) {
    if (mode === 'city') { cityHud(); dock(); return; }
    // ряд 1: ресурсы слева, уровень героя справа
    let x = 4; x += chip(x, 3, 'coin', F(S.gold), COL.gold, 'Золото') + 3; x += chip(x, 3, 'gem', String(S.gems), COL.gem, 'Самоцветы') + 3; x += chip(x, 3, 'snow', String(S.shards), '#9fe8ff', 'Осколки льда') + 3;
    const ht = 'Герой ' + S.hero.lvl + ' ур.', lw = tw(ht) + 52; panel(c, WD - lw - 4, 3, lw, 13); text(c, ht, WD - lw + 1, 4, '#eaf5ff'); bar(c, WD - 50, 7, 42, 5, S.hero.xp / C.xpNeed(S.hero.lvl), '#4ade80', '#10261c');
    { const h0 = Ex.Time.hour(S), tt = Ex.Time.fmt(h0) + ' ' + Ex.Time.wname(S), cw = tw(tt) + 20, cx = WD - lw - 8 - cw; if (cx > x + 2) Fx.timeChip(c, S, cx, 3); }
    // ряд 2: кнопка столицы, значки, задание
    switchBtn(4, 19, 84, 13); corner(92, 18); trackerLine(210, 19, WD - 214);
    // ряд 3: характеристики героя
    const sc0 = Ex.Stats.get(S, C, performance.now()), eq = Lr && Lr.equipped(S), st = [['sword', 'Клик', F(sc0.click)], ['bolt', 'Урон/с', F(sc0.dps)], ['target', 'Крит', Math.round(sc0.crit * 100) + '% ×' + mm(sc0.critm.toFixed(1))]];
    x = 4; for (const [ic, lb, v] of st) { const t1 = lb + ' ' + v, w = tw(t1) + 18; panel(c, x, 35, w, 13); c.drawImage(A.icons[ic], x + 4, 38); text(c, lb, x + 14, 36, COL.mut); text(c, v, x + 14 + tw(lb) + 4, 36, '#fff'); x += w + 3; }
    if (eq) { const nm = fit(eq.name, 90), w = tw(nm) + 18; if (x + w < WD - 4) { panel(c, x, 35, w, 13, { hi: Lr.RARC[eq.rar].col }); c.drawImage(A.icons.blade, x + 4, 38); text(c, nm, x + 14, 36, Lr.RARC[eq.rar].col); } }
    // активные бонусы событий и умений
    const E = S.rt.E; let tx0 = 4; const tag = (t1, col) => { const w = tw(t1) + 10; panel(c, tx0, 51, w, 13, { hi: col }); text(c, t1, tx0 + 5, 52, col); tx0 += w + 3; };
    if (E && E.bliz > 0) tag('Метель: золото ×2 · ' + Math.ceil(E.bliz) + ' с', '#dfeeff'); if (E && E.fz > 0) tag('Безумие льда: урон ×5 · ' + Math.ceil(E.fz) + ' с', '#7fe0ff');
    // нижняя полоса над доком: этап слева, босс по центру, умения справа
    const sy = 171, zt = fit(info.zoneName, 110), zw = tw(zt) + 8; panel(c, 4, sy, zw, 13); text(c, zt, 8, sy + 1, '#eaf5ff');
    const stg = 'Этап ' + (S.n + 1) + (S.rt.farm ? ' фарм' : ''), pw = tw(stg) + 10 + 10 * 6 + 3, px0 = 4 + zw + 3; panel(c, px0, sy, pw, 13); text(c, stg, px0 + 5, sy + 1, COL.mut);
    for (let k = 0; k < 10; k++) { const bx = px0 + 5 + tw(stg) + 5 + k * 6, boss = k === 9; c.fillStyle = COL.edge; c.fillRect(bx, sy + 3, 5, 7); c.fillStyle = boss ? '#3a1d22' : '#1f2a48'; c.fillRect(bx + 1, sy + 4, 3, 5);
      const full = k < info.stage - 1, cur = k === info.stage - 1; if (full || cur) { c.fillStyle = boss ? '#ff4d6d' : '#5bc0ff'; c.fillRect(bx + 1, sy + 4, 3, 5); if (cur && !full) { c.fillStyle = boss ? '#3a1d22' : '#1f2a48'; const f2 = info.boss ? 1 : S.kills / info.need; c.fillRect(bx + 1, sy + 4, 3, Math.round(5 * (1 - f2))); } } }
    const sw = 28, sx0 = WD - 4 - 3 * (sw + 2) + 2; Ex.R.skills = { x: sx0, y: sy, w: 3 * sw + 4, h: 13 };
    { const rp = repairNeed(); if (rp) { const t1 = 'Починить: ' + rp.name + ' ' + Math.round(rp.pct * 100) + '%', w1 = tw(t1) + 18; const hv = hit(WD - w1 - 4, 51, w1, 13, () => { tab = 'forge'; Ex.Hints.take(S, 'forge'); scroll.forge = 0; if (window.FF.UI) window.FF.UI.sec.forge = 'gear'; }); panel(c, WD - w1 - 4, 51, w1, 13, { fill: hv ? '#5a2a2a' : '#3a1d22', hi: '#ff6b6b' }); c.drawImage(A.icons.shield, WD - w1, 54); text(c, t1, WD - w1 + 10, 52, '#ffb1a0'); } }
    if (!info.boss) { const bx = px0 + pw + 3; if (button(bx, sy, 18, 13, null, { icon: A.icons.crown, fn: () => { if (!C.callBoss(S)) toast('Босс уже здесь'); } })) tipAt(bx, sy - 15, 'Вызвать босса'); }
    C.SKILLS.forEach((k, i) => { const bx = sx0 + i * (sw + 2), ok = S.hero.lvl >= k.lvl, cd = S.cd[k.id], act = S.buff[k.id] > 0;
      const hv = button(bx, sy, sw, 13, null, { can: ok && cd <= 0, green: ok && cd <= 0, on: act, fn: () => C.useSkill(S, k.id) }); c.drawImage(A.icons[['snow', 'bolt', 'coin'][i]], bx + 3, sy + 3);
      if (ok && cd > 0) { c.fillStyle = 'rgba(8,12,28,.65)'; c.fillRect(bx + 1, sy + 1, sw - 2, 11); text(c, Math.ceil(cd) + '', bx + 18, sy + 1, '#fff', { align: 'c' }); }
      else if (!ok) text(c, k.lvl + 'у', bx + 18, sy + 1, '#7a86a6', { align: 'c' }); else text(c, String(i + 1), bx + 18, sy + 1, act ? '#ffd24a' : '#d8e6ff', { align: 'c', sh: null });
      if (hv) { const lab = k.name + ' · откат ' + k.cd + ' с', w = tw(lab) + 8; tipAt(Math.min(bx, WD - w - 4), sy - 15, lab); } });
    dock();
  }

  const ALLMENU = MENU.concat(MENU_C, CORNER, [['jr', 'scroll', 'Журнал']]), Wd = window.Core.World, City = window.City;
  const ICB = { hall: 'house', sawmill: 'wood', quarry: 'stone', tavern: 'mug', mine: 'iron', forge: 'sword', treasury: 'coin', walls: 'shield', mage: 'star', temple: 'snow' };
  const fx1 = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
  function effText(id, L) {
    const E = { hall: () => '+' + 4 * L + '% золота, +' + 2 * L + '% урона', sawmill: () => '+' + fx1(0.15 * L) + ' дерева/с', quarry: () => '+' + fx1(0.12 * L) + ' камня/с', mine: () => '+' + fx1(0.08 * L) + ' железа/с',
      tavern: () => 'Мест в отряде: ' + (L >= 10 ? 4 : L >= 6 ? 3 : L >= 3 ? 2 : L >= 1 ? 1 : 0), forge: () => 'Снаряжение +' + 5 * L + '%', treasury: () => 'Золото +' + L + '% этапа/с', walls: () => 'Время босса +' + fx1(1.5 * L) + ' с',
      mage: () => 'Откат -' + Math.min(40, 2 * L) + '%, шторм +' + 5 * L + '%', temple: () => 'Урон +' + 3 * L + '%, осколки +' + 6 * L + '%' };
    return E[id]();
  }
  // стоимость в виде значков
  function costLine(x, y, cost) {
    let cx = x; const items = [['coin', cost.gold, S.gold, COL.gold]]; for (const k of ['wood', 'stone', 'iron']) if (cost[k]) items.push([k, cost[k], S.city.res[k], Wd.RES[k].col]);
    for (const it of items) { c.drawImage(A.icons[it[0]], cx, y + 2); const t = F(it[1]); text(c, t, cx + 10, y, it[2] >= it[1] ? '#e6f1ff' : COL.bad); cx += 14 + tw(t) + 4; }
  }
  function switchBtn(x, y, w, h) {
    const city = mode === 'city'; Ex.R.switch = { x, y, w, h }; button(x, y, w, h, city ? 'В поход' : 'Столица', { icon: A.icons[city ? 'sword' : 'house'], green: true, dy: -1, fn: () => { mode = city ? 'battle' : 'city'; tab = null; bldDlg = null; Fx.curtain(); } });
  }
  function chipR(y, icon, val, col, rate) { const t = val, w = Math.max(60, tw(t) + 20 + (rate ? tw(rate) + 4 : 0)); panel(c, WD - w - 4, y, w, 13); c.drawImage(A.icons[icon], WD - w, y + 3); text(c, t, WD - w + 11, y + 1, col); if (rate) text(c, rate, WD - 8, y + 1, COL.mut, { align: 'r' }); }
  function trackerLine(x, y, w) {
    if (!Lr) return; const hn = Lr.nextHint(S); if (!hn) return; const q = hn.q, nm = Lr.NID[q.npc].name; let t, col = '#fff', hi = '#3a4f80';
    if (hn.offer) { t = 'Новое задание: поговори с ' + nm; col = '#ffd24a'; hi = '#ffd24a'; }
    else if (hn.ready) { t = q.title + ': сдай ' + nm; col = '#5fe08a'; hi = '#5fe08a'; }
    else { const rq = Lr.reqs(S, q).find((r) => !r.ok); t = q.title + (rq ? ': ' + rq.t.replace('Дойти до этапа ', 'этап ') + ' ' + rq.cur + '/' + rq.max : ''); }
    const hv = hit(x, y, w, 13, () => { tab = 'quests'; scroll.quests = 0; }); panel(c, x, y, w, 13, { fill: hv ? '#1d2a4a' : COL.bg2, hi }); c.drawImage(A.icons.scroll, x + 3, y + 2); text(c, fit(t, w - 16), x + 14, y + 1, col);
  }
  function cityHud() {
    const m = Wd.mods(S), cr = S.city.res;
    // ряд 1: слева деньги, справа материалы (цифры; скорость показывается при наведении)
    let x = 4; x += chip(x, 3, 'coin', F(S.gold), COL.gold, 'Золото') + 3; x += chip(x, 3, 'gem', String(S.gems), COL.gem, 'Самоцветы') + 3; chip(x, 3, 'snow', String(S.shards), '#9fe8ff', 'Осколки льда');
    const R = [['wood', 'Дерево'], ['stone', 'Камень'], ['iron', 'Железо']].map(([k, nm]) => ({ k, nm, v: F(cr[k]), rate: m[k] }));
    let rx = WD - 4; for (let i = R.length - 1; i >= 0; i--) { const r = R[i], w = Math.max(50, tw(r.v) + 20); rx -= w; const hv = hit(rx, 3, w, 13, null); panel(c, rx, 3, w, 13); c.drawImage(A.icons[r.k], rx + 4, 6); text(c, r.v, rx + 15, 4, Wd.RES[r.k].col); if (hv) tipAt(rx - 30, 18, r.nm + (r.rate ? ' +' + fx1(r.rate) + '/с' : ' (нет добычи)')); rx -= 3; }
    // ряд 2: кнопка похода, значки, задание
    switchBtn(4, 19, 84, 13); corner(92, 18); trackerLine(210, 19, WD - 214);
    // ряд 3: сводка по столице
    const info = 'Ратуша ' + Wd.lvl(S, 'hall') + ' · отряд ' + S.city.squad.length + '/' + Wd.squadSlots(S) + ' · вылазки ' + S.city.exp.length + '/' + Wd.expSlots(S); panel(c, 4, 35, tw(info) + 10, 13); text(c, info, 9, 36, COL.mut);
    const done = S.city.exp.filter((q) => Wd.expLeft(q) <= 0).length; if (!done) Fx.timeChip(c, S, 4 + tw(info) + 13, 35); if (done) { const t = 'Вылазка завершена! Забери награду', w = tw(t) + 12; panel(c, WD - w - 4, 35, w, 13, { fill: '#2f8f5f' }); text(c, t, WD - w + 2, 36, '#fff', { sh: null }); }
    else if (hoverSpot && Wd.BID[hoverSpot]) { const b = Wd.BID[hoverSpot], L = Wd.lvl(S, hoverSpot), t = b.name + (L ? ' · ур. ' + L : ' · не построено'), w = tw(t) + 10; panel(c, WD - w - 4, 35, w, 13, { hi: '#5bc0ff' }); text(c, t, WD - w + 1, 36, '#fff'); }
  }
  function bldDialog() {
    if (!bldDlg) return; const id = bldDlg, i = Wd.bldInfo(S, id), b = i.b, w = 250, h = 124, x = (WD - w) / 2, y = 34;
    hits.push({ x: 0, y: 0, w: WD, h: HT, fn: () => { bldDlg = null; }, block: true });
    hits.push({ x, y, w, h, fn: null, block: true });
    panel(c, x, y, w, h, { fill: '#162038', hi: '#5bc0ff' }); c.drawImage(A.icons[ICB[id]], x + 8, y + 8); text(c, b.name + '  ур. ' + i.L + (i.max < 20 || id === 'hall' ? '/' + i.max : ''), x + 22, y + 7, '#fff');
    button(x + w - 18, y + 4, 12, 11, null, { fn: () => { bldDlg = null; }, pink: true }); c.drawImage(A.icons.x, x + w - 16, y + 5);
    wrap(b.desc, w - 20).forEach((l, k) => text(c, l, x + 10, y + 22 + k * 11, COL.mut));
    const ly = y + 22 + wrap(b.desc, w - 20).length * 11 + 4;
    text(c, 'Сейчас: ' + (i.L ? effText(id, i.L) : '—'), x + 10, ly, '#fff'); if (!i.maxed) text(c, 'Дальше: ' + effText(id, i.L + 1), x + 10, ly + 11, COL.ok);
    if (i.maxed) text(c, i.capped ? 'Нужна Ратуша выше' : 'Максимальный уровень', x + w / 2, y + h - 20, COL.mut, { align: 'c' });
    else { text(c, 'Цена:', x + 10, y + h - 40, COL.mut); costLine(x + 44, y + h - 40, i.cost);
      button(x + 10, y + h - 24, w - 20, 18, !i.reqOk ? 'Нужна Ратуша ' + b.req + ' ур.' : i.L ? 'Улучшить' : 'Построить', { can: i.can, green: i.can, dy: -1, fn: () => { if (Wd.bldBuy(S, id)) toast(b.name + ': ур. ' + (i.L + 1), '#5fe08a'); } }); }
  }
  function heroPassText(id) { const d = Wd.HID[id]; return d.p.map(([k]) => { const v = Wd.pVal(S, id, k); return Wd.HNAME[k] + ' ' + (k === 'cd' ? '+' : '+') + fx1(v) + (k === 'boss' ? ' с' : '%'); }).join(', '); }
  function heroRow(id) {
    const i = Wd.heroInfo(S, id), d = i.d, r = Wd.HRAR[d.rar];
    return { h: 58, draw: (x, y, w) => {
      panel(c, x, y, w, 56, { fill: COL.bg2, hi: '#3a4f80' }); panel(c, x + 3, y + 4, 19, 19, { fill: '#10182e', hi: '#243459', lo: '#0a0f1e' }); const ic = A.humIcon(id); c.drawImage(ic, x + 3 + Math.round((19 - ic.width) / 2), y + 4 + Math.round((19 - ic.height) / 2));
      text(c, d.name, x + 27, y + 3, r.col); text(c, d.cls, x + w - 6, y + 3, COL.mut, { align: 'r' });
      if (i.owned) { for (let k = 0; k < i.star; k++) c.drawImage(A.icons.star1, x + 27 + k * 9, y + 14);
        text(c, 'ур. ' + i.lvl + '/' + i.cap + '  сила ' + F(i.power), x + 27 + 5 * 9 + 2, y + 14, '#fff'); text(c, heroPassText(id), x + 27, y + 25, COL.ok);
        const by = y + 37; const cost = i.cost;
        button(x + 4, by, 100, 17, null, { can: i.canLvl, green: i.canLvl, fn: () => { Wd.heroLevel(S, id, 1); }, rep: true }); text(c, i.lvl >= i.cap ? 'Нужна звезда' : '+1 ур.', x + 54 - (i.lvl >= i.cap ? 0 : 20), by + 3, i.canLvl ? '#fff' : '#7a86a6', { align: 'c', sh: null }); if (i.lvl < i.cap) { c.drawImage(A.icons.coin, x + 62, by + 5); text(c, F(cost), x + 72, by + 3, i.canLvl ? '#fff' : '#7a86a6', { sh: null }); }
        button(x + 108, by, 74, 17, i.inSquad ? 'В отряде' : i.busy ? 'В вылазке' : 'В отряд', { on: i.inSquad, can: i.inSquad || (!i.busy && S.city.squad.length < Wd.squadSlots(S)), dy: -1, fn: () => { if (!Wd.squadToggle(S, id)) toast(i.busy ? 'Герой в вылазке' : 'Нет мест в отряде (Таверна)', '#ff6b6b'); } });
        if (i.star < 5) button(x + 186, by, w - 190, 17, i.frag + '/' + i.nextStar, { icon: A.icons.star1, can: i.canStar, pink: i.canStar, dy: -1, fn: () => { if (Wd.heroStar(S, id)) toast(d.name + ': ' + (i.star + 1) + ' звезды!', '#ffd24a'); } }); else text(c, 'Макс. звёзд', x + 186 + (w - 190) / 2, by + 3, '#ffd24a', { align: 'c' });
      } else { text(c, 'Осколки: ' + i.frag + '/' + i.need, x + 27, y + 15, '#fff'); text(c, d.p.map(([k, v]) => Wd.HNAME[k] + ' +' + v + (k === 'boss' ? ' с' : '%')).join(', '), x + 27, y + 26, COL.mut);
        button(x + 4, y + 37, w - 8, 17, i.can ? 'Нанять героя' : 'Нужно ещё ' + (i.need - i.frag) + ' осколков', { can: i.can, green: i.can, dy: -1, fn: () => { if (Wd.heroUnlock(S, id)) toast(d.name + ' в столице!', r.col); } }); }
    } };
  }
  // ---------- вспомогательное для окон ----------
  const rowsOf = (list) => list;
  const wrapC = new Map();
  function wrap(s, maxW) { const key = maxW + '|' + s, hit0 = wrapC.get(key); if (hit0) return hit0; const r = wrap0(s, maxW); if (wrapC.size > 400) wrapC.clear(); wrapC.set(key, r); return r; }
  function wrap0(s, maxW) { const out = []; let line = ''; for (const wd of String(s).split(' ')) { const t = line ? line + ' ' + wd : wd; if (tw(t) > maxW && line) { out.push(line); line = wd; } else line = t; } if (line) out.push(line); return out; }
  function para(s, col, maxW) { const L = wrap(s, maxW); return { h: L.length * 11 + 4, draw: (x, y) => L.forEach((l, i) => text(c, l, x + 4, y + i * 11, col || COL.tx)) }; }
  function head(s, col) { return { h: 15, draw: (x, y) => text(c, s, x + 4, y + 2, col || COL.ac) }; }
  const AFN = { dmg: 'урон', gold: 'золото', crit: 'крит', click: 'клик', ally: 'армия' };
  const affTxt = (it) => (it.aff && it.aff.length ? ' · ' + it.aff.map((a) => '+' + a[1] + '% ' + AFN[a[0]]).join(', ') : '');
  function ctRow(i, ct) {
    const cur = Lr.ctCur(S, ct), ok = cur >= ct.need;
    return row({ icon: A.icons.scroll, name: Lr.ctName(ct) + ': ' + F(ct.need), desc: F(cur) + '/' + F(ct.need) + ' · ' + F(ct.rw.gold) + ' зол., ' + ct.rw.gems + ' самоцв.', descCol: ok ? COL.ok : COL.mut, btnW: 70, btn: (x, y, w, h) => button(x, y, w, h, ok ? 'Забрать' : F(cur) + '/' + F(ct.need), { can: ok, green: ok, dy: -1, fn: () => { const o = Lr.ctClaim(S, i); if (o) { toast('Контракт: +' + F(o.gold) + ' зол., +' + o.gems + ' самоцв.', '#5fe08a'); } } }) });
  }
  function row(o) { // иконка, имя, описание, кнопка справа
    return { h: o.h || 30, draw: (x, y, w) => {
      panel(c, x, y, w, 28, { fill: COL.bg2, hi: o.glow || '#3a4f80' }); if (o.glow) Fx.glow(c, x + 3, y + 4, 19, 19, o.glow);
      if (o.tip) { const hv = hit(x, y, w - (o.btn ? (o.btnW || 84) + 8 : 0), 28, () => { stickyTip = stickyTip === o.tipId ? null : o.tipId; }); if (hv || stickyTip === o.tipId) pendTip = hv ? { x: mouse.x + 10, y: mouse.y + 8, lines: o.tip() } : { x: x + 40, y: y + 18, lines: o.tip() }; }
      const bwid = o.btnW || 84; panel(c, x + 3, y + 4, 19, 19, { fill: '#10182e', hi: '#243459', lo: '#0a0f1e' });
      if (o.icon) c.drawImage(o.icon, x + 3 + Math.round((19 - o.icon.width) / 2), y + 4 + Math.round((19 - o.icon.height) / 2));
      const maxW = w - 30 - (o.btn ? bwid + 8 : 4);
      text(c, fit(o.name, maxW - (o.lvl ? tw(' ' + o.lvl) : 0)), x + 27, y + 3, o.nameCol || '#ffffff'); if (o.lvl) text(c, ' ' + o.lvl, x + 27 + tw(fit(o.name, maxW - tw(' ' + o.lvl))), y + 3, COL.mut);
      if (o.descDraw) o.descDraw(x + 27, y + 15, maxW); else if (o.desc) text(c, fit(o.desc, maxW), x + 27, y + 15, o.descCol || COL.mut);
      if (o.up) c.drawImage(A.icons.up, x + 15, y + 1 + Math.round(Math.sin(performance.now() / 180)));
      if (o.btn) o.btn(x + w - bwid - 3, y + 2, bwid, 24);
    } };
  }
  function buyBtn(p, fn, gem) { // кнопка покупки на 2 строки
    return (x, y, w, h) => {
      if (p.maxed) { button(x, y, w, h, 'Максимум', { can: false }); return; }
      if (!Ex.R.buy0) Ex.R.buy0 = { x, y, w, h }; button(x, y, w, h, null, { can: p.can, green: p.can && !gem, pink: p.can && gem, fn, rep: true, gold: true });
      text(c, '+' + p.k + (gem ? '' : ' ур.'), x + w / 2, y + 2, p.can ? '#fff' : '#7a86a6', { align: 'c' });
      const cost = gem ? String(p.cost) : F(p.cost), cw = tw(cost) + 10; c.drawImage(A.icons[gem ? 'gem' : 'coin'], x + Math.round((w - cw) / 2), y + 14); text(c, cost, x + Math.round((w - cw) / 2) + 10, y + 12, p.can ? '#fff' : '#7a86a6', { sh: p.can ? '#0a0f1e' : null });
    };
  }
  function bulkRow() { return { h: 17, draw: (x, y, w) => { text(c, 'Покупать:', x + 4, y + 3, COL.mut); [1, 10, 100, 'max'].forEach((v, i) => button(x + 62 + i * 40, y, 36, 15, v === 'max' ? 'Макс' : '×' + v, { on: S.set.bulk === v, fn: () => { S.set.bulk = v; }, dy: -1 })); } }; }

  function bladeIcon(x, y, ar, lv) { // маленький меч в рамке 19x19
    panel(c, x, y, 19, 19, { fill: '#10182e', hi: '#243459', lo: '#0a0f1e' }); if (!lv) { c.drawImage(A.icons.lock, x + 5, y + 5); return; }
    const p = ar.pal, bx = x + 9, w = ar.shape === 'wide' ? 4 : 2; c.fillStyle = p[1]; c.fillRect(bx - (w >> 1), y + 2, w, 10); c.fillStyle = p[0]; c.fillRect(bx - (w >> 1), y + 2, 1, 10); c.fillRect(bx - 1, y + 1, 2, 1);
    if (ar.shape === 'zig') { c.fillStyle = p[1]; c.fillRect(bx + 1, y + 4, 1, 2); c.fillRect(bx - 2, y + 8, 1, 2); }
    c.fillStyle = '#ffd24a'; c.fillRect(bx - 4, y + 12, 8, 1); c.fillStyle = '#6a4a30'; c.fillRect(bx - 1, y + 13, 2, 3); c.fillStyle = p[2]; c.fillRect(bx - 1, y + 16, 2, 1); c.fillRect(bx, y + 12, 1, 1);
  }
  function artRow(ar) {
    const i = Lr.artInfo(S, ar.id), rc = Lr.RARC[ar.rar];
    if (!i.have) return { h: 30, draw: (x, y, w) => { panel(c, x, y, w, 28, { fill: '#121a30', hi: '#2a3a66' }); bladeIcon(x + 3, y + 4, ar, 0); text(c, '???  ' + rc.name, x + 27, y + 3, '#6a7694'); text(c, fit('Где взять: ' + ar.src, w - 32), x + 27, y + 15, '#5a6682'); } };
    return { h: 56, draw: (x, y, w) => {
      panel(c, x, y, w, 54, { fill: i.eq ? '#1d2c4c' : COL.bg2, hi: i.eq ? rc.col : '#3a4f80' }); bladeIcon(x + 3, y + 4, ar, i.L);
      const bw = 80, mw = w - 32 - bw;
      text(c, fit(ar.name, mw - tw(' ур. 10/10')), x + 27, y + 3, rc.col); text(c, ' ур. ' + i.L + '/' + Lr.MAXL, x + 27 + tw(fit(ar.name, mw - tw(' ур. 10/10'))), y + 3, COL.mut);
      text(c, fit(Object.keys(ar.fx).map((k) => Lr.fxStr(k, Lr.fxVal(ar, k, i.L))).join(', '), mw), x + 27, y + 14, COL.ok);
      if (ar.proc) text(c, fit(Lr.procText(ar, i.L), mw), x + 27, y + 25, ar.proc.col); else text(c, fit('Без особого удара, зато стабильно', mw), x + 27, y + 25, '#6a7694');
      text(c, fit(ar.story, w - 12), x + 6, y + 39, '#7a86a6');
      button(x + w - bw - 3, y + 3, bw, 17, i.eq ? 'Надет' : 'Надеть', { on: i.eq, green: !i.eq, can: !i.eq, dy: -1, fn: () => { Lr.artEquip(S, ar.id); } });
      if (i.maxed) button(x + w - bw - 3, y + 22, bw, 17, 'Максимум', { can: false, dy: -1 });
      else { button(x + w - bw - 3, y + 22, bw, 17, null, { can: i.can, pink: i.can, fn: () => { if (Lr.artUp(S, ar.id)) toast(ar.name + ': ур. ' + (i.L + 1), '#ffd24a'); } });
        const ci = i.cost, cc = i.can ? '#fff' : '#7a86a6'; c.drawImage(A.icons.iron, x + w - bw + 1, y + 26); text(c, F(ci.iron), x + w - bw + 12, y + 24, S.city.res.iron >= ci.iron ? cc : COL.bad, { sh: null }); c.drawImage(A.icons.gem, x + w - bw + 40, y + 26); text(c, String(ci.gems), x + w - bw + 50, y + 24, S.gems >= ci.gems ? cc : COL.bad, { sh: null }); }
    } };
  }
  function questRow(q) {
    const rq = Lr.reqs(S, q), n = Lr.NID[q.npc], ok = Lr.qAllOk(S, q), rw = Lr.rewardLines(Lr.rewardOf(S, q)).join(', '), h = 16 + rq.length * 11 + 13 + (ok ? 12 : 0);
    return { h: h + 3, draw: (x, y, w) => {
      panel(c, x, y, w, h, { fill: COL.bg2, hi: ok ? '#5fe08a' : '#3a4f80' }); c.drawImage(A.icons.scroll, x + 4, y + 3); text(c, fit(q.title, w - 130), x + 16, y + 2, ok ? COL.ok : '#fff'); text(c, n.name, x + w - 4, y + 2, COL.mut, { align: 'r' });
      rq.forEach((r, k) => { const yy = y + 15 + k * 11; c.drawImage(r.ok ? A.icons.check : A.icons.x, x + 6, yy + 1); text(c, fit(r.t, w - 70), x + 17, yy, r.ok ? COL.ok : '#e6f1ff'); text(c, r.cur + '/' + r.max, x + w - 4, yy, r.ok ? COL.ok : COL.mut, { align: 'r' }); });
      const ry = y + 15 + rq.length * 11; text(c, fit('Награда: ' + rw, w - 10), x + 6, ry + 1, '#ffd24a');
      if (ok) text(c, 'Готово! Вернись к: ' + n.name + ', ' + n.where, x + 6, ry + 13, COL.ok);
    } };
  }
  // ---------- содержимое вкладок ----------
  function tabRows(w) {
    const R = [], tw2 = w - 10;
    if (tab === 'hero') {
      R.push(bulkRow());
      const IC = { str: A.icons.sword, crit: A.icons.target, critd: A.icons.bolt, gold: A.icons.coin };
      C.UPS.forEach((u) => { const L = S.up[u.id], p = C.priceNow(S, 'up', u.id);
        const d = { str: 'Клик: ' + F(C.clickDmg(S)), crit: 'Шанс крита: ' + Math.round(C.critChance(S) * 100) + '%', critd: 'Урон крита: ×' + C.critMult(S).toFixed(1).replace('.', ','), gold: 'Золото: +' + Math.round(L * 5) + '%' }[u.id];
        R.push(row({ icon: IC[u.id], name: u.name, lvl: 'ур. ' + L, desc: d, btn: buyBtn(p, () => C.buyUp(S, u.id)) })); });
      R.push(para('Каждые 25 уровней силы удар удваивается.', COL.mut, tw2));
    } else if (tab === 'allies') {
      R.push(bulkRow());
      C.ALLIES.forEach((a, i) => { const L = S.allies[i], p = C.priceNow(S, 'ally', i);
        R.push(row({ icon: i === 7 ? A.icons.snow : A.humIcon(i), name: a.name, lvl: L ? 'ур. ' + L : 'не нанят', desc: 'Урон: ' + F(C.allyDps(S, i) * C.dmgMult(S)) + '/с', btn: buyBtn(p, () => C.buyAlly(S, i)) })); });
    } else if (tab === 'items') {
      R.push(head('Надето'));
      Object.keys(C.SLOTS).forEach((k) => { const it = S.equip[k]; R.push({ h: 15, draw: (x, y, w) => { text(c, C.SLOTS[k].name + ':', x + 4, y + 2, COL.mut); if (it) { if (it.rar >= 3) Fx.glow(c, x + 62, y, Math.min(w - 130, tw(it.name)) + 4, 12, C.RAR[it.rar].col); text(c, fit(it.name, w - 130), x + 64, y + 2, C.RAR[it.rar].col); text(c, '+' + it.val + '%', x + w - 4, y + 2, COL.ok, { align: 'r' }); } else text(c, 'пусто', x + 64, y + 2, '#5a6682'); } }); });
      R.push({ h: 20, draw: (x, y, w) => { text(c, 'Сумка ' + S.bag.length + '/' + C.BAG_MAX, x + 4, y + 4, COL.ac); button(x + w - 112, y + 1, 108, 16, 'Продать слабые', { fn: () => { const n = C.sellWeak(S); toast(n ? 'Продано: ' + n : 'Слабых нет'); }, dy: -1 }); } });
      if (!S.bag.length) R.push(para('Сумка пуста. Предметы падают с монстров, а с боссов чаще и лучше. Лучшие вещи надеваются сами.', COL.mut, tw2));
      S.bag.forEach((it) => { const cur = C.eqv(S, it.slot), d = it.val - cur;
        R.push(row({ glow: it.rar >= 3 ? C.RAR[it.rar].col : null, tipId: 'i' + it.id, tip: () => cmpLines(it), icon: A.icons[it.slot === 'weapon' ? 'sword' : it.slot === 'armor' ? 'shield' : 'gem'], name: it.name, nameCol: C.RAR[it.rar].col, desc: C.SLOTS[it.slot].name + ' +' + it.val + '%  ' + (d > 0 ? '(+' + d + ')' : '(' + d + ')') + affTxt(it), descCol: d > 0 ? COL.ok : COL.bad, btnW: 108,
          btn: (x, y, w, h) => { button(x, y, 50, h, 'Надеть', { green: d > 0, fn: () => C.equipItem(S, it.id), dy: 0 }); button(x + 52, y, w - 52, h, null, { fn: () => C.sellItem(S, it.id) }); const t = F(C.itemPrice(it)); c.drawImage(A.icons.coin, x + 56, y + 8); text(c, t, x + 66, y + 6, '#fff'); } })); });
    } else if (tab === 'arts') {
      const ow = Lr.owned(S).length;
      R.push(para('Мечи в коллекции: ' + ow + ' из ' + Lr.ARTS.length + ' (каждый даёт +2% урона всегда). Надет может быть один. Прокачка за железо и самоцветы. Мечи дают жители столицы, боссы и руины.', COL.mut, tw2));
      Lr.ARTS.slice().sort((x, y) => (Lr.lvOf(S, y.id) > 0) - (Lr.lvOf(S, x.id) > 0) || y.rar - x.rar).forEach((ar) => R.push(artRow(ar)));
    } else if (tab === 'quests' || tab === 'jr') {
      if (tab === 'jr') {
        R.push({ h: 20, draw: (x, y, w) => { button(x + 4, y + 1, 110, 16, '< К заданиям', { dy: -1, fn: () => { tab = 'quests'; scroll.quests = 0; } }); button(x + w - 94, y + 1, 90, 16, 'Очистить', { dy: -1, fn: () => ask('Очистить журнал?', ['Записи диалогов будут удалены.'], () => { Ex.Journal.clear(S); }) }); } });
        const J = Ex.Journal.list(S);
        if (!J.length) R.push(para('Пока пусто. Поговори с жителями столицы: все реплики запишутся сюда.', '#5a6682', tw2));
        for (let i = J.length - 1; i >= 0; i--) { const e = J[i]; const col = e.k === 'c' ? COL.ok : '#ffd24a'; const L = wrap(e.x, tw2 - 8); R.push({ h: L.length * 11 + 15, draw: (x, y) => { text(c, (e.k === 'c' ? 'Вы' : e.w) + '  ' + C.fmtTime(e.p), x + 4, y + 1, col); L.forEach((l, k) => text(c, l, x + 8, y + 12 + k * 11, e.k === 'c' ? '#bfe9cf' : '#e6f1ff')); } }); }
      } else {
      const pg = Fx.book.page, PN = ['Контракты', 'Задания жителей', 'Выполненные'];
      R.push({ h: 20, draw: (x, y, w) => { button(x + 4, y + 1, 22, 16, '<', { can: pg > 0, dy: -1, fn: () => Fx.flipTo(pg - 1, 3) }); text(c, 'Страница ' + (pg + 1) + '/3: ' + PN[pg], x + w / 2, y + 4, '#ffd24a', { align: 'c' }); button(x + w - 26, y + 1, 22, 16, '>', { can: pg < 2, dy: -1, fn: () => Fx.flipTo(pg + 1, 3) }); } });
      const act = Lr.activeQuests(S), offers = Lr.NPCS.filter((n) => Lr.npcVisible(S, n)).map((n) => Lr.npcMode(S, n.id)).filter((m) => m.mode === 'offer'), done = Lr.QS.filter((q) => Lr.qst(S, q.id) === 2);
      if (pg === 0) {
        R.push(para('Повторяющиеся контракты: каждый 10-й даёт меч.', COL.mut, tw2));
        Lr.contracts(S).forEach((ct, i) => R.push(ctRow(i, ct)));
      } else if (pg === 1) {
        R.push(para('Жители столицы дают задания. Поговори с ними в режиме «Столица»: над головой будет «!» (новое) или «?» (можно сдать).', COL.mut, tw2));
        { const zn = C.ZONES[Math.min(C.ZONES.length - 1, C.stageInfo(S.n).zone + 1)]; const pend = Ex.Acts.pending(S, Lr, C, Math.min(C.ZONES.length - 1, C.stageInfo(S.n).zone + 1)); if (pend.length) R.push(para('Перед биомом «' + zn.name + '» осталось сдать: ' + pend.length + ' (' + pend.slice(0, 2).map((q) => q.title).join(', ') + ')', '#ffd24a', tw2)); }
        R.push(head('Активные'));
        if (!act.length) R.push(para('Пока нет. Загляни в столицу и поговори с жителями.', '#5a6682', tw2));
        act.forEach((q) => R.push(questRow(q)));
        if (offers.length) { R.push(head('Новые')); offers.forEach((m) => { R.push({ h: 15, draw: (x, y, w) => { text(c, '!', x + 6, y + 1, '#ffd24a', { sh: null }); text(c, fit(m.q.title, w - 140), x + 16, y + 1, '#fff'); text(c, Lr.NID[m.q.npc].name + ', ' + Lr.NID[m.q.npc].where, x + w - 4, y + 1, COL.mut, { align: 'r' }); } }); }); }
      } else {
        R.push(para('Выполнено заданий: ' + done.length + ' из ' + Lr.QS.length + '.', COL.mut, tw2));
        done.forEach((q) => R.push({ h: 15, draw: (x, y, w) => { c.drawImage(A.icons.check, x + 6, y + 2); text(c, fit(q.title, w - 120), x + 18, y + 1, COL.ok); text(c, Lr.NID[q.npc].name, x + w - 4, y + 1, COL.mut, { align: 'r' }); } }));
      }
      R.push({ h: 22, draw: (x, y, w) => button(x + 4, y + 2, 150, 17, 'Журнал диалогов (' + Ex.Journal.list(S).length + ')', { dy: -1, fn: () => { tab = 'jr'; scroll.jr = 0; } }) });
      }
    } else if (tab === 'skills') {
      R.push(para('Горячие клавиши: 1, 2, 3. Пробел или клик по сцене: удар.', COL.mut, tw2));
      const IC = ['snow', 'bolt', 'coin'];
      C.SKILLS.forEach((k, i) => { const ok = S.hero.lvl >= k.lvl, cd = S.cd[k.id], act = S.buff[k.id] > 0;
        R.push(row({ icon: A.icons[IC[i]], name: k.name, lvl: ok ? '' : 'с ' + k.lvl + ' ур.', desc: k.desc + (k.dur ? ' ' + k.dur + ' с' : '') + ' · ' + k.cd + ' с', btn: (x, y, w, h) => button(x, y, w, h, act ? 'Работает ' + Math.ceil(S.buff[k.id]) : !ok ? 'Закрыто' : cd > 0 ? 'Ждать ' + Math.ceil(cd) + ' с' : 'Применить', { can: ok && cd <= 0, green: ok && cd <= 0, fn: () => C.useSkill(S, k.id) }) })); });
    } else if (tab === 'bld') {
      R.push(para('Нажми на здание в городе или улучши его тут. Остальные здания не выше (2 × Ратуша + 2) уровня.', COL.mut, tw2));
      Wd.BLD.forEach((b) => { const i = Wd.bldInfo(S, b.id);
        R.push(row({ icon: A.icons[ICB[b.id]], name: b.name, up: i.can && !i.maxed, lvl: i.L ? 'ур. ' + i.L : 'не построено', descDraw: (x, y) => { if (i.maxed) text(c, i.capped ? 'Нужна Ратуша выше' : 'Максимум', x, y, COL.mut); else if (!i.reqOk) text(c, 'Нужна Ратуша ' + b.req + ' ур.', x, y, COL.bad); else costLine(x, y, i.cost); }, btnW: 66,
          btn: (x, y, w, h) => button(x, y, w, h, i.maxed ? 'Макс.' : i.L ? 'Улучшить' : 'Построить', { can: i.can, green: i.can, dy: -1, fn: () => { if (Wd.bldBuy(S, b.id)) toast(b.name + ': ур. ' + (i.L + 1), '#5fe08a'); } }) })); });
    } else if (tab === 'heroes') {
      R.push(para('Отряд воюет в походе. Мест в отряде: ' + Wd.squadSlots(S) + ' (растёт с Таверной). Остальные герои ходят в вылазки. Осколки падают с боссов, из вылазок и призыва.', COL.mut, tw2));
      Wd.HEROES.slice().sort((a, b) => (Wd.heroInfo(S, b.id).owned - Wd.heroInfo(S, a.id).owned) || (b.rar - a.rar)).forEach((h) => R.push(heroRow(h.id)));
    } else if (tab === 'tavern') {
      const tl = Wd.lvl(S, 'tavern');
      if (!tl) R.push(para('Сначала построй Таверну в столице.', COL.bad, tw2));
      R.push(para('Здесь призывают осколки героев. Осколки открывают новых героев и дают им звёзды.', COL.mut, tw2));
      ['gold', 'gems'].forEach((k) => { const cs = Wd.summonCost(S, k), can = tl > 0 && (k === 'gold' ? S.gold >= cs : S.gems >= cs), sm = Wd.SUMMON[k];
        R.push(row({ icon: A.icons[k === 'gold' ? 'coin' : 'gem'], name: sm.name, desc: sm.qty[0] + '-' + sm.qty[1] + ' осколков героя' + (k === 'gems' ? ', чаще легенды' : ''), btnW: 84,
          btn: (x, y, w, h) => { button(x, y, w, h, null, { can, green: can && k === 'gold', pink: can && k === 'gems', fn: () => { const r = Wd.summon(S, k); if (r) { dialog = { title: 'Призыв', lines: [r.h.name + ' (' + Wd.HRAR[r.h.rar].name + ')', 'Получено осколков: ' + r.q], buttons: [{ t: 'Отлично', ok: 1 }] }; } } }); text(c, 'Призвать', x + w / 2, y + 2, can ? '#fff' : '#7a86a6', { align: 'c', sh: can ? '#0a0f1e' : null }); const t = k === 'gold' ? F(cs) : String(cs), cw = tw(t) + 10; c.drawImage(A.icons[k === 'gold' ? 'coin' : 'gem'], x + Math.round((w - cw) / 2), y + 14); text(c, t, x + Math.round((w - cw) / 2) + 10, y + 12, can ? '#fff' : '#7a86a6', { sh: can ? '#0a0f1e' : null }); } })); });
      R.push(head('Твои осколки'));
      Wd.HEROES.forEach((h) => { const i = Wd.heroInfo(S, h.id); if (i.frag > 0 || i.owned) R.push({ h: 13, draw: (x, y, w) => { text(c, h.name, x + 4, y + 1, Wd.HRAR[h.rar].col); text(c, i.owned ? 'ур. ' + i.lvl + ' · ' + i.star + ' зв. · осколки ' + i.frag : 'осколки ' + i.frag + '/' + i.need, x + w - 4, y + 1, COL.mut, { align: 'r' }); } }); });
    } else if (tab === 'exp') {
      const c0 = S.city, slots = Wd.expSlots(S), idle = Wd.idleHeroes(S).sort((a, b) => Wd.hPower(S, b) - Wd.hPower(S, a));
      R.push(para('Вылазки: отправь героев не из отряда на время. Чем они сильнее нужной силы, тем богаче добыча. Слоты: ' + c0.exp.length + '/' + slots + '. Свободных героев: ' + idle.length + '.', COL.mut, tw2));
      c0.exp.forEach((x, idx) => { const e = Wd.EID[x.k], left = Wd.expLeft(x), done = left <= 0, mm = Math.floor(left / 60), ss = Math.floor(left % 60);
        R.push(row({ icon: A.icons.map, name: e.name, nameCol: done ? COL.ok : '#fff', desc: done ? 'Готово! Герои вернулись' : 'Осталось ' + mm + ':' + String(ss).padStart(2, '0') + ' · ' + x.heroes.map((id) => Wd.HID[id].name.split(' ')[0]).join(', '), btnW: 84,
          btn: (bx, by, bw, bh) => done ? button(bx, by, bw, bh, 'Забрать', { green: true, dy: -1, fn: () => { const r = Wd.expClaim(S, idx); if (r) { const parts = []; for (const k in r.res) parts.push(F(r.res[k]) + ' ' + Wd.RES[k].name.toLowerCase()); parts.push(F(r.gold) + ' золота'); if (r.gems) parts.push(r.gems + ' самоцв.'); if (r.frag) parts.push(r.frag + ' осколков: ' + Wd.HID[r.hero].name); Fx.chestOpen('Вылазка завершена', ['Эффективность ×' + String(r.m).replace('.', ',')].concat(parts.reduce((a, t, i) => { if (i % 2 === 0) a.push(t); else a[a.length - 1] += ', ' + t; return a; }, [])), r.m >= 1.5 ? 2 : r.m >= 1 ? 1 : 0); } } }) : button(bx, by, bw, bh, 'Ускорить 5', { can: S.gems >= 5, pink: S.gems >= 5, icon: null, dy: -1, fn: () => { Wd.expSkip(S, idx); } }) })); });
      Wd.EXPS.forEach((e) => { const pick = idle.slice(0, 3), power = pick.reduce((a, id) => a + Wd.hPower(S, id), 0), r = Wd.expRewards(S, e, power), can = pick.length > 0 && c0.exp.length < slots;
        R.push({ h: 44, draw: (x, y, w) => { panel(c, x, y, w, 42, { fill: COL.bg2, hi: '#3a4f80' }); c.drawImage(A.icons.map, x + 8, y + 5); text(c, e.name + '  ' + e.min + ' мин', x + 24, y + 3, '#fff'); text(c, 'нужно ' + F(Wd.recPower(S, e)) + ' силы (у вас ' + F(power) + ', ×' + String(r.m).replace('.', ',') + ')', x + 24, y + 14, power >= Wd.recPower(S, e) ? COL.ok : COL.mut);
          let cx = x + 6; const L2 = []; for (const k in r.res) L2.push([k, r.res[k]]); L2.push(['coin', r.gold]); if (r.gems) L2.push(['gem', r.gems]); if (r.frag) L2.push(['helm', r.frag]); for (const it of L2) { c.drawImage(A.icons[it[0]], cx, y + 28); const t = F(it[1]); text(c, t, cx + 10, y + 26, '#fff'); cx += 14 + tw(t) + 4; }
          button(x + w - 76, y + 22, 70, 17, !pick.length ? 'Нет героев' : c0.exp.length >= slots ? 'Нет слотов' : 'Отправить', { can, green: can, dy: -1, fn: () => { if (Wd.expStart(S, e.id, pick)) toast('Отправлены: ' + pick.map((id) => Wd.HID[id].name.split(' ')[0]).join(', '), '#5bc0ff'); } }); } }); });
    } else if (tab === 'shop') {
      R.push(para('Самоцветы дают боссы и награды. Улучшения остаются навсегда, даже после перерождения.', COL.mut, tw2));
      C.GEMUPS.forEach((g) => { const L = S.gemUp[g.id], mx = L >= g.max, cost = g.cost(L);
        R.push(row({ icon: A.icons.gem, name: g.name, lvl: L + '/' + g.max, desc: g.desc, btn: buyBtn({ k: 1, cost, can: S.gems >= cost, maxed: mx }, () => C.buyGem(S, g.id), true) })); });
    } else if (tab === 'prest') {
      const g = C.shardGain(S);
      R.push(para('Перерождение сбрасывает золото, прокачку, союзников и этап. Остаются самоцветы, снаряжение, умения и награды. Каждый осколок даёт +5% урона и +2% золота навсегда.', COL.tx, tw2));
      R.push(para('Осколков сейчас: ' + S.shards + '  (бонус урона +' + S.shards * 5 + '%)', '#9fe8ff', tw2));
      R.push(para(g ? 'За перерождение получишь: ' + g + ' осколков' : 'Дойди до 30 этапа, чтобы получить первые осколки. Лучший этап: ' + (S.maxN + 1), g ? COL.ok : COL.mut, tw2));
      R.push({ h: 26, draw: (x, y, w) => button(x + 4, y + 2, 150, 20, 'Переродиться', { can: !!g, green: !!g, fn: () => ask('Переродиться?', ['Ты получишь ' + g + ' осколков льда.', 'Золото, прокачка, союзники и этап сбросятся.'], () => { C.prestige(S); persist(); toast('Перерождение! +' + g + ' осколков', '#9fe8ff'); }) }) });
    } else if (tab === 'ach') {
      C.ACH.forEach((a) => { const d = !!S.ach[a.id];
        R.push(row({ icon: d ? A.icons.check : A.icons.lock, name: a.name, nameCol: d ? COL.ok : '#9aa4c0', desc: a.desc, btnW: 46, btn: (x, y, w, h) => { c.drawImage(A.icons.gem, x + 2, y + 6); text(c, '+' + a.gems, x + 14, y + 4, d ? COL.ok : COL.gem); } })); });
      R.push(para('Монстров побеждено: ' + F(S.st.kills) + ' · Боссов: ' + S.st.bosses + ' · Кликов: ' + F(S.st.clicks) + ' · Время игры: ' + C.fmtTime(S.st.play), COL.mut, tw2));
    } else if (tab === 'forge' || tab === 'daily' || tab === 'raid') {
      R.push(...window.FF.UI.rows(tab, uiH(w)));
    } else if (tab === 'set') {
      const sw = (k, t) => ({ h: 20, draw: (x, y, w) => { text(c, t, x + 4, y + 4, '#fff'); const bx = x + w - 22; button(x + 0, y, w, 18, null, { fn: () => { S.set[k] = !S.set[k]; if (k === 'light') Sc.setLight(S.set.light); persist(); }, can: true, fill: 1 }); panel(c, x, y, w, 18, { fill: '#243459' }); text(c, t, x + 6, y + 3, '#fff'); panel(c, bx, y + 2, 14, 14, { fill: '#10182e' }); if (S.set[k]) c.drawImage(A.icons.check, bx + 3, y + 5); } });
      R.push(sw('light', 'Экономный режим (слабый ПК)')); R.push(sw('autoBoss', 'Авто-вызов босса')); R.push(sw('autoEquip', 'Надевать лучшие предметы сам'));
      R.push(head('Сохранение'));
      R.push({ h: 24, draw: (x, y, w) => { button(x + 4, y + 2, 70, 18, 'Экспорт', { fn: exportSave, dy: -1 }); button(x + 78, y + 2, 70, 18, 'Импорт', { fn: importSave, dy: -1 }); button(x + 152, y + 2, 90, 18, 'Сбросить всё', { fn: () => ask('Сбросить всё?', ['Весь прогресс пропадёт навсегда.'], () => { S = C.newState(); C.ensureRt(S); persist(); toast('Новая игра'); }), dy: -1 }); } });
      R.push(para('Игра сохраняется сама каждые 60 секунд и при закрытии вкладки (три слота: основной, запасной и временный).', COL.mut, tw2));
      R.push(head('Интерфейс'));
      R.push({ h: 22, draw: (x, y, w) => { button(x + 4, y, 104, 17, 'Хитбоксы F4: ' + (dbgHit ? 'вкл' : 'выкл'), { dy: -1, on: dbgHit, fn: () => { dbgHit = !dbgHit; } }); button(x + 112, y, 104, 17, 'Джойстик: ' + (joyOn() ? 'вкл' : 'выкл'), { dy: -1, on: joyOn(), fn: () => { S.ff.opt = S.ff.opt || {}; S.ff.opt.joy = !joyOn(); } }); button(x + 220, y, 104, 17, 'Обучение заново', { dy: -1, fn: () => { Ex.Tutorial.reset(S); tab = null; toast('Обучение начнётся заново', '#ffd24a'); } }); } });
      { const Sg = Ex.Storage.info; R.push(para('Хранилище: ' + (Sg.ok === false ? 'недоступно (' + Sg.err + ')' : 'в порядке') + ', занято ' + (Sg.used / 1024).toFixed(0) + ' КБ' + (Sg.quota ? ' из ' + (Sg.quota / 1048576).toFixed(0) + ' МБ' : '') + '. Качество эффектов: ' + ['низкое', 'среднее', 'высокое'][Ex.Perf.q] + ', ' + Math.round(Ex.Perf.fps) + ' к/с.', Sg.ok === false ? COL.bad : COL.mut, tw2)); }
      R.push(...window.FF.UI.settings(uiH(w)));
    }
    return R;
  }
  function uiH(w) { return { Wd, S, C, F, COL, A, c, text, tw, fit, button, row, head, para, buyBtn, toast, ask, w, bar, debug: FFm.debug, resetScroll: () => { scroll[tab] = 0; }, showText: (t, body) => showDlg(t, '', body), prompt: showDlg, chest: Fx.chestOpen, hint: (k) => { const hn = Ex.Hints.take(S, k); if (hn) dialog = { title: hn[0], lines: [hn[1]], buttons: [{ t: 'Понятно', ok: 1 }] }; }, openConsole, showCredits: () => { credits = { y: HT }; tab = null; }, restart: (f) => ask('Новая игра+?', ['Прогресс сбросится, враги станут сильнее,', 'награда за золото и опыт вырастет.'], () => { if (window.FF.UX.NG.start(S, C)) { persist(); toast('Новая игра+ началась', '#ffd24a'); } }), saveStr: () => C.save(S), loadState: (str) => { S = C.load(str); C.ensureRt(S); FFm.attach(S, C, FFhost); Sc.setLight(S.set.light); persist(); } }; }
  const chromeCache = {}, chromeKeys = [];
  function modalView() { const sx = Fx.modalShake(); if (!sx) return modalView0(); c.save(); c.translate(sx, 0); modalView0(); c.restore(); }
  function modalView0() {
    const MX = 24, MY = 14, MW = 336, MH = 172, title = (ALLMENU.find((m) => m[0] === tab) || [])[2];
    hits.push({ x: MX, y: MY, w: MW, h: MH, fn: null, block: true });
    { // пункт 60: статичная рамка окна (панель, шапка, иконка, заголовок) рисуется один раз в offscreen-кэш
      const sub = fit(SUB[tab] || '', MW - 30 - tw(title) - 40), ck = tab + '|' + sub; let oc = chromeCache[ck];
      if (!oc) { oc = document.createElement('canvas'); oc.width = MW; oc.height = MH; const o = oc.getContext('2d'); o.imageSmoothingEnabled = false;
        panel(o, 0, 0, MW, MH, { fill: '#162038' }); panel(o, 2, 2, MW - 4, 15, { fill: '#243459', hi: '#3a4f80' });
        o.drawImage(A.icons[ALLMENU.find((m) => m[0] === tab)[1]], 7, 5); text(o, title, 19, 3, '#fff'); text(o, sub, MW - 24, 3, COL.mut, { align: 'r' });
        if (chromeKeys.length >= 24) delete chromeCache[chromeKeys.shift()]; chromeKeys.push(ck); chromeCache[ck] = oc; Ex.chromeBuilt = (Ex.chromeBuilt || 0) + 1; }
      c.drawImage(oc, MX, MY);
    }
    button(MX + MW - 18, MY + 4, 12, 11, null, { fn: () => { tab = null; }, pink: true }); c.drawImage(A.icons.x, MX + MW - 16, MY + 5);
    const fs = tab === 'quests' ? Fx.flipState(curDt) : null, vx = MX + 6, vy = MY + 21, vw = MW - 20, vh = MH - 27, rows = tabRows(vw);
    const total = rows.reduce((a, r) => a + r.h, 0), max = Math.max(0, total - vh), key = tab; scroll[key] = Math.max(0, Math.min(max, scroll[key] || 0));
    c.save(); c.beginPath(); c.rect(vx, vy, vw, vh); c.clip(); clip = { x: vx, y: vy, w: vw, h: vh };
    const hoPrev = hitsOff; if (fs && fs.flipping) { hitsOff = true; c.save(); c.translate(vx, 0); c.scale(fs.k, 1); c.translate(-vx, 0); }
    let yy = vy - Math.round(scroll[key]); for (const r of rows) { if (yy + r.h > vy && yy < vy + vh) r.draw(vx, yy, vw); yy += r.h; }
    if (fs && fs.flipping) { c.restore(); hitsOff = hoPrev; c.fillStyle = 'rgba(0,0,0,' + fs.shade.toFixed(2) + ')'; c.fillRect(vx, vy, Math.round(vw * fs.k), vh); c.fillStyle = '#e8f0ff'; c.fillRect(Math.round(vx + vw * fs.k) - 1, vy, 1, vh); }
    c.restore(); clip = null; wheelArea = { x: MX, y: MY, w: MW, h: MH, key, max };
    if (max > 0) { const tx = vx + vw + 3; c.fillStyle = '#0c1224'; c.fillRect(tx, vy, 5, vh); const th = Math.max(12, Math.round(vh * vh / total)), ty = vy + Math.round((vh - th) * scroll[key] / max); c.fillStyle = '#5a7cc0'; c.fillRect(tx, ty, 5, th); c.fillStyle = '#9ab8f0'; c.fillRect(tx, ty, 5, 1);
      hit(tx - 4, vy, 13, vh / 2, () => { scroll[key] = Math.max(0, scroll[key] - 40); }); hit(tx - 4, vy + vh / 2, 13, vh / 2, () => { scroll[key] = Math.min(max, scroll[key] + 40); }); }
    if (pendTip) { drawTip(pendTip); pendTip = null; }
  }

  // ---------- подсказки: сравнение вещей, ремонт, проверка акта ----------
  function cmpLines(it) {
    const eq = S.equip[it.slot], L = [{ t: it.name, c: C.RAR[it.rar].col }, { t: C.SLOTS[it.slot].name + ' · ' + C.RAR[it.rar].name + ' · ур. ' + it.lvl, c: COL.mut }];
    const cur = eq ? eq.val : 0, d = it.val - cur; L.push({ t: 'Значение +' + it.val + '% (надето ' + (eq ? '+' + cur + '%' : 'пусто') + ') ' + (d > 0 ? '+' : '') + d, c: d > 0 ? COL.ok : d < 0 ? COL.bad : '#ffffff' });
    const sum = (x) => { const m = {}; if (x && x.aff) for (const a of x.aff) m[a[0]] = (m[a[0]] || 0) + a[1]; return m; }, a1 = sum(it), a0 = sum(eq);
    for (const k of new Set(Object.keys(a1).concat(Object.keys(a0)))) { const dd = (a1[k] || 0) - (a0[k] || 0); L.push({ t: '+' + (a1[k] || 0) + '% ' + AFN[k] + ' (было ' + (a0[k] || 0) + ') ' + (dd > 0 ? '+' : '') + dd, c: dd > 0 ? COL.ok : dd < 0 ? COL.bad : COL.mut }); }
    L.push({ t: 'Продажа: ' + F(C.itemPrice(it)) + ' зол.', c: '#ffd24a' }); return L;
  }
  function drawTip(t) {
    let w = 0; t.lines.forEach((l) => { w = Math.max(w, tw(l.t)); }); w += 10; const h = t.lines.length * 11 + 6, x = Math.max(2, Math.min(WD - w - 2, t.x)), y = Math.max(2, Math.min(HT - h - 2, t.y));
    panel(c, x, y, w, h, { fill: '#0c1224', hi: '#5bc0ff' }); t.lines.forEach((l, i) => text(c, l.t, x + 5, y + 3 + i * 11, l.c));
  }
  function repairNeed() {
    const f = FFm.forge; if (!f || !S.equip) return null; let w = null;
    for (const k in S.equip) { const it = S.equip[k]; if (!it) continue; f.initDur(it); const pct = it.dur / f.durMax(it); if (pct < 0.4 && (!w || pct < w.pct)) w = { it, pct, name: C.SLOTS[k].name.toLowerCase() }; }
    return w;
  }
  function actCheck(zone) { const pend = Ex.Acts.pending(S, Lr, C, zone); if (pend.length) { toast('Новый биом: не сдано заданий ' + pend.length + ' («' + pend[0].title + '»)', '#ffd24a'); } }
  function joyOn() { const o = S && S.ff && S.ff.opt; if (o && typeof o.joy === 'boolean') return o.joy; return Ex.Joy.isTouch(); }

  // ---------- разговоры с жителями ----------
  function setNode(n) { talk = n ? { node: n, ch: 0, who: Lr.NID[n.who] } : null; if (n && Lr.NID[n.who]) Ex.Journal.add(S, Lr.NID[n.who].name, n.t, 'd'); }
  function openTalk(npcId) { hoverSpot = null; setNode(Lr.start(S, npcId)); }
  function pickChoice(chc) {
    if (chc.can && !chc.can(S)) return; if (chc.t && chc.t.length > 4) Ex.Journal.add(S, 'Вы', chc.t, 'c'); if (chc.do) chc.do(S);
    if (chc.tab) { talk = null; tab = chc.tab; scroll[tab] = 0; return; }
    let nx = null; if (typeof chc.go === 'string') nx = Lr.NODES[chc.go]; else if (chc.go) { nx = chc.go(S); if (typeof nx === 'string') nx = Lr.NODES[nx]; }
    setNode(nx || null); persist();
  }
  function drawTalk(dt) {
    if (!talk) return; const n = talk.node, who = talk.who, full = String(n.t); talk.ch = Math.min(full.length, talk.ch + dt * 55); const done = talk.ch >= full.length;
    c.fillStyle = 'rgba(4,8,20,.45)'; c.fillRect(0, 0, WD, HT);
    const bx = 6, by = 96, bw = WD - 12, bh = 114; hits.push({ x: 0, y: 0, w: WD, h: HT, fn: () => { if (talk && !done) talk.ch = full.length; }, block: true });
    panel(c, bx, by, bw, bh, { fill: '#162038', hi: '#5bc0ff' });
    // портрет
    panel(c, bx + 6, by + 6, 80, 62, { fill: '#0f1830', hi: '#3a4f80' });
    const spr = A.hum(who.key, 0, false), sh = Math.floor(spr.height * 0.66);
    c.save(); c.beginPath(); c.rect(bx + 7, by + 7, 78, 60); c.clip(); if (who.ghost) c.globalAlpha = 0.75; c.drawImage(spr, 0, 0, spr.width, sh, bx + 6 + Math.round((80 - spr.width * 2) / 2), by + 9, spr.width * 2, sh * 2); c.restore(); c.globalAlpha = 1;
    text(c, who.name, bx + 46, by + 72, '#ffd24a', { align: 'c' }); text(c, who.title, bx + 46, by + 84, COL.mut, { align: 'c' });
    // текст
    const tx = bx + 96, tw2 = bw - 108, shown = full.slice(0, Math.floor(talk.ch));
    wrap(full, tw2).forEach((l, i) => { const used = wrap(full, tw2).slice(0, i).join(' ').length + (i ? 1 : 0), part = shown.slice(used, used + l.length); if (part) text(c, part, tx, by + 8 + i * 12, '#eaf3ff'); });
    // варианты
    if (done) { let x = tx, y = by + bh - 40; const row = []; 
      n.c.forEach((chc, i) => { const lab = chc.t, w = Math.min(tw2, tw(lab) + 18); if (x + w > tx + tw2) { x = tx; y += 19; } const can = !chc.can || chc.can(S); button(x, y, w, 16, lab, { can, green: !!chc.green && can, dy: -1, fn: () => pickChoice(chc) }); x += w + 5; });
    } else text(c, '...', bx + bw - 14, by + bh - 14, COL.mut);
  }

  // ---------- диалоги, всплывающие сообщения ----------
  function ask(title, lines, yes) { dialog = { title, lines, buttons: [{ t: 'Отмена' }, { t: 'Да', ok: 1, fn: yes }] }; }
  function toast(t, col, fadeIn) { toasts.push({ t, col: col || '#5bc0ff', life: 3.6, age: fadeIn ? 0 : 9 }); if (toasts.length > 3) toasts.shift(); }
  let credits = null;
  function drawCredits(dt) {
    credits.y -= dt * 22; const L = window.FF.UX.CREDITS; c.fillStyle = 'rgba(6,10,24,0.94)'; c.fillRect(0, 0, WD, HT);
    L.forEach((l, i) => { const y = Math.round(credits.y + i * 16); if (y > -12 && y < HT) text(c, l, Math.round(WD / 2), y, i === 0 ? '#ffd24a' : (/^[А-ЯA-Z]/.test(l) && L[i - 1] === '' ? '#5bc0ff' : '#e8f0ff'), { align: 'c' }); });
    if (credits.y + L.length * 16 < -10) credits = null;
  }
  function openConsole(out) {
    dp.style.whiteSpace = 'pre-wrap'; showDlg('Консоль', (out && out.length ? out.join('\n') + '\n\n' : '') + 'Команда (help - список):', '', (v) => { const r = window.FF.UX.Console.run(v, { S, C, Main: FFm }); if (v) setTimeout(() => openConsole(r), 30); else dp.style.whiteSpace = ''; });
  }
  function drawDialog() {
    if (!dialog) return; c.fillStyle = 'rgba(4,8,20,.7)'; c.fillRect(0, 0, WD, HT);
    const w = 250, L = []; dialog.lines.forEach((l) => L.push(...wrap(l, w - 20))); const h = 52 + L.length * 12, x = (WD - w) / 2, y = Math.round((HT - h) / 2);
    hits.push({ x: 0, y: 0, w: WD, h: HT, fn: null, block: true });
    panel(c, x, y, w, h, { fill: '#162038', hi: '#5bc0ff' }); text(c, dialog.title, WD / 2, y + 7, '#5bc0ff', { align: 'c' }); L.forEach((l, i) => text(c, l, WD / 2, y + 23 + i * 12, '#eaf3ff', { align: 'c' }));
    const bs = dialog.buttons, bw = 90, tot = bs.length * bw + (bs.length - 1) * 8; bs.forEach((b, i) => button(x + (w - tot) / 2 + i * (bw + 8), y + h - 24, bw, 17, b.t, { green: !!b.ok, dy: -1, fn: () => { const d = dialog; dialog = null; if (b.fn) b.fn(); } }));
  }
  function drawToasts(dt) {
    let y = 68; for (let i = toasts.length - 1; i >= 0; i--) { const t = toasts[i]; t.life -= dt; t.age += dt; if (t.life <= 0) { toasts.splice(i, 1); continue; } const w = tw(t.t) + 12, x = Math.round((WD - w) / 2) - 18; c.globalAlpha = Math.min(1, t.life * 2, t.age * 1.6); panel(c, x, y, w, 14, { fill: '#162038', hi: t.col }); c.fillStyle = t.col; c.fillRect(x + 2, y + 3, 2, 8); text(c, t.t, x + 7, y + 1, '#fff'); y += 16; } c.globalAlpha = 1;
  }

  // ---------- сохранение: экспорт / импорт ----------
  const dlg = document.getElementById('dlg'), dt = document.getElementById('dt'), dp = document.getElementById('dp'), dx = document.getElementById('dx');
  function showDlg(title, p, val, ok) { dt.textContent = title; dp.textContent = p; dx.value = val || ''; dlg.style.display = 'flex'; document.getElementById('dok').onclick = () => { dlg.style.display = 'none'; if (ok) ok(dx.value.trim()); }; document.getElementById('dno').onclick = () => { dlg.style.display = 'none'; }; setTimeout(() => dx.focus(), 30); }
  function exportSave() { const t = btoa(unescape(encodeURIComponent(C.save(S)))); try { navigator.clipboard.writeText(t); toast('Код скопирован'); } catch (e) {} showDlg('Экспорт', 'Скопируй этот код и сохрани:', t); }
  function importSave() { showDlg('Импорт', 'Вставь код. Текущий прогресс будет заменён.', '', (v) => { try { S = C.load(decodeURIComponent(escape(atob(v)))); C.ensureRt(S); FFm.attach(S, C, FFhost); Sc.setLight(S.set.light); persist(); toast('Сохранение загружено'); } catch (e) { toast('Код не подошёл', '#ff6b6b'); } }); }

  let _sc = 0; function FF_audio_scroll() { const t = performance.now(); if (t - _sc > 90 && window.FF && window.FF.audio && window.FF.audio.ctx) { _sc = t; window.FF.audio.ui('scroll'); } return true; }
  // ---------- ввод ----------
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * WD / r.width, y: (e.clientY - r.top) * HT / r.height }; };
  cv.addEventListener('pointermove', (e) => { mouse = pos(e); if (EUI.open) EUI.pointerMove(mouse); });
  cv.addEventListener('pointerleave', () => { mouse = { x: -1, y: -1 }; });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  function press(e) { e.preventDefault(); mouse = pos(e); pressAt(e); }
  function pressAt(e) {
    if (!ready) return; Ex.last = { x: mouse.x, y: mouse.y }; if (credits) { credits = null; return; } if (EUI.open && !dialog && EUI.pointerDown(mouse, e || {})) return;
    const now = performance.now();
    for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (mouse.x >= h.x && mouse.x < h.x + h.w && mouse.y >= h.y && mouse.y < h.y + h.h) {
      if (h.fn) { if (!h.rep && !Ex.guard.ui(h.x + ',' + h.y + ',' + h.w + ',' + h.h, now)) return; if (!h.can) { Fx.kick(h); if (h.gold) Fx.kickGold(); } FFm.uiSound(h.can); h.fn(); if (h.rep) { clearTimeout(hold); hold = setTimeout(function t() { h.fn(); hold = setTimeout(t, 90); }, 420); } }
      return; } }
    if (mode === 'battle' && !talk && !dialog) { if (window.Core.Events && window.Core.Events.click(S, mouse.x, mouse.y)) return; if (!Ex.guard.allow(now)) { if (Ex.guard.suspicious && !Ex.guard.warned) { Ex.guard.warned = 1; toast('Слишком частые клики: лимит снижен до 6 в секунду', '#ffd24a'); S.ff.suspect = Ex.guard.flags; } return; } C.hit(S); FFm.onClick(); }
  }
  // Касания: короткое касание = клик (по отпусканию), движение пальцем = прокрутка списка / панорама редактора; джойстик и кнопки действий работают независимо
  let tp = null; const jp = {};
  function joyAction(id) {
    if (id === 'hit') { mouse = { x: Ex.Joy.cur.x, y: Ex.Joy.cur.y }; pressAt(null); } else if (mode === 'battle') C.useSkill(S, { s1: 'storm', s2: 'cry', s3: 'rain' }[id]);
  }
  cv.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return press(e);
    e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    mouse = pos(e);
    if (ready && joyOn() && !tab && !dialog && !talk && !EUI.open && !credits && !Fx.chest.on) {
      const b = Ex.Joy.btnAt(mouse.x, mouse.y); if (b) { jp[e.pointerId] = 'btn'; Ex.Joy.btnId = b.id; joyAction(b.id); return; }
      if (Ex.Joy.id === null && Ex.Joy.inBase(mouse.x, mouse.y)) { jp[e.pointerId] = 'base'; Ex.Joy.start(e.pointerId, mouse.x, mouse.y); return; }
    }
    const wa = wheelArea && mouse.x >= wheelArea.x && mouse.x < wheelArea.x + wheelArea.w && mouse.y >= wheelArea.y && mouse.y < wheelArea.y + wheelArea.h && !EUI.open ? wheelArea : null;
    if (EUI.open && !dialog) { press(e); tp = { ed: true }; return; }
    tp = { e, x: mouse.x, y: mouse.y, wa, start: wa ? (scroll[wa.key] || 0) : 0, drag: false };
  });
  cv.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch') return; if (jp[e.pointerId] === 'base') { const p0 = pos(e); Ex.Joy.move(p0.x, p0.y); return; } if (jp[e.pointerId] || !tp || tp.ed) return; const p = pos(e);
    if (!tp.drag && tp.wa && Math.abs(p.y - tp.y) > 3) { tp.drag = true; mouse = { x: -1, y: -1 }; }
    if (tp.drag) scroll[tp.wa.key] = Math.max(0, Math.min(tp.wa.max, tp.start - (p.y - tp.y)));
  });
  const tEnd = (e) => { if (e.pointerType !== 'touch') return; const jt = jp[e.pointerId]; if (jt) { delete jp[e.pointerId]; if (jt === 'base') Ex.Joy.end(); else Ex.Joy.btnId = null; return; } if (!tp) return; const t = tp; tp = null; if (t.ed || t.drag) return; if (e.type === 'pointerup') { mouse = { x: t.x, y: t.y }; press(t.e); } };
  ['pointerup', 'pointercancel'].forEach((n) => cv.addEventListener(n, tEnd));
  ['pointerup', 'pointercancel'].forEach((n) => addEventListener(n, () => { if (EUI.open) EUI.pointerUp(); clearTimeout(hold); hold = null; }));
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const p = pos(e); if (wheelArea && FF_audio_scroll()) { /* звук прокрутки */ } if (EUI.open && EUI.wheel(p, e.deltaY)) return; if (wheelArea && p.x >= wheelArea.x && p.x < wheelArea.x + wheelArea.w && p.y >= wheelArea.y && p.y < wheelArea.y + wheelArea.h) scroll[wheelArea.key] = Math.max(0, Math.min(wheelArea.max, (scroll[wheelArea.key] || 0) + Math.sign(e.deltaY) * 30)); }, { passive: false });
  addEventListener('keyup', (e) => { if (EUI.open && e.code === 'Space') EUI.key(e); });
  addEventListener('keydown', (e) => {
    if (!ready) return;
    if (dlg.style.display === 'flex') { if (e.key === 'Escape') dlg.style.display = 'none'; return; }
    if (credits) { if (e.key === 'Escape' || e.code === 'Space' || e.key === 'Enter') credits = null; return; }
    if (Fx.chest.on) { if (e.key === 'Escape' || e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (Fx.chest.t > 1.7) Fx.chest.on = false; } return; }
    if (e.code === 'Backquote') { e.preventDefault(); openConsole(); return; }
    if (e.code === 'F4') { e.preventDefault(); dbgHit = !dbgHit; return; }
    if (EUI.open && !dialog && !FFm.rebind) { if (EUI.key(e)) return; }
    if (e.repeat || FFm.rebind) return;
    if (talk) { if (e.key === 'Escape') talk = null; else if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); const f = String(talk.node.t); if (talk.ch < f.length) talk.ch = f.length; else if (talk.node.c.length === 1) pickChoice(talk.node.c[0]); } else if (/^[1-4]$/.test(e.key) && talk.ch >= String(talk.node.t).length && talk.node.c[+e.key - 1]) pickChoice(talk.node.c[+e.key - 1]); return; }
    if (e.key === 'Escape') { if (dialog) dialog = null; else if (bldDlg) bldDlg = null; else tab = null; }
    else if (dialog) return;
    else if (FFm.action(e.code) === 'click') { e.preventDefault(); if (mode === 'battle' && Ex.guard.allow(performance.now())) { C.hit(S); FFm.onClick(); } }
    else if (mode !== 'battle') return;
    else if (FFm.action(e.code) === 'skill1') C.useSkill(S, 'storm'); else if (FFm.action(e.code) === 'skill2') C.useSkill(S, 'cry'); else if (FFm.action(e.code) === 'skill3') C.useSkill(S, 'rain');
  });

  let qw = 0;
  function questWatch() { if (!Lr) return; const t = performance.now(); if (t - qw < 1000) return; qw = t; for (const q of Lr.activeQuests(S)) if (Lr.qAllOk(S, q) && !notified[q.id]) { notified[q.id] = 1; Fx.questBanner(q.title, 'Сдай: ' + Lr.NID[q.npc].name + ', ' + Lr.NID[q.npc].where, '#5fe08a'); } }
  // ---------- события игры ----------
  function events(ev) {
    for (const e of ev) {
      if (e.t === 'drop' && e.v.rar >= 2) { toast(C.RAR[e.v.rar].name + ': ' + e.v.name, C.RAR[e.v.rar].col); if (e.v.rar >= 3) { const r = Ex.Dupes.resolve(S, C); if (r.n) toast('Дубликат легенды переплавлен: +' + F(r.gold) + ' зол., +' + r.n + ' самоцв.', '#ff9c2a'); } }
      else if (e.t === 'ach') toast('Награда: ' + e.v.name + ' (+' + e.v.gems + ')', '#ffd24a');
      else if (e.t === 'zone') toast('Босс повержен!', '#5fe08a');
      else if (e.t === 'art') { const ar = Lr.AID[e.id]; if (e.up) toast('Меч усилен: ' + ar.name, Lr.RARC[ar.rar].col); else dialog = { title: 'Новый меч!', lines: ['«' + ar.name + '» (' + Lr.RARC[ar.rar].name + ')', ar.story, Object.keys(ar.fx).map((k) => Lr.fxStr(k, Lr.fxVal(ar, k, 1))).join(', '), ar.proc ? Lr.procText(ar, 1) : ''].filter(Boolean), buttons: [{ t: 'Отлично', ok: 1 }] }; }
      else if (e.t === 'evt') { if (e.k === 'reward' && e.col === '#d8a860') Fx.chestOpen('Обоз каравана', [e.text], 1); if (e.k === 'spawn') toast(e.what === 'wisp' ? 'Ночной огонёк! Поймай его кликом' : e.what === 'flake' ? 'Золотая снежинка! Поймай её кликом' : e.what === 'goblin' ? 'Гоблин-вор! Бей его, пока не убежал' : 'Обоз каравана! Нажми на сундук', '#ffd24a'); else if (e.k === 'bliz') toast('Метель! Золото ×2 на 30 с', '#dfeeff'); else if (e.k === 'miss') toast('Гоблин сбежал с добычей', '#ff9c6b'); }
      else if (e.t === 'frag') toast('Осколки: ' + Wd.HID[e.id].name.split(' ')[0] + ' ×' + e.q, '#b66cff');
    }
  }

  // ---------- сеть: индикатор, ежедневный бонус, друзья, проверка файлов ----------
  function onlineTick(now) {
    const N = FFm.net; if (!N) return;
    if (now - lastNetChk > 60000) { lastNetChk = now; N.check().then((ok) => { if (ok && N.registered && !onl.daily) { onl.daily = 1; N.daily().then((r) => { if (r && r.ok && !r.claimed) toast('Ежедневный бонус готов: Настройки > Онлайн', '#ffd24a', true); }); } }); }
    if (N.registered && N.status === 'online' && now - onl.fr > 300000) {
      onl.fr = now; const fr = Ex.Friends.st(S); if (fr.list.length) N.friends(fr.list, 'stage').then((r) => { if (r && r.ok) for (const d of Ex.Friends.diff(S, r.friends)) toast('Рекорд друга ' + d.nick + ': этаж ' + d.to, '#ffd24a', true); });
    }
  }
  function netDotDraw() {
    const N = FFm.net, st = N ? N.status : 'off', x = WD - 14, y = 200; Fx.netDot(c, st, x, y);
    if (hit(x - 2, y - 2, 12, 12, () => { if (N) N.check().then((ok) => toast(ok ? 'Сервер отвечает: ' + N.ping + ' мс' : 'Сервер недоступен', ok ? '#5fe08a' : '#ff8a8a')); })) tipAt(WD - 130, y - 15, st === 'online' ? 'Сеть: на связи' + (N.ping ? ' ' + N.ping + ' мс' : '') : st === 'offline' ? 'Сеть: нет связи' : 'Сеть: не проверена');
  }

  // ---------- цикл ----------
  function loop(now) {
    requestAnimationFrame(loop);
    if (S.set.light && now - last < 33) return;
    const raw = Math.min(0.25, (now - last) / 1000); last = now; const dt = Math.min(raw, 0.05); curDt = dt; // шаг моделирования не больше 0.05 с; остаток тратится дополнительными шагами
    Ex.Perf.sample(raw); Fx.tick(dt); Ex.R = {};
    FFm.frame(dt); const wdt = window.FF.fx.update(dt); S.rt.mode = mode; C.tick(S, wdt);
    for (let rem = raw - dt; rem > 1e-4; rem -= 0.05) C.tick(S, Math.min(0.05, rem));
    const ev = S.rt.ev.slice(); FFm.onEvents(ev); events(ev); ev.forEach((e) => { Sc.fx(e, S); Fx.onEvent(e); if (e.t === 'dmg' && e.proc) Fx.sparks(292, 120, 6, [e.proc.col, '#ffffff'], 0.5); }); S.rt.ev.length = 0;
    hits = []; if (EUI.open) { hitsOff = false; EUI.frame(c, edH(), dt); drawToasts(dt); hitsOff = false; drawDialog(); view.drawImage(off, 0, 0, cv.width, cv.height); cv.style.cursor = 'crosshair'; if (Ex.Autosave.due(now, lastSave)) { lastSave = now; persist(); } return; }
    if (joyOn() && !tab) { Ex.Joy.update(dt); if (Ex.Joy.id !== null) mouse = { x: Ex.Joy.cur.x, y: Ex.Joy.cur.y }; }
    if (tab !== lastTab) { Fx.fadeCapture(off, { x: 16, y: 8, w: 352, h: 182 }); lastTab = tab; }
    hitsOff = !!(dialog || talk);
    const info = C.stageInfo(S.n), zone = info.zone; if (lastZone < 0) lastZone = zone; else if (zone !== lastZone) { if (zone > lastZone) actCheck(zone); lastZone = zone; }
    if (mode === 'city') {
      Fx.buildings(dt, Wd, S); spots = City.frame(c, S, dt, hoverSpot); for (const sp0 of spots) if (Wd.BID[sp0.id] && sp0.h > 20) Ex.R['bld:' + sp0.id] = { x: sp0.x + 6, y: sp0.y + 36, w: sp0.w - 12, h: sp0.h - 44 };
      if (!tab && !dialog && !bldDlg && !talk) { let hv = null; for (const sp of spots) if (hit(sp.x, sp.y, sp.w, sp.h, () => { if (sp.npc) openTalk(sp.npc); else bldDlg = sp.id; })) hv = sp.id; hoverSpot = hv; } else hoverSpot = null;
      Fx.buildFx(c, spots, dt, S); Fx.weather(c, S, dt, 0); Fx.daylight(c, S, 'city', spots, (id) => Wd.BID[id] && Wd.lvl(S, id) > 0);
    } else { Sc.frame(c, S, wdt); Fx.heat(c, S); Fx.heroAura(c, S); Fx.blur(c, S); Fx.dissolve(c, S, dt); Fx.rays(c, S, zone); Fx.weather(c, S, dt, zone); Fx.daylight(c, S, 'battle'); }
    hud(info);
    drawToasts(dt);
    if (tab) modalView();
    Fx.fadeDraw(c, dt);
    { const tut = Ex.Tutorial.st(S), was = tut.done; hitsOff = !!(dialog || talk || credits); if (!was && !dialog && !talk && !credits && !Fx.chest.on) { const cur = Ex.Tutorial.current(S, { tab, mode, C, Wd }); if (cur) Fx.tutorial(c, cur, { button, skip: () => { tut.skipped = 1; Ex.Tutorial.finish(S, false); } }); } if (!was && tut.done && !tut.skipped) toast('Обучение пройдено: +3 самоцвета', '#5fe08a'); }
    if (FFm.debug) { const L = FFm.debugLines(window.FF.fx); panel(c, 2, 34, 150, L.length * 10 + 6, { fill: '#0c1224' }); L.forEach((l, i) => text(c, l, 6, 37 + i * 10, '#9fe', { sh: null })); }
    hitsOff = !!(dialog || talk); bldDialog();
    hitsOff = !!dialog; drawTalk(dt);
    hitsOff = false; drawDialog();
    hitsOff = !!(dialog || talk || tab || bldDlg); if (!dialog && !talk) netDotDraw();
    Fx.drawSparks(c, dt); Fx.questDraw(c, dt); Fx.chestDraw(c, dt, (h) => hits.push(h)); Fx.curtainDraw(c, dt);
    if (credits) drawCredits(dt);
    hitsOff = false; if (joyOn() && !tab && !dialog && !talk && !credits && !Fx.chest.on) Fx.joystick(c, S, Ex.Joy, mode);
    questWatch(); onlineTick(now);
    if (now - lastRepair > 180000 && repairNeed()) { lastRepair = now; toast('Оружие изношено: почини его в Кузнице', '#ff9c6b'); }
    if (dbgHit) Fx.hitboxes(c, hits, spots, mouse);
    // курсор: рука над кнопками
    let over = false; for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (mouse.x >= h.x && mouse.x < h.x + h.w && mouse.y >= h.y && mouse.y < h.y + h.h) { over = !!h.fn; break; } } cv.style.cursor = over ? 'pointer' : 'crosshair';
    view.drawImage(off, 0, 0, cv.width, cv.height);
    if (Ex.Autosave.due(now, lastSave)) { lastSave = now; persist(); }
  }

  const EUI = window.FF.EditorUI; let edHO = null;
  const edH = () => edHO || (edHO = { text, tw, fit, panel, button, COL, hit, tipAt, showDlg, ask, tileSprite: Fx.tileSprite });
  const FFhost = { toast: (t, col) => toast(t, col), credits: () => { credits = { y: HT }; } };
  // Запуск: экран загрузки с прогрессом по этапам и подсказкой
  function start() {
    fitScreen(); const ld = document.getElementById('ld'); if (ld) ld.remove();
    const tip = Ex.Tips.random(), t0 = performance.now(); let offg = null, i = 0;
    const stages = [
      ['Ядро и шина событий', () => { FFm.boot(); try { window.FF.audio.chip8 = localStorage.getItem('ff.chip8') === '1'; } catch (e) { /* ignore */ } }],
      ['Проверка хранилища', () => { Ex.Storage.check(); Ex.Storage.estimate().then(() => { const w = Ex.Storage.warning(); if (w) toast(w, '#ff9c6b'); }); if (Ex.Storage.info.ok === false) setTimeout(() => toast(Ex.Storage.warning(), '#ff6b6b'), 500); }],
      ['Загрузка сохранения', () => { S = loadSave() || C.newState(); C.ensureRt(S); }],
      ['Подключение модулей', () => { FFm.attach(S, C, FFhost); Ex.Stats.install(C); if (!window.__enhSub) { window.__enhSub = 1; window.FF.bus.on('enhance', (e) => { const p0 = Ex.last || { x: 192, y: 100 }; if (e.ok) Fx.sparks(p0.x, p0.y, 14, ['#ffd24a', '#ffffff', '#7fe0ff'], 0.8); else { Fx.sparks(p0.x, p0.y, e.res === 'break' ? 60 : 32, e.res === 'break' ? ['#ff4d4d', '#ff9c2a', '#ffffff'] : ['#ff9c2a', '#ffd24a', '#ffffff'], e.res === 'break' ? 1.3 : 1); Fx.kick(null); try { if (window.FF.audio && window.FF.audio.ctx) window.FF.audio.play('hit'); } catch (x) { /* ignore */ } } }); } try { if (/[?&]light=1/.test(location.search)) S.set.light = true; } catch (e) { /* ignore */ } }],
      ['Сцена и графика', () => { Sc.init(); Sc.setLight(S.set.light); }],
      ['Дубликаты и обучение', () => { Ex.Dupes.resolve(S, C); Ex.Tutorial.st(S); }],
      ['Офлайн-прогресс', () => { offg = C.offlineGain(S, Math.min(12 * 3600, FFm.offlineSecs(S))); }],
      ['Проверка файлов', () => {
        try { if (/^https?:/.test(location.protocol) && typeof fetch === 'function') Ex.Integrity.verify((u) => fetch(u, { cache: 'no-store' }), '').then((st) => { const N = FFm.net; if (!N) return; N.build = { ver: Ex.Integrity.ver, bh: Ex.Integrity.bh }; N.blocked = st === 'tampered' ? 'integrity' : (N.blocked === 'integrity' ? null : N.blocked); if (st === 'tampered') toast('Файлы игры изменены: рейтинг отключён', '#ff6b6b'); }); } catch (e) { /* ignore */ }
      }],
    ];
    function step(now) {
      const el = (now - t0) / 1000; if (i < stages.length) { const st = stages[i++]; try { st[1](); } catch (e) { window.FF.Log.error('boot', st[0], e); } }
      const pct = Math.min(1, i / stages.length), lab = i < stages.length ? stages[i][0] + '...' : 'Готово';
      Fx.loader(c, pct, lab, tip, el); view.drawImage(off, 0, 0, cv.width, cv.height);
      if (i < stages.length || el < 0.9) return requestAnimationFrame(step);
      if (offg) dialog = { title: 'С возвращением!', lines: ['Пока тебя не было (' + C.fmtTime(offg.secs) + '), отряд победил ' + F(offg.kills) + ' монстров.', 'Добыча: ' + F(offg.gold) + ' золота' + (offg.res ? ', ' + F(offg.res.wood) + ' дерева, ' + F(offg.res.stone) + ' камня, ' + F(offg.res.iron) + ' железа' : '') + '.'], buttons: [{ t: 'Забрать', ok: 1, fn: () => { C.applyOffline(S, offg); } }] };
      else if (!S.st.clicks && Ex.Tutorial.st(S).done) toast('Клик или пробел: удар', '#5bc0ff');
      addEventListener('beforeunload', persist); document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
      ready = true; last = performance.now(); requestAnimationFrame(loop);
    }
    requestAnimationFrame(step);
  }
  window.__FF = { get S() { return S; }, C, Ex, Fx, talk: (id) => openTalk(id), get tk() { return talk; }, open: (t) => { tab = t; }, mode: (m) => { mode = m; tab = null; }, bld: (id) => { bldDlg = id; }, bldId: () => bldDlg, get ready() { return ready; }, hitbox: (v) => { dbgHit = v === undefined ? !dbgHit : !!v; }, get hits() { return hits; } };
  start();
})();
