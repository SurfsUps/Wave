// Surfebrett: definisjoner, 3D-geometri (rails, rocker, finner) og teksturer.
import { Geo, earcut, extrude, hex } from '../engine/geometry.js';
import { canvas, drawBoardTop } from '../textures.js';

export const BOARDS = [
  {
    id: 'klassiker', name: "Klassiker 9'2", desc: 'Longboard. Padler lett og glir stødig, men svinger tregere.',
    L: 2.8, W: 0.58, T: 0.075, noseP: 0.42, tailW: 0.62, tail: 'squash', wide: 0.5, fins: 1, rocker: 0.12,
    paint: { base: '#f6ecd2', rails: '#2aa6a0', stripes: ['#e8543b', '#f6ecd2', '#e8543b'], stringer: '#9b6b3c', logo: '#2aa6a0' },
    stats: { paddle: 0.95, speed: 0.72, turn: 0.42 },
  },
  {
    id: 'mango', name: "Mango Fish 5'8", desc: 'Bred, kort fish med svalehale. Leken og rask på små bølger.',
    L: 1.75, W: 0.56, T: 0.065, noseP: 0.62, tailW: 0.66, tail: 'swallow', wide: 0.48, fins: 2, rocker: 0.09,
    paint: { gradient: ['#ffe066', '#ffb03a', '#ff7a3d'], scales: 'rgba(255,255,255,0.55)', stringer: '#ffffff' },
    stats: { paddle: 0.62, speed: 0.78, turn: 0.82 },
  },
  {
    id: 'lyn', name: "Lyn 6'0", desc: 'Spiss shortboard. Krever fart, men carver knivskarpt.',
    L: 1.85, W: 0.48, T: 0.06, noseP: 0.95, tailW: 0.38, tail: 'squash', wide: 0.44, fins: 3, rocker: 0.14,
    paint: { base: '#fbfbf6', bolt: '#ff3d8b', rails: '#222a35', stringer: '#c9b79c' },
    stats: { paddle: 0.45, speed: 0.9, turn: 0.96 },
  },
  {
    id: 'hibiskus', name: "Hibiskus 7'0", desc: 'Allsidig funboard med blomster. Lett å padle, lett å like.',
    L: 2.15, W: 0.55, T: 0.07, noseP: 0.6, tailW: 0.48, tail: 'round', wide: 0.5, fins: 3, rocker: 0.1,
    paint: { base: '#7fd3f0', flowers: '#ff5e7a', rails: '#ffffff', stringer: '#ffffff' },
    stats: { paddle: 0.78, speed: 0.75, turn: 0.66 },
  },
  {
    id: 'teak', name: "Teak Retro 6'6", desc: 'Treinspirert single-fin med pin-hale. Lange, myke carves.',
    L: 2.0, W: 0.52, T: 0.068, noseP: 0.7, tailW: 0.18, tail: 'pin', wide: 0.52, fins: 1, rocker: 0.1,
    paint: { base: '#c98a4b', wood: true, stripes: ['#f6ecd2', '#2a5d6e', '#f6ecd2'], stringer: '#6b3d1c' },
    stats: { paddle: 0.66, speed: 0.86, turn: 0.7 },
  },
  {
    id: 'sol', name: "Solnedgang 6'4", desc: 'Step-up for større dager. Mye fart og grep i bølgeveggen.',
    L: 1.95, W: 0.5, T: 0.064, noseP: 0.88, tailW: 0.34, tail: 'round', wide: 0.45, fins: 3, rocker: 0.13,
    paint: { gradient: ['#6a3fb5', '#ff5fa2', '#ff9f45', '#ffd84d'], palm: '#ffe9a8', stringer: '#ffffff' },
    stats: { paddle: 0.56, speed: 0.96, turn: 0.84 },
  },
  {
    id: 'mais', name: 'Chicken Joes maisbrett', desc: 'Håndlaget av Chicken Joe. Ser ut som en maiskolbe, glir som en drøm. Gir ekstra triks-poeng.',
    L: 2.45, W: 0.56, T: 0.075, noseP: 1.25, tailW: 0.3, tail: 'pin', wide: 0.42, fins: 1, rocker: 0.11,
    paint: { corn: true },
    stats: { paddle: 0.85, speed: 0.92, turn: 0.86 },
    unlock: 2000, trickBonus: 1.25, giver: 'Chicken Joe',
  },
  {
    id: 'isflak', name: "Codys Isflak 6'2", desc: 'Codys eget brett: kvikt, lett og iskaldt blått. Svinger nesten av seg selv.',
    L: 1.88, W: 0.5, T: 0.062, noseP: 0.85, tailW: 0.4, tail: 'squash', wide: 0.45, fins: 3, rocker: 0.13,
    paint: { gradient: ['#f6fcff', '#bfe6f7', '#5bb6e0'], stripes: ['#1d2026', '#f2d64b', '#1d2026'], rails: '#1d2026', stringer: '#ffffff' },
    stats: { paddle: 0.6, speed: 0.88, turn: 0.98 },
    unlock: 3000, trickBonus: 1.15, giver: 'Cody',
  },
  {
    id: 'gull', name: "Gullbølgen 6'8", desc: 'Legendebrettet fra bålet. Glir som smør, holder i de største bølgene og gir ekstra triks-poeng.',
    L: 2.05, W: 0.52, T: 0.066, noseP: 0.8, tailW: 0.32, tail: 'round', wide: 0.46, fins: 3, rocker: 0.12,
    paint: { gradient: ['#fff3b0', '#f2c94c', '#c98a1e'], palm: '#fff8dc', rails: '#8a5a12', stringer: '#fffbe8' },
    stats: { paddle: 0.8, speed: 1.0, turn: 0.9 },
    unlock: 7000, trickBonus: 1.35, giver: 'Chicken Joe',
  },
];

