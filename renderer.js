// Lett WebGL2-renderer med stilisert lys, tåke, vind og myke skygger.
import { mat4 } from './math.js';

export const COMMON_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uCamPos;
uniform float uFogDensity;
uniform float uTime;

vec3 skyColor(vec3 d) {
  float h = d.y;
  vec3 col = mix(uSkyHorizon, uSkyTop, pow(clamp(h, 0.0, 1.0), 0.5));
  // varm dis rundt horisonten
  col = mix(col, uSkyHorizon * vec3(1.03, 0.97, 0.9), exp(-abs(h) * 18.0) * 0.5);
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunCol * (0.22 * pow(sd, 6.0) + 0.35 * pow(sd, 48.0));
  if (h < 0.0) col = mix(col, vec3(0.32, 0.55, 0.62), clamp(-h * 4.0, 0.0, 1.0));
  return col;
}
vec3 applyFog(vec3 col, vec3 wp) {
  vec3 dv = wp - uCamPos;
  float dist = length(dv);
  float f = 1.0 - exp(-dist * uFogDensity);
  f *= mix(1.0, 0.55, clamp(wp.y / 40.0, 0.0, 1.0));
  return mix(col, skyColor(normalize(dv) * vec3(1.0, 0.25, 1.0) + vec3(0.0, 0.02, 0.0)), clamp(f, 0.0, 1.0));
}
vec3 tonemap(vec3 x) {
  x *= 0.8;
  vec3 c = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  c = pow(c, vec3(1.0 / 2.2));
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return mix(vec3(l), c, 1.2); // litt ekstra metning
}
vec3 toLinear(vec3 c) { return pow(c, vec3(2.2)); }
vec3 windOffset(vec3 wp, float w) {
  if (w <= 0.0) return vec3(0.0);
  float ph = wp.x * 0.13 + wp.z * 0.09;
  return vec3(sin(uTime * 1.5 + ph) + 0.45 * sin(uTime * 3.1 + ph * 2.3),
              0.25 * sin(uTime * 2.4 + ph * 1.3),
              cos(uTime * 1.2 + ph * 0.8) * 0.6) * w * 0.14;
}
`;

const STD_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNor;
layout(location=2) in vec4 aCol;
layout(location=3) in vec2 aUv;
uniform mat4 uVP;
uniform mat4 uModel;
uniform mat4 uLightVP;
uniform float uWind;
${COMMON_GLSL}
out vec3 vW;
out vec3 vN;
out vec4 vCol;
out vec2 vUv;
out vec4 vSh;
void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  wp.xyz += windOffset(wp.xyz, aCol.a * uWind);
  vW = wp.xyz;
  vN = normalize(mat3(uModel) * aNor);
  vCol = aCol;
  vUv = aUv;
  vSh = uLightVP * wp;
  gl_Position = uVP * wp;
}`;

const STD_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 vW;
in vec3 vN;
in vec4 vCol;
in vec2 vUv;
in vec4 vSh;
uniform vec3 uColor;
uniform vec3 uEmissive;
uniform int uFlags;
uniform float uSpec;
uniform float uAlpha;
uniform sampler2D uTex;
uniform sampler2DShadow uShadowMap;
uniform float uShadowTexel;
${COMMON_GLSL}
out vec4 outColor;

float shadowAt() {
  vec3 p = vSh.xyz / vSh.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float bias = 0.0016;
  float s = 0.0;
  float t = uShadowTexel;
  s += texture(uShadowMap, vec3(p.xy, p.z - bias));
  s += texture(uShadowMap, vec3(p.xy + vec2(t, t) * 1.2, p.z - bias));
  s += texture(uShadowMap, vec3(p.xy + vec2(-t, t) * 1.2, p.z - bias));
  s += texture(uShadowMap, vec3(p.xy + vec2(t, -t) * 1.2, p.z - bias));
  s += texture(uShadowMap, vec3(p.xy + vec2(-t, -t) * 1.2, p.z - bias));
  float fade = smoothstep(0.85, 1.0, max(abs(p.x - 0.5), abs(p.y - 0.5)) * 2.0);
  return mix(s / 5.0, 1.0, fade);
}

