// Figurer ved bålet: Chicken Joe (en avslappet hane med maisbrett) og Cody (en surfende pingvin).
// Stiliserte, egne modeller bygd av enkle former, med litt idle-animasjon og hode som følger spilleren.
import { Node, clamp, damp, dampAngle, smoothstep } from '../engine/math.js';
import { Mesh, makeMaterial } from '../engine/renderer.js';
import { Geo, cylinder, sphere, lathe, tube, hex, mixColor } from '../engine/geometry.js';
import { groundHeight } from './terrain.js';
import { FIRE } from './props.js';
import { BOARDS, buildBoardGeo, buildFinsGeo, boardCanvas } from '../player/boards.js';

export const UNLOCK_SCORE = 2000;

// Belønninger fra figurene ved bålet. kind: board / hat / outfit. Juster poeng her og «unlock» på varen.
export const REWARDS = [
  { score: 2000, kind: 'board', id: 'mais', from: 'joe', name: 'maisbrettet',
    lines: ['Wow… over 2000 surfepoeng? Du er jo helt rå!', 'Her, ta maisbrettet mitt. Det er det beste brettet på hele stranden.', 'Pass godt på det, ok? Og ikke spis det. Jeg har prøvd.'] },
  { score: 3000, kind: 'board', id: 'isflak', from: 'cody', name: 'Codys Isflak',
    lines: ['3000 poeng! Jeg så deg der ute. Den svingen var skarp.', 'Du kan låne Isflak, brettet mitt. Nei forresten, du kan få det.', 'Det svinger nesten av seg selv. Perfekt for cutbacks.'] },
  { score: 4000, kind: 'hat', id: 'lei', from: 'joe', name: 'blomsterkransen',
    lines: ['Hei, 4000 poeng! Du trenger noe fint på hodet.', 'Ta blomsterkransen min. Den gir deg… blomsterkrefter. Tror jeg.', 'Den lukter litt av mais. Det er en bonus.'] },
  { score: 5000, kind: 'outfit', id: 'balkveld', from: 'cody', name: 'Bålkveld-rashen',
    lines: ['5000! Nå er du en av oss her ved bålet.', 'Den her rashen har jeg hatt i årevis. Den er din nå.', 'Den holder deg varm på kveldsøktene.'] },
  { score: 7000, kind: 'board', id: 'gull', from: 'joe', name: 'Gullbølgen',
    lines: ['Sju tusen poeng. Sju! Det er… mange.', 'Jeg fant dette brettet på stranden en morgen. Det glødet i sola.', 'Gullbølgen. Det ble ment for deg. Eller for meg. Men mest deg.'] },
  { score: 10000, kind: 'outfit', id: 'legende', from: 'cody', name: 'legende-antrekket',
    lines: ['Ti tusen poeng. Jeg har aldri sett noe sånt.', 'Du er Korallbuktas legende nå. Det er offisielt. Jeg bestemte det akkurat.', 'Her. Gull og korall. Ingen andre har denne.'] },
];
export const rewardFor = (id) => REWARDS.find((r) => r.id === id);

const mat = (o = {}) => makeMaterial(Object.assign({ spec: 0.2 }, o));

// Bøyd fjær/hårstrå som rør langs en kurve
function strand(x, y, z, dx, dy, dz, len, curl, r0, r1, col, n = 7) {
  const pts = [];
  const rad = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = curl * t * t;
    pts.push([x + dx * len * t, y + dy * len * t + Math.sin(a) * len * 0.35 - (1 - Math.cos(a)) * 0.02, z + dz * len * t]);
    rad.push(r0 + (r1 - r0) * t);
  }
  return tube(pts, rad, 6, col);
}

