// Stilisert surfer bygd av enkle former, med ledd for prosedyreanimasjon.
import { Node, lerp, smoothstep } from '../engine/math.js';
import { Mesh, makeMaterial } from '../engine/renderer.js';
import { Geo, box, cylinder, sphere, lathe, hex } from '../engine/geometry.js';
import { OUTFITS, HATS, GLASSES, printCanvas, shortsCanvas } from './outfits.js';

export const J = ['hips', 'torso', 'neck', 'shL', 'elL', 'shR', 'elR', 'hipL', 'knL', 'hipR', 'knR', 'ftL', 'ftR'];
export const JI = Object.fromEntries(J.map((n, i) => [n, i]));
export const POSE_LEN = J.length * 3 + 3; // + hofteforskyvning

export function newPose() {
  return new Float32Array(POSE_LEN);
}
export function setJ(p, name, x = 0, y = 0, z = 0) {
  const i = JI[name] * 3;
  p[i] = x; p[i + 1] = y; p[i + 2] = z;
}
export function addJ(p, name, x = 0, y = 0, z = 0) {
  const i = JI[name] * 3;
  p[i] += x; p[i + 1] += y; p[i + 2] += z;
}
export function setOffset(p, x, y, z) {
  const o = J.length * 3;
  p[o] = x; p[o + 1] = y; p[o + 2] = z;
}
export function blendPose(out, a, b, t) {
  for (let i = 0; i < POSE_LEN; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

const SKIN = '#c98e62';
const HAIR = '#3b2618';

export class Character {
  constructor(renderer) {
    this.r = renderer;
    this.gl = renderer.gl;
    this.root = new Node();
    const n = (parent, x, y, z) => {
      const nd = new Node();
      nd.pos = [x, y, z];
      parent.add(nd);
      return nd;
    };
    const j = (this.j = {});
    j.hips = n(this.root, 0, 0.95, 0);
    j.torso = n(j.hips, 0, 0.05, 0);
    j.neck = n(j.torso, 0, 0.55, 0);
    j.shL = n(j.torso, 0.205, 0.47, 0);
    j.elL = n(j.shL, 0, -0.29, 0);
    j.shR = n(j.torso, -0.205, 0.47, 0);
    j.elR = n(j.shR, 0, -0.29, 0);
    j.hipL = n(j.hips, 0.095, -0.07, 0);
    j.knL = n(j.hipL, 0, -0.42, 0);
    j.ftL = n(j.knL, 0, -0.42, 0);
    j.hipR = n(j.hips, -0.095, -0.07, 0);
    j.knR = n(j.hipR, 0, -0.42, 0);
    j.ftR = n(j.knR, 0, -0.42, 0);
    this.parts = [];
    this.meshCache = new Map();
    this.texCache = new Map();
    this.look = { outfit: 'korall', hat: 'none', glasses: 'none' };
    this.build();
  }
  mesh(key, fn) {
    if (!this.meshCache.has(key)) this.meshCache.set(key, new Mesh(this.gl, fn()));
    return this.meshCache.get(key);
  }
  tex(key, fn) {
    if (!this.texCache.has(key)) this.texCache.set(key, this.r.texture(fn(), { repeat: true }));
    return this.texCache.get(key);
  }
  attach(joint, mesh, mat) {
    const nd = new Node(mesh, mat);
    this.j[joint].add(nd);
    this.parts.push(nd);
    return nd;
  }
  setLook(look) {
    Object.assign(this.look, look);
    this.build();
  }
  build() {
    for (const p of this.parts) p.parent.remove(p);
    this.parts = [];
    const o = OUTFITS.find((x) => x.id === this.look.outfit) || OUTFITS[0];
    const skin = makeMaterial({ color: hex(SKIN), vcol: false, spec: 0.25 });
    const top = makeMaterial({ tex: this.tex('p' + o.print, () => printCanvas(o.print)), vcol: false, spec: 0.12 });
    const suitCol = o.suitColor ? hex(o.suitColor) : null;
    const shorts = o.shorts === 'suit'
      ? makeMaterial({ color: suitCol, vcol: false, spec: 0.35 })
      : makeMaterial({ tex: this.tex('s' + o.shorts, () => shortsCanvas(o.shorts)), vcol: false, spec: 0.1 });
    const legMat = o.legs === 'suit' ? makeMaterial({ color: suitCol, vcol: false, spec: 0.35 }) : skin;
    const sleeveUp = o.sleeves === 'none' ? skin : top;
    const sleeveLo = o.sleeves === 'long' ? top : skin;
    const plain = (c, spec = 0.15) => makeMaterial({ color: hex(c), vcol: false, spec });

    // bekken og overkropp
    this.attach('hips', this.mesh('pelvis', () => lathe([[0, -0.14], [0.11, -0.13], [0.16, -0.07], [0.168, 0.02], [0.155, 0.09]], 18).tf(0, 0, 0, 0, 0, 0, 1, 1, 0.72).computeNormals()), shorts);
    this.attach('torso', this.mesh('torso', () => lathe([[0.152, -0.02], [0.158, 0.1], [0.175, 0.22], [0.198, 0.36], [0.205, 0.44], [0.175, 0.52], [0.09, 0.575], [0.0, 0.58]], 20).tf(0, 0, 0, 0, 0, 0, 1, 1, 0.68).computeNormals()), top);
    // hode
    this.attach('neck', this.mesh('neckc', () => cylinder(0.048, 0.054, 0.12, 10)), skin);
    const head = this.attach('neck', this.mesh('head', () => sphere(0.125, 18, 14).tf(0, 0.17, 0.01, 0, 0, 0, 1, 1.1, 1.02)), skin);
    void head;
    this.attach('neck', this.mesh('ears', () => {
      const g = new Geo();
      g.add(sphere(0.03, 8, 6).tf(0.123, 0.165, 0, 0, 0, 0, 0.5, 1, 0.8));
      g.add(sphere(0.03, 8, 6).tf(-0.123, 0.165, 0, 0, 0, 0, 0.5, 1, 0.8));
      g.add(sphere(0.022, 8, 6).tf(0, 0.145, 0.133));
      return g;
    }), skin);
    this.attach('neck', this.mesh('hair', () => {
      const prof = [];
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * 1.75;
        prof.push([Math.sin(a) * 0.137, Math.cos(a) * 0.15]);
      }
      prof.reverse();
      const g = lathe(prof, 18).tf(0, 0.18, -0.012, -0.42, 0, 0);
      // lugg
      g.add(sphere(0.05, 8, 6).tf(0.05, 0.27, 0.085, 0.3, 0, 0, 1, 0.5, 0.8));
      g.add(sphere(0.045, 8, 6).tf(-0.04, 0.275, 0.09, 0.3, 0, 0, 1, 0.5, 0.8));
      return g;
    }), plain(HAIR, 0.3));
    if (this.look.glasses === 'none') {
      this.attach('neck', this.mesh('eyes', () => {
        const g = new Geo();
        g.add(sphere(0.017, 8, 6).tf(0.045, 0.18, 0.118));
        g.add(sphere(0.017, 8, 6).tf(-0.045, 0.18, 0.118));
        g.add(box(0.045, 0.01, 0.01).tf(0.047, 0.215, 0.12, 0, 0, 0.1));
        g.add(box(0.045, 0.01, 0.01).tf(-0.047, 0.215, 0.12, 0, 0, -0.1));
        g.add(box(0.05, 0.009, 0.01).tf(0, 0.098, 0.124));
        return g;
      }), plain('#2a1a12', 0.4));
    } else {
      const gl = GLASSES.find((x) => x.id === this.look.glasses);
      this.attach('neck', this.mesh('mouth', () => box(0.05, 0.009, 0.01).tf(0, 0.098, 0.124)), plain('#2a1a12'));
      this.attach('neck', this.mesh('lens' + (gl.round ? 'r' : 's'), () => {
        const g = new Geo();
        for (const x of [0.048, -0.048]) {
          const c = gl.round ? cylinder(0.034, 0.034, 0.01, 14).tf(0, 0, 0, Math.PI / 2, 0, 0) : box(0.074, 0.048, 0.012);
          c.tf(x, 0.18, 0.128);
          g.add(c);
        }
        return g;
      }), makeMaterial({ color: hex(gl.lens), vcol: false, spec: gl.shine ? 2.5 : 1.2 }));
      this.attach('neck', this.mesh('frame', () => {
        const g = new Geo();
        g.add(box(0.03, 0.01, 0.01).tf(0, 0.188, 0.13));
        g.add(box(0.008, 0.012, 0.15).tf(0.122, 0.19, 0.06));
        g.add(box(0.008, 0.012, 0.15).tf(-0.122, 0.19, 0.06));
        g.add(box(0.21, 0.012, 0.01).tf(0, 0.21, 0.126));
        return g;
      }), plain(gl.frame, 0.6));
    }
    // hodeplagg
    const hat = HATS.find((x) => x.id === this.look.hat);
    if (hat && hat.id !== 'none') this.buildHat(hat);

    // armer
    for (const s of ['L', 'R']) {
      this.attach('sh' + s, this.mesh('upperArm', () => sphere(0.068, 10, 8).add(cylinder(0.052, 0.064, 0.29, 10).tf(0, -0.29, 0))), sleeveUp);
      this.attach('el' + s, this.mesh('foreArm', () => sphere(0.05, 10, 8).add(cylinder(0.041, 0.048, 0.26, 10).tf(0, -0.26, 0))), sleeveLo);
      this.attach('el' + s, this.mesh('hand', () => sphere(0.05, 10, 8).tf(0, -0.3, 0.005, 0, 0, 0, 0.75, 1.15, 1.05)), skin);
      this.attach('hip' + s, this.mesh('thigh', () => sphere(0.095, 12, 8).add(cylinder(0.072, 0.098, 0.42, 12).tf(0, -0.42, 0))), shorts);
      this.attach('kn' + s, this.mesh('shin', () => sphere(0.07, 10, 8).add(cylinder(0.05, 0.07, 0.41, 10).tf(0, -0.41, 0))), legMat);
      this.attach('ft' + s, this.mesh('foot', () => {
        const g = box(0.095, 0.06, 0.24).tf(0, -0.02, 0.055);
        g.add(sphere(0.05, 8, 6).tf(0, -0.015, 0.16, 0, 0, 0, 0.95, 0.6, 1));
        return g;
      }), o.legs === 'suit' ? legMat : skin);
    }
  }
  buildHat(hat) {
    const col = makeMaterial({ color: hex(hat.color), vcol: false, spec: 0.12 });
    const brim = makeMaterial({ color: hex(hat.brim), vcol: false, spec: 0.12, double: true });
    if (hat.id === 'cap' || hat.id === 'capBack') {
      const back = hat.id === 'capBack' ? Math.PI : 0;
      this.attach('neck', this.mesh('capDome', () => {
        const prof = [];
        for (let i = 0; i <= 8; i++) {
          const a = (i / 8) * 1.62;
          prof.push([Math.sin(a) * 0.142, Math.cos(a) * 0.13]);
        }
        prof.reverse();
        return lathe(prof, 18).tf(0, 0.2, -0.005);
      }), col);
      const b = this.attach('neck', this.mesh('capBrim', () => {
        const g = cylinder(0.12, 0.12, 0.012, 16, [1, 1, 1]).tf(0, 0, 0, 0, 0, 0, 1, 1, 0.9);
        return g.tf(0, 0.205, 0.15, -0.12, 0, 0);
      }), brim);
      b.rot[1] = back;
      b.pos = [0, 0, 0];
    } else if (hat.id === 'bucket') {
      this.attach('neck', this.mesh('bucket', () => lathe([[0.25, 0.17], [0.2, 0.19], [0.15, 0.22], [0.145, 0.3], [0.12, 0.34], [0, 0.345]], 20)), col);
      this.attach('neck', this.mesh('bucketBand', () => cylinder(0.148, 0.152, 0.03, 20, [1, 1, 1], false).tf(0, 0.22, 0)), makeMaterial({ color: hex(hat.band), vcol: false }));
    } else if (hat.id === 'straw') {
      this.attach('neck', this.mesh('strawBrim', () => cylinder(0.33, 0.34, 0.012, 24).tf(0, 0.215, 0, -0.08, 0, 0)), brim);
      this.attach('neck', this.mesh('strawCrown', () => lathe([[0.15, 0.2], [0.152, 0.3], [0.13, 0.35], [0, 0.36]], 20)), col);
      this.attach('neck', this.mesh('strawBand', () => cylinder(0.153, 0.153, 0.035, 20, [1, 1, 1], false).tf(0, 0.225, 0)), makeMaterial({ color: hex(hat.band), vcol: false }));
    } else if (hat.id === 'lei') {
      // blomsterkrans: blader og blomster i en ring rundt hodet
      this.attach('neck', this.mesh('lei', () => {
        const g = new Geo();
        const cols = ['#ff5e7a', '#ffd84d', '#ffffff', '#ff9f45', '#ff5e7a', '#f7f0ff'];
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          const x = Math.sin(a) * 0.142, z = Math.cos(a) * 0.135 - 0.005, y = 0.235 + Math.cos(a) * 0.02;
          g.add(sphere(0.026, 6, 4, '#2f9a4a').tf(Math.sin(a + 0.22) * 0.15, y - 0.012, Math.cos(a + 0.22) * 0.143, 0, a, 0, 1.6, 0.5, 0.8));
          const c = cols[i % cols.length];
          for (let k = 0; k < 5; k++) {
            const b = (k / 5) * Math.PI * 2;
            g.add(sphere(0.017, 6, 4, c).tf(x + Math.cos(b) * 0.018 * Math.cos(a), y + Math.sin(b) * 0.018, z - Math.cos(b) * 0.018 * Math.sin(a), 0, 0, 0, 1, 1, 0.6));
          }
          g.add(sphere(0.009, 5, 4, '#ffcf3a').tf(x * 1.08, y, z * 1.08));
        }
        return g;
      }), makeMaterial({ spec: 0.35 }));
    } else if (hat.id === 'visor') {
      this.attach('neck', this.mesh('visorBand', () => cylinder(0.138, 0.138, 0.04, 20, [1, 1, 1], false).tf(0, 0.235, 0)), makeMaterial({ color: hex(hat.color), vcol: false, double: true }));
      this.attach('neck', this.mesh('visorBrim', () => cylinder(0.12, 0.12, 0.01, 16).tf(0, 0, 0, 0, 0, 0, 1, 1, 0.85).tf(0, 0.24, 0.155, -0.15, 0, 0)), brim);
    }
  }
  applyPose(p) {
    for (let i = 0; i < J.length; i++) {
      const nd = this.j[J[i]];
      nd.rot[0] = p[i * 3];
      nd.rot[1] = p[i * 3 + 1];
      nd.rot[2] = p[i * 3 + 2];
    }
    const o = J.length * 3;
    this.j.hips.pos[0] = p[o];
    this.j.hips.pos[1] = 0.95 + p[o + 1];
    this.j.hips.pos[2] = p[o + 2];
  }
}