void main() {
  vec3 base = uColor;
  float alpha = uAlpha;
  if ((uFlags & 2) != 0) base *= vCol.rgb;
  if ((uFlags & 1) != 0) {
    vec4 tx = texture(uTex, vUv);
    if (tx.a < 0.4) discard;
    base *= tx.rgb;
  }
  vec3 alb = toLinear(base);
  if ((uFlags & 4) != 0) {
    vec3 c = alb + toLinear(uEmissive);
    outColor = vec4(tonemap(applyFog(c, vW)), alpha);
    return;
  }
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCamPos - vW);
  float ndl = dot(N, uSunDir);
  float sh = (uFlags & 8) != 0 ? shadowAt() : 1.0;
  float diff = clamp(ndl * 0.85 + 0.15, 0.0, 1.0) * sh;
  // halvkule-ambient (himmel ovenfra, varm sand nedenfra)
  vec3 amb = mix(vec3(0.6, 0.48, 0.36), mix(toLinear(uSkyTop), vec3(1.0, 0.93, 0.8), 0.45) * 1.1, N.y * 0.5 + 0.5);
  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 48.0) * uSpec * sh;
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.18;
  vec3 c = alb * (amb * 0.42 + uSunCol * diff * 0.9) + uSunCol * spec + rim * toLinear(uSkyHorizon) + toLinear(uEmissive);
  outColor = vec4(tonemap(applyFog(c, vW)), alpha);
}`;

const DEPTH_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=2) in vec4 aCol;
uniform mat4 uLightVP;
uniform mat4 uModel;
uniform float uWind;
${COMMON_GLSL}
void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  wp.xyz += windOffset(wp.xyz, aCol.a * uWind);
  gl_Position = uLightVP * wp;
}`;
const DEPTH_FS = `#version 300 es
precision mediump float;
void main() {}`;

const SKY_VS = /* glsl */ `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
uniform mat4 uVP;
${COMMON_GLSL}
out vec3 vDir;
void main() {
  vDir = aPos;
  vec4 p = uVP * vec4(aPos * 900.0 + uCamPos, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FS = /* glsl */ `#version 300 es
