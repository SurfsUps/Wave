// Justerbare parametere for surferens og brettets bevegelse.
// Alle frekvenser er i Hz (hvor raskt en fjær svinger), zeta er demping (1 = ingen overshoot,
// lavere = mer svikt/liv). Vinkler i radianer, avstander i meter, fart i m/s.
//
// Best å finjustere først:
//   control.turnResponse / control.maxYaw   – hvor raskt og hvor skarpt brettet svinger
//   control.minTurnRadius                   – hvor krapt man kan svinge i høy fart
//   board.leanGain / board.maxLean          – hvor mye brettet legger seg på railen
//   body.leanGain / body.hipShift           – hvor mye kroppen lener seg inn i svingen
//   board.followFreq / board.followZeta     – hvor stramt brettet følger vannflaten
//   body.stanceWidth / body.footToe         – fotplassering på brettet
//   balance.wipeoutThreshold                – hvor lett man faller av når balansen ryker
//
// Prøv forhåndsinnstillingene med ?feel=arcade eller ?feel=sim i adressefeltet.

export const TUNE = {
  control: {
    maxYaw: 1.35, // grunnleggende maks svingfart (rad/s) …
    maxYawStat: 0.95, // … pluss dette ganget med brettets turn-stat
    highSpeedYawFalloff: 0.22, // andel svingfart som forsvinner mot toppfart (stabilt i høy fart)
    turnResponse: 2.6, // hvor raskt svingfarten bygger seg opp (høyere = kvikkere, mer arcade)
    turnResponseStat: 2.2,
    minTurnRadius: [6.0, 3.2], // minste svingradius for treg (turn 0) og kvikk (turn 1) brett
    turnSpeedLoss: 0.08, // fartstap i skarpe svinger (∝ svingfart² · fart)
    lowSpeed: 2.5, // under dette er brettet tregt og vinglete å styre
    stableSpeed: 8, // over dette har man full kontroll
    lowSpeedControl: 0.55, // andel styring man har ved lav fart
    lowSpeedWobble: 0.35, // ufrivillig gir-vingling ved lav fart (rad/s)
    trimBoost: 0.9, // ekstra fart når man trimmer langs bølgen høyt i veggen
    stallDrag: 2.8, // brems (S): grunnbrems …
    stallFace: 2.2, // … pluss ekstra i bratt vegg, så man kan stalle inn i tuben
  },
  board: {
    rideHeight: 0.22, // brettets høyde over vannflaten når man står
    paddleHeight: 0.04, // … og når man ligger og padler
    sampleNose: 0.42, // hvor langt ut mot nese/hale vannet måles (andel av brettlengden)
    sampleRail: 0.24, // avstand til railene for sidehelning (m)
    followFreq: 3.0, // hvor stramt pitch/roll følger bølgens helning
    followZeta: 0.8,
    slopeFollow: 0.9, // andel av bølgehelningen brettet tar opp (pitch og roll)
    heaveFreq: 2.2, // vertikal fjær (bobbing, landinger)
    heaveZeta: 0.5,
    maxSink: 0.07, // hvor dypt nese/hale får synke ned i vannet før brettet løftes
    leanGain: 0.62, // rail-lean fra sideakselerasjon (atan(v·ω/g) · gain)
    maxLean: 0.72,
    leanFreqLow: 1.5, // lean-fjær ved lav fart (løs og vinglete) …
    leanFreqHigh: 3.4, // … og ved høy fart (stramt og stabilt)
    leanZetaLow: 0.42,
    leanZetaHigh: 0.85,
    yawLagFreq: 4.5, // brettets visuelle gir henger litt etter kursen
    yawLagZeta: 0.7,
    slipAngle: 0.07, // halen skrenser litt ut i harde svinger
    planingPitch: 0.05, // nesa løftes litt når brettet planer i fart
    pumpPitch: 0.05, // nese/hale-gynging når man pumper
    bob: 0.022, // rolig gynging i vannet (m)
    chatter: 0.006, // små vibrasjoner i høy fart (rad)
    paddleFollowFreq: 2.2, // padling: mykere følging av dønningene
    paddleFollowZeta: 0.6,
  },
  body: {
    stanceWidth: 0.34, // fotavstand som andel av brettlengden …
    stanceMin: 0.6, // … begrenset til dette intervallet (m)
    stanceMax: 0.8,
    stanceCenter: -0.06, // hvor på brettet surferen står (andel av lengden, negativ = mot halen)
    footToe: 0.02, // føttene litt mot tå-railen
    frontFootAngle: 0.28, // fremre fot vinklet mot nesa
    backFootAngle: 0.08,
    ankleHeight: 0.055,
    crouchBase: 0.22, // knebøy: grunnivå …
    crouchSpeed: 1 / 30, // … pluss per m/s fart
    crouchLean: 0.55, // … pluss i svinger
    crouchPump: 0.25,
    crouchChop: 0.6, // … pluss ved ujevn sjø (vertikal brettfart)
    crouchImbalance: 0.35,
    crouchFreq: 2.4, // knebøy-fjær: lav zeta gir fjærende landinger
    crouchZeta: 0.55,
    landingCompress: 0.1, // ekstra knebøy per m/s fallfart ved landing
    hipDrop: 0.3, // hvor mye hoftene senkes ved full knebøy
    leanGain: 0.85, // kroppslean i forhold til brettets lean
    maxLean: 0.75,
    leanFreq: 2.0, // kroppen henger litt etter brettet – gir liv
    leanZeta: 0.6,
    hipShift: 0.13, // hoftene flyttes inn i svingen (m)
    torsoTwist: 0.38, // skuldrene roterer i svingretningen
    headLookTurn: 0.18, // hodet ser inn i svingen
    headLevel: 0.6, // hodet holdes delvis vatter mot brettets helning
    armBalance: 0.9, // armene motvirker ubalanse
    armFreq: 1.7,
    armZeta: 0.45,
  },
  balance: {
    lowSpeedInstab: 0.45, // ustabilitet bare av lav fart
    hardTurnLowSpeed: 0.85, // skarp sving i lav fart
    steepFace: 0.25, // veldig bratt bølgevegg
    chop: 0.35, // ujevn sjø
    landingClean: 0.3, // støt ved ren landing (reverse gir mer)
    landingReverse: 0.55,
    rise: 3.5, // hvor raskt ubalanse bygger seg opp
    recover: 1.4, // hvor raskt den roer seg
    unbalanceThreshold: 0.55, // over dette vises ubalanse-posen
    wipeoutThreshold: 1.0, // over dette for lenge → wipeout
    wipeoutHold: 0.5, // sekunder over terskelen før man faller
  },
  states: {
    lowSpeed: 3.2, // under: «lav fart»
    carveG: 0.55, // sideakselerasjon (i g) for «carve»
    popupDur: 0.5, // hvor lang tid det tar å reise seg på brettet (press → hopp → land)
    weightFreq: 2.2, // hvor mykt tilstandene blandes
  },
  // Vektoverføring og forventning: kroppen gjør bevegelsen før brettet
  weight: {
    shift: 0.11, // hvor langt hoftene flyttes mot fremre/bakre fot (m)
    downFace: 0.7, // vekt frem når man kjører nedover bølgen
    turnBack: 0.8, // vekt bak i skarpe svinger (halen pivoterer)
    pump: 0.6, // vekt frem og tilbake i takt med pumpingen
    freq: 2.0, // fjær for vektoverføringen
    zeta: 0.7,
    leadFreq: 4.5, // skuldre/hode reagerer raskere på tastene enn brettet gjør …
    leadZeta: 0.8,
    leadTwist: 0.32, // … og roterer så mye inn i den kommende svingen
    leadHead: 0.35, // hodet ser enda lenger inn i svingen
  },
  // Padling og venting i lineupen
  paddle: {
    strokeRate: 6.2, // armtak per sekund (radianer/s i fasen, to armer per periode)
    surge: 0.65, // hvor mye fremdriften pulserer med hvert armtak (0 = jevn)
    buoyFreq: 1.1, // flytefjær: lav = tungt og flytende, høy = følger flaten stramt
    buoyZeta: 0.38,
    noseLift: 0.55, // nesa løftes når en liten bølge kommer under den
    lookAhead: 0.9, // hvor langt foran nesa vi måler stigende vann (m)
    sitAfter: 1.6, // sekunder uten input før surferen setter seg opp og venter
    sitTailSink: 0.22, // halen synker (nesa opp) når man sitter
  },
  // Duck dive
  duck: {
    cooldown: 1.75, // sekunder før du kan dykke igjen (teller fra du er oppe)
    pushDur: 0.28, // armene presser nesa ned
    sinkDur: 0.3, // kneet/foten presser halen ned, hele brettet går under
    depth: 1.25, // hvor dypt brettet går (m)
    noseDown: 0.62, // nesevinkel når man presser (rad)
    surfaceNoseUp: 0.38, // nesa peker opp når man kommer opp igjen
    glide: 1.4, // fremdrift under vann ved et godt dykk (m/s)
  },
  // Triks: grunnpoeng og krav. Poeng ganges med fart, høyde og combo
  tricks: {
    cutbackAngle: 2.0, // hvor mye (rad) man må snu tilbake mot curlen (~115°)
    cutbackTime: 2.4, // … innen så mange sekunder
    cutbackMinSpeed: 6,
    cutback: 140,
    snap: 110,
    reentry: 220, // snap rett i leppa der den brekker
    floaterMinSpeed: 5.5,
    floater: 160, // + per sekund på toppen
    floaterPerSec: 140,
    floaterMax: 2.2, // lengre enn dette på skummet → du faller
    tubeMinH: 1.5, // bølgen må være minst så høy (m) for tube
    tubeDepth: 3.4, // hvor langt inn bak leppa man kan være før den lukker seg
    tubePush: 2.4, // trykket i tuben som dytter deg ut igjen (m/s²)
    tube: 200, // + per sekund i tuben
    tubePerSec: 170,
    air: 90,
    airPerHalf: 110, // per 180°
    grab: 100,
  },
};

