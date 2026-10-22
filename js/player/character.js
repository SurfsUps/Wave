// Stilisert surfer bygd av enkle former, med ledd for prosedyreanimasjon.
import { Node } from '../engine/math.js';
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
    const b = Math.sin(t * 2.0) * 0.015;
    setJ(p, 'torso', 0.03 + b, 0, 0);
    setJ(p, 'neck', -0.03 - b, Math.sin(t * 0.5) * 0.25, 0);
    setJ(p, 'shL', 0.05, 0, 0.12 + b);
    setJ(p, 'shR', 0.05, 0, -0.12 - b);
    setJ(p, 'elL', -0.15, 0, 0);
    setJ(p, 'elR', -0.15, 0, 0);
    setJ(p, 'hipL', 0, 0, 0.04);
    setJ(p, 'hipR', 0, 0, -0.04);
    setOffset(p, 0, -0.005 + b * 0.3, 0);
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
  paddle(p, ph, power, head = 0) {
    p.fill(0);
    const pl = ph, pr = ph + Math.PI;
    const arm = (q) => -Math.PI + (((q % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
    const amp = 0.35 + power * 0.65;
    const restL = -0.35, restR = -0.35;
    const aL = restL + (arm(pl) - restL) * amp, aR = restR + (arm(pr) - restR) * amp;
    setJ(p, 'shL', aL, 0, 0.35 + Math.sin(pl) * 0.12);
    setJ(p, 'shR', aR, 0, -0.35 - Math.sin(pr) * 0.12);
    setJ(p, 'elL', -0.25 - Math.max(0, Math.sin(pl)) * 0.6 * amp, 0, 0);
    setJ(p, 'elR', -0.25 - Math.max(0, Math.sin(pr)) * 0.6 * amp, 0, 0);
    setJ(p, 'neck', -0.75 - head, 0, 0);
    setJ(p, 'torso', -0.22 - head * 0.3, Math.sin(ph) * 0.06 * power, 0);
    setJ(p, 'hipL', 0.05, 0, 0.07);
    setJ(p, 'hipR', 0.05, 0, -0.07);
    setJ(p, 'knL', 0.35 + Math.sin(ph * 2) * 0.12, 0, 0);
    setJ(p, 'knR', 0.35 - Math.sin(ph * 2) * 0.12, 0, 0);
    setJ(p, 'ftL', 0.6, 0, 0);
    setJ(p, 'ftR', 0.6, 0, 0);
    return p;
  },
  // stående på brettet, sidelengs (regular: venstre fot frem). Venstre arm leder mot nesa,
  // høyre arm balanserer bak. o: { turn, wob, trick, trickK } for armbevegelser og triks.
  stance(p, lean, crouch, t, pump = 0, o = {}) {
    p.fill(0);
    const pumpW = pump * Math.sin(t * 7);
    const c = 0.25 + crouch * 0.55 + pump * 0.25 * pumpW;
    const toe = Math.max(0, lean), heel = Math.max(0, -lean);
    const wob = Math.min(1, Math.abs(o.wob || 0));
    // bena sprikes langs karakterens x-akse (mot nese/hale)
    setJ(p, 'hipL', -c * 0.55 - heel * 0.15, 0, 0.42);
    setJ(p, 'hipR', -c * 0.55 - heel * 0.15, 0, -0.42);
    setJ(p, 'knL', c * 1.05 + toe * 0.15, 0, 0);
    setJ(p, 'knR', c * 1.05 + toe * 0.25, 0, 0);
    setJ(p, 'ftL', -c * 0.5, -0.1, -0.42);
    setJ(p, 'ftR', -c * 0.5, 0.1, 0.42);
    // overkroppen bøyer seg inn i svingen og skuldrene roterer dit man skal
    setJ(p, 'torso', 0.16 + c * 0.32 + toe * 0.42 - heel * 0.12, 0.32 + lean * 0.38, lean * 0.12);
    setJ(p, 'neck', -0.2 - c * 0.2 - toe * 0.25 + heel * 0.08, 0.55 + lean * 0.22, 0);
    // små balansebevegelser: armene er aldri helt stille
    const b1 = Math.sin(t * 1.9) * 0.07 + Math.sin(t * 3.3 + 1) * 0.04;
    const b2 = Math.sin(t * 2.3 + 2) * 0.07 + Math.sin(t * 3.7) * 0.04;
    // ledende arm (venstre): ut mot nesa, ned mot vannet på toeside, frem på heelside
    let lx = -0.35 - toe * 0.75 - heel * 0.55 + b1 * 0.5;
    let lz = 0.95 - crouch * 0.18 - toe * 0.35 + heel * 0.1 + b1 + wob * 0.35 - pumpW * 0.18;
    // bakre arm (høyre): balanserer, løftes bak på toeside, krysser frem på heelside
    let rx = -0.12 + toe * 0.45 - heel * 0.85 + b2 * 0.5;
    let rz = -0.72 + crouch * 0.1 - toe * 0.4 + heel * 0.38 - b2 - wob * 0.4 + pumpW * 0.18;
    setJ(p, 'shL', lx, 0.15, lz);
    setJ(p, 'shR', rx, -0.15, rz);
    setJ(p, 'elL', -0.4 - heel * 0.35 - wob * 0.2, 0, 0);
    setJ(p, 'elR', -0.55 - heel * 0.45 + toe * 0.25, 0, 0);
    setOffset(p, 0, -c * 0.32 - toe * 0.04, 0);
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
  duck(p, k) {
    Poses.paddle(p, 0.6, 0, 0);
    setJ(p, 'shL', -1.5 + 0.3 * k, 0, 0.3);
    setJ(p, 'shR', -1.5 + 0.3 * k, 0, -0.3);
    setJ(p, 'elL', -0.5, 0, 0);
    setJ(p, 'elR', -0.5, 0, 0);
    setJ(p, 'neck', -0.2, 0, 0);
    setJ(p, 'knL', 0.9 * k, 0, 0);
    setJ(p, 'knR', 0.2, 0, 0);
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
