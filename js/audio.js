'use strict';
// KOSO sound: everything is synthesized in WebAudio, nothing is downloaded.
const AU = (() => {
  let ctx = null, master, sfx, mus, comp, noise, crowd = null, musicOn = false, nextStep = 0, step = 0, timer = null;
  let muted = false;
  try { muted = localStorage.getItem('koso:muted') === '1'; } catch (e) {}
  const musLevel = { base: 0.32, duck: 0.12 };
  let musTarget = musLevel.base;

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.18;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    sfx = ctx.createGain(); sfx.gain.value = 0.9;
    mus = ctx.createGain(); mus.gain.value = musTarget;
    sfx.connect(comp); mus.connect(comp); comp.connect(master); master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    startCrowd();
    return true;
  }
  function unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }
  const now = () => ctx.currentTime;

  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function nsrc(t, dur, rate = 1) {
    const s = ctx.createBufferSource(); s.buffer = noise; s.playbackRate.value = rate;
    s.start(t, Math.random() * 1.5, dur + 0.05); return s;
  }
  function tone(type, f0, f1, t, a, peak, dec, out = sfx) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + dec);
    env(g, t, a, peak, dec); o.connect(g); g.connect(out);
    o.start(t); o.stop(t + a + dec + 0.05);
  }
  function burst(type, f, q, t, a, peak, dec, out = sfx, rate = 1) {
    const s = nsrc(t, a + dec, rate), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    env(g, t, a, peak, dec); s.connect(fl); fl.connect(g); g.connect(out);
  }

  // ---------- one-shot effects ----------
  const fx = {
    clack(i) { // wood on wood, i = 0..1
      if (!ctx) return; const t = now(); i = Math.max(0.15, Math.min(1, i));
      burst('bandpass', 2200 + Math.random() * 900, 3, t, 0.001, 0.55 * i, 0.05);
      tone('triangle', 520 + Math.random() * 120, 300, t, 0.001, 0.4 * i, 0.09);
      tone('sine', 1500 + Math.random() * 300, 1100, t, 0.001, 0.15 * i, 0.04);
      if (i > 0.6) burst('lowpass', 500, 1, t, 0.002, 0.5 * i, 0.16);
    },
    tick(i = 0.3, at) { // small contact
      if (!ctx) return; const t = at || now();
      burst('bandpass', 3200, 5, t, 0.001, 0.25 * i, 0.03);
    },
    gbam() {
      if (!ctx) return; const t = now();
      burst('bandpass', 900, 0.8, t, 0.01, 0.25, 0.22, sfx, 0.7);
      tone('sine', 160, 55, t, 0.004, 0.55, 0.2);
    },
    whoosh(i = 1) {
      if (!ctx) return; const t = now();
      const s = nsrc(t, 0.5), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(500, t);
      f.frequency.exponentialRampToValueAtTime(2600, t + 0.3);
      env(g, t, 0.08, 0.32 * i, 0.32); s.connect(f); f.connect(g); g.connect(sfx);
    },
    zip(i = 1) { // string pull ratchet
      if (!ctx) return; const t = now();
      for (let k = 0; k < 4; k++) burst('highpass', 3000, 0.7, t + k * 0.022, 0.001, 0.12 * i, 0.018);
    },
    thunk(i = 1) {
      if (!ctx) return; const t = now();
      tone('sine', 120, 45, t, 0.003, 0.6 * i, 0.18);
      burst('lowpass', 900, 0.7, t, 0.002, 0.35 * i, 0.14);
    },
    perfect() {
      if (!ctx) return; const t = now();
      [1046, 1318, 1568, 2093].forEach((f, k) => tone('triangle', f, f, t + k * 0.05, 0.004, 0.13, 0.22));
    },
    click() { if (!ctx) return; const t = now(); tone('square', 900, 600, t, 0.001, 0.08, 0.05); },
    cap() {
      if (!ctx) return; const t = now();
      tone('sine', 3100 + Math.random() * 800, 2400, t, 0.001, 0.12, 0.08);
      tone('sine', 4700 + Math.random() * 600, 4200, t, 0.001, 0.06, 0.06);
    },
    cluck() {
      if (!ctx) return; const t = now();
      for (let k = 0; k < 2; k++) tone('square', 620 + k * 90, 820, t + k * 0.09, 0.005, 0.05, 0.06);
    },
    squawk() {
      if (!ctx) return; const t = now();
      for (let k = 0; k < 4; k++) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 2;
        const tt = t + k * 0.11;
        o.frequency.setValueAtTime(700, tt); o.frequency.linearRampToValueAtTime(1250, tt + 0.04);
        o.frequency.linearRampToValueAtTime(800, tt + 0.1);
        env(g, tt, 0.006, 0.16, 0.1); o.connect(f); f.connect(g); g.connect(sfx); o.start(tt); o.stop(tt + 0.14);
      }
    },
    broom(dur = 1.3) {
      if (!ctx) return; const t = now();
      const s = nsrc(t, dur), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'highpass'; f.frequency.value = 2400;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22, t + dur * 0.4);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(sfx);
    },
    warn() {
      if (!ctx) return; const t = now();
      tone('square', 520, 520, t, 0.005, 0.07, 0.12); tone('square', 390, 390, t + 0.16, 0.005, 0.07, 0.16);
    },
    fall() {
      if (!ctx) return; const t = now();
      for (let k = 0; k < 5; k++) fx.tick(0.9 - k * 0.15, t + k * 0.07);
      [0, 0.09, 0.2, 0.34].forEach((d, k) => tone('triangle', 420 - k * 40, 300, t + d, 0.001, 0.25 / (k + 1), 0.07));
      tone('sine', 300, 70, t, 0.01, 0.2, 0.5);
    },
    out() {
      if (!ctx) return; const t = now();
      tone('sawtooth', 600, 120, t, 0.01, 0.12, 0.45);
    },
    win() {
      if (!ctx) return; const t = now();
      [784, 988, 1175, 1568].forEach((f, k) => { tone('triangle', f, f, t + k * 0.09, 0.005, 0.16, 0.3); tone('sine', f * 2, f * 2, t + k * 0.09, 0.005, 0.04, 0.2); });
      ooh(1, 0.15);
    },
    lose() {
      if (!ctx) return; const t = now();
      [523, 466, 392, 330].forEach((f, k) => tone('triangle', f, f * 0.97, t + k * 0.13, 0.005, 0.13, 0.28));
    },
    sting() { // round start
      if (!ctx) return; const t = now();
      tone('sine', 220, 110, t, 0.004, 0.3, 0.25); burst('bandpass', 3000, 2, t, 0.002, 0.2, 0.08);
    },
  };

  // kids' "ooooh" / "ehn!": a few detuned formant voices
  function ooh(amount = 1, delay = 0) {
    if (!ctx) return; const t = now() + delay;
    const n = 5;
    for (let k = 0; k < n; k++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      const f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter();
      o.type = 'sawtooth';
      const base = 300 + Math.random() * 140, tt = t + Math.random() * 0.06;
      o.frequency.setValueAtTime(base, tt);
      o.frequency.linearRampToValueAtTime(base * 1.18, tt + 0.18);
      o.frequency.linearRampToValueAtTime(base * 0.9, tt + 0.7);
      f1.type = 'bandpass'; f1.frequency.value = 650 + Math.random() * 80; f1.Q.value = 5;
      f2.type = 'bandpass'; f2.frequency.value = 1050 + Math.random() * 120; f2.Q.value = 6;
      const mix = ctx.createGain(); mix.gain.value = 1;
      o.connect(f1); o.connect(f2); f1.connect(mix); f2.connect(mix); mix.connect(g); g.connect(sfx);
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.06 * amount, tt + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.75);
      o.start(tt); o.stop(tt + 0.8);
    }
  }

  // ---------- crowd bed ----------
  function startCrowd() {
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 850; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(sfx); s.start();
    crowd = { g, level: 0, base: 0 };
  }
  function crowdBase(v) { if (crowd) crowd.base = v; }
  function swell(v) { if (crowd) crowd.level = Math.min(0.14, crowd.level + v); }

  // ---------- per-top hum ----------
  function hum() {
    if (!ctx) return null;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'triangle';
    f.type = 'lowpass'; f.Q.value = 6; f.frequency.value = 500;
    g.gain.value = 0;
    const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.Q.value = 2; nf.frequency.value = 2000;
    const ng = ctx.createGain(); ng.gain.value = 0;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(sfx);
    n.connect(nf); nf.connect(ng); ng.connect(sfx);
    o.start(); o2.start(); n.start();
    return {
      set(spin, speed, wob) {
        const t = now();
        const fr = 55 + spin * 120 + wob * 18 * Math.sin(t * 11);
        o.frequency.setTargetAtTime(fr, t, 0.05); o2.frequency.setTargetAtTime(fr * 2.01, t, 0.05);
        f.frequency.setTargetAtTime(300 + spin * 1500, t, 0.05);
        g.gain.setTargetAtTime(spin > 0 ? 0.018 + spin * 0.045 : 0, t, 0.06);
        nf.frequency.setTargetAtTime(1200 + spin * 2600, t, 0.05);
        ng.gain.setTargetAtTime(Math.min(0.06, 0.012 + speed / 9000 + wob * 0.04), t, 0.06);
      },
      stop() {
        const t = now();
        g.gain.setTargetAtTime(0, t, 0.05); ng.gain.setTargetAtTime(0, t, 0.05);
        o.stop(t + 0.3); o2.stop(t + 0.3); n.stop(t + 0.3);
      },
    };
  }

  // ---------- music: shekere, agogo bell, talking drum, kick, bass at 108 bpm ----------
  const BPM = 108, SPB = 60 / BPM / 4;
  const ROOTS = [110, 110, 146.83, 164.81];
  const BASS = { 0: 1, 3: 1, 6: 1.5, 10: 1, 13: 1.333 };
  const BELL_HI = [0, 6, 10], BELL_LO = [3, 8, 12, 14];
  const DRUM = { 4: [190, 125], 7: [140, 165], 11: [200, 120], 14: [170, 150], 15: [210, 130] };
  function schedule() {
    if (!ctx || !musicOn) return;
    while (nextStep < now() + 0.15) {
      const t = nextStep, s = step % 16, bar = Math.floor(step / 16) % 4;
      // shekere
      burst('highpass', 6500, 0.8, t, 0.002, (s % 4 === 2 ? 0.16 : s % 2 === 0 ? 0.08 : 0.045), 0.045, mus);
      // agogo
      if (BELL_HI.includes(s)) { tone('sine', 1320, 1320, t, 0.001, 0.07, 0.16, mus); tone('sine', 1980, 1980, t, 0.001, 0.025, 0.08, mus); }
      if (BELL_LO.includes(s)) { tone('sine', 990, 990, t, 0.001, 0.06, 0.15, mus); tone('sine', 1485, 1485, t, 0.001, 0.02, 0.07, mus); }
      // kick
      if (s === 0 || s === 8 || s === 10) tone('sine', 120, 42, t, 0.002, 0.42, 0.2, mus);
      // talking drum
      if (DRUM[s] && (bar % 2 === 1 || s < 12)) { const [a, b] = DRUM[s]; tone('sine', a, b, t, 0.004, 0.22, 0.2, mus); tone('triangle', a * 2, b * 2, t, 0.004, 0.04, 0.12, mus); }
      // bass
      if (BASS[s]) tone('triangle', ROOTS[bar] * BASS[s] / 2, ROOTS[bar] * BASS[s] / 2, t, 0.01, 0.2, SPB * 2.4, mus);
      nextStep += SPB; step++;
    }
  }
  function music(on) {
    if (!ctx) return;
    if (on && !musicOn) { musicOn = true; nextStep = now() + 0.05; timer = setInterval(schedule, 30); }
    if (!on && musicOn) { musicOn = false; clearInterval(timer); }
  }
  function duck(on) { musTarget = on ? musLevel.duck : musLevel.base; }

  // smooth per-frame things (crowd bed, music duck)
  function frame(dt) {
    if (!ctx) return;
    if (crowd) {
      crowd.level += (crowd.base - crowd.level) * Math.min(1, dt * 1.6);
      crowd.g.gain.setTargetAtTime(crowd.level * (0.8 + 0.4 * Math.sin(now() * 1.7) * Math.sin(now() * 0.63)), now(), 0.05);
    }
    mus.gain.setTargetAtTime(musTarget, now(), 0.2);
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('koso:muted', m ? '1' : '0'); } catch (e) {}
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, now(), 0.03);
  }

  return { unlock, fx, ooh, hum, music, duck, frame, swell, crowdBase, setMuted, get muted() { return muted; }, get ready() { return !!ctx; } };
})();
