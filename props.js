// Strandmiljøet: palmer, surfehytte, bål, håndklær, parasoller, steiner, skjell, skilt og liv.
import { Node, mulberry32, fbm, smoothstep, mat4 } from '../engine/math.js';
import { Mesh, makeMaterial } from '../engine/renderer.js';
import { Geo, box, cylinder, sphere, lathe, tube, extrude, blob, plane, hex, mixColor } from '../engine/geometry.js';
import { groundHeight, shoreZ } from './terrain.js';
import { signTexture, towelTexture, canvas } from '../textures.js';
import { BOARDS, buildBoardGeo, buildFinsGeo, boardCanvas } from '../player/boards.js';
import { OUTFITS, printCanvas } from '../player/outfits.js';

const G = (x, z) => groundHeight(x, z);

export const SHOP = { x: -24, z: 26, counter: { x: -24, z: 21.6 }, standYaw: 0 };
export const FIRE = { x: 15, z: 25 };
export const START = { x: 3, z: 15, yaw: Math.PI };

function palm(geo, wgeo, x, z, h, lean, rnd) {
  const by = G(x, z) - 0.25;
  const lx = lean[0], lz = lean[1];
  const pts = [];
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const curve = t * t;
    pts.push([x + lx * h * 0.38 * curve + lx * h * 0.05 * t, by + h * t, z + lz * h * 0.38 * curve + lz * h * 0.05 * t]);
  }
  const radii = pts.map((_, i) => {
    const t = i / N;
    return 0.16 + 0.12 * Math.pow(1 - t, 3) - t * 0.02;
  });
  const trunk = tube(pts, radii, 8, [1, 1, 1], (t) => (Math.floor(t * 22) % 2 ? hex('#8c6b48') : hex('#a88660')));
  trunk.windFn((px, py) => Math.pow(Math.max(0, (py - by) / h), 2) * 0.55);
  wgeo.add(trunk);
  const top = pts[N];
  const nf = 8 + Math.floor(rnd() * 3);
  for (let f = 0; f < nf; f++) {
    const ang = (f / nf) * Math.PI * 2 + rnd() * 0.4;
    const dx = Math.cos(ang), dz = Math.sin(ang);
    const L = 2.6 + rnd() * 1.2;
    const el = 0.35 + rnd() * 0.45;
    const fg = new Geo();
    const S = 10;
    const yellowish = rnd() < 0.15;
    const base = yellowish ? hex('#8a9a35') : hex('#2d7a33');
    const tip = yellowish ? hex('#c9b34a') : hex('#6fc246');
    // sidevektor
    const sx = -dz, sz = dx;
    for (let s = 0; s <= S; s++) {
      const t = s / S;
      const hor = L * t * Math.cos(el);
      const ver = L * t * Math.sin(el) - t * t * L * 0.75;
      const cx = top[0] + dx * hor, cy = top[1] + ver, cz = top[2] + dz * hor;
      const w = 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.6) * (s % 2 ? 1 : 0.62);
      const col = mixColor(base, tip, t);
      const wv = 0.55 + t * 1.1;
      fg.v(cx, cy + 0.06, cz, 0, 1, 0, 0.5, t, col, wv);
      fg.v(cx + sx * w, cy - w * 0.35, cz + sz * w, 0, 1, 0, 0, t, mixColor(col, hex('#1f5a28'), 0.15), wv);
      fg.v(cx - sx * w, cy - w * 0.35, cz - sz * w, 0, 1, 0, 1, t, mixColor(col, hex('#1f5a28'), 0.15), wv);
    }
    for (let s = 0; s < S; s++) {
      const a = s * 3, b = a + 3;
      fg.quad(a, a + 1, b + 1, b);
      fg.quad(a, b, b + 2, a + 2);
    }
    fg.computeNormals();
    wgeo.add(fg);
  }
  for (let k = 0; k < 3; k++) {
    const a = rnd() * 6.28;
    const c = sphere(0.13, 8, 6, '#5b3f22').tf(top[0] + Math.cos(a) * 0.17, top[1] - 0.15, top[2] + Math.sin(a) * 0.17);
    c.windFn(() => 0.55);
    wgeo.add(c);
  }
  return { x, z, r: 0.45 };
}

function rock(geo, x, z, s, rnd, sink = 0.35, ry = 0) {
  const b = blob(s, 2, rnd, 0.4).tf(0, 0, 0, 0, ry, 0, 1, 0.7 + rnd() * 0.3, 1);
  const base = mixColor(hex('#8f8070'), hex('#6f665e'), rnd());
  const moss = hex('#5d8a43');
  b.colorFn((px, py) => mixColor(base, moss, smoothstep(s * 0.45, s * 0.8, py) * (rnd() < 0.6 ? 0.4 : 0)));
  b.tf(x, G(x, z) + s * (0.55 - sink), z);
  geo.add(b);
}

function bush(wgeo, x, z, s, rnd, flowers = true) {
  const y = G(x, z);
  const n = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28, d = rnd() * s * 0.6;
    const r = s * (0.45 + rnd() * 0.35);
    const b = blob(r, 2, rnd, 0.25, [1, 1, 1], true).tf(x + Math.cos(a) * d, y + r * 0.55, z + Math.sin(a) * d);
    const bc = mixColor(hex('#2a6e32'), hex('#4f9a3a'), rnd());
    b.colorFn((px, py) => mixColor(bc, hex('#7cc04a'), smoothstep(y, y + r * 1.6, py) * 0.5));
    b.windFn(() => 0.15);
    wgeo.add(b);
  }
  if (flowers) {
    const fc = ['#ff5e7a', '#ffd84d', '#ff9f45', '#ffffff'][Math.floor(rnd() * 4)];
    for (let i = 0; i < 6; i++) {
      const a = rnd() * 6.28, d = s * (0.5 + rnd() * 0.4);
      const f = sphere(0.08, 6, 4, fc).tf(x + Math.cos(a) * d, y + s * (0.5 + rnd() * 0.6), z + Math.sin(a) * d);
      f.windFn(() => 0.2);
      wgeo.add(f);
    }
  }
}

