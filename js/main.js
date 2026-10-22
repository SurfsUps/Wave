// Korallbukta Surf – hovedløkke
import { Renderer, Mesh, makeMaterial } from './engine/renderer.js';
import { Node, clamp, smoothstep } from './engine/math.js';
import { HeightField, buildTerrainGeo, groundHeight } from './world/terrain.js';
import { WaveSystem } from './world/waves.js';
import { Water } from './world/water.js';
import { buildBeach, FIRE, SHOP } from './world/props.js';
import { Player, DUCK, DROP } from './player/player.js';
import { CameraRig } from './game/camera.js';
import { Input } from './game/input.js';
import { Hud, ShopUI } from './game/hud.js';
import { Effects } from './game/effects.js';
import { Audio } from './game/audio.js';
import { OUTFITS } from './player/outfits.js';
import { BOARDS } from './player/boards.js';
import { buildNpcs, dialogFor, UNLOCK_SCORE } from './world/npcs.js';

const canvas = document.getElementById('game');
const manual = new URLSearchParams(location.search).has('manual');
const $ = (id) => document.getElementById(id);

function fail(e) {
  console.error(e);
  const el = $('error');
  el.classList.remove('hidden');
  el.textContent = 'Kunne ikke starte spillet:\n' + (e && e.message ? e.message : e);
}

