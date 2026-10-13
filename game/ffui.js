// FROSTFALL: интерфейс новых систем (вкладки «Кузница», «Дела», «Рейды» и добавки в «Настройки»). Строки рисуются в тех же окнах, что и остальные вкладки.
(function (root) {
  'use strict';
  const FF = root.FF = root.FF || {};
  const UI = { sec: { forge: 'class', daily: 'quests', raid: 'inv' }, sel: null, party: [], thr: 1 };
  const SECS = {
    forge: [['class', 'Класс'], ['skills', 'Навыки'], ['gear', 'Заточка'], ['runes', 'Руны'], ['alch', 'Алхимия'], ['tav', 'Таверна'], ['shop', 'Склад']],
    daily: [['quests', 'Задания'], ['streak', 'Серия'], ['chains', 'Цепочки'], ['rep', 'Репутация'], ['codex', 'Кодекс']],
    raid: [['inv', 'Вторжение'], ['exp', 'Вылазки'], ['season', 'Сезон']],
  };
  const DICT = { atkP: 'урон', hpP: 'здоровье', def: 'защита', crit: 'крит', critd: 'урон крита', block: 'блок', vamp: 'вампиризм', goldP: 'золото', xpP: 'опыт' };
  const pct = (k, v) => (k === 'def' ? '+' + (Math.round(v * 10) / 10) : '+' + Math.round(v * 1000) / 10 + '%');
  const fxTxt = (fx) => Object.keys(fx).map((k) => DICT[k] + ' ' + pct(k, fx[k])).join(', ');
  const fmtT = (s) => { s = Math.max(0, Math.round(s)); return s >= 3600 ? Math.floor(s / 3600) + 'ч ' + Math.floor(s % 3600 / 60) + 'м' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  UI.rows = function (tab, h) {
    const { S, F, COL, A, c, text, tw, fit, button, row, head, para, toast, ask } = h, R = [], M = FF.Main, fg = M.forge, D = FF.ForgeData, w2 = h.w - 10;
    if (!fg) return [para('Модули ещё загружаются...', COL.mut, w2)];
    const sec = UI.sec[tab];
    R.push({ h: 19, draw: (x, y, w) => { const L = SECS[tab], bw = Math.floor((w - 2) / L.length); L.forEach((s, i) => button(x + i * bw, y, bw - 2, 16, s[1], { on: sec === s[0], dy: -1, fn: () => { UI.sec[tab] = s[0]; h.resetScroll(); if (h.hint) h.hint(tab + ':' + s[0]); } })); } });
    const res = () => R.push({ h: 15, draw: (x, y, w) => text(c, 'Обломки ' + fg.st.debris + ' · Эссенция ' + fg.st.essence + ' · Свитки ' + fg.st.scroll + ' · Травы ' + fg.st.herb, x + 4, y + 2, COL.mut) });
    const res2 = (r, okf) => { if (r && !r.ok && r.why) toast(r.why, '#ff8a8a'); if (okf && r && r.ok) okf(r); };
    const itemRow = (it, where, btns) => row({ icon: A.icons[it.slot === 'weapon' ? 'sword' : it.slot === 'armor' ? 'shield' : 'gem'], name: (it.lock ? '* ' : '') + it.name + (it.enh ? ' +' + it.enh : ''), nameCol: h.C.RAR[it.rar].col,
      desc: where + ' · знач. ' + Math.round(fg.itemVal(it)) + '% · проч. ' + Math.round(Number.isFinite(it.dur) ? it.dur : fg.durMax(it)) + '/' + fg.durMax(it) + (it.sock && it.sock.length ? ' · гнёзда ' + it.sock.length + '/' + D.socketsFor(it) : ''), btnW: btns.w || 70, btn: btns.draw });
    const gear = () => { const a = []; for (const k in S.equip) if (S.equip[k]) a.push([S.equip[k], 'надето']); for (const it of S.bag) a.push([it, 'сумка']); return a; };

    if (tab === 'forge') {
      if (sec === 'class') {
        const cur = fg.cls(), st = fg.stats();
        R.push(para('Класс: ' + cur.name + '. ' + cur.desc, COL.tx, w2));
        R.push(para('Урон ' + F(st.atk) + ' · Здоровье ' + F(st.hp) + ' · Защита ' + Math.round(st.def) + ' · Крит ' + Math.round(st.crit * 100) + '% (×' + st.critd.toFixed(2).replace('.', ',') + ') · Блок ' + Math.round(st.block * 100) + '% · Вампиризм ' + Math.round(st.vamp * 1000) / 10 + '%', COL.mut, w2));
        Object.keys(D.CLASSES).forEach((id) => { const cl = D.CLASSES[id], open = fg.canPick(id), on = fg.st.cls === id;
          R.push(row({ icon: A.icons.helm, name: cl.name, nameCol: on ? COL.ok : '#fff', desc: open ? cl.desc : 'Закрыт: цепочка заданий «Дела»' + (id === 'paladin' ? ' / первое вторжение' : ''), btnW: 80, btn: (x, y, w, hh) => button(x, y, w, hh, on ? 'Выбран' : (open ? 'Выбрать' : 'Закрыт'), { can: open && !on, green: open && !on, dy: -1, fn: () => ask('Сменить класс?', ['Навыки будут сброшены. Цена: ' + F(Math.round(500 * Math.pow(1.5, fg.st.respecs))) + ' зол.'], () => res2(fg.pickClass(id), () => toast('Класс: ' + cl.name, '#b66cff'))) }) })); });
      } else if (sec === 'skills') {
        R.push(para('Очки навыков: ' + fg.points() + ' (по одному за уровень героя). Ярус открывается за 3 очка предыдущих ярусов ветки.', COL.mut, w2));
        R.push({ h: 20, draw: (x, y, w) => button(x + 4, y, 180, 17, 'Сбросить навыки: ' + F(fg.respecCost()) + ' зол.', { can: fg.spent() > 0, dy: -1, fn: () => res2(fg.respec(), () => toast('Навыки сброшены', '#9fb4d8')) }) });
        D.TREES[fg.st.cls].forEach((br, bi) => { R.push(head(br.name + ' (' + fg.branchSpent(bi) + ')'));
          br.nodes.forEach((nd) => { const r = fg.st.nodes[nd.id] || 0, why = fg.canLearn(nd.id);
            R.push(row({ icon: A.icons.bolt, name: nd.name, lvl: r + '/' + nd.max, nameCol: r ? COL.ok : '#fff', desc: fxTxt(nd.fx) + (why && r < nd.max ? ' · ' + why : ''), btnW: 56, btn: (x, y, w, hh) => button(x, y, w, hh, r >= nd.max ? 'Макс' : '+1', { can: !why, green: !why, dy: -1, fn: () => res2(fg.learn(nd.id)) }) })); }); });
      } else if (sec === 'gear') {
        res(); R.push(para('Заточка до +20. С +6 предмет может упасть, с +11 — сломаться. Свиток защиты (покупается в лавке за самоцветы) спасает при провале. Замок * защищает от поломки.', COL.mut, w2));
        R.push({ h: 20, draw: (x, y, w) => { button(x + 4, y, 140, 17, 'Починить всё', { dy: -1, fn: () => { const t = fg.repairAll(); toast(t ? 'Ремонт: ' + F(t) + ' зол.' : 'Ремонт не нужен', '#9fb4d8'); } }); button(x + 150, y, 120, 17, 'Свиток: 5 самоцв.', { can: S.gems >= 5, dy: -1, fn: () => { S.gems -= 5; fg.st.scroll++; } }); } });
        gear().forEach(([it, wh]) => { const inf = fg.enhInfo(it);
          R.push(itemRow(it, wh, { w: 118, draw: (x, y, w, hh) => { button(x, y, 40, hh, inf ? '+' + inf.to : 'MAX', { can: !!inf, green: !!inf, dy: -1, fn: () => res2(fg.enhance(it, inf && inf.scrollNeeded && fg.st.scroll > 0)) }); button(x + 42, y, 36, hh, it.lock ? 'Откр' : 'Замок', { dy: -1, fn: () => fg.toggleLock(it) }); button(x + 80, y, 36, hh, 'Рем', { can: fg.repairCost(it) > 0, dy: -1, fn: () => res2(fg.repair(it)) }); } }));
          if (inf) R.push({ h: 12, draw: (x, y) => text(c, '   шанс ' + Math.round(inf.rate * 100) + '% · ' + F(inf.cost) + ' зол. · ' + inf.debris + ' обл.' + (inf.drop ? ' · при провале -' + inf.drop : '') + (inf.brk ? ' · поломка ' + Math.round(inf.brk * 100) + '%' : ''), x + 4, y, COL.mut) }); });
      } else if (sec === 'runes') {
        res(); R.push(para('Руны вставляются в гнёзда (обычный — 0, редкий — 1, эпический — 2, легендарный и выше — 3). 3 руны уровня I > 1 руна уровня II.', COL.mut, w2));
        D.RUNE_IDS.forEach((k) => { const ru = D.RUNES[k];
          R.push({ h: 20, draw: (x, y, w) => { c.fillStyle = ru.col; c.fillRect(x + 4, y + 3, 8, 8); text(c, ru.name + ': I×' + fg.runeCount(k, 1) + ' II×' + fg.runeCount(k, 2) + ' III×' + fg.runeCount(k, 3), x + 16, y + 2, '#fff');
            button(x + w - 150, y, 46, 17, 'Создать', { can: fg.st.essence >= 3, dy: -1, fn: () => res2(fg.craftRune(k)) }); button(x + w - 100, y, 46, 17, 'I>II', { can: fg.runeCount(k, 1) >= 3, dy: -1, fn: () => res2(fg.combineRune(k, 1)) }); button(x + w - 50, y, 46, 17, 'II>III', { can: fg.runeCount(k, 2) >= 3, dy: -1, fn: () => res2(fg.combineRune(k, 2)) }); } }); });
        R.push(head('Вставить в предмет'));
        gear().filter(([it]) => D.socketsFor(it) > 0).forEach(([it, wh]) => { R.push(itemRow(it, wh, { w: 110, draw: (x, y, w, hh) => {
          button(x, y, 54, hh, 'Вставить', { dy: -1, can: D.RUNE_IDS.some((k) => [1, 2, 3].some((t) => fg.runeCount(k, t) > 0)), fn: () => { let done = false; for (let t = 3; t >= 1 && !done; t--) for (const k of D.RUNE_IDS) if (fg.runeCount(k, t) > 0) { const r = fg.socket(it, k, t); res2(r); done = true; break; } } });
          button(x + 56, y, 54, hh, 'Достать', { can: !!(it.sock && it.sock.length), dy: -1, fn: () => res2(fg.unsocket(it, it.sock.length - 1)) }); } })); });
      } else if (sec === 'alch') {
        res(); R.push(para('До ' + D.MAX_POTIONS + ' эффектов одновременно. Повторное варево продлевает действие. Травы приходят от странников, вылазок и заданий.', COL.mut, w2));
        fg.st.pot.forEach((p) => R.push({ h: 13, draw: (x, y) => text(c, 'Действует: ' + D.POTIONS[p.id].name + ' ' + fmtT(p.left), x + 4, y + 1, COL.ok) }));
        Object.keys(D.POTIONS).forEach((id) => { const p = D.POTIONS[id], can = fg.st.herb >= p.herb && S.gold >= p.gold;
          R.push(row({ icon: A.icons.gem, name: p.name, desc: p.desc + ' · ' + Math.round(p.dur / 60) + ' мин · ' + p.herb + ' тр. · ' + F(p.gold) + ' зол.', btnW: 56, btn: (x, y, w, hh) => button(x, y, w, hh, 'Сварить', { can, green: can, dy: -1, fn: () => res2(fg.brew(id)) }) })); });
      } else if (sec === 'tav') {
        const day = FF.Clock.dayNumber(FF.Clock.safeNow());
        R.push(para('Наёмники меняются каждый день. Отряд: ' + fg.st.team.length + '/6, суммарная сила ' + F(fg.teamPower()) + '. Они идут в вылазки.', COL.mut, w2));
        fg.st.team.forEach((hr) => { R.push(row({ icon: A.icons.helm, name: hr.name + ' · ' + D.CLASSES[hr.cls].name, desc: 'ур.' + hr.lvl + ' · атака ' + hr.atk + ' · здор. ' + hr.hp, btnW: 62, btn: (x, y, w, hh) => button(x, y, w, hh, 'Уволить', { pink: true, dy: -1, fn: () => ask('Уволить ' + hr.name + '?', ['Золото не возвращается.'], () => fg.dismiss(hr.uid)) }) }));
          R.push({ h: 16, draw: (x, y, w) => { const hb = fg.heroBonus(hr), best = fg.bestBagItem(); text(c, fit('Предмет: ' + (hr.item ? (hr.item.name || hr.item.slot) + ' +' + hb : '—'), w - 22 - 134), x + 22, y + 3, hr.item ? COL.ok : COL.mut);
            button(x + w - 128, y, 40, 14, 'Дать', { can: !!best, green: !!best, fn: () => res2(fg.giveItem(hr.uid, best)) }); button(x + w - 86, y, 40, 14, 'Снять', { can: !!hr.item, fn: () => res2(fg.takeItem(hr.uid)) });
            const nx = fg.st.team[(fg.st.team.indexOf(hr) + 1) % fg.st.team.length], ok = fg.st.team.length > 1 && (hr.item || nx.item); button(x + w - 44, y, 40, 14, 'Обмен', { can: !!ok, fn: () => res2(fg.swapItems(hr.uid, nx.uid)) }); } }); });
        R.push(head('Сегодня в таверне'));
        fg.tavern(day).forEach((cd) => { const hired = fg.st.team.some((x) => x.uid === cd.uid), can = !hired && S.gold >= cd.price; R.push(row({ icon: A.icons.mug, name: cd.name + ' · ' + D.CLASSES[cd.cls].name + ' ' + ['', '*', '**', '***'][cd.q], nameCol: ['#aab4c0', '#4aa3ff', '#b66cff', '#ff9c2a'][cd.q], desc: 'ур.' + cd.lvl + ' · атака ' + cd.atk + ' · здор. ' + cd.hp + ' · защ. ' + cd.def, btnW: 70, btn: (x, y, w, hh) => button(x, y, w, hh, hired ? 'Нанят' : F(cd.price), { can, green: can, dy: -1, fn: () => res2(fg.hire(cd)) }) })); });
      } else if (sec === 'shop') {
        const day = FF.Clock.dayNumber(FF.Clock.safeNow()), mer = fg.merchant(day);
        R.push(para('Торговец дня: ' + mer.name + ' (цены ×' + mer.mult.toFixed(2).replace('.', ',') + '). Склад: ' + fg.st.stash.length + '/' + D.STASH_MAX + '. Сумка: ' + S.bag.length + '/' + fg.bagCap() + '.', COL.mut, w2));
        R.push({ h: 20, draw: (x, y, w) => { button(x + 4, y, 150, 17, 'Больше места: ' + F(fg.bagUpCost()), { can: S.gold >= fg.bagUpCost(), dy: -1, fn: () => res2(fg.upgradeBag()) }); } });
        R.push(head('Чертежи'));
        Object.keys(D.BLUEPRINTS).forEach((id) => { const b = D.BLUEPRINTS[id], known = fg.st.bp[id], co = b.cost;
          R.push(row({ icon: A.icons.scroll, name: b.name, desc: known ? co.debris + ' обл. · ' + co.essence + ' эсс. · ' + F(co.gold) + ' зол.' : 'Купить чертёж: ' + F(co.gold) + ' зол.', btnW: 72, btn: (x, y, w, hh) => button(x, y, w, hh, known ? 'Создать' : 'Изучить', { can: known ? true : S.gold >= co.gold, green: !!known, dy: -1, fn: () => { if (known) res2(fg.craft(id), (r) => toast('Создано: ' + r.item.name, '#ffd24a')); else if (S.gold >= co.gold) { S.gold -= co.gold; fg.learnBp(id); } } }) })); });
        R.push(head('Склад'));
        S.bag.slice(0, 30).forEach((it) => R.push(itemRow(it, 'сумка', { w: 118, draw: (x, y, w, hh) => { button(x, y, 38, hh, 'Склад', { dy: -1, fn: () => fg.stash(it) }); button(x + 40, y, 38, hh, 'Распыл', { dy: -1, can: !it.lock, fn: () => res2(fg.dismantle(it)) }); button(x + 80, y, 36, hh, F(fg.sellPrice(it, day)), { dy: -1, can: !it.lock, fn: () => res2(fg.sell(it, day)) }); } })));
        fg.st.stash.forEach((it) => R.push(itemRow(it, 'склад', { w: 70, draw: (x, y, w, hh) => button(x, y, w, hh, 'В сумку', { dy: -1, fn: () => { if (!fg.unstash(it)) toast('Сумка полна', '#ff8a8a'); } }) })));
      }
    } else if (tab === 'daily') {
      const q = M.q;
      if (sec === 'quests') {
        R.push({ h: 20, draw: (x, y, w) => { text(c, q.tip(), x + 4, y + 4, COL.mut); } });
        R.push({ h: 20, draw: (x, y, w) => button(x + 4, y, 120, 17, 'Забрать всё', { dy: -1, green: true, fn: () => { const n = q.claimAll(); toast(n ? 'Наград получено: ' + n : 'Нечего забирать', '#ffd24a'); } }) });
        const kinds = [['daily', 'Ежедневные'], ['weekly', 'Недельные'], ['season', 'Сезонные'], ['bounty', 'Охота'], ['chain', 'Цепочки']];
        for (const [k, nm] of kinds) { const L = q.s.list.filter((x) => x.kind === k); if (!L.length) continue; R.push(head(nm));
          L.forEach((it) => R.push(row({ icon: A.icons.scroll, name: q.info(it), nameCol: it.failed ? COL.bad : it.claimed ? COL.mut : '#fff', desc: Math.min(it.p, it.n) + '/' + it.n + ' · ' + F(Math.round(it.rw.gold * (1 + (S.maxN || 0) * 0.15))) + ' зол. +' + (it.rw.gems || 0) + ' самоцв.' + (it.ttl > 0 && !it.done ? ' · ' + fmtT(it.ttl) : ''), btnW: 64, btn: (x, y, w, hh) => button(x, y, w, hh, it.claimed ? 'Взято' : it.failed ? 'Провал' : it.done ? 'Забрать' : 'В пути', { can: it.done && !it.claimed, green: it.done && !it.claimed, dy: -1, fn: () => q.claim(it.id) }) }))); }
      } else if (sec === 'streak') {
        const st = q.s.streak, r = q.streakReward();
        R.push(para('Серия входов: ' + st.n + ' дн. Каждый день серии усиливает награду. Пропуск дня сбрасывает серию.', COL.tx, w2));
        R.push({ h: 22, draw: (x, y, w) => button(x + 4, y, 220, 18, q.streakClaimable() ? 'Награда: ' + F(r.gold) + ' зол. +' + r.gems + ' самоцв.' : 'Награда получена, приходи завтра', { can: q.streakClaimable(), green: q.streakClaimable(), dy: -1, fn: () => { q.claimStreak(); } }) });
      } else if (sec === 'chains') {
        ['ch_ranger', 'ch_necro', 'ch_rogue', 'ch_priest'].forEach((id) => { const inf = q.chainInfo(id); if (!inf) return; R.push(row({ icon: A.icons.map, name: inf.name, desc: inf.done ? 'Завершено' : inf.text + ' ' + inf.p + '/' + inf.n, btnW: 62, btn: (x, y, w, hh) => button(x, y, w, hh, inf.done ? 'Готово' : inf.active ? 'Идёт' : 'Начать', { can: !inf.done && !inf.active, green: !inf.done && !inf.active, dy: -1, fn: () => q.startChain(id) }) })); });
      } else if (sec === 'rep') {
        ['guard', 'merchants', 'mages'].forEach((f) => R.push({ h: 16, draw: (x, y, w) => text(c, f.toUpperCase() + ': ' + q.rankName(f) + ' · очки ' + (q.s.rep[f] || 0) + ' · скидка ' + Math.round((1 - q.discount(f)) * 100) + '%', x + 4, y + 3, '#fff') }));
      } else if (sec === 'codex') {
        q.codexList().forEach((cx) => R.push(para(cx.t + ': ' + cx.text, cx.text === '???' ? COL.mut : COL.tx, w2)));
        R.push(head('Слухи'));
        q.rumors((h.C.ZONES || []).map((z) => z.name)).forEach((rm) => R.push(para(rm, COL.mut, w2)));
      }
    } else if (tab === 'raid') {
      const inv = M.inv, v = inv.st;
      if (sec === 'inv') {
        const now = FF.Clock.safeNow();
        if (v.act) { R.push({ h: 34, draw: (x, y, w) => { text(c, 'ВТОРЖЕНИЕ! Осталось ' + fmtT(v.act.left), x + 4, y + 2, '#ff5c5c'); h.bar(c, x + 4, y + 14, w - 8, 9, v.act.hp / v.act.max, '#d04040'); text(c, 'HP ' + F(v.act.hp) + '/' + F(v.act.max) + ' · нанесено ' + Math.round(v.act.dealt / v.act.max * 100) + '%', x + 4, y + 25, COL.mut); } }); }
        else R.push(para('Следующее вторжение Ледяного Легиона через ' + fmtT((v.next - now) / 1000) + '. Урон по врагу идёт от твоего DPS. Победа даёт самоцветы и эссенцию, поражение — слабую стену на 10 минут (золото -20%).', COL.tx, w2));
        if (inv.wallWeak()) R.push({ h: 13, draw: (x, y) => text(c, 'Стена ослаблена ещё ' + fmtT((v.wallUntil - now) / 1000), x + 4, y + 1, COL.bad) });
        R.push(para('Побед ' + v.wins + ' · Поражений ' + v.losses + ' · Лучший результат ' + Math.round(v.best * 100) + '%', COL.mut, w2));
        R.push({ h: 20, draw: (x, y) => button(x + 4, y, 160, 17, 'Отразить сейчас (тест)', { can: !v.act && h.debug, dy: -1, fn: () => inv.start(true) }) });
      } else if (sec === 'exp') {
        const x = M.x, hero = fg.stats(), party = [{ id: 'player', name: 'Герой', cls: fg.st.cls, hp: Math.round(hero.hp), atk: Math.round(hero.atk * 3), def: Math.round(hero.def), crit: hero.crit, vamp: hero.vamp, skills: [] }].concat(((S.city && S.city.squad) || []).filter((id) => h.Wd && h.Wd.HID[id]).map((id, i) => { const pw = h.Wd.hPower(S, id); return { id: 'c_' + id, name: h.Wd.HID[id].name.split(' ')[0], cls: ['paladin', 'ranger', 'necro', 'rogue', 'priest'][i % 5], hp: Math.round(pw * 8), atk: Math.round(pw * 0.6), def: Math.round(pw * 0.05), crit: 0.08, vamp: 0, skills: [] }; })).concat(fg.st.team.map((t) => ({ id: 't' + t.uid, name: t.name, cls: t.cls, hp: t.hp, atk: fg.heroAtk(t) * 3, def: t.def, crit: 0.08, vamp: 0, skills: [] })));
        R.push(para('Слотов: ' + x.slots() + ' (растут с Ратушей) · отряд до ' + x.squadCap() + '. Угроза ' + UI.thr + '. Герой и наёмники идут сами.', COL.mut, w2));
        R.push({ h: 20, draw: (xx, y, w) => { button(xx + 4, y, 24, 17, '-', { dy: -1, fn: () => { UI.thr = Math.max(1, UI.thr - 1); } }); button(xx + 30, y, 24, 17, '+', { dy: -1, fn: () => { UI.thr = Math.min(20, UI.thr + 1); } }); const est = x.eng.estimate(party.slice(0, x.squadCap()), { threat: UI.thr, len: 6, provisions: 3 }); text(c, 'Оценка успеха ' + Math.round(est * 100) + '%', xx + 62, y + 3, COL.ok);
          button(xx + w - 100, y, 96, 17, 'В поход', { can: x.free() > 0, green: x.free() > 0, dy: -1, fn: () => { const r = x.start(party.slice(0, x.squadCap()), { threat: UI.thr, len: 6, provisions: 3 }); if (r.error) toast(r.error, '#ff8a8a'); } }); } });
        x.s.runs.forEach((run, i) => { const st = x.state(run), rd = x.ready(run); R.push(row({ icon: A.icons.map, name: 'Поход ' + (i + 1) + ' · угроза ' + run.threat, desc: rd ? 'Готово! Результат: ' + (st.res.win ? 'победа' : 'провал') : 'Комната ' + (st.room + 1) + '/' + st.res.timeline.length + ' · ' + fmtT(st.res.duration - st.t), btnW: 96, btn: (xx, y, w, hh) => { button(xx, y, rd ? w : w - 40, hh, rd ? 'Забрать' : 'Ждать', { can: rd, green: rd, dy: -1, fn: () => { const r = x.claim(i); if (r) toast('Добыча: ' + F(r.loot.gold) + ' зол.', '#ffd24a'); } }); if (!rd) button(xx + w - 38, y, 38, hh, 'Бег', { pink: true, dy: -1, fn: () => x.evacuate(i) }); } })); });
        R.push(para('Походов ' + x.s.stats.runs + ' · побед ' + x.s.stats.wins + ' · поражений ' + x.s.stats.losses, COL.mut, w2));
      } else if (sec === 'season') {
        const se = inv.season();
        R.push(para(se ? 'Сейчас: ' + se.name + '. Золото +10%, база украшена.' : 'Сезонных событий сейчас нет. Календарь: Зимнее солнцестояние (20 дек — 6 янв), Ледяной карнавал (10-20 фев), Ночь Теней (25 окт — 2 ноя).', COL.tx, w2));
      }
    }
    return R;
  };
  // Добавки к настройкам: звук, переназначение клавиш, отладка, версия
  UI.settings = function (h) {
    const { c, text, button, head, para, COL, ask, toast, S, F } = h, R = [], M = FF.Main, au = FF.audio;
    R.push(head('Звук и управление'));
    R.push({ h: 21, draw: (x, y, w) => { button(x + 4, y, 60, 17, au.enabled ? 'Звук: вкл' : 'Звук: выкл', { dy: -1, fn: () => { try { au.init(); } catch (e) { /* ignore */ } au.setEnabled(!au.enabled); } });
      [['music', 'Муз.'], ['sfx', 'Эфф.']].forEach((b, i) => { const bx = x + 70 + i * 82; button(bx, y, 14, 17, '-', { dy: -1, fn: () => au.setVolume(b[0], Math.max(0, au.vol[b[0]] - 0.1)) }); text(c, b[1] + ' ' + Math.round(au.vol[b[0]] * 100) + '%', bx + 18, y + 3, COL.tx); button(bx + 62, y, 14, 17, '+', { dy: -1, fn: () => au.setVolume(b[0], Math.min(1, au.vol[b[0]] + 0.1)) }); }); } });
    R.push({ h: 21, draw: (x, y, w) => { button(x + 4, y, 150, 17, '8-бит звуки: ' + (au.chip8 ? 'вкл' : 'выкл'), { dy: -1, on: !!au.chip8, fn: () => { au.chip8 = !au.chip8; try { localStorage.setItem('ff.chip8', au.chip8 ? '1' : ''); } catch (e) { /* ignore */ } try { au.init(); au.ui('tick'); } catch (e) { /* ignore */ } } }); } });
    Object.keys(M.DEF_KEYS).forEach((a) => R.push({ h: 18, draw: (x, y, w) => { text(c, M.KEYNAMES[a], x + 4, y + 3, COL.tx); button(x + w - 110, y, 106, 15, M.rebind === a ? 'Нажми клавишу...' : M.keys[a].replace('Digit', '').replace('Key', ''), { dy: -1, on: M.rebind === a, fn: () => { M.rebind = a; } }); } }));
    R.push({ h: 22, draw: (x, y, w) => { button(x + 4, y, 110, 17, 'Клавиши по умолч.', { dy: -1, fn: () => M.resetKeys() }); button(x + 118, y, 80, 17, 'Отладка F3', { dy: -1, on: M.debug, fn: () => { M.debug = !M.debug; } }); button(x + 202, y, 90, 17, 'Самотест', { dy: -1, fn: () => { const r = M.selfTest(); toast('Тест: ' + (r.ok ? 'OK' : 'ОШИБКА') + ' · вторжения ' + Math.round(r.invasion * 100) + '%', r.ok ? '#5fe08a' : '#ff8a8a'); } }); } });
    R.push(head('Сохранение'));
    R.push(para('Версия ' + M.VERSION + '. Слот загрузки: ' + (M.saver.lastSource || 'нет') + '. Ошибок записи: ' + M.saver.fails + '. Хэш: ' + (M.saver.lastHash || '-'), COL.mut, h.w - 10));
    R.push({ h: 22, draw: (x, y, w) => { button(x + 4, y, 130, 17, 'Просмотр структуры', { dy: -1, fn: () => h.showText('Структура сейва', M.saver.view(M.C.save(S), 2).join('\n')) }); button(x + 138, y, 110, 17, 'Журнал ошибок', { dy: -1, fn: () => h.showText('Журнал', M.errorLog().map((r) => r.lv + ' ' + r.tag + ': ' + r.msg).join('\n') || 'Пусто') }); button(x + 252, y, 70, 17, 'Обновление', { dy: -1, fn: () => M.checkUpdate().then((v) => toast(v ? 'Доступна версия ' + v : 'Установлена последняя версия', v ? '#ffd24a' : '#9fb4d8')) }); } });
    R.push(head('Игра'));
    const U = FF.UX, ng = U.NG.st(S), mu = U.NG.mult(S), nm = U.Names.ensure(S);
    R.push(para(nm.village + ', ' + nm.kingdom + '. Gear Score: ' + U.Gear.score(S, M.forge && ((it) => M.forge.itemVal(it))) + '. NG+: ' + ng.n + (ng.n ? ' (враги x' + mu.hp.toFixed(1).replace('.', ',') + ', золото и опыт x' + mu.gold.toFixed(2).replace('.', ',') + ')' : '') + (S.ff && S.ff.cheat ? '. Использованы читы.' : ''), COL.mut, h.w - 10));
    R.push({ h: 22, draw: (x, y, w) => { button(x + 4, y, 76, 17, 'Консоль', { dy: -1, fn: () => h.openConsole() }); button(x + 84, y, 60, 17, 'Титры', { dy: -1, fn: () => h.showCredits() }); button(x + 148, y, 84, 17, ng.ready ? 'Новая игра+' : 'NG+ (этаж 60)', { dy: -1, can: ng.ready, green: ng.ready, fn: () => h.restart() }); button(x + 236, y, 86, 17, 'Готовность', { dy: -1, fn: () => h.showText('Готовность', M.smoke().text) }); } });
    R.push({ h: 22, draw: (x, y, w) => { button(x + 4, y, 120, 17, 'Лог сессии (файл)', { dy: -1, fn: () => toast(U.SessionLog.download(M) ? 'Файл frostfall-log.txt сохранён' : 'Не удалось сохранить файл', '#9fb4d8') }); button(x + 128, y, 100, 17, 'Отряд: по силе', { dy: -1, fn: () => { U.Squad.sort(S, 'power'); toast('Отряд отсортирован', '#9fb4d8'); } }); } });
    R.push(head('Онлайн'));
    const N = M.net, tr = (r, ok) => { if (r && r.ok) { if (ok) ok(r); } else toast(r && r.offline ? 'Нет связи с сервером' : (r && r.error) || 'Ошибка', '#ff8a8a'); };
    if (!N) { R.push(para('Сеть недоступна в этом окружении.', COL.mut, h.w - 10)); return R; }
    const stTxt = { online: 'на связи', offline: 'нет связи (играем офлайн)', unknown: 'проверка...', off: 'выключено' }[N.status] || N.status;
    R.push(para('Сервер: ' + stTxt + (N.ping ? ', ' + N.ping + ' мс' : '') + '. Игрок: ' + (N.nick || 'не зарегистрирован') + (N.queue.length ? '. В очереди: ' + N.queue.length : ''), N.status === 'online' ? COL.ok : COL.mut, h.w - 10));
    R.push({ h: 22, draw: (x, y, w) => {
      button(x + 4, y, 84, 17, N.registered ? 'Сменить ник' : 'Регистрация', { dy: -1, green: !N.registered, fn: () => h.prompt('Ник', 'От 3 до 16 символов, должен быть свободен:', N.nick || '', (v) => { if (N.registered) N.logout(); N.register(v).then((r) => tr(r, () => { toast('Привет, ' + N.nick + '!', '#5fe08a'); N.submit('stage', S.maxN || 0); }), () => {}); }) });
      button(x + 92, y, 76, 17, 'Проверить', { dy: -1, fn: () => N.check().then((ok) => toast(ok ? 'Сервер отвечает: ' + N.ping + ' мс' : 'Сервер недоступен', ok ? '#5fe08a' : '#ff8a8a')) });
      button(x + 172, y, 70, 17, 'Новости', { dy: -1, fn: () => N.news().then((r) => tr(r, () => h.showText('Новости', r.news.map((n) => n.title + '\n' + n.body).join('\n\n') || 'Пусто'))) });
      button(x + 246, y, 76, 17, 'Журнал', { dy: -1, fn: () => h.showText('Сеть', N.debugDump()) }); } });
    R.push({ h: 22, draw: (x, y, w) => {
      [['stage', 'Этаж'], ['level', 'Уровень'], ['kills', 'Убийства']].forEach((b, i) => button(x + 4 + i * 80, y, 76, 17, 'Топ: ' + b[1], { dy: -1, fn: () => N.top(b[0], 10).then((r) => tr(r, () => h.showText('Топ-10: ' + b[1], r.top.map((t, k) => (k + 1) + '. ' + t.nick + ' - ' + F(t.value)).join('\n') || 'Пока пусто' + (r.stale ? '\n(данные устарели)' : '')))) }));
      button(x + 246, y, 76, 17, 'Промокод', { dy: -1, can: N.registered, fn: () => h.prompt('Промокод', 'Введи код:', '', (v) => N.promo(v).then((r) => tr(r, () => { const g = (r.reward && r.reward.gems) | 0; S.gems += g; toast('Награда: +' + g + ' самоцв.', '#5fe08a'); }))) }); } });
    R.push({ h: 22, draw: (x, y, w) => {
      button(x + 4, y, 100, 17, 'В облако', { dy: -1, can: N.registered, fn: () => N.cloudPush(0, h.saveStr()).then((r) => { if (r.conflict) ask('Сервер новее', ['В облаке более новое сохранение.', 'Перезаписать его текущим?'], () => N.cloudPush(0, h.saveStr(), true).then((r2) => tr(r2, () => toast('Сохранено в облако', '#5fe08a')))); else tr(r, () => toast('Сохранено в облако', '#5fe08a')); }) });
      button(x + 108, y, 100, 17, 'Из облака', { dy: -1, can: N.registered, fn: () => N.cloudPull(0).then((r) => tr(r, () => { if (!r.save) return toast('В облаке пусто', '#9fb4d8'); ask('Загрузить из облака?', ['Текущий прогресс будет заменён.'], () => { try { h.loadState(r.save.data); toast('Загружено из облака', '#5fe08a'); } catch (e) { toast('Сохранение повреждено', '#ff6b6b'); } }); })) });
      button(x + 212, y, 80, 17, 'Отзыв', { dy: -1, can: N.registered, fn: () => h.prompt('Отзыв', 'Что улучшить или сломалось?', '', (v) => N.feedback(v).then((r) => tr(r, () => toast('Спасибо за отзыв!', '#5fe08a')))) }); } });
    R.push({ h: 22, draw: (x, y, w) => {
      button(x + 4, y, 150, 17, 'Код входа (на др. устр.)', { dy: -1, can: N.registered, fn: () => h.prompt('Код входа', 'Скопируй код и вставь на другом устройстве (кнопка «Войти по коду»). Держи его в секрете.', N.exportKey() || '', null) });
      button(x + 158, y, 110, 17, 'Войти по коду', { dy: -1, fn: () => h.prompt('Вход по коду', 'Вставь код с другого устройства:', '', (v) => N.importKey(v).then((r) => tr(r, () => toast('Вы вошли как ' + N.nick, '#5fe08a')))) }); } });
    R.push(head('Бонусы и мировой босс'));
    const EX = FF.Ext, wb = UI.wb || (UI.wb = { d: null, t: 0, busy: 0, wait: 0 }), nowMs = Date.now();
    if (N.registered && N.status !== 'off' && nowMs - wb.t > 9000 && !wb.busy) { wb.busy = 1; wb.t = nowMs; N.boss().then((r) => { wb.busy = 0; if (r && r.ok) wb.d = r; }); }
    const bd = wb.d;
    R.push({ h: 30, draw: (x, y, w) => {
      if (!N.registered) { text(c, 'Зарегистрируйся, чтобы бить мирового босса', x + 4, y + 3, COL.mut); return; }
      if (!bd) { text(c, 'Мировой босс: загрузка...', x + 4, y + 3, COL.mut); return; }
      text(c, bd.name + (bd.killed ? ' - повержен!' : ''), x + 4, y + 1, bd.killed ? COL.ok : '#ffb1bd'); text(c, 'Твой вклад: ' + F(bd.me.dmg), x + w - 4, y + 1, COL.mut, { align: 'r' });
      h.bar(c, x + 4, y + 13, w - 8, 7, bd.hp / bd.max, '#ff4d6d', '#2a1018'); text(c, F(Math.max(0, bd.hp)) + ' / ' + F(bd.max) + (bd.top && bd.top[0] ? '  лидер: ' + bd.top[0].nick : ''), x + w / 2, y + 21, '#fff', { align: 'c', sh: null }); } });
    R.push({ h: 22, draw: (x, y, w) => {
      button(x + 4, y, 96, 17, 'Ударить босса', { dy: -1, can: N.registered && bd && !bd.killed, green: N.registered && bd && !bd.killed, fn: () => N.bossHit(Math.min(500, 10 + 2 * (S.maxN || 0))).then((r) => { if (r && r.ok) { wb.d = r; toast('Удар по боссу: -' + r.dealt, '#ff7a7a'); } else if (r && r.status === 429) toast('Босс восстанавливается: ещё ' + Math.ceil((r.wait || 0) / 1000) + ' с', '#ffd24a'); else tr(r); }) });
      button(x + 104, y, 96, 17, 'Награда босса', { dy: -1, can: !!(bd && bd.killed && bd.me.dmg > 0 && !bd.me.claimed), pink: !!(bd && bd.killed && bd.me.dmg > 0 && !bd.me.claimed), fn: () => N.bossClaim(bd.day).then((r) => tr(r, () => { S.gems += r.reward.gems; bd.me.claimed = true; h.chest('Мировой босс повержен', ['+' + r.reward.gems + ' самоцв.'], 2); })) });
      button(x + 204, y, 118, 17, 'Ежедневный бонус', { dy: -1, can: N.registered, green: N.registered, fn: () => N.dailyClaim().then((r) => { if (r && r.ok) { const gi = h.C.stageInfo(S.n), gold = Math.round(gi.gold * h.C.goldMult(S) * 8 * r.reward.goldMin); S.gems += r.reward.gems; S.gold += gold; h.chest('Серия входов: ' + r.streak, ['+' + r.reward.gems + ' самоцв.', '+' + F(gold) + ' золота'], Math.min(2, Math.floor(r.streak / 3))); } else if (r && r.status === 409) toast('Сегодня бонус уже получен (серия ' + (r.streak || '?') + ')', '#ffd24a'); else tr(r); }) }); } });
    R.push({ h: 22, draw: (x, y, w) => {
      button(x + 4, y, 90, 17, 'Сезон: итоги', { dy: -1, can: N.registered, fn: () => N.season('stage').then((r) => tr(r, () => { const p = r.prev, m = r.me; h.showText('Сезон ' + r.season, 'До конца сезона: ' + Math.ceil(r.endsIn / 86400000) + ' дн.\nТвой этаж: ' + (m ? m.value + ' (место ' + m.rank + ')' : 'нет в рейтинге') + '\n\nПрошлый сезон ' + p.season + ': ' + (p.me ? 'место ' + p.me.rank + ', награда ' + p.gems + ' самоцв.' + (p.claimed ? ' (получена)' : '') : 'тебя не было в рейтинге') + '\nНаграды: 1 место 100, топ-3 60, топ-10 30, топ-50 15, топ-100 8, остальные 3.'); })) });
      button(x + 98, y, 100, 17, 'Награда сезона', { dy: -1, can: N.registered, pink: N.registered, fn: () => N.seasonClaim('stage').then((r) => tr(r, () => { S.gems += r.reward.gems; h.chest('Награда сезона ' + r.season, ['Место ' + r.rank, '+' + r.reward.gems + ' самоцв.'], r.rank <= 3 ? 2 : r.rank <= 50 ? 1 : 0); })) });
      button(x + 202, y, 66, 17, 'Друзья', { dy: -1, fn: () => { const fr = EX.Friends.st(S); h.prompt('Друзья (' + fr.list.length + '/10)', (fr.list.length ? 'Сейчас: ' + fr.list.join(', ') + '. ' : '') + 'Введи ник, чтобы добавить, или «-ник», чтобы убрать. Когда у друга вырастет рекорд, придёт уведомление:', '', (v) => { if (!v) return; if (v[0] === '-') { EX.Friends.remove(S, v.slice(1).trim()); toast('Убран из друзей', '#9fb4d8'); return; } const r = EX.Friends.add(S, v); toast(r.ok ? 'Добавлен: ' + v : r.why, r.ok ? '#5fe08a' : '#ff8a8a'); if (r.ok) N.friends([v], 'stage').then((q) => { if (q && q.ok) { if (!q.friends.length) { EX.Friends.remove(S, v); toast('Игрок «' + v + '» не найден', '#ff8a8a'); } else EX.Friends.diff(S, q.friends); } }); }); } });
      button(x + 272, y, 50, 17, 'Рекорды', { dy: -1, can: EX.Friends.st(S).list.length > 0, fn: () => N.friends(EX.Friends.st(S).list, 'stage').then((r) => tr(r, () => { const ch = EX.Friends.diff(S, r.friends); h.showText('Друзья: этаж', r.friends.map((q) => q.nick + ': ' + q.value).join('\n') || 'Пусто'); ch.forEach((d) => toast('Рекорд друга ' + d.nick + ': этаж ' + d.to, '#ffd24a', true)); })) }); } });
    const IG = EX.Integrity, igTxt = { ok: 'файлы игры проверены', tampered: 'ФАЙЛЫ ИЗМЕНЕНЫ: рейтинг отключён (' + IG.bad.join(', ') + ')', unknown: 'не проверено (локальный запуск)' }[IG.state];
    R.push(para('Целостность: ' + igTxt + '. Сжатие трафика: ' + (N.noGzip ? 'выключено' : 'вкл') + ', сэкономлено ' + Math.round((N.stats.saved || 0) / 1024) + ' КБ.' + (N.blocked ? ' Рейтинг заблокирован: ' + N.blocked + '.' : ''), IG.state === 'tampered' ? COL.bad : COL.mut, h.w - 10));
    R.push(head('Кооператив (WebRTC, пробный)'));
    const lk = UI.link, lkTxt = lk ? { idle: 'ожидание', waiting: 'жду ответ друга', joining: 'отправь ответ другу', open: 'связь есть', closed: 'закрыто' }[lk.state] + (lk.fp ? ' · код сверки ' + lk.fp : '') + (lk.rttMs ? ' · ' + lk.rttMs + ' мс' : '') : 'нет соединения';
    R.push(para('Прямой канал без сервера: обменяйтесь кодами вручную и сверьте «код сверки» (должен совпасть у обоих). Сейчас: ' + lkTxt + '.', COL.mut, h.w - 10));
    R.push({ h: 22, draw: (x, y, w) => {
      button(x + 4, y, 92, 17, 'Создать комнату', { dy: -1, fn: () => { if (UI.link) UI.link.close(); const l = UI.link = new EX.RTCLink(); l.host().then((code) => h.prompt('Код приглашения', 'Отправь другу. Код сверки: ' + l.fp, code)).catch((e) => toast(String(e && e.message || e), '#ff8a8a')); } });
      button(x + 100, y, 92, 17, 'Войти по коду', { dy: -1, fn: () => h.prompt('Вход в комнату', 'Вставь код приглашения друга:', '', (v) => { if (UI.link) UI.link.close(); const l = UI.link = new EX.RTCLink(); l.join(v).then((code) => h.prompt('Твой ответ', 'Отправь другу. Код сверки: ' + l.fp, code)).catch((e) => toast('Код не подошёл', '#ff8a8a')); }) });
      button(x + 196, y, 86, 17, 'Принять ответ', { dy: -1, can: !!(lk && lk.state === 'waiting'), fn: () => h.prompt('Ответ друга', 'Вставь код ответа:', '', (v) => lk.accept(v).catch(() => toast('Код не подошёл', '#ff8a8a'))) });
      button(x + 286, y, 38, 17, 'Пинг', { dy: -1, can: !!(lk && lk.state === 'open'), fn: () => lk.ping() }); } });
    R.push(para('Рейтинг и облако нужны только онлайн; без сервера игра работает как раньше. Античита на клиенте нет: рейтинг защищён лишь от случайных накруток.', COL.mut, h.w - 10));
    return R;
  };
  FF.UI = UI;
  if (typeof module !== 'undefined' && module.exports) module.exports = FF;
})(typeof window !== 'undefined' ? window : globalThis);