function grass(wgeo, x, z, rnd) {
  const y = G(x, z) - 0.02;
  const n = 6 + Math.floor(rnd() * 5);
  const g = new Geo();
  for (let i = 0; i < n; i++) {
    const a = rnd() * 6.28, h = 0.35 + rnd() * 0.5;
    const ox = Math.cos(a) * 0.12, oz = Math.sin(a) * 0.12;
    const tx = Math.cos(a) * (0.15 + rnd() * 0.25), tz = Math.sin(a) * (0.15 + rnd() * 0.25);
    const c0 = hex('#4f8f34'), c1 = hex('#b6c95a');
    const i0 = g.v(x + ox - oz * 0.3, y, z + oz + ox * 0.3, 0, 1, 0, 0, 0, c0, 0);
    const i1 = g.v(x + ox + oz * 0.3, y, z + oz - ox * 0.3, 0, 1, 0, 1, 0, c0, 0);
    const i2 = g.v(x + tx * 1.3, y + h, z + tz * 1.3, 0, 1, 0, 0.5, 1, c1, 0.9);
    g.tri(i0, i1, i2);
  }
  wgeo.add(g);
}

function shell(geo, x, z, rnd) {
  const y = G(x, z);
  const t = rnd();
  const cols = ['#ffe3d6', '#ffc2b0', '#fff4e6', '#f7b9c8', '#e8d2b0'];
  const col = cols[Math.floor(rnd() * cols.length)];
  if (t < 0.55) {
    // kamskjell
    const g = lathe([[0, 0], [0.07, 0.008], [0.08, 0.02], [0, 0.03]], 10, col).tf(0, 0, 0, 0, 0, 0, 1, 1, 0.8);
    geo.add(g.tf(x, y - 0.005, z, 0, rnd() * 6, 0));
  } else if (t < 0.8) {
    // sneglehus
    const g = lathe([[0, 0], [0.04, 0.02], [0.03, 0.06], [0.015, 0.1], [0, 0.12]], 8, col);
    geo.add(g.tf(x, y + 0.03, z, 1.4, rnd() * 6, 0));
  } else {
    // sjøstjerne
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, r = i % 2 ? 0.05 : 0.13;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const g = extrude(pts, 0.03, rnd() < 0.5 ? '#ff7a3d' : '#ff5e7a').tf(0, 0, 0, -Math.PI / 2, 0, 0);
    geo.add(g.tf(x, y + 0.01, z, 0, rnd() * 6, 0));
  }
}

function umbrella(geo, x, z, cols, tilt, ry) {
  const y = G(x, z);
  const g = new Geo();
  g.add(cylinder(0.035, 0.035, 2.4, 6, '#f4f0e6'));
  const seg = 10;
  const cone = new Geo();
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const col = hex(cols[i % cols.length]);
    const r = 1.35;
    const t = cone.v(0, 2.55, 0, 0, 1, 0, 0, 0, col);
    const p0 = cone.v(Math.cos(a0) * r, 2.05, Math.sin(a0) * r, 0, 1, 0, 0, 0, col);
    const p1 = cone.v(Math.cos(a1) * r, 2.05, Math.sin(a1) * r, 0, 1, 0, 0, 0, col);
    cone.tri(t, p1, p0);
  }
  const fc = cone.flat();
  g.add(fc);
  g.add(sphere(0.06, 6, 4, '#f4f0e6').tf(0, 2.58, 0));
  g.tf(0, 0, 0, tilt, ry, 0);
  geo.add(g.tf(x, y - 0.3, z));
}

function chair(geo, x, z, ry, col) {
  const y = G(x, z);
  const g = new Geo();
  const wood = '#b98a58';
  g.add(box(0.06, 0.06, 1.3, wood).tf(0.3, 0.25, 0));
  g.add(box(0.06, 0.06, 1.3, wood).tf(-0.3, 0.25, 0));
  for (const zz of [-0.6, 0.6]) for (const xx of [-0.3, 0.3]) g.add(box(0.05, 0.25, 0.05, wood).tf(xx, 0.12, zz));
  g.add(box(0.56, 0.03, 0.85, col).tf(0, 0.3, 0.2));
  g.add(box(0.56, 0.03, 0.75, col).tf(0, 0.55, -0.48, -0.85, 0, 0));
  geo.add(g.tf(x, y, z, 0, ry, 0));
}

function stoneRing(geo, cx, cz, r, n, rnd) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    rock(geo, cx + Math.cos(a) * r, cz + Math.sin(a) * r, 0.22 + rnd() * 0.08, rnd, 0.5);
  }
}

function logBench(geo, x, z, ry, len = 2.2) {
  const y = G(x, z);
  const g = cylinder(0.22, 0.24, len, 10, '#8a6440').tf(0, 0, 0, 0, 0, Math.PI / 2);
  g.add(cylinder(0.2, 0.2, 0.01, 10, '#d9b582').tf(-0.002, 0, 0, 0, 0, Math.PI / 2));
  g.add(cylinder(0.2, 0.2, 0.01, 10, '#d9b582').tf(len + 0.002, 0, 0, 0, 0, Math.PI / 2));
  g.tf(len / 2, 0, 0);
  geo.add(g.tf(x, y + 0.2, z, 0, ry, 0));
}