async function boot() {
  const renderer = new Renderer(canvas);
  await new Promise((r) => setTimeout(r, 30));
  const hf = new HeightField(256);
  const seedQ = new URLSearchParams(location.search).get('seed');
  const waves = new WaveSystem(hf, seedQ ? parseInt(seedQ) : (Date.now() % 100000) | 0);
  const water = new Water(renderer, waves, hf);
  const scene = new Node();
  scene.add(new Node(new Mesh(renderer.gl, buildTerrainGeo(300, 300)), makeMaterial({ spec: 0.05 })));
  const beach = buildBeach(renderer);
  scene.add(beach.root);
  const npc = buildNpcs(renderer);
  scene.add(npc.root);
  const effects = new Effects(renderer);
  const audio = new Audio();
  const hud = new Hud();
  const camera = new CameraRig();
  const input = new Input(canvas);
  const world = { waves, colliders: [...beach.colliders, ...npc.colliders], npcs: npc.npcs, effects, audio, hud, camera, onShop: null };
  const player = new Player(renderer, world);
  scene.add(player.rig);
  camera.yaw = player.yaw;

  // fremgang: surfepoeng og opplåste brett lagres i nettleseren
  const progress = { score: 0, unlocked: [], announced: false, visits: {} };
  try {
    Object.assign(progress, JSON.parse(localStorage.getItem('korallbukta-progress') || '{}'));
  } catch (e) { /* ignorer */ }
  player.score = progress.score || 0;
  const isUnlocked = (item) => !item.unlock || progress.unlocked.includes(item.id);
  let savedScore = player.score;
  function saveProgress() {
    progress.score = Math.round(player.score);
    try { localStorage.setItem('korallbukta-progress', JSON.stringify(progress)); } catch (e) { /* ignorer */ }
  }
  function unlock(id) {
    if (!progress.unlocked.includes(id)) progress.unlocked.push(id);
    saveProgress();
  }

  const shop = new ShopUI(
    (kind, id) => {
      if (kind === 'outfit') {
        // antrekket kommer med sitt eget tilbehør (kan byttes etterpå)
        const o = OUTFITS.find((x) => x.id === id);
        player.setLook({ outfit: id, hat: o.hat, glasses: o.glasses });
        shop.state.hat = o.hat;
        shop.state.glasses = o.glasses;
      } else player.setLook({ [kind]: id });
      saveLook();
    },
    () => player.closeShop(),
    audio,
    isUnlocked
  );
  world.onShop = (open) => {
    if (open) shop.show({ outfit: player.look.outfit, hat: player.look.hat, glasses: player.look.glasses, board: player.look.board });
    else shop.hide();
  };
  function saveLook() {
    try { localStorage.setItem('korallbukta-look', JSON.stringify(player.look)); } catch (e) { /* ignorer */ }
  }
  try {
    const saved = JSON.parse(localStorage.getItem('korallbukta-look') || 'null');
    if (saved) {
      const b = BOARDS.find((x) => x.id === saved.board);
      if (!b || !isUnlocked(b)) saved.board = 'hibiskus';
      player.setLook(saved);
    }
  } catch (e) { /* ignorer */ }

  // samtaler med figurene ved bålet
  let talk = null;
  function showLine() {
    const line = talk.lines[talk.i];
    const text = typeof line === 'string' ? line : line.text;
    if (line && line.give) {
      unlock(line.give);
      player.setLook({ board: line.give });
      saveLook();
      audio.great();
      hud.toast('Du fikk maisbrettet!', 'Chicken Joes brett er ditt. Finnes også i Bølgehytta.', 'good', 3.5);
    }
    hud.dialog({ name: talk.npc.name, color: talk.npc.color, text, last: talk.i === talk.lines.length - 1 });
    audio.click();
  }
  world.onTalk = (n) => {
    const v = progress.visits[n.id] || 0;
    const lines = dialogFor(n.id, { score: player.score, hasCorn: progress.unlocked.includes('mais') && progress.cornGiven }, v);
    if (n.id === 'joe' && player.score >= UNLOCK_SCORE && !progress.cornGiven) progress.cornGiven = true;
    else progress.visits[n.id] = v + 1;
    saveProgress();
    talk = { npc: n, lines, i: 0 };
    n.isTalking = true;
    showLine();
  };
  world.onTalkNext = () => {
    if (!talk) return;
    talk.i++;
    if (talk.i >= talk.lines.length) world.onTalkEnd();
    else showLine();
  };
  world.onTalkEnd = () => {
    if (talk) talk.npc.isTalking = false;
    talk = null;
    hud.dialog(null);
    player.endTalk();
  };

  // bølgehendelser: lyd og sprut
  let setTimer = 0;
  let bombTimer = 0;
  waves.on((type, w) => {
    if (type === 'set') {
      setTimer = 9;
    }
    if (type === 'bomb') bombTimer = 7;
    if (type === 'break') {
      const d = Math.hypot(w.peak - player.x, waves.crestZ(w, w.peak) - player.z);
      audio.crash(clamp(1.2 - d / 120, 0, 1) * (w.big ? 1 : 0.6));
    }
  });

  let running = false;
  let last = performance.now();
  let time = 0;
  let gullT = 5;
  const opaque = [];

  $('loading').textContent = 'Klar!';
  const startBtn = $('start-btn');
  startBtn.disabled = false;
  startBtn.addEventListener('click', () => {
    $('start').classList.add('hidden');
    hud.show();
    audio.start();
    running = true;
    hud.toast('Velkommen til Korallbukta!', 'Gå ut i vannet for å padle ut – eller besøk Bølgehytta', 'good', 4);
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyH' && running) hud.toggleHelp();
    if (e.code === 'KeyM' && running) {
      audio.setMuted(!audio.muted);
      hud.toast(audio.muted ? 'Lyd av' : 'Lyd på', '', 'good', 1);
    }
  });
  window.addEventListener('resize', () => renderer.resize());

  function updateHud(dt) {
    const s = player.state;
    const modes = {
      walk: ['På stranden', [[['W', 'A', 'S', 'D'], 'Gå'], [['Shift'], 'Løp'], [['E'], 'Butikk (ved disken)'], [['H'], 'Hjelp']]],
      shop: ['Bølgehytta', [[['A', 'D'], 'Roter karakteren'], [['Esc'], 'Lukk']]],
      talk: ['Prat', [[['E'], 'Fortsett'], [['Esc'], 'Lukk']]],
      paddle: ['Padling', [[['W'], 'Padle frem'], [['S'], 'Padle bakover (sakte)'], [['A', 'D'], 'Snu brettet'], [['E'], 'Duck dive / drop in']]],
      duck: ['Duck dive', [[['W'], 'Hold fremdriften']]],
      washed: ['Oi!', [[['W'], 'Kom deg videre']]],
      popup: ['Drop in!', [[['A', 'D'], 'Sving langs bølgen']]],
      surf: ['Surfing', [[['A', 'D'], 'Carve (myke svinger)'], [['W'], 'Pump for fart'], [['S'], 'Brems / stall'], [['Space'], 'Hopp (A/D spinn, W grab)'], [['F'], 'Snap på leppa'], [['Q'], 'Hold: hang ten']]],
      wipeout: ['Wipeout', [[['…'], 'Kommer opp igjen']]],
    };
    const [mode, rows] = modes[s] || modes.walk;
    hud.controls(mode, rows);
    // interaksjon / hint
    const pr = player.prompt;
    if (s === 'walk' && pr && pr.kind === 'shop') hud.interact('Surfebutikken', 'E');
    else if (s === 'walk' && pr && pr.kind === 'talk') hud.interact('Snakk med ' + pr.npc.name, 'E');
    else if (s === 'paddle' && pr && pr.kind === 'turn') hud.interact('Bølge bak deg – snu mot land (A/D) for å ta den', null);
    else if (s === 'paddle' && !pr && player.z < -48 && waves.waves.every((w) => w.zc < -150 || w.zc > player.z + 5)) hud.interact('I lineupen – vent på neste sett', null);
    else hud.interact(null);
    // timing-bar
    if (pr && (pr.kind === 'duck' || pr.kind === 'drop') && (s === 'paddle')) {
      const isDuck = pr.kind === 'duck';
      const W = isDuck ? DUCK : DROP;
      hud.timing({
        label: isDuck ? (pr.info.bPred > 0.8 ? 'Hvitvann rett mot deg!' : 'Bølgen bryter foran deg!') : 'Ridebar bølge bakfra!',
        action: isDuck ? 'Duck dive' : 'Drop in – padle (W)!',
        t: pr.t,
        ok: W.ok,
        perfect: W.perfect,
        range: [W.show, -0.6],
        cls: isDuck ? 'duck' : 'dropin',
      });
    } else hud.timing(null);
    // ride-statistikk
    if (s === 'surf' || s === 'popup') {
      const S = player.surf;
      hud.ride({ kmh: S.s * 3.6, time: S.time, carves: S.carves, tricks: S.tricks, hint: S.hint });
    } else hud.ride(null);
    // sett-indikator
    if (bombTimer > 0) {
      bombTimer -= dt;
      hud.setIndicator('En ekstra stor bølge er på vei!');
    } else if (setTimer > 0) {
      setTimer -= dt;
      hud.setIndicator(player.z < -10 ? 'Et sett er på vei inn!' : 'Et sett ruller inn i bukta');
    } else hud.setIndicator(null);
    if (setTimer > 0) setTimer -= bombTimer > 0 ? dt : 0;
    hud.score(player.score);
    // lagre poeng og lås opp maisbrettet ved 2000
    if (Math.round(player.score) !== savedScore) {
      savedScore = Math.round(player.score);
      if (player.score >= UNLOCK_SCORE && !progress.unlocked.includes('mais')) {
        unlock('mais');
        hud.toast('2000 surfepoeng!', 'Chicken Joe har noe til deg ved bålet 🌽', 'good', 4.5);
        audio.great();
      }
      saveProgress();
    }
    hud.update(dt);
  }

  let slowT = 0, fastT = 0;
  function frame(now) {
    const raw = (now - last) / 1000;
    const dt = Math.min(0.05, raw);
    last = now;
    // adaptiv oppløsning: senk pikseltettheten hvis maskinen sliter
    if (running) {
      if (raw > 0.026) { slowT += raw; fastT = 0; } else { fastT += raw; slowT = Math.max(0, slowT - raw * 0.5); }
      if (slowT > 2.5 && (renderer.dprCap || 1.75) > 0.75) {
        renderer.dprCap = Math.max(0.75, (renderer.dprCap || 1.75) - 0.25);
        renderer.resize();
        slowT = 0;
      }
    }
    time += dt;
    try {
      step(dt);
    } catch (e) {
      fail(e);
      return;
    }
    requestAnimationFrame(frame);
  }

  function step(dt, render = true) {
    if (manual) time += dt;
    renderer.time = time;
    waves.update(dt);
    if (running) player.update(dt, input, camera);
    else player.applyRig(dt);
    camera.update(dt, player, input, waves);
    beach.update(dt, time, player);
    npc.update(dt, time, player);
    if (running) updateHud(dt);
    input.endFrame(dt);

    // partikler fra leppa og bålet
    water.updateLip();
    for (const e of water.lipEdges) {
      const dx = e[0] - camera.pos[0], dz = e[2] - camera.pos[2];
      if (dx * dx + dz * dz < 160 * 160 && Math.random() < 0.9) effects.lipSpray(e[0], e[1], e[2], e[3]);
    }
    if (Math.random() < dt * 12) effects.sparks(FIRE.x, groundHeight(FIRE.x, FIRE.z) + 0.2, FIRE.z);
    if (Math.random() < dt * 3) effects.smoke(FIRE.x, groundHeight(FIRE.x, FIRE.z) + 0.2, FIRE.z);
    effects.update(dt);

    // lyd
    if (audio.ready) {
      let breaking = 0;
      for (const w of waves.waves) {
        if (!w.started) continue;
        const d = Math.abs(waves.crestZ(w, player.x) - player.z);
        breaking += clamp(1 - d / 90, 0, 1) * clamp(w.Hbase / 2, 0.2, 1);
      }
      const shoreDist = Math.abs(player.z - 4);
      const fireD = Math.hypot(player.x - FIRE.x, player.z - FIRE.z);
      audio.ambience({
        breaking: clamp(breaking, 0, 1.2),
        shore: clamp(1 - shoreDist / 50, 0, 1),
        wind: player.state === 'surf' ? clamp(player.speed / 15, 0, 1) : 0.08,
        fire: clamp(1 - fireD / 14, 0, 1),
        under: (player.state === 'duck' && player.stateT > 0.15) || player.state === 'wipeout',
      });
      if (fireD < 12 && Math.random() < dt * 6) audio.crackle();
      gullT -= dt;
      if (gullT < 0) { audio.gull(); gullT = 8 + Math.random() * 14; }
    }

    if (!render) return;
    // tegn
    renderer.setCamera(camera.pos, camera.target, camera.fov);
    scene.update();
    opaque.length = 0;
    renderer.collect(scene, opaque);
    renderer.setShadowCenter(player.x, player.y, player.z);
    renderer.shadowPass(opaque);
    renderer.beginMain();
    renderer.drawItems(opaque, false);
    water.draw();
    renderer.drawItems(opaque, true);
    effects.draw();
  }

  // testkroker (brukes av utviklingsverktøy)
  const advance = (n, dt = 1 / 30) => {
    for (let i = 0; i < n; i++) step(dt, i === n - 1);
  };
  window.__game = { player, waves, camera, input, hud, start: () => startBtn.click(), step, advance };
  if (!manual) requestAnimationFrame(frame);
  window.__done = true;
}

boot().catch(fail);
