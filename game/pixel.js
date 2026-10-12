// Пиксельная библиотека: шрифт, рисование спрайтов из кода, панели, иконки.
(function (W) {
  'use strict';
  const F = W.PXFONT, gcache = {};
  const hex = (c) => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgb = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const shade = (c, d) => { const a = hex(c); return rgb([a[0] + d, a[1] + d, a[2] + d]); };
  const mix = (c1, c2, t) => { const a = hex(c1), b = hex(c2); return rgb([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); };

  // ---------- текст ----------
  function glyph(ch, col) {
    const k = ch + col; if (gcache[k]) return gcache[k];
    const g = F.g[ch] || F.g['?'], cv = document.createElement('canvas'); cv.width = g[0]; cv.height = F.h; const x = cv.getContext('2d'); x.fillStyle = col;
    for (let y = 0; y < F.h; y++) { const r = g[1][y]; for (let i = 0; i < g[0]; i++) if (r >> i & 1) x.fillRect(i, y, 1, 1); }
    return (gcache[k] = cv);
  }
  const tw = (s) => { let n = 0; for (const ch of String(s)) n += (F.g[ch] || F.g['?'])[0]; return n; };
  function text(c, s, x, y, col, o) {
    o = o || {}; s = String(s); const w = tw(s); x = Math.round(x); y = Math.round(y);
    if (o.align === 'c') x -= Math.round(w / 2); else if (o.align === 'r') x -= w;
    const sh = o.sh === undefined ? '#0a0f1e' : o.sh;
    for (let pass = sh ? 0 : 1; pass < 2; pass++) {
      let px = x + (pass ? 0 : 1); const py = y + (pass ? 0 : 1), cc = pass ? col : sh;
      for (const ch of s) { const g = F.g[ch] || F.g['?']; if (ch !== ' ') c.drawImage(glyph(ch, cc), px, py); px += g[0]; }
    }
    return w;
  }
  function fit(s, maxW) { s = String(s); if (tw(s) <= maxW) return s; while (s.length > 1 && tw(s + '…') > maxW) s = s.slice(0, -1); return s + '…'; }

  // ---------- рисование спрайтов по пикселям ----------
  function Art(w, h, k) {
    const px = new Array(w * h).fill(null); k = k || 1;
    const P = (x, y, c) => { x = Math.floor(x); y = Math.floor(y); if (c && x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = c; };
    const a = {
      w, h, px, k,
      P: (x, y, c) => { P(x * k, y * k, c); if (k > 1.4) P(x * k + 1, y * k, c); },
      R(x, y, ww, hh, c) { const x0 = Math.round(x * k), y0 = Math.round(y * k), x1 = Math.max(x0 + 1, Math.round((x + ww) * k)), y1 = Math.max(y0 + 1, Math.round((y + hh) * k)); for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) P(i, j, c); },
      E(cx, cy, rx, ry, c) { cx *= k; cy *= k; rx *= k; ry *= k; for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++) for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) { const dx = (i + 0.5 - cx) / rx, dy = (j + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) P(i, j, c); } },
      T(x1, y1, x2, y2, x3, y3, c) { x1 *= k; y1 *= k; x2 *= k; y2 *= k; x3 *= k; y3 *= k; const mnx = Math.floor(Math.min(x1, x2, x3)), mxx = Math.ceil(Math.max(x1, x2, x3)), mny = Math.floor(Math.min(y1, y2, y3)), mxy = Math.ceil(Math.max(y1, y2, y3)); const s = (ax, ay, bx, by, cx, cy) => (ax - cx) * (by - cy) - (bx - cx) * (ay - cy); for (let j = mny; j <= mxy; j++) for (let i = mnx; i <= mxx; i++) { const x = i + 0.5, y = j + 0.5, d1 = s(x, y, x1, y1, x2, y2), d2 = s(x, y, x2, y2, x3, y3), d3 = s(x, y, x3, y3, x1, y1); if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) P(i, j, c); } },
      L(x1, y1, x2, y2, c, th) { x1 *= k; y1 *= k; x2 *= k; y2 *= k; th = Math.max(1, Math.round((th || 1) * k)); const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1); for (let i = 0; i <= n; i++) { const x = x1 + (x2 - x1) * i / n, y = y1 + (y2 - y1) * i / n; for (let a2 = 0; a2 < th; a2++) for (let b = 0; b < th; b++) P(x + a2 - (th >> 1), y + b - (th >> 1), c); } },
    };
    return a;
  }
  // освещение (свет сверху-слева) + контур
  function finish(a, o) {
    o = o || {}; const w = a.w, h = a.h, W2 = w + 2, H2 = h + 2, out = document.createElement('canvas'); out.width = W2; out.height = H2;
    const ctx = out.getContext('2d'), im = ctx.createImageData(W2, H2), at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : a.px[y * w + x]);
    const ol = hex(o.outline || '#141a2e');
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      let col = at(x, y), rgbv = null;
      if (col) {
        let d = 0; if (!at(x, y - 1)) d += 34; else if (!at(x - 1, y) && at(x + 1, y)) d += 14;
        if (!at(x, y + 1)) d -= 36; else if (!at(x + 1, y) && at(x - 1, y)) d -= 22;
        if (o.noshade) d = 0; rgbv = hex(shade(col, d));
      } else if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) rgbv = ol;
      if (rgbv) { const tx = o.flip ? W2 - 1 - (x + 1) : x + 1, i = ((y + 1) * W2 + tx) * 4; im.data[i] = rgbv[0]; im.data[i + 1] = rgbv[1]; im.data[i + 2] = rgbv[2]; im.data[i + 3] = 255; }
    }
    ctx.putImageData(im, 0, 0); return out;
  }
  // из строковых карт (иконки)
  function fromMap(rows, pal) {
    const h = rows.length, w = rows[0].length, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d');
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const ch = rows[j][i]; if (ch !== '.' && pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(i, j, 1, 1); } }
    return cv;
  }

  // ---------- панели ----------
  const COL = { bg: '#1b2540', bg2: '#243459', edge: '#0c1224', hi: '#5a7cc0', lo: '#131c36', tx: '#eaf3ff', mut: '#b4c6e2', gold: '#ffd24a', gem: '#ff7ae0', ok: '#5fe08a', bad: '#ff6b6b', ac: '#5bc0ff' };
  function panel(c, x, y, w, h, o) {
    o = o || {}; const f = o.fill || COL.bg;
    c.fillStyle = COL.edge; c.fillRect(x + 1, y, w - 2, h); c.fillRect(x, y + 1, w, h - 2);
    c.fillStyle = f; c.fillRect(x + 1, y + 1, w - 2, h - 2);
    c.fillStyle = o.hi || COL.hi; c.fillRect(x + 2, y + 1, w - 4, 1); c.fillRect(x + 1, y + 2, 1, h - 4);
    c.fillStyle = o.lo || COL.lo; c.fillRect(x + 2, y + h - 2, w - 4, 1); c.fillRect(x + w - 2, y + 2, 1, h - 4);
  }
  function bar(c, x, y, w, h, p, col, back) {
    c.fillStyle = COL.edge; c.fillRect(x, y, w, h); c.fillStyle = back || '#2a1a24'; c.fillRect(x + 1, y + 1, w - 2, h - 2);
    const iw = Math.round((w - 2) * Math.max(0, Math.min(1, p))); if (iw > 0) { c.fillStyle = col; c.fillRect(x + 1, y + 1, iw, h - 2); c.fillStyle = shade(col, 50); c.fillRect(x + 1, y + 1, iw, 1); }
  }
  W.PX = { text, tw, fit, Art, finish, fromMap, panel, bar, COL, hex, rgb, shade, mix };
})(window);