function shack(geo, wgeo, emis) {
  const { x, z } = SHOP;
  const y = G(x, z);
  const g = new Geo();
  const W = 7.2, D = 5, H = 2.9;
  const plank = (w, h, d, c) => box(w, h, d, c);
  // dekk
  g.add(plank(W + 1.6, 0.25, D + 2.2, '#b07f50').tf(0, 0.4, -0.4));
  for (let i = 0; i < 12; i++) g.add(box(W + 1.6, 0.02, 0.04, '#8c6140').tf(0, 0.53, -0.4 - (D + 2.2) / 2 + (i + 0.5) * ((D + 2.2) / 12)));
  // stolper
  for (const px of [-W / 2, W / 2]) for (const pz of [-D / 2 - 0.9, D / 2]) g.add(cylinder(0.12, 0.14, H + 0.7, 8, '#8a6440').tf(px, 0, pz));
  // vegger (planker i to toner)
  for (let i = 0; i < 9; i++) {
    const c = i % 2 ? '#d7a46a' : '#c99358';
    g.add(box(W, H / 9, 0.12, c).tf(0, 0.55 + (i + 0.5) * (H / 9), D / 2));
    g.add(box(0.12, H / 9, D, c).tf(-W / 2, 0.55 + (i + 0.5) * (H / 9), 0));
    g.add(box(0.12, H / 9, D, c).tf(W / 2, 0.55 + (i + 0.5) * (H / 9), 0));
  }
  // skranke
  g.add(box(W - 0.6, 1.0, 0.5, '#1fa3a8').tf(0, 1.05, -D / 2 + 0.2));
  g.add(box(W - 0.4, 0.08, 0.75, '#e8c58f').tf(0, 1.6, -D / 2 + 0.2));
  for (let i = 0; i < 6; i++) g.add(box(0.5, 0.9, 0.02, i % 2 ? '#ffd27a' : '#ff8a6b').tf(-W / 2 + 0.9 + i * 1.08, 1.05, -D / 2 - 0.06));
  // hyller med kopper og frukt bak skranken
  g.add(box(W - 1, 0.06, 0.4, '#8a6440').tf(0, 2.2, D / 2 - 0.3));
  for (let i = 0; i < 8; i++) g.add(cylinder(0.07, 0.06, 0.16, 8, ['#ff6f59', '#ffd84d', '#13a7b5', '#ffffff'][i % 4]).tf(-2.6 + i * 0.7, 2.23, D / 2 - 0.3));
  g.add(sphere(0.12, 8, 6, '#ffb03a').tf(1.8, 1.72, -D / 2 + 0.25));
  g.add(sphere(0.11, 8, 6, '#ffd84d').tf(2.05, 1.71, -D / 2 + 0.1));
  g.add(sphere(0.13, 8, 6, '#6fbf3c').tf(1.55, 1.73, -D / 2 + 0.1));
  // tak (stråtak) – pyramide med overheng
  const roof = new Geo();
  const rw = W / 2 + 1.1, rd = D / 2 + 1.7, ry = 0.55 + H + 0.2, rh = 1.8;
  const corners = [[-rw, -rd - 0.4], [rw, -rd - 0.4], [rw, rd], [-rw, rd]];
  const ridge = [[-rw * 0.35, 0], [rw * 0.35, 0]];
  const straw = hex('#d8b46a'), straw2 = hex('#c39a4e');
  const tri = (a, b, c, col) => {
    const i0 = roof.v(a[0], a[1], a[2], 0, 1, 0, 0, 0, col), i1 = roof.v(b[0], b[1], b[2], 0, 1, 0, 0, 0, col), i2 = roof.v(c[0], c[1], c[2], 0, 1, 0, 0, 0, col);
    roof.tri(i0, i1, i2);
  };
  const R0 = [ridge[0][0], ry + rh, ridge[0][1] - 0.2], R1 = [ridge[1][0], ry + rh, ridge[1][1] - 0.2];
  const C = corners.map(([a, b]) => [a, ry, b]);
  tri(C[0], R0, C[1], straw); tri(C[1], R0, R1, straw);
  tri(C[1], R1, C[2], straw2);
  tri(C[2], R1, R0, straw); tri(C[2], R0, C[3], straw);
  tri(C[3], R0, C[0], straw2);
  const rf = roof.flat();
  g.add(rf);
  // frynser
  for (let i = 0; i < 46; i++) {
    const t = i / 46;
    const per = 2 * (2 * rw + 2 * rd + 0.4);
    let d = t * per;
    let px, pz;
    const L1 = 2 * rw, L2 = 2 * rd + 0.4;
    if (d < L1) { px = -rw + d; pz = -rd - 0.4; } else if ((d -= L1) < L2) { px = rw; pz = -rd - 0.4 + d; } else if ((d -= L2) < L1) { px = rw - d; pz = rd; } else { d -= L1; px = -rw; pz = rd - d; }
    const fr = box(0.32, 0.35 + (i % 3) * 0.08, 0.05, i % 2 ? '#c9a253' : '#e0bd74').tf(px, ry - 0.15, pz, 0, Math.atan2(pz, px) + Math.PI / 2, 0);
    fr.windFn(() => 0.12);
    wgeo.add(fr.tf(x, y, z));
  }
  // vimpel-girlander
  const flags = new Geo();
  const fcols = ['#ff6f59', '#ffd84d', '#13a7b5', '#ffffff', '#3fae5a'];
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const fx = -W / 2 - 0.2 + t * (W + 0.4);
    const fy = ry - 0.25 - Math.sin(t * Math.PI) * 0.35;
    const c = hex(fcols[i % fcols.length]);
    const a = flags.v(fx - 0.18, fy, -rd - 0.42, 0, 0, -1, 0, 0, c, 0.4);
    const b = flags.v(fx + 0.18, fy, -rd - 0.42, 0, 0, -1, 0, 0, c, 0.4);
    const d2 = flags.v(fx, fy - 0.38, -rd - 0.42, 0, 0, -1, 0, 0, c, 0.9);
    flags.tri(a, d2, b);
  }
  wgeo.add(flags.tf(x, y, z));
  // lyslenke (selvlysende pærer)
  const bulbs = new Geo();
  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    const fx = -W / 2 + t * W;
    const fy = 0.55 + H + 0.05 - Math.sin(t * Math.PI) * 0.4;
    bulbs.add(sphere(0.06, 6, 4, ['#ffe08a', '#ff9f7a', '#9ff2e8', '#fff3c4'][i % 4]).tf(fx, fy, -D / 2 - 0.95));
  }
  emis.add(bulbs.tf(x, y, z));
  geo.add(g.tf(x, y, z));
  return [{ x: x, z: z + 0.5, r: 3.4, box: { minX: x - W / 2 - 0.2, maxX: x + W / 2 + 0.2, minZ: z - D / 2 - 0.2, maxZ: z + D / 2 + 0.2 } }];
}