// Bølgesett: størrelser (H i meter) og hvor ofte de kommer.
// Juster vekt for å få flere/færre av hver type. bomb = siste bølge i et stort sett.
export const WAVE_TUNE = {
  sets: [
    { id: 'liten', name: 'Et lite sett', weight: 0.3, H: [1.0, 1.6], count: [3, 5] },
    { id: 'middels', name: 'Et sett', weight: 0.45, H: [1.8, 2.9], count: [3, 5] },
    { id: 'stor', name: 'Et stort sett', weight: 0.25, H: [3.0, 4.3], count: [3, 4] },
  ],
  bombChance: 0.4, // sjanse for at siste bølge i et middels/stort sett er en bomb
  bombH: [4.4, 5.6],
  smallBetween: [0.95, 1.4], // småbølge i pausene
  breakDepth: [-22, -11.5], // bryter ved z ≈ a + b·H (større bølger bryter lenger ute)
  peelVariation: 0.38, // hvor mye peelefarten varierer langs bølgen (seksjoner)
  closeMult: 1.9, // hvor mye raskere den lukker seg helt inne ved land
};

// Forhåndsinnstillinger. Arcade: kvikk og tilgivende. Sim: tyngre, mer momentum, lettere å falle.
export const PRESETS = {
  arcade: {
    control: { turnResponse: 4.2, turnResponseStat: 2.6, minTurnRadius: [3.8, 2.2], turnSpeedLoss: 0.05, lowSpeedControl: 0.85, lowSpeedWobble: 0.1, highSpeedYawFalloff: 0.1 },
    board: { leanGain: 0.7, leanFreqLow: 2.6, leanZetaLow: 0.7, slipAngle: 0.04 },
    balance: { wipeoutThreshold: 99, hardTurnLowSpeed: 0.4 },
  },
  sim: {
    control: { turnResponse: 1.9, turnResponseStat: 1.6, minTurnRadius: [7.5, 4.2], turnSpeedLoss: 0.11, lowSpeedControl: 0.4, lowSpeedWobble: 0.55, highSpeedYawFalloff: 0.3 },
    board: { leanFreqLow: 1.2, leanZetaLow: 0.35, slipAngle: 0.1, followFreq: 2.6 },
    body: { leanFreq: 1.6, leanZeta: 0.5 },
    balance: { wipeoutThreshold: 0.85, wipeoutHold: 0.35, hardTurnLowSpeed: 1.0, chop: 0.5 },
  },
};

export function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return false;
  for (const k of Object.keys(p)) Object.assign(TUNE[k], p[k]);
  return true;
}

try {
  const feel = new URLSearchParams(location.search).get('feel');
  if (feel) applyPreset(feel);
} catch (e) { /* ikke i nettleser */ }
