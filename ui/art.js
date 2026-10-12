// Все спрайты рисуются кодом и превращаются в пиксельные картинки при запуске.
(function (W) {
  'use strict';
  const { Art, finish, fromMap } = W.PX, K = '#141a2e';
  const SK = '#f2b88c';

  // ---------- люди: сетка 36x36 без дробного масштаба (пиксели одного размера), ноги на y=33 ----------
  const lighten = (c, d) => W.PX.shade(c, d);
  function human(a, o, f, atk) {
    const X = 3, Y = 2, R = (x, y, w, h, c) => a.R(x + X, y + Y, w, h, c), P = (x, y, c) => a.P(x + X, y + Y, c), E = (x, y, rx, ry, c) => a.E(x + X, y + Y, rx, ry, c),
      T = (x1, y1, x2, y2, x3, y3, c) => a.T(x1 + X, y1 + Y, x2 + X, y2 + Y, x3 + X, y3 + Y, c), L = (x1, y1, x2, y2, c, t) => a.L(x1 + X, y1 + Y, x2 + X, y2 + Y, c, t);
    const leg = o.leg || '#3b4262', boot = o.boot || '#4a2f1e', skin = o.skin || SK, bel = o.belt || '#5a3a24', EY = '#1c2240', ly = f ? -1 : 0;
    if (o.cape) { R(7, 15, 5, 14 + (f ? 1 : 0), o.cape); R(8, 28, 5, 2, lighten(o.cape, -22)); R(7, 15, 1, 12, lighten(o.cape, 18)); }
    if (o.wing) { T(11, 16, 3, 8, 7, 25, o.wing); T(11, 16, 4, 12, 8, 23, '#f4fbff'); }
    R(11, 25 + ly, 4, 4, leg); R(16, 25, 4, 4, leg); R(11, 29 + ly, 4, 3, boot); R(16, 29, 4, 3, boot); R(11, 29 + ly, 4, 1, lighten(boot, 22)); R(16, 29, 4, 1, lighten(boot, 22));
    R(10, 15, 10, 10, o.body); R(10, 15, 10, 2, lighten(o.body, 14)); R(10, 22, 10, 2, bel); P(14, 22, '#ffd24a'); P(15, 22, '#ffd24a'); R(10, 24, 10, 1, lighten(o.body, -26));
    if (o.trim) { R(14, 15, 2, 7, o.trim); R(10, 24, 10, 1, o.trim); }
    if (o.scarf) { R(10, 14, 10, 2, o.scarf); R(8, 15, 3, 7, o.scarf); R(8, 21, 3, 1, lighten(o.scarf, -30)); }
    if (o.shield) { R(4, 16, 7, 9, o.shield); R(4, 16, 7, 1, '#e8f0ff'); R(4, 24, 7, 1, '#e8f0ff'); R(4, 16, 1, 9, '#e8f0ff'); R(10, 16, 1, 9, '#e8f0ff'); P(7, 20, '#ffd24a'); P(7, 21, '#ffd24a'); }
    R(8, 16, 2, 7, o.bodyD || lighten(o.body, -20)); R(8, 22, 2, 2, skin);
    R(10, 4, 10, 9, skin); P(9, 8, skin); P(9, 9, lighten(skin, -26)); P(20, 8, skin); R(10, 12, 10, 1, lighten(skin, -22));
    R(12, 8, 2, 2, EY); R(16, 8, 2, 2, EY); P(12, 8, '#ffffff'); P(16, 8, '#ffffff'); P(11, 10, '#ee9a8c'); P(18, 10, '#ee9a8c'); R(14, 11, 2, 1, '#a85a54');
    if (o.beard) { R(10, 10, 10, 4, o.beard); R(11, 14, 8, 1, o.beard); R(10, 10, 10, 1, lighten(o.beard, 16)); R(13, 11, 4, 1, '#c8909a'); P(12, 10, lighten(o.beard, -26)); }
    if (o.helm) { R(9, 2, 12, 5, o.helm); R(9, 6, 3, 7, o.helm); R(19, 6, 2, 5, o.helm); R(11, 3, 6, 1, lighten(o.helm, 40)); R(9, 6, 12, 1, lighten(o.helm, -26)); if (o.crest) { R(12, -1, 6, 3, o.crest); R(12, -1, 6, 1, lighten(o.crest, 36)); } }
    else if (o.hat === 'cone') { R(9, 3, 12, 3, o.hair); R(8, 5, 2, 7, o.hair); T(15, -2, 8, 5, 22, 5, o.hatc); R(7, 4, 16, 2, lighten(o.hatc, -14)); R(7, 4, 16, 1, lighten(o.hatc, 24)); P(15, 3, '#ffd24a'); }
    else if (o.hat === 'fur') { R(9, 2, 12, 5, '#e6edf5'); R(8, 4, 3, 8, '#e6edf5'); R(19, 4, 2, 4, '#e6edf5'); R(11, 3, 5, 1, '#ffffff'); P(10, 6, '#b8c8dc'); P(14, 6, '#b8c8dc'); P(18, 5, '#b8c8dc'); R(11, 6, 8, 1, '#cfdcea'); }
    else { R(9, 2, 12, 4, o.hair); R(9, 5, 2, 7, o.hair); R(19, 5, 2, 3, o.hair); R(11, 5, 7, 1, o.hair); R(11, 3, 5, 1, lighten(o.hair, 30)); R(9, 5, 2, 1, lighten(o.hair, -24)); if (o.hood) { R(8, 2, 14, 3, lighten(o.hair, -8)); R(8, 5, 2, 8, lighten(o.hair, -8)); } }
    R(20, 16, 2, 6, o.body); R(20, 21, 3, 3, skin); R(20, 23, 3, 1, lighten(skin, -22));
    const w = o.weapon, wd = '#7a4a2a', st = '#dfe9f5';
    if (w === 'sword' && o.art) {
      const ar = o.art, pl = ar.pal, lt = pl[0], mn = pl[1], ac = pl[2];
      if (atk) { L(22, 21, 33, 17, mn, 3); L(22, 20, 33, 16, lt, 1); R(21, 19, 2, 5, '#ffd24a'); P(33, 17, ac); P(31, 19, ac); }
      else {
        if (ar.shape === 'zig') { for (let yy = 0; yy < 18; yy++) { const off = (yy % 6 < 3) ? 0 : 1; R(21 + off, 3 + yy, 2, 1, mn); P(21 + off, 3 + yy, lt); } R(21, 2, 2, 1, lt); P(22, 10, ac); }
        else if (ar.shape === 'wide') { R(20, 6, 4, 15, mn); R(21, 6, 1, 15, lt); R(21, 3, 2, 3, mn); P(21, 3, lt); P(22, 12, ac); P(22, 16, ac); }
        else { R(21, 4, 2, 17, mn); R(21, 4, 1, 17, lt); R(21, 2, 2, 2, lt); P(22, 12, ac); }
        R(18, 21, 8, 1, '#ffd24a'); P(21, 21, ac); P(22, 21, ac); R(21, 22, 2, 3, wd); P(21, 25, ac);
      }
    } else if (w === 'sword') {
      if (atk) { L(22, 21, 33, 17, st, 2); L(22, 20, 33, 16, '#ffffff', 1); R(21, 19, 2, 5, '#ffd24a'); }
      else { R(21, 8, 2, 13, st); R(21, 8, 1, 13, '#ffffff'); P(21, 7, '#ffffff'); R(19, 21, 6, 1, '#ffd24a'); R(21, 22, 2, 2, wd); }
    } else if (w === 'bow') {
      R(25, 9, 1, 3, wd); R(26, 12, 1, 11, wd); R(25, 23, 1, 3, wd);
      if (atk) { L(25, 9, 22, 17, '#e8e8e8', 1); L(22, 17, 25, 26, '#e8e8e8', 1); R(22, 17, 10, 1, '#c8a05a'); T(33, 17.5, 30, 15, 30, 20, st); } else R(24, 9, 1, 17, '#e8e8e8');
    } else if (w === 'axe') {
      if (atk) { L(22, 22, 28, 14, wd, 1); R(26, 12, 5, 6, '#cfd8e3'); R(30, 12, 1, 6, '#ffffff'); } else { R(22, 10, 1, 14, wd); R(23, 8, 5, 6, '#cfd8e3'); R(27, 8, 1, 6, '#ffffff'); R(23, 8, 5, 1, '#e8f0ff'); }
    } else if (w === 'staff') {
      R(22, 6, 1, 20, wd); E(22.5, 4.5, 2.7, 2.7, atk ? '#ffffff' : '#7fe0ff'); P(21, 3, '#ffffff'); R(20, 7, 5, 1, '#c8a05a');
    } else if (w === 'spear') {
      if (atk) { R(17, 21, 14, 1, wd); T(33, 21.5, 29, 18.5, 29, 24.5, st); } else { R(22, 5, 1, 21, wd); T(22.5, -1, 19.5, 6, 25.5, 6, st); R(21, 7, 3, 1, '#d8453f'); }
    } else if (w === 'hammer') {
      if (atk) { R(22, 22, 9, 1, wd); R(29, 17, 6, 9, '#9aa4b2'); R(29, 17, 6, 1, '#cfd8e3'); } else { R(22, 9, 1, 15, wd); R(19, 5, 8, 6, '#9aa4b2'); R(19, 5, 8, 1, '#cfd8e3'); R(19, 10, 8, 1, '#6c7788'); }
    } else if (w === 'orb') {
      R(22, 11, 1, 15, '#6a4a96'); E(22.5, 9.5, 3, 3, '#ff7ae0'); P(21, 8, '#ffffff'); E(29, 6 + (f ? 1 : 0), 2.3, 2.3, atk ? '#ffffff' : '#7fe0ff');
    }
  }
  const HUMANS = {
    hero: { body: '#3b78d8', bodyD: '#2a58a8', trim: '#f4f4f4', hat: 'fur', scarf: '#d8453f', cape: '#c83a3a', weapon: 'sword', k: 1.15 },
    0: { body: '#4aa65a', trim: '#2f7a3a', hair: '#3a7a3a', hood: 1, weapon: 'bow', k: 0.95 },
    1: { body: '#a0703c', trim: '#7a5230', hair: '#5a3a24', hood: 1, weapon: 'axe', k: 1 },
    2: { body: '#9aa4b2', trim: '#dfe9f5', helm: '#cfd8e3', crest: '#d8453f', weapon: 'sword', shield: '#4a6ac0', k: 1.05 },
    3: { body: '#2f9ad0', trim: '#aee4ff', hair: '#e8f4ff', hat: 'cone', hatc: '#2a6aa8', weapon: 'staff', k: 1 },
    4: { body: '#e8d27a', trim: '#ffffff', helm: '#ffd24a', wing: '#ffffff', cape: '#c83a3a', weapon: 'spear', k: 1.08 },
    5: { body: '#3a4a8a', trim: '#7fa0e0', helm: '#6a7ab0', crest: '#7fe0ff', weapon: 'hammer', shield: '#3a4a8a', k: 1.25 },
    6: { body: '#7a4ab8', trim: '#ff7ae0', hair: '#e8e8ff', hat: 'cone', hatc: '#5a2a98', weapon: 'orb', cape: '#3a1a68', k: 1.1 },
  };

  Object.assign(HUMANS, {
    n_gunnar: { body: '#6a4a30', trim: '#ffd24a', helm: '#9aa4b2', beard: '#e8e8ee', cape: '#8a2a2a', k: 1.15 },
    n_einar: { body: '#c8a040', trim: '#ffffff', hair: '#e8c860', k: 1.0 },
    n_bjorn: { body: '#7a4a2a', trim: '#b0b0b0', hair: '#c8602a', beard: '#c8602a', weapon: 'hammer', k: 1.2 },
    n_ulf: { body: '#3a7a4a', trim: '#e8d27a', hair: '#4a3020', hood: 1, cape: '#2a5a38', k: 1.0 },
    n_ing: { body: '#7a5aa8', trim: '#e0d0ff', hair: '#e0e0e8', hood: 1, weapon: 'staff', cape: '#4a3a78', k: 1.0 },
    n_shade: { body: '#8ab8d8', trim: '#ffffff', helm: '#b8d8f0', crest: '#7fe0ff', cape: '#5a88b8', k: 1.2 },
  });
  Object.assign(HUMANS, {
    eirik: { body: '#4a6ab0', trim: '#dfe9f5', helm: '#9aa4b2', crest: '#d8453f', weapon: 'sword', shield: '#8a5a3a', k: 1.1 },
    lira: { body: '#2f8a5a', trim: '#a0e0b0', hair: '#e8c860', weapon: 'bow', k: 1 },
    brunn: { body: '#6a4a30', trim: '#ffd24a', helm: '#7a7f98', shield: '#6a4a30', weapon: 'axe', k: 1.2 },
    helm: { body: '#3a5a9a', trim: '#7fe0ff', helm: '#cfe4ff', crest: '#7fe0ff', weapon: 'spear', shield: '#cfe4ff', k: 1.1 },
    solv: { body: '#4ab8e8', trim: '#ffffff', hair: '#cfe8ff', hat: 'cone', hatc: '#2a8ac8', weapon: 'staff', cape: '#2a6aa8', k: 1.05 },
    torg: { body: '#a05a3a', trim: '#ffb15c', hair: '#c86a3a', weapon: 'hammer', k: 1.15 },
    freya: { body: '#e8d8a0', trim: '#ffffff', helm: '#ffd24a', wing: '#ffffff', weapon: 'spear', cape: '#d8453f', k: 1.1 },
    ragnar: { body: '#8a3a2a', trim: '#d8c0a0', hair: '#d86a2a', weapon: 'axe', cape: '#5a2a1a', k: 1.25 },
    ingrid: { body: '#5a3a98', trim: '#9fe8ff', hair: '#e8e8ff', hat: 'cone', hatc: '#3a2a78', weapon: 'orb', cape: '#2a1a58', k: 1.1 },
    skadi: { body: '#9fd8ff', trim: '#ffffff', helm: '#e8f4ff', crest: '#7fe0ff', wing: '#aee4ff', weapon: 'sword', cape: '#4a8ad8', k: 1.2 },
  });

  // ---------- монстры: сетка 32x32, ноги на y=31, смотрят влево ----------
  const MON = {
    crystal(a, f) { a.R(8, 14, 16, 14, '#6a4ac0'); a.R(8, 14, 16, 2, '#8a6ae0'); a.T(16, 1 + f, 10, 16, 22, 16, '#b89aff'); a.T(7, 7 + f, 3, 18, 12, 18, '#9a7af0'); a.T(25, 7 + f, 20, 18, 29, 18, '#9a7af0'); a.T(16, 3 + f, 14, 14, 18, 14, '#e8dcff');
      a.R(10, 19, 5, 4, '#ffffff'); a.R(18, 19, 5, 4, '#ffffff'); a.R(12, 20, 2, 3, K); a.R(20, 20, 2, 3, K); a.R(8, 27, 6, 4, '#4a2a98'); a.R(18, 27 - f, 6, 4 + f, '#4a2a98'); a.R(13, 25, 6, 2, '#c8b0ff'); },
    wisp(a, f) { a.T(16, 31, 8, 18, 24, 18, '#1fb890'); a.E(16, 17, 9, 11, '#4fe8c0'); a.E(16, 16, 6, 8, '#b8fff0'); a.T(16, -1 + f, 12, 8, 20, 8, '#4fe8c0'); a.R(11, 14, 3, 5, '#0e2a3a'); a.R(18, 14, 3, 5, '#0e2a3a'); a.P(11, 14, '#fff'); a.P(18, 14, '#fff'); a.R(14, 21, 4, 1, '#0e2a3a');
      a.P(4, 8 + f, '#ffffff'); a.P(27, 11 - f, '#ffffff'); a.P(6, 22 - f, '#aaffe8'); a.P(26, 24 + f, '#aaffe8'); },
    imp(a, f) { a.R(10, 17, 12, 9, '#e0962f'); a.R(10, 17, 12, 2, '#f0b84a'); a.R(8, 5, 16, 12, '#f0b84a'); a.R(8, 5, 16, 2, '#ffd878'); a.T(9, 6, 5, -1, 13, 6, '#8a4a1a'); a.T(23, 6, 19, 6, 27, -1, '#8a4a1a');
      a.R(11, 10, 4, 4, '#ffffff'); a.R(18, 10, 4, 4, '#ffffff'); a.R(12, 11, 2, 3, K); a.R(19, 11, 2, 3, K); a.R(12, 15, 8, 1, '#7a3a14'); a.P(13, 16, '#fff'); a.P(18, 16, '#fff'); a.T(26, 24, 22, 20, 30, 16 + f * 2, '#e0962f'); a.R(10, 26, 5, 5, '#8a4a1a'); a.R(17, 26 - f, 5, 5 + f, '#8a4a1a'); a.R(4, 14 + f, 5, 2, '#c8452f'); a.R(23, 14 - f, 5, 2, '#c8452f'); },
    goblin(a, f) { a.R(9, 7, 14, 10, '#78c050'); a.R(9, 7, 14, 2, '#98e070'); a.T(9, 11, 2, 7, 9, 15, '#78c050'); a.T(23, 11, 30, 7, 23, 15, '#78c050'); a.R(11, 10, 4, 3, '#ffe14a'); a.R(18, 10, 4, 3, '#ffe14a'); a.P(13, 11, K); a.P(20, 11, K); a.R(12, 14, 8, 1, '#2a4a1a'); a.P(13, 15, '#fff'); a.P(18, 15, '#fff');
      a.R(10, 17, 12, 9, '#9a6a30'); a.R(10, 17, 12, 2, '#b88a4a'); a.E(25, 20, 6, 6, '#d8b060'); a.E(25, 20, 4, 4, '#f0d080'); a.P(25, 14, '#8a5a2a'); a.R(9, 26, 5, 5, '#5a3a1a'); a.R(18, 26 - f, 5, 5 + f, '#5a3a1a'); a.R(5, 19, 5, 3, '#78c050'); },
    slime(a, f) { a.E(16, 24, 12 + f, 8 - f, '#5fc4f0'); a.E(16, 21, 9, 5 - f, '#8fdcff'); a.R(8, 17, 4, 2, '#d6f4ff'); a.R(9, 21, 3, 3, '#fff'); a.R(18, 21, 3, 3, '#fff'); a.P(9, 22, K); a.P(10, 22, K); a.P(18, 22, K); a.P(19, 22, K); a.R(13, 26, 5, 1, K); },
    snowman(a, f) { a.E(16, 25, 10, 7, '#f4fbff'); a.E(16, 14, 7, 7, '#ffffff'); a.R(10, 20, 12, 2, '#d8453f'); a.R(8, 21, 2, 4 + f, '#d8453f'); a.R(9, 6, 14, 2, '#2a2f45'); a.R(11, 0, 10, 7, '#2a2f45'); a.R(11, 4, 10, 1, '#d8453f'); a.R(9, 14, 3, 2, '#ff9c2a'); a.R(6, 15, 4, 1, '#ff9c2a'); a.P(12, 11, K); a.P(17, 11, K); a.R(11, 17, 1, 1, K); a.R(14, 18, 1, 1, K); a.R(17, 17, 1, 1, K); a.L(7, 22, 1, 17 - f, '#8a5a3a'); a.L(25, 22, 31, 16 + f, '#8a5a3a'); a.P(16, 24, K); a.P(16, 27, K); },
    wolf(a, f) { const s = f ? 1 : 0; a.R(8 + s, 25, 3, 7, '#6a7690'); a.R(13 - s, 25, 3, 7, '#8a96b0'); a.R(21 + s, 25, 3, 7, '#6a7690'); a.R(26 - s, 25, 3, 7, '#8a96b0'); a.E(18, 22, 10, 6, '#aab4c8'); a.E(18, 25, 8, 3, '#dfe9f5'); a.L(27, 19, 31, 14 + f, '#aab4c8', 3); a.E(8, 16, 6, 5, '#aab4c8'); a.R(1, 17, 6, 3, '#aab4c8'); a.R(1, 17, 2, 2, K); a.T(8, 9, 6, 13, 12, 13, '#8a96b0'); a.T(12, 9, 10, 13, 15, 14, '#8a96b0'); a.R(7, 14, 2, 2, '#ff5050'); a.R(3, 20, 4, 2, '#ffffff'); a.R(4, 20, 1, 2, '#ffffff'); a.R(6, 20, 1, 1, '#fff'); },
    bat(a, f) { const up = f ? -4 : 3; a.T(16, 16, 1, 8 + up, 8, 22, '#6a4ab0'); a.T(16, 16, 31, 8 + up, 24, 22, '#6a4ab0'); a.T(16, 16, 9, 24, 3, 18 + up, '#4a2a88'); a.T(16, 16, 23, 24, 29, 18 + up, '#4a2a88'); a.E(16, 17, 4, 5, '#8a6ad0'); a.T(12, 11, 11, 15, 14, 14, '#8a6ad0'); a.T(20, 11, 21, 15, 18, 14, '#8a6ad0'); a.P(14, 16, '#ffe14a'); a.P(18, 16, '#ffe14a'); a.P(14, 20, '#fff'); a.P(18, 20, '#fff'); },
    ghost(a, f) { a.E(16, 12, 9, 9, '#e8f4ff'); a.R(7, 12, 18, 12, '#e8f4ff'); for (let i = 0; i < 4; i++) a.T(7 + i * 5, 23, 11 + i * 5, 23, 9 + i * 5, 29 + ((i + f) % 2) * 2, '#e8f4ff'); a.R(11, 11, 3, 5, '#2a3a6a'); a.R(18, 11, 3, 5, '#2a3a6a'); a.R(14, 19, 4, 3, '#2a3a6a'); a.R(4, 14, 3, 4, '#cfe4ff'); a.R(25, 14, 3, 4, '#cfe4ff'); },
    golem(a, f) { a.R(9, 25, 5, 6, '#6a7e9c'); a.R(18, 25, 5, 6, '#6a7e9c'); a.R(8, 11, 16, 15, '#8aa0c0'); a.R(10, 13, 12, 5, '#aac0dc'); a.R(11, 2, 10, 9, '#7a90b0'); a.R(12, 5, 3, 2, '#7fffff'); a.R(17, 5, 3, 2, '#7fffff'); a.R(3 - f, 12, 5, 13, '#7a90b0'); a.R(24 + f, 12, 5, 13, '#7a90b0'); a.R(2 - f, 24, 6, 5, '#aac0dc'); a.R(24 + f, 24, 6, 5, '#aac0dc'); a.T(7, 11, 4, 3, 11, 11, '#cdeeff'); a.T(25, 11, 28, 4, 21, 11, '#cdeeff'); a.R(14, 16, 4, 4, '#7fe0ff'); },
    yeti(a, f) { a.R(8, 26, 6, 5, '#d6e6f6'); a.R(18, 26, 6, 5, '#d6e6f6'); a.E(16, 19, 10, 9, '#eef6ff'); a.E(5 - f, 20, 4, 8, '#dbe8f6'); a.E(27 + f, 20, 4, 8, '#dbe8f6'); a.E(16, 9, 7, 6, '#eef6ff'); a.R(11, 7, 10, 6, '#7a9cc8'); a.R(12, 8, 2, 2, '#ff4a4a'); a.R(18, 8, 2, 2, '#ff4a4a'); a.R(13, 11, 6, 2, K); a.P(13, 12, '#fff'); a.P(18, 12, '#fff'); a.T(9, 5, 8, 0, 12, 3, '#cfe4f8'); a.T(23, 5, 24, 0, 20, 3, '#cfe4f8'); },
    knight(a, f) { a.R(10, 24, 5, 7, '#4a4f7a'); a.R(17, 24, 5, 7, '#4a4f7a'); a.R(9, 12, 14, 13, '#6a6f9a'); a.R(14, 12, 4, 13, '#8a8fba'); a.R(10, 2, 12, 10, '#7a7fa8'); a.R(11, 6, 10, 2, K); a.R(12, 6, 2, 2, '#ff4a4a'); a.R(18, 6, 2, 2, '#ff4a4a'); a.T(16, -1, 12, 2, 20, 2, '#d8453f'); a.R(3, 13, 7, 11, '#4a4f7a'); a.R(4, 14, 5, 9, '#8a8fba'); a.R(23, 14, 2, 4, '#6a6f9a'); a.L(26, 18, 28, 0 + f, '#cfe4ff', 2); a.R(24, 17, 6, 2, '#ffd24a'); },
    flame(a, f) { a.E(16, 21, 9, 10, '#ff6a1a'); a.T(16, 0 + f * 2, 8, 17, 24, 17, '#ff6a1a'); a.T(9, 8, 6, 18, 11, 15, '#ff6a1a'); a.T(23, 8 + f * 2, 26, 18, 21, 15, '#ff6a1a'); a.E(16, 23, 6, 7, '#ffb21a'); a.T(16, 8 + f * 2, 11, 21, 21, 21, '#ffb21a'); a.E(16, 25, 3, 4, '#fff1a8'); a.R(11, 17, 3, 3, K); a.R(18, 17, 3, 3, K); a.P(12, 18, '#ffe14a'); a.P(19, 18, '#ffe14a'); },
  };
  function dragon(a, f, c) { // смотрит влево
    c = c || { body: '#4aa3d8', belly: '#cfeaff', wing: '#2a6ab0', horn: '#fff2c0' };
    const up = f ? -3 : 2;
    a.T(18, 18, 8, 3 + up, 26, 8 + up, c.wing); a.T(18, 18, 26, 8 + up, 31, 20, c.wing); a.T(18, 18, 8, 3 + up, 14, 14, c.wing);
    a.L(28, 24, 31, 16 + f, c.body, 3); a.R(11, 26, 4, 6, c.body); a.R(21, 26, 4, 6, c.body); a.R(10, 30, 5, 2, c.horn); a.R(20, 30, 5, 2, c.horn);
    a.E(18, 23, 11, 6, c.body); a.E(17, 25, 8, 3, c.belly); a.E(10, 18, 4, 7, c.body); a.E(7, 14, 6, 5, c.body); a.R(0, 14, 6, 4, c.body); a.R(1, 17, 5, 1, c.belly);
    a.T(9, 8, 7, 13, 12, 12, c.horn); a.T(12, 9, 10, 13, 15, 13, c.horn); a.R(6, 12, 2, 2, '#ffe14a'); a.P(7, 12, K); a.P(1, 14, K); a.P(2, 14, K);
    for (let i = 0; i < 4; i++) a.T(14 + i * 4, 18, 16 + i * 4, 18, 15 + i * 4, 15, c.horn);
  }

  // ---------- постройки (сетка 56x56, основание на y=55) ----------
  const SN = '#ffffff', SN2 = '#d6e8f8';
  function roofSnow(a, x, y, w) { a.R(x, y, w, 2, SN); a.R(x + 1, y + 2, w - 2, 1, SN2); }
  const BART = {
    hall(a, t) { const rf = t >= 2 ? '#e8b030' : '#3a6ac0', rf2 = t >= 2 ? '#a87818' : '#274a90';
      a.R(2, 30, 52, 26, '#8d97ac'); for (let y = 34; y < 56; y += 6) a.R(2, y, 52, 1, '#7a8498'); a.R(0, 22, 14, 34, '#9aa4b8'); a.R(42, 22, 14, 34, '#9aa4b8');
      for (let i = 0; i < 3; i++) { a.R(0 + i * 5, 19, 4, 4, '#9aa4b8'); a.R(42 + i * 5, 19, 4, 4, '#9aa4b8'); } roofSnow(a, 0, 18, 14); roofSnow(a, 42, 18, 14);
      a.R(18, 10, 20, 24, '#a8b2c6'); a.T(28, -2, 14, 12, 42, 12, rf); a.R(14, 11, 28, 2, rf2); a.T(28, -2, 22, 5, 34, 5, SN);
      a.R(26, 2, 1, -0, '#fff'); a.R(28, -8, 1, 8, '#6a4a30'); a.R(29, -8, 6, 4, t >= 1 ? '#ffd24a' : '#d8453f');
      a.R(23, 38, 10, 18, '#2a1c18'); a.E(28, 38, 5, 4, '#2a1c18'); a.R(23, 38, 1, 18, '#6a4a30'); a.R(32, 38, 1, 18, '#6a4a30');
      a.R(24, 17, 3, 5, '#ffe14a'); a.R(31, 17, 3, 5, '#ffe14a'); a.R(5, 30, 3, 5, '#ffe14a'); a.R(48, 30, 3, 5, '#ffe14a'); a.R(5, 42, 3, 5, '#ffe14a'); a.R(48, 42, 3, 5, '#ffe14a');
      if (t >= 1) { a.R(1, 12, 1, 7, '#6a4a30'); a.R(2, 12, 5, 3, '#d8453f'); a.R(54, 12, 1, 7, '#6a4a30'); a.R(49, 12, 5, 3, '#d8453f'); } },
    sawmill(a, t) { a.R(6, 26, 38, 29, '#8a5a3a'); for (let y = 29; y < 55; y += 4) a.R(6, y, 38, 1, '#6a4228'); a.T(25, 12, 2, 28, 48, 28, '#6a3a28'); roofSnow(a, 10, 18, 30); a.R(14, 40, 9, 15, '#3a2418'); a.R(30, 32, 8, 7, '#ffe14a'); a.R(30, 35, 8, 1, '#8a5a3a'); a.R(36, 14, 5, 10, '#7a7f8c'); a.R(36, 12, 5, 2, SN);
      a.E(50, 51, 4, 3, '#c8a05a'); a.E(48, 47, 4, 3, '#d8b06a'); a.E(51, 46, 3, 3, '#c8a05a'); a.E(50, 51, 1.5, 1.2, '#8a5a3a');
      a.E(4, 48, 6, 6, '#cfd8e3'); a.E(4, 48, 2, 2, '#5a6472'); for (let i = 0; i < 8; i++) { const an = i * 0.785; a.P(4 + Math.cos(an) * 7, 48 + Math.sin(an) * 7, '#9aa4b2'); } },
    quarry(a, t) { a.E(26, 50, 24, 10, '#8a94a6'); a.E(34, 40, 14, 11, '#aab4c8'); a.E(18, 44, 12, 9, '#9aa4b8'); a.E(40, 46, 10, 8, '#7a8498'); a.R(20, 36, 10, 3, SN); a.R(34, 28, 8, 2, SN); a.E(18, 50, 7, 6, '#1a1c2c');
      a.L(46, 52, 52, 40, '#8a5a3a', 1); a.L(46, 40, 54, 40, '#cfd8e3', 2); a.R(2, 44, 6, 6, '#6a7488'); a.R(3, 46, 4, 2, '#9aa4b8'); a.R(10, 50, 5, 5, '#7a8498'); },
    mine(a, t) { a.E(28, 52, 28, 18, '#6a7488'); a.R(10, 20, 36, 36, '#7a8498'); a.R(18, 26, 20, 30, '#10142a'); a.R(14, 22, 4, 34, '#8a5a3a'); a.R(38, 22, 4, 34, '#8a5a3a'); a.R(12, 18, 32, 5, '#a0703c'); a.R(10, 14, 36, 4, SN); a.R(20, 36, 16, 3, '#1a1e3a');
      a.R(0, 50, 20, 2, '#5a6472'); a.R(2, 44, 14, 6, '#4a4f60'); a.E(9, 43, 7, 3, '#8fb0f0'); a.P(7, 42, '#dfe9ff'); a.E(3, 55, 2, 2, '#14182a'); a.E(14, 55, 2, 2, '#14182a'); a.R(40, 36, 2, 3, '#ffd24a'); },
    forge(a, t) { a.R(4, 28, 36, 27, '#7a6a62'); for (let y = 32; y < 55; y += 5) a.R(4, y, 36, 1, '#5e5048'); a.R(0, 24, 44, 5, '#4a4f60'); a.R(0, 22, 44, 2, SN); a.R(28, 4, 8, 22, '#5e5048'); a.R(27, 2, 10, 3, '#4a4038'); a.R(27, 0, 10, 2, SN);
      a.R(9, 36, 14, 19, '#1a0f0c'); a.R(11, 40, 10, 15, '#ff7a1a'); a.R(13, 44, 6, 11, '#ffd24a'); a.R(46, 46, 9, 4, '#4a4f60'); a.R(48, 50, 5, 5, '#3a3f50'); a.R(46, 44, 4, 2, '#6a7080'); a.R(30, 34, 5, 4, '#ffe14a'); },
    treasury(a, t) { a.R(4, 28, 44, 27, '#cdb870'); a.R(2, 52, 48, 4, '#9aa4b8'); for (let i = 0; i < 4; i++) a.R(8 + i * 11, 30, 5, 22, '#f4ecd0'); a.T(26, 12, 0, 28, 52, 28, '#e8c040'); a.T(26, 17, 8, 26, 44, 26, '#b89828'); roofSnow(a, 8, 20, 36); a.E(26, 24, 4, 4, '#ffe14a'); a.R(25, 22, 2, 4, '#c8941e');
      a.E(50, 52, 4, 3, '#ffd24a'); a.E(53, 49, 3, 3, '#ffe14a'); a.E(48, 49, 3, 2, '#ffd24a'); a.R(21, 38, 10, 14, '#4a3a2a'); a.R(25, 44, 2, 2, '#ffd24a'); },
    walls(a, t) { a.R(10, 10, 22, 46, '#9aa4b8'); for (let i = 0; i < 4; i++) a.R(10 + i * 6, 5, 4, 5, '#9aa4b8'); a.R(8, 4, 26, 2, SN); a.R(0, 34, 12, 22, '#8d97ac'); for (let y = 38; y < 56; y += 6) a.R(0, y, 12, 1, '#7a8498'); a.R(0, 31, 12, 3, '#9aa4b8'); a.R(0, 30, 12, 1, SN);
      a.R(18, 18, 3, 8, '#10142a'); a.R(18, 36, 3, 8, '#10142a'); a.R(21, -4 + 4, 1, -0, '#fff'); a.R(20, -6 + 4, 1, 8, '#6a4a30'); a.R(21, -6 + 4, 6, 4, '#d8453f'); a.R(14, 46, 10, 10, '#2a1c18'); },
    mage(a, t) { a.R(14, 20, 24, 36, '#6a4ab0'); for (let y = 24; y < 56; y += 6) a.R(14, y, 24, 1, '#58399a'); a.R(8, 50, 36, 6, '#5a3a98'); a.T(26, -6, 8, 22, 44, 22, '#3a2478'); a.T(26, -6, 20, 6, 32, 6, SN); a.R(8, 20, 36, 3, '#2a1a68');
      a.R(23, 28, 6, 8, '#7fe0ff'); a.R(24, 29, 2, 6, '#dfffff'); a.R(23, 42, 6, 8, '#7fe0ff'); a.E(26, -12, 4, 4, '#ff7ae0'); a.P(25, -13, '#fff'); a.R(21, 52, 10, 4, '#2a1c18'); },
    temple(a, t) { a.R(6, 30, 44, 26, '#e8f0ff'); a.R(2, 52, 52, 4, '#b8c8e0'); a.R(4, 48, 48, 4, '#d0dcf0'); for (let i = 0; i < 5; i++) a.R(8 + i * 9, 32, 5, 18, '#ffffff'); a.R(4, 26, 48, 5, '#c8d8f0'); a.R(4, 24, 48, 2, SN);
      a.E(28, 20, 14, 12, '#7fc8ff'); a.R(12, 20, 32, 8, '#e8f0ff'); a.E(28, 18, 10, 8, '#a8e0ff'); a.T(28, -4, 25, 10, 31, 10, '#ffd24a'); a.R(27, 4, 2, 6, '#ffd24a'); a.E(28, 38, 3, 3, '#7fc8ff'); a.R(24, 40, 8, 12, '#4a6aa8'); },
  };
  BART.tavern = function (a, t) { a.R(6, 24, 40, 31, '#b07a4a'); for (let y = 28; y < 55; y += 4) a.R(6, y, 40, 1, '#8a5a3a'); a.T(26, 4, -2, 28, 54, 28, t >= 2 ? '#c8a02a' : '#a03a3a'); a.T(26, 10, 8, 26, 44, 26, t >= 2 ? '#a07818' : '#7a2a2a'); roofSnow(a, 12, 14, 28);
    a.R(36, 6, 6, 12, '#7a7f8c'); a.R(35, 4, 8, 2, SN); a.R(20, 38, 11, 17, '#3a2418'); a.R(28, 46, 1, 2, '#ffd24a'); a.R(9, 33, 8, 8, '#ffe14a'); a.R(9, 36, 8, 1, '#8a5a3a'); a.R(35, 33, 8, 8, '#ffe14a'); a.R(38, 33, 1, 8, '#8a5a3a');
    a.R(46, 26, 2, 3, '#6a4a30'); a.R(47, 26, 6, 1, '#6a4a30'); a.R(49, 28, 7, 8, '#c8a05a'); a.R(51, 30, 3, 4, '#ffd24a'); a.R(2, 44, 4, 11, '#6a4a30'); };
  function plot(a) { a.R(6, 46, 42, 8, '#8a7a6a'); a.R(6, 46, 42, 1, '#b0a090'); a.R(8, 38, 2, 10, '#a0703c'); a.R(44, 38, 2, 10, '#a0703c'); a.R(8, 36, 38, 2, '#a0703c'); a.L(10, 38, 44, 48, '#8a5a3a', 1); a.R(14, 50, 5, 3, '#6a5a4a'); a.R(34, 49, 6, 4, '#6a5a4a'); }
  function bld(id, t, built) { const ck = 'b' + id + t + (built ? 1 : 0); if (cache[ck]) return cache[ck]; const a = Art(70, 84, 1); const A2 = { R: (x, y, w, h, c) => a.R(x + 8, y + 18, w, h, c), E: (x, y, rx, ry, c) => a.E(x + 8, y + 18, rx, ry, c), T: (x1, y1, x2, y2, x3, y3, c) => a.T(x1 + 8, y1 + 18, x2 + 8, y2 + 18, x3 + 8, y3 + 18, c), L: (x1, y1, x2, y2, c, th) => a.L(x1 + 8, y1 + 18, x2 + 8, y2 + 18, c, th), P: (x, y, c) => a.P(x + 8, y + 18, c) }; (built ? BART[id] : plot)(A2, t); return (cache[ck] = finish(a)); }

  // ---------- сборка и кэш ----------
  const cache = {};
  function build(key, w, h, k, fn, o) { const a = Art(w, h, k); fn(a); return finish(a, o); }
  function hum(key, f, atk, art) {
    const ck = 'h' + key + f + (atk ? 1 : 0) + (art || ''); if (cache[ck]) return cache[ck];
    let o = HUMANS[key]; if (art && W.Core.Lore && W.Core.Lore.AID[art]) o = Object.assign({}, o, { art: W.Core.Lore.AID[art] });
    return (cache[ck] = build(ck, 36, 36, 1, (a) => human(a, o, f, atk)));
  }
  function mon(type, f, boss, dragonCol) {
    const ck = 'm' + type + f + (boss ? 'B' : '') + (dragonCol ? 'D' : ''); if (cache[ck]) return cache[ck];
    const k = boss ? 2 : 1; let o;
    if (type === 'dragon') o = build(ck, 32 * k, 32 * k, k, (a) => dragon(a, f, dragonCol));
    else o = build(ck, 32 * k, 32 * k, k, (a) => (MON[type] || MON.slime)(a, f));
    return (cache[ck] = o);
  }
  function allyDragon(f) { const ck = 'ad' + f; if (cache[ck]) return cache[ck]; return (cache[ck] = build(ck, 32, 32, 1, (a) => dragon(a, f, { body: '#7fe0ff', belly: '#ffffff', wing: '#3a8ad8', horn: '#ffffff' }), { flip: true })); }
  const DRAGON_FIRE = { body: '#c8452f', belly: '#ffb15c', wing: '#7a1f2b', horn: '#ffe14a' };

  // ---------- иконки (в 10x10) ----------
  const P = { K, Y: '#ffd24a', y: '#c8941e', W: '#ffffff', M: '#ff7ae0', m: '#b64fa0', C: '#7fe0ff', c: '#3aa5d0', G: '#9aa4b2', g: '#5a6472', B: '#3b78d8', b: '#2a4a9c', R: '#d8453f', r: '#8c2630', T: '#8a5a3a', O: '#ff9c2a', P: '#8a5bd0', Q: '#4ade80', L: '#dfe9f5' };
  const ICON = {
    coin: ['..KKKK..', '.KYYYYK.', 'KYWYYyyK', 'KYWYYyyK', 'KYYYYyyK', 'KYYYyyyK', '.KyyyyK.', '..KKKK..'],
    target: ['..KKKK..', '.KRRRRK.', 'KRWWWWRK', 'KRWRRWRK', 'KRWRRWRK', 'KRWWWWRK', '.KRRRRK.', '..KKKK..'],
    gem: ['..KKKK..', '.KWMMMK.', 'KMWMMMmK', 'KMMMMMmK', '.KMMMmK.', '..KMmK..', '...KK...', '........'],
    snow: ['...KK...', '.K.CC.K.', '..KCCK..', 'KCCCCCCK', 'KCCCCCCK', '..KCCK..', '.K.CC.K.', '...KK...'],
    sword: ['......KK', '.....KLK', '....KLK.', '...KLK..', 'K.KLK...', '.KYK....', '.KTYK...', 'KT.KK...'],
    shield: ['.KKKKKK.', 'KBBWWBBK', 'KBBWWBBK', 'KBBWWBBK', 'KBBWWBBK', '.KBBBBK.', '..KBBK..', '...KK...'],
    bag: ['..KKKK..', '.KTTTTK.', '..KTTK..', '.KTTTTK.', 'KTTYYTTK', 'KTTTTTTK', 'KTTTTTTK', '.KKKKKK.'],
    star: ['...KK...', '..KYYK..', 'KKKYYKKK', 'KYYYYYYK', '.KYYYYK.', '.KYYYYK.', '.KYKKYK.', '..K..K..'],
    shop: ['..KKKK..', '.KCWCCK.', 'KCWCCCcK', 'KCCCCCcK', 'KCCCCCcK', '.KCCCcK.', '..KCcK..', '...KK...'],
    crown: ['........', 'K..K..K.', 'KK.KK.KK', 'KYKYYKYK', 'KYYYYYYK', 'KYRYYRYK', 'KYYYYYYK', '.KKKKKK.'],
    trophy: ['KKKKKKKK', 'KYYYYYYK', 'KYWYYYYK', '.KYYYYK.', '..KYYK..', '...KK...', '..KYYK..', '.KKKKKK.'],
    gear: ['...KK...', '.K.GG.K.', '..GGGG..', 'KGGKKGGK', 'KGGKKGGK', '..GGGG..', '.K.GG.K.', '...KK...'],
    wood: ['........', '.KKKKKK.', 'KTtTTtTK', 'KTTkTTTK', 'KTTTTTTK', '.KKKKKK.', 'KTtTTtTK', '.KKKKKK.'],
    stone: ['........', '...KKK..', '..KGGLK.', '.KGGGGK.', 'KGGgGGGK', 'KGGGGgGK', 'KgGGGGgK', '.KKKKKK.'],
    iron: ['........', '........', '..KKKKKK', '.KLLLLLK', 'KLLCCCLK', 'KcCCCCcK', 'KccccccK', '.KKKKKK.'],
    house: ['...KK...', '..KRRK..', '.KRRRRK.', 'KRRRRRRK', '.KTTTTK.', '.KTYYTK.', '.KTTKTK.', '.KKKKKK.'],
    helm: ['..KKKK..', '.KGGGGK.', 'KGGLLGGK', 'KGGGGGGK', 'KGKKKKGK', 'KGKGGKGK', '.KGKKGK.', '..KKKK..'],
    map: ['KKKKKKKK', 'KLLRLLLK', 'KLRLLLLK', 'KLLLRRLK', 'KLRLLLRK', 'KLLLRLLK', 'KLLLLLLK', 'KKKKKKKK'],
    mug: ['........', 'KKKKKK..', 'KWWWWKKK', 'KYYYYK.K', 'KYYYYK.K', 'KYYYYKKK', '.KYYYK..', '..KKK...'],
    up: ['...KK...', '..KQQK..', '.KQQQQK.', 'KQQQQQQK', '..KQQK..', '..KQQK..', '..KQQK..', '..KKKK..'],
    star1: ['...KK...', '..KYYK..', 'KKKYYKKK', 'KYYYYYYK', '.KYYYYK.', '.KYYYYK.', '.KYKKYK.', '..K..K..'],
    blade: ['......KK', '.....KCK', '....KCK.', '...KCK..', 'K.KCK...', '.KYK....', '.KTYK...', 'KT.KK...'],
    scroll: ['.KKKKKK.', 'KLLLLLLK', 'KLKKKKLK', 'KLLLLLLK', 'KLKKKLLK', 'KLLLLLLK', 'KLKKLLLK', '.KKKKKK.'],
    bolt: ['....KK..', '...KYK..', '..KYK...', '.KYYYK..', '...KYK..', '..KYK...', '.KK.....', '........'],
    lock: ['..KKKK..', '.K....K.', '.K....K.', 'KKKKKKKK', 'KGGGGGGK', 'KGGKKGGK', 'KGGGGGGK', 'KKKKKKKK'],
    arrowU: ['...KK...', '..KLLK..', '.KLLLLK.', 'KKKLLKKK', '...KK...'],
    arrowD: ['...KK...', 'KKKLLKKK', '.KLLLLK.', '..KLLK..', '...KK...'],
    check: ['.......K', '......KQ', 'K....KQK', 'KQ..KQK.', '.KQKQK..', '..KQK...'],
    x: ['K......K', 'KR....RK', '.KR..RK.', '..KRRK..', '..KRRK..', '.KR..RK.', 'KR....RK', 'K......K'],
  };
  function humIcon(key) { // голова и плечи без масштабирования
    const ck = 'hi' + key; if (cache[ck]) return cache[ck]; const sp = hum(key, 0, false), cv = document.createElement('canvas'); cv.width = 19; cv.height = 19; const x = cv.getContext('2d');
    x.drawImage(sp, 9, 1, 19, 19, 0, 0, 19, 19); return (cache[ck] = cv);
  }
  const icons = {}; for (const k in ICON) icons[k] = fromMap(ICON[k], P);
  W.ART = { bld, humIcon, hum, mon, allyDragon, icons, HUMANS, DRAGON_FIRE, MON, ICON };
})(window);
