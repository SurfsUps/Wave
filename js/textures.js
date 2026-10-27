// Prosedyretegnede teksturer (lerret) – mønstre for klær, brett, skilt og håndklær.

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function rnd(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export function hibiscus(ctx, x, y, r, petal = '#ff5e7a', center = '#ffd84d') {
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 5; i++) {
    ctx.rotate((Math.PI * 2) / 5);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.55, r * 0.42, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = petal;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = center;
  ctx.fill();
  ctx.restore();
}

export function leaf(ctx, x, y, len, ang, col = '#2f9a5a') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.35, -len * 0.35, len, 0);
  ctx.quadraticCurveTo(len * 0.35, len * 0.35, 0, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, len * 0.04);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len * 0.9, 0);
  ctx.stroke();
  ctx.restore();
}

// Klesmønstre (256x256, u rundt kroppen, front ved u≈0.25)
export const PRINTS = {
  rashCoral(ctx, w, h) {
    ctx.fillStyle = '#ff6f59';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, h * 0.3, w, h * 0.07);
    ctx.fillStyle = '#ffc845';
    ctx.fillRect(0, h * 0.4, w, h * 0.035);
    ctx.fillStyle = '#1d4f6e';
    ctx.fillRect(0, h * 0.86, w, h * 0.14);
  },
  aloha(ctx, w, h) {
    ctx.fillStyle = '#1f8fb0';
    ctx.fillRect(0, 0, w, h);
    const r = rnd(4);
    for (let i = 0; i < 26; i++) leaf(ctx, r() * w, r() * h, 26 + r() * 22, r() * 6.28, i % 2 ? '#2fb37a' : '#1d7d58');
    for (let i = 0; i < 14; i++) hibiscus(ctx, r() * w, r() * h, 14 + r() * 8, i % 3 ? '#ff6a83' : '#ffb04a', '#fff3a6');
    // åpen skjorte: hud og knappelist foran
    const fx = w * 0.25;
    ctx.fillStyle = '#c98e62';
    ctx.beginPath();
    ctx.moveTo(fx - 22, h);
    ctx.lineTo(fx + 22, h);
    ctx.lineTo(fx + 6, h * 0.45);
    ctx.lineTo(fx - 6, h * 0.45);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(fx - 2, 0, 4, h * 0.45);
  },
  lagoonSuit(ctx, w, h) {
    ctx.fillStyle = '#1b2a33';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#18b3a8';
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
    ctx.fillStyle = '#ffd84d';
    ctx.fillRect(0, h * 0.52, w, h * 0.035);
    ctx.fillStyle = '#18b3a8';
    ctx.fillRect(w * 0.6, 0, w * 0.12, h * 0.55);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('LAGUNE', w * 0.13, h * 0.75);
  },
  sunsetRash(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ff5fa2');
    g.addColorStop(0.55, '#ff9f45');
    g.addColorStop(1, '#ffd84d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(w * 0.25, h * 0.62, 34, Math.PI, 0);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#ff5fa2';
      ctx.fillRect(w * 0.25 - 36, h * 0.62 - 6 - i * 9, 72, 3);
    }
  },
  retroTank(ctx, w, h) {
    const cols = ['#f4e3c1', '#e8743b', '#9a4e2b', '#f1b33a', '#f4e3c1'];
    const sh = h / 10;
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(0, i * sh, w, sh);
    }
  },
  nightSuit(ctx, w, h) {
    ctx.fillStyle = '#16181d';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#7dff5a';
    ctx.fillRect(w * 0.08, 0, 6, h);
    ctx.fillRect(w * 0.42, 0, 6, h);
    ctx.fillRect(0, h * 0.7, w, 4);
    ctx.fillStyle = '#2d3038';
    ctx.fillRect(0, 0, w, h * 0.2);
  },
  ember(ctx, w, h) {
    ctx.fillStyle = '#1f2a33';
    ctx.fillRect(0, 0, w, h);
    const r = rnd(9);
    // flammer nedenfra og glør som flyr
    for (let i = 0; i < 9; i++) {
      const x = (i / 8) * w, fh = h * (0.25 + r() * 0.2);
      const g = ctx.createLinearGradient(0, h, 0, h - fh);
      g.addColorStop(0, '#ff6a2a');
      g.addColorStop(1, 'rgba(255,200,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 22, h);
      ctx.quadraticCurveTo(x - 6, h - fh * 0.5, x + (r() - 0.5) * 10, h - fh);
      ctx.quadraticCurveTo(x + 8, h - fh * 0.5, x + 22, h);
      ctx.fill();
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = i % 2 ? '#ffb347' : '#ff7b2a';
      ctx.fillRect(r() * w, r() * h * 0.75, 3, 3);
    }
  },
  legend(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#f2c94c');
    g.addColorStop(1, '#c98a1e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff6f59';
    ctx.fillRect(0, h * 0.34, w, h * 0.09);
    ctx.fillStyle = '#fff6d6';
    ctx.fillRect(0, h * 0.45, w, h * 0.025);
    // bølgemotiv
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 5;
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * (0.68 + k * 0.1) + Math.sin(x * 0.06) * 8);
      ctx.stroke();
    }
  },
  palmTee(ctx, w, h) {
    ctx.fillStyle = '#f7f1e3';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff7b54';
    ctx.beginPath();
    ctx.arc(w * 0.25, h * 0.55, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1d4f4e';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(w * 0.24, h * 0.88);
    ctx.quadraticCurveTo(w * 0.26, h * 0.6, w * 0.3, h * 0.45);
    ctx.stroke();
    for (let i = 0; i < 6; i++) leaf(ctx, w * 0.3, h * 0.45, 34, -Math.PI / 2 + (i - 2.5) * 0.55, '#1d4f4e');
  },
};