// ---------- Chicken Joe ----------
function buildJoe(gl) {
  const root = new Node();
  const parts = {};
  const tan = hex('#c99a66'), dark = hex('#8a5f3a'), belly = hex('#e2bf8c');
  const legCol = '#d8a25c';
  // bein og føtter
  const legs = new Geo();
  for (const s of [-1, 1]) {
    legs.add(cylinder(0.022, 0.028, 0.46, 8, legCol).tf(s * 0.085, 0.02, 0.0, 0, 0, s * 0.05));
    for (const a of [-0.5, 0, 0.5]) legs.add(cylinder(0.012, 0.018, 0.13, 6, legCol).tf(0, 0, 0, Math.PI / 2 - 0.1, a, 0).tf(s * 0.085, 0.02, 0.0));
    legs.add(cylinder(0.01, 0.014, 0.07, 6, legCol).tf(0, 0, 0, -Math.PI / 2 + 0.3, 0, 0).tf(s * 0.085, 0.02, 0));
  }
  root.add(new Node(new Mesh(gl, legs), mat({ spec: 0.3 })));

  // kropp: pæreform med lys mage og mørkere rygg
  const body = new Node();
  body.pos = [0, 0.44, 0];
  root.add(body);
  parts.body = body;
  const torso = lathe([[0, -0.04], [0.14, 0.0], [0.2, 0.09], [0.215, 0.22], [0.19, 0.36], [0.14, 0.47], [0.085, 0.55], [0.06, 0.6]], 18)
    .tf(0, 0, 0, 0, 0, 0, 1, 1, 0.9);
  torso.colorFn((x, y, z) => {
    const front = smoothstep(-0.02, 0.12, z);
    const scale = 0.06 * Math.sin(y * 70 + Math.sin(x * 40) * 2);
    return mixColor(mixColor(dark, tan, 0.45 + y * 0.6), belly, front * 0.75).map((c) => c + scale * 0.3);
  });
  torso.computeNormals();
  body.add(new Node(new Mesh(gl, torso), mat({ spec: 0.15 })));
  // brystfjær: lag med små, overlappende fjær-skjell over magen
  const chest = new Geo();
  for (let row = 0; row < 6; row++) {
    const y = 0.12 + row * 0.05, n = 7 - (row > 3 ? 2 : 0);
    for (let i = 0; i < n; i++) {
      const a = ((i + (row % 2) * 0.5) / n - 0.5) * 1.5;
      const rr = 0.2 - Math.abs(row - 2) * 0.012;
      chest.add(sphere(0.034, 8, 6).tf(Math.sin(a) * rr, y, Math.cos(a) * rr * 0.9 + 0.005, -0.5, a, 0, 1, 0.55, 0.45).color(mixColor(belly, hex('#f0d5a8'), (i + row) % 2 ? 0.2 : 0.7)));
    }
  }
  body.add(new Node(new Mesh(gl, chest), mat({ spec: 0.15 })));
  // badeshorts med hibiskus (lav ring rundt beina)
  const shorts = lathe([[0.155, -0.02], [0.2, 0.02], [0.215, 0.09], [0.21, 0.13]], 18).tf(0, 0, 0, 0, 0, 0, 1, 1, 0.92);
  shorts.colorFn((x, y, z) => {
    const a = Math.atan2(x, z);
    const flower = Math.sin(a * 5 + y * 40) * Math.sin(y * 55 + a * 2) > 0.55;
    return flower ? hex('#ff5e7a') : (y > 0.11 ? hex('#ffd84d') : hex('#14889a'));
  });
  shorts.computeNormals();
  body.add(new Node(new Mesh(gl, shorts), mat({ spec: 0.1 })));
  // blomsterkrans rundt halsen
  const lei = new Geo();
  const leiCols = ['#ff5e7a', '#ffd84d', '#ffffff', '#ff9f45'];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    lei.add(sphere(0.03, 7, 5, leiCols[i % 4]).tf(Math.sin(a) * 0.105, 0.52 - Math.cos(a) * 0.035 + (Math.cos(a) > 0 ? -0.025 : 0), Math.cos(a) * 0.1 + 0.025));
  }
  body.add(new Node(new Mesh(gl, lei), mat({ spec: 0.3 })));
  // halefjær: mørke, buede
  const tail = new Geo();
  for (let i = 0; i < 7; i++) {
    const a = (i - 3) * 0.22;
    tail.add(strand(Math.sin(a) * 0.05, 0.22 + i * 0.012, -0.15, Math.sin(a) * 0.5, 0.35, -0.85, 0.36 + (i % 3) * 0.05, 2.2, 0.03, 0.006, i % 2 ? '#2f3a2c' : '#1f2622'));
  }
  body.add(new Node(new Mesh(gl, tail), mat({ spec: 0.5 })));
  // vinger
  for (const s of [-1, 1]) {
    const wing = new Node();
    wing.pos = [s * 0.19, 0.38, 0];
    body.add(wing);
    const wg = sphere(0.1, 12, 8).tf(0, -0.13, -0.01, 0, 0, 0, 0.35, 1.35, 0.8);
    for (let f = 0; f < 4; f++) wg.add(strand(0, -0.2 - f * 0.012, 0.04 - f * 0.035, 0, -1, -0.15 - f * 0.12, 0.1 + f * 0.012, 0.4, 0.024, 0.005, f % 2 ? '#7a5233' : '#5e3f27'));
    wg.colorFn((x, y) => mixColor(dark, tan, clamp(0.6 + y * 2, 0, 1)));
    wing.add(new Node(new Mesh(gl, wg), mat({ spec: 0.15 })));
    parts[s < 0 ? 'wingR' : 'wingL'] = wing;
  }
  // grillpinne med en maiskolbe som han holder inn over bålet
  const stick = new Node();
  stick.pos = [0, -0.2, 0.02];
  parts.wingR.add(stick);
  const ang = 2.2, len = 1.6; // pinnen peker frem og ned mot bålet
  stick.add(new Node(new Mesh(gl, cylinder(0.008, 0.012, len, 6, '#7a5233').tf(0, len / 2, 0).tf(0, 0, 0, ang, 0, 0)), mat({ spec: 0.1 })));
  const cob = new Node();
  cob.pos = [0, (len - 0.08) * Math.cos(ang), (len - 0.08) * Math.sin(ang)];
  const cg = sphere(0.045, 10, 8).tf(0, 0, 0, 0, 0, 0, 0.85, 2.2, 0.85);
  cg.colorFn((x, y, z) => (Math.sin(y * 160) * Math.sin(Math.atan2(x, z) * 8) > 0 ? hex('#f6c13a') : hex('#e2a22a')));
  cob.add(new Node(new Mesh(gl, cg.tf(0, 0, 0, ang, 0, 0)), mat({ spec: 0.5 })));
  stick.add(cob);
  parts.stick = stick;
  parts.cob = cob;
  // nakke og hode
  const neck = new Node();
  neck.pos = [0, 0.56, 0.02];
  body.add(neck);
  parts.neck = neck;
  neck.add(new Node(new Mesh(gl, cylinder(0.05, 0.075, 0.2, 10, '#b88956')), mat()));
  const ruff = new Geo();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ruff.add(strand(Math.sin(a) * 0.06, 0.16, Math.cos(a) * 0.06, Math.sin(a) * 0.6, -1, Math.cos(a) * 0.6, 0.12, -0.6, 0.022, 0.004, i % 2 ? '#a77a4a' : '#c99a66', 5));
  }
  neck.add(new Node(new Mesh(gl, ruff), mat({ spec: 0.2, wind: 0.5 })));
  const head = new Node();
  head.pos = [0, 0.24, 0.02];
  neck.add(head);
  parts.head = head;
  const hg = sphere(0.12, 16, 12, '#c99a66').tf(0, 0.0, 0.0, 0, 0, 0, 0.95, 1.05, 1.05);
  head.add(new Node(new Mesh(gl, hg), mat()));
  // rød hud rundt øynene
  const face = new Geo();
  for (const s of [-1, 1]) face.add(sphere(0.062, 12, 8).tf(s * 0.052, 0.03, 0.085, 0, 0, 0, 1, 0.9, 0.7));
  head.add(new Node(new Mesh(gl, face), mat({ color: hex('#d6553f'), vcol: false, spec: 0.3 })));
  // øyne med tunge øyelokk (halvlukket, avslappet blikk)
  const eyes = new Geo();
  for (const s of [-1, 1]) eyes.add(sphere(0.042, 12, 8).tf(s * 0.055, 0.03, 0.115));
  head.add(new Node(new Mesh(gl, eyes), mat({ color: hex('#ffffff'), vcol: false, spec: 0.8 })));
  const pupils = new Geo();
  for (const s of [-1, 1]) pupils.add(sphere(0.016, 8, 6).tf(s * 0.052, 0.022, 0.155));
  head.add(new Node(new Mesh(gl, pupils), mat({ color: hex('#2f6f9a'), vcol: false, spec: 1.2 })));
  const shine = new Geo();
  for (const s of [-1, 1]) shine.add(sphere(0.006, 6, 4).tf(s * 0.047, 0.03, 0.169));
  head.add(new Node(new Mesh(gl, shine), mat({ color: hex('#ffffff'), vcol: false, spec: 2 })));
  // buskete fjærbryn over de tunge øyelokkene
  const brows = new Geo();
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) brows.add(strand(s * (0.03 + i * 0.016), 0.083 + i * 0.002, 0.125 - i * 0.008, s * 0.9, 0.35, 0.2, 0.04, 0.6, 0.009, 0.003, '#7a5233', 4));
  head.add(new Node(new Mesh(gl, brows), mat({ spec: 0.2 })));
  const lids = new Node();
  head.add(lids);
  parts.lids = lids;
  const lg = new Geo();
  for (const s of [-1, 1]) {
    const half = sphere(0.047, 12, 6);
    // behold bare øvre halvdel
    const keep = [];
    for (let k = 0; k < half.i.length; k += 3) {
      const a = half.i[k], b = half.i[k + 1], c = half.i[k + 2];
      if (half.p[a * 3 + 1] >= -0.001 && half.p[b * 3 + 1] >= -0.001 && half.p[c * 3 + 1] >= -0.001) keep.push(a, b, c);
    }
    half.i = keep;
    lg.add(half.tf(s * 0.055, 0.03, 0.115, 0.55, 0, 0));
  }
  lids.add(new Node(new Mesh(gl, lg), mat({ color: hex('#c9503b'), vcol: false, spec: 0.2, double: true })));
  // nebb (gult, litt åpent i et smil)
  const beak = new Geo();
  beak.add(lathe([[0.05, 0], [0.04, 0.05], [0.02, 0.1], [0, 0.13]], 10, '#f2c33c').tf(0, 0, 0, Math.PI / 2, 0, 0, 1.25, 1, 0.75).tf(0, -0.02, 0.1));
  beak.add(lathe([[0.038, 0], [0.025, 0.05], [0, 0.085]], 10, '#e0a52a').tf(0, 0, 0, Math.PI / 2 + 0.25, 0, 0, 1.15, 1, 0.55).tf(0, -0.06, 0.09));
  beak.add(sphere(0.008, 5, 4, '#9a6a1a').tf(0.018, 0.0, 0.17));
  beak.add(sphere(0.008, 5, 4, '#9a6a1a').tf(-0.018, 0.0, 0.17));
  beak.add(sphere(0.022, 8, 5, '#d8605a').tf(0, -0.045, 0.13, 0, 0, 0, 1, 0.4, 1));
  head.add(new Node(new Mesh(gl, beak), mat({ spec: 0.6 })));
  // kam med krøller og lange røde hakelapper
  const comb = new Geo();
  for (let i = 0; i < 4; i++) {
    const z = 0.06 - i * 0.05;
    comb.add(strand(0, 0.1, z, 0.08 * (i % 2 ? 1 : -1), 1, 0.25 - i * 0.12, 0.13 + i * 0.015, 3.6 + i * 0.4, 0.028, 0.014, '#e0362f'));
  }
  for (const s of [-1, 1]) comb.add(strand(s * 0.07, -0.04, 0.06, s * 0.25, -1, 0.05, 0.3, -0.6, 0.026, 0.012, '#d8342e', 9));
  comb.add(sphere(0.03, 8, 6, '#e0362f').tf(0, -0.12, 0.13, 0, 0, 0, 0.8, 1.4, 0.6));
  head.add(new Node(new Mesh(gl, comb), mat({ spec: 0.4 })));
  parts.lidsBase = 0;
  return { root, parts };
}

