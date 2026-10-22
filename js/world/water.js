// Vannflate med bølger, krøllende leppe, skum, gjennomskinnelighet og strandskvulp.
import { Program, COMMON_GLSL } from '../engine/renderer.js';
import { WAVE_GLSL } from './waves.js';
import { WORLD } from './terrain.js';

function smoothstepJS(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

const VS = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
uniform mat4 uVP;
uniform sampler2D uGround;
uniform vec4 uWorld;
${COMMON_GLSL}
${WAVE_GLSL}
out vec3 vW;
out vec3 vN;
out float vFoam;
out float vDepth;
out float vFace;
out vec2 vXZ;
out float vLip;
float groundDepth(vec2 p) {
  vec2 uv = (p - uWorld.xy) / uWorld.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 30.0;
  return -textureLod(uGround, uv, 0.0).r;
}
void main() {
  vec2 p = aPos.xz;
  float depth = groundDepth(p);
  float hsum = swellH(p, uWaveTime) * smoothstep(0.0, 2.0, depth);
  float foam = 0.0, face = 0.0, dz = 0.0, dy = 0.0, lipv = 0.0;
  for (int i = 0; i < MAXW; i++) {
    if (uC[i].y < 0.5) continue;
    float dd = p.y - (uA[i].x - KC * p.x * p.x);
    if (dd < -60.0 || dd > 40.0) continue;
    float h, b, d, Lf, hu, H, ins;
    waveEval(i, p, depth, h, b, d, Lf, hu, H, ins);
    hsum += h;
    float u = p.x - uA[i].z;
    float f = b * (d > 0.0 ? smoothstep(3.6, 0.0, d) : (d > -3.5 ? 1.0 - (-d / 3.5) * 0.25 : exp((d + 3.5) / 9.0) * 0.7));
    float lipA = uC[i].x * (uB[i].z > 0.5 ? exp(-(ins / 3.4) * (ins / 3.4)) : exp(-(u / 7.0) * (u / 7.0)));
    lipA *= (1.0 - b * 0.6) * smoothstep(0.2, 0.8, H);
    f += lipA * smoothstep(-1.0, 0.8, d) * smoothstep(Lf * 1.7, 0.0, d) * 0.75;
    foam = max(foam, f * smoothstep(0.05, 0.4, H + b));
    face = max(face, (1.0 - b) * uA[i].w * hu * smoothstep(-3.0, 0.5, d) * smoothstep(0.3, 1.2, H));
    float r = smoothstep(0.55, 1.0, hu);
    dz += lipA * r * r * H * 0.3;
    dy -= lipA * pow(smoothstep(0.82, 1.0, hu), 3.0) * H * 0.1;
    lipv = max(lipv, lipA * r);
  }
  float e = 0.45;
  float hL = waterHeight(p - vec2(e, 0.0), depth);
  float hR = waterHeight(p + vec2(e, 0.0), depth);
  float hD = waterHeight(p - vec2(0.0, e), depth);
  float hU = waterHeight(p + vec2(0.0, e), depth);
  vN = normalize(vec3(hL - hR, 2.0 * e, hD - hU));
  vec3 wp = vec3(p.x, hsum + dy, p.y + dz);
  vW = wp;
  vFoam = foam;
  vDepth = depth;
  vFace = face;
  vXZ = p;
  vLip = lipv;
  gl_Position = uVP * vec4(wp, 1.0);
}`;

const FS = /* glsl */ `#version 300 es
precision highp float;
in vec3 vW;
in vec3 vN;
in float vFoam;
in float vDepth;
in float vFace;
in vec2 vXZ;
in float vLip;
${COMMON_GLSL}
out vec4 outColor;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
}
float ripple(vec2 p) {
  return vn(p * 0.9 + uTime * vec2(0.35, 0.6)) * 0.6 + vn(p * 2.3 - uTime * vec2(0.5, -0.3)) * 0.3 + vn(p * 5.1 + uTime * 0.9) * 0.1;
}
void main() {
  vec3 V = normalize(uCamPos - vW);
  float dist = length(uCamPos - vW);
  // småkrusninger
  vec2 q = vXZ;
  float e = 0.15;
  float r0 = ripple(q), rx = ripple(q + vec2(e, 0.0)), rz = ripple(q + vec2(0.0, e));
  float rs = mix(0.32, 0.0, smoothstep(8.0, 70.0, dist));
  vec3 N = normalize(vN + vec3(r0 - rx, 0.0, r0 - rz) * rs * 2.2);
  float col = 0.0;
  float water = vDepth + vW.y; // vannsøyle
  vec3 shallow = toLinear(vec3(0.45, 0.9, 0.82));
  vec3 mid = toLinear(vec3(0.05, 0.62, 0.7));
  vec3 deep = toLinear(vec3(0.02, 0.38, 0.56));
  vec3 abyss = toLinear(vec3(0.01, 0.22, 0.42));
  vec3 base = mix(shallow, mid, smoothstep(0.2, 2.2, water));
  base = mix(base, deep, smoothstep(2.2, 6.5, water));
  base = mix(base, abyss, smoothstep(8.0, 25.0, water));
  float ndl = max(dot(N, uSunDir), 0.0);
  vec3 sun = toLinear(uSunCol);
  // bølgefronten er mørkere nede og lysere mot toppen
  float slopeShade = clamp(1.0 - vN.y, 0.0, 1.0);
  base *= mix(1.0, 0.7, smoothstep(0.05, 0.5, slopeShade) * (1.0 - vFace));
  vec3 c = base * (0.45 + 0.7 * ndl) * mix(vec3(1.0), sun, 0.5);
  // gjennomskinnelig bølgetopp (lys gjennom vannet)
  float back = pow(clamp(dot(V, -uSunDir) * 0.5 + 0.5, 0.0, 1.0), 2.0);
  vec3 glow = toLinear(vec3(0.3, 0.98, 0.8));
  c += glow * pow(vFace, 1.5) * (0.3 + 1.2 * back) * 0.8;
  // refleksjon
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  c = mix(c, toLinear(skyColor(R)), fres * 0.85);
  vec3 Hh = normalize(uSunDir + V);
  float sp = pow(max(dot(N, Hh), 0.0), 600.0) * 3.0 + pow(max(dot(N, Hh), 0.0), 40.0) * 0.08;
  c += sun * sp;
  // glitter
  float gl = step(0.985, vn(q * 3.0 + uTime * 1.3)) * pow(max(dot(N, Hh), 0.0), 8.0) * 2.0;
  c += sun * gl * (1.0 - smoothstep(10.0, 50.0, dist));
  // skum
  float fn = vn(q * 0.55 + vec2(0.0, uTime * 0.25)) * 0.55 + vn(q * 1.7 - uTime * 0.3) * 0.3 + vn(q * 4.3) * 0.15;
  float foam = clamp(vFoam, 0.0, 1.2);
  float fn2 = vn(q * 0.22 + vec2(uTime * 0.05, 0.0));
  float lace = abs(fn - 0.5) * 2.0; // aderlignende skumstriper
  float fa = smoothstep(0.0, 0.22, foam * 1.05 - (1.0 - fn) * 0.75 - fn2 * 0.35 - lace * 0.15);
  fa = max(fa, smoothstep(0.82, 1.0, foam) * (0.8 + 0.2 * fn));
  // strandskvulp
  float shoreBand = smoothstep(0.9, 0.0, water);
  float swash = smoothstep(0.55, 0.9, sin(water * 9.0 - uTime * 1.6 + fn * 5.0) * 0.5 + 0.5) * shoreBand;
  swash += smoothstep(0.18, 0.02, water) * 0.8;
  fa = max(fa, clamp(swash, 0.0, 1.0) * smoothstep(0.35, 0.65, fn + 0.25));
  float bub = vn(q * 7.0 + vec2(uTime * 0.4, 0.0)) * 0.5 + vn(q * 15.0 - uTime * 0.7) * 0.5;
  vec3 foamCol = toLinear(vec3(0.97, 0.99, 1.0)) * (0.55 + 0.5 * max(dot(vN, uSunDir), 0.0)) * mix(vec3(1.0), sun, 0.3);
  foamCol *= mix(0.82, 1.06, bub);
  foamCol = mix(foamCol, toLinear(vec3(0.62, 0.9, 0.92)), (1.0 - fa) * 0.6 + (1.0 - fn) * 0.15);
  c = mix(c, foamCol, clamp(fa, 0.0, 1.0));
  float alpha = mix(0.55, 0.97, smoothstep(0.0, 1.8, water));
  alpha = max(alpha, fa);
  alpha *= smoothstep(-0.05, 0.08, water);
  outColor = vec4(tonemap(applyFog(c, vW)), alpha);
}`;


const LIP_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNor;
layout(location=2) in vec2 aInfo;
uniform mat4 uVP;
${COMMON_GLSL}
out vec3 vW;
out vec3 vN;
out vec2 vInfo;
void main() {
  vW = aPos;
  vN = aNor;
  vInfo = aInfo;
  gl_Position = uVP * vec4(aPos, 1.0);
}`;

