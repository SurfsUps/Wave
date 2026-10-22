// Spilleren: gåing på stranden, padling, duck dive, drop in, surfing/carving og wipeouts.
import { Node, clamp, lerp, damp, dampAngle, wrapAngle, smoothstep } from '../engine/math.js';
import { Mesh, makeMaterial } from '../engine/renderer.js';
import { hex } from '../engine/geometry.js';
import { groundHeight } from '../world/terrain.js';
import { SHOP, START } from '../world/props.js';
import { Character, Poses, newPose, blendPose, setJ, addJ } from './character.js';
import { BOARDS, buildBoardGeo, buildFinsGeo, boardCanvas } from './boards.js';

// Timingvinduer (sekunder før bølgen treffer)
export const DUCK = { perfect: [0.1, 0.7], ok: [-0.15, 1.15], show: 2.6 };
export const DROP = { perfect: [-0.15, 0.45], ok: [-0.45, 1.0], show: 2.8 };

const ease = (t) => t * t * (3 - 2 * t);

export class Player {
  constructor(renderer, world) {
    this.r = renderer;
    this.w = world; // { waves, colliders, effects, audio, hud, camera }
    this.rig = new Node();
    this.char = new Character(renderer);
    this.boardNode = new Node();
    this.rig.add(this.boardNode);
    this.rig.add(this.char.root);
    this.boardMeshes = new Map();
    this.look = { outfit: 'korall', hat: 'none', glasses: 'none', board: 'hibiskus' };
    this.setBoard(this.look.board);

    this.x = START.x;
    this.z = START.z;
    this.y = groundHeight(this.x, this.z);
    this.yaw = START.yaw;
    this.vx = 0;
    this.vz = 0;
    this.speed = 0;
    this.yawRate = 0;
    this.state = 'walk';
    this.stateT = 0;
    this.walkPh = 0;
    this.paddlePh = 0;
    this.paddlePower = 0;
    this.lastStroke = 0;
    this.pose = newPose();
    this.targetPose = newPose();
    this.fromPose = newPose();
    this.blendT = 1;
    this.blendDur = 0.35;
    // lokale transformasjoner for brett/karakter i riggen (blandes ved overganger)
    this.local = { board: [0, 0, 0, 0, 0, 0], char: [0, 0, 0, 0, 0, 0] };
    this.fromLocal = { board: [0, 0, 0, 0, 0, 0], char: [0, 0, 0, 0, 0, 0] };
    this.rigY = this.y;
    this.rigYOff = 0;
    this.offX = 0;
    this.offZ = 0;
    this.pitch = 0;
    this.roll = 0;
    this.prompt = null; // aktiv bølgeprompt
    this.waveMem = new Map(); // per bølge: forrige avstand osv.
    this.surf = { w: null, x: 0, d: 0, s: 0, time: 0, carves: 0, top: 0, lastSign: 0, score: 0, lean: 0, pocket: 0 };
    this.duck = null;
    this.washed = null;
    this.score = 0;
    this.messageCooldown = 0;
    this.shopYaw = 0;
  }

  // ---------- utseende ----------
  setLook(l) {
    Object.assign(this.look, l);
    this.char.setLook({ outfit: this.look.outfit, hat: this.look.hat, glasses: this.look.glasses });
    if (l.board) this.setBoard(l.board);
  }
  setBoard(id) {
    const def = BOARDS.find((b) => b.id === id) || BOARDS[0];
    this.board = def;
    if (!this.boardMeshes.has(id)) {
      const mesh = new Mesh(this.r.gl, buildBoardGeo(def));
      const fins = new Mesh(this.r.gl, buildFinsGeo(def));
      const mat = makeMaterial({ tex: this.r.texture(boardCanvas(def)), spec: 0.7, double: true });
      this.boardMeshes.set(id, { mesh, fins, mat });
    }
    const m = this.boardMeshes.get(id);
    this.boardNode.children.length = 0;
    this.boardNode.mesh = m.mesh;
    this.boardNode.material = m.mat;
    const f = new Node(m.fins, makeMaterial({ color: hex('#f2f2f2'), vcol: false, spec: 0.5 }));
    this.boardNode.add(f);
  }