function lifeguard(geo, wgeo, x, z) {
  const y = G(x, z);
  const g = new Geo();
  const wood = '#f4f0e6';
  for (const px of [-0.9, 0.9]) for (const pz of [-0.9, 0.9]) g.add(cylinder(0.08, 0.08, 2.6, 6, wood).tf(px, 0, pz, pz * 0.06, 0, -px * 0.06));
  g.add(box(2.4, 0.15, 2.4, '#e8543b').tf(0, 2.6, 0));
  g.add(box(2.1, 1.3, 0.08, '#f4f0e6').tf(0, 3.3, 0.95));
  g.add(box(0.08, 1.3, 2.0, '#f4f0e6').tf(-1.0, 3.3, 0));
  g.add(box(0.08, 1.3, 2.0, '#f4f0e6').tf(1.0, 3.3, 0));
  g.add(box(2.1, 0.5, 0.08, '#e8543b').tf(0, 2.95, -0.95));
  g.add(box(2.7, 0.12, 2.7, '#2a7d8f').tf(0, 4.0, 0, 0.12, 0, 0));
  for (let i = 0; i < 7; i++) g.add(box(0.7, 0.06, 0.08, wood).tf(0, 0.3 + i * 0.36, -1.6 + i * 0.1));
  g.add(box(0.06, 2.6, 0.06, wood).tf(-0.35, 1.3, -1.3, -0.3, 0, 0));
  g.add(box(0.06, 2.6, 0.06, wood).tf(0.35, 1.3, -1.3, -0.3, 0, 0));
  g.add(cylinder(0.03, 0.03, 2.0, 5, '#dddddd').tf(1.1, 4.0, -1.1));
  geo.add(g.tf(x, y, z, 0, 0.2, 0));
  const flag = new Geo();
  const c = hex('#e8433a');
  const a = flag.v(0, 0, 0, 0, 0, 1, 0, 0, c, 0.1), b = flag.v(0, -0.5, 0, 0, 0, 1, 0, 0, c, 0.1);
  const d = flag.v(0.9, -0.25, 0, 0, 0, 1, 0, 0, c, 1.2);
  flag.tri(a, b, d);
  wgeo.add(flag.tf(x + 1.1, y + 5.95, z - 1.1, 0, 0.2, 0));
  return { x, z, r: 1.6 };
}

function kayak(geo, x, z, ry) {
  const y = G(x, z);
  const g = lathe([[0, -2], [0.15, -1.6], [0.28, -0.8], [0.32, 0], [0.28, 0.8], [0.15, 1.6], [0, 2]], 12, '#ffcf3a')
    .tf(0, 0, 0, Math.PI / 2, 0, 0, 1, 1, 1).tf(0, 0, 0, 0, 0, 0, 1, 0.55, 1);
  geo.add(g.tf(x, y + 0.15, z, 0, ry, 0));
}

function volleyNet(geo, x, z) {
  const y = G(x, z);
  const g = new Geo();
  g.add(cylinder(0.05, 0.05, 2.5, 6, '#f4f0e6').tf(-4, 0, 0));
  g.add(cylinder(0.05, 0.05, 2.5, 6, '#f4f0e6').tf(4, 0, 0));
  g.add(box(8, 0.06, 0.02, '#ffffff').tf(0, 2.4, 0));
  for (let i = 0; i < 5; i++) g.add(box(8, 0.012, 0.012, '#2a3a40').tf(0, 1.6 + i * 0.18, 0));
  for (let i = 0; i < 24; i++) g.add(box(0.012, 0.8, 0.012, '#2a3a40').tf(-4 + (i + 0.5) * (8 / 24), 2.0, 0));
  g.add(sphere(0.11, 10, 8, '#fff3c4').tf(1.8, 0.11, 1.5));
  geo.add(g.tf(x, y, z, 0, 0.15, 0));
}

function driftwood(geo, x, z, ry, rnd) {
  const y = G(x, z);
  const pts = [];
  for (let i = 0; i <= 6; i++) pts.push([i * 0.55, Math.sin(i * 0.9) * 0.05, Math.sin(i * 1.3) * 0.25]);
  const g = tube(pts, pts.map((_, i) => 0.13 - i * 0.012), 7, '#b8a48c');
  g.add(tube([[1.6, 0, 0], [2.0, 0.1, 0.4], [2.3, 0.15, 0.7]], [0.06, 0.05, 0.03], 5, '#b8a48c'));
  geo.add(g.tf(x, y + 0.07, z, 0, ry, 0));
}

function signPost(r, parent, geo, x, z, ry, lines, opts = {}) {
  const y = G(x, z);
  const h = opts.h || 1.9;
  const w = opts.w || 1.5, hh = opts.hh || 0.75;
  geo.add(cylinder(0.06, 0.07, h, 6, '#8a6440').tf(x, y - 0.2, z));
  const tex = r.texture(signTexture(lines, opts.tex || {}));
  const mesh = new Mesh(r.gl, opts.shape === 'board' ? surfSignGeo(w, hh) : box(w, hh, 0.06));
  const n = new Node(mesh, makeMaterial({ tex, vcol: false, spec: 0.1 }));
  n.set(x, y + h - hh * 0.2, z + 0.05, 0, ry, opts.tilt || 0);
  parent.add(n);
  return { x, z, r: 0.25 };
}