const LIP_FS = /* glsl */ `#version 300 es
precision highp float;
in vec3 vW;
in vec3 vN;
in vec2 vInfo;
${COMMON_GLSL}
out vec4 outColor;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  float a = vInfo.x, k = vInfo.y;
  if (k < 0.04) discard;
  vec3 V = normalize(uCamPos - vW);
  vec3 N = normalize(vN);
  if (dot(N, V) < 0.0) N = -N;
  vec3 sun = toLinear(uSunCol);
  float back = pow(clamp(dot(V, -uSunDir) * 0.5 + 0.5, 0.0, 1.0), 2.0);
  vec3 body = mix(toLinear(vec3(0.05, 0.6, 0.68)), toLinear(vec3(0.3, 0.98, 0.8)), 0.35 + 0.5 * back);
  vec3 c = body * (0.55 + 0.55 * max(dot(N, uSunDir), 0.0));
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  c = mix(c, toLinear(skyColor(R)), fres * 0.6);
  vec3 H = normalize(uSunDir + V);
  c += sun * pow(max(dot(N, H), 0.0), 120.0) * 2.0;
  float n = vn(vW.xz * 1.3 + vec2(0.0, uTime * 1.5)) * 0.6 + vn(vW.xz * 4.0 + a * 3.0 - uTime) * 0.4;
  float fa = smoothstep(0.45, 0.95, a + (n - 0.5) * 0.5) * (0.55 + 0.45 * k);
  fa = max(fa, (1.0 - smoothstep(0.15, 0.6, k)) * 0.8 * smoothstep(0.2, 0.6, n + a * 0.5));
  vec3 foamCol = toLinear(vec3(0.97, 0.99, 1.0)) * (0.65 + 0.4 * max(dot(N, uSunDir), 0.0)) * mix(vec3(1.0), sun, 0.3);
  c = mix(c, foamCol, clamp(fa, 0.0, 1.0));
  float alpha = mix(0.72, 1.0, fa) * smoothstep(0.04, 0.2, k);
  // fillete, skummende leppekant
  float rag = vn(vW.xz * 2.5 + vec2(uTime * 2.0, 0.0));
  alpha *= 1.0 - smoothstep(0.78 + rag * 0.12, 1.0, a);
  alpha *= smoothstep(2.5, 5.0, length(uCamPos - vW)); // ikke dekk til kameraet
  if (alpha < 0.03) discard;
  outColor = vec4(tonemap(applyFog(c, vW)), alpha);
}`;

