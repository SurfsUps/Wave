// Bølgesystem: dønninger som kommer i sett, bygger seg opp, krøller, bryter og peeler mot land.
// Den samme høydefunksjonen finnes i JS (fysikk) og GLSL (water.js) – hold dem i synk.
import { smoothstep, lerp, clamp, mulberry32 } from '../engine/math.js';

export const MAXW = 8;
export const KC = 0.0012; // krumning på bølgetoppen (følger bukta)

export const WAVE_GLSL = /* glsl */ `
#define MAXW 8
#define KC 0.0012
uniform vec4 uA[MAXW]; // zc, Hbase, peak, steep
uniform vec4 uB[MAXW]; // wL, wR, started, bore
uniform vec4 uC[MAXW]; // lip, aktiv, 0, 0
uniform float uWaveTime;

float swellH(vec2 p, float t) {
  return 0.14 * sin(0.085 * p.y + 0.012 * p.x - 0.72 * t)
       + 0.07 * sin(0.19 * p.y - 0.08 * p.x - 1.25 * t + 1.3)
       + 0.04 * sin(0.31 * p.y + 0.23 * p.x - 1.9 * t);
}

// h: høyde, b: brutt andel, d: avstand foran toppen, Lf: frontlengde, hu: ubrutt profil, H: lokal høyde, inside: avstand til curl
void waveEval(int i, vec2 p, float depth, out float h, out float b, out float d, out float Lf, out float hu, out float H, out float inside) {
  vec4 A = uA[i];
  vec4 B = uB[i];
  float u = p.x - A.z;
  float lat = 0.55 + 0.45 * exp(-(u / 40.0) * (u / 40.0));
  float edge = smoothstep(140.0, 100.0, abs(p.x));
  H = A.y * lat * edge * smoothstep(0.0, 2.2, depth);
  float crest = A.x - KC * p.x * p.x;
  d = p.y - crest;
  Lf = mix(10.0, 2.6, A.w);
  if (d >= 0.0) hu = exp(-(d / Lf) * (d / Lf)) - 0.1 * exp(-pow((d - 2.2 * Lf) / Lf, 2.0));
  else hu = exp(-(d / 16.0) * (d / 16.0));
  inside = 1000.0;
  b = 0.0;
  if (B.z > 0.5) {
    inside = u < 0.0 ? (-u - B.x) : (u - B.y);
    b = smoothstep(2.0, -3.0, inside);
  }
  float hb = d >= 0.0 ? exp(-(d / 2.4) * (d / 2.4)) : exp(-(d / 8.0) * (d / 8.0));
  hb *= B.w;
  h = H * mix(hu, hb, b);
}

float waterHeight(vec2 p, float depth) {
  float sum = swellH(p, uWaveTime) * smoothstep(0.0, 2.0, depth);
  for (int i = 0; i < MAXW; i++) {
    if (uC[i].y < 0.5) continue;
    float dd = p.y - (uA[i].x - KC * p.x * p.x);
    if (dd < -60.0 || dd > 40.0) continue;
    float h, b, d, Lf, hu, H, ins;
    waveEval(i, p, depth, h, b, d, Lf, hu, H, ins);
    sum += h;
  }
  return sum;
}
`;