function halfWidth(def, t) {
  const wp = def.wide;
  if (t <= wp) {
    const a = t / wp;
    let tw = def.tailW;
    const s = Math.pow(Math.sin((a * Math.PI) / 2), 0.75);
    return (def.W / 2) * (tw + (1 - tw) * s);
  }
  const a = (t - wp) / (1 - wp);
  return (def.W / 2) * Math.pow(Math.max(0, Math.cos((a * Math.PI) / 2)), def.noseP);
}

export function boardOutline(def, n = 34) {
  const pts = [];
  const L = def.L;
  // høyre side fra hale til nese (x negativ), så venstre side tilbake
  const ts = [];
  for (let i = 0; i <= n; i++) {
    const a = i / n;
    ts.push(0.5 - 0.5 * Math.cos(a * Math.PI)); // tettere i endene
  }
  const right = ts.map((t) => [-halfWidth(def, t), (t - 0.5) * L]);
  const left = ts.slice().reverse().map((t) => [halfWidth(def, t), (t - 0.5) * L]);
  // fjern doble nesepunkter
  left.shift();
  pts.push(...right, ...left);
  if (def.tail === 'swallow') pts.push([0, -L * 0.5 + L * 0.06]);
  else if (def.tail === 'round') {
    // rund hale: legg til punkt litt bak
    pts.push([0, -L * 0.5 - L * 0.012]);
  }
  return pts;
}

function rockerY(def, z) {
  const t = z / def.L + 0.5;
  const nose = Math.pow(Math.max(0, (t - 0.72) / 0.28), 2) * def.rocker;
  const tail = Math.pow(Math.max(0, (0.18 - t) / 0.18), 2) * def.rocker * 0.35;
  return nose + tail;
}

