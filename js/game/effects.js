// Partikler: sprut, skum, bobler, gnister og røyk.
import { Program, COMMON_GLSL } from '../engine/renderer.js';

const VS = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec4 aCol;
layout(location=2) in float aSize;
uniform mat4 uVP;
uniform float uScale;
${COMMON_GLSL}
out vec4 vCol;
out vec3 vW;
void main() {
  vec4 p = uVP * vec4(aPos, 1.0);
  gl_Position = p;
  gl_PointSize = clamp(aSize * uScale / p.w, 1.0, 180.0);
  vCol = aCol;
  vW = aPos;
}`;
const FS = /* glsl */ `#version 300 es
precision highp float;
in vec4 vCol;
in vec3 vW;
uniform int uAdd;
${COMMON_GLSL}
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0) discard;
  float a = vCol.a * smoothstep(1.0, 0.25, d);
  vec3 col = vCol.rgb;
  if (uAdd == 0) {
    // enkel belysning: lys overside
    float sh = 0.75 + 0.35 * (-c.y * 0.5 + 0.5);
    col = toLinear(col) * sh * (0.75 + 0.45 * toLinear(uSunCol));
    col = tonemap(applyFog(col * 1.25, vW));
  }
  outColor = vec4(col, a);
}`;

class System {
  constructor(gl, max, additive) {
    this.gl = gl;
    this.max = max;
    this.additive = additive;
    this.n = 0;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.c = new Float32Array(max * 4);
    this.s = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.floor = new Float32Array(max);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const mk = (loc, arr, size) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, arr.byteLength, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      return b;
    };
    this.bp = mk(0, this.p, 3);
    this.bc = mk(1, this.c, 4);
    this.bs = mk(2, this.s, 1);
    gl.bindVertexArray(null);
  }
  spawn(x, y, z, vx, vy, vz, life, size, grow, r, g, b, a, grav = 9.8, drag = 0.5, floor = -1e9) {
    let i;
    if (this.n < this.max) i = this.n++;
    else i = Math.floor(Math.random() * this.max);
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.c[i * 4] = r; this.c[i * 4 + 1] = g; this.c[i * 4 + 2] = b; this.c[i * 4 + 3] = a;
    this.a0[i] = a;
    this.s[i] = size;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grow[i] = grow;
    this.grav[i] = grav;
    this.drag[i] = drag;
    this.floor[i] = floor;
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // bytt med siste
        const j = --this.n;
        if (i !== j) {
          for (let k = 0; k < 3; k++) { this.p[i * 3 + k] = this.p[j * 3 + k]; this.v[i * 3 + k] = this.v[j * 3 + k]; }
          for (let k = 0; k < 4; k++) this.c[i * 4 + k] = this.c[j * 4 + k];
          this.s[i] = this.s[j]; this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j];
          this.grow[i] = this.grow[j]; this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j]; this.a0[i] = this.a0[j]; this.floor[i] = this.floor[j];
        }
        continue;
      }
      const d = Math.exp(-this.drag[i] * dt);
      this.v[i * 3] *= d;
      this.v[i * 3 + 1] = this.v[i * 3 + 1] * d - this.grav[i] * dt;
      this.v[i * 3 + 2] *= d;
      this.p[i * 3] += this.v[i * 3] * dt;
      this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt;
      this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
      if (this.p[i * 3 + 1] < this.floor[i]) {
        this.p[i * 3 + 1] = this.floor[i];
        this.v[i * 3 + 1] = 0;
      }
      this.s[i] += this.grow[i] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.c[i * 4 + 3] = this.a0[i] * Math.min(1, t * 2.5) * Math.min(1, (1 - t) * 12 + 0.2);
      i++;
    }
  }
  draw(prog) {
    if (!this.n) return;
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bp);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.p.subarray(0, this.n * 3));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bc);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.c.subarray(0, this.n * 4));
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bs);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.s.subarray(0, this.n));
    gl.uniform1i(prog.u('uAdd'), this.additive ? 1 : 0);
    if (this.additive) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.POINTS, 0, this.n);
  }
}

export class Effects {
  constructor(renderer) {
    this.r = renderer;
    const gl = renderer.gl;
    this.prog = new Program(gl, VS, FS, 'particles');
    this.spray = new System(gl, 4000, false);
    this.glow = new System(gl, 600, true);
  }
  update(dt) {
    this.spray.update(dt);
    this.glow.update(dt);
  }
  draw() {
    const gl = this.r.gl, r = this.r;
    const p = this.prog.use();
    r.setCommon(p);
    gl.uniformMatrix4fv(p.u('uVP'), false, r.vp);
    gl.uniform1f(p.u('uScale'), (r.canvas.height / 2) * r.proj[5]);
    gl.enable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);
    this.spray.draw(p);
    this.glow.draw(p);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
  // ---- hjelpere ----
  splash(x, y, z, n, power = 1, spread = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (0.5 + Math.random()) * power * spread;
      this.spray.spawn(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3, Math.cos(a) * s, (1.5 + Math.random() * 2.5) * power, Math.sin(a) * s,
        0.5 + Math.random() * 0.5, 0.07 + Math.random() * 0.1, 0.15, 0.97, 0.99, 1, 0.85, 9.8, 0.8);
    }
  }
  foamPuff(x, y, z, n, size = 0.5) {
    for (let i = 0; i < n; i++) {
      this.spray.spawn(x + (Math.random() - 0.5) * 1.2, y + Math.random() * 0.3, z + (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.6, (Math.random() - 0.5) * 0.6,
        1.0 + Math.random() * 0.8, size * (0.6 + Math.random() * 0.6), 0.5, 0.96, 0.99, 1.0, 0.75, 0.6, 1.2);
    }
  }
  // sprut fra leppa som faller ned
  lipSpray(x, y, z, H, dirZ = 1) {
    const s = 0.4 + H * 0.5;
    this.spray.spawn(x + (Math.random() - 0.5) * 1.5, y + Math.random() * 0.3, z, (Math.random() - 0.5) * 1.2, 0.8 + Math.random() * 2.2 * s, dirZ * (1.5 + Math.random() * 2.5),
      0.7 + Math.random() * 0.6, 0.2 + Math.random() * 0.35, 0.8, 0.97, 0.99, 1, 0.7, 7, 0.8);
    if (Math.random() < 0.35)
      this.spray.spawn(x + (Math.random() - 0.5) * 2, y + 0.3, z - 0.3, (Math.random() - 0.5), 1.5 + Math.random() * 2, 0.5, 1.6 + Math.random(), 0.8 + Math.random() * 0.8, 1.6, 0.96, 0.99, 1.0, 0.28, 0.3, 1.0);
  }
  railSpray(x, y, z, dx, dz, k) {
    const n = Math.floor(k * 3 + Math.random());
    for (let i = 0; i < n; i++) {
      this.spray.spawn(x + (Math.random() - 0.5) * 0.3, y + 0.05, z + (Math.random() - 0.5) * 0.3,
        dx * (2 + Math.random() * 3) * k + (Math.random() - 0.5), 1.5 + Math.random() * 3 * k, dz * (2 + Math.random() * 3) * k + (Math.random() - 0.5),
        0.45 + Math.random() * 0.45, 0.05 + Math.random() * 0.08, 0.12, 0.97, 0.99, 1, 0.85, 9.8, 0.6);
    }
  }
  wake(x, y, z) {
    this.spray.spawn(x + (Math.random() - 0.5) * 0.4, y + 0.03, z + (Math.random() - 0.5) * 0.4, 0, 0, 0, 0.9 + Math.random() * 0.6, 0.07 + Math.random() * 0.06, 0.05, 0.95, 0.99, 1.0, 0.28, 0, 1, y);
  }
  bubbles(x, y, z, n) {
    for (let i = 0; i < n; i++) {
      this.spray.spawn(x + (Math.random() - 0.5) * 0.8, y + Math.random() * 0.4, z + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.4, 0.8 + Math.random(), (Math.random() - 0.5) * 0.4,
        0.6 + Math.random() * 0.5, 0.05 + Math.random() * 0.08, 0.05, 0.85, 0.98, 1.0, 0.8, -1, 1);
    }
  }
  sparks(x, y, z) {
    this.glow.spawn(x + (Math.random() - 0.5) * 0.5, y + 0.4, z + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.6, 1.2 + Math.random() * 1.8, (Math.random() - 0.5) * 0.6,
      0.8 + Math.random() * 1.2, 0.05 + Math.random() * 0.04, -0.02, 1.0, 0.6 + Math.random() * 0.3, 0.2, 1, -0.3, 0.6);
  }
  smoke(x, y, z) {
    this.spray.spawn(x + (Math.random() - 0.5) * 0.3, y + 0.9, z + (Math.random() - 0.5) * 0.3, 0.25 + Math.random() * 0.2, 0.7 + Math.random() * 0.4, (Math.random() - 0.5) * 0.2,
      2.5 + Math.random() * 1.5, 0.35, 0.6, 0.75, 0.72, 0.7, 0.18, -0.05, 0.3);
  }
  sand(x, y, z) {
    for (let i = 0; i < 2; i++)
      this.spray.spawn(x + (Math.random() - 0.5) * 0.2, y + 0.03, z + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.6,
        0.35 + Math.random() * 0.2, 0.04 + Math.random() * 0.03, 0, 0.93, 0.83, 0.62, 0.8, 9.8, 0.5);
  }
}
