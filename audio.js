// Prosedyrelyd med Web Audio: hav, brytende bølger, padling, vind, bål, måker og UI.
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.ready = false;
  }
  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 18000;
    this.master.connect(this.lp);
    this.lp.connect(ctx.destination);
    // støybuffer
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.985 * b0 + 0.15 * w; // brunaktig
      d[i] = b0 * 0.9 + w * 0.08;
    }
    this.noise = buf;
    const white = ctx.createBuffer(1, len, ctx.sampleRate);
    const wd = white.getChannelData(0);
    for (let i = 0; i < len; i++) wd[i] = Math.random() * 2 - 1;
    this.white = white;
    // havbakgrunn
    this.ocean = this.loop(this.noise, 'lowpass', 520, 0.0);
    this.surf = this.loop(this.white, 'bandpass', 900, 0.0, 0.6);
    this.wind = this.loop(this.white, 'highpass', 1500, 0.0);
    this.fire = this.loop(this.white, 'bandpass', 2500, 0.0, 3);
    this.ready = true;
  }
  loop(buf, type, freq, gain, q = 0.7) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
    return { src, f, g };
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.1);
  }
  set(node, v, tc = 0.25) {
    if (!this.ready) return;
    node.g.gain.setTargetAtTime(v, this.ctx.currentTime, tc);
  }
  // kontinuerlige nivåer fra spillet
  ambience({ breaking = 0, shore = 0, wind = 0, fire = 0, under = false }) {
    if (!this.ready) return;
    this.set(this.ocean, 0.25 + shore * 0.35 + breaking * 0.25, 0.6);
    this.set(this.surf, 0.04 + breaking * 0.22, 0.4);
    this.set(this.wind, wind * 0.16, 0.2);
    this.set(this.fire, fire * 0.05 * (0.6 + Math.random() * 0.8), 0.05);
    this.lp.frequency.setTargetAtTime(under ? 600 : 18000, this.ctx.currentTime, 0.08);
  }
  burst({ dur = 0.5, freq = 800, q = 0.8, gain = 0.4, type = 'bandpass', sweep = 0, src = 'white', delay = 0 }) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = src === 'white' ? this.white : this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.05, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 2);
    s.stop(t + dur + 0.05);
  }
  tone({ f0 = 600, f1 = 900, dur = 0.12, gain = 0.15, type = 'sine', delay = 0 }) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  crash(vol) {
    if (vol < 0.02) return;
    this.burst({ dur: 2.2, freq: 1400, q: 0.5, gain: 0.5 * vol, sweep: 0.25 });
    this.burst({ dur: 1.6, freq: 300, q: 0.7, gain: 0.6 * vol, type: 'lowpass', src: 'brown', sweep: 0.5 });
  }
  paddle() { this.burst({ dur: 0.28, freq: 1100 + Math.random() * 500, q: 1.2, gain: 0.18, sweep: 0.5 }); }
  splash(v = 1) { this.burst({ dur: 0.6, freq: 1500, q: 0.6, gain: 0.35 * v, sweep: 0.3 }); }
  dive() {
    this.burst({ dur: 0.5, freq: 700, q: 1.0, gain: 0.3, sweep: 0.3 });
    for (let i = 0; i < 5; i++) this.tone({ f0: 300 + Math.random() * 300, f1: 700 + Math.random() * 500, dur: 0.08, gain: 0.05, delay: 0.1 + i * 0.09 });
  }
  hit() {
    this.burst({ dur: 1.2, freq: 500, q: 0.5, gain: 0.7, type: 'lowpass', src: 'brown', sweep: 0.4 });
    this.burst({ dur: 0.9, freq: 2000, q: 0.4, gain: 0.35, sweep: 0.3 });
  }
  step() { this.burst({ dur: 0.07, freq: 2600, q: 1.5, gain: 0.05 }); }
  good() {
    this.tone({ f0: 660, f1: 660, dur: 0.12, gain: 0.08, type: 'triangle' });
    this.tone({ f0: 990, f1: 990, dur: 0.18, gain: 0.08, type: 'triangle', delay: 0.09 });
  }
  great() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone({ f0: f, f1: f, dur: 0.16, gain: 0.07, type: 'triangle', delay: i * 0.07 }));
  }
  bad() { this.tone({ f0: 330, f1: 200, dur: 0.3, gain: 0.08, type: 'triangle' }); }
  click() { this.tone({ f0: 900, f1: 1300, dur: 0.06, gain: 0.06, type: 'triangle' }); }
  gull() {
    const d = Math.random() * 0.2;
    for (let i = 0; i < 3; i++) this.tone({ f0: 1900 - i * 80, f1: 1100, dur: 0.18, gain: 0.025, type: 'sawtooth', delay: d + i * 0.22 });
  }
  crackle() { this.burst({ dur: 0.04, freq: 3000 + Math.random() * 3000, q: 4, gain: 0.08 }); }
}