precision highp float;
in vec3 vDir;
${COMMON_GLSL}
out vec4 outColor;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.02 + vec2(3.1, 1.7); a *= 0.5; }
  return s;
}
void main() {
  vec3 d = normalize(vDir);
  vec3 col = toLinear(skyColor(d));
  float sd = max(dot(d, uSunDir), 0.0);
  col += toLinear(uSunCol) * smoothstep(0.9993, 0.9997, sd) * 6.0;
  if (d.y > 0.0) {
    vec2 uv = d.xz / (d.y + 0.12) * 1.3 + vec2(uTime * 0.004, uTime * 0.002);
    float n = fbm(uv * 0.9);
    float cl = smoothstep(0.52, 0.78, n) * smoothstep(0.0, 0.18, d.y);
    vec3 cloudCol = mix(vec3(1.0, 0.86, 0.74), vec3(1.0, 0.99, 0.97), smoothstep(0.5, 0.85, n));
    cloudCol += toLinear(uSunCol) * pow(sd, 6.0) * 0.6;
    col = mix(col, toLinear(cloudCol) * 1.15, cl * 0.85);
  }
  outColor = vec4(tonemap(col * 1.05), 1.0);
}`;

export class Program {
  constructor(gl, vs, fs, name = 'prog') {
    this.gl = gl;
    const mk = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        console.error(name, log, src.split('\n').map((l, i) => i + 1 + ': ' + l).join('\n'));
        throw new Error('Shader-feil i ' + name + ': ' + log);
      }
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link-feil ' + name + ': ' + gl.getProgramInfoLog(p));
    this.p = p;
    this.cache = new Map();
  }
  u(name) {
    let l = this.cache.get(name);
    if (l === undefined) {
      l = this.gl.getUniformLocation(this.p, name);
      this.cache.set(name, l);
    }
    return l;
  }
  use() { this.gl.useProgram(this.p); return this; }
}

export class Mesh {
  constructor(gl, geo, dynamic = false) {
    this.gl = gl;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.buffers = [];
    const attr = (loc, data, size) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data instanceof Float32Array ? data : new Float32Array(data), dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      this.buffers.push(b);
    };
    attr(0, geo.p, 3);
    attr(1, geo.n, 3);
    attr(2, geo.c, 4);
    attr(3, geo.uv, 2);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(geo.i), gl.STATIC_DRAW);
    this.count = geo.i.length;
    gl.bindVertexArray(null);
    // grov avgrensningssfære for culling
    let cx = 0, cy = 0, cz = 0;
    const n = geo.p.length / 3 || 1;
    for (let k = 0; k < geo.p.length; k += 3) { cx += geo.p[k]; cy += geo.p[k + 1]; cz += geo.p[k + 2]; }
    cx /= n; cy /= n; cz /= n;
    let r = 0;
    for (let k = 0; k < geo.p.length; k += 3) r = Math.max(r, Math.hypot(geo.p[k] - cx, geo.p[k + 1] - cy, geo.p[k + 2] - cz));
    this.center = [cx, cy, cz];
    this.radius = r;
  }
  draw() {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_INT, 0);
  }
}

export function makeMaterial(o = {}) {
  return Object.assign(
    { color: [1, 1, 1], tex: null, vcol: true, unlit: false, emissive: [0, 0, 0], wind: 0, double: false, cast: true, receive: true, spec: 0.15, alpha: 1 },
    o
  );
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL2 støttes ikke i denne nettleseren.');
    this.gl = gl;
    this.canvas = canvas;
    this.std = new Program(gl, STD_VS, STD_FS, 'standard');
    this.depth = new Program(gl, DEPTH_VS, DEPTH_FS, 'depth');
    this.skyProg = new Program(gl, SKY_VS, SKY_FS, 'sky');
    this.view = mat4.create();
    this.proj = mat4.create();
    this.vp = mat4.create();
    this.lightVP = mat4.create();
    this.camPos = [0, 5, 10];
    this.time = 0;
    this.env = {
      sunDir: normalize([0.38, 0.62, -0.69]),
      sunCol: [1.0, 0.9, 0.76],
      skyTop: [0.16, 0.5, 0.92],
      skyHorizon: [0.93, 0.85, 0.72],
      fog: 0.0016,
    };
    this.shadowSize = 2048;
    this.shadowExtent = 55;
    this.initShadow();
    this.whiteTex = this.texture(null);
    // himmelkule
    const sk = [];
    const si = [];
    const W = 32, H = 16;
    for (let j = 0; j <= H; j++) {
      const th = (j / H) * Math.PI;
      for (let k = 0; k <= W; k++) {
        const ph = (k / W) * Math.PI * 2;
        sk.push(Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th));
      }
    }
    for (let j = 0; j < H; j++) for (let k = 0; k < W; k++) {
      const a = j * (W + 1) + k, b = a + W + 1;
      si.push(a, a + 1, b + 1, a, b + 1, b);
    }
    this.skyVao = gl.createVertexArray();
    gl.bindVertexArray(this.skyVao);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sk), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(si), gl.STATIC_DRAW);
    this.skyCount = si.length;
    gl.bindVertexArray(null);
    this.resize();
  }
  initShadow() {
    const gl = this.gl;
    this.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, this.shadowSize, this.shadowSize);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    this.shadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  texture(canvas, { repeat = false, nearest = false } = {}) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (!canvas) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
      return t;
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, nearest ? gl.NEAREST : gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    return t;
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap || 1.75);
    const w = Math.floor(this.canvas.clientWidth * dpr), h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.aspect = w / Math.max(1, h);
  }
  setCamera(eye, target, fov) {
    this.camPos = eye;
    mat4.lookAt(this.view, eye, target, [0, 1, 0]);
    mat4.perspective(this.proj, fov, this.aspect, 0.1, 2400);
    mat4.multiply(this.vp, this.proj, this.view);
    this.updateFrustum();
  }
  updateFrustum() {
    const m = this.vp;
    const planes = [];
    const pl = (a, b, c, d) => {
      const l = Math.hypot(a, b, c);
      planes.push([a / l, b / l, c / l, d / l]);
    };
    pl(m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]);
    pl(m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]);
    pl(m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]);
    pl(m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]);
    pl(m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]);
    this.frustum = planes;
  }
  visible(item) {
    const m = item.world, me = item.mesh;
    const c = mat4.transformPoint(m, me.center[0], me.center[1], me.center[2]);
    const s = Math.max(Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10]));
    const r = me.radius * s + 1.5;
    for (const p of this.frustum) if (p[0] * c[0] + p[1] * c[1] + p[2] * c[2] + p[3] < -r) return false;
    return true;
  }
  setShadowCenter(cx, cy, cz) {
    const d = this.env.sunDir;
    const e = this.shadowExtent;
    // snapp til texel for å unngå flimring
    const texel = (e * 2) / this.shadowSize;
    const view = mat4.create();
    const up = [0, 1, 0];
    mat4.lookAt(view, [d[0] * 120, d[1] * 120, d[2] * 120], [0, 0, 0], up);
    const c = mat4.transformPoint(view, cx, cy, cz);
    c[0] = Math.round(c[0] / texel) * texel;
    c[1] = Math.round(c[1] / texel) * texel;
    const proj = mat4.ortho(mat4.create(), c[0] - e, c[0] + e, c[1] - e, c[1] + e, 1, 400);
    mat4.multiply(this.lightVP, proj, view);
  }
  collect(root, out = []) {
    const walk = (n) => {
      if (!n.visible) return;
      if (n.mesh) out.push({ mesh: n.mesh, mat: n.material, world: n.world });
      for (const c of n.children) walk(c);
    };
    walk(root);
    return out;
  }
  setCommon(prog) {
    const gl = this.gl, e = this.env;
    gl.uniform3fv(prog.u('uSunDir'), e.sunDir);
    gl.uniform3fv(prog.u('uSunCol'), e.sunCol);
    gl.uniform3fv(prog.u('uSkyTop'), e.skyTop);
    gl.uniform3fv(prog.u('uSkyHorizon'), e.skyHorizon);
    gl.uniform3fv(prog.u('uCamPos'), this.camPos);
    gl.uniform1f(prog.u('uFogDensity'), e.fog);
    gl.uniform1f(prog.u('uTime'), this.time);
  }
  shadowPass(items) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.viewport(0, 0, this.shadowSize, this.shadowSize);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.colorMask(false, false, false, false);
    const p = this.depth.use();
    this.setCommon(p);
    gl.uniformMatrix4fv(p.u('uLightVP'), false, this.lightVP);
    for (const it of items) {
      if (!it.mat.cast) continue;
      gl.uniformMatrix4fv(p.u('uModel'), false, it.world);
      gl.uniform1f(p.u('uWind'), it.mat.wind);
      it.mesh.draw();
    }
    gl.colorMask(true, true, true, true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  beginMain() {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.7, 0.8, 0.9, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // himmel
    gl.disable(gl.CULL_FACE);
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);
    const s = this.skyProg.use();
    this.setCommon(s);
    gl.uniformMatrix4fv(s.u('uVP'), false, this.vp);
    gl.bindVertexArray(this.skyVao);
    gl.drawElements(gl.TRIANGLES, this.skyCount, gl.UNSIGNED_SHORT, 0);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
  }
  drawItems(items, transparent = false) {
    const gl = this.gl;
    const p = this.std.use();
    this.setCommon(p);
    gl.uniformMatrix4fv(p.u('uVP'), false, this.vp);
    gl.uniformMatrix4fv(p.u('uLightVP'), false, this.lightVP);
    gl.uniform1f(p.u('uShadowTexel'), 1 / this.shadowSize);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.uniform1i(p.u('uShadowMap'), 1);
    gl.uniform1i(p.u('uTex'), 0);
    gl.activeTexture(gl.TEXTURE0);
    if (transparent) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    let lastTex = null;
    for (const it of items) {
      const m = it.mat;
      if ((m.alpha < 1) !== transparent) continue;
      if (!this.visible(it)) continue;
      if (m.double) gl.disable(gl.CULL_FACE);
      else { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); }
      gl.uniformMatrix4fv(p.u('uModel'), false, it.world);
      gl.uniform3fv(p.u('uColor'), m.color);
      gl.uniform3fv(p.u('uEmissive'), m.emissive);
      gl.uniform1f(p.u('uSpec'), m.spec);
      gl.uniform1f(p.u('uAlpha'), m.alpha);
      gl.uniform1f(p.u('uWind'), m.wind);
      const flags = (m.tex ? 1 : 0) | (m.vcol ? 2 : 0) | (m.unlit ? 4 : 0) | (m.receive ? 8 : 0);
      gl.uniform1i(p.u('uFlags'), flags);
      const tex = m.tex || this.whiteTex;
      if (tex !== lastTex) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        lastTex = tex;
      }
      it.mesh.draw();
    }
    gl.disable(gl.CULL_FACE);
    if (transparent) gl.disable(gl.BLEND);
  }
}

export function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
