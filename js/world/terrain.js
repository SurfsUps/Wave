// Bukta: sandstrand, grunt vann, rev, odder og jungelkoller.
import { Geo, hex, mixColor } from '../engine/geometry.js';
import { fbm, smoothstep, clamp, noise2 } from '../engine/math.js';

export const WORLD = { minX: -200, maxX: 200, minZ: -280, maxZ: 120 };

export function shoreZ(x) {
  return 4 - 0.0032 * x * x + 1.5 * Math.sin(x * 0.05);
}

function headlandMask(x, z) {
  const bx = 98 - 0.3 * z;
  const q = Math.abs(x) - bx;
  return smoothstep(-8, 14, q) * smoothstep(-210, -150, z);
}

export function groundHeight(x, z) {
  const s = z - shoreZ(x);
  let g;
  if (s >= 0) {
    g = 0.12 + s * 0.05;
    g += smoothstep(26, 44, s) * 1.1 * fbm(x * 0.05, z * 0.05, 3);
    g += smoothstep(38, 80, s) * (7 + 6 * fbm(x * 0.02 + 3, z * 0.02, 4));
    g += (noise2(x * 0.35, z * 0.35) - 0.5) * 0.05; // sandkrusninger
  } else {
    g = -(1 - Math.exp(s / 10)) * 1.1 + s * 0.032;
    // revflekker
    const r = fbm(x * 0.045 + 10, z * 0.045 - 4, 3);
    g += smoothstep(0.62, 0.78, r) * 0.6 * smoothstep(-8, -30, s);
    g = Math.max(g, -9.5);
  }
  const m = headlandMask(x, z);
  if (m > 0) {
    const q = Math.abs(x) - (98 - 0.3 * z);
    const hh = 2.5 + 11 * fbm(x * 0.035, z * 0.035, 4) + q * 0.22;
    g = g + (Math.max(g, hh) - g) * m;
  }
  return g;
}

export function terrainColor(x, z, g, ny) {
  const s = z - shoreZ(x);
  const n = fbm(x * 0.08, z * 0.08, 3);
  const dry = mixColor(hex('#f2d39c'), hex('#f8e2b4'), n);
  const wet = hex('#d2b183');
  const under = mixColor(hex('#e6cf9c'), hex('#cdb98a'), smoothstep(-1, -6, g));
  let c;
  if (s < -0.5) c = under;
  else if (s < 3.5) c = mixColor(wet, dry, smoothstep(0.5, 3.5, s));
  else c = dry;
  // rev / steiner under vann
  if (s < -6) {
    const r = fbm(x * 0.045 + 10, z * 0.045 - 4, 3);
    c = mixColor(c, hex('#8a7a62'), smoothstep(0.6, 0.72, r) * 0.8);
    const sg = fbm(x * 0.03 - 7, z * 0.06, 3);
    c = mixColor(c, hex('#7c9a62'), smoothstep(0.55, 0.7, sg) * 0.45); // sjøgress
  }
  // gress og jungel
  const grassT = smoothstep(30 + n * 8, 40 + n * 8, s);
  if (grassT > 0) {
    const grass = mixColor(hex('#7fae4a'), hex('#5c9a3c'), n);
    const jungle = mixColor(hex('#3f7f33'), hex('#2f6a2d'), fbm(x * 0.1, z * 0.1, 2));
    c = mixColor(c, mixColor(grass, jungle, smoothstep(48, 70, s)), grassT);
  }
  // odder: stein med mose på toppen
  const m = headlandMask(x, z);
  if (m > 0.05) {
    const rock = mixColor(hex('#8d7b6a'), hex('#6e6259'), fbm(x * 0.2, z * 0.2, 2));
    let hc = rock;
    if (ny > 0.8 && g > 4) hc = mixColor(rock, hex('#4f8a3a'), smoothstep(0.8, 0.92, ny));
    c = mixColor(c, hc, smoothstep(0.05, 0.5, m));
  }
  if (ny < 0.72 && s > 30) c = mixColor(c, hex('#7d6a58'), smoothstep(0.72, 0.5, ny));
  return c;
}

// Bakt høydekart for vann-shader og bølgeuttoning
export class HeightField {
  constructor(res = 256) {
    this.res = res;
    this.data = new Float32Array(res * res);
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const x = WORLD.minX + ((WORLD.maxX - WORLD.minX) * i) / (res - 1);
        const z = WORLD.minZ + ((WORLD.maxZ - WORLD.minZ) * j) / (res - 1);
        this.data[j * res + i] = groundHeight(x, z);
      }
    }
  }
  sample(x, z) {
    const r = this.res;
    const fx = clamp(((x - WORLD.minX) / (WORLD.maxX - WORLD.minX)) * (r - 1), 0, r - 1.001);
    const fz = clamp(((z - WORLD.minZ) / (WORLD.maxZ - WORLD.minZ)) * (r - 1), 0, r - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const d = this.data;
    const a = d[j * r + i], b = d[j * r + i + 1], c = d[(j + 1) * r + i], e = d[(j + 1) * r + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v;
  }
  texture(gl) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, this.res, this.res, 0, gl.RED, gl.FLOAT, this.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
}

export function buildTerrainGeo(nx = 300, nz = 300) {
  const g = new Geo();
  const { minX, maxX, minZ, maxZ } = WORLD;
  const H = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = minX + ((maxX - minX) * i) / nx;
      const z = minZ + ((maxZ - minZ) * j) / nz;
      H.push(groundHeight(x, z));
    }
  }
  const dx = (maxX - minX) / nx, dz = (maxZ - minZ) / nz;
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = minX + dx * i, z = minZ + dz * j;
      const h = H[j * (nx + 1) + i];
      const hl = H[j * (nx + 1) + Math.max(0, i - 1)], hr = H[j * (nx + 1) + Math.min(nx, i + 1)];
      const hd = H[Math.max(0, j - 1) * (nx + 1) + i], hu = H[Math.min(nz, j + 1) * (nx + 1) + i];
      let nX = (hl - hr) / (2 * dx), nZ = (hd - hu) / (2 * dz), nY = 1;
      const l = Math.hypot(nX, nY, nZ);
      nX /= l; nY /= l; nZ /= l;
      const c = terrainColor(x, z, h, nY);
      g.v(x, h, z, nX, nY, nZ, x * 0.1, z * 0.1, c, 0);
    }
  }
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      g.i.push(a, c, d, a, d, b);
    }
  }
  return g;
}
