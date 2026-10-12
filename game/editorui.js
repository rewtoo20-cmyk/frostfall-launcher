// FROSTFALL: интерфейс редактора карт (рисуется в тот же холст 384x216). Палитра слева, рабочая область справа, строка состояния внизу.
(function (root) {
  'use strict';
  const FF = root.FF = root.FF || {};
  const D = () => FF.MapData;
  const VX = 98, VY = 18, VW = 286, VH = 182; // рабочая область
  const UI = {
    open: false, ed: null, store: null, mode: 'edit', h: null, down: false, pan: false, last: null, spaceDown: false, space: false, pt: null, msg: '', msgT: 0, listScroll: 0, saved: false, cursorOver: false,
    init() { if (!UI.store) UI.store = new FF.MapStore(); return UI; },
    // ---- открытие/закрытие ----
    show(map) { UI.init(); UI.ed = new FF.LevelEditor(map || FF.MapGen.island(32, 20, (Math.random() * 1e6) | 0)); UI.ed.view = { zoom: 2, ox: VX + 4, oy: VY + 4 }; UI.open = true; UI.mode = 'edit'; UI.pt = null; UI.note('Карта: ' + UI.ed.map.name); },
    close() { if (UI.ed) UI.ed.dispose(); UI.ed = null; UI.open = false; UI.pt = null; UI.down = false; UI.mode = 'edit'; },
    note(t) { UI.msg = t; UI.msgT = 3; },
    // ---- ввод ----
    inView(p) { return p.x >= VX && p.x < VX + VW && p.y >= VY && p.y < VY + VH; },
    pointerDown(p, e) {
      if (!UI.open || UI.mode !== 'edit' || !UI.inView(p)) return false; const ed = UI.ed; UI.pt = null;
      if (e.button === 1 || e.button === 2 || UI.space) { UI.pan = true; UI.last = p; return true; }
      const c = ed.toCell(p.x, p.y); if (!ed.map.inb(c.x, c.y)) return true; if (ed.locked) { UI.note('Сюжетная комната защищена'); return true; }
      UI.down = true; ed.begin(); ed.use(c.x, c.y); UI.last = c; if (ed.tool === 'fill' || ed.tool === 'pick') { ed.end(); UI.down = false; } return true;
    },
    pointerMove(p) {
      if (!UI.open || !UI.ed) return; const ed = UI.ed; ed.cur = ed.toCell(p.x, p.y); UI.cursorOver = UI.inView(p);
      if (UI.pan && UI.last) { ed.pan(p.x - UI.last.x, p.y - UI.last.y); UI.last = p; return; }
      if (UI.down && UI.last && (ed.tool === 'brush' || ed.tool === 'eraser')) { const c = ed.cur; let x0 = UI.last.x, y0 = UI.last.y; const dx = Math.abs(c.x - x0), dy = Math.abs(c.y - y0), sx = x0 < c.x ? 1 : -1, sy = y0 < c.y ? 1 : -1; let err = dx - dy, n = 0; // линия Брезенхэма
        while (n++ < 400) { if (ed.map.inb(x0, y0)) ed.use(x0, y0); if (x0 === c.x && y0 === c.y) break; const e2 = 2 * err; if (e2 > -dy) { err -= dy; x0 += sx; } if (e2 < dx) { err += dx; y0 += sy; } } UI.last = c; }
    },
    pointerUp() { if (UI.down && UI.ed) UI.ed.end(); UI.down = false; UI.pan = false; UI.last = null; },
    wheel(p, dy) { if (!UI.open || UI.mode !== 'edit' || !UI.inView(p)) return false; UI.ed.zoomAt(p.x, p.y, dy < 0 ? 1 : -1); return true; },
    key(e) {
      if (!UI.open) return false; const ed = UI.ed, k = e.code, ctrl = e.ctrlKey || e.metaKey;
      if (k === 'Space') { UI.space = e.type === 'keydown'; e.preventDefault(); return true; } if (e.type === 'keyup') return true;
      if (k === 'Escape') { if (UI.mode !== 'edit') UI.mode = 'edit'; else UI.attemptClose(); return true; }
      if (UI.mode !== 'edit') return true;
      if (ctrl && k === 'KeyZ') { e.shiftKey ? ed.redoOne() : ed.undoOne(); e.preventDefault(); return true; } if (ctrl && k === 'KeyY') { ed.redoOne(); e.preventDefault(); return true; } if (ctrl && k === 'KeyS') { UI.save(); e.preventDefault(); return true; }
      const T = { KeyB: 'brush', KeyE: 'eraser', KeyG: 'fill', KeyI: 'pick' }[k]; if (T) { ed.setTool(T); return true; }
      const L = { Digit1: 'bg', Digit2: 'col', Digit3: 'obj', Digit4: 'spn' }[k]; if (L) { ed.setLayer(L); return true; }
      if (k === 'BracketRight') { ed.zoomAt(VX + VW / 2, VY + VH / 2, 1); return true; } if (k === 'BracketLeft') { ed.zoomAt(VX + VW / 2, VY + VH / 2, -1); return true; }
      if (k === 'KeyP') { UI.play(); return true; } if (k === 'KeyV') { UI.check(); return true; } if (k === 'KeyQ') { ed.size = ed.size % 3 + 1; return true; }
      return true;
    },
    attemptClose() { const ed = UI.ed; if (ed && ed.dirty && !UI.saved) { UI.h.ask('Закрыть редактор?', ['Несохранённые изменения будут потеряны.'], () => UI.close()); } else UI.close(); },
    // ---- действия ----
    check() { const ed = UI.ed, v = ed.check(); const er = v.filter((i) => i.lvl === 'error').length, wr = v.length - er; UI.note(v.length ? 'Проблем: ' + er + ' ошибок, ' + wr + ' предупр.: ' + v[0].msg : 'Карта корректна'); return v; },
    save() {
      const ed = UI.ed; try { if (ed.map.locked) throw new Error('Сюжетная комната защищена'); UI.store.save(ed.map); ed.dirty = false; UI.saved = true; UI.note('Сохранено: ' + ed.map.name + (UI.store.mode === 'mem' ? ' (только в памяти: хранилище недоступно)' : '')); }
      catch (e) { UI.note(e.message); }
    },
    play() {
      const ed = UI.ed, v = ed.check(); if (v.some((i) => i.lvl === 'error')) { UI.note('Пробный прогон невозможен: ' + v.find((i) => i.lvl === 'error').msg); return; }
      const M = FF.Main, st = M && M.forge ? M.forge.stats() : { hp: 400, atk: 40, def: 5 }, res = FF.mapPlaytest(ed.map, { hp: st.hp * 6, atk: st.atk * 3, def: st.def }, (Math.random() * 1e6) | 0);
      if (!res.ok) { UI.note('Прогон: ' + res.why); return; } UI.pt = { res, i: 0, t: 0 };
    },
    newMap(kind, w, h) { const seed = (Math.random() * 1e6) | 0, m = kind === 'island' ? FF.MapGen.island(w, h, seed) : kind === 'dungeon' ? FF.MapGen.dungeon(w, h, seed) : new FF.TileMap({ w, h, name: 'Новая карта' }); m.id = UI.store.uniqueId('room'); UI.ed.dispose(); UI.ed = new FF.LevelEditor(m); UI.ed.view = { zoom: w * h > 2000 ? 1 : 2, ox: VX + 4, oy: VY + 4 }; UI.ed.dirty = true; UI.saved = false; UI.mode = 'edit'; UI.note('Создано: ' + m.name); },
    openMap(id) { const m = UI.store.get(id); if (!m) return; UI.ed.dispose(); UI.ed = new FF.LevelEditor(m.locked ? m.clone() : m); UI.ed.map.locked = m.locked; UI.ed.view = { zoom: 2, ox: VX + 4, oy: VY + 4 }; UI.mode = 'edit'; UI.saved = true; UI.note(m.locked ? 'Сюжетная комната: только просмотр' : 'Открыто: ' + m.name); },
    // ---- отрисовка ----
    frame(c, h, dt) {
      UI.h = h; const { text, tw, fit, panel, button, COL } = h, ed = UI.ed; if (!ed) return; const m = ed.map, cell = ed.cell(), T = performance.now() / 1000;
      c.fillStyle = '#0a0f1e'; c.fillRect(0, 0, 384, 216); UI.msgT = Math.max(0, UI.msgT - dt);
      // рабочая область (кликабельный блок: чтобы клик не уходил в бой)
      h.hit(VX, VY, VW, VH, null);
      c.save(); c.beginPath(); c.rect(VX, VY, VW, VH); c.clip(); c.fillStyle = '#10182e'; c.fillRect(VX, VY, VW, VH);
      const x0 = Math.max(0, Math.floor((VX - ed.view.ox) / cell)), y0 = Math.max(0, Math.floor((VY - ed.view.oy) / cell)), x1 = Math.min(m.w, Math.ceil((VX + VW - ed.view.ox) / cell)), y1 = Math.min(m.h, Math.ceil((VY + VH - ed.view.oy) / cell));
      const TI = D().TID, OB = D().OBJS, SP = D().SPAWNS, L = ed.layer, cs = Math.ceil(cell);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = y * m.w + x, t = TI[m.bg[i]], px = Math.round(ed.view.ox + x * cell), py = Math.round(ed.view.oy + y * cell);
        c.fillStyle = t.col; c.fillRect(px, py, cs, cs);
        if (cell >= 6 && t.auto) { const mk = m.mask(x, y); c.fillStyle = t.edge; if (!(mk & 1)) c.fillRect(px, py, cs, 1); if (!(mk & 4)) c.fillRect(px, py + cs - 1, cs, 1); if (!(mk & 8)) c.fillRect(px, py, 1, cs); if (!(mk & 2)) c.fillRect(px + cs - 1, py, 1, cs); } else if (cell >= 8) { c.fillStyle = t.edge; c.globalAlpha = 0.25; c.fillRect(px, py, cs, 1); c.fillRect(px, py, 1, cs); c.globalAlpha = 1; }
        if (L === 'col' || m.col[i]) { if (m.col[i]) { c.globalAlpha = L === 'col' ? 0.55 : 0.25; c.fillStyle = '#ff3a3a'; c.fillRect(px, py, cs, cs); c.globalAlpha = 1; } }
        const o = m.obj[i]; if (o && (o !== 0)) { const od = OB[o]; c.fillStyle = od.col; const q = Math.max(2, Math.round(cs * 0.6)); c.fillRect(px + Math.round((cs - q) / 2), py + Math.round((cs - q) / 2), q, q); if (cs >= 12) text(c, od.name[0], px + cs / 2, py + Math.round((cs - 11) / 2), '#0a0f1e', { align: 'c', sh: null }); }
        const s = m.spn[i]; if (s) { c.fillStyle = SP[s].col; const q = Math.max(2, Math.round(cs * 0.5)); c.fillRect(px + Math.round((cs - q) / 2), py + cs - q - 1, q, q); c.fillStyle = '#0a0f1e'; c.fillRect(px + Math.round(cs / 2) - 1, py + cs - q + 1, 1, 1); }
      }
      // освещение комнаты
      if (m.light.ambient < 1) { c.globalAlpha = 1 - m.light.ambient; c.fillStyle = '#05060f'; c.fillRect(VX, VY, VW, VH); c.globalAlpha = 0.08; c.fillStyle = m.light.tint; c.fillRect(VX, VY, VW, VH); c.globalAlpha = 1; }
      // граница карты и рамка экрана 384x216 (48x27 тайлов) вокруг старта героя
      c.strokeStyle = '#5bc0ff'; c.lineWidth = 1; c.strokeRect(Math.round(ed.view.ox) + 0.5, Math.round(ed.view.oy) + 0.5, m.w * cell, m.h * cell);
      { const st = m.find(1)[0], cx = st ? st.x : m.w / 2, cy = st ? st.y : m.h / 2, fx = Math.round(ed.view.ox + (cx - 24) * cell), fy = Math.round(ed.view.oy + (cy - 13.5) * cell); c.setLineDash([3, 3]); c.strokeStyle = '#ffd24a'; c.strokeRect(fx + 0.5, fy + 0.5, 48 * cell, 27 * cell); c.setLineDash([]); }
      // невалидные элементы
      for (const is of ed.issues) if (is.x != null) { const px = Math.round(ed.view.ox + is.x * cell), py = Math.round(ed.view.oy + is.y * cell); c.strokeStyle = is.lvl === 'error' ? '#ff3a3a' : '#ffd24a'; c.globalAlpha = 0.5 + 0.5 * Math.sin(T * 8); c.strokeRect(px + 0.5, py + 0.5, cs, cs); c.globalAlpha = 1; }
      // курсор и предпросмотр кисти
      if (UI.mode === 'edit' && UI.cursorOver && ed.map.inb(ed.cur.x, ed.cur.y)) { const s = ed.size, o = -((s - 1) >> 1); c.strokeStyle = '#ffffff'; c.strokeRect(Math.round(ed.view.ox + (ed.cur.x + o) * cell) + 0.5, Math.round(ed.view.oy + (ed.cur.y + o) * cell) + 0.5, s * cs, s * cs); }
      // пробный прогон: герой идёт по пути
      if (UI.pt) { const pt = UI.pt, path = pt.res.path; pt.t += dt * 14; pt.i = Math.min(path.length - 1, Math.floor(pt.t)); c.fillStyle = '#5fe08a'; for (let k = 0; k <= pt.i; k += 2) { const i = path[k]; c.globalAlpha = 0.5; c.fillRect(Math.round(ed.view.ox + (i % m.w) * cell + cell / 2 - 1), Math.round(ed.view.oy + ((i / m.w) | 0) * cell + cell / 2 - 1), 2, 2); } c.globalAlpha = 1; const i = path[pt.i]; c.fillStyle = '#ffffff'; c.fillRect(Math.round(ed.view.ox + (i % m.w) * cell), Math.round(ed.view.oy + ((i / m.w) | 0) * cell), cs, cs);
        if (pt.i >= path.length - 1) { const r = pt.res; text(c, (r.win ? 'Победа' : 'Поражение') + ': шагов ' + r.steps + ', побед в боях ' + r.kills + ', сундуков ' + r.chests + (r.win ? ', здоровье ' + Math.round(r.hp * 100) + '%' : ''), VX + 4, VY + VH - 12, r.win ? '#5fe08a' : '#ff6b6b'); } }
      c.restore();
      // верхняя панель
      panel(c, 0, 0, 384, 17, { fill: '#162038' }); text(c, fit(m.name + (ed.dirty ? ' *' : '') + (m.locked ? ' [защита]' : ''), 96), 4, 3, '#fff');
      const B = [['Новая', () => { UI.mode = 'new'; }], ['Карты', () => { UI.mode = 'list'; UI.listScroll = 0; }], ['Сохр.', () => UI.save()], ['Пров.', () => UI.check()], ['Play', () => UI.play()]]; let bx = 104;
      for (const [t, fn] of B) { const w = tw(t) + 10; button(bx, 1, w, 15, t, { fn, dy: -1, green: t === 'Play' }); bx += w + 3; }
      button(384 - 15, 1, 14, 15, 'x', { pink: true, dy: -1, fn: () => UI.attemptClose() });
      // палитра
      panel(c, 0, 18, 97, 182, { fill: '#162038' });
      const tools = [['brush', 'Кисть'], ['eraser', 'Ластик'], ['fill', 'Залив.'], ['pick', 'Пипет.']];
      tools.forEach((t, i) => button(3 + (i % 2) * 47, 21 + (i >> 1) * 14, 46, 13, t[1], { on: ed.tool === t[0], dy: -1, fn: () => ed.setTool(t[0]) }));
      D().LAYERS.forEach((l, i) => button(3 + (i % 2) * 47, 51 + (i >> 1) * 14, 46, 13, D().LAYER_NAMES[l], { on: ed.layer === l, dy: -1, fn: () => ed.setLayer(l) }));
      text(c, 'Размер ' + ed.size, 4, 81, COL.mut); button(68, 80, 11, 11, '-', { dy: -1, fn: () => { ed.size = Math.max(1, ed.size - 1); } }); button(81, 80, 11, 11, '+', { dy: -1, fn: () => { ed.size = Math.min(3, ed.size + 1); } });
      const items = L === 'bg' ? D().TILES : L === 'obj' ? D().OBJS.slice(1) : L === 'spn' ? D().SPAWNS.slice(1) : [{ id: 1, name: 'Стена', col: '#ff3a3a' }];
      items.forEach((it, i) => { const x = 3 + (i % 5) * 18, y = 95 + Math.floor(i / 5) * 17, sel = L === 'bg' ? ed.tile === it.id : L === 'obj' ? ed.obj === it.id : L === 'spn' ? ed.spn === it.id : true; const hv = h.hit(x, y, 15, 15, () => { if (L === 'bg') ed.tile = it.id; else if (L === 'obj') ed.obj = it.id; else if (L === 'spn') ed.spn = it.id; ed.setTool(ed.tool === 'eraser' || ed.tool === 'pick' ? 'brush' : ed.tool); });
        panel(c, x, y, 15, 15, { fill: sel ? '#3a8ad8' : '#24345a' }); c.fillStyle = it.col; c.fillRect(x + 3, y + 3, 9, 9); if (hv) h.tipAt(Math.min(x + 18, 384 - tw(it.name) - 10), y + 16, it.name); });
      text(c, 'Угроза ' + m.threat, 4, 170, COL.mut); button(68, 169, 11, 11, '-', { dy: -1, fn: () => { m.threat = Math.max(1, m.threat - 1); ed.dirty = true; } }); button(81, 169, 11, 11, '+', { dy: -1, fn: () => { m.threat = Math.min(20, m.threat + 1); ed.dirty = true; } });
      text(c, 'Свет ' + Math.round(m.light.ambient * 100) + '%', 4, 184, COL.mut); button(68, 183, 11, 11, '-', { dy: -1, fn: () => { m.light.ambient = Math.max(0.2, Math.round((m.light.ambient - 0.1) * 10) / 10); ed.dirty = true; } }); button(81, 183, 11, 11, '+', { dy: -1, fn: () => { m.light.ambient = Math.min(1, Math.round((m.light.ambient + 0.1) * 10) / 10); ed.dirty = true; } });
      // статус
      panel(c, 0, 200, 384, 16, { fill: '#162038' }); const cur = ed.cur, inb = m.inb(cur.x, cur.y), cnt = ed.issues.length;
      text(c, (inb ? cur.x + ',' + cur.y : '-') + ' ' + m.w + 'x' + m.h + ' ' + ed.view.zoom + 'x', 4, 203, COL.tx); text(c, UI.msgT > 0 ? fit(UI.msg, 176) : 'B E G I · 1-4 слои · Ctrl+Z · Пробел+мышь', 150, 203, UI.msgT > 0 ? '#ffd24a' : COL.mut);
      button(330, 201, 25, 14, 'Отм', { can: ed.undo.length > 0, dy: -1, fn: () => ed.undoOne() }); button(357, 201, 26, 14, 'Вп.', { can: ed.redo.length > 0, dy: -1, fn: () => ed.redoOne() });
      // окна
      if (UI.mode === 'new') UI.drawNew(c, h); else if (UI.mode === 'list') UI.drawList(c, h);
    },
    drawNew(c, h) {
      const { text, panel, button } = h, X = 90, Y = 40, W = 204, H = 130; h.hit(0, 0, 384, 216, null); panel(c, X, Y, W, H, { fill: '#162038', hi: '#5bc0ff' }); text(c, 'Новая карта', X + 8, Y + 6, '#fff');
      const P = [['Пустая 32x20', 'blank', 32, 20], ['Пустая 64x40', 'blank', 64, 40], ['Остров 48x32', 'island', 48, 32], ['Остров 96x64', 'island', 96, 64], ['Подземелье 48x32', 'dungeon', 48, 32], ['Подземелье 100x100', 'dungeon', 100, 100]];
      P.forEach((p, i) => button(X + 8 + (i % 2) * 94, Y + 22 + (i >> 1) * 22, 90, 18, p[0], { dy: -1, fn: () => UI.newMap(p[1], p[2], p[3]) })); button(X + W - 60, Y + H - 22, 52, 16, 'Назад', { dy: -1, fn: () => { UI.mode = 'edit'; } });
    },
    drawList(c, h) {
      const { text, panel, button, fit, COL } = h, X = 40, Y = 24, W = 304, H = 170, list = UI.store.list(); h.hit(0, 0, 384, 216, null); panel(c, X, Y, W, H, { fill: '#162038', hi: '#5bc0ff' });
      text(c, 'Карты (' + list.length + ')  хранилище: ' + (UI.store.mode === 'ls' ? 'браузер' : 'память'), X + 8, Y + 5, '#fff'); button(X + W - 62, Y + 3, 56, 13, 'Назад', { dy: -1, fn: () => { UI.mode = 'edit'; } });
      list.slice(UI.listScroll, UI.listScroll + 7).forEach((m, i) => { const y = Y + 20 + i * 18; panel(c, X + 6, y, W - 12, 16, { fill: '#1d2a48' }); text(c, fit((m.locked ? '[сюжет] ' : '') + m.name + ' ' + m.w + 'x' + m.h, 140), X + 10, y + 3, m.locked ? '#9fb4d8' : '#fff');
        button(X + 158, y + 1, 40, 14, 'Открыть', { dy: -1, fn: () => UI.openMap(m.id) }); button(X + 200, y + 1, 36, 14, 'Имя', { can: !m.locked, dy: -1, fn: () => h.showDlg('Переименовать', 'Новое название карты:', m.name, (v) => { try { UI.store.rename(m.id, v); } catch (e) { UI.note(e.message); } }) });
        button(X + 238, y + 1, 26, 14, 'Уд.', { can: !m.locked, pink: true, dy: -1, fn: () => h.ask('Удалить «' + m.name + '»?', ['Это нельзя отменить.'], () => { try { UI.store.remove(m.id); } catch (e) { UI.note(e.message); } }) });
        button(X + 266, y + 1, 30, 14, 'Вылаз', { can: !m.locked && FF.mapValidate(m).every((q) => q.lvl !== 'error'), dy: -1, fn: () => UI.note('Карта в пуле вылазок: ' + m.name) }); });
      button(X + 8, Y + H - 20, 64, 15, 'Экспорт', { dy: -1, fn: () => h.showDlg('Экспорт карт', 'Скопируй и сохрани текст:', UI.store.exportAll()) }); button(X + 76, Y + H - 20, 64, 15, 'Импорт', { dy: -1, fn: () => h.showDlg('Импорт карт', 'Вставь текст архива или JSON карты:', '', (v) => { try { const r = UI.store.importAll(v); UI.note('Добавлено ' + r.added + ', пропущено ' + r.skipped); } catch (e) { UI.note('Ошибка импорта: ' + e.message); } }) });
      if (list.length > 7) { button(X + W - 60, Y + H - 20, 26, 15, '^', { dy: -1, fn: () => { UI.listScroll = Math.max(0, UI.listScroll - 1); } }); button(X + W - 32, Y + H - 20, 26, 15, 'v', { dy: -1, fn: () => { UI.listScroll = Math.min(list.length - 7, UI.listScroll + 1); } }); }
    },
  };
  FF.EditorUI = UI;
  if (typeof module !== 'undefined' && module.exports) module.exports = FF;
})(typeof window !== 'undefined' ? window : globalThis);