// ---------- Cody ----------
function buildCody(gl) {
  const root = new Node();
  const parts = {};
  const black = hex('#1d2026'), white = hex('#f4f6f8'), grey = hex('#3a3f48');
  const body = new Node();
  body.pos = [0, 0.04, 0];
  root.add(body);
  parts.body = body;
  const bg = lathe([[0, 0], [0.17, 0.02], [0.25, 0.12], [0.27, 0.3], [0.245, 0.48], [0.19, 0.62], [0.15, 0.7]], 20).tf(0, 0, 0, 0, 0, 0, 1, 1, 0.88);
  bg.colorFn((x, y, z) => {
    // hvit mage foran, svart rygg; kanten er litt ujevn som fjær. Små fjærskjell i magen
    const edge = 0.05 + Math.sin(y * 40) * 0.015 - smoothstep(0.45, 0.7, y) * 0.12;
    const scale = Math.sin(y * 90 + Math.sin(x * 60) * 1.5) * Math.sin(x * 70) > 0.6 ? 0.06 : 0;
    const belly = mixColor(white, hex('#dfe5ec'), scale * 8);
    const back = mixColor(black, hex('#2c323c'), Math.sin(y * 70 + x * 30) > 0.7 ? 0.6 : 0);
    return z > edge && y < 0.62 ? belly : z > edge - 0.03 && y < 0.62 ? grey : back;
  });
  bg.computeNormals();
  body.add(new Node(new Mesh(gl, bg), mat({ spec: 0.35 })));
  // badeshorts: oransje med hvite striper på siden
  const sh = lathe([[0.175, 0.0], [0.245, 0.06], [0.268, 0.14], [0.272, 0.2]], 20).tf(0, 0, 0, 0, 0, 0, 1.02, 1, 0.9);
  sh.colorFn((x, y, z) => (Math.abs(x) > 0.2 && Math.abs(x) < 0.235 && z < 0.05 ? hex('#ffffff') : y > 0.185 ? hex('#1d2026') : hex('#f2783a')));
  sh.computeNormals();
  body.add(new Node(new Mesh(gl, sh), mat({ spec: 0.12 })));
  // føtter
  // føttene er egne ledd, så han kan tromme takten
  for (const s of [-1, 1]) {
    const foot = new Node();
    foot.pos = [s * 0.1, 0.015, 0.04];
    const fg = sphere(0.07, 10, 6, '#a8673a').tf(0, 0, 0.08, 0, s * 0.3, 0, 1, 0.3, 1.5);
    for (let t = -1; t <= 1; t++) fg.add(sphere(0.022, 6, 4, '#8a5230').tf(t * 0.035 + s * 0.02, -0.005, 0.18));
    foot.add(new Node(new Mesh(gl, fg), mat({ spec: 0.3 })));
    root.add(foot);
    parts[s < 0 ? 'footR' : 'footL'] = foot;
  }
  // vinger/flippers
  for (const s of [-1, 1]) {
    const f = new Node();
    f.pos = [s * 0.235, 0.5, 0];
    body.add(f);
    const fg = sphere(0.09, 12, 8).tf(0, -0.17, 0, 0, 0, 0, 0.28, 1.9, 0.75);
    fg.colorFn((x) => (x * s < -0.005 ? white : black));
    f.add(new Node(new Mesh(gl, fg), mat({ spec: 0.35 })));
    parts[s < 0 ? 'finR' : 'finL'] = f;
  }
  // skjellkjede
  const neck = new Geo();
  const ring = [];
  for (let i = 0; i <= 16; i++) {
    const a = -Math.PI * 0.1 + (i / 16) * Math.PI * 1.2;
    ring.push([Math.cos(a) * 0.2, 0.6 - Math.sin(a) * 0.12 + (i === 8 ? -0.02 : 0), Math.sin(a) * 0.17 + 0.01]);
  }
  neck.add(tube(ring.map(([x, y, z]) => [x, y + 0.0, z]), 0.006, 4, '#4a5560'));
  const shell = lathe([[0, 0], [0.06, 0.004], [0.065, 0.012], [0, 0.02]], 14, '#c98d62').tf(0, 0, 0, Math.PI / 2, 0, 0, 1, 1, 1).tf(0, 0.44, 0.235);
  shell.colorFn((x, y) => (Math.floor(Math.atan2(y - 0.44, x) * 6) % 2 ? hex('#e6b48a') : hex('#b9774a')));
  neck.add(shell);
  body.add(new Node(new Mesh(gl, neck), mat({ spec: 0.6 })));
  // hode
  const head = new Node();
  head.pos = [0, 0.74, 0.02];
  body.add(head);
  parts.head = head;
  head.add(new Node(new Mesh(gl, sphere(0.155, 16, 12, '#1d2026').tf(0, 0.03, 0, 0, 0, 0, 1, 1.05, 1)), mat({ spec: 0.4 })));
  const eyes = new Geo();
  for (const s of [-1, 1]) eyes.add(sphere(0.035, 10, 8, '#fbfbfb').tf(s * 0.06, 0.06, 0.125));
  head.add(new Node(new Mesh(gl, eyes), mat({ spec: 0.9 })));
  const iris = new Geo();
  for (const s of [-1, 1]) iris.add(sphere(0.018, 8, 6, '#7a4a1c').tf(s * 0.058, 0.058, 0.152));
  for (const s of [-1, 1]) iris.add(sphere(0.008, 6, 4, '#0b0b0b').tf(s * 0.058, 0.058, 0.166));
  for (const s of [-1, 1]) iris.add(sphere(0.005, 5, 4, '#ffffff').tf(s * 0.053, 0.064, 0.17));
  head.add(new Node(new Mesh(gl, iris), mat({ spec: 1.2 })));
  // øyelokk (svarte), ett ledd per øye som roteres ned over øyet når han blunker
  parts.lids = [];
  for (const s of [-1, 1]) {
    const half = sphere(0.039, 10, 6, '#1d2026');
    const keep = [];
    for (let k = 0; k < half.i.length; k += 3) {
      const a = half.i[k], b = half.i[k + 1], c = half.i[k + 2];
      if (half.p[a * 3 + 1] >= -0.001 && half.p[b * 3 + 1] >= -0.001 && half.p[c * 3 + 1] >= -0.001) keep.push(a, b, c);
    }
    half.i = keep;
    const lid = new Node(new Mesh(gl, half), mat({ spec: 0.3, double: true }));
    lid.pos = [s * 0.06, 0.06, 0.125];
    lid.rot = [-0.7, 0, 0];
    head.add(lid);
    parts.lids.push(lid);
  }
  // hvite «ansiktsflekker» over øynene og et lite smil
  const face = new Geo();
  for (const s of [-1, 1]) face.add(sphere(0.03, 8, 6, '#f4f6f8').tf(s * 0.075, 0.105, 0.115, 0, 0, s * 0.5, 1.3, 0.45, 0.5));
  face.add(tube([[-0.04, -0.035, 0.14], [0, -0.05, 0.148], [0.04, -0.035, 0.14]], 0.006, 4, '#0b0b0b'));
  head.add(new Node(new Mesh(gl, face), mat({ spec: 0.3 })));
  const beak = lathe([[0.045, 0], [0.035, 0.04], [0.018, 0.08], [0, 0.1]], 10, '#f0a527').tf(0, 0, 0, Math.PI / 2 + 0.15, 0, 0, 1, 1, 0.7).tf(0, -0.0, 0.13);
  beak.colorFn((x, y, z) => mixColor(hex('#f6c13a'), hex('#e0781e'), smoothstep(0.13, 0.22, z)));
  head.add(new Node(new Mesh(gl, beak), mat({ spec: 0.8 })));
  // gule øyebryn-dusker som stritter ut
  const tufts = new Geo();
  for (const s of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 8 - 0.5) * 0.9;
      tufts.add(strand(s * 0.07, 0.11, 0.1, s * (0.75 + Math.cos(a) * 0.2), 0.25 + Math.sin(a) * 0.5, -0.15 + (i % 3) * 0.12, 0.17 + (i % 4) * 0.03, -0.7 - (i % 2) * 0.5, 0.008, 0.002, i % 2 ? '#f2d64b' : '#e4c23a', 5));
    }
  }
  const tuft = new Node(new Mesh(gl, tufts), mat({ spec: 0.4, wind: 1 }));
  head.add(tuft);
  return { root, parts };
}

