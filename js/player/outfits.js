// Antrekk, hodeplagg og solbriller i surfebutikken.
import { canvas, PRINTS, drawShorts } from '../textures.js';

export const OUTFITS = [
  { id: 'korall', name: 'Korall Rashguard', desc: 'Langermet rashguard i korall med solstripe. Klassisk og synlig i vannet.', print: 'rashCoral', sleeves: 'long', shorts: 'navy', legs: 'skin', hat: 'none', glasses: 'none' },
  { id: 'aloha', name: 'Aloha-skjorte', desc: 'Åpen tropisk skjorte med hibiskus og monstera. Strandsjef-energi.', print: 'aloha', sleeves: 'short', shorts: 'khaki', legs: 'skin', hat: 'straw', glasses: 'black' },
  { id: 'lagune', name: 'Lagune-våtdrakt', desc: 'Fulldrakt i grafitt og lagunegrønt. For lange økter i lineupen.', print: 'lagoonSuit', sleeves: 'long', shorts: 'suit', legs: 'suit', suitColor: '#1b2a33', hat: 'none', glasses: 'none' },
  { id: 'sol', name: 'Solnedgang', desc: 'Kortermet rash i solnedgangsfarger, blomstershorts og bøttehatt.', print: 'sunsetRash', sleeves: 'short', shorts: 'floral', legs: 'skin', hat: 'bucket', glasses: 'round' },
  { id: 'retro', name: 'Retro 70', desc: 'Stripete singlet og røde shorts. Rett fra et gammelt surfemagasin.', print: 'retroTank', sleeves: 'none', shorts: 'red', legs: 'skin', hat: 'visor', glasses: 'mirror' },
  { id: 'natt', name: 'Nattdykker', desc: 'Svart våtdrakt med neondetaljer og bakvendt caps.', print: 'nightSuit', sleeves: 'long', shorts: 'suit', legs: 'suit', suitColor: '#16181d', hat: 'capBack', glasses: 'sport' },
  { id: 'palme', name: 'Palme-tee', desc: 'Myk t-skjorte med palme i solnedgang og turkise shorts.', print: 'palmTee', sleeves: 'short', shorts: 'teal', legs: 'skin', hat: 'cap', glasses: 'none' },
  { id: 'balkveld', name: 'Bålkveld', desc: 'Langermet rash med glør og flammer. Fra Cody, for de som blir på stranden til sola går ned.', print: 'ember', sleeves: 'long', shorts: 'black', legs: 'skin', hat: 'none', glasses: 'none', unlock: 5000, giver: 'Cody' },
  { id: 'legende', name: 'Korallbuktas legende', desc: 'Gull og korall. Bare for de som har surfet bukta på ordentlig.', print: 'legend', sleeves: 'short', shorts: 'red', legs: 'skin', hat: 'lei', glasses: 'mirror', unlock: 10000, giver: 'Cody' },
];

export const HATS = [
  { id: 'none', name: 'Ingen', desc: 'Håret fritt i vinden.' },
  { id: 'cap', name: 'Korall-caps', desc: 'Solid caps med buet skygge.', color: '#ff6f59', brim: '#ffffff' },
  { id: 'capBack', name: 'Bakvendt caps', desc: 'Skyggen bak – for de som mener alvor.', color: '#1d3c5e', brim: '#7dff5a' },
  { id: 'bucket', name: 'Bøttehatt', desc: 'Myk bøttehatt i solgult.', color: '#f2c94c', brim: '#f2c94c', band: '#ff6f59' },
  { id: 'straw', name: 'Stråhatt', desc: 'Vid stråhatt med rødt bånd. Skygge deluxe.', color: '#e7c47e', brim: '#dcb46a', band: '#d8433a' },
  { id: 'visor', name: 'Solskjerm', desc: 'Hvit visor med turkis skygge.', color: '#ffffff', brim: '#13a7b5' },
  { id: 'lei', name: 'Blomsterkrans', desc: 'Chicken Joes egen blomsterkrans. Hibiskus og frangipani, lukter som sommer.', color: '#ff5e7a', brim: '#2f9a4a', unlock: 4000, giver: 'Chicken Joe' },
];

export const GLASSES = [
  { id: 'none', name: 'Ingen', desc: 'Myser mot sola.' },
  { id: 'black', name: 'Klassiske', desc: 'Svarte innfatninger, mørke glass.', frame: '#15171a', lens: '#20262e' },
  { id: 'mirror', name: 'Speil-blå', desc: 'Speilglass som fanger hele bukta.', frame: '#c0c6cc', lens: '#2f9bff', shine: true },
  { id: 'round', name: 'Runde rosa', desc: 'Runde glass med gullinnfatning.', frame: '#d9a83a', lens: '#ff86b0', round: true },
  { id: 'sport', name: 'Sport neon', desc: 'Neongrønn sportsbrille.', frame: '#7dff5a', lens: '#1e2a22', shine: true },
];