export function buildBoardGeo(def) {
  const g = new Geo();
  const out = boardOutline(def);
  const T = def.T;
  const rings = [
    { s: 0.9, y: 0.004 },
    { s: 1.0, y: T * 0.42 },
    { s: 0.93, y: T * 0.86 },
    { s: 0.8, y: T },
  ];
  const n = out.length;
  const ringIdx = [];
  for (let r = 0; r < rings.length; r++) {
    const R = rings[r];
    const ids = [];
    for (let k = 0; k < n; k++) {
      const [x, z] = out[k];
      const px = x * R.s, pz = z * (R.s > 0.95 ? 1 : 1 - (1 - R.s) * 0.03);
      const y = R.y + rockerY(def, pz);
      // normal ut fra kanten (grovt)
      const a = out[(k + n - 1) % n], b = out[(k + 1) % n];
      let ex = b[1] - a[1], ez = -(b[0] - a[0]);
      const l = Math.hypot(ex, ez) || 1;
      ex /= l; ez /= l;
      // sørg for at normalen peker utover
      if (ex * x + ez * z < 0) { ex = -ex; ez = -ez; }
      const ny = r === 0 ? -0.7 : r === 3 ? 0.8 : r === 2 ? 0.45 : 0;
      const u = px / def.W + 0.5, v = pz / def.L + 0.5;
      ids.push(g.v(px, y, pz, ex * (1 - Math.abs(ny)), ny, ez * (1 - Math.abs(ny)), u, v, [1, 1, 1]));
    }
    ringIdx.push(ids);
  }
  // rail-strimler
  let area = 0;
  for (let k = 0; k < n; k++) {
    const a = out[k], b = out[(k + 1) % n];
    area += a[0] * b[1] - b[0] * a[1];
  }
  for (let r = 0; r < rings.length - 1; r++) {
    for (let k = 0; k < n; k++) {
      const a0 = ringIdx[r][k], a1 = ringIdx[r][(k + 1) % n], b0 = ringIdx[r + 1][k], b1 = ringIdx[r + 1][(k + 1) % n];
      if (area > 0) g.quad(a0, b0, b1, a1);
      else g.quad(a0, a1, b1, b0);
    }
  }
  // topp og bunn
  const tris = earcut(out.map(([x, z]) => [x, z]));
  const top = out.map(([x, z]) => {
    const px = x * 0.8, pz = z;
    return g.v(px, T + rockerY(def, pz) + 0.004, pz, 0, 1, 0, px / def.W + 0.5, pz / def.L + 0.5, [1, 1, 1]);
  });
  const bot = out.map(([x, z]) => {
    const px = x * 0.9, pz = z;
    return g.v(px, rockerY(def, pz), pz, 0, -1, 0, px / def.W + 0.5, pz / def.L + 0.5, [0.92, 0.92, 0.92]);
  });
  // earcut gir CCW i (x,z)-planet; i 3D med y opp må topp ha (a,c,b)-rekkefølge
  for (let k = 0; k < tris.length; k += 3) {
    g.tri(top[tris[k]], top[tris[k + 2]], top[tris[k + 1]]);
    g.tri(bot[tris[k]], bot[tris[k + 1]], bot[tris[k + 2]]);
  }
  return g;
}

export function buildFinsGeo(def) {
  const g = new Geo();
  const fin = (x, z, s, rotY = 0) => {
    const f = extrude([[0, 0], [0.11 * s, 0], [0.02 * s, -0.12 * s]], 0.008, '#ffffff');
    f.tf(0, 0, 0, 0, Math.PI / 2, 0);
    f.tf(x, rockerY(def, z), z, 0, rotY, 0);
    g.add(f);
  };
  const tz = -def.L / 2;
  if (def.fins === 1) fin(0, tz + 0.13, 1.5);
  else if (def.fins === 2) { fin(0.13, tz + 0.15, 1.05, 0.06); fin(-0.13, tz + 0.15, 1.05, -0.06); }
  else { fin(0, tz + 0.09, 0.95); fin(0.14, tz + 0.24, 1.0, 0.07); fin(-0.14, tz + 0.24, 1.0, -0.07); }
  return g;
}

export function boardCanvas(def, w = 128, h = 512) {
  const c = canvas(w, h);
  drawBoardTop(c.getContext('2d'), w, h, def);
  return c;
}

// Ikon for butikken (ovenfra, liggende)
export function boardIcon(def, size = 120) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e9f7f6';
  ctx.fillRect(0, 0, size, size);
  const tex = boardCanvas(def, 64, 256);
  const out = boardOutline(def);
  const scale = (size * 0.88) / 2.9;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(-Math.PI / 4);
  ctx.beginPath();
  out.forEach(([x, z], i) => {
    const px = x * scale, py = -z * scale;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.drawImage(tex, (-def.W / 2) * scale, (-def.L / 2) * scale, def.W * scale, def.L * scale);
  ctx.restore();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(20,50,60,0.35)';
  ctx.stroke();
  ctx.restore();
  return c;
}

export const HEX = hex;