// ---------- Poser ----------
export const Poses = {
  idle(p, t) {
    p.fill(0);
    const b = Math.sin(t * 2.0) * 0.015; // pust
    // vekten flyttes rolig fra fot til fot: hoftene glir til siden, standbeinet strekkes, det andre kneet bøyes
    const w = Math.sin(t * 0.42) * 0.8 + Math.sin(t * 0.17) * 0.2;
    const wl = Math.max(0, w), wr = Math.max(0, -w);
    setJ(p, 'hips', 0, 0, -w * 0.05);
    setJ(p, 'torso', 0.03 + b, 0, w * 0.06);
    setJ(p, 'neck', -0.03 - b, Math.sin(t * 0.5) * 0.25, -w * 0.02);
    setJ(p, 'shL', 0.05, 0, 0.12 + b);
    setJ(p, 'shR', 0.05, 0, -0.12 - b);
    setJ(p, 'elL', -0.15, 0, 0);
    setJ(p, 'elR', -0.15, 0, 0);
    setJ(p, 'hipL', -wr * 0.08, 0, 0.04 + w * 0.05);
    setJ(p, 'hipR', -wl * 0.08, 0, -0.04 + w * 0.05);
    setJ(p, 'knL', wr * 0.2, 0, 0);
    setJ(p, 'knR', wl * 0.2, 0, 0);
    setJ(p, 'ftL', -wr * 0.1, 0, 0);
    setJ(p, 'ftR', -wl * 0.1, 0, 0);
    setOffset(p, w * 0.03, -0.005 + b * 0.3 - Math.abs(w) * 0.008, 0);
    return p;
  },
  // fase i radianer, fart 0..1 (gå→løp). Sving-fasen bøyer kneet, hælen treffer først,
  // armene pendler motsatt av beina, og hoftene vugger over standbeinet.
  walk(p, ph, run) {
    p.fill(0);
    const a = 0.5 + run * 0.32;
    const s = Math.sin(ph), c = Math.cos(ph);
    const sL = Math.max(0, c), sR = Math.max(0, -c); // sving-fase for hvert bein
    // hofte: negativ x = beinet frem
    setJ(p, 'hipL', -s * a - run * 0.12, 0, 0.035);
    setJ(p, 'hipR', s * a - run * 0.12, 0, -0.035);
    // kne: stor bøy midt i svingen, litt bøy når hælen lander og tar vekten
    const loadL = Math.max(0, s) * Math.max(0, -c), loadR = Math.max(0, -s) * Math.max(0, c);
    setJ(p, 'knL', Math.pow(sL, 1.4) * (0.75 + run * 0.85) + loadL * (0.22 + run * 0.3) + 0.05, 0, 0);
    setJ(p, 'knR', Math.pow(sR, 1.4) * (0.75 + run * 0.85) + loadR * (0.22 + run * 0.3) + 0.05, 0, 0);
    // ankel: tærne opp ved hælisett, avsparket strekker foten
    setJ(p, 'ftL', -0.22 * s + Math.max(0, -s) * sR * 0.25 - sL * 0.15, 0, 0);
    setJ(p, 'ftR', 0.22 * s + Math.max(0, s) * sL * 0.25 - sR * 0.15, 0, 0);
    // armer: motsatt av beina, albuen bøyes mer når armen svinger frem
    const arm = 0.32 + run * 0.5;
    const aL = s * arm, aR = -s * arm;
    setJ(p, 'shL', aL, 0, 0.09 + run * 0.06);
    setJ(p, 'shR', aR, 0, -0.09 - run * 0.06);
    setJ(p, 'elL', -0.22 - Math.max(0, -aL) * 0.6 - run * 1.0, 0, 0);
    setJ(p, 'elR', -0.22 - Math.max(0, -aR) * 0.6 - run * 1.0, 0, 0);
    // bekkenet roterer med beinet, overkroppen motroterer, og hodet holdes stødig
    setJ(p, 'hips', 0, -s * (0.1 + run * 0.06), c * 0.045);
    setJ(p, 'torso', 0.05 + run * 0.2, s * (0.16 + run * 0.06), -c * 0.035);
    setJ(p, 'neck', -0.04 - run * 0.14, -s * 0.06, c * 0.02);
    // kroppen er høyest når beina passerer hverandre (gange), lavest i landingen (løp)
    const bobWalk = 0.012 - s * s * 0.035;
    const bobRun = 0.03 - c * c * 0.07;
    setOffset(p, -c * 0.022 * (1 - run), bobWalk + (bobRun - bobWalk) * run, 0);
    return p;
  },
  // bærer brettet under høyre arm
  carry(p) {
    addJ(p, 'shR', -0.05, 0, -0.42);
    setJ(p, 'elR', -1.25, 0.2, 0.15);
    return p;
  },
  // liggende padling (karakteren roteres liggende av spilleren)
  // Armtak: hånda går inn foran skulderen, trekker under brettet (strak arm, bøyd albue midt i taket)
  // og føres frem over vann med bøyd albue. Hodet og brystet er løftet, bena samlet med litt spark.
  paddle(p, ph, power, head = 0) {
    p.fill(0);
    const pl = ph, pr = ph + Math.PI;
    const amp = 0.35 + power * 0.65;
    const arm = (q, side) => {
      const c = ((q % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); // 0..2π
      const pull = c < Math.PI; // første halvdel: trekk under vann
      const k = pull ? c / Math.PI : (c - Math.PI) / Math.PI;
      // skulder (x): -π = strak frem mot nesa, -π/2 = rett ned i vannet, 0 = langs siden, +π/2 = opp i lufta.
      // Trekket går frem → ned → bak, tilbakeføringen over vann: bak → opp → frem.
      let a = pull ? lerp(-2.9, 0.25, k) : lerp(0.25, Math.PI * 2 - 2.9, k);
      if (a > Math.PI) a -= Math.PI * 2;
      const el = -0.35 - Math.sin(k * Math.PI) * (pull ? 0.55 : 1.1);
      const out = 0.3 + Math.sin(k * Math.PI) * (pull ? 0.12 : 0.35);
      // svake tak: kortere trekk, men full rekkevidde frem (der vinkelen «går rundt»), så armen aldri hopper
      const rest = -0.35, wEff = amp + (1 - amp) * smoothstep(2.4, Math.PI, Math.abs(a));
      setJ(p, 'sh' + side, rest + (a - rest) * wEff, 0, (side === 'L' ? 1 : -1) * lerp(0.35, out, amp));
      setJ(p, 'el' + side, lerp(-0.25, el, amp), 0, 0);
      return pull ? Math.sin(k * Math.PI) : 0;
    };
    const fL = arm(pl, 'L'), fR = arm(pr, 'R');
    setJ(p, 'neck', -0.8 - head, 0, 0);
    // brystet løftes, og overkroppen ruller litt mot armen som trekker
    setJ(p, 'torso', -0.24 - head * 0.4 - power * 0.06, (fL - fR) * 0.08 * power, (fR - fL) * 0.05 * power);
    setJ(p, 'hipL', 0.05, 0, 0.05);
    setJ(p, 'hipR', 0.05, 0, -0.05);
    setJ(p, 'knL', 0.3 + Math.sin(ph * 2) * 0.1 * power, 0, 0);
    setJ(p, 'knR', 0.3 - Math.sin(ph * 2) * 0.1 * power, 0, 0);
    setJ(p, 'ftL', 0.65, 0, 0);
    setJ(p, 'ftR', 0.65, 0, 0);
    return p;
  },
  // sitter skrevs på brettet og venter: beina henger i vannet og padler sakte, armene hviler på lårene
  sit(p, t, turn = 0) {
    p.fill(0);
    const kick = Math.sin(t * 1.3), look = Math.sin(t * 0.33) * 0.5 + Math.sin(t * 0.13) * 0.3;
    setJ(p, 'hipL', -1.25, 0, 0.55);
    setJ(p, 'hipR', -1.25, 0, -0.55);
    setJ(p, 'knL', 1.25 + kick * 0.25 + turn * 0.3, 0, 0);
    setJ(p, 'knR', 1.25 - kick * 0.25 - turn * 0.3, 0, 0);
    setJ(p, 'ftL', 0.3, 0, 0);
    setJ(p, 'ftR', 0.3, 0, 0);
    setJ(p, 'torso', 0.12 + Math.sin(t * 2) * 0.015, 0, Math.sin(t * 0.7) * 0.03);
    setJ(p, 'neck', -0.08, look * 0.9, 0);
    setJ(p, 'shL', -0.5, 0, 0.18);
    setJ(p, 'shR', -0.5, 0, -0.18);
    setJ(p, 'elL', -0.9, 0, 0);
    setJ(p, 'elR', -0.9, 0, 0);
    setOffset(p, 0, 0, 0);
    return p;
  },
  // stående på brettet, sidelengs (regular: venstre fot frem). Venstre arm leder mot nesa,
  // høyre arm balanserer bak. lean: -1..1 (positiv = mot tå-railen), crouch: 0..1.
  // o: { wob, trick, trickK, hipShift, hipDrop, balance, armErr, headTurn, level: [roll, pitch] }
  // Beina settes her bare grovt – plantFeet() legger føttene nøyaktig på brettet etterpå.
  stance(p, lean, crouch, t, pump = 0, o = {}) {
    p.fill(0);
    const pumpW = pump * Math.sin(t * 7);
    const c = 0.25 + crouch * 0.55 + pump * 0.25 * pumpW;
    const toe = Math.max(0, lean), heel = Math.max(0, -lean);
    const wob = Math.min(1, Math.abs(o.wob || 0));
    const bal = Math.min(1.4, o.balance || 0);
    const armErr = o.armErr || 0;
    // bena sprikes langs karakterens x-akse (mot nese/hale)
    setJ(p, 'hipL', -c * 0.55 - heel * 0.15, 0, 0.42);
    setJ(p, 'hipR', -c * 0.55 - heel * 0.15, 0, -0.42);
    setJ(p, 'knL', c * 1.05 + toe * 0.15, 0, 0);
    setJ(p, 'knR', c * 1.05 + toe * 0.25, 0, 0);
    setJ(p, 'ftL', -c * 0.5, -0.1, -0.42);
    setJ(p, 'ftR', -c * 0.5, 0.1, 0.42);
    // Brettet ruller allerede inn i svingen, så kroppen trenger bare litt ekstra bøy i forhold til brettet.
    // Bekkenet vippes litt, overkroppen bøyer seg inn og skuldrene roterer dit man skal.
    setJ(p, 'hips', c * 0.08 + toe * 0.05, 0, 0);
    const wgt = o.weight || 0;
    setJ(p, 'torso', 0.1 + c * 0.24 + toe * 0.14 - heel * 0.12 + bal * 0.1 + wgt * 0.6, 0.32 + lean * (o.twist ?? 0.38) + (o.leadTwist || 0), lean * 0.08);
    // hodet: ser mot nesa og inn i svingen, holdes delvis vatter når brettet heller
    const lv = o.level || [0, 0];
    setJ(p, 'neck', -0.2 - c * 0.2 - toe * 0.25 + heel * 0.08 - lv[0], 0.55 + lean * 0.12 + (o.headTurn || 0), lv[1]);
    // små balansebevegelser: armene er aldri helt stille
    const b1 = Math.sin(t * 1.9) * 0.07 + Math.sin(t * 3.3 + 1) * 0.04;
    const b2 = Math.sin(t * 2.3 + 2) * 0.07 + Math.sin(t * 3.7) * 0.04;
    // ubalanse: armene ut til sidene og «padler» i lufta mot feilen
    const flail = bal * Math.sin(t * 6.5) * 0.25;
    // ledende arm (venstre): ut mot nesa, ned mot vannet på toeside, frem på heelside
    const lx = -0.35 - toe * 0.4 - heel * 0.55 + b1 * 0.5 - armErr + flail;
    const lz = 0.95 - crouch * 0.18 - toe * 0.2 + heel * 0.1 + b1 + wob * 0.35 - pumpW * 0.18 + bal * 0.35;
    // bakre arm (høyre): balanserer, løftes bak på toeside, krysser frem på heelside
    const rx = -0.12 + toe * 0.45 - heel * 0.85 + b2 * 0.5 - armErr - flail;
    const rz = -0.72 + crouch * 0.1 - toe * 0.4 + heel * 0.38 - b2 - wob * 0.4 + pumpW * 0.18 - bal * 0.5;
    setJ(p, 'shL', lx, 0.15, lz);
    setJ(p, 'shR', rx, -0.15, rz);
    setJ(p, 'elL', -0.4 - heel * 0.35 - wob * 0.2 - bal * 0.2, 0, 0);
    setJ(p, 'elR', -0.55 - heel * 0.45 + toe * 0.25 - bal * 0.2, 0, 0);
    // hoftene senkes ved knebøy og flyttes mot tå/hæl-railen i svinger
    // hoftene senkes ved knebøy, flyttes mot tå/hæl-railen i svinger og mot fremre/bakre fot med vekten
    setOffset(p, wgt, o.hipDrop !== undefined ? -o.hipDrop : -c * 0.32 - toe * 0.04, o.hipShift || 0);
    const tr = o.trick, k = o.trickK || 0;
    if (tr && k > 0) Poses.trick(p, tr, k, t);
    return p;
  },
  // triks-poser blandet inn over stance (k: 0..1)
  trick(p, tr, k, t) {
    const q = newPose();
    q.set(p);
    if (tr === 'air' || tr === 'grab') {
      // knærne trekkes opp i lufta
      setJ(q, 'hipL', -1.25, 0, 0.42);
      setJ(q, 'hipR', -1.25, 0, -0.42);
      setJ(q, 'knL', 1.9, 0, 0);
      setJ(q, 'knR', 1.9, 0, 0);
      setJ(q, 'ftL', -0.5, -0.1, -0.42);
      setJ(q, 'ftR', -0.5, 0.1, 0.42);
      setJ(q, 'torso', 0.55, 0.3, 0);
      setJ(q, 'neck', -0.4, 0.6, 0);
      setOffset(q, 0, -0.38, 0);
      if (tr === 'grab') {
        // bakre hånd griper railen foran tærne, ledende arm strekkes stilig opp
        setJ(q, 'shR', -1.15, 0, -0.1);
        setJ(q, 'elR', -0.15, 0, 0);
        setJ(q, 'shL', -0.2, 0.2, 2.1 + Math.sin(t * 6) * 0.08);
        setJ(q, 'elL', -0.2, 0, 0);
      } else {
        setJ(q, 'shL', -0.5, 0.15, 1.35);
        setJ(q, 'shR', -0.3, -0.15, -1.3);
        setJ(q, 'elL', -0.5, 0, 0);
        setJ(q, 'elR', -0.5, 0, 0);
      }
    } else if (tr === 'hang') {
      // hang ten: føttene samlet på nesa, svai i ryggen og armene bak
      setJ(q, 'hipL', -0.05, 0, 0.06);
      setJ(q, 'hipR', -0.05, 0, -0.06);
      setJ(q, 'knL', 0.25, 0, 0);
      setJ(q, 'knR', 0.25, 0, 0);
      setJ(q, 'ftL', -0.1, 0, 0);
      setJ(q, 'ftR', -0.1, 0, 0);
      setJ(q, 'hips', 0, 1.45, 0);
      setJ(q, 'torso', -0.18, 0, 0);
      setJ(q, 'neck', 0.12, Math.sin(t * 0.9) * 0.15, 0);
      setJ(q, 'shL', 0.55, 0, 0.45 + Math.sin(t * 2.1) * 0.05);
      setJ(q, 'shR', 0.55, 0, -0.45 - Math.sin(t * 2.4) * 0.05);
      setJ(q, 'elL', -0.15, 0, 0);
      setJ(q, 'elR', -0.15, 0, 0);
      setOffset(q, 0, -0.08, 0);
    } else if (tr === 'cutback') {
      // cutback: lav, vekten bak, skuldrene roterer tilbake mot curlen og ledende arm peker dit
      setJ(q, 'torso', 0.55, -0.55, 0.12);
      setJ(q, 'neck', -0.3, -0.45, 0);
      setJ(q, 'shL', -0.9, 0.2, 1.25);
      setJ(q, 'shR', -0.2, -0.1, -1.0);
      setJ(q, 'elL', -0.25, 0, 0);
      setJ(q, 'elR', -0.7, 0, 0);
      setJ(q, 'hips', 0.1, -0.25, 0);
      setOffset(q, -0.08, -0.4, 0.06);
    } else if (tr === 'floater') {
      // floater: bred og lav på toppen av skummet, armene ut som vinger for balansen
      setJ(q, 'torso', 0.45, 0.25, 0);
      setJ(q, 'neck', -0.25, 0.75, 0);
      setJ(q, 'shL', -0.3, 0.1, 1.45 + Math.sin(t * 5) * 0.12);
      setJ(q, 'shR', -0.3, -0.1, -1.45 - Math.sin(t * 5.6) * 0.12);
      setJ(q, 'elL', -0.25, 0, 0);
      setJ(q, 'elR', -0.25, 0, 0);
      setOffset(q, 0.05, -0.36, 0);
    } else if (tr === 'tube') {
      // tube: helt sammenkrøpet, bakre hånd sleper i veggen, blikket mot utgangen
      setJ(q, 'torso', 0.85, 0.15, 0.1);
      setJ(q, 'neck', -0.55, 0.85, 0);
      setJ(q, 'shL', -1.2, 0.1, 0.7);
      setJ(q, 'shR', 0.3, 0, -0.9 - Math.sin(t * 3) * 0.06);
      setJ(q, 'elL', -0.8, 0, 0);
      setJ(q, 'elR', -0.25, 0, 0);
      setOffset(q, -0.04, -0.5, 0);
    } else if (tr === 'superman') {
      // superman: holder brettet med begge hender og strekker bena bak i lufta
      setJ(q, 'torso', 1.2, 0.25, 0);
      setJ(q, 'neck', -0.9, 0.5, 0);
      setJ(q, 'shL', -1.4, 0, 0.2);
      setJ(q, 'shR', -1.4, 0, -0.2);
      setJ(q, 'elL', -0.1, 0, 0);
      setJ(q, 'elR', -0.1, 0, 0);
      setJ(q, 'hipL', 0.9, 0, 0.3);
      setJ(q, 'hipR', 0.9, 0, -0.3);
      setJ(q, 'knL', 0.2, 0, 0);
      setJ(q, 'knR', 0.2, 0, 0);
      setJ(q, 'ftL', 0.5, 0, 0);
      setJ(q, 'ftR', 0.5, 0, 0);
      setOffset(q, -0.1, -0.2, 0);
    } else if (tr === 'snap') {
      // eksplosiv vridning: armene kastes rundt
      setJ(q, 'torso', 0.55, -0.35, 0);
      setJ(q, 'shL', -1.3, 0.3, 0.6);
      setJ(q, 'shR', 0.6, -0.2, -1.4);
      setJ(q, 'elL', -0.3, 0, 0);
      setJ(q, 'elR', -0.3, 0, 0);
      setJ(q, 'knL', 1.2, 0, 0);
      setJ(q, 'knR', 1.5, 0, 0);
      setOffset(q, 0, -0.35, 0);
    }
    blendPose(p, p, q, k);
    return p;
  },
  // duck dive: push = armene strekkes og presser nesa ned, sink = kneet presser halen ned og det andre
  // beinet sparkes opp, rise = nesa opp og kroppen følger oppdriften opp igjen
  duck(p, push, sink = 0, rise = 0, t = 0) {
    Poses.paddle(p, 0.6, 0, 0);
    const hold = 1 - rise;
    // hendene på railene ved brystet → strake armer som presser brettet ned
    setJ(p, 'shL', lerp(-1.25, -1.75, push), 0, 0.32);
    setJ(p, 'shR', lerp(-1.25, -1.75, push), 0, -0.32);
    setJ(p, 'elL', lerp(-1.4, -0.15, push) * hold + -0.5 * rise, 0, 0);
    setJ(p, 'elR', lerp(-1.4, -0.15, push) * hold + -0.5 * rise, 0, 0);
    // brystet løftes over armene mens man presser, så legger man seg tett ned på brettet under vann
    setJ(p, 'torso', lerp(-0.2, -0.55, push) * (1 - sink * 0.7) * hold, 0, 0);
    setJ(p, 'neck', lerp(-0.6, -0.1, sink) - rise * 0.6, 0, 0);
    // kneet på halen, det andre beinet strekkes opp og bak som motvekt
    setJ(p, 'hipL', -1.1 * sink * hold, 0, 0.1);
    setJ(p, 'knL', (0.4 + 1.5 * sink) * hold + 0.3 * rise, 0, 0);
    setJ(p, 'hipR', 0.45 * sink * hold + Math.sin(t * 5) * 0.05 * sink, 0, -0.08);
    setJ(p, 'knR', 0.15 + 0.2 * rise, 0, 0);
    setJ(p, 'ftR', 0.9, 0, 0);
    return p;
  },
  tumble(p, t) {
    p.fill(0);
    setJ(p, 'shL', Math.sin(t * 9) * 1.4 - 1.2, 0, 0.8);
    setJ(p, 'shR', Math.cos(t * 8) * 1.4 - 1.2, 0, -0.8);
    setJ(p, 'hipL', -0.8 + Math.sin(t * 7) * 0.6, 0, 0.3);
    setJ(p, 'hipR', -0.3 + Math.cos(t * 6) * 0.6, 0, -0.3);
    setJ(p, 'knL', 1.2, 0, 0);
    setJ(p, 'knR', 0.8, 0, 0);
    setJ(p, 'torso', 0.5, 0, Math.sin(t * 5) * 0.4);
    return p;
  },
  shop(p, t) {
    Poses.idle(p, t);
    setJ(p, 'shR', -0.3, 0, -0.25);
    setJ(p, 'elR', -1.6, 0, 0);
    addJ(p, 'neck', 0, -Math.sin(t * 0.7) * 0.2, 0);
    return p;
  },
};

// ---------- fotplassering (enkel analytisk IK for to-ledds bein) ----------
// Rotasjonsmatrise (rad-major) i samme rekkefølge som Node: R = Ry · Rx · Rz
function rotM(rx, ry, rz) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  return [
    cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx,
    cx * sz, cx * cz, -sx,
    -sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx,
  ];
}
function mulM(a, b) {
  const o = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return o;
}
const trM = (a) => [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
const mulV = (a, v) => [a[0] * v[0] + a[1] * v[1] + a[2] * v[2], a[3] * v[0] + a[4] * v[1] + a[5] * v[2], a[6] * v[0] + a[7] * v[1] + a[8] * v[2]];
const eulerM = (r) => [Math.asin(Math.max(-1, Math.min(1, -r[5]))), Math.atan2(r[2], r[8]), Math.atan2(r[3], r[4])];

const THIGH = 0.42, SHIN = 0.42;
// Plasserer føttene på målpunkter i karakterens rotrom (y = 0 er brettets overflate) og
// vinkler dem flatt mot brettet. w (0..1) blander IK-løsningen inn over posen som allerede står i p.
export function plantFeet(p, front, back, frontYaw, backYaw, w = 1) {
  if (w <= 0) return p;
  const o = J.length * 3;
  const hipsPos = [p[o], 0.95 + p[o + 1], p[o + 2]];
  const hi = JI.hips * 3;
  const Rh = rotM(p[hi], p[hi + 1], p[hi + 2]);
  const RhT = trM(Rh);
  const legs = [['hipL', 'knL', 'ftL', 0.095, front, frontYaw], ['hipR', 'knR', 'ftR', -0.095, back, backYaw]];
  for (const [hip, kn, ft, hx, tgt, yaw] of legs) {
    const hl = mulV(Rh, [hx, -0.07, 0]);
    const v = mulV(RhT, [tgt[0] - hipsPos[0] - hl[0], tgt[1] - hipsPos[1] - hl[1], tgt[2] - hipsPos[2] - hl[2]]);
    const D = Math.min(Math.max(Math.hypot(v[0], v[1], v[2]), 0.3), (THIGH + SHIN) * 0.995);
    const cosK = (THIGH * THIGH + SHIN * SHIN - D * D) / (2 * THIGH * SHIN);
    const k = Math.PI - Math.acos(Math.max(-1, Math.min(1, cosK)));
    const y0 = -(THIGH + SHIN * Math.cos(k)), z0 = -SHIN * Math.sin(k);
    const c = Math.asin(Math.max(-1, Math.min(1, v[0] / -y0)));
    let a = Math.atan2(v[2], v[1]) - Math.atan2(z0, y0 * Math.cos(c));
    a = Math.atan2(Math.sin(a), Math.cos(a));
    // foten flat mot brettet: R_fot = (R_hofter · R_hofte · R_kne)ᵀ · Ry(yaw)
    const Rshin = mulM(mulM(Rh, rotM(a, 0, c)), rotM(k, 0, 0));
    const fe = eulerM(mulM(trM(Rshin), rotM(0, yaw, 0)));
    const blend = (name, x, y, z) => {
      const i = JI[name] * 3;
      p[i] += (x - p[i]) * w;
      p[i + 1] += (y - p[i + 1]) * w;
      p[i + 2] += (z - p[i + 2]) * w;
    };
    blend(hip, a, 0, c);
    blend(kn, k, 0, 0);
    blend(ft, fe[0], fe[1], fe[2]);
  }
  return p;
}
