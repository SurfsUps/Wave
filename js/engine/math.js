// Små matte-hjelpere (kolonne-major 4x4 matriser, som i WebGL)

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
export const dampAngle = (a, b, rate, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-rate * dt));

// Deterministisk tilfeldighet (for stabil verden mellom innlastinger)
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Verdi-støy 2D
function hash2(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967295;
}
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise2(x * f, y * f);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

export const mat4 = {
  create() {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  },
  identity(m) {
    m.fill(0);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  },
  copy(o, a) {
    o.set(a);
    return o;
  },
  multiply(o, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return o;
  },
  perspective(o, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    o.fill(0);
    o[0] = f / aspect;
    o[5] = f;
    o[10] = (far + near) * nf;
    o[11] = -1;
    o[14] = 2 * far * near * nf;
    return o;
  },
  ortho(o, l, r, b, t, n, f) {
    const lr = 1 / (l - r), bt = 1 / (b - t), nf = 1 / (n - f);
    o.fill(0);
    o[0] = -2 * lr;
    o[5] = -2 * bt;
    o[10] = 2 * nf;
    o[12] = (l + r) * lr;
    o[13] = (t + b) * bt;
    o[14] = (f + n) * nf;
    o[15] = 1;
    return o;
  },
  lookAt(o, eye, c, up) {
    let zx = eye[0] - c[0], zy = eye[1] - c[1], zz = eye[2] - c[2];
    let l = Math.hypot(zx, zy, zz) || 1;
    zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz) || 1;
    xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
    o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    o[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    o[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    o[15] = 1;
    return o;
  },
  // R = Ry * Rx * Rz  (yaw, så pitch, så roll)
  compose(o, px, py, pz, rx, ry, rz, sx = 1, sy = 1, sz = 1) {
    const cx = Math.cos(rx), snx = Math.sin(rx);
    const cy = Math.cos(ry), sny = Math.sin(ry);
    const cz = Math.cos(rz), snz = Math.sin(rz);
    const r00 = cy * cz + sny * snx * snz, r01 = -cy * snz + sny * snx * cz, r02 = sny * cx;
    const r10 = cx * snz, r11 = cx * cz, r12 = -snx;
    const r20 = -sny * cz + cy * snx * snz, r21 = sny * snz + cy * snx * cz, r22 = cy * cx;
    o[0] = r00 * sx; o[1] = r10 * sx; o[2] = r20 * sx; o[3] = 0;
    o[4] = r01 * sy; o[5] = r11 * sy; o[6] = r21 * sy; o[7] = 0;
    o[8] = r02 * sz; o[9] = r12 * sz; o[10] = r22 * sz; o[11] = 0;
    o[12] = px; o[13] = py; o[14] = pz; o[15] = 1;
    return o;
  },
  transformPoint(m, x, y, z) {
    return [
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14],
    ];
  },
};

// Scenegraf-node
export class Node {
  constructor(mesh = null, material = null) {
    this.mesh = mesh;
    this.material = material;
    this.pos = [0, 0, 0];
    this.rot = [0, 0, 0]; // x (pitch), y (yaw), z (roll)
    this.scl = [1, 1, 1];
    this.children = [];
    this.visible = true;
    this.local = mat4.create();
    this.world = mat4.create();
    this.parent = null;
  }
  add(c) {
    if (c.parent) c.parent.remove(c);
    c.parent = this;
    this.children.push(c);
    return c;
  }
  remove(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    c.parent = null;
  }
  set(px, py, pz, rx = 0, ry = 0, rz = 0) {
    this.pos[0] = px; this.pos[1] = py; this.pos[2] = pz;
    this.rot[0] = rx; this.rot[1] = ry; this.rot[2] = rz;
    return this;
  }
  update(parentWorld) {
    mat4.compose(this.local, this.pos[0], this.pos[1], this.pos[2], this.rot[0], this.rot[1], this.rot[2], this.scl[0], this.scl[1], this.scl[2]);
    if (parentWorld) mat4.multiply(this.world, parentWorld, this.local);
    else this.world.set(this.local);
    for (const c of this.children) c.update(this.world);
  }
}

// Dempet fjær (implisitt Euler, stabil også ved store dt). freq i Hz, zeta = dempingsforhold
// (1 = kritisk dempet, < 1 gir litt overshoot/svikt). Brukes for myke, fysiske overganger.
export class Spring {
  constructor(x = 0) {
    this.x = x;
    this.v = 0;
  }
  update(target, freq, zeta, dt) {
    const w = Math.PI * 2 * freq;
    const f = 1 + 2 * dt * zeta * w;
    const hoo = dt * w * w;
    const hhoo = dt * hoo;
    const inv = 1 / (f + hhoo);
    const x = (f * this.x + dt * this.v + hhoo * target) * inv;
    this.v = (this.v + hoo * (target - this.x)) * inv;
    this.x = x;
    return x;
  }
  reset(x = 0) {
    this.x = x;
    this.v = 0;
    return this;
  }
}

// Jevn, deterministisk 1D-støy (sum av sinuser med ulike perioder) i området ca. -1..1
export const wobble = (t, seed = 0) =>
  (Math.sin(t * 1.37 + seed) * 0.5 + Math.sin(t * 2.71 + seed * 1.9) * 0.3 + Math.sin(t * 4.43 + seed * 3.1) * 0.2);