const texCache = new Map();
export function printCanvas(key) {
  if (texCache.has('p' + key)) return texCache.get('p' + key);
  const c = canvas(256, 256);
  PRINTS[key](c.getContext('2d'), 256, 256);
  texCache.set('p' + key, c);
  return c;
}
export function shortsCanvas(key) {
  if (texCache.has('s' + key)) return texCache.get('s' + key);
  const c = canvas(128, 128);
  drawShorts(c.getContext('2d'), 128, 128, key);
  texCache.set('s' + key, c);
  return c;
}

// Enkle ikoner til butikken
export function outfitIcon(o, size = 120) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fdf1dc';
  ctx.fillRect(0, 0, size, size);
  const pc = printCanvas(o.print);
  const s = size / 120;
  ctx.save();
  // overdel
  ctx.beginPath();
  ctx.moveTo(38 * s, 18 * s);
  ctx.lineTo(82 * s, 18 * s);
  ctx.lineTo(o.sleeves === 'none' ? 80 * s : 104 * s, o.sleeves === 'long' ? 70 * s : 40 * s);
  ctx.lineTo(o.sleeves === 'none' ? 80 * s : 92 * s, o.sleeves === 'long' ? 76 * s : 48 * s);
  ctx.lineTo(80 * s, 40 * s);
  ctx.lineTo(80 * s, 74 * s);
  ctx.lineTo(40 * s, 74 * s);
  ctx.lineTo(40 * s, 40 * s);
  ctx.lineTo(o.sleeves === 'none' ? 40 * s : 28 * s, o.sleeves === 'long' ? 76 * s : 48 * s);
  ctx.lineTo(o.sleeves === 'none' ? 40 * s : 16 * s, o.sleeves === 'long' ? 70 * s : 40 * s);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(pc, 0, 0, 256, 256, -30 * s, 0, 180 * s, 110 * s);
  ctx.restore();
  // shorts
  if (o.shorts === 'suit') ctx.fillStyle = o.suitColor;
  else ctx.fillStyle = ctx.createPattern(shortsCanvas(o.shorts), 'repeat');
  ctx.beginPath();
  ctx.moveTo(40 * s, 76 * s);
  ctx.lineTo(80 * s, 76 * s);
  ctx.lineTo(84 * s, o.legs === 'suit' ? 116 * s : 102 * s);
  ctx.lineTo(63 * s, o.legs === 'suit' ? 116 * s : 102 * s);
  ctx.lineTo(60 * s, 88 * s);
  ctx.lineTo(57 * s, o.legs === 'suit' ? 116 * s : 102 * s);
  ctx.lineTo(36 * s, o.legs === 'suit' ? 116 * s : 102 * s);
  ctx.closePath();
  ctx.fill();
  return c;
}

export function accessoryIcon(kind, item, size = 120) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e9f7f6';
  ctx.fillRect(0, 0, size, size);
  const s = size / 120;
  ctx.translate(60 * s, 66 * s);
  ctx.scale(s, s);
  if (item.id === 'none') {
    ctx.strokeStyle = '#9db7b9';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, -6, 26, 0, Math.PI * 2);
    ctx.moveTo(-18, 12);
    ctx.lineTo(18, -24);
    ctx.stroke();
    return c;
  }
  if (kind === 'hat' && item.id === 'lei') {
    // krans av blomster
    const cols = ['#ff5e7a', '#ffd84d', '#ffffff', '#ff9f45'];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.fillStyle = i % 3 === 0 ? item.brim : cols[i % cols.length];
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 34, Math.sin(a) * 12, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    return c;
  }
  if (kind === 'hat') {
    ctx.fillStyle = item.brim;
    if (item.id === 'straw') {
      ctx.beginPath(); ctx.ellipse(0, 8, 50, 14, 0, 0, Math.PI * 2); ctx.fill();
    } else if (item.id === 'bucket') {
      ctx.beginPath(); ctx.ellipse(0, 8, 38, 11, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.ellipse(item.id === 'capBack' ? -22 : 22, 8, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = item.color;
    if (item.id === 'visor') {
      ctx.fillRect(-26, -4, 52, 10);
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 6, 28, item.id === 'straw' ? 26 : 30, 0, Math.PI, 0);
      ctx.fill();
    }
    if (item.band) { ctx.fillStyle = item.band; ctx.fillRect(-27, -2, 54, 7); }
  } else {
    ctx.fillStyle = item.lens;
    ctx.strokeStyle = item.frame;
    ctx.lineWidth = 5;
    for (const x of [-20, 20]) {
      ctx.beginPath();
      if (item.round) ctx.arc(x, -6, 15, 0, Math.PI * 2);
      else ctx.roundRect(x - 17, -18, 34, 24, 7);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(-4, -10); ctx.lineTo(4, -10); ctx.stroke();
    if (item.shine) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(-30, -14, 8, 4);
      ctx.fillRect(10, -14, 8, 4);
    }
  }
  return c;
}