function surfSignGeo(w, h) {
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    pts.push([Math.cos(a) * w * 0.5 * (1 - 0.18 * Math.pow(Math.max(0, Math.cos(a)), 6)), Math.sin(a) * h * 0.5]);
  }
  return extrude(pts, 0.06);
}

export function buildBeach(r) {
  const gl = r.gl;
  const rnd = mulberry32(42);
  const root = new Node();
  const geo = new Geo();
  const wgeo = new Geo();
  const emis = new Geo();
  const colliders = [];

  // ---- palmer ----
  const palmSpots = [];
  for (let i = 0; i < 46; i++) {
    const x = -95 + rnd() * 190;
    const s = 30 + rnd() * 26;
    palmSpots.push([x, shoreZ(x) + s]);
  }
  // noen nær strandkanten for stemning
  palmSpots.push([-38, 20], [-34, 30], [-14, 32], [22, 30], [30, 36], [44, 22], [-52, 15], [62, 18], [8, 36], [-62, 26], [70, 10], [-70, 14]);
  for (const [x, z] of palmSpots) {
    if (Math.hypot(x - SHOP.x, z - SHOP.z) < 7) continue;
    if (Math.hypot(x - FIRE.x, z - FIRE.z) < 4.5) continue;
    const toSea = [0.15 * (rnd() - 0.5), -1];
    const l = Math.hypot(toSea[0], toSea[1]);
    const lean = [toSea[0] / l * (0.4 + rnd() * 0.6), toSea[1] / l * (0.4 + rnd() * 0.6)];
    colliders.push(palm(geo, wgeo, x, z, 6 + rnd() * 4, lean, rnd));
  }
  // palmer på oddene
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1;
    const z = -40 + rnd() * 100;
    const x = side * (98 - 0.3 * z + 8 + rnd() * 20);
    if (G(x, z) < 1) continue;
    palm(geo, wgeo, x, z, 5 + rnd() * 4, [-side * 0.4, -0.5], rnd);
  }

  // ---- jungeltrær på koller og odder ----
  for (let i = 0; i < 170; i++) {
    const x = -150 + rnd() * 300;
    const s = 46 + rnd() * 60;
    let z = shoreZ(x) + s;
    if (Math.abs(x) > 100) z = -60 + rnd() * 150;
    if (z > 118) continue;
    const y = G(x, z);
    if (y < 2) continue;
    const th = 3 + rnd() * 5;
    geo.add(cylinder(0.18, 0.3, th, 6, '#6b4e36').tf(x, y - 0.3, z));
    const n = 3 + Math.floor(rnd() * 3);
    const base = mixColor(hex('#245e2c'), hex('#3d8a3a'), rnd());
    for (let k = 0; k < n; k++) {
      const rr = 1.6 + rnd() * 1.6;
      const a = rnd() * 6.28, d = rnd() * 1.4;
      const b = blob(rr, 2, rnd, 0.22, [1, 1, 1], true).tf(x + Math.cos(a) * d, y + th + rnd() * 1.2, z + Math.sin(a) * d, 0, 0, 0, 1, 0.8, 1);
      b.colorFn((px, py) => mixColor(base, hex('#6fb54a'), smoothstep(y + th - rr, y + th + rr, py) * 0.6));
      b.windFn(() => 0.08);
      wgeo.add(b);
    }
  }

  // ---- busker, gress, blomster ----
  for (let i = 0; i < 90; i++) {
    const x = -105 + rnd() * 210;
    const s = 31 + rnd() * 30;
    const z = shoreZ(x) + s;
    if (Math.hypot(x - SHOP.x, z - SHOP.z) < 6) continue;
    bush(wgeo, x, z, 0.7 + rnd() * 0.9, rnd, rnd() < 0.5);
  }
  for (let i = 0; i < 260; i++) {
    const x = -100 + rnd() * 200;
    const s = 24 + rnd() * 30;
    grass(wgeo, x, shoreZ(x) + s, rnd);
  }

  // ---- steiner ----
  for (let i = 0; i < 70; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const z = -150 + rnd() * 200;
    const bx = 98 - 0.3 * z;
    const x = side * (bx - 12 + rnd() * 14);
    rock(geo, x, z, 1.5 + rnd() * 3.5, rnd, 0.3, rnd() * 6);
  }
  // noen steiner i strandkanten og i vannet ved oddene
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (70 + rnd() * 25);
    const z = shoreZ(x) + (rnd() - 0.6) * 14;
    rock(geo, x, z, 0.5 + rnd() * 1.2, rnd, 0.3, rnd() * 6);
    if (G(x, z) > -0.4) colliders.push({ x, z, r: 0.9 });
  }
  const smallRocks = [[-8, 30], [40, 30], [-46, 24], [52, 26], [26, 22]];
  for (const [x, z] of smallRocks) {
    rock(geo, x, z, 0.5 + rnd() * 0.4, rnd, 0.35);
    colliders.push({ x, z, r: 0.7 });
  }

  // ---- skjell og sjøstjerner ----
  for (let i = 0; i < 140; i++) {
    const x = -75 + rnd() * 150;
    const z = shoreZ(x) + 0.8 + rnd() * 14;
    shell(geo, x, z, rnd);
  }

  // ---- surfehytta ----
  colliders.push(...shack(geo, wgeo, emis));

  // brettstativ ved hytta med alle brettene
  const rackX = SHOP.x + 5.6, rackZ = SHOP.z - 1;
  const ry0 = G(rackX, rackZ);
  geo.add(box(0.12, 1.6, 0.12, '#8a6440').tf(rackX - 1.7, ry0 + 0.8, rackZ + 0.3));
  geo.add(box(0.12, 1.6, 0.12, '#8a6440').tf(rackX + 1.7, ry0 + 0.8, rackZ + 0.3));
  geo.add(box(3.6, 0.1, 0.12, '#8a6440').tf(rackX, ry0 + 1.45, rackZ + 0.3));
  geo.add(box(3.6, 0.1, 0.4, '#8a6440').tf(rackX, ry0 + 0.1, rackZ));
  colliders.push({ x: rackX, z: rackZ, r: 1.9 });
  const rackBoards = [];
  BOARDS.forEach((b, i) => {
    const mesh = new Mesh(gl, buildBoardGeo(b));
    const fins = new Mesh(gl, buildFinsGeo(b));
    const mat = makeMaterial({ tex: r.texture(boardCanvas(b)), vcol: true, spec: 0.6, double: true });
    const n = new Node(mesh, mat);
    n.add(new Node(fins, makeMaterial({ color: hex('#f4f4f4'), vcol: false, spec: 0.5 })));
    n.set(rackX - 1.5 + i * 0.6, ry0 + b.L / 2 + 0.12, rackZ + 0.05, -Math.PI / 2 + 0.17, 0, 0);
    root.add(n);
    rackBoards.push(n);
  });

  // klesstativ med antrekk
  const crX = SHOP.x - 5.4, crZ = SHOP.z - 2.2;
  const cy0 = G(crX, crZ);
  geo.add(cylinder(0.04, 0.04, 1.7, 6, '#ccd2d6').tf(crX - 1.2, cy0, crZ));
  geo.add(cylinder(0.04, 0.04, 1.7, 6, '#ccd2d6').tf(crX + 1.2, cy0, crZ));
  geo.add(cylinder(0.025, 0.025, 2.4, 6, '#ccd2d6').tf(crX - 1.2, cy0 + 1.65, crZ, 0, 0, -Math.PI / 2));
  geo.add(box(2.6, 0.06, 0.7, '#ccd2d6').tf(crX, cy0 + 0.05, crZ));
  colliders.push({ x: crX, z: crZ, r: 1.4 });
  OUTFITS.slice(0, 6).forEach((o, i) => {
    const shirt = new Geo();
    shirt.add(box(0.5, 0.62, 0.05).tf(0, -0.36, 0));
    shirt.add(box(0.2, 0.22, 0.05).tf(0.3, -0.17, 0, 0, 0, 0.6));
    shirt.add(box(0.2, 0.22, 0.05).tf(-0.3, -0.17, 0, 0, 0, -0.6));
    const n = new Node(new Mesh(gl, shirt), makeMaterial({ tex: r.texture(printCanvas(o.print), { repeat: true }), vcol: false, double: true }));
    n.set(crX - 1.0 + i * 0.4, cy0 + 1.62, crZ, 0, Math.PI / 2 - 0.25, 0);
    root.add(n);
  });

  // skilt på hytta
  const shopSign = new Node(new Mesh(gl, box(4.2, 0.95, 0.08)), makeMaterial({
    tex: r.texture(signTexture([{ text: 'BØLGEHYTTA', size: 96, color: '#ffffff' }, { text: 'surf · leie · kaffe', size: 40, color: '#fff3c4', shadow: false }], { bg: '#13a7b5', w: 512, h: 128, gap: 64, wood: false, border: '#ffd27a' })),
    vcol: false, spec: 0.1,
  }));
  shopSign.set(SHOP.x, G(SHOP.x, SHOP.z) + 3.25, SHOP.z - 2.66, 0, Math.PI, 0);
  root.add(shopSign);

  // ---- bålplass ----
  const fy = G(FIRE.x, FIRE.z);
  stoneRing(geo, FIRE.x, FIRE.z, 0.95, 11, rnd);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    geo.add(cylinder(0.08, 0.1, 1.0, 6, '#5a3a22').tf(0, 0, 0, 0, 0, 1.1).tf(FIRE.x + Math.cos(a) * 0.15, fy + 0.05, FIRE.z + Math.sin(a) * 0.15, 0, a, 0));
  }
  geo.add(cylinder(0.65, 0.7, 0.04, 14, '#2b211b').tf(FIRE.x, fy + 0.01, FIRE.z));
  logBench(geo, FIRE.x - 1.1, FIRE.z + 2.6, 0, 2.2);
  logBench(geo, FIRE.x - 2.7, FIRE.z - 1.3, Math.PI / 2 + 0.3, 2.0);
  logBench(geo, FIRE.x + 2.6, FIRE.z + 1.0, -Math.PI / 2 - 0.4, 2.0);
  colliders.push({ x: FIRE.x, z: FIRE.z, r: 1.2 }, { x: FIRE.x, z: FIRE.z + 2.6, r: 1.1 }, { x: FIRE.x - 2.6, z: FIRE.z - 0.7, r: 0.9 }, { x: FIRE.x + 2.5, z: FIRE.z + 0.5, r: 0.9 });
  // tiki-fakler
  const torches = [[SHOP.x - 4.5, SHOP.z - 4.6], [SHOP.x + 4.5, SHOP.z - 4.6], [FIRE.x + 3.5, FIRE.z - 2.5]];
  for (const [tx, tz] of torches) {
    const ty = G(tx, tz);
    geo.add(cylinder(0.05, 0.06, 2.0, 6, '#6b4a2e').tf(tx, ty - 0.2, tz));
    geo.add(cylinder(0.12, 0.07, 0.3, 8, '#c9a253').tf(tx, ty + 1.75, tz));
    colliders.push({ x: tx, z: tz, r: 0.25 });
  }

  // ---- håndklær, parasoller, stoler ----
  const towels = [[29, 14, 0.2, 'a'], [33.5, 15, -0.15, 'b'], [-7, 11.5, 0.4, 'c'], [41, 10, -0.3, 'd'], [-40, 9, 0.1, 'b']];
  for (const [x, z, ry, k] of towels) {
    const n = new Node(new Mesh(gl, plane(1.0, 1.9)), makeMaterial({ tex: r.texture(towelTexture(k)), vcol: false, spec: 0.02, double: true }));
    n.set(x, G(x, z) + 0.025, z, 0, ry, 0);
    root.add(n);
  }
  umbrella(geo, 31.5, 12.8, ['#ff6f59', '#fff3e0'], 0.12, 0.4);
  umbrella(geo, -9, 13.5, ['#13a7b5', '#ffffff'], -0.1, 1.0);
  umbrella(geo, 42.5, 8.4, ['#ffd84d', '#ff9f45'], 0.15, 2.0);
  colliders.push({ x: 31.5, z: 12.8, r: 0.25 }, { x: -9, z: 13.5, r: 0.25 }, { x: 42.5, z: 8.4, r: 0.25 });
  chair(geo, 27, 11.5, 2.9, '#13a7b5');
  chair(geo, 25.6, 11.8, 3.2, '#ff6f59');
  colliders.push({ x: 27, z: 11.5, r: 0.7 }, { x: 25.6, z: 11.8, r: 0.7 });

  // ---- livredderhus, kajakk, volleyball, drivved ----
  colliders.push(lifeguard(geo, wgeo, 56, 9));
  kayak(geo, -33, 17, 0.5);
  colliders.push({ x: -33, z: 17, r: 1.1 }, { x: -34.2, z: 15.3, r: 0.9 }, { x: -31.8, z: 18.7, r: 0.9 });
  volleyNet(geo, 40, 24);
  colliders.push({ x: 36, z: 23.4, r: 0.2 }, { x: 44, z: 24.6, r: 0.2 });
  driftwood(geo, 18, 9, 0.3, rnd);
  driftwood(geo, -55, 12, -0.6, rnd);

  // ---- skilt ----
  colliders.push(signPost(r, root, geo, 6, 8.5, Math.PI + 0.1, [{ text: 'SURFESONE', size: 84, color: '#ffffff' }, { text: '↑ lineup ved revet', size: 46, color: '#fff3c4', shadow: false }], { shape: 'board', w: 1.9, hh: 0.8, tex: { bg: '#ff6f59', w: 512, h: 220, gap: 78, wood: false } }));
  colliders.push(signPost(r, root, geo, -12, 18, Math.PI - 0.5, [{ text: '← BØLGEHYTTA', size: 56 }, { text: 'BÅL →', size: 56, color: '#d8543b' }], { w: 1.6, hh: 0.8, tex: { w: 512, h: 256, gap: 90 } }));
  colliders.push(signPost(r, root, geo, 48, 4.5, Math.PI + 0.3, [{ text: 'SETT HVERT', size: 54 }, { text: '~30 SEKUND', size: 54, color: '#13a7b5' }], { w: 1.3, hh: 0.75, tex: { w: 512, h: 256, gap: 80 } }));

  // ---- fjerne øyer ----
  const isl = [[-420, -760, 60, 30], [-250, -900, 40, 20], [380, -820, 80, 36], [560, -650, 40, 22]];
  for (const [x, z, s, h] of isl) {
    const b = blob(s, 3, rnd, 0.25).tf(x, -s * 0.5 + h * 0.2, z, 0, 0, 0, 1, h / s, 1);
    b.colorFn((px, py) => (py > 2 ? mixColor(hex('#3f7f45'), hex('#5aa85a'), rnd()) : hex('#cdb98a')));
    geo.add(b);
  }

  // ---- monter meshene ----
  const staticNode = new Node(new Mesh(gl, geo), makeMaterial({ spec: 0.12 }));
  const windNode = new Node(new Mesh(gl, wgeo), makeMaterial({ spec: 0.08, wind: 1, double: true }));
  const emisNode = new Node(new Mesh(gl, emis), makeMaterial({ unlit: true, emissive: [0.4, 0.35, 0.2], cast: false }));
  root.add(staticNode);
  root.add(windNode);
  root.add(emisNode);

  // ---- dynamisk: bål og faklenes flammer ----
  const flameGeo = lathe([[0, 0], [0.2, 0.08], [0.16, 0.35], [0.06, 0.7], [0, 0.9]], 8);
  const flameMesh = new Mesh(gl, flameGeo);
  const flames = [];
  const mkFlame = (x, y, z, s, col) => {
    const n = new Node(flameMesh, makeMaterial({ color: hex(col), vcol: false, unlit: true, emissive: hex(col), cast: false }));
    n.set(x, y, z);
    n.scl = [s, s, s];
    n.base = s;
    root.add(n);
    flames.push(n);
  };
  mkFlame(FIRE.x, fy + 0.05, FIRE.z, 1.1, '#ff8a2a');
  mkFlame(FIRE.x + 0.1, fy + 0.05, FIRE.z + 0.05, 0.8, '#ffc845');
  mkFlame(FIRE.x - 0.12, fy + 0.05, FIRE.z - 0.05, 0.65, '#ffe9a0');
  for (const [tx, tz] of torches) {
    const ty = G(tx, tz);
    mkFlame(tx, ty + 2.02, tz, 0.35, '#ff9a3a');
    mkFlame(tx, ty + 2.02, tz, 0.22, '#ffe08a');
  }

  // ---- måker ----
  const gullGeo = new Geo();
  const gw = (s) => {
    const i0 = gullGeo.v(0, 0, 0.12, 0, 1, 0, 0, 0, hex('#ffffff'));
    const i1 = gullGeo.v(0, 0, -0.12, 0, 1, 0, 0, 0, hex('#ffffff'));
    const i2 = gullGeo.v(s * 0.55, 0.08, 0, 0, 1, 0, 0, 0, hex('#d9dde0'));
    const i3 = gullGeo.v(s * 0.95, -0.02, -0.06, 0, 1, 0, 0, 0, hex('#3a3f44'));
    gullGeo.tri(i0, i1, i2);
    gullGeo.tri(i2, i1, i3);
  };
  gw(1);
  const wingR = new Mesh(gl, gullGeo);
  const wingL = new Mesh(gl, gullGeo.clone().tf(0, 0, 0, 0, Math.PI, 0));
  const gullBody = new Mesh(gl, sphere(0.12, 8, 6, '#ffffff').tf(0, 0, 0, 0, 0, 0, 0.8, 0.8, 2.2).add(sphere(0.07, 6, 4, '#ffffff').tf(0, 0.05, 0.25)).add(lathe([[0.025, 0], [0, 0.08]], 5, '#ffb03a').tf(0, 0.04, 0.3, Math.PI / 2, 0, 0)));
  const gulls = [];
  for (let i = 0; i < 6; i++) {
    const n = new Node(gullBody, makeMaterial({ spec: 0.2 }));
    const wl = new Node(wingL, makeMaterial({ spec: 0.1, double: true }));
    const wr = new Node(wingR, makeMaterial({ spec: 0.1, double: true }));
    wl.pos = [-0.05, 0.03, 0];
    wr.pos = [0.05, 0.03, 0];
    n.add(wl);
    n.add(wr);
    n.wl = wl; n.wr = wr;
    n.cx = -40 + rnd() * 80; n.cz = -30 + rnd() * 50; n.rad = 12 + rnd() * 20; n.h = 9 + rnd() * 9; n.sp = (0.12 + rnd() * 0.12) * (rnd() < 0.5 ? -1 : 1); n.ph = rnd() * 6.28;
    root.add(n);
    gulls.push(n);
  }

  // ---- krabber ----
  const crabGeo = sphere(0.12, 8, 6, '#ff6a3d').tf(0, 0.08, 0, 0, 0, 0, 1.3, 0.6, 1);
  for (let k = 0; k < 3; k++) {
    const s = k ? 1 : -1;
    crabGeo.add(cylinder(0.015, 0.015, 0.14, 4, '#e8543b').tf(s * 0.12, 0.06, 0.05 * k - 0.05, 0, 0, s * 1.2));
  }
  crabGeo.add(sphere(0.05, 6, 4, '#ff6a3d').tf(0.15, 0.08, 0.12));
  crabGeo.add(sphere(0.05, 6, 4, '#ff6a3d').tf(-0.15, 0.08, 0.12));
  crabGeo.add(sphere(0.018, 5, 4, '#111111').tf(0.04, 0.15, 0.1));
  crabGeo.add(sphere(0.018, 5, 4, '#111111').tf(-0.04, 0.15, 0.1));
  const crabMesh = new Mesh(gl, crabGeo);
  const crabs = [];
  for (let i = 0; i < 5; i++) {
    const n = new Node(crabMesh, makeMaterial({ spec: 0.4 }));
    const x = -30 + rnd() * 70;
    n.homeX = x; n.homeZ = shoreZ(x) + 3 + rnd() * 6;
    n.pos = [n.homeX, G(n.homeX, n.homeZ), n.homeZ];
    n.tx = n.homeX; n.tz = n.homeZ; n.wait = rnd() * 3;
    root.add(n);
    crabs.push(n);
  }

  function update(dt, t, player) {
    for (const [i, f] of flames.entries()) {
      const k = 1 + Math.sin(t * 13 + i * 2.1) * 0.08 + Math.sin(t * 7.3 + i) * 0.08;
      f.scl[0] = f.base * (1 - (k - 1) * 0.6);
      f.scl[2] = f.scl[0];
      f.scl[1] = f.base * k * (1 + Math.sin(t * 21 + i) * 0.05);
      f.rot[1] = t * (1 + i * 0.3);
      f.rot[0] = Math.sin(t * 3 + i) * 0.06;
    }
    for (const g of gulls) {
      g.ph += g.sp * dt;
      const x = g.cx + Math.cos(g.ph) * g.rad, z = g.cz + Math.sin(g.ph) * g.rad * 0.6;
      g.pos = [x, g.h + Math.sin(t * 0.7 + g.cx) * 0.6, z];
      const dx = -Math.sin(g.ph) * Math.sign(g.sp), dz = Math.cos(g.ph) * 0.6 * Math.sign(g.sp);
      g.rot[1] = Math.atan2(dx, dz);
      g.rot[2] = -Math.sign(g.sp) * 0.25;
      const flap = Math.sin(t * 6 + g.cx) * 0.5 * (0.5 + 0.5 * Math.sin(t * 0.8 + g.cz));
      g.wl.rot[2] = -flap;
      g.wr.rot[2] = flap;
    }
    for (const c of crabs) {
      const dpx = player.x - c.pos[0], dpz = player.z - c.pos[2];
      const near = Math.hypot(dpx, dpz) < 3.5;
      c.wait -= dt;
      if (near) {
        // løp sidelengs vekk
        const l = Math.hypot(dpx, dpz) || 1;
        c.tx = c.pos[0] - (dpx / l) * 3;
        c.tz = c.pos[2] - (dpz / l) * 3;
        c.wait = 2;
      } else if (c.wait <= 0) {
        c.tx = c.homeX + (Math.random() - 0.5) * 6;
        c.tz = c.homeZ + (Math.random() - 0.5) * 3;
        c.wait = 2 + Math.random() * 4;
      }
      const dx = c.tx - c.pos[0], dz = c.tz - c.pos[2];
      const d = Math.hypot(dx, dz);
      if (d > 0.05) {
        const sp = Math.min(d, (near ? 3.2 : 0.9) * dt);
        c.pos[0] += (dx / d) * sp;
        c.pos[2] += (dz / d) * sp;
        c.rot[1] = Math.atan2(dx, dz) + Math.PI / 2; // krabber går sidelengs
        c.pos[1] = G(c.pos[0], c.pos[2]) + Math.abs(Math.sin(t * 30)) * 0.02;
      }
    }
  }

  return { root, colliders, update, rackBoards, flames };
}