export const SHORTS = {
  navy: ['#1d3c5e', '#ffffff'],
  floral: ['#ffb04a', '#ff5e7a'],
  khaki: ['#c8a978', '#a5875a'],
  teal: ['#159a96', '#ffd84d'],
  black: ['#1c1d22', '#7dff5a'],
  red: ['#d8433a', '#ffffff'],
};
export function drawShorts(ctx, w, h, key) {
  const [a, b] = SHORTS[key] || SHORTS.navy;
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, w, h);
  if (key === 'floral') {
    const r = rnd(9);
    for (let i = 0; i < 18; i++) hibiscus(ctx, r() * w, r() * h, 9 + r() * 6, b, '#fff3a6');
  } else {
    ctx.fillStyle = b;
    ctx.fillRect(w * 0.0, 0, w * 0.04, h);
    ctx.fillRect(w * 0.5, 0, w * 0.04, h);
    ctx.fillRect(0, h * 0.04, w, h * 0.03);
  }
}

// Brett-mønster: lerret der toppen = nesa
// Maiskolbe: gule korn i rader, grønne blader som pakker seg rundt kantene
function drawCorn(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#3f6e1f');
  g.addColorStop(0.5, '#6f9e2e');
  g.addColorStop(1, '#3f6e1f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = rnd(77);
  // kornene
  const cols = 7, kw = (w * 0.72) / cols, kh = kw * 0.82;
  for (let y = h * 0.08; y < h * 0.9; y += kh) {
    const t = (y - h * 0.08) / (h * 0.82);
    const span = Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.04));
    for (let i = 0; i < cols; i++) {
      const cx = w * 0.5 + (i - (cols - 1) / 2) * kw * span;
      const tone = 0.85 + r() * 0.3;
      ctx.fillStyle = `rgb(${Math.round(242 * tone)},${Math.round(190 * tone)},${Math.round(48 * tone)})`;
      ctx.strokeStyle = 'rgba(170,110,20,0.65)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx - kw * span * 0.45, y + 1, kw * span * 0.9, kh - 2, 4);
      else ctx.rect(cx - kw * span * 0.45, y + 1, kw * span * 0.9, kh - 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,245,180,0.45)';
      ctx.fillRect(cx - kw * span * 0.25, y + 3, kw * span * 0.25, kh * 0.3);
    }
  }
  // blader som bretter seg inn fra kantene og dekker toppen
  ctx.fillStyle = 'rgba(78,128,34,0.92)';
  for (const side of [0, 1]) {
    ctx.beginPath();
    const x0 = side ? w : 0, dir = side ? -1 : 1;
    ctx.moveTo(x0, 0);
    ctx.lineTo(x0, h);
    ctx.bezierCurveTo(x0 + dir * w * 0.12, h * 0.75, x0 + dir * w * 0.26, h * 0.45, x0 + dir * w * 0.2, h * 0.12);
    ctx.lineTo(x0 + dir * w * 0.5, 0);
    ctx.closePath();
    ctx.fill();
  }
  const top = ctx.createLinearGradient(0, h, 0, h * 0.62);
  top.addColorStop(0, 'rgba(70,120,30,0.95)');
  top.addColorStop(1, 'rgba(70,120,30,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.strokeStyle = 'rgba(40,70,15,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    const x = w * (0.08 + i * 0.17);
    ctx.moveTo(x, h);
    ctx.quadraticCurveTo(x + (i - 2.5) * 4, h * 0.8, w * 0.5 + (i - 2.5) * 6, h * 0.58);
    ctx.stroke();
  }
}

