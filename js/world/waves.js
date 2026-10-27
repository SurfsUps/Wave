// Bølgesystem: dønninger som kommer i sett, bygger seg opp, krøller, bryter og peeler mot land.
// Den samme høydefunksjonen finnes i JS (fysikk) og GLSL (water.js) – hold dem i synk.
import { smoothstep, lerp, clamp, mulberry32 } from '../engine/math.js';
import { WAVE_TUNE } from '../player/tuning.js';

export const MAXW = 8;
export const KC = 0.0012; // krumning på bølgetoppen (følger bukta)

export const WAVE_GLSL = /* glsl */ `
#define MAXW 8
#define KC 0.0012
uniform vec4 uA[MAXW]; // zc, Hbase, peak, steep
uniform vec4 uB[MAXW]; // wL, wR, started, bore
uniform vec4 uC[MAXW]; // lip, aktiv, sidebredde, 0
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
  float lw = uC[i].z;
  float lat = 0.55 + 0.45 * exp(-(u / lw) * (u / lw));
  float edge = smoothstep(140.0, 100.0, abs(p.x));
  H = A.y * lat * edge * smoothstep(0.0, 2.2, depth);
  float crest = A.x - KC * p.x * p.x;
  d = p.y - crest;
  Lf = mix(10.0, 2.6, A.w) * clamp(0.7 + A.y * 0.15, 0.85, 1.6);
  if (d >= 0.0) hu = exp(-(d / Lf) * (d / Lf)) - 0.1 * exp(-pow((d - 2.2 * Lf) / Lf, 2.0));
  else hu = exp(-(d / 16.0) * (d / 16.0));
  inside = 1000.0;
  b = 0.0;
  if (B.z > 0.5) {
    inside = u < 0.0 ? (-u - B.x) : (u - B.y);
    b = smoothstep(2.0, -3.0, inside);
  }
  float hb = d >= 0.0 ? exp(-(d / 2.4) * (d / 2.4)) : exp(-(d / 8.0) * (d / 8.0));
  // hvitvannet ruller: små, vandrende pukler i skumveggen
  hb *= B.w * (1.0 + 0.09 * sin(0.55 * p.x + 2.6 * uWaveTime + d * 0.9) * smoothstep(-6.0, 0.0, d));
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
    this.curSet = WAVE_TUNE.sets[1];
    this.spawn(-70, 2.0, true, this.curSet);
    this.spawn(-150, 3.4, true, WAVE_TUNE.sets[2]);
    this.spawn(-225, 2.1, true, this.curSet);
    this.setLeft = 1;
    this.nextSpawn = 10;
  }
  on(fn) { this.listeners.push(fn); }
  emit(type, w) { for (const f of this.listeners) f(type, w); }
  depthAt(x, z) {
    if (x < -200 || x > 200 || z < -280 || z > 120) return 30;
    return -this.hf.sample(x, z);
  }
  // Lager en ny dønning. size: { H: [min, maks] } fra et sett, eller null for en liten mellombølge.
  spawn(zc = -235, H0 = null, big = true, size = null, bomb = false) {
    const r = this.rnd, WT = WAVE_TUNE;
    if (this.waves.length >= MAXW) return null;
    // Bølgetype: en topp som deler seg (A-ramme), eller en som bare peeler én vei.
    // dir = 0: begge veier, -1: bare mot -x, +1: bare mot +x
    const roll = r();
    const dir = roll < 0.36 ? 0 : roll < 0.68 ? 1 : -1;
    let peak;
    if (dir === 0) peak = (r() - 0.5) * 70;
    else peak = -dir * (22 + r() * 40); // starter på den ene siden og peeler over bukta
    const fast = 8 + r() * 2.5, slow = 5.2 + r() * 1.6;
    const leftFast = r() < 0.5;
    const pick = (a) => a[0] + r() * (a[1] - a[0]);
    const H = H0 ?? (bomb ? pick(WT.bombH) : size ? pick(size.H) : pick(WT.smallBetween));
    // større bølger kjenner bunnen tidligere og bryter lenger ute
    const breakZ = clamp(WT.breakDepth[0] + WT.breakDepth[1] * H + (r() - 0.5) * 8, -82, -28);
    const w = {
      id: ++this.idc,
      zc,
      H0: H,
      peak,
      dir,
      latW: (dir === 0 ? 34 + r() * 14 : 55 + r() * 20) * (0.85 + H * 0.08),
      breakZ,
      closeZ: -14,
      peelL: dir === 1 ? 0 : dir === -1 ? fast * 0.9 : leftFast ? fast : slow,
      peelR: dir === -1 ? 0 : dir === 1 ? fast * 0.9 : leftFast ? slow : fast,
      // seksjoner: peelefarten varierer langs bølgen (rev og sandbanker)
      secPh: r() * 6.28, secF: 0.06 + r() * 0.05,
      wL: 0, wR: 0,
      started: false, breakT: 0,
      c: 8, steep: 0, Hbase: 0, bore: 0.6, lip: 0,
      big: !!(size || bomb) && big,
      bomb,
      size: bomb ? 'bomb' : size ? size.id : 'liten',
    };
    if (bomb) this.emit('bomb', w);
    this.update1(w, 0);
    this.waves.push(w);
    return w;
  }
  // peelefart med seksjoner: noen partier brekker raskere (kan lukke seg foran deg), andre saktere
  peelAt(w, x, base) {
    return base * (1 + WAVE_TUNE.peelVariation * Math.sin(x * w.secF + w.secPh));
  }
  closeMult(w, zc = w.zc) {
    // lukker seg gradvis fortere jo nærmere land den kommer, ikke alt på en gang
    return lerp(1, WAVE_TUNE.closeMult, smoothstep(w.closeZ - 12, w.closeZ + 8, zc));
  }
  update1(w, dt) {
    w.c = lerp(5.6, 8.6, smoothstep(-30, -180, w.zc));
    w.zc += w.c * dt;
    // dønningen bygger seg opp over grunnere vann …
    const grow = smoothstep(-240, w.breakZ - 5, w.zc);
    w.Hbase = w.H0 * (0.22 + 0.78 * grow);
    // … og blir brattere, mest helt på slutten før den brekker
    const crestPeak = w.zc - KC * w.peak * w.peak;
    const st = smoothstep(w.breakZ - 55, w.breakZ + 2, crestPeak);
    w.steep = st * st * (1.6 - 0.6 * st);
    if (!w.started && crestPeak >= w.breakZ) {
      w.started = true;
      w.breakT = 0;
      this.emit('break', w);
    }
    if (w.started) {
      w.breakT += dt;
      const closing = w.zc > w.closeZ - 12;
      const ramp = smoothstep(0, 0.8, w.breakT) * 0.7 + 0.3;
      const mult = this.closeMult(w) * ramp;
      // siden som ikke peeler lukker seg først helt inne ved land
      const pl = w.peelL ? this.peelAt(w, w.peak - w.wL, w.peelL) : closing ? 2.6 * smoothstep(w.closeZ - 12, w.closeZ + 4, w.zc) : 0;
      const pr = w.peelR ? this.peelAt(w, w.peak + w.wR, w.peelR) : closing ? 2.6 * smoothstep(w.closeZ - 12, w.closeZ + 4, w.zc) : 0;
      w.wL += pl * mult * dt;
      w.wR += pr * mult * dt;
      // hvitvannet er høyest rett etter at leppa har kastet seg, og roer seg mot land
      w.bore = 0.62 * Math.exp(-w.breakT * 0.03) * (1 + 0.22 * Math.exp(-w.breakT * 0.9));
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
        // nytt sett: velg størrelse (liten / middels / stor)
        const sets = WAVE_TUNE.sets;
        let x = r() * sets.reduce((a, b) => a + b.weight, 0);
        this.curSet = sets[sets.length - 1];
        for (const st of sets) { if ((x -= st.weight) <= 0) { this.curSet = st; break; } }
        const c = this.curSet.count;
        this.setLeft = c[0] + Math.floor(r() * (c[1] - c[0] + 1));
        this.emit('set', this.curSet);
      }
      // den siste bølgen i et middels eller stort sett kan være en bomb
      const bomb = this.setLeft === 1 && this.curSet.id !== 'liten' && r() < WAVE_TUNE.bombChance;
      this.spawn(-235, null, true, this.curSet, bomb);
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
      this.uC.set([w.lip, 1, w.latW, 0], i * 4);
    });
  }
  swell(x, z, t = this.time) {
    return 0.14 * Math.sin(0.085 * z + 0.012 * x - 0.72 * t) + 0.07 * Math.sin(0.19 * z - 0.08 * x - 1.25 * t + 1.3) + 0.04 * Math.sin(0.31 * z + 0.23 * x - 1.9 * t);
  }
  crestZ(w, x) { return w.zc - KC * x * x; }
  // Detaljert evaluering av én bølge i et punkt (speiler GLSL)
  eval(w, x, z, depth = this.depthAt(x, z)) {
    const u = x - w.peak;
    const lat = 0.55 + 0.45 * Math.exp(-(u / w.latW) * (u / w.latW));
    const edge = smoothstep(140, 100, Math.abs(x));
    const H = w.Hbase * lat * edge * smoothstep(0, 2.2, depth);
    const d = z - this.crestZ(w, x);
    const Lf = lerp(10, 2.6, w.steep) * clamp(0.7 + w.Hbase * 0.15, 0.85, 1.6);
    let hu;
    if (d >= 0) hu = Math.exp(-(d / Lf) * (d / Lf)) - 0.1 * Math.exp(-Math.pow((d - 2.2 * Lf) / Lf, 2));
    else hu = Math.exp(-(d / 16) * (d / 16));
    let inside = 1000, b = 0;
    if (w.started) {
      inside = u < 0 ? -u - w.wL : u - w.wR;
      b = smoothstep(2, -3, inside);
    }
    let hb = d >= 0 ? Math.exp(-(d / 2.4) * (d / 2.4)) : Math.exp(-(d / 8) * (d / 8));
    hb *= w.bore * (1 + 0.09 * Math.sin(0.55 * x + 2.6 * this.time + d * 0.9) * smoothstep(-6, 0, d));
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
    const u = x - w.peak;
    if (!w.started) {
      // hvor lenge til den begynner å bryte?
      const crestPeak = w.zc - KC * w.peak * w.peak;
      const tb = (w.breakZ - crestPeak) / Math.max(1, w.c);
      if (tb > t) return 1000;
      const tt = t - tb;
      return u < 0 ? -u - w.peelL * tt * 0.8 : u - w.peelR * tt * 0.8;
    }
    const mult = this.closeMult(w, w.zc + w.c * t);
    const closing = w.zc + w.c * t > w.closeZ - 12;
    const pl = (w.peelL ? this.peelAt(w, w.peak - w.wL, w.peelL) : 0) || (closing ? 2.6 : 0);
    const pr = (w.peelR ? this.peelAt(w, w.peak + w.wR, w.peelR) : 0) || (closing ? 2.6 : 0);
    return u < 0 ? -u - (w.wL + pl * t * mult) : u - (w.wR + pr * t * mult);
  }
  nextSetIn() { return this.setLeft > 0 ? 0 : this.nextSpawn; }
}