// Chicken Joe sitt maisbrett (låses opp ved 2000 poeng)
export const CORN_BOARD = BOARDS.find((b) => b.id === 'mais');

export function buildNpcs(r) {
  const gl = r.gl;
  const root = new Node();
  const fy = (x, z) => groundHeight(x, z);
  const joe = buildJoe(gl);
  const cody = buildCody(gl);
  const npcs = [
    { id: 'joe', name: 'Chicken Joe', x: FIRE.x + 2.9, z: FIRE.z - 1.4, baseYaw: -1.25, ...joe, scale: 1.6, color: '#e0362f' },
    { id: 'cody', name: 'Cody', x: FIRE.x - 0.5, z: FIRE.z + 2.6, baseYaw: Math.PI, ...cody, scale: 1.25, color: '#e4c23a', seatY: 0.4 },
  ];
  for (const n of npcs) {
    n.y = fy(n.x, n.z) + (n.seatY || 0);
    n.root.set(n.x, n.y, n.z, 0, n.baseYaw, 0);
    n.root.scl = [n.scale, n.scale, n.scale];
    n.headYaw = 0;
    n.talking = 0;
    n.blink = 2;
    root.add(n.root);
  }
  // Joes brett står i sanden ved siden av ham
  const def = CORN_BOARD;
  const bx = FIRE.x + 3.75, bz = FIRE.z - 0.55;
  const board = new Node(new Mesh(gl, buildBoardGeo(def)), makeMaterial({ tex: r.texture(boardCanvas(def)), spec: 0.6, double: true }));
  board.add(new Node(new Mesh(gl, buildFinsGeo(def)), makeMaterial({ color: hex('#5f8f2a'), vcol: false, spec: 0.5 })));
  board.set(bx, fy(bx, bz) + def.L * 0.5 - 0.25, bz, -Math.PI / 2 + 0.14, -1.25, 0);
  root.add(board);

  const colliders = [
    { x: npcs[0].x, z: npcs[0].z, r: 0.45 },
    { x: bx, z: bz, r: 0.35 },
  ];

  function update(dt, t, player) {
    for (const n of npcs) {
      const dx = player.x - n.x, dz = player.z - n.z;
      const d = Math.hypot(dx, dz);
      // snu hodet mot spilleren når hen er i nærheten
      let want = 0;
      if (d < 9) {
        want = Math.atan2(dx, dz) - n.baseYaw;
        want = Math.atan2(Math.sin(want), Math.cos(want));
        want = clamp(want, -1.2, 1.2);
      } else want = Math.sin(t * 0.3 + n.x) * 0.4;
      n.headYaw = dampAngle(n.headYaw, want, 3, dt);
      n.talking = damp(n.talking, n.isTalking ? 1 : 0, 5, dt);
      const P = n.parts;
      n.blink -= dt;
      const blinking = n.blink < 0.12;
      if (n.blink < 0) n.blink = 2 + Math.random() * 3.5;
      if (n.id === 'joe') {
        // Joe vugger rolig i takt med en sang bare han hører, og steker mais over bålet
        const beat = Math.sin(t * 2.4);
        P.body.rot[2] = Math.sin(t * 1.2) * 0.05;
        P.body.rot[0] = Math.sin(t * 0.7) * 0.03 + Math.max(0, beat) * 0.02;
        P.neck.rot[1] = n.headYaw * 0.4;
        P.neck.rot[0] = Math.abs(beat) * 0.06 * (1 - n.talking); // nikker til takten
        P.head.rot[1] = n.headYaw * 0.6;
        P.head.rot[0] = Math.sin(t * 0.9) * 0.06 - n.talking * Math.abs(Math.sin(t * 9)) * 0.08;
        P.head.rot[2] = Math.sin(t * 1.2) * 0.06;
        // tommel opp med venstre vinge innimellom, og når han snakker
        const thumb = Math.max(n.talking, smoothstep(0.85, 0.95, Math.sin(t * 0.35)));
        P.wingL.rot[2] = 0.15 + thumb * 0.55 + Math.sin(t * 2) * 0.05;
        P.wingL.rot[0] = -thumb * 1.1;
        // høyre vinge holder grillpinnen: små løft og en sjekk av maisen nå og da
        const check = smoothstep(0.9, 0.98, Math.sin(t * 0.21 + 1.3));
        P.wingR.rot[2] = -0.25 - Math.sin(t * 1.3) * 0.03;
        P.wingR.rot[0] = -0.2 - check * 0.45 + Math.sin(t * 0.8) * 0.04;
        P.stick.rot[0] = -check * 0.2;
        P.cob.rot[1] += dt * 1.8; // snur maisen
        P.lids.rot[0] = blinking ? 0.45 : check * 0.2;
      } else {
        // Cody: pust, tromming med foten, varmer flipperne mot bålet og rister fjærene innimellom
        const breathe = Math.sin(t * 1.6) * 0.012;
        const shiver = smoothstep(0.93, 0.99, Math.sin(t * 0.17 + 2)) * Math.sin(t * 40) * 0.02;
        P.body.scl = [1 + breathe + shiver, 1 - breathe * 0.5, 1 + breathe + shiver];
        P.body.pos[1] = 0.04 + n.talking * Math.abs(Math.sin(t * 6)) * 0.03;
        P.head.rot[1] = n.headYaw;
        P.head.rot[2] = Math.sin(t * 0.8) * 0.05;
        P.head.rot[0] = -n.talking * Math.abs(Math.sin(t * 8)) * 0.1 + (d > 9 ? 0.12 : 0); // ser ned i bålet når du er langt unna
        const warm = smoothstep(0.6, 0.85, Math.sin(t * 0.13)) * (1 - n.talking);
        const flap = n.talking * Math.sin(t * 7) * 0.3;
        P.finL.rot[2] = 0.18 + Math.max(0, flap) + Math.sin(t * 1.2) * 0.04 + warm * 0.5;
        P.finR.rot[2] = -0.18 - Math.max(0, -flap) - Math.sin(t * 1.4) * 0.04 - warm * 0.5;
        P.finL.rot[0] = -warm * 0.9;
        P.finR.rot[0] = -warm * 0.9;
        P.footL.rot[0] = -Math.max(0, Math.sin(t * 4.8)) * 0.35 * (1 - warm);
        for (const l of P.lids) l.rot[0] = blinking ? 1.25 : -0.7;
      }
    }
  }
  return { root, npcs, colliders, update, board };
}

