// Tredjepersonskamera som følger spilleren mykt, med egne innstillinger per modus.
import { damp, dampAngle, clamp, lerp } from '../engine/math.js';
import { groundHeight } from '../world/terrain.js';
import { FIRE } from '../world/props.js';

export class CameraRig {
  constructor() {
    this.yaw = Math.PI; // ser mot havet
    this.pitch = 0.32;
    this.dist = 6.5;
    this.zoom = 1;
    this.pos = [0, 4, 20];
    this.target = [0, 1, 15];
    this.fov = 0.95;
    this.shakeT = 0;
    this.shakeA = 0;
    this.mode = 'walk';
    this.userYaw = 0;
  }
  shake(a, t = 0.5) {
    this.shakeA = Math.max(this.shakeA, a);
    this.shakeT = Math.max(this.shakeT, t);
  }
  update(dt, p, input, waves) {
    const mouseActive = input.time - input.lastMouse < 1.6;
    if (input.mouseDX || input.mouseDY) {
      this.yaw -= input.mouseDX * 0.006;
      this.pitch = clamp(this.pitch + input.mouseDY * 0.004, -0.05, 1.15);
    }
    if (input.wheel) this.zoom = clamp(this.zoom + input.wheel * 0.1, 0.6, 1.8);
    let tx = p.x, ty = p.y, tz = p.z;
    let wantDist = 6.5, wantPitch = null, follow = 0, fov = 0.95, lookAhead = 0, height = 1.3;
    const s = p.state;
    if (s === 'walk') {
      follow = p.speed > 0.5 && !mouseActive ? 1.2 : 0;
      height = 1.35;
      wantDist = 6.2;
    } else if (s === 'shop') {
      // utstillingskamera foran disken
      const cx = p.x - 0.9, cz = p.z - 3.4;
      const cy = p.y + 1.35;
      this.pos = [damp(this.pos[0], cx, 4, dt), damp(this.pos[1], cy, 4, dt), damp(this.pos[2], cz, 4, dt)];
      this.target = [damp(this.target[0], p.x - 0.9, 4, dt), damp(this.target[1], p.y + 1.0, 4, dt), damp(this.target[2], p.z, 4, dt)];
      this.yaw = Math.atan2(p.x - cx, p.z - cz);
      this.fov = damp(this.fov, 0.8, 3, dt);
      return;
    } else if (s === 'talk' && p.talkNpc) {
      // samtalekamera fra siden, så både spilleren og figuren synes
      const n = p.talkNpc;
      const mx = (p.x + n.x) / 2, mz = (p.z + n.z) / 2;
      // velg siden som ligger lengst unna bålet
      const base = Math.atan2(n.x - p.x, n.z - p.z);
      let best = null;
      for (const off of [1.15, -1.15]) {
        const a = base + off;
        const x = mx - Math.sin(a) * 4.6, z = mz - Math.cos(a) * 4.6;
        const d = Math.hypot(x - FIRE.x, z - FIRE.z);
        if (!best || d > best[2]) best = [x, z, d];
      }
      const [cx, cz] = best;
      const cy = Math.max(p.y, n.y) + 1.9;
      this.pos = [damp(this.pos[0], cx, 3, dt), damp(this.pos[1], cy, 3, dt), damp(this.pos[2], cz, 3, dt)];
      this.target = [damp(this.target[0], mx, 3, dt), damp(this.target[1], Math.max(p.y, n.y) + 1.0, 3, dt), damp(this.target[2], mz, 3, dt)];
      this.yaw = Math.atan2(mx - this.pos[0], mz - this.pos[2]);
      this.fov = damp(this.fov, 0.85, 3, dt);
      return;
    } else if (s === 'surf' || s === 'popup') {
      follow = mouseActive ? 0 : 2.6;
      wantDist = 6.6;
      wantPitch = 0.17;
      height = 1.05;
      lookAhead = 2.2;
      fov = 0.95 + Math.min(0.22, p.surf.s * 0.012);
    } else if (s === 'wipeout' || s === 'washed') {
      follow = 0.6;
      wantDist = 7.5;
      wantPitch = 0.35;
      height = 1.0;
    } else {
      // padling og duck dive
      follow = mouseActive ? 0 : 2.2;
      wantDist = 6.3;
      wantPitch = p.prompt && p.prompt.kind === 'drop' ? 0.42 : 0.3;
      height = 1.0;
    }
    let wantYaw = p.yaw;
    if (s === 'surf' || s === 'popup') {
      // kameraet ligger litt oppe i bølgeveggen og ser ned mot land, så både surfer og bølge synes
      wantYaw = Math.atan2(Math.sin(p.yaw), Math.cos(p.yaw) + 0.5);
    }
    if (follow > 0) this.yaw = dampAngle(this.yaw, wantYaw, follow, dt);
    if (wantPitch !== null && !mouseActive) this.pitch = damp(this.pitch, wantPitch, 1.5, dt);
    this.dist = damp(this.dist, wantDist * this.zoom, 3, dt);
    this.fov = damp(this.fov, fov, 2, dt);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const tgt = [tx + Math.sin(p.yaw) * lookAhead, ty + height, tz + Math.cos(p.yaw) * lookAhead];
    // jevn målfølging (litt mer treghet på vannet)
    const tr = s === 'walk' ? 12 : 7;
    this.target = [damp(this.target[0], tgt[0], tr, dt), damp(this.target[1], tgt[1], tr * 0.7, dt), damp(this.target[2], tgt[2], tr, dt)];
    const cd = this.dist * Math.cos(this.pitch);
    let cx = this.target[0] - fx * cd, cz = this.target[2] - fz * cd;
    let cy = this.target[1] + this.dist * Math.sin(this.pitch);
    const floor = Math.max(groundHeight(cx, cz), waves.height(cx, cz)) + 0.55;
    if (cy < floor) cy = floor;
    // hold siktlinjen fri over bølgetopper mellom kamera og spiller
    if (s !== 'walk') {
      const ty = this.target[1];
      for (const t of [0.3, 0.55, 0.8]) {
        const px = this.target[0] + (cx - this.target[0]) * t, pz = this.target[2] + (cz - this.target[2]) * t;
        const h = waves.height(px, pz) + 0.35;
        if (h > ty) cy = Math.max(cy, ty + (h - ty) / t);
      }
    }
    this.camY = this.camY === undefined ? cy : damp(this.camY, cy, cy > this.camY ? 9 : 3, dt);
    cy = Math.max(this.camY, floor);
    this.pos = [cx, cy, cz];
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeA * Math.max(0, this.shakeT);
      this.pos[0] += (Math.random() - 0.5) * a;
      this.pos[1] += (Math.random() - 0.5) * a;
      this.pos[2] += (Math.random() - 0.5) * a;
      if (this.shakeT <= 0) this.shakeA = 0;
    }
  }
}