  // ---------- hjelpere ----------
  depthAt(x, z) {
    return -groundHeight(x, z);
  }
  setState(s) {
    if (s === this.state) return;
    this.fromPose.set(this.pose);
    this.fromLocal.board = this.local.board.slice();
    this.fromLocal.char = this.local.char.slice();
    this.blendT = 0;
    this.blendDur = { paddle: 0.45, walk: 0.45, surf: 0.25, popup: 0.3, duck: 0.2, washed: 0.15, wipeout: 0.15, shop: 0.3 }[s] || 0.35;
    const oldY = this.rigY;
    this.state = s;
    this.stateT = 0;
    // beregn ny rigg-høyde for å blende høydeforskjellen
    this.updateRigY();
    this.rigYOff = oldY + this.rigYOff - this.rigY;
  }
  updateRigY() {
    const W = this.w.waves;
    if (this.state === 'walk' || this.state === 'shop' || this.state === 'talk') this.rigY = Math.max(groundHeight(this.x, this.z), -5);
    else this.rigY = W.height(this.x, this.z) + (this.state === 'surf' || this.state === 'popup' ? 0.22 : 0.04);
  }
  collide(nx, nz) {
    for (const c of this.w.colliders) {
      if (c.box) {
        const b = c.box;
        if (nx > b.minX - 0.35 && nx < b.maxX + 0.35 && nz > b.minZ - 0.35 && nz < b.maxZ + 0.35) {
          const dl = nx - (b.minX - 0.35), dr = b.maxX + 0.35 - nx, dd = nz - (b.minZ - 0.35), du = b.maxZ + 0.35 - nz;
          const m = Math.min(dl, dr, dd, du);
          if (m === dl) nx = b.minX - 0.35;
          else if (m === dr) nx = b.maxX + 0.35;
          else if (m === dd) nz = b.minZ - 0.35;
          else nz = b.maxZ + 0.35;
        }
        continue;
      }
      const dx = nx - c.x, dz = nz - c.z;
      const r = c.r + 0.35;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.001;
        nx = c.x + (dx / d) * r;
        nz = c.z + (dz / d) * r;
      }
    }
    return [nx, nz];
  }
  stat(k) {
    return this.board.stats[k];
  }

  // ---------- hovedoppdatering ----------
  update(dt, input, cam) {
    this.stateT += dt;
    this.messageCooldown -= dt;
    this.prompt = null;
    const s = this.state;
    if (s === 'walk') this.updateWalk(dt, input, cam);
    else if (s === 'shop') this.updateShop(dt, input);
    else if (s === 'talk') this.updateTalk(dt, input);
    else if (s === 'paddle') this.updatePaddle(dt, input);
    else if (s === 'duck') this.updateDuck(dt, input);
    else if (s === 'washed') this.updateWashed(dt, input);
    else if (s === 'popup' || s === 'surf') this.updateSurf(dt, input);
    else if (s === 'wipeout') this.updateWipeout(dt, input);
    this.applyRig(dt);
  }

  // ---------- strand ----------
  updateWalk(dt, input, cam) {
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
    const rx = -fz, rz = fx;
    let mx = fx * input.fwd + rx * -input.turn;
    let mz = fz * input.fwd + rz * -input.turn;
    const ml = Math.hypot(mx, mz);
    const depth = this.depthAt(this.x, this.z);
    const wading = smoothstep(0.02, 0.4, depth);
    let target = 0;
    if (ml > 0.01) {
      mx /= ml; mz /= ml;
      target = (input.run ? 6.8 : 3.3) * (1 - wading * 0.45);
      this.yaw = dampAngle(this.yaw, Math.atan2(mx, mz), 10, dt);
    }
    const tvx = mx * target, tvz = mz * target;
    this.vx = damp(this.vx, tvx, target > 0 ? 7 : 10, dt);
    this.vz = damp(this.vz, tvz, target > 0 ? 7 : 10, dt);
    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    // grenser og bratt terreng
    nx = clamp(nx, -108, 108);
    nz = Math.min(nz, 62);
    const gNew = groundHeight(nx, nz);
    if (gNew > 3.2 && gNew > groundHeight(this.x, this.z)) { nx = this.x; nz = this.z; }
    [nx, nz] = this.collide(nx, nz);
    this.speed = Math.hypot(nx - this.x, nz - this.z) / Math.max(dt, 1e-4);
    this.x = nx;
    this.z = nz;
    // gå ut i vannet → legg deg på brettet
    const d2 = this.depthAt(this.x, this.z);
    if (d2 > 0.42) {
      this.setState('paddle');
      const sp = this.speed;
      this.vx = Math.sin(this.yaw) * Math.min(sp, 2.5);
      this.vz = Math.cos(this.yaw) * Math.min(sp, 2.5);
      this.w.effects.splash(this.x, 0, this.z, 22, 0.9);
      this.w.audio.splash(0.8);
      return;
    }
    // animasjon
    const run = clamp((this.speed - 3.6) / 2.8, 0, 1);
    if (this.speed > 0.3) {
      const prev = this.walkPh;
      // fasen følger tilbakelagt distanse, så føttene ikke sklir
      const stepLen = lerp(0.95, 1.7, run);
      this.walkPh += dt * Math.max(2.5, (this.speed * Math.PI) / stepLen);
      if (Math.floor(prev / Math.PI) !== Math.floor(this.walkPh / Math.PI)) {
        if (wading > 0.1) {
          this.w.effects.splash(this.x, Math.max(0, groundHeight(this.x, this.z)), this.z, 4, 0.5, 0.6);
        } else {
          this.w.effects.sand(this.x, groundHeight(this.x, this.z), this.z);
          this.w.audio.step();
        }
      }
      Poses.walk(this.targetPose, this.walkPh, run);
      const walkMix = clamp(this.speed / 1.5, 0, 1);
      if (walkMix < 1) {
        const idle = Poses.idle(newPose(), this.stateT);
        blendPose(this.targetPose, idle, this.targetPose, walkMix);
      }
    } else {
      Poses.idle(this.targetPose, this.stateT);
    }
    Poses.carry(this.targetPose);
    // brett under armen
    this.setLocals([-0.36, 1.02, 0.06, -0.12, 0, -Math.PI / 2], [0, 0, 0, 0, 0, 0]);
    // butikk-interaksjon
    const dShop = Math.hypot(this.x - SHOP.counter.x, this.z - SHOP.counter.z);
    if (dShop < 3.2) {
      this.prompt = { kind: 'shop' };
      if (input.hit('KeyE')) this.openShop();
      return;
    }
    // snakk med figurene ved bålet
    for (const n of this.w.npcs || []) {
      if (Math.hypot(this.x - n.x, this.z - n.z) < 2.6 + (n.seatY ? 0.4 : 0)) {
        this.prompt = { kind: 'talk', npc: n };
        if (input.hit('KeyE')) this.startTalk(n);
        return;
      }
    }
  }
  startTalk(n) {
    this.setState('talk');
    this.talkNpc = n;
    this.vx = this.vz = 0;
    this.w.onTalk(n);
  }
  endTalk() {
    if (this.state === 'talk') this.setState('walk');
    this.talkNpc = null;
  }
  updateTalk(dt, input) {
    const n = this.talkNpc;
    if (n) this.yaw = dampAngle(this.yaw, Math.atan2(n.x - this.x, n.z - this.z), 6, dt);
    Poses.idle(this.targetPose, this.stateT);
    // litt gestikulering mens man prater
    addJ(this.targetPose, 'shL', -0.25 - Math.max(0, Math.sin(this.stateT * 2.2)) * 0.35, 0, 0.1);
    setJ(this.targetPose, 'elL', -0.9, 0, 0);
    Poses.carry(this.targetPose);
    this.setLocals([-0.36, 1.02, 0.06, -0.12, 0, -Math.PI / 2], [0, 0, 0, 0, 0, 0]);
    if (input.hit('KeyE', 'Space', 'Enter')) this.w.onTalkNext();
    else if (input.hit('Escape')) this.w.onTalkEnd();
  }
  openShop() {
    this.setState('shop');
    this.x = SHOP.counter.x;
    this.z = SHOP.counter.z - 1.6;
    this.yaw = Math.PI;
    this.shopYaw = 0;
    this.vx = this.vz = 0;
    this.w.onShop(true);
  }
  closeShop() {
    this.setState('walk');
    this.yaw = Math.PI;
    this.w.onShop(false);
  }
  updateShop(dt, input) {
    this.shopYaw += input.turn * dt * 2.2;
    this.yaw = Math.PI + this.shopYaw;
    Poses.shop(this.targetPose, this.stateT);
    Poses.carry(this.targetPose);
    this.setLocals([-0.36, 1.02, 0.06, -0.12, 0, -Math.PI / 2], [0, 0, 0, 0, 0, 0]);
    if (input.hit('Escape', 'KeyE')) this.closeShop();
  }

  // ---------- padling ----------
  proneLocals() {
    const L = this.board.L, T = this.board.T;
    this.setLocals([0, -0.02, 0, 0, 0, 0], [0, T + 0.13, L * 0.12 - 1.25, Math.PI / 2, 0, 0]);
  }
  scanWaves() {
    // Finn de mest relevante bølgene i forhold til spilleren
    const W = this.w.waves;
    const facing = Math.cos(this.yaw); // > 0 = mot land
    let duck = null, drop = null, turn = null;
    for (const w of W.waves) {
      const ev = W.eval(w, this.x, this.z);
      const d = ev.d;
      if (d < -4 || d > 60) continue;
      const closing = Math.max(0.6, w.c - this.vz);
      if (!this.waveMem.has(w.id)) this.waveMem.set(w.id, { prevD: d, hit: false });
      const tImpact = (d - 1.2) / closing;
      const tFace = (d - 1.6) / closing;
      const insP = W.predictInside(w, this.x, Math.max(0, tImpact));
      const bPred = smoothstep(2, -3, insP);
      const Hloc = ev.H;
      const dangerous = bPred > 0.4 && Hloc > 0.4;
      const rideable = !dangerous && w.steep > 0.45 && Hloc > 0.75 && w.zc < w.closeZ - 4;
      const info = { w, ev, d, tImpact, tFace, bPred, Hloc, dangerous, rideable };
      if (dangerous && tImpact > -0.6 && tImpact < DUCK.show && (!duck || tImpact < duck.tImpact)) duck = info;
      if (rideable && facing > 0.25 && tFace > -0.6 && tFace < DROP.show && (!drop || tFace < drop.tFace)) drop = info;
      if (rideable && facing <= 0.25 && tFace > 0.8 && tFace < 4.5 && (!turn || tFace < turn.tFace)) turn = info;
    }
    if (this.waveMem.size > 20) {
      const ids = new Set(W.waves.map((w) => w.id));
      for (const k of this.waveMem.keys()) if (!ids.has(k)) this.waveMem.delete(k);
    }
    return duck || drop || turn;
  }
  checkImpacts() {
    // treff fra brytende bølger / hvitvann
    const W = this.w.waves;
    for (const w of W.waves) {
      const ev = W.eval(w, this.x, this.z);
      const mem = this.waveMem.get(w.id) || { prevD: ev.d, hit: false };
      this.waveMem.set(w.id, mem);
      const crossed = mem.prevD > 1.2 && ev.d <= 1.2;
      mem.prevD = ev.d;
      if (!crossed || mem.hit) continue;
      const b = ev.b;
      const lipping = ev.inside < 2.5 && ev.inside > -2 && w.started;
      if ((b > 0.35 || lipping) && ev.H > 0.4) {
        mem.hit = true;
        return { w, ev, power: clamp(ev.H * (0.6 + b * 0.6), 0.5, 2.6) };
      }
    }
    return null;
  }
  updatePaddle(dt, input) {
    const W = this.w.waves, fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const pStat = this.stat('paddle');
    const maxF = 3.6 + pStat * 1.6;
    const maxB = 1.2;
    let vf = this.vx * fx + this.vz * fz;
    let vs = this.vx * fz - this.vz * fx;
    const fwd = input.fwd;
    if (fwd > 0) vf += 3.4 * (1 - clamp(vf / maxF, -1, 1)) * dt * (0.75 + pStat * 0.5);
    else if (fwd < 0) vf -= 1.5 * (1 + clamp(vf / maxB, -1, 1)) * dt;
    vf *= Math.exp(-0.4 * dt);
    vs *= Math.exp(-2.6 * dt);
    // sving med treghet
    const turnMax = 1.45 - clamp(vf, 0, 4) * 0.12;
    this.yawRate = damp(this.yawRate, input.turn * turnMax, 4.5, dt);
    this.yaw = wrapAngle(this.yaw + this.yawRate * dt);
    const nfx = Math.sin(this.yaw), nfz = Math.cos(this.yaw);
    this.vx = nfx * vf + nfz * vs;
    this.vz = nfz * vf - nfx * vs;
    // bølgekrefter: helningen dytter brettet
    const [gx, gz] = W.gradient(this.x, this.z);
    this.vx += -gx * 9.8 * 0.35 * dt;
    this.vz += -gz * 9.8 * 0.35 * dt;
    // hvitvann som ruller over deg skyver mot land
    for (const w of W.waves) {
      const ev = W.eval(w, this.x, this.z);
      if (ev.b > 0.5 && ev.d > -2.5 && ev.d < 2.5 && ev.H > 0.3) this.vz += (w.c * 0.55 - this.vz) * 1.6 * dt * ev.b;
    }
    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    nx = clamp(nx, -125, 125);
    nz = Math.max(nz, -240);
    [nx, nz] = this.collide(nx, nz);
    this.x = nx;
    this.z = nz;
    this.speed = Math.hypot(this.vx, this.vz);
    // animasjon: armtak følger innsats
    const want = fwd !== 0 ? 1 : Math.abs(input.turn) > 0 ? 0.55 : 0;
    this.paddlePower = damp(this.paddlePower, want, 4, dt);
    const strokeRate = fwd < 0 ? 4.0 : 6.2;
    const prev = this.paddlePh;
    this.paddlePh += dt * strokeRate * (0.25 + this.paddlePower * 0.75) * (fwd < 0 ? -1 : 1);
    if (this.paddlePower > 0.3 && Math.floor(prev / Math.PI) !== Math.floor(this.paddlePh / Math.PI)) {
      const side = Math.floor(this.paddlePh / Math.PI) % 2 ? 1 : -1;
      const sx = this.x + fz * 0.35 * side + fx * 0.3, sz = this.z - fx * 0.35 * side + fz * 0.3;
      this.w.effects.splash(sx, W.height(sx, sz), sz, 5, 0.45, 0.7);
      this.w.audio.paddle();
    }
    if (this.speed > 1.2 && Math.random() < dt * 14) this.w.effects.wake(this.x - fx * this.board.L * 0.5, W.height(this.x, this.z), this.z - fz * this.board.L * 0.5);
    Poses.paddle(this.targetPose, this.paddlePh, this.paddlePower, 0);
    this.proneLocals();

    // tilbake til land
    if (this.depthAt(this.x, this.z) < 0.32 && this.stateT > 0.6) {
      this.setState('walk');
      this.vx *= 0.4;
      this.vz *= 0.4;
      this.w.effects.splash(this.x, 0, this.z, 10, 0.6);
      return;
    }
    // bølger: varsel, duck dive og drop in
    const info = this.scanWaves();
    this.waveInfo = info;
    if (info) {
      if (info.dangerous) {
        this.prompt = { kind: 'duck', t: info.tImpact, info };
        if (input.hit('KeyE')) this.startDuck(info);
      } else if (Math.cos(this.yaw) > 0.25) {
        this.prompt = { kind: 'drop', t: info.tFace, info };
        if (input.hit('KeyE')) this.tryDrop(info);
      } else {
        this.prompt = { kind: 'turn', info };
      }
    } else if (input.hit('KeyE')) {
      // dykk uten bølge – bare for moro
      this.duck = { good: false, quality: 'tom', w: null, maxT: 0.8 };
      this.setState('duck');
      this.w.audio.dive();
      return;
    }
    if (this.state !== 'paddle') return;
    const hit = this.checkImpacts();
    if (hit) this.getHit(hit, 1);
  }
  startDuck(info) {
    const t = info.tImpact;
    let quality = 'sen', good = false;
    if (t >= DUCK.perfect[0] && t <= DUCK.perfect[1]) { quality = 'perfekt'; good = true; }
    else if (t >= DUCK.ok[0] && t <= DUCK.ok[1]) { quality = 'ok'; good = true; }
    else if (t > DUCK.ok[1]) quality = 'tidlig';
    this.duck = { good, quality, w: info.w, maxT: good ? 2.4 : 0.85 };
    this.setState('duck');
    this.w.audio.dive();
    this.w.effects.splash(this.x, this.w.waves.height(this.x, this.z), this.z, 14, 0.7);
    if (quality === 'tidlig') this.w.hud.toast('For tidlig!', 'Dykk når markøren er i det grønne', 'bad', 1.4);
  }
  updateDuck(dt, input) {
    const W = this.w.waves;
    const D = this.duck;
    const T = this.stateT;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    // litt fremdrift under vann
    const vf = this.vx * fx + this.vz * fz;
    this.vx = fx * Math.max(vf * Math.exp(-0.8 * dt), D.good ? 1.2 : 0.4);
    this.vz = fz * Math.max(vf * Math.exp(-0.8 * dt), D.good ? 1.2 : 0.4);
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    // har bølgen passert?
    let passed = true;
    if (D.w && W.waves.includes(D.w)) {
      const ev = W.eval(D.w, this.x, this.z);
      passed = ev.d < -2.6;
      const mem = this.waveMem.get(D.w.id);
      if (mem) mem.prevD = ev.d;
      if (D.good && ev.d < 1.2 && !D.under) {
        D.under = true;
        if (mem) mem.hit = true;
      }
    }
    Poses.duck(this.targetPose, clamp(T / 0.3, 0, 1));
    this.proneLocals();
    if (Math.random() < dt * 25) this.w.effects.bubbles(this.x, this.y - 0.3, this.z, 2);
    if ((passed && T > 0.5) || T > D.maxT) {
      this.setState('paddle');
      this.w.effects.splash(this.x, W.height(this.x, this.z), this.z, 10, 0.6);
      if (D.good && D.under) {
        const perfect = D.quality === 'perfekt';
        this.w.hud.toast(perfect ? 'Perfekt duck dive!' : 'Duck dive!', perfect ? '+25 poeng' : '+10 poeng', 'good', 1.3);
        this.score += perfect ? 25 : 10;
        if (perfect) {
          this.vx += fx * 1.2;
          this.vz += fz * 1.2;
          this.w.audio.great();
        } else this.w.audio.good();
      }
      return;
    }
    // treff mens du er under (bare hvis timingen var dårlig, eller en annen bølge)
    const hit = this.checkImpacts();
    if (hit && (!D.good || hit.w !== D.w)) this.getHit(hit, D.quality === 'tidlig' ? 0.65 : 1);
  }
  getHit(hit, mult) {
    const push = (2.6 + hit.power * 2.4) * mult;
    this.washed = { push, w: hit.w, spin: (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.6), dur: 1.0 + hit.power * 0.25 };
    this.vz = push;
    this.vx *= 0.3;
    this.setState('washed');
    this.w.hud.toast('Truffet av bølgen!', 'Trykk E i det grønne feltet for å dykke under', 'bad', 1.8);
    this.w.audio.hit();
    this.w.camera.shake(0.35 * mult + 0.15, 0.6);
    this.w.effects.splash(this.x, this.w.waves.height(this.x, this.z) + 0.3, this.z, 40, 1.4, 1.2);
    this.w.effects.foamPuff(this.x, this.w.waves.height(this.x, this.z), this.z, 14, 0.9);
  }
  updateWashed(dt) {
    const W = this.w.waves;
    const S = this.washed;
    const k = this.stateT / S.dur;
    this.vz = damp(this.vz, 0.4, 1.6, dt);
    this.vx = damp(this.vx, 0, 2, dt);
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.yaw = wrapAngle(this.yaw + S.spin * dt * (1 - k) * 1.6);
    Poses.tumble(this.targetPose, this.stateT);
    this.proneLocals();
    if (Math.random() < dt * 30) this.w.effects.foamPuff(this.x, W.height(this.x, this.z), this.z, 1, 0.6);
    if (this.stateT > S.dur) {
      this.setState('paddle');
      this.vz = Math.min(this.vz, 1.5);
    }
  }

  // ---------- drop in og surfing ----------
  tryDrop(info) {
    const t = info.tFace;
    const vShore = this.vz;
    if (t > DROP.ok[1]) {
      if (this.messageCooldown <= 0) this.w.hud.toast('Vent litt…', 'Padle (W) og trykk E når markøren er i det grønne', 'bad', 1.3);
      this.messageCooldown = 0.6;
      return;
    }
    if (t < DROP.ok[0]) return;
    const perfect = t >= DROP.perfect[0] && t <= DROP.perfect[1];
    if (!perfect && vShore < 0.9) {
      this.w.hud.toast('For lite fart!', 'Padle mot land (W) mens bølgen kommer', 'bad', 1.5);
      this.w.audio.bad();
      this.messageCooldown = 1;
      return;
    }
    const W = this.w.waves;
    const w = info.w;
    const ev = W.eval(w, this.x, this.z);
    const S = this.surf;
    S.w = w;
    S.x = this.x;
    S.d = clamp(ev.d, 0.4, ev.Lf * 1.4);
    this.offZ += this.z - (W.crestZ(w, this.x) + S.d);
    S.s = 4.5 + Math.max(0, vShore) * 0.8 + (perfect ? 1.5 : 0);
    S.time = 0;
    S.carves = 0;
    S.top = 0;
    S.lastSign = 0;
    S.score = 0;
    S.lean = 0;
    S.pocketT = 0;
    S.perfect = perfect;
    S.tricks = 0;
    S.trickPts = 0;
    S.air = null;
    S.snap = null;
    S.hangK = 0;
    S.hangT = 0;
    S.trick = null;
    S.trickK = 0;
    S.trickCd = 0;
    S.spinRest = 0;
    S.wob = 0;
    S.lastYawRate = 0;
    this.yawRate = 0;
    const mem = this.waveMem.get(w.id);
    if (mem) mem.hit = true;
    this.setState('popup');
    this.w.hud.toast(perfect ? 'Perfekt drop!' : 'Drop in!', '', 'good', 1.1);
    if (perfect) this.w.audio.great();
    else this.w.audio.good();
    this.w.effects.splash(this.x, W.height(this.x, this.z), this.z, 18, 0.8);
  }
  updateSurf(dt, input) {
    const W = this.w.waves;
    const S = this.surf;
    const w = S.w;
    if (!w || !W.waves.includes(w)) return this.endRide('Bølgen døde ut', 'paddle');
    if (S.air) return this.updateAir(dt, input);
    const popup = this.state === 'popup';
    if (popup && this.stateT > 0.36) this.setState('surf');
    const turnStat = this.stat('turn'), speedStat = this.stat('speed');
    const cz = W.crestZ(w, S.x);
    const ev = W.eval(w, S.x, cz + S.d);
    const eA = W.eval(w, S.x, cz + S.d - 0.4), eB = W.eval(w, S.x, cz + S.d + 0.4);
    const slope = (eA.h - eB.h) / 0.8; // positiv på fronten
    const face = clamp(slope / 0.45, 0, 1.4);
    let cosY = Math.cos(this.yaw), sinY = Math.sin(this.yaw);
    const inside = ev.inside;
    const pocket = w.started ? Math.exp(-Math.pow((inside - 3.5) / 5, 2)) : 0.4 * smoothstep(0.7, 1, w.steep);
    S.trickCd -= dt;
    S.spinRest = damp(S.spinRest, 0, 7, dt);
    // ---- triks ----
    if (!popup) {
      // hang ten: hold Q mens du kjører rolig
      const wantHang = input.is('KeyQ') && !S.snap && S.s > 3.5;
      S.hangK = damp(S.hangK, wantHang ? 1 : 0, wantHang ? 2.6 : 5, dt);
      if (wantHang && S.hangK > 0.85) {
        S.hangT += dt;
        if (Math.abs(this.yawRate) > 1.1) {
          this.awardHang();
          S.hangK = 0.4;
          this.w.hud.toast('Mistet balansen på nesa', 'Hang ten krever rolige svinger', 'bad', 1.2);
        }
      } else if (!wantHang && S.hangT > 0) this.awardHang();
      // snap på leppa
      if (input.hit('KeyF') && !S.snap && S.trickCd <= 0) {
        if (S.s > 5.5 && S.d < ev.Lf * 0.9 && cosY < 0.35 && face > 0.15) {
          const target = Math.atan2(sinY, Math.abs(cosY) + 0.35);
          S.snap = { t: 0, dur: 0.34, from: this.yaw, delta: wrapAngle(target - this.yaw) };
          S.s *= 0.9;
          S.trickCd = 0.4;
          const pts = 90 + S.s * 6 + pocket * 60;
          this.award(pocket > 0.6 ? 'Snap i lommen!' : 'Snap!', pts);
          this.w.effects.splash(this.x, W.height(this.x, this.z) + 0.4, this.z, 34, 1.3, 1.1);
        } else if (this.messageCooldown <= 0) {
          this.w.hud.toast('Snap: kjør opp mot leppa først', 'Trenger fart og høyde på bølgen', 'bad', 1.2);
          this.messageCooldown = 1;
        }
      }
      // hopp (air)
      if (input.hit('Space') && !S.snap && S.trickCd <= 0) {
        if (S.s > 6.5 && face > 0.2 && S.d < ev.Lf * 1.05 && cosY < 0.45) {
          if (S.hangT > 0) this.awardHang();
          S.hangK = 0;
          S.air = { t: 0, h: 0, vy: 2.6 + S.s * 0.2 + Math.max(0, -cosY) * 2.4 + face * 0.6, spin: 0, spinV: 0, grabT: 0, maxH: 0 };
          this.yawRate = 0;
          this.w.audio.splash(0.7);
          this.w.effects.splash(this.x, W.height(this.x, this.z) + 0.3, this.z, 26, 1.1, 1.2);
          return;
        } else if (this.messageCooldown <= 0) {
          this.w.hud.toast('Trenger mer fart for å hoppe', 'Kjør fort opp mot toppen av bølgen og trykk Space', 'bad', 1.4);
          this.messageCooldown = 1;
        }
      }
    }
    // styring – myk respons, mindre styring under pop-up og hang ten
    const ctrl = (popup ? 0.55 : 1) * (1 - S.hangK * 0.6);
    const maxYaw = (1.35 + 0.95 * turnStat) * (1 - 0.22 * clamp(S.s / 15, 0, 1));
    const resp = 2.6 + 2.2 * turnStat;
    if (S.snap) {
      const SN = S.snap;
      SN.t += dt;
      const k = clamp(SN.t / SN.dur, 0, 1);
      const prevYaw = this.yaw;
      this.yaw = wrapAngle(SN.from + SN.delta * ease(k));
      this.yawRate = wrapAngle(this.yaw - prevYaw) / Math.max(dt, 1e-4);
      if (k >= 1) S.snap = null;
    } else {
      this.yawRate = damp(this.yawRate, input.turn * maxYaw * ctrl, resp, dt);
      this.yaw = wrapAngle(this.yaw + this.yawRate * dt);
    }
    cosY = Math.cos(this.yaw);
    sinY = Math.sin(this.yaw);
    S.wob = damp(S.wob, (this.yawRate - S.lastYawRate) / Math.max(dt, 1e-4) * 0.12, 6, dt);
    S.lastYawRate = this.yawRate;
    // krefter
    const aG = 9.8 * 0.9 * slope * cosY;
    let aD = 1.85 * Math.min(face, 1) + 2.4 * pocket * Math.min(face, 1.2);
    let aDrag = 0.3 + 0.0105 * S.s * S.s;
    const aTurn = S.snap ? 0 : 0.08 * this.yawRate * this.yawRate * S.s;
    if (input.fwd > 0 && face > 0.2) aD += 1.2 * clamp(1 - S.s / 16, 0, 1);
    if (input.fwd < 0) aDrag += 2.8;
    // på nesa går brettet litt fortere (trim), men det er vanskeligere å svinge
    aD += S.hangK * 0.6 * face;
    // ute på flaten foran bølgen tar bølgen deg raskt igjen
    const offFace = smoothstep(ev.Lf * 1.4, ev.Lf * 2.6, S.d);
    aDrag += offFace * 1.5;
    S.s += (aG + aD - aDrag - aTurn) * dt;
    S.s = clamp(S.s, 0, 13 + 7 * speedStat);
    let pull = 1.25 + 0.5 * face + offFace * w.c * 0.55;
    if (S.s < 3) pull += (3 - S.s) * 0.9;
    S.d += (S.s * cosY - pull) * dt;
    S.x += S.s * sinY * dt;
    S.time += dt;
    S.top = Math.max(S.top, S.s);
    // carves
    if (!popup && !S.snap && Math.abs(this.yawRate) > 0.75 && S.s > 6) {
      const sg = Math.sign(this.yawRate);
      if (S.lastSign !== 0 && sg !== S.lastSign) {
        S.carves++;
        S.score += 40;
        this.w.audio.good();
      }
      S.lastSign = sg;
    }
    if (pocket > 0.6 && w.started) S.pocketT += dt;
    S.score += S.s * dt * 2 + pocket * dt * 6;
    // posisjon
    this.x = S.x;
    this.z = W.crestZ(w, S.x) + S.d;
    this.speed = S.s;
    this.vx = sinY * S.s;
    this.vz = cosY * S.s + w.c;
    // effekter
    const carve = Math.abs(this.yawRate) * S.s;
    const yH = W.height(this.x, this.z);
    if (carve > 3.5 && !popup) {
      const side = this.yawRate > 0 ? -1 : 1; // spruten går ut på yttersiden
      const ox = Math.cos(this.yaw) * side, oz = -Math.sin(this.yaw) * side;
      this.w.effects.railSpray(this.x - sinY * 0.6, yH, this.z - cosY * 0.6, ox, oz, clamp(carve / 9, 0.3, S.snap ? 2.4 : 1.6));
    }
    if (Math.random() < dt * 30) this.w.effects.wake(this.x - sinY * this.board.L * 0.45, yH, this.z - cosY * this.board.L * 0.45);
    // pose
    const lean = clamp(-this.yawRate * S.s * 0.045, -0.7, 0.7);
    S.lean = damp(S.lean, lean, 6, dt);
    const crouch = clamp(0.25 + S.s / 30 + (input.fwd > 0 ? 0.25 : 0) + Math.abs(S.lean) * 0.5, 0, 1);
    S.trick = S.snap ? 'snap' : S.hangK > 0.05 ? 'hang' : S.trick;
    S.trickK = damp(S.trickK, S.snap ? 1 : S.hangK, S.snap ? 14 : 8, dt);
    Poses.stance(this.targetPose, S.lean / 0.7, crouch, this.stateT, input.fwd > 0 ? 1 : 0, { wob: S.wob, trick: S.trick, trickK: S.trick === 'hang' ? S.hangK : S.trickK });
    const L = this.board.L, T = this.board.T;
    if (popup) {
      // fra liggende: armene presser opp, beina trekkes inn
      Poses.paddle(this.targetPose, 0.0, 0, 0.5);
      setJ(this.targetPose, 'shL', -1.75, 0, 0.45);
      setJ(this.targetPose, 'shR', -1.75, 0, -0.45);
      setJ(this.targetPose, 'elL', -0.2, 0, 0);
      setJ(this.targetPose, 'elR', -0.2, 0, 0);
      setJ(this.targetPose, 'hipL', -1.2, 0, 0.2);
      setJ(this.targetPose, 'hipR', -0.6, 0, -0.2);
      setJ(this.targetPose, 'knL', 1.8, 0, 0);
      setJ(this.targetPose, 'knR', 1.2, 0, 0);
      this.setLocals([0, -0.02, 0, 0, 0, 0], [0, T + 0.4, L * 0.12 - 1.0, Math.PI / 2 - 0.5, 0, 0]);
    } else {
      // på hang ten går surferen ut på nesa
      this.setLocals([0, -0.02, 0, 0, 0, 0], [0, T - 0.02, lerp(-L * 0.06, L * 0.3, S.hangK), 0, -Math.PI / 2, 0]);
    }
    // hint om retning
    S.hint = '';
    const shoulderDir = w.dir ? w.dir : Math.sign(S.x - w.peak) || 1; // vekk fra toppen
    if (S.hangK > 0.85) S.hint = `Hang ten! ${S.hangT.toFixed(1)} s`;
    else if (w.started && Math.abs(inside) < 25) {
      // skjermhøyre når du ser mot land er -x
      if (S.time < 3) S.hint = shoulderDir < 0 ? 'Skulderen er til høyre → (D)' : '← Skulderen er til venstre (A)';
      else if (inside < 2.5) S.hint = 'Curlen tar deg igjen – få fart!';
      else if (pocket > 0.7) S.hint = 'I lommen! 🔥';
      else if (S.s > 7 && S.tricks === 0) S.hint = 'Opp mot leppa + Space for å hoppe';
    } else if (S.time < 2) S.hint = 'Sving langs bølgen med A/D';
    // slutt
    const depth = this.depthAt(this.x, this.z);
    if (S.d < -0.9) return this.endRide(S.s > 4 ? 'Kick-out!' : 'Mistet bølgen', 'paddle', true);
    if (w.started && inside < -0.6) {
      if (S.d < ev.Lf * 1.8) return this.wipe('Curlen tok deg!');
      return this.endRide('Hvitvannet tok igjen', 'washed');
    }
    if (depth < 0.9 || w.zc > -4) return this.endRide('Ride ferdig', depth < 0.45 ? 'walk' : 'paddle', true);
  }
  // Triks-poeng: combo-multiplikator for hvert triks på samme bølge
  award(name, pts) {
    const S = this.surf;
    const mult = Math.min(2.5, 1 + S.tricks * 0.25) * (this.board.trickBonus || 1);
    const p = Math.round(pts * mult);
    S.score += p;
    S.trickPts += p;
    S.tricks++;
    this.w.hud.trick(name, p, mult);
    if (S.tricks > 1 || p > 300) this.w.audio.great();
    else this.w.audio.good();
  }
  awardHang() {
    const S = this.surf;
    if (S.hangT > 0.7) this.award(`Hang ten ${S.hangT.toFixed(1)} s`, (40 + S.hangT * 70) * (this.board.L > 2.4 ? 1.4 : 1));
    S.hangT = 0;
  }
  updateAir(dt, input) {
    const W = this.w.waves;
    const S = this.surf;
    const A = S.air;
    const w = S.w;
    A.t += dt;
    A.vy -= 9.8 * 1.05 * dt;
    A.h += A.vy * dt;
    A.maxH = Math.max(A.maxH, A.h);
    // A/D spinner, W griper brettet
    A.spinV = damp(A.spinV, input.turn * 8.2, input.turn ? 5 : 11, dt);
    A.spin += A.spinV * dt;
    if (!input.turn) {
      // slipper du tasten, retter brettet seg mot nærmeste halve omdreining (lettere å lande)
      const near = Math.round(A.spin / Math.PI) * Math.PI;
      A.spin += (near - A.spin) * (1 - Math.exp(-5 * dt));
    }
    if (input.fwd > 0) A.grabT += dt;
    const cosY = Math.cos(this.yaw), sinY = Math.sin(this.yaw);
    S.s = Math.max(0, S.s - 0.5 * dt);
    S.x += S.s * sinY * dt;
    S.d += (S.s * cosY * 0.7 - 1.0) * dt;
    S.time += dt;
    this.x = S.x;
    this.z = W.crestZ(w, S.x) + S.d;
    this.speed = S.s;
    this.yawRate = 0;
    S.trick = input.fwd > 0 ? 'grab' : 'air';
    S.trickK = damp(S.trickK, 1, 9, dt);
    S.lean = damp(S.lean, 0, 4, dt);
    Poses.stance(this.targetPose, 0, 0.6, this.stateT, 0, { trick: S.trick, trickK: S.trickK });
    const L = this.board.L, T = this.board.T;
    this.setLocals([0, -0.02, 0, 0, 0, 0], [0, T - 0.02, -L * 0.06, 0, -Math.PI / 2, 0]);
    const halves = Math.round(Math.abs(A.spin) / Math.PI);
    S.hint = halves > 0 ? `${halves * 180}°` + (A.grabT > 0.2 ? ' + grab' : '') : A.grabT > 0.2 ? 'Grab!' : 'A/D spinn · W grab';
    if (A.h > 0 || A.t < 0.15) return;
    // landing
    S.air = null;
    S.trickK = 0;
    S.trick = null;
    const rem = wrapAngle(A.spin);
    const clean = Math.abs(rem) < 0.8;
    const reverse = Math.abs(Math.abs(rem) - Math.PI) < 0.8;
    if (!clean && !reverse) return this.wipe('Skjev landing!');
    S.spinRest = rem; // brettet glir rundt igjen etter landing
    const deg = halves * 180;
    const grab = A.grabT > 0.2;
    let name = deg === 0 ? 'Air' : halves % 2 ? `Air reverse ${deg}` : `Air ${deg}`;
    if (grab) name += ' + grab';
    this.award(name, 90 + A.maxH * 60 + halves * 110 + (grab ? 100 : 0));
    this.w.effects.splash(this.x, W.height(this.x, this.z) + 0.2, this.z, 30, 1.2, 1.1);
    this.w.audio.splash(0.9);
    this.w.camera.shake(0.15, 0.3);
    S.s *= reverse ? 0.8 : 0.92;
    if (S.d < -0.9) return this.endRide('Air ut bak bølgen!', 'paddle', true);
  }
  endRide(msg, next, good = false) {
    const S = this.surf;
    const pts = Math.round(S.score);
    if (S.time > 1.2) {
      this.score += pts;
      this.w.hud.toast(msg, `${S.time.toFixed(1)} s · ${Math.round(S.top * 3.6)} km/t · ${S.carves} carves · ${S.tricks} triks · +${pts} poeng`, good ? 'good' : 'bad', 3.2);
      if (good && S.time > 6) this.w.audio.great();
    } else this.w.hud.toast(msg, '', good ? 'good' : 'bad', 1.4);
    S.w = null;
    S.air = null;
    S.hangK = 0;
    if (next === 'washed') {
      this.getHit({ w: null, power: 1 }, 0.6);
      return;
    }
    this.vx = Math.sin(this.yaw) * Math.min(this.speed, 3);
    this.vz = Math.cos(this.yaw) * Math.min(this.speed, 3);
    if (next === 'paddle') {
      this.setState('paddle');
      this.w.effects.splash(this.x, this.w.waves.height(this.x, this.z), this.z, 16, 0.7);
    } else this.setState(next);
  }
  wipe(msg) {
    const S = this.surf;
    const pts = Math.round(S.score * 0.5);
    this.score += pts;
    this.w.hud.toast('Wipeout!', `${msg} · ${S.time.toFixed(1)} s · +${pts} poeng`, 'bad', 2.6);
    this.w.audio.hit();
    this.w.camera.shake(0.5, 0.8);
    this.w.effects.splash(this.x, this.w.waves.height(this.x, this.z) + 0.5, this.z, 50, 1.6, 1.3);
    this.w.effects.foamPuff(this.x, this.w.waves.height(this.x, this.z), this.z, 20, 1.1);
    S.w = null;
    S.air = null;
    S.hangK = 0;
    this.vz = 4.2;
    this.vx = Math.sin(this.yaw) * 2;
    this.setState('wipeout');
  }
  updateWipeout(dt) {
    const W = this.w.waves;
    this.vz = damp(this.vz, 0.3, 1.2, dt);
    this.vx = damp(this.vx, 0, 1.5, dt);
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    Poses.tumble(this.targetPose, this.stateT * 1.3);
    this.proneLocals();
    if (Math.random() < dt * 20) this.w.effects.bubbles(this.x, W.height(this.x, this.z) - 0.8, this.z, 2);
    if (this.stateT > 1.9) {
      this.yaw = Math.PI; // kommer opp med nesa ut mot havet
      this.setState('paddle');
      this.w.effects.splash(this.x, W.height(this.x, this.z), this.z, 12, 0.7);
      if (this.depthAt(this.x, this.z) < 0.4) this.setState('walk');
    }
  }

  // ---------- rigg og blanding ----------
  setLocals(board, ch) {
    this.local.board = board;
    this.local.char = ch;
  }
  applyRig(dt) {
    const W = this.w.waves;
    const s = this.state;
    // høyde og helning
    this.updateRigY();
    this.rigYOff = damp(this.rigYOff, 0, 6, dt);
    let y = this.rigY + this.rigYOff;
    let pitch = 0, roll = 0;
    if (s !== 'walk' && s !== 'shop' && s !== 'talk') {
      const [gx, gz] = W.gradient(this.x, this.z, 0.6);
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      const along = gx * fx + gz * fz;
      const lx = Math.cos(this.yaw), lz = -Math.sin(this.yaw);
      const side = gx * lx + gz * lz;
      pitch = -Math.atan(along);
      roll = Math.atan(side);
      if (s === 'paddle') {
        // gynging og nesa løftes når du padler
        pitch += Math.sin(this.paddlePh * 2) * 0.02 * this.paddlePower - 0.03 * this.paddlePower;
        roll += Math.sin(this.paddlePh) * 0.035 * this.paddlePower - this.yawRate * 0.08;
      }
      if (s === 'surf' || s === 'popup') {
        roll += this.surf.lean * 0.75;
        if (this.surf.air) {
          y += this.surf.air.h;
          pitch = pitch * 0.4 - 0.12;
          roll *= 0.4;
        }
      }
      if (s === 'duck') {
        const T = this.stateT, D = this.duck;
        const down = smoothstep(0, 0.28, T) * (1 - smoothstep(D.maxT - 0.35, D.maxT, T));
        const passedUp = D.good ? 1 : 1;
        y -= down * 1.05 * passedUp;
        pitch += 0.55 * smoothstep(0, 0.2, T) * (1 - smoothstep(0.2, 0.55, T)) - 0.35 * smoothstep(D.maxT - 0.5, D.maxT, T) * 0.5;
      }
      if (s === 'washed') {
        const k = this.stateT / this.washed.dur;
        y -= Math.sin(Math.min(1, k) * Math.PI) * 0.55;
        roll += Math.sin(this.stateT * 9) * 0.5 * (1 - k);
        pitch += Math.sin(this.stateT * 7) * 0.3 * (1 - k);
      }
      if (s === 'wipeout') {
        const k = this.stateT / 1.9;
        y -= Math.sin(Math.min(1, k) * Math.PI) * 1.4;
        roll += this.stateT * 6 * (1 - k);
        pitch += Math.sin(this.stateT * 5) * 0.8 * (1 - k);
      }
    }
    this.pitch = damp(this.pitch, pitch, 10, dt);
    this.roll = damp(this.roll, roll, s === 'surf' ? 8 : 10, dt);
    this.y = y;
    this.offX = damp(this.offX, 0, 5, dt);
    this.offZ = damp(this.offZ, 0, 5, dt);
    const S = this.surf;
    const spin = s === 'surf' ? (S.air ? S.air.spin : S.spinRest || 0) : 0;
    this.rig.set(this.x + this.offX, y, this.z + this.offZ, this.pitch, this.yaw + spin, this.roll);
    // blanding av pose og lokale transformasjoner
    this.blendT += dt;
    const k = ease(clamp(this.blendT / this.blendDur, 0, 1));
    blendPose(this.pose, this.fromPose, this.targetPose, k);
    this.char.applyPose(this.pose);
    const lb = this.local.board.map((v, i) => lerp(this.fromLocal.board[i], v, k));
    const lc = this.local.char.map((v, i) => lerp(this.fromLocal.char[i], v, k));
    if (k >= 1) {
      this.fromLocal.board = this.local.board.slice();
      this.fromLocal.char = this.local.char.slice();
    }
    this.boardNode.set(lb[0], lb[1], lb[2], lb[3], lb[4], lb[5]);
    this.char.root.set(lc[0], lc[1], lc[2], lc[3], lc[4], lc[5]);
    // skjul kropp delvis under vann ved dykk
  }
}