// Replikker. ctx: { score, gift (belønning denne figuren skal gi nå), next (neste belønning) }
// Figurene sier ulike ting ut fra hvor mange poeng du har.
export function dialogFor(id, ctx, visit) {
  const sc = Math.round(ctx.score);
  if (ctx.gift) {
    const L = ctx.gift.lines;
    return [...L.slice(0, -1), { give: ctx.gift.id, text: L[L.length - 1] }];
  }
  const next = ctx.next;
  const nextLine = next ? `Neste premie ved bålet får du ved ${next.score} poeng. Du har ${sc}.` : 'Du har fått alt vi har. Nå surfer du bare for moro skyld!';
  if (id === 'joe') {
    const tiers = [
      [0, [
        ['Heisann! Jeg er Chicken Joe. Fin dag for å surfe, eller hva?', 'Ser du brettet mitt? Laget det selv. Det ser ut som en maiskolbe. Mmm… mais.', `Skaff deg 2000 surfepoeng, så får du det. Triks gir masse poeng! Du har ${sc} nå.`],
        ['Jeg steker mais. Vil du ha? Nei? Mer til meg.', 'Ligger du stille på brettet ute, setter du deg opp og venter. Sånn gjør de proffe.', nextLine],
      ]],
      [800, [
        ['Hei igjen! Du begynner å se ut som en surfer.', 'Prøv å kjøre langs bølgen høyt oppe i veggen. Da får du fart gratis.', nextLine],
        ['Jeg prøvde en floater en gang.', 'Kjørte rett opp på leppa der den brakk. Så… landet jeg i maisen. Den var på stranden. Lang historie.', nextLine],
      ]],
      [2000, [
        ['Maisbrett-surferen! Hvordan føles det?', 'Bare flyt med bølgen. Ikke tenk så mye. Det gjør aldri jeg.', nextLine],
        ['Visste du at du kan holde Q for hang ten?', 'Gå helt ut på nesa. Tærne i vannet. Rolig, rolig…', nextLine],
      ]],
      [4000, [
        ['Blomster på hodet, poeng i lomma. Du har det bra, du.', 'Har du vært i tuben? Brems når leppa kommer. Bare… ikke for mye.', nextLine],
        ['Jeg tror bølgene liker deg.', 'De store kommer sist i settet. Og de største kommer når du minst venter det. Som mais.', nextLine],
      ]],
      [7000, [
        ['Gullsurferen! Folk snakker om deg. Vel, jeg snakker om deg.', 'Prøv en superman. Hold S i lufta. Men slipp før du lander, ok? Jeg sier det bare.', nextLine],
      ]],
      [10000, [
        ['Legenden er tilbake ved bålet!', 'Vil du ha mais? Legender får dobbelt så mye mais.', 'Ok, det er samme mengde mais. Men den er laget med kjærlighet.'],
      ]],
    ];
    let pool = tiers[0][1];
    for (const [min, lines] of tiers) if (sc >= min) pool = lines;
    return pool[visit % pool.length];
  }
  const tiers = [
    [0, [
      ['Hei! Jeg heter Cody. Jeg surfer her hver dag.', 'De største bølgene kommer ofte sist i settet. Vær klar ute ved revet!', nextLine],
      ['Ikke alle bølger deler seg i midten.', 'Noen peeler bare én vei. Se hvor leppa begynner å brekke, og kjør mot skulderen.', nextLine],
      ['Duck dive: trykk E akkurat når bølgen kommer.', 'Nesa først, så halen. Du kommer opp bak skummet. Men du må puste litt mellom hvert dykk!', nextLine],
    ]],
    [800, [
      ['Vil du ha poeng? Gjør triks!', 'Space for å hoppe fra toppen av bølgen. A/D spinner i lufta, og W griper brettet.', 'F gir en snap. Treffer du leppa akkurat der den brekker, blir det en re-entry. Den gir mer!'],
      ['Lander du skjevt etter et hopp, tar bølgen deg.', 'Spinn helt rundt, eller la være. Halvveis går ikke.', nextLine],
    ]],
    [2000, [
      ['Kommer du for langt ut på skulderen, mister du kraften.', 'Sving helt tilbake mot curlen. Det er en cutback, og dommerne elsker dem. Ikke at vi har dommere.', nextLine],
      ['Så du den store bølgen i sted? Den var minst fire meter.', 'På de store kan du komme inn i tuben. Midt i veggen, rett innenfor leppa.', nextLine],
    ]],
    [4000, [
      ['Du har blitt god. Seriøst.', 'Kombiner triksene på samme bølge. Hvert nytt triks gir mer combo.', nextLine],
      ['Jeg øver på floatere hver morgen.', 'Opp på leppa der den brekker, hold balansen, og pek nesa ned når du vil ned igjen.', nextLine],
    ]],
    [7000, [
      ['Du surfer som om du var født her i bukta.', 'Jeg har aldri sett noen ta så mange tuber. Bortsett fra meg. Kanskje.', nextLine],
    ]],
    [10000, [
      ['Legenden! Sett deg ved bålet litt.', 'Du har lært alt jeg kan. Nå er det du som må lære meg.', 'Hvordan gjør du den superman-greia?'],
    ]],
  ];
  let pool = tiers[0][1];
  for (const [min, lines] of tiers) if (sc >= min) pool = lines;
  return pool[visit % pool.length];
}
