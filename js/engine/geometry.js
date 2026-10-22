// Geometribyggere. Hver Geo har posisjon, normal, farge (rgb + vindvekt), uv og indekser.
import { mat4 } from './math.js';

export function hex(h) {
  if (Array.isArray(h)) return h;
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export function mixColor(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export class Geo {
  constructor() {
    this.p = []; this.n = []; this.c = []; this.uv = []; this.i = [];
  }
  get count() { return this.p.length / 3; }
  v(x, y, z, nx, ny, nz, u = 0, w = 0, col = [1, 1, 1], wind = 0) {
    this.p.push(x, y, z);
    this.n.push(nx, ny, nz);
    this.uv.push(u, w);
    this.c.push(col[0], col[1], col[2], wind);
    return this.count - 1;
  }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  color(col, wind = null) {
    col = hex(col);
    for (let k = 0; k < this.c.length; k += 4) {
      this.c[k] = col[0]; this.c[k + 1] = col[1]; this.c[k + 2] = col[2];
      if (wind !== null) this.c[k + 3] = wind;
    }
    return this;
  }
  // Farge etter funksjon f(x,y,z) -> [r,g,b]
  colorFn(f) {
    for (let k = 0, j = 0; k < this.p.length; k += 3, j += 4) {
      const col = f(this.p[k], this.p[k + 1], this.p[k + 2]);
      this.c[j] = col[0]; this.c[j + 1] = col[1]; this.c[j + 2] = col[2];
    }
    return this;
  }
  windFn(f) {
    for (let k = 0, j = 0; k < this.p.length; k += 3, j += 4) this.c[j + 3] = f(this.p[k], this.p[k + 1], this.p[k + 2]);
    return this;
  }
  transform(m) {
    for (let k = 0; k < this.p.length; k += 3) {
      const x = this.p[k], y = this.p[k + 1], z = this.p[k + 2];
      this.p[k] = m[0] * x + m[4] * y + m[8] * z + m[12];
      this.p[k + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      this.p[k + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      const nx = this.n[k], ny = this.n[k + 1], nz = this.n[k + 2];
      let ax = m[0] * nx + m[4] * ny + m[8] * nz, ay = m[1] * nx + m[5] * ny + m[9] * nz, az = m[2] * nx + m[6] * ny + m[10] * nz;
      const l = Math.hypot(ax, ay, az) || 1;
      this.n[k] = ax / l; this.n[k + 1] = ay / l; this.n[k + 2] = az / l;
    }
    return this;
  }
  // Rask transform: posisjon, rotasjon (x,y,z), skala
  tf(px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    return this.transform(mat4.compose(mat4.create(), px, py, pz, rx, ry, rz, sx, sy, sz));
  }
  add(g) {
    const off = this.count;
    this.p.push(...g.p); this.n.push(...g.n); this.c.push(...g.c); this.uv.push(...g.uv);
    for (const ix of g.i) this.i.push(ix + off);
    return this;
  }
  clone() {
    const g = new Geo();
    g.p = this.p.slice(); g.n = this.n.slice(); g.c = this.c.slice(); g.uv = this.uv.slice(); g.i = this.i.slice();
    return g;
  }
  // Lavpoly-utseende: separate hjørner per trekant med flatenormaler
  flat() {
    const g = new Geo();
    for (let k = 0; k < this.i.length; k += 3) {
      const ids = [this.i[k], this.i[k + 1], this.i[k + 2]];
      const P = ids.map((id) => [this.p[id * 3], this.p[id * 3 + 1], this.p[id * 3 + 2]]);
      const ux = P[1][0] - P[0][0], uy = P[1][1] - P[0][1], uz = P[1][2] - P[0][2];
      const vx = P[2][0] - P[0][0], vy = P[2][1] - P[0][1], vz = P[2][2] - P[0][2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      for (let j = 0; j < 3; j++) {
        const id = ids[j];
        g.p.push(...P[j]);
        g.n.push(nx, ny, nz);
        g.uv.push(this.uv[id * 2], this.uv[id * 2 + 1]);
        g.c.push(this.c[id * 4], this.c[id * 4 + 1], this.c[id * 4 + 2], this.c[id * 4 + 3]);
        g.i.push(g.count - 1);
      }
    }
    return g;
  }
  computeNormals() {
    const n = new Float32Array(this.p.length);
    for (let k = 0; k < this.i.length; k += 3) {
      const a = this.i[k] * 3, b = this.i[k + 1] * 3, c = this.i[k + 2] * 3;
      const ux = this.p[b] - this.p[a], uy = this.p[b + 1] - this.p[a + 1], uz = this.p[b + 2] - this.p[a + 2];
      const vx = this.p[c] - this.p[a], vy = this.p[c + 1] - this.p[a + 1], vz = this.p[c + 2] - this.p[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const id of [a, b, c]) { n[id] += nx; n[id + 1] += ny; n[id + 2] += nz; }
    }
    for (let k = 0; k < n.length; k += 3) {
      const l = Math.hypot(n[k], n[k + 1], n[k + 2]) || 1;
      this.n[k] = n[k] / l; this.n[k + 1] = n[k + 1] / l; this.n[k + 2] = n[k + 2] / l;
    }
    return this;
  }
  // Forskyv hjørner med funksjon
  displace(f) {
    for (let k = 0; k < this.p.length; k += 3) {
      const r = f(this.p[k], this.p[k + 1], this.p[k + 2]);
      this.p[k] = r[0]; this.p[k + 1] = r[1]; this.p[k + 2] = r[2];
    }
    return this;
  }
}

export function box(w, h, d, col = [1, 1, 1]) {
  const g = new Geo();
  const x = w / 2, y = h / 2, z = d / 2;
  const faces = [
    [[1, 0, 0], [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]]],
    [[-1, 0, 0], [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]]],
    [[0, 1, 0], [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]]],
    [[0, -1, 0], [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]]],
    [[0, 0, 1], [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]]],
    [[0, 0, -1], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]]],
  ];
  const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (const [nn, vs] of faces) {
    const ids = vs.map((p, k) => g.v(p[0], p[1], p[2], nn[0], nn[1], nn[2], uvs[k][0], uvs[k][1], hex(col)));
    g.quad(ids[0], ids[1], ids[2], ids[3]);
  }
  return g;
}