export function drawBoardTop(ctx, w, h, def) {
  ctx.save();
  const p = def.paint;
  if (p.gradient) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    p.gradient.forEach((c, i) => g.addColorStop(i / (p.gradient.length - 1), c));
    ctx.fillStyle = g;
  } else ctx.fillStyle = p.base;
  ctx.fillRect(0, 0, w, h);
  if (p.corn) drawCorn(ctx, w, h);
  if (p.wood) {
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = i % 3 ? 'rgba(90,50,20,0.18)' : 'rgba(255,230,190,0.15)';
      ctx.lineWidth = 1 + (i % 4);
      ctx.beginPath();
      const x = (i / 40) * w;
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 6, h * 0.3, x - 6, h * 0.6, x + 3, h);
      ctx.stroke();
    }
  }
  if (p.stripes) {
    p.stripes.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, h * (0.62 + i * 0.045), w, h * 0.028);
    });
  }
  if (p.rails) {
    ctx.fillStyle = p.rails;
    ctx.fillRect(0, 0, w * 0.1, h);
    ctx.fillRect(w * 0.9, 0, w * 0.1, h);
  }
  if (p.bolt) {
    ctx.fillStyle = p.bolt;
    ctx.beginPath();
    ctx.moveTo(w * 0.62, h * 0.18);
    ctx.lineTo(w * 0.32, h * 0.52);
    ctx.lineTo(w * 0.52, h * 0.52);
    ctx.lineTo(w * 0.36, h * 0.84);
    ctx.lineTo(w * 0.7, h * 0.44);
    ctx.lineTo(w * 0.5, h * 0.44);
    ctx.closePath();
    ctx.fill();
  }
  if (p.flowers) {
    const r = rnd(21);
    for (let i = 0; i < 9; i++) hibiscus(ctx, w * (0.2 + r() * 0.6), h * (0.1 + r() * 0.8), 14 + r() * 8, p.flowers, '#fff3a6');
  }
  if (p.scales) {
    ctx.fillStyle = p.scales;
    for (let y = 0; y < h; y += 18) for (let x = (y / 18) % 2 ? 9 : 0; x < w; x += 18) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (p.palm) {
    ctx.fillStyle = p.palm;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.42, w * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a1f4a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w * 0.45, h * 0.62);
    ctx.quadraticCurveTo(w * 0.5, h * 0.48, w * 0.58, h * 0.38);
    ctx.stroke();
    for (let i = 0; i < 6; i++) leaf(ctx, w * 0.58, h * 0.38, 30, -Math.PI / 2 + (i - 2.5) * 0.6, '#3a1f4a');
  }
  if (p.stringer) {
    ctx.fillStyle = p.stringer;
    ctx.fillRect(w * 0.5 - 1.5, 0, 3, h);
  }
  if (p.logo) {
    ctx.fillStyle = p.logo;
    ctx.font = `bold ${Math.round(w * 0.16)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(w * 0.5, h * 0.26);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('KORALL', 0, w * 0.05);
    ctx.restore();
  }
  ctx.restore();
}

export function signTexture(lines, opt = {}) {
  const w = opt.w || 512, h = opt.h || 256;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = opt.bg || '#f2d29b';
  ctx.fillRect(0, 0, w, h);
  if (opt.wood !== false) {
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(120,70,30,0.10)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, (i * h) / 9, w, h / 9);
      ctx.fillStyle = 'rgba(80,40,10,0.25)';
      ctx.fillRect(0, (i * h) / 9, w, 2);
    }
  }
  if (opt.border) {
    ctx.strokeStyle = opt.border;
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, w - 20, h - 20);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const total = lines.length;
  lines.forEach((l, i) => {
    ctx.fillStyle = l.color || opt.fg || '#2a5d6e';
    ctx.font = `${l.weight || 900} ${l.size || 64}px "Baloo 2", "Arial Rounded MT Bold", sans-serif`;
    const y = h / 2 + (i - (total - 1) / 2) * (l.gap || opt.gap || 72);
    if (l.shadow !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillText(l.text, w / 2 + 3, y + 4);
      ctx.fillStyle = l.color || opt.fg || '#2a5d6e';
    }
    ctx.fillText(l.text, w / 2, y);
  });
  return c;
}

export function towelTexture(kind) {
  const c = canvas(128, 256);
  const ctx = c.getContext('2d');
  const sets = {
    a: ['#ff6f59', '#fff3e0', '#1fa3b5'],
    b: ['#ffd84d', '#2fb37a', '#ffffff'],
    c: ['#7b5cff', '#ff9f45', '#fff3e0'],
    d: ['#16a3c4', '#ffffff', '#ff5e7a'],
  };
  const cols = sets[kind] || sets.a;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(0, i * 16, 128, 16);
  }
  if (kind === 'b') {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(64, 128, 30, 0, Math.PI * 2);
    ctx.fill();
  }
  if (kind === 'd') hibiscus(ctx, 64, 128, 34, '#ff5e7a', '#ffd84d');
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let x = 0; x < 128; x += 6) {
    ctx.fillRect(x, 0, 3, 6);
    ctx.fillRect(x, 250, 3, 6);
  }
  return c;
}