function buildGrid(xs, zs) {
  const p = [], idx = [];
  for (const z of zs) for (const x of xs) p.push(x, 0, z);
  const nx = xs.length;
  for (let j = 0; j < zs.length - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx.push(a, c, d, a, d, b);
    }
  }
  return { p, idx };
}
function range(a, b, step) {
  const out = [];
  const n = Math.max(1, Math.round((b - a) / step));
  for (let k = 0; k <= n; k++) out.push(a + ((b - a) * k) / n);
  return out;
}

export class Water {
  constructor(renderer, waves, heightField) {
    const gl = (this.gl = renderer.gl);
    this.r = renderer;
    this.waves = waves;
    this.prog = new Program(gl, VS, FS, 'water');
    this.groundTex = heightField.texture(gl);
    const xs = [...range(-150, -80, 1.6), ...range(-80, 80, 0.7).slice(1), ...range(80, 150, 1.6).slice(1)];
    const zs = [...range(-260, -105, 1.4), ...range(-105, 12, 0.42).slice(1), ...range(12, 40, 1.4).slice(1)];
    this.inner = this.upload(buildGrid(xs, zs));
    // ytre ring (åpent hav) – lavoppløst
    const B = 2600;
    const parts = [
      [range(-B, B, 80), range(-B, -260, 60)],
      [range(-B, -150, 50), range(-260, 40, 20)],
      [range(150, B, 50), range(-260, 40, 20)],
      [range(-B, B, 80), range(40, 600, 60)],
    ];
    this.outer = parts.map(([a, b]) => this.upload(buildGrid(a, b)));
    this.initLip();
  }
  initLip() {
    const gl = this.gl;
    this.lipProg = new Program(gl, LIP_VS, LIP_FS, 'lip');
    this.NS = 30;
    this.NA = 10;
    const maxStrips = 16;
    const nv = maxStrips * this.NS * this.NA;
    this.lipPos = new Float32Array(nv * 3);
    this.lipNor = new Float32Array(nv * 3);
    this.lipInfo = new Float32Array(nv * 2);
    const idx = [];
    for (let st = 0; st < maxStrips; st++) {
      const base = st * this.NS * this.NA;
      for (let j = 0; j < this.NS - 1; j++) for (let i = 0; i < this.NA - 1; i++) {
        const a = base + j * this.NA + i, b = a + this.NA;
        idx.push(a, b, b + 1, a, b + 1, a + 1);
      }
    }
    this.lipIdxPerStrip = (this.NS - 1) * (this.NA - 1) * 6;
    this.lipVao = gl.createVertexArray();
    gl.bindVertexArray(this.lipVao);
    const mk = (loc, arr, size) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, arr.byteLength, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      return b;
    };
    this.lipBufs = [mk(0, this.lipPos, 3), mk(1, this.lipNor, 3), mk(2, this.lipInfo, 2)];
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    this.lipStrips = 0;
    this.lipEdges = []; // brukes av partikkelsprut
  }
  // Bygger den kastende leppa langs curlen for hver brytende bølge
  updateLip() {
    const W = this.waves, NS = this.NS, NA = this.NA;
    const P = this.lipPos, Nn = this.lipNor, I = this.lipInfo;
    let st = 0;
    this.lipEdges.length = 0;
    for (const w of W.waves) {
      const strips = [];
      // en bølge som bare peeler én vei har bare leppe på den siden (til den lukker seg ved land)
      const useL = w.dir !== 1 || w.wL > 0.5, useR = w.dir !== -1 || w.wR > 0.5;
      if (w.started) {
        if (useL) strips.push([-1, w.peak - w.wL, false]);
        if (useR) strips.push([1, w.peak + w.wR, false]);
      } else if (w.steep > 0.93) {
        if (w.dir !== 1) strips.push([-1, w.peak, true]);
        if (w.dir !== -1) strips.push([1, w.peak, true]);
      }
      for (const [side, edge, pre] of strips) {
        if (st >= 16) break;
        const base = st * NS * NA;
        let any = false;
        for (let j = 0; j < NS; j++) {
          const s = pre ? (j / (NS - 1)) * 16 : -3.5 + (j / (NS - 1)) * 17;
          const x = edge + side * s;
          let k = pre ? ((w.steep - 0.93) / 0.07) * 0.35 * Math.exp(-(s / 5) * (s / 5)) : Math.min(1, (13 - s) / 10) * smoothstepJS(-3.5, 0.3, s);
          k = Math.max(0, Math.min(1, k));
          if (Math.abs(x) > 128) k = 0;
          const cz = W.crestZ(w, x);
          const ev = W.eval(w, x, cz);
          if (ev.H < 0.35) k *= Math.max(0, (ev.H - 0.15) / 0.2);
          k = Math.max(0, k);
          const H = ev.H;
          const yTop = W.height(x, cz);
          const zTop = cz + 0.3 * H * k;
          const Lf = ev.Lf;
          const fall = s < 0 && !pre ? smoothstepJS(0, -3.5, s) : 0;
          const p1f = Lf * 1.2 * k, p1y = yTop + 0.1 * H * k;
          const p2f = Lf * 1.55 * k + fall * 0.6, p2y = yTop - H * (0.62 * k + 0.35 * fall);
          if (k > 0.05) any = true;
          if (j === Math.floor(NS * 0.2) && k > 0.3 && !pre) this.lipEdges.push([x, p2y, zTop + p2f, H, side]);
          for (let i = 0; i < NA; i++) {
            const a = i / (NA - 1), ia = 1 - a;
            const f = 2 * ia * a * p1f + a * a * p2f;
            const y = ia * ia * yTop + 2 * ia * a * p1y + a * a * p2y;
            const v = base + j * NA + i;
            P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = zTop + f;
            I[v * 2] = a; I[v * 2 + 1] = k;
          }
        }
        if (!any) continue;
        // normaler
        for (let j = 0; j < NS; j++) for (let i = 0; i < NA; i++) {
          const v = base + j * NA + i;
          const vj = base + Math.min(NS - 1, j + 1) * NA + i, vjm = base + Math.max(0, j - 1) * NA + i;
          const vi = base + j * NA + Math.min(NA - 1, i + 1), vim = base + j * NA + Math.max(0, i - 1);
          const tx = P[vj * 3] - P[vjm * 3], ty = P[vj * 3 + 1] - P[vjm * 3 + 1], tz = P[vj * 3 + 2] - P[vjm * 3 + 2];
          const ux = P[vi * 3] - P[vim * 3], uy = P[vi * 3 + 1] - P[vim * 3 + 1], uz = P[vi * 3 + 2] - P[vim * 3 + 2];
          let nx = ty * uz - tz * uy, ny = tz * ux - tx * uz, nz = tx * uy - ty * ux;
          const l = Math.hypot(nx, ny, nz) || 1;
          Nn[v * 3] = nx / l; Nn[v * 3 + 1] = ny / l; Nn[v * 3 + 2] = nz / l;
        }
        st++;
      }
    }
    this.lipStrips = st;
    if (st > 0) {
      const gl = this.gl;
      const n = st * NS * NA;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lipBufs[0]);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, P.subarray(0, n * 3));
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lipBufs[1]);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, Nn.subarray(0, n * 3));
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lipBufs[2]);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, I.subarray(0, n * 2));
    }
  }
  upload({ p, idx }) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(p), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: idx.length };
  }
  draw() {
    const gl = this.gl, r = this.r, w = this.waves;
    const p = this.prog.use();
    r.setCommon(p);
    gl.uniformMatrix4fv(p.u('uVP'), false, r.vp);
    gl.uniform4fv(p.u('uA'), w.uA);
    gl.uniform4fv(p.u('uB'), w.uB);
    gl.uniform4fv(p.u('uC'), w.uC);
    gl.uniform1f(p.u('uWaveTime'), w.time);
    gl.uniform4f(p.u('uWorld'), WORLD.minX, WORLD.minZ, WORLD.maxX - WORLD.minX, WORLD.maxZ - WORLD.minZ);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.groundTex);
    gl.uniform1i(p.u('uGround'), 2);
    gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    for (const m of [this.inner, ...this.outer]) {
      gl.bindVertexArray(m.vao);
      gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0);
    }
    if (this.lipStrips > 0) {
      const lp = this.lipProg.use();
      r.setCommon(lp);
      gl.uniformMatrix4fv(lp.u('uVP'), false, r.vp);
      gl.bindVertexArray(this.lipVao);
      gl.drawElements(gl.TRIANGLES, this.lipStrips * this.lipIdxPerStrip, gl.UNSIGNED_INT, 0);
    }
    gl.disable(gl.BLEND);
  }
}