export class WaveSystem {
  constructor(heightField, seed = 7) {
    this.hf = heightField;
    this.rnd = mulberry32(seed);
    this.waves = [];
    this.time = 0;
    this.nextSpawn = 2;
    this.setLeft = 0;
    this.listeners = [];
    this.uA = new Float32Array(MAXW * 4);
    this.uB = new Float32Array(MAXW * 4);
    this.uC = new Float32Array(MAXW * 4);
    this.idc = 0;
    this.setAnnounce = 0;
    // forhåndsfyll så det er liv i bukta fra start
    this.spawn(-70, 2.0, true);
    this.spawn(-150, 2.3, true);
    this.spawn(-225, 2.1, true);
    this.setLeft = 1;
    this.nextSpawn = 10;
  }
  on(fn) { this.listeners.push(fn); }
  emit(type, w) { for (const f of this.listeners) f(type, w); }
  depthAt(x, z) {
    if (x < -200 || x > 200 || z < -280 || z > 120) return 30;
    return -this.hf.sample(x, z);
  }
  spawn(zc = -235, H0 = null, big = true) {
    const r = this.rnd;
    if (this.waves.length >= MAXW) return null;
    const leftFast = r() < 0.5;
    const w = {
      id: ++this.idc,
      zc,
      H0: H0 ?? (big ? 1.8 + r() * 0.8 : 0.95 + r() * 0.35),
      peak: (r() - 0.5) * 56,
      breakZ: big ? -56 + (r() - 0.5) * 12 : -34 + (r() - 0.5) * 6,
      closeZ: -14,
      peelL: leftFast ? 8 + r() * 2.5 : 5.2 + r() * 1.6,
      peelR: leftFast ? 5.2 + r() * 1.6 : 8 + r() * 2.5,
      wL: 0, wR: 0,
      started: false, breakT: 0,
      c: 8, steep: 0, Hbase: 0, bore: 0.6, lip: 0,
      big,
    };
    this.update1(w, 0);
    this.waves.push(w);
    return w;
  }
  update1(w, dt) {
    w.c = lerp(5.6, 8.6, smoothstep(-30, -180, w.zc));
    w.zc += w.c * dt;
    const grow = smoothstep(-240, w.breakZ - 5, w.zc);
    w.Hbase = w.H0 * (0.22 + 0.78 * grow);
    const crestPeak = w.zc - KC * w.peak * w.peak;
    w.steep = smoothstep(w.breakZ - 55, w.breakZ + 2, crestPeak);
    if (!w.started && crestPeak >= w.breakZ) {
      w.started = true;
      w.breakT = 0;
      this.emit('break', w);
    }
    if (w.started) {
      w.breakT += dt;
      const closing = w.zc > w.closeZ;
      const ramp = smoothstep(0, 0.8, w.breakT) * 0.7 + 0.3;
      const mult = (closing ? 3.5 : 1) * ramp;
      w.wL += w.peelL * mult * dt;
      w.wR += w.peelR * mult * dt;
      w.bore = 0.62 * Math.exp(-w.breakT * 0.03);
      w.lip = 1;
    } else {
      w.lip = smoothstep(0.85, 1, w.steep) * 0.5;
    }
  }
  update(dt) {
    this.time += dt;
    for (const w of this.waves) this.update1(w, dt);
    this.waves = this.waves.filter((w) => w.zc < 30);
    this.nextSpawn -= dt;
    if (this.nextSpawn <= 0) {
      const r = this.rnd;
      if (this.setLeft <= 0) {
        // nytt sett
        this.setLeft = 3 + Math.floor(r() * 3);
        this.emit('set', null);
      }
      const big = this.setLeft > 0;
      this.spawn(-235, null, big);
      this.setLeft--;
      if (this.setLeft > 0) this.nextSpawn = 9.5 + r() * 2.5;
      else {
        this.nextSpawn = 17 + r() * 9;
        // en liten mellombølge i pausen
        this.pendingSmall = 7 + r() * 4;
      }
    }
    if (this.pendingSmall !== undefined) {
      this.pendingSmall -= dt;
      if (this.pendingSmall <= 0) {
        this.spawn(-235, null, false);
        this.pendingSmall = undefined;
      }
    }
    this.pack();
  }
  pack() {
    this.uA.fill(0); this.uB.fill(0); this.uC.fill(0);
    this.waves.forEach((w, i) => {
      this.uA.set([w.zc, w.Hbase, w.peak, w.steep], i * 4);
      this.uB.set([w.wL, w.wR, w.started ? 1 : 0, w.bore], i * 4);
      this.uC.set([w.lip, 1, 0, 0], i * 4);
    });
  }
  swell(x, z, t = this.time) {
    return 0.14 * Math.sin(0.085 * z + 0.012 * x - 0.72 * t) + 0.07 * Math.sin(0.19 * z - 0.08 * x - 1.25 * t + 1.3) + 0.04 * Math.sin(0.31 * z + 0.23 * x - 1.9 * t);
  }
  crestZ(w, x) { return w.zc - KC * x * x; }
  // Detaljert evaluering av én bølge i et punkt (speiler GLSL)
  eval(w, x, z, depth = this.depthAt(x, z)) {
    const u = x - w.peak;
    const lat = 0.55 + 0.45 * Math.exp(-(u / 40) * (u / 40));
    const edge = smoothstep(140, 100, Math.abs(x));
    const H = w.Hbase * lat * edge * smoothstep(0, 2.2, depth);
    const d = z - this.crestZ(w, x);
    const Lf = lerp(10, 2.6, w.steep);
    let hu;
    if (d >= 0) hu = Math.exp(-(d / Lf) * (d / Lf)) - 0.1 * Math.exp(-Math.pow((d - 2.2 * Lf) / Lf, 2));
    else hu = Math.exp(-(d / 16) * (d / 16));
    let inside = 1000, b = 0;
    if (w.started) {
      inside = u < 0 ? -u - w.wL : u - w.wR;
      b = smoothstep(2, -3, inside);
    }
    let hb = d >= 0 ? Math.exp(-(d / 2.4) * (d / 2.4)) : Math.exp(-(d / 8) * (d / 8));
    hb *= w.bore;
    const h = H * lerp(hu, hb, b);
    return { h, b, d, Lf, hu, H, inside, u };
  }
  height(x, z) {
    const depth = this.depthAt(x, z);
    let sum = this.swell(x, z) * smoothstep(0, 2, depth);
    for (const w of this.waves) {
      const dd = z - this.crestZ(w, x);
      if (dd < -60 || dd > 40) continue;
      sum += this.eval(w, x, z, depth).h;
    }
    return sum;
  }
  gradient(x, z, e = 0.4) {
    const hx = (this.height(x + e, z) - this.height(x - e, z)) / (2 * e);
    const hz = (this.height(x, z + e) - this.height(x, z - e)) / (2 * e);
    return [hx, hz];
  }
  // Forutsi brutt-andel ved x om t sekunder (for varsel/timing)
  predictInside(w, x, t) {
    if (!w.started) {
      // hvor lenge til den begynner å bryte?
      const crestPeak = w.zc - KC * w.peak * w.peak;
      const tb = (w.breakZ - crestPeak) / Math.max(1, w.c);
      if (tb > t) return 1000;
      const tt = t - tb;
      const u = x - w.peak;
      return u < 0 ? -u - w.peelL * tt * 0.8 : u - w.peelR * tt * 0.8;
    }
    const mult = w.zc + w.c * t > w.closeZ ? 2.5 : 1;
    const u = x - w.peak;
    return u < 0 ? -u - (w.wL + w.peelL * t * mult) : u - (w.wR + w.peelR * t * mult);
  }
  nextSetIn() { return this.setLeft > 0 ? 0 : this.nextSpawn; }
}
