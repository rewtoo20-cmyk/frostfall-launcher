// FROSTFALL: игровой интерфейс (всё рисуется на холсте 384x216 в пиксельном стиле).
(function () {
  'use strict';
  const C = window.Core, Sc = window.Scene, A = window.ART, PX = window.PX, COL = PX.COL, { text, tw, fit, panel, bar } = PX, F = C.fmt;
  const WD = 384, HT = 216, KEY = 'frostfall.save.v2';
  const cv = document.getElementById('cv'), c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  let mode = 'battle', bldDlg = null, hoverSpot = null, spots = [], S, tab = null, hits = [], clip = null, hitsOff = false, mouse = { x: -1, y: -1 }, scroll = {}, wheelArea = null, dialog = null, toasts = [], hold = null;
  let last = 0, lastSave = 0;

  // ---------- сохранение ----------
  const persist = () => { try { localStorage.setItem(KEY, C.save(S)); } catch (e) {} };
  const loadSave = () => { try { const t = localStorage.getItem(KEY); if (t) return C.load(t); } catch (e) {} return null; };

  // ---------- масштаб окна ----------
  function fitScreen() {
    const d = window.devicePixelRatio || 1, k = Math.max(1, Math.floor(Math.min(innerWidth * d / WD, innerHeight * d / HT) + 1e-6));
    cv.style.width = WD * k / d + 'px'; cv.style.height = HT * k / d + 'px';
  }
  addEventListener('resize', fitScreen);

  // ---------- кнопки (мгновенный режим) ----------
  function hit(x, y, w, h, fn, o) {
    if (hitsOff) return false;
    let r = { x, y, w, h };
    if (clip) { const x0 = Math.max(x, clip.x), y0 = Math.max(y, clip.y), x1 = Math.min(x + w, clip.x + clip.w), y1 = Math.min(y + h, clip.y + clip.h); if (x1 <= x0 || y1 <= y0) return false; r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
    hits.push({ x: r.x, y: r.y, w: r.w, h: r.h, fn, rep: o && o.rep });
    return mouse.x >= r.x && mouse.x < r.x + r.w && mouse.y >= r.y && mouse.y < r.y + r.h;
  }
  function button(x, y, w, h, label, o) {
    o = o || {}; const hv = hit(x, y, w, h, o.fn, o), on = o.on, can = o.can !== false;
    const fill = on ? '#3a8ad8' : can ? (o.green ? '#2f8f5f' : o.pink ? '#9a3f8a' : '#34508a') : '#262e48';
    panel(c, x, y, w, h, { fill: hv && can ? PX.shade(fill, 22) : fill, hi: can ? PX.shade(fill, 50) : '#3a4468', lo: PX.shade(fill, -40) });
    const col = can ? '#ffffff' : '#7a86a6';
    if (o.icon) { c.drawImage(o.icon, x + 4, y + Math.round((h - o.icon.height) / 2)); }
    if (label !== undefined && label !== null) text(c, label, x + Math.round(w / 2) + (o.icon ? 4 : 0), y + Math.round((h - 11) / 2) + (o.dy || 0), col, { align: 'c' });
    return hv;
  }

  // ---------- верхняя часть ----------
  const MENU_C = [['bld', 'house', 'Постройки'], ['heroes', 'helm', 'Герои'], ['exp', 'map', 'Вылазки'], ['tavern', 'mug', 'Таверна'], ['shop', 'shop', 'Магазин'], ['ach', 'trophy', 'Награды'], ['set', 'gear', 'Настройки']];
  const MENU = [['hero', 'sword', 'Герой'], ['allies', 'shield', 'Союзники'], ['items', 'bag', 'Снаряжение'], ['skills', 'star', 'Умения'], ['shop', 'shop', 'Магазин'], ['prest', 'snow', 'Перерождение'], ['ach', 'trophy', 'Награды'], ['set', 'gear', 'Настройки']];
  function chip(x, y, icon, val, col) { const w = Math.max(52, tw(val) + 20); panel(c, x, y, w, 13); c.drawImage(A.icons[icon], x + 4, y + 3); text(c, val, x + 15, y + 1, col); }
  function hud(info) {
    chip(4, 4, 'coin', F(S.gold), COL.gold); chip(4, 18, 'gem', String(S.gems), COL.gem); chip(4, 32, 'snow', String(S.shards), '#9fe8ff');
    if (mode === 'battle') {
    // зона и этап
    const zt = info.zoneName, zw = Math.max(110, tw(zt) + 20); panel(c, WD / 2 - zw / 2, 3, zw, 14); text(c, zt, WD / 2, 4, '#eaf5ff', { align: 'c' });
    text(c, 'Этап ' + (S.n + 1) + (S.rt.farm ? ' (фарм)' : ''), WD / 2, 19, COL.mut, { align: 'c' });
    const px0 = WD / 2 - 5 * 9;
    for (let k = 0; k < 10; k++) { const x = px0 + k * 9, boss = k === 9; c.fillStyle = COL.edge; c.fillRect(x, 32, 8, 6); c.fillStyle = boss ? '#3a1d22' : '#1f2a48'; c.fillRect(x + 1, 33, 6, 4);
      if (k < info.stage - 1) { c.fillStyle = boss ? '#ff4d6d' : '#5bc0ff'; c.fillRect(x + 1, 33, 6, 4); } else if (k === info.stage - 1) { c.fillStyle = boss ? '#ff4d6d' : '#5bc0ff'; c.fillRect(x + 1, 33, Math.max(info.boss ? 6 : 0, Math.round(6 * S.kills / info.need)), 4); } }
    if (!info.boss) button(WD / 2 - 36, 41, 72, 13, 'Вызвать босса', { fn: () => { if (!C.callBoss(S)) toast('Босс уже здесь'); }, dy: -1 });
    // уровень героя и статы
    const lw = 84; panel(c, WD - lw - 4, 4, lw, 22); text(c, 'Герой ' + S.hero.lvl + ' ур.', WD - lw + 2, 5, '#eaf5ff'); bar(c, WD - lw, 17, lw - 8, 5, S.hero.xp / C.xpNeed(S.hero.lvl), '#4ade80', '#10261c');
    panel(c, 4, 170, 90, 36); text(c, 'Клик ' + F(C.clickDmg(S)), 9, 172, '#fff'); text(c, 'Урон/с ' + F(C.dps(S)), 9, 182, '#fff'); text(c, 'Крит ' + Math.round(C.critChance(S) * 100) + '% ×' + C.critMult(S).toFixed(1).replace('.', ','), 9, 192, COL.mut);
    } else cityHud();
    switchBtn();
    // нижняя панель меню
    const bx = 100, by = 192, M = mode === 'city' ? MENU_C : MENU;
    M.forEach((m, i) => { const x = bx + i * 24, hv = button(x, by, 22, 22, null, { on: tab === m[0], fn: () => { tab = tab === m[0] ? null : m[0]; scroll[tab] = 0; } }); c.drawImage(A.icons[m[1]], x + 7, by + 6);
      if (hv) { const lab = m[2], w = tw(lab) + 8; panel(c, Math.min(WD - w - 2, x + 11 - w / 2), by - 14, w, 12); text(c, lab, Math.min(WD - w - 2, x + 11 - w / 2) + 4, by - 14, '#fff'); } });
    // умения
    if (mode === 'battle') C.SKILLS.forEach((k, i) => { const x = 300 + i * 28, y = 190, ok = S.hero.lvl >= k.lvl, cd = S.cd[k.id], act = S.buff[k.id] > 0;
      const hv = button(x, y, 25, 25, null, { can: ok && cd <= 0, green: ok && cd <= 0, on: act, fn: () => C.useSkill(S, k.id) }); c.drawImage(A.icons[['snow', 'bolt', 'coin'][i]], x + 8, y + 5);
      if (ok && cd > 0) { c.fillStyle = 'rgba(8,12,28,.6)'; const hh = Math.round(23 * cd / k.cd); c.fillRect(x + 1, y + 1, 23, hh); text(c, Math.ceil(cd) + '', x + 12, y + 8, '#fff', { align: 'c' }); }
      if (!ok) text(c, k.lvl + ' ур', x + 12, y + 8, '#7a86a6', { align: 'c' }); else text(c, String(i + 1), x + 12, y + 14, act ? '#ffd24a' : COL.mut, { align: 'c', sh: null });
      if (hv) { const lab = k.name, w = tw(lab) + 8, tx = Math.min(WD - w - 2, x + 12 - w / 2); panel(c, tx, y - 14, w, 12); text(c, lab, tx + 4, y - 14, '#fff'); } });
  }


  const ALLMENU = MENU.concat(MENU_C), Wd = window.Core.World, City = window.City;
  const ICB = { hall: 'house', sawmill: 'wood', quarry: 'stone', tavern: 'mug', mine: 'iron', forge: 'sword', treasury: 'coin', walls: 'shield', mage: 'star', temple: 'snow' };
  const fx1 = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
  function effText(id, L) {
    const E = { hall: () => '+' + 4 * L + '% золота, +' + 2 * L + '% урона', sawmill: () => '+' + fx1(0.15 * L) + ' дерева/с', quarry: () => '+' + fx1(0.12 * L) + ' камня/с', mine: () => '+' + fx1(0.08 * L) + ' железа/с',
      tavern: () => 'Мест в отряде: ' + (L >= 10 ? 4 : L >= 6 ? 3 : L >= 3 ? 2 : L >= 1 ? 1 : 0), forge: () => 'Снаряжение +' + 5 * L + '%', treasury: () => 'Золото +' + L + '% этапа/с', walls: () => 'Время босса +' + fx1(1.5 * L) + ' с',
      mage: () => 'Откат −' + Math.min(40, 2 * L) + '%, шторм +' + 5 * L + '%', temple: () => 'Урон +' + 3 * L + '%, осколки +' + 6 * L + '%' };
    return E[id]();
  }
  // стоимость в виде значков
  function costLine(x, y, cost) {
    let cx = x; const items = [['coin', cost.gold, S.gold, COL.gold]]; for (const k of ['wood', 'stone', 'iron']) if (cost[k]) items.push([k, cost[k], S.city.res[k], Wd.RES[k].col]);
    for (const it of items) { c.drawImage(A.icons[it[0]], cx, y + 2); const t = F(it[1]); text(c, t, cx + 10, y, it[2] >= it[1] ? '#e6f1ff' : COL.bad); cx += 14 + tw(t) + 4; }
  }
  function switchBtn() {
    const city = mode === 'city'; button(4, 48, 90, 16, city ? 'В поход' : 'Столица', { icon: A.icons[city ? 'sword' : 'house'], green: true, dy: -1, fn: () => { mode = city ? 'battle' : 'city'; tab = null; bldDlg = null; } });
  }
  function chipR(y, icon, val, col, rate) { const t = val, w = Math.max(60, tw(t) + 20 + (rate ? tw(rate) + 4 : 0)); panel(c, WD - w - 4, y, w, 13); c.drawImage(A.icons[icon], WD - w, y + 3); text(c, t, WD - w + 11, y + 1, col); if (rate) text(c, rate, WD - 8, y + 1, COL.mut, { align: 'r' }); }
  function cityHud() {
    const m = Wd.mods(S), cr = S.city.res;
    chipR(4, 'wood', F(cr.wood), Wd.RES.wood.col, m.wood ? '+' + fx1(m.wood) + '/с' : ''); chipR(18, 'stone', F(cr.stone), Wd.RES.stone.col, m.stone ? '+' + fx1(m.stone) + '/с' : ''); chipR(32, 'iron', F(cr.iron), Wd.RES.iron.col, m.iron ? '+' + fx1(m.iron) + '/с' : '');
    const zt = 'Столица Фростхольм', zw = tw(zt) + 24; panel(c, WD / 2 - zw / 2, 3, zw, 14); text(c, zt, WD / 2, 4, '#eaf5ff', { align: 'c' });
    text(c, 'Ратуша ' + Wd.lvl(S, 'hall') + ' ур. · отряд ' + S.city.squad.length + '/' + Wd.squadSlots(S) + ' · вылазки ' + S.city.exp.length + '/' + Wd.expSlots(S), WD / 2, 19, COL.mut, { align: 'c' });
    const done = S.city.exp.filter((x) => Wd.expLeft(x) <= 0).length; if (done) { panel(c, WD / 2 - 50, 32, 100, 14, { fill: '#2f8f5f' }); text(c, 'Вылазка завершена!', WD / 2, 33, '#fff', { align: 'c', sh: null }); }
    if (hoverSpot) { const b = Wd.BID[hoverSpot], L = Wd.lvl(S, hoverSpot), t = b.name + (L ? ' · ур. ' + L : ' · не построено'), w = tw(t) + 10; panel(c, WD / 2 - w / 2, 48, w, 14); text(c, t, WD / 2, 49, '#fff', { align: 'c' }); }
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
  function wrap(s, maxW) { const out = []; let line = ''; for (const wd of String(s).split(' ')) { const t = line ? line + ' ' + wd : wd; if (tw(t) > maxW && line) { out.push(line); line = wd; } else line = t; } if (line) out.push(line); return out; }
  function para(s, col, maxW) { const L = wrap(s, maxW); return { h: L.length * 11 + 4, draw: (x, y) => L.forEach((l, i) => text(c, l, x + 4, y + i * 11, col || COL.tx)) }; }
  function head(s, col) { return { h: 15, draw: (x, y) => text(c, s, x + 4, y + 2, col || COL.ac) }; }
  function row(o) { // иконка, имя, описание, кнопка справа
    return { h: o.h || 30, draw: (x, y, w) => {
      panel(c, x, y, w, 28, { fill: COL.bg2, hi: '#3a4f80' });
      const bwid = o.btnW || 84; panel(c, x + 3, y + 4, 19, 19, { fill: '#10182e', hi: '#243459', lo: '#0a0f1e' });
      if (o.icon) c.drawImage(o.icon, x + 3 + Math.round((19 - o.icon.width) / 2), y + 4 + Math.round((19 - o.icon.height) / 2));
      const maxW = w - 30 - (o.btn ? bwid + 8 : 4);
      text(c, fit(o.name, maxW - (o.lvl ? tw(' ' + o.lvl) : 0)), x + 27, y + 3, o.nameCol || '#ffffff'); if (o.lvl) text(c, ' ' + o.lvl, x + 27 + tw(fit(o.name, maxW - tw(' ' + o.lvl))), y + 3, COL.mut);
      if (o.descDraw) o.descDraw(x + 27, y + 15, maxW); else if (o.desc) text(c, fit(o.desc, maxW), x + 27, y + 15, o.descCol || COL.mut);
      if (o.btn) o.btn(x + w - bwid - 3, y + 2, bwid, 24);
    } };
  }
  function buyBtn(p, fn, gem) { // кнопка покупки на 2 строки
    return (x, y, w, h) => {
      if (p.maxed) { button(x, y, w, h, 'Максимум', { can: false }); return; }
      button(x, y, w, h, null, { can: p.can, green: p.can && !gem, pink: p.can && gem, fn, rep: true });
      text(c, '+' + p.k + (gem ? '' : ' ур.'), x + w / 2, y + 2, p.can ? '#fff' : '#7a86a6', { align: 'c' });
      const cost = gem ? String(p.cost) : F(p.cost), cw = tw(cost) + 10; c.drawImage(A.icons[gem ? 'gem' : 'coin'], x + Math.round((w - cw) / 2), y + 14); text(c, cost, x + Math.round((w - cw) / 2) + 10, y + 12, p.can ? '#fff' : '#7a86a6', { sh: p.can ? '#0a0f1e' : null });
    };
  }
  function bulkRow() { return { h: 17, draw: (x, y, w) => { text(c, 'Покупать:', x + 4, y + 3, COL.mut); [1, 10, 100, 'max'].forEach((v, i) => button(x + 62 + i * 40, y, 36, 15, v === 'max' ? 'Макс' : '×' + v, { on: S.set.bulk === v, fn: () => { S.set.bulk = v; }, dy: -1 })); } }; }

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
      Object.keys(C.SLOTS).forEach((k) => { const it = S.equip[k]; R.push({ h: 15, draw: (x, y, w) => { text(c, C.SLOTS[k].name + ':', x + 4, y + 2, COL.mut); if (it) { text(c, fit(it.name, w - 130), x + 64, y + 2, C.RAR[it.rar].col); text(c, '+' + it.val + '%', x + w - 4, y + 2, COL.ok, { align: 'r' }); } else text(c, 'пусто', x + 64, y + 2, '#5a6682'); } }); });
      R.push({ h: 20, draw: (x, y, w) => { text(c, 'Сумка ' + S.bag.length + '/' + C.BAG_MAX, x + 4, y + 4, COL.ac); button(x + w - 112, y + 1, 108, 16, 'Продать слабые', { fn: () => { const n = C.sellWeak(S); toast(n ? 'Продано: ' + n : 'Слабых нет'); }, dy: -1 }); } });
      if (!S.bag.length) R.push(para('Сумка пуста. Предметы падают с монстров, а с боссов чаще и лучше. Лучшие вещи надеваются сами.', COL.mut, tw2));
      S.bag.forEach((it) => { const cur = C.eqv(S, it.slot), d = it.val - cur;
        R.push(row({ icon: A.icons[it.slot === 'weapon' ? 'sword' : it.slot === 'armor' ? 'shield' : 'gem'], name: it.name, nameCol: C.RAR[it.rar].col, desc: C.SLOTS[it.slot].name + ' +' + it.val + '%  ' + (d > 0 ? '(+' + d + ')' : '(' + d + ')'), descCol: d > 0 ? COL.ok : COL.bad, btnW: 108,
          btn: (x, y, w, h) => { button(x, y, 50, h, 'Надеть', { green: d > 0, fn: () => C.equipItem(S, it.id), dy: 0 }); button(x + 52, y, w - 52, h, null, { fn: () => C.sellItem(S, it.id) }); const t = F(C.itemPrice(it)); c.drawImage(A.icons.coin, x + 56, y + 8); text(c, t, x + 66, y + 6, '#fff'); } })); });
    } else if (tab === 'skills') {
      R.push(para('Горячие клавиши: 1, 2, 3. Пробел или клик по сцене: удар.', COL.mut, tw2));
      const IC = ['snow', 'bolt', 'coin'];
      C.SKILLS.forEach((k, i) => { const ok = S.hero.lvl >= k.lvl, cd = S.cd[k.id], act = S.buff[k.id] > 0;
        R.push(row({ icon: A.icons[IC[i]], name: k.name, lvl: ok ? '' : 'с ' + k.lvl + ' ур.', desc: k.desc + (k.dur ? ' ' + k.dur + ' с' : '') + ' · ' + k.cd + ' с', btn: (x, y, w, h) => button(x, y, w, h, act ? 'Работает ' + Math.ceil(S.buff[k.id]) : !ok ? 'Закрыто' : cd > 0 ? 'Ждать ' + Math.ceil(cd) + ' с' : 'Применить', { can: ok && cd <= 0, green: ok && cd <= 0, fn: () => C.useSkill(S, k.id) }) })); });
    } else if (tab === 'bld') {
      R.push(para('Нажми на здание в городе или улучши его тут. Остальные здания не выше (2 × Ратуша + 2) уровня.', COL.mut, tw2));
      Wd.BLD.forEach((b) => { const i = Wd.bldInfo(S, b.id);
        R.push(row({ icon: A.icons[ICB[b.id]], name: b.name, lvl: i.L ? 'ур. ' + i.L : 'не построено', descDraw: (x, y) => { if (i.maxed) text(c, i.capped ? 'Нужна Ратуша выше' : 'Максимум', x, y, COL.mut); else if (!i.reqOk) text(c, 'Нужна Ратуша ' + b.req + ' ур.', x, y, COL.bad); else costLine(x, y, i.cost); }, btnW: 66,
          btn: (x, y, w, h) => button(x, y, w, h, i.maxed ? 'Макс.' : i.L ? 'Улучшить' : 'Построить', { can: i.can, green: i.can, dy: -1, fn: () => { if (Wd.bldBuy(S, b.id)) toast(b.name + ': ур. ' + (i.L + 1), '#5fe08a'); } }) })); });
    } else if (tab === 'heroes') {
      R.push(para('Отряд (до ' + Wd.squadSlots(S) + ' мест, растёт с Таверной) воюет в походе. Остальные герои ходят в вылазки. Осколки падают с боссов, из вылазок и призыва.', COL.mut, tw2));
      Wd.HEROES.slice().sort((a, b) => (Wd.heroInfo(S, b.id).owned - Wd.heroInfo(S, a.id).owned) || (b.rar - a.rar)).forEach((h) => R.push(heroRow(h.id)));
    } else if (tab === 'tavern') {
      const tl = Wd.lvl(S, 'tavern');
      if (!tl) R.push(para('Сначала построй Таверну в столице.', COL.bad, tw2));
      R.push(para('Здесь призывают осколки героев. Осколки открывают новых героев и дают им звёзды.', COL.mut, tw2));
      ['gold', 'gems'].forEach((k) => { const cs = Wd.summonCost(S, k), can = tl > 0 && (k === 'gold' ? S.gold >= cs : S.gems >= cs), sm = Wd.SUMMON[k];
        R.push(row({ icon: A.icons[k === 'gold' ? 'coin' : 'gem'], name: sm.name, desc: sm.qty[0] + '–' + sm.qty[1] + ' осколков героя' + (k === 'gems' ? ', шанс легенды выше' : ''), btnW: 84,
          btn: (x, y, w, h) => { button(x, y, w, h, null, { can, green: can && k === 'gold', pink: can && k === 'gems', fn: () => { const r = Wd.summon(S, k); if (r) { dialog = { title: 'Призыв', lines: [r.h.name + ' (' + Wd.HRAR[r.h.rar].name + ')', 'Получено осколков: ' + r.q], buttons: [{ t: 'Отлично', ok: 1 }] }; } } }); text(c, 'Призвать', x + w / 2, y + 2, can ? '#fff' : '#7a86a6', { align: 'c', sh: can ? '#0a0f1e' : null }); const t = k === 'gold' ? F(cs) : String(cs), cw = tw(t) + 10; c.drawImage(A.icons[k === 'gold' ? 'coin' : 'gem'], x + Math.round((w - cw) / 2), y + 14); text(c, t, x + Math.round((w - cw) / 2) + 10, y + 12, can ? '#fff' : '#7a86a6', { sh: can ? '#0a0f1e' : null }); } })); });
      R.push(head('Твои осколки'));
      Wd.HEROES.forEach((h) => { const i = Wd.heroInfo(S, h.id); if (i.frag > 0 || i.owned) R.push({ h: 13, draw: (x, y, w) => { text(c, h.name, x + 4, y + 1, Wd.HRAR[h.rar].col); text(c, i.owned ? 'ур. ' + i.lvl + ' · ' + i.star + ' зв. · осколки ' + i.frag : 'осколки ' + i.frag + '/' + i.need, x + w - 4, y + 1, COL.mut, { align: 'r' }); } }); });
    } else if (tab === 'exp') {
      const c0 = S.city, slots = Wd.expSlots(S), idle = Wd.idleHeroes(S).sort((a, b) => Wd.hPower(S, b) - Wd.hPower(S, a));
      R.push(para('Вылазки: отправь героев не из отряда на время. Чем они сильнее нужной силы, тем богаче добыча. Слоты: ' + c0.exp.length + '/' + slots + '. Свободных героев: ' + idle.length + '.', COL.mut, tw2));
      c0.exp.forEach((x, idx) => { const e = Wd.EID[x.k], left = Wd.expLeft(x), done = left <= 0, mm = Math.floor(left / 60), ss = Math.floor(left % 60);
        R.push(row({ icon: A.icons.map, name: e.name, nameCol: done ? COL.ok : '#fff', desc: done ? 'Готово! Герои вернулись' : 'Осталось ' + mm + ':' + String(ss).padStart(2, '0') + ' · ' + x.heroes.map((id) => Wd.HID[id].name.split(' ')[0]).join(', '), btnW: 84,
          btn: (bx, by, bw, bh) => done ? button(bx, by, bw, bh, 'Забрать', { green: true, dy: -1, fn: () => { const r = Wd.expClaim(S, idx); if (r) { const parts = []; for (const k in r.res) parts.push(F(r.res[k]) + ' ' + Wd.RES[k].name.toLowerCase()); parts.push(F(r.gold) + ' золота'); if (r.gems) parts.push(r.gems + ' самоцв.'); if (r.frag) parts.push(r.frag + ' осколков: ' + Wd.HID[r.hero].name); dialog = { title: 'Вылазка завершена', lines: ['Эффективность ×' + String(r.m).replace('.', ','), parts.join(', ')], buttons: [{ t: 'Отлично', ok: 1 }] }; } } }) : button(bx, by, bw, bh, 'Ускорить 5', { can: S.gems >= 5, pink: S.gems >= 5, icon: null, dy: -1, fn: () => { Wd.expSkip(S, idx); } }) })); });
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
    } else if (tab === 'set') {
      const sw = (k, t) => ({ h: 20, draw: (x, y, w) => { text(c, t, x + 4, y + 4, '#fff'); const bx = x + w - 22; button(x + 0, y, w, 18, null, { fn: () => { S.set[k] = !S.set[k]; if (k === 'light') Sc.setLight(S.set.light); persist(); }, can: true, fill: 1 }); panel(c, x, y, w, 18, { fill: '#243459' }); text(c, t, x + 6, y + 3, '#fff'); panel(c, bx, y + 2, 14, 14, { fill: '#10182e' }); if (S.set[k]) c.drawImage(A.icons.check, bx + 3, y + 5); } });
      R.push(sw('light', 'Экономный режим (слабый ПК)')); R.push(sw('autoBoss', 'Авто-вызов босса')); R.push(sw('autoEquip', 'Надевать лучшие предметы сам'));
      R.push(head('Сохранение'));
      R.push({ h: 24, draw: (x, y, w) => { button(x + 4, y + 2, 70, 18, 'Экспорт', { fn: exportSave, dy: -1 }); button(x + 78, y + 2, 70, 18, 'Импорт', { fn: importSave, dy: -1 }); button(x + 152, y + 2, 90, 18, 'Сбросить всё', { fn: () => ask('Сбросить всё?', ['Весь прогресс пропадёт навсегда.'], () => { S = C.newState(); C.ensureRt(S); persist(); toast('Новая игра'); }), dy: -1 }); } });
      R.push(para('Игра сохраняется сама каждые 10 секунд.', COL.mut, tw2));
    }
    return R;
  }
  function modalView() {
    const MX = 24, MY = 14, MW = 336, MH = 172, title = (ALLMENU.find((m) => m[0] === tab) || [])[2];
    hits.push({ x: MX, y: MY, w: MW, h: MH, fn: null, block: true });
    panel(c, MX, MY, MW, MH, { fill: '#162038' }); panel(c, MX + 2, MY + 2, MW - 4, 15, { fill: '#243459', hi: '#3a4f80' });
    c.drawImage(A.icons[ALLMENU.find((m) => m[0] === tab)[1]], MX + 7, MY + 5); text(c, title, MX + 19, MY + 3, '#fff');
    button(MX + MW - 18, MY + 4, 12, 11, null, { fn: () => { tab = null; }, pink: true }); c.drawImage(A.icons.x, MX + MW - 16, MY + 5);
    const vx = MX + 6, vy = MY + 21, vw = MW - 20, vh = MH - 27, rows = tabRows(vw);
    const total = rows.reduce((a, r) => a + r.h, 0), max = Math.max(0, total - vh), key = tab; scroll[key] = Math.max(0, Math.min(max, scroll[key] || 0));
    c.save(); c.beginPath(); c.rect(vx, vy, vw, vh); c.clip(); clip = { x: vx, y: vy, w: vw, h: vh };
    let yy = vy - Math.round(scroll[key]); for (const r of rows) { if (yy + r.h > vy && yy < vy + vh) r.draw(vx, yy, vw); yy += r.h; }
    c.restore(); clip = null; wheelArea = { x: MX, y: MY, w: MW, h: MH, key, max };
    if (max > 0) { const tx = vx + vw + 3; c.fillStyle = '#0c1224'; c.fillRect(tx, vy, 5, vh); const th = Math.max(12, Math.round(vh * vh / total)), ty = vy + Math.round((vh - th) * scroll[key] / max); c.fillStyle = '#5a7cc0'; c.fillRect(tx, ty, 5, th); c.fillStyle = '#9ab8f0'; c.fillRect(tx, ty, 5, 1);
      hit(tx - 4, vy, 13, vh / 2, () => { scroll[key] = Math.max(0, scroll[key] - 40); }); hit(tx - 4, vy + vh / 2, 13, vh / 2, () => { scroll[key] = Math.min(max, scroll[key] + 40); }); }
  }

  // ---------- диалоги, всплывающие сообщения ----------
  function ask(title, lines, yes) { dialog = { title, lines, buttons: [{ t: 'Отмена' }, { t: 'Да', ok: 1, fn: yes }] }; }
  function toast(t, col) { toasts.push({ t, col: col || '#5bc0ff', life: 3.6 }); if (toasts.length > 4) toasts.shift(); }
  function drawDialog() {
    if (!dialog) return; c.fillStyle = 'rgba(4,8,20,.7)'; c.fillRect(0, 0, WD, HT);
    const w = 250, L = []; dialog.lines.forEach((l) => L.push(...wrap(l, w - 20))); const h = 52 + L.length * 12, x = (WD - w) / 2, y = Math.round((HT - h) / 2);
    hits.push({ x: 0, y: 0, w: WD, h: HT, fn: null, block: true });
    panel(c, x, y, w, h, { fill: '#162038', hi: '#5bc0ff' }); text(c, dialog.title, WD / 2, y + 7, '#5bc0ff', { align: 'c' }); L.forEach((l, i) => text(c, l, WD / 2, y + 23 + i * 12, '#eaf3ff', { align: 'c' }));
    const bs = dialog.buttons, bw = 90, tot = bs.length * bw + (bs.length - 1) * 8; bs.forEach((b, i) => button(x + (w - tot) / 2 + i * (bw + 8), y + h - 24, bw, 17, b.t, { green: !!b.ok, dy: -1, fn: () => { const d = dialog; dialog = null; if (b.fn) b.fn(); } }));
  }
  function drawToasts(dt) {
    let y = 62; for (let i = toasts.length - 1; i >= 0; i--) { const t = toasts[i]; t.life -= dt; if (t.life <= 0) { toasts.splice(i, 1); continue; } const w = tw(t.t) + 12, x = WD - w - 4; c.globalAlpha = Math.min(1, t.life * 2); panel(c, x, y, w, 14, { fill: '#162038', hi: t.col }); c.fillStyle = t.col; c.fillRect(x + 2, y + 3, 2, 8); text(c, t.t, x + 7, y + 1, '#fff'); y += 16; } c.globalAlpha = 1;
  }

  // ---------- сохранение: экспорт / импорт ----------
  const dlg = document.getElementById('dlg'), dt = document.getElementById('dt'), dp = document.getElementById('dp'), dx = document.getElementById('dx');
  function showDlg(title, p, val, ok) { dt.textContent = title; dp.textContent = p; dx.value = val || ''; dlg.style.display = 'flex'; document.getElementById('dok').onclick = () => { dlg.style.display = 'none'; if (ok) ok(dx.value.trim()); }; document.getElementById('dno').onclick = () => { dlg.style.display = 'none'; }; setTimeout(() => dx.focus(), 30); }
  function exportSave() { const t = btoa(unescape(encodeURIComponent(C.save(S)))); try { navigator.clipboard.writeText(t); toast('Код скопирован'); } catch (e) {} showDlg('Экспорт', 'Скопируй этот код и сохрани:', t); }
  function importSave() { showDlg('Импорт', 'Вставь код. Текущий прогресс будет заменён.', '', (v) => { try { S = C.load(decodeURIComponent(escape(atob(v)))); C.ensureRt(S); Sc.setLight(S.set.light); persist(); toast('Сохранение загружено'); } catch (e) { toast('Код не подошёл', '#ff6b6b'); } }); }

  // ---------- ввод ----------
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * WD / r.width, y: (e.clientY - r.top) * HT / r.height }; };
  cv.addEventListener('pointermove', (e) => { mouse = pos(e); });
  cv.addEventListener('pointerleave', () => { mouse = { x: -1, y: -1 }; });
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault(); mouse = pos(e); for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (mouse.x >= h.x && mouse.x < h.x + h.w && mouse.y >= h.y && mouse.y < h.y + h.h) { if (h.fn) { h.fn(); if (h.rep) { clearTimeout(hold); hold = setTimeout(function t() { h.fn(); hold = setTimeout(t, 90); }, 420); } } return; } }
    if (mode === 'battle') C.hit(S);
  });
  ['pointerup', 'pointercancel'].forEach((n) => addEventListener(n, () => { clearTimeout(hold); hold = null; }));
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const p = pos(e); if (wheelArea && p.x >= wheelArea.x && p.x < wheelArea.x + wheelArea.w && p.y >= wheelArea.y && p.y < wheelArea.y + wheelArea.h) scroll[wheelArea.key] = Math.max(0, Math.min(wheelArea.max, (scroll[wheelArea.key] || 0) + Math.sign(e.deltaY) * 30)); }, { passive: false });
  addEventListener('keydown', (e) => {
    if (dlg.style.display === 'flex') { if (e.key === 'Escape') dlg.style.display = 'none'; return; }
    if (e.repeat) return;
    if (e.key === 'Escape') { if (dialog) dialog = null; else if (bldDlg) bldDlg = null; else tab = null; }
    else if (dialog) return;
    else if (e.code === 'Space') { e.preventDefault(); if (mode === 'battle') C.hit(S); }
    else if (mode !== 'battle') return;
    else if (e.key === '1') C.useSkill(S, 'storm'); else if (e.key === '2') C.useSkill(S, 'cry'); else if (e.key === '3') C.useSkill(S, 'rain');
  });

  // ---------- события игры ----------
  function events(ev) {
    for (const e of ev) {
      if (e.t === 'drop' && e.v.rar >= 2) toast(C.RAR[e.v.rar].name + ': ' + e.v.name, C.RAR[e.v.rar].col);
      else if (e.t === 'ach') toast('Награда: ' + e.v.name + ' (+' + e.v.gems + ')', '#ffd24a');
      else if (e.t === 'zone') toast('Босс повержен!', '#5fe08a');
      else if (e.t === 'frag') toast('Осколки: ' + Wd.HID[e.id].name.split(' ')[0] + ' ×' + e.q, '#b66cff');
    }
  }

  // ---------- цикл ----------
  function loop(now) {
    requestAnimationFrame(loop);
    if (S.set.light && now - last < 33) return;
    let dt = Math.min(0.25, (now - last) / 1000); last = now;
    C.tick(S, dt);
    const ev = S.rt.ev.slice(); events(ev); ev.forEach((e) => Sc.fx(e, S)); S.rt.ev.length = 0;
    hits = []; hitsOff = !!dialog;
    if (mode === 'city') { spots = City.frame(c, S, dt, hoverSpot); if (!tab && !dialog && !bldDlg) { let hv = null; for (const sp of spots) if (hit(sp.x, sp.y, sp.w, sp.h, () => { bldDlg = sp.id; })) hv = sp.id; hoverSpot = hv; } else hoverSpot = null; } else Sc.frame(c, S, dt);
    const info = C.stageInfo(S.n); hud(info);
    drawToasts(dt);
    if (tab) modalView();
    hitsOff = !!dialog; bldDialog();
    hitsOff = false; drawDialog();
    // курсор: рука над кнопками
    let over = false; for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (mouse.x >= h.x && mouse.x < h.x + h.w && mouse.y >= h.y && mouse.y < h.y + h.h) { over = !!h.fn; break; } } cv.style.cursor = over ? 'pointer' : 'crosshair';
    if (now - lastSave > 10000) { lastSave = now; persist(); }
  }

  function start() {
    fitScreen(); S = loadSave() || C.newState(); C.ensureRt(S); try { if (/[?&]light=1/.test(location.search)) S.set.light = true; } catch (e) {} Sc.init(); Sc.setLight(S.set.light);
    const off = C.offlineGain(S, (Date.now() - S.seen) / 1000);
    if (off) dialog = { title: 'С возвращением!', lines: ['Пока тебя не было (' + C.fmtTime(off.secs) + '), отряд победил ' + F(off.kills) + ' монстров.', 'Добыча: ' + F(off.gold) + ' золота' + (off.res ? ', ' + F(off.res.wood) + ' дерева, ' + F(off.res.stone) + ' камня, ' + F(off.res.iron) + ' железа' : '') + '.'], buttons: [{ t: 'Забрать', ok: 1, fn: () => { C.applyOffline(S, off); } }] };
    else if (!S.st.clicks) toast('Клик или пробел: удар', '#5bc0ff');
    addEventListener('beforeunload', persist); document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
    last = performance.now(); requestAnimationFrame(loop);
  }
  window.__FF = { get S() { return S; }, C, open: (t) => { tab = t; }, mode: (m) => { mode = m; tab = null; }, bld: (id) => { bldDlg = id; } };
  start();
})();