// Sylinder fra y=0 til y=h
export function cylinder(rTop, rBot, h, seg = 12, col = [1, 1, 1], caps = true) {
  const g = new Geo();
  col = hex(col);
  const slope = (rBot - rTop) / h;
  for (let k = 0; k <= seg; k++) {
    const a = (k / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const l = Math.hypot(1, slope);
    g.v(ca * rBot, 0, sa * rBot, ca / l, slope / l, sa / l, k / seg, 0, col);
    g.v(ca * rTop, h, sa * rTop, ca / l, slope / l, sa / l, k / seg, 1, col);
  }
  for (let k = 0; k < seg; k++) {
    const a = k * 2;
    g.quad(a, a + 1, a + 3, a + 2);
  }
  if (caps) {
    if (rTop > 0) {
      const c = g.v(0, h, 0, 0, 1, 0, 0.5, 0.5, col);
      const s = g.count;
      for (let k = 0; k <= seg; k++) {
        const a = (k / seg) * Math.PI * 2;
        g.v(Math.cos(a) * rTop, h, Math.sin(a) * rTop, 0, 1, 0, 0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2, col);
      }
      for (let k = 0; k < seg; k++) g.tri(c, s + k + 1, s + k);
    }
    if (rBot > 0) {
      const c = g.v(0, 0, 0, 0, -1, 0, 0.5, 0.5, col);
      const s = g.count;
      for (let k = 0; k <= seg; k++) {
        const a = (k / seg) * Math.PI * 2;
        g.v(Math.cos(a) * rBot, 0, Math.sin(a) * rBot, 0, -1, 0, 0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2, col);
      }
      for (let k = 0; k < seg; k++) g.tri(c, s + k, s + k + 1);
    }
  }
  return g;
}

export function sphere(r, ws = 12, hs = 8, col = [1, 1, 1]) {
  const g = new Geo();
  col = hex(col);
  for (let j = 0; j <= hs; j++) {
    const v = j / hs, th = v * Math.PI;
    for (let k = 0; k <= ws; k++) {
      const u = k / ws, ph = u * Math.PI * 2;
      const x = -Math.cos(ph) * Math.sin(th), y = Math.cos(th), z = Math.sin(ph) * Math.sin(th);
      g.v(x * r, y * r, z * r, x, y, z, u, 1 - v, col);
    }
  }
  for (let j = 0; j < hs; j++) {
    for (let k = 0; k < ws; k++) {
      const a = j * (ws + 1) + k, b = a + ws + 1;
      g.quad(a, b, b + 1, a + 1);
    }
  }
  return g;
}

// Dreid profil: liste med [r, y]
export function lathe(profile, seg = 16, col = [1, 1, 1]) {
  const g = new Geo();
  col = hex(col);
  const n = profile.length;
  for (let k = 0; k <= seg; k++) {
    const a = (k / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    for (let j = 0; j < n; j++) {
      const [r, y] = profile[j];
      const pr = profile[Math.max(0, j - 1)], nx = profile[Math.min(n - 1, j + 1)];
      const dr = nx[0] - pr[0], dy = nx[1] - pr[1];
      let nr = dy, ny = -dr;
      const l = Math.hypot(nr, ny) || 1;
      nr /= l; ny /= l;
      g.v(ca * r, y, sa * r, ca * nr, ny, sa * nr, k / seg, j / (n - 1), col);
    }
  }
  for (let k = 0; k < seg; k++) {
    for (let j = 0; j < n - 1; j++) {
      const a = k * n + j, b = (k + 1) * n + j;
      g.quad(a, a + 1, b + 1, b);
    }
  }
  return g;
}

// Rør langs punkter. radii: tall eller liste
export function tube(points, radii, radial = 8, col = [1, 1, 1], colFn = null) {
  const g = new Geo();
  col = hex(col);
  const n = points.length;
  let prevN = [1, 0, 0];
  for (let j = 0; j < n; j++) {
    const p = points[j];
    const a = points[Math.max(0, j - 1)], b = points[Math.min(n - 1, j + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
    let l = Math.hypot(tx, ty, tz) || 1;
    tx /= l; ty /= l; tz /= l;
    // rammevektorer
    let nx = prevN[1] * tz - prevN[2] * ty, ny = prevN[2] * tx - prevN[0] * tz, nz = prevN[0] * ty - prevN[1] * tx;
    l = Math.hypot(nx, ny, nz);
    if (l < 1e-4) { nx = 0; ny = 0; nz = 1; l = 1; }
    nx /= l; ny /= l; nz /= l;
    const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
    prevN = [bx, by, bz];
    const r = Array.isArray(radii) ? radii[j] : radii;
    const cc = colFn ? colFn(j / (n - 1)) : col;
    for (let k = 0; k <= radial; k++) {
      const ang = (k / radial) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
      const ox = nx * ca + bx * sa, oy = ny * ca + by * sa, oz = nz * ca + bz * sa;
      g.v(p[0] + ox * r, p[1] + oy * r, p[2] + oz * r, ox, oy, oz, k / radial, j / (n - 1), cc);
    }
  }
  for (let j = 0; j < n - 1; j++) {
    for (let k = 0; k < radial; k++) {
      const a = j * (radial + 1) + k, b = a + radial + 1;
      g.quad(a, a + 1, b + 1, b);
    }
  }
  return g;
}

// Øreklipp-triangulering av enkel 2D-polygon (punkter [x,y])
export function earcut(pts) {
  const n = pts.length;
  const idx = [];
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const V = [];
  for (let i = 0; i < n; i++) V.push(area > 0 ? i : n - 1 - i);
  const inside = (p, a, b, c) => {
    const d1 = (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
    const d2 = (p[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (p[1] - c[1]);
    const d3 = (p[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (p[1] - a[1]);
    const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(neg && pos);
  };
  let guard = 0;
  while (V.length > 3 && guard++ < 10000) {
    let clipped = false;
    for (let i = 0; i < V.length; i++) {
      const i0 = V[(i + V.length - 1) % V.length], i1 = V[i], i2 = V[(i + 1) % V.length];
      const a = pts[i0], b = pts[i1], c = pts[i2];
      const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (cross <= 1e-9) continue;
      let ok = true;
      for (const j of V) {
        if (j === i0 || j === i1 || j === i2) continue;
        if (inside(pts[j], a, b, c)) { ok = false; break; }
      }
      if (!ok) continue;
      idx.push(i0, i1, i2);
      V.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (V.length === 3) idx.push(V[0], V[1], V[2]);
  return idx;
}

// Ekstrudert flat form (punkter i xy-planet), tykkelse langs z, sentrert
export function extrude(pts, depth, col = [1, 1, 1]) {
  const g = new Geo();
  col = hex(col);
  const tris = earcut(pts);
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (const p of pts) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
  const U = (x) => (x - minx) / (maxx - minx || 1), W = (y) => (y - miny) / (maxy - miny || 1);
  const z = depth / 2;
  const f = pts.map((p) => g.v(p[0], p[1], z, 0, 0, 1, U(p[0]), W(p[1]), col));
  const b = pts.map((p) => g.v(p[0], p[1], -z, 0, 0, -1, 1 - U(p[0]), W(p[1]), col));
  for (let k = 0; k < tris.length; k += 3) {
    g.tri(f[tris[k]], f[tris[k + 1]], f[tris[k + 2]]);
    g.tri(b[tris[k]], b[tris[k + 2]], b[tris[k + 1]]);
  }
  // sider: orienteringsuavhengig — vi beregner normal utover
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], c = pts[(i + 1) % pts.length];
    area += a[0] * c[1] - c[0] * a[1];
  }
  const sgn = area > 0 ? 1 : -1;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], c = pts[(i + 1) % pts.length];
    let nx = (c[1] - a[1]) * sgn, ny = -(c[0] - a[0]) * sgn;
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;
    const i0 = g.v(a[0], a[1], z, nx, ny, 0, 0, 0, col);
    const i1 = g.v(c[0], c[1], z, nx, ny, 0, 1, 0, col);
    const i2 = g.v(c[0], c[1], -z, nx, ny, 0, 1, 1, col);
    const i3 = g.v(a[0], a[1], -z, nx, ny, 0, 0, 1, col);
    if (sgn > 0) g.quad(i0, i3, i2, i1);
    else g.quad(i0, i1, i2, i3);
  }
  return g;
}

// Enkel plate i xz-planet
export function plane(w, d, col = [1, 1, 1]) {
  const g = new Geo();
  col = hex(col);
  const a = g.v(-w / 2, 0, -d / 2, 0, 1, 0, 0, 0, col);
  const b = g.v(w / 2, 0, -d / 2, 0, 1, 0, 1, 0, col);
  const c = g.v(w / 2, 0, d / 2, 0, 1, 0, 1, 1, col);
  const e = g.v(-w / 2, 0, d / 2, 0, 1, 0, 0, 1, col);
  g.quad(a, e, c, b);
  return g;
}

// Ujevn stein / klump
export function blob(r, detail, rnd, rough = 0.35, col = [1, 1, 1], smooth = false) {
  const g = sphere(r, detail + 3, detail + 1, col);
  const seeds = [rnd() * 10, rnd() * 10, rnd() * 10];
  g.displace((x, y, z) => {
    const l = Math.hypot(x, y, z) || 1;
    const qx = Math.round((x / r) * 500) / 500, qy = Math.round((y / r) * 500) / 500, qz = Math.round((z / r) * 500) / 500;
    const hsh = Math.sin(qx * 12.9898 + qy * 78.233 + qz * 37.719 + seeds[0]) * 437.5453;
    const jitter = hsh - Math.floor(hsh) - 0.5;
    const k = 1 + rough * (Math.sin(x * 3.1 / r + seeds[0]) * 0.5 + Math.sin(y * 2.7 / r + seeds[1]) * 0.35 + Math.sin(z * 3.7 / r + seeds[2]) * 0.4) * 0.6 + jitter * rough * 0.5;
    return [(x / l) * r * k, (y / l) * r * k, (z / l) * r * k];
  });
  if (smooth) return g.computeNormals();
  return g.flat();
}
