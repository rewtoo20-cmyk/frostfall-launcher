// FROSTFALL: AudioManager. Ретро-звуки и музыка синтезируются кодом (Web Audio API), без файлов.
// Буферы рендерятся один раз и лежат в пуле; три независимых регулятора громкости; смена музыки в боях с боссами.
(function (root) {
  'use strict';
  const FF = root.FF = root.FF || {};
  const TAU = Math.PI * 2;
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const env = (t, a, d) => Math.min(1, t / Math.max(1e-4, a)) * Math.exp(-t / Math.max(1e-4, d));
  const sq = (ph) => (ph % 1 < 0.5 ? 1 : -1), tri = (ph) => 4 * Math.abs((ph % 1) - 0.5) - 1, saw = (ph) => 2 * (ph % 1) - 1;
  // детерминированный шум, чтобы звуки совпадали при каждом запуске
  function noiseGen(seed) { let a = seed | 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1; }; }

  // ADSR-огибающая: a — нарастание, d — спад до уровня s, r — затухание в конце длительности dur
  const adsr = (t, dur, o) => { const a = o.a || 0.005, d = o.d || 0.05, sus = o.s == null ? 0.6 : o.s, r = o.r || 0.05; if (t < 0 || t > dur) return 0; if (t < a) return t / a; if (t < a + d) return 1 - (1 - sus) * (t - a) / d; if (t < dur - r) return sus; return sus * Math.max(0, (dur - t) / r); };
  // Нотная запись: 'C4:2 E4:1 R:1 G#4:2' (имя+октава:длина в долях, R — пауза) -> [{m: midi|null, len}]
  const NN = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function parseNotes(str) { const out = []; for (const tok of String(str).trim().split(/\s+/)) { if (!tok) continue; const [nm, ln] = tok.split(':'), len = Math.max(0.0625, parseFloat(ln) || 1); if (/^R$/i.test(nm)) { out.push({ m: null, len }); continue; } const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(nm); if (!m) continue; out.push({ m: 12 * (parseInt(m[3], 10) + 1) + NN[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0), len }); } return out; }
  // Секвенсор: нотная таблица -> функция сэмпла (t) для SFX; wave: sq | tri | saw
  function melody(str, bpm, wave, vol) { const notes = parseNotes(str), beat = 60 / (bpm || 120), W = wave === 'tri' ? tri : wave === 'saw' ? saw : sq; let t0 = 0; const seq = notes.map((q) => { const o = { m: q.m, t0, d: q.len * beat }; t0 += o.d; return o; }); const total = t0;
    return { dur: total + 0.05, fn: (t) => { for (const q of seq) if (t >= q.t0 && t < q.t0 + q.d && q.m != null) { const lt = t - q.t0; return W(midi(q.m) * t) * adsr(lt, q.d, { a: 0.004, d: 0.04, s: 0.55, r: 0.05 }) * (vol || 0.3); } return 0; } }; }
  // Описание звуков: dur (сек), fn(t, n) -> сэмпл; n() даёт шум
  // Прямоугольная волна (square) для 8-битных звуков: частота скользит от f0 к f1, скважность duty (0.125, 0.25, 0.5), ступенчатая громкость как у чипа NES
  const squareWave = (ph, duty) => ((ph % 1) < duty ? 1 : -1);
  const chip = (f0, f1, dur, duty, vol, steps) => ({ dur, fn: (t) => { const k = Math.min(1, t / dur), f = f0 + (f1 - f0) * k, ph = f0 * t + (f1 - f0) * t * t / (2 * dur), lv = steps ? Math.ceil((1 - k) * steps) / steps : 1 - k; return squareWave(ph, duty) * lv * (vol || 0.25) * Math.min(1, t / 0.002); } });
  const CHIP8 = { click: 'click8', hit: 'hit8', tick: 'click8', coin: 'coin8', gold: 'coin8' };
  const SFX = {
    jump8: chip(260, 760, 0.18, 0.5, 0.22, 8), click8: chip(1500, 1100, 0.05, 0.25, 0.2, 4), hit8: chip(220, 70, 0.14, 0.125, 0.3, 6), coin8: { dur: 0.22, fn: (t) => squareWave((t < 0.07 ? 988 : 1319) * t, 0.5) * 0.2 * Math.max(0, 1 - t / 0.22) },
    click:   { dur: 0.04, fn: (t, n) => n() * env(t, 0.001, 0.008) * 0.5 + Math.sin(TAU * 1200 * t) * env(t, 0.001, 0.01) * 0.3 },
    hit:     { dur: 0.14, fn: (t, n) => (n() * env(t, 0.001, 0.025) * 0.55 + Math.sin(TAU * (60 + 140 * Math.exp(-t * 30)) * t) * env(t, 0.002, 0.07) * 0.8) },
    crit:    { drive: 2.6, dur: 0.22, fn: (t, n) => (n() * env(t, 0.001, 0.03) * 0.5 + Math.sin(TAU * (50 + 190 * Math.exp(-t * 28)) * t) * env(t, 0.002, 0.08) * 0.8 + sq(900 * t) * env(t, 0.002, 0.07) * 0.22) },
    coin:    { dur: 0.2,  fn: (t) => (t < 0.06 ? sq(988 * t) : sq(1319 * t)) * env(t % 0.06, 0.001, 0.05) * 0.35 * (t < 0.2 ? 1 : 0) },
    level:   { dur: 0.7,  fn: (t) => { const k = Math.min(3, Math.floor(t / 0.11)), f = midi([72, 76, 79, 84][k]), lt = t - k * 0.11; return tri(f * t) * env(lt, 0.004, k === 3 ? 0.25 : 0.07) * 0.5; } },
    quest:   { dur: 0.5,  fn: (t) => { const k = Math.min(2, Math.floor(t / 0.13)), f = midi([67, 72, 76][k]), lt = t - k * 0.13; return (sq(f * t) * 0.18 + tri(f * 2 * t) * 0.15) * env(lt, 0.004, k === 2 ? 0.2 : 0.06); } },
    skill:   { dur: 0.32, fn: (t, n) => Math.sin(TAU * (300 + 1100 * t / 0.32) * t) * env(t, 0.01, 0.14) * 0.55 + n() * env(t, 0.01, 0.06) * 0.12 },
    fail:    { dur: 0.45, fn: (t) => saw((220 - 130 * t / 0.45) * t) * env(t, 0.004, 0.2) * 0.45 },
    ok:      { dur: 0.45, fn: (t, n) => { const k = Math.min(3, Math.floor(t / 0.07)), f = midi([76, 79, 83, 88][k]), lt = t - k * 0.07; return tri(f * t) * env(lt, 0.003, 0.12) * 0.45 + n() * env(t, 0.002, 0.02) * 0.08; } },
    crunch:  { dur: 0.4,  fn: (t, n) => n() * env(t, 0.001, 0.09) * 0.7 + Math.sin(TAU * 70 * t) * env(t, 0.002, 0.12) * 0.6 },
    boom:    { dur: 0.8,  fn: (t, n) => { const lp = n() * env(t, 0.002, 0.22) * 0.6; return lp + Math.sin(TAU * (45 + 80 * Math.exp(-t * 7)) * t) * env(t, 0.004, 0.3) * 0.9; } },
    event:   { dur: 0.45, fn: (t) => { const k = Math.min(2, Math.floor(t / 0.1)), f = midi([84, 88, 91][k]), lt = t - k * 0.1; return Math.sin(TAU * f * t) * env(lt, 0.002, 0.14) * 0.4; } },
    warn:    { dur: 0.4,  fn: (t) => sq((t < 0.2 ? 440 : 330) * t) * env(t % 0.2, 0.004, 0.12) * 0.3 },
    equip:   { dur: 0.12, fn: (t, n) => n() * env(t, 0.001, 0.02) * 0.4 + sq(300 * t) * env(t, 0.001, 0.04) * 0.25 },
    chest:   { dur: 0.7,  fn: (t, n) => { let v = saw((130 - 40 * t) * t) * env(t, 0.01, 0.12) * 0.35 * (t < 0.3 ? 1 : 0); if (t > 0.28) { const k = Math.min(3, Math.floor((t - 0.28) / 0.08)), f = midi([84, 88, 91, 96][k]), lt = t - 0.28 - k * 0.08; v += sq(f * t) * env(lt, 0.002, 0.09) * 0.28; } return v + n() * env(t, 0.001, 0.02) * 0.2; } },
    potion:  { dur: 0.55, fn: (t) => { let v = 0; for (let k = 0; k < 3; k++) { const lt = t - k * 0.16; if (lt > 0 && lt < 0.14) v += Math.sin(TAU * (260 + 520 * (lt / 0.14)) * t) * Math.sin(Math.PI * lt / 0.14) * 0.4; } return v + Math.sin(TAU * (900 + 300 * Math.sin(t * 40)) * t) * env(t - 0.45, 0.002, 0.04) * (t > 0.45 ? 0.2 : 0); } },
    swing:   { dur: 0.26, fn: (t, n) => (n() * 0.45 + Math.sin(TAU * (700 - 450 * t / 0.26) * t) * 0.25) * Math.sin(Math.PI * Math.min(1, t / 0.26)) * 0.8 },
    wall:    { dur: 0.95, fn: (t, n) => Math.sin(TAU * (60 - 25 * t) * t) * env(t, 0.003, 0.25) * 0.8 + n() * env(t, 0.002, 0.12) * 0.6 + (Math.sin(Math.floor(t * 40) * 12.9898) > 0.8 ? n() * env(t % 0.025, 0.0005, 0.01) * 0.5 : 0) * (t > 0.1 ? 1 : 0) },
    siren:   { dur: 1.8,  fn: (t) => { const f = 520 + 220 * Math.sin(TAU * t / 0.9 - Math.PI / 2); return saw(f * t) * 0.28 * Math.min(1, t / 0.05) * Math.min(1, (1.8 - t) / 0.08); } },
    block:   { dur: 0.2,  fn: (t, n) => (Math.sin(TAU * 1240 * t) * 0.35 + Math.sin(TAU * 1830 * t) * 0.22 + Math.sin(TAU * 2670 * t) * 0.12) * env(t, 0.0008, 0.05) + n() * env(t, 0.0005, 0.006) * 0.5 },
    tick:    { dur: 0.035, fn: (t) => tri(1100 * t) * env(t, 0.001, 0.012) * 0.5 },
    scroll:  { dur: 0.025, fn: (t) => sq(1900 * t) * env(t, 0.0005, 0.006) * 0.22 },
    deny:    { dur: 0.22, fn: (t) => saw((t < 0.1 ? 210 : 150) * t) * 0.3 * adsr(t % 0.11, 0.1, { a: 0.004, d: 0.03, s: 0.6, r: 0.03 }) },
    step_snow:  { dur: 0.1,  fn: (t, n) => n() * env(t, 0.002, 0.03) * 0.35 + Math.sin(TAU * 90 * t) * env(t, 0.002, 0.03) * 0.15 },
    step_stone: { dur: 0.08, fn: (t, n) => Math.sin(TAU * (190 - 80 * t / 0.08) * t) * env(t, 0.001, 0.02) * 0.5 + n() * env(t, 0.0005, 0.008) * 0.3 },
    step_metal: { dur: 0.14, fn: (t, n) => (Math.sin(TAU * 820 * t) * 0.25 + Math.sin(TAU * 1330 * t) * 0.15) * env(t, 0.0008, 0.05) + n() * env(t, 0.0005, 0.01) * 0.3 },
    fire:    { dur: 1.2,  fn: (t, n) => n() * 0.05 + (Math.sin(Math.floor(t * 260) * 12.9898) > 0.93 ? n() * env(t % (1 / 260), 0.0004, 0.005) * 0.7 : 0) },
    forge:   { dur: 0.6,  fn: (t, n) => (Math.sin(TAU * 700 * t) * 0.3 + Math.sin(TAU * 1100 * t) * 0.2 + Math.sin(TAU * 1650 * t) * 0.12) * env(t, 0.0008, 0.16) + n() * env(t, 0.0005, 0.01) * 0.4 + (t > 0.18 ? sq(midi(91 + (t > 0.3 ? 5 : 0)) * t) * env((t - 0.18) % 0.12, 0.002, 0.07) * 0.14 : 0) },
    magic:   { dur: 0.5,  fn: (t) => { const f = 380 * Math.pow(3.2, t / 0.5) * (1 + 0.02 * Math.sin(TAU * 18 * t)); return (Math.sin(TAU * f * t) * 0.35 + Math.sin(TAU * f * 2 * t) * 0.12) * Math.sin(Math.PI * Math.min(1, t / 0.5)) ** 0.5; } },
    win:     melody('C5:1 E5:1 G5:1 C6:2', 150, 'sq', 0.28),
    lose:    melody('G4:1 E4:1 C4:1 G3:2', 100, 'saw', 0.26),
  };

  // Музыка: короткие петли, рендерятся в буфер (8 тактов). Нота = полутон от C4=60, 0 = пауза.
  const TRACKS = {
    calm: { bpm: 78, bars: 8, bass: [45, 45, 41, 41, 43, 43, 40, 40], arp: [[69, 72, 76, 72], [69, 72, 77, 72], [65, 69, 72, 69], [65, 69, 72, 77], [67, 71, 74, 71], [67, 71, 74, 79], [64, 68, 71, 68], [64, 68, 71, 76]], kick: false },
    trek: { bpm: 96, bars: 8, bass: [43, 43, 40, 40, 38, 38, 40, 41], arp: [[67, 70, 74, 70], [67, 70, 74, 79], [64, 67, 71, 67], [64, 67, 71, 76], [62, 65, 69, 65], [62, 65, 69, 74], [64, 67, 71, 67], [65, 69, 72, 77]], kick: false },
    alarm: { bpm: 168, bars: 8, bass: [40, 40, 40, 40, 43, 43, 41, 41], arp: [[64, 67, 71, 76], [64, 67, 71, 76], [64, 67, 71, 76], [63, 67, 70, 75], [67, 71, 74, 79], [67, 71, 74, 79], [65, 69, 72, 77], [64, 68, 71, 76]], kick: true },
    boss: { bpm: 142, bars: 8, bass: [38, 38, 38, 36, 38, 38, 41, 40], arp: [[62, 65, 69, 74], [62, 65, 69, 74], [62, 65, 69, 74], [60, 64, 67, 72], [62, 65, 69, 74], [62, 65, 69, 77], [65, 69, 72, 77], [64, 68, 71, 76]], kick: true },
  };

  // Чистая функция рендера (можно вызывать в Node для тестов): возвращает Float32Array
  function renderSfx(name, sr) {
    const d = SFX[name]; if (!d) return null; const n = noiseGen(name.length * 7919), len = Math.max(1, Math.floor(d.dur * sr)), out = new Float32Array(len);
    for (let i = 0; i < len; i++) { let v = d.fn(i / sr, n); if (d.drive) v = Math.tanh(v * d.drive) / Math.tanh(d.drive); const fade = Math.min(1, (len - i) / (sr * 0.004)); v *= fade; out[i] = v > 1 ? 1 : v < -1 ? -1 : v; }
    return out;
  }
  function renderTrack(name, sr) {
    const T = TRACKS[name]; if (!T) return null; const beat = 60 / T.bpm, bar = beat * 4, len = Math.floor(T.bars * bar * sr), out = new Float32Array(len), n = noiseGen(31);
    for (let b = 0; b < T.bars; b++) {
      const t0 = b * bar, bs = midi(T.bass[b]);
      for (let i = 0, e = Math.floor(bar * sr); i < e; i++) {
        const idx = Math.floor(t0 * sr) + i; if (idx >= len) break; const t = i / sr, bt = t % beat, step = Math.floor(t / (beat / 2)) % 8;
        let v = tri(bs * t) * 0.32 * env(bt, 0.01, beat * 0.7);                       // бас на каждую долю
        const an = T.arp[b][step % 4], at = t % (beat / 2); v += sq(midi(an) * t) * 0.07 * env(at, 0.004, beat * 0.28); // арпеджио восьмыми
        if (T.kick) { const kt = t % beat; v += Math.sin(TAU * (50 + 90 * Math.exp(-kt * 30)) * kt) * env(kt, 0.001, 0.09) * 0.55; if (Math.floor(t / beat) % 2 === 1) { const st = t % beat; v += n() * env(st, 0.001, 0.05) * 0.12; } }
        out[idx] += v;
      }
    }
    for (let i = 0; i < len; i++) { const v = out[i] * 0.9; out[i] = v > 1 ? 1 : v < -1 ? -1 : v; }
    return out;
  }

  // Ветер заснеженного биома: фильтрованный шум (одно-полюсный ФНЧ) с медленным изменением частоты среза, петля без шва
  function renderAmbient(sr, sec) {
    sec = sec || 6; const len = Math.floor(sr * sec), out = new Float32Array(len), n = noiseGen(1234); let y = 0, y2 = 0;
    for (let i = 0; i < len; i++) { const t = i / sr, lfo = 0.5 + 0.5 * Math.sin(TAU * t / sec * 1), lfo2 = 0.5 + 0.5 * Math.sin(TAU * t / sec * 3), a = 0.012 + 0.05 * lfo, x = n(); y += a * (x - y); y2 += 0.18 * (y - y2); out[i] = (y2 * 5.2 * (0.35 + 0.65 * lfo) + Math.sin(TAU * (700 + 120 * lfo2) * t) * 0.006 * lfo2) * 0.9; }
    for (let i = 0; i < Math.min(len >> 3, 2000); i++) { const k = i / Math.min(len >> 3, 2000); out[i] = out[i] * k + out[len - 1 - i] * (1 - k) * 0; } // мягкий вход
    let pk = 0; for (let i = 0; i < len; i++) pk = Math.max(pk, Math.abs(out[i])); const k = pk > 0 ? 0.5 / pk : 1; for (let i = 0; i < len; i++) out[i] *= k; // нормализация, без клиппинга
    return out;
  }
  class AudioManager {
    constructor() {
      this.ctx = null; this.buses = {}; this.vol = { master: 0.7, music: 0.35, sfx: 0.8, ui: 0.6 }; this.enabled = true;
      this.buffers = new Map(); this.last = new Map(); this.voices = 0; this.maxVoices = 24; this.musicNodes = {}; this.cur = null; this.hiddenFade = false;
      this._load();
    }
    _load() { try { const s = FF.lsGet && FF.lsGet('ff.audio'); if (s) { const o = JSON.parse(s); for (const k of ['master', 'music', 'sfx', 'ui']) if (Number.isFinite(o[k])) this.vol[k] = Math.max(0, Math.min(1, o[k])); if (typeof o.enabled === 'boolean') this.enabled = o.enabled; } } catch (e) { /* ignore */ } }
    _save() { if (FF.lsSet) FF.lsSet('ff.audio', JSON.stringify(Object.assign({ enabled: this.enabled }, this.vol))); }
    get supported() { return typeof (root.AudioContext || root.webkitAudioContext) !== 'undefined'; }
    // Контекст создаётся только после жеста пользователя (политика браузеров)
    init() {
      if (this.ctx || !this.supported) return !!this.ctx;
      try {
        const AC = root.AudioContext || root.webkitAudioContext; this.ctx = new AC();
        const master = this.ctx.createGain(), comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 24; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.2; master.connect(comp); comp.connect(this.ctx.destination); this.buses.master = master; this.comp = comp;
        for (const k of ['music', 'sfx', 'ui']) { const g = this.ctx.createGain(); g.connect(master); this.buses[k] = g; }
        this._apply(); if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { if (FF.Log) FF.Log.warn('audio', 'нет аудио', e); this.ctx = null; return false; }
      return true;
    }
    _apply() { if (!this.ctx) return; const t = this.ctx.currentTime; for (const k of ['master', 'music', 'sfx', 'ui']) this.buses[k].gain.setTargetAtTime(this.enabled ? this.vol[k] : 0, t, 0.03); }
    setVolume(bus, v) { if (!(bus in this.vol)) return; this.vol[bus] = Math.max(0, Math.min(1, +v || 0)); this._apply(); this._save(); }
    setEnabled(on) { this.enabled = !!on; this._apply(); this._save(); }
    // Пул буферов: звук рендерится при первом обращении, дальше берётся из Map
    buf(name) {
      let b = this.buffers.get(name); if (b) return b; if (!this.ctx) return null;
      const data = SFX[name] ? renderSfx(name, this.ctx.sampleRate) : null; if (!data) return null;
      b = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate); b.getChannelData(0).set(data); this.buffers.set(name, b); return b;
    }
    warm() { if (!this.ctx) return 0; let n = 0; for (const k in SFX) if (this.buf(k)) n++; return n; }
    play(name, o) {
      if (this.chip8 && CHIP8[name]) name = CHIP8[name];
      if (!this.enabled || !this.ctx || this.voices >= this.maxVoices) return false; o = o || {};
      const t = this.ctx.currentTime, lastT = this.last.get(name) || -1, gap = o.gap == null ? 0.045 : o.gap; if (t - lastT < gap) return false; // не спамим одним и тем же звуком
      const b = this.buf(name); if (!b) return false; this.last.set(name, t);
      const src = this.ctx.createBufferSource(), g = this.ctx.createGain(); src.buffer = b; src.playbackRate.value = (o.rate || 1) * (1 + (Math.random() - 0.5) * 0.06); g.gain.value = o.vol == null ? 1 : o.vol;
      src.connect(g); g.connect(this.buses[o.bus || 'sfx']); this.voices++; src.onended = () => { this.voices--; src.disconnect(); g.disconnect(); }; src.start(); return true;
    }
    // Музыка: две петли с плавным перекрёстным затуханием; calm для обычного боя, boss для боссов
    music(name) {
      if (!this.ctx || name === this.cur) return; if (!TRACKS[name] && name) return; const t = this.ctx.currentTime;
      for (const k in this.musicNodes) { const m = this.musicNodes[k]; m.gain.gain.setTargetAtTime(k === name ? 1 : 0, t, 0.5); }
      if (name && !this.musicNodes[name]) {
        const MSR = 22050, data = renderTrack(name, MSR), b = this.ctx.createBuffer(1, data.length, MSR); b.getChannelData(0).set(data); // музыка в 22 кГц: вдвое дешевле рендер
        const src = this.ctx.createBufferSource(), g = this.ctx.createGain(); src.buffer = b; src.loop = true; g.gain.value = 0; src.connect(g); g.connect(this.buses.music); src.start(); g.gain.setTargetAtTime(1, t, 0.5); this.musicNodes[name] = { src, gain: g };
      }
      this.cur = name || null;
    }
    // Темп музыки (бой с боссом ускоряет): playbackRate всех петель
    setTempo(k) { if (!this.ctx) return; k = Math.max(0.5, Math.min(2, k || 1)); const t = this.ctx.currentTime; for (const n in this.musicNodes) this.musicNodes[n].src.playbackRate.setTargetAtTime(k, t, 0.4); this.tempo = k; }
    // Разблокировка по жесту (клик, клавиша, касание): создаём или возобновляем контекст
    unlock() { if (!this.ctx) return this.init(); if (this.ctx.state === 'suspended' && !this.hiddenFade) this.ctx.resume(); return true; }
    // Ветер: отдельная петля на шине музыки
    ambient(on, name) {
      if (!this.ctx) return; const t = this.ctx.currentTime;
      if (on && !this.amb) { const sr = 22050, d = renderAmbient(sr, 6), b = this.ctx.createBuffer(1, d.length, sr); b.getChannelData(0).set(d); const src = this.ctx.createBufferSource(), g = this.ctx.createGain(); src.buffer = b; src.loop = true; g.gain.value = 0; src.connect(g); g.connect(this.buses.music); src.start(); g.gain.setTargetAtTime(0.6, t, 1.2); this.amb = { src, g }; }
      else if (!on && this.amb) { const a = this.amb; this.amb = null; a.g.gain.setTargetAtTime(0, t, 0.5); setTimeout(() => { try { a.src.stop(); a.src.disconnect(); a.g.disconnect(); } catch (e) { /* уже остановлен */ } }, 2500); }
    }
    // Шаги по материалу поверхности: snow | stone | metal
    step(mat, vol) { return this.play('step_' + (SFX['step_' + mat] ? mat : 'snow'), { vol: vol == null ? 0.5 : vol, gap: 0.08, bus: 'sfx' }); }
    ui(name) { return this.play(name || 'tick', { bus: 'ui', gap: 0.03, vol: 0.8 }); }
    // Плавное нарастание/затухание всей музыки (сек)
    fadeMusic(to, sec) { if (!this.ctx) return; this.buses.music.gain.setTargetAtTime(this.enabled ? this.vol.music * to : 0, this.ctx.currentTime, Math.max(0.05, (sec || 1) / 3)); }
    stats() { return { voices: this.voices, buffers: this.buffers.size, music: Object.keys(this.musicNodes).length, amb: !!this.amb, state: this.ctx ? this.ctx.state : 'none' }; }
    // Плавно заглушить при сворачивании вкладки и вернуть
    setHidden(h) { if (!this.ctx) return; const t = this.ctx.currentTime; this.buses.master.gain.setTargetAtTime(h || !this.enabled ? 0 : this.vol.master, t, 0.15); if (h) { if (this.ctx.state === 'running') setTimeout(() => { if (this.hiddenFade && this.ctx) this.ctx.suspend(); }, 600); this.hiddenFade = true; } else { this.hiddenFade = false; if (this.ctx.state === 'suspended') this.ctx.resume(); } }
  }

  FF.AudioManager = AudioManager; FF.AudioSynth = { squareWave, chip, SFX, TRACKS, renderSfx, renderTrack, renderAmbient, parseNotes, melody, adsr };
  FF.audio = FF.audio || new AudioManager();
  if (typeof module !== 'undefined' && module.exports) module.exports = FF;
})(typeof window !== 'undefined' ? window : globalThis);
