// Skjermelementer: kontroller, varsler, timing-bar, ride-statistikk og butikk.
import { OUTFITS, HATS, GLASSES, outfitIcon, accessoryIcon } from '../player/outfits.js';
import { BOARDS, boardIcon } from '../player/boards.js';

const $ = (id) => document.getElementById(id);
const kbd = (k) => `<kbd>${k}</kbd>`;

export class Hud {
  constructor() {
    this.el = $('hud');
    this.toastEl = $('toast');
    this.toastT = 0;
    this.controlsKey = '';
    this.timingEl = $('timing');
    this.lastTimingCls = '';
  }
  show() { this.el.classList.remove('hidden'); }
  toast(text, sub = '', kind = 'good', dur = 1.8) {
    this.toastEl.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
    this.toastEl.className = 'show ' + kind;
    this.toastT = dur;
  }
  update(dt) {
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toastEl.className = '';
    }
  }
  controls(mode, rows) {
    const key = mode + JSON.stringify(rows);
    if (key === this.controlsKey) return;
    this.controlsKey = key;
    $('controls').innerHTML = `<div class="row mode">${mode}</div>` + rows.map(([keys, label]) => `<div class="row">${keys.map(kbd).join('')} ${label}</div>`).join('');
  }
  interact(text, key = 'E') {
    const el = $('interact');
    if (!text) el.classList.add('hidden');
    else {
      el.classList.remove('hidden');
      if ($('interact-text').textContent !== text) $('interact-text').textContent = text;
      $('interact-key').classList.toggle('hidden', !key);
      if (key) $('interact-key').textContent = key;
    }
  }
  // tA: sekunder til hendelsen. ok/perfect: [fra, til] i sekunder
  timing(info) {
    const el = this.timingEl;
    if (!info) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    const [max, min] = info.range;
    const pos = (t) => Math.max(0, Math.min(100, ((max - t) / (max - min)) * 100));
    $('timing-label').textContent = info.label;
    $('timing-action').textContent = info.action;
    const ok = $('timing-ok'), pf = $('timing-perfect');
    ok.style.left = pos(info.ok[1]) + '%';
    ok.style.width = pos(info.ok[0]) - pos(info.ok[1]) + '%';
    pf.style.left = pos(info.perfect[1]) + '%';
    pf.style.width = pos(info.perfect[0]) - pos(info.perfect[1]) + '%';
    $('timing-marker').style.left = pos(info.t) + '%';
    const ready = info.t <= info.ok[1] && info.t >= info.ok[0];
    const cls = (info.cls || '') + (ready ? ' ready' : '');
    if (cls !== this.lastTimingCls) {
      el.className = cls;
      this.lastTimingCls = cls;
    }
  }
  ride(info) {
    const el = $('ride');
    if (!info) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    $('ride-kmh').textContent = Math.round(info.kmh);
    $('ride-time').textContent = info.time.toFixed(1) + ' s';
    $('ride-carves').textContent = info.carves;
    $('ride-tricks').textContent = info.tricks || 0;
    $('ride-hint').textContent = info.hint || '';
  }
  score(v) {
    const t = String(Math.round(v));
    if (this.lastScore !== t) {
      $('score-val').textContent = t;
      this.lastScore = t;
    }
  }
  // triks-feed: navnet på trikset og poengene spretter opp midt på skjermen
  trick(name, pts, mult) {
    const el = $('trick');
    el.innerHTML = `${name}<small>+${pts} poeng${mult > 1.01 ? ` · combo ×${mult.toFixed(2)}` : ''}</small>`;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }
  // dialogboks for figurene ved bålet
  dialog(info) {
    const el = $('dialog');
    if (!info) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    $('dialog-name').textContent = info.name;
    $('dialog-name').style.background = info.color || '';
    $('dialog-text').textContent = info.text;
    $('dialog-more').textContent = info.last ? 'Ferdig' : 'Fortsett';
  }
  // duck dive-cooldown: frac 0 = nettopp dykket, 1 = klar. Vises bare en kort stund
  duckCooldown(frac, show) {
    const el = $('duck-cd');
    if (!show) {
      if (!el.classList.contains('hidden')) el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    el.classList.toggle('ready', frac >= 1);
    const p = String(Math.round(frac * 50) / 50);
    if (this.lastCd !== p) {
      el.querySelector('.ring').style.setProperty('--p', p);
      this.lastCd = p;
    }
  }
  duckDenied() {
    const el = $('duck-cd');
    el.classList.remove('denied');
    void el.offsetWidth;
    el.classList.add('denied');
  }
  setIndicator(text) {
    const el = $('set-indicator');
    if (!text) el.classList.add('hidden');
    else {
      el.classList.remove('hidden');
      $('set-text').textContent = text;
    }
  }
  toggleHelp(force) {
    const el = $('help');
    const show = force !== undefined ? force : el.classList.contains('hidden');
    el.classList.toggle('hidden', !show);
    return show;
  }
}

export class ShopUI {
  constructor(onSelect, onClose, audio, isUnlocked = () => true) {
    this.isUnlocked = isUnlocked;
    this.onSelect = onSelect;
    this.onClose = onClose;
    this.audio = audio;
    this.el = $('shop');
    this.tab = 'outfit';
    this.state = null;
    this.icons = new Map();
    this.el.querySelectorAll('.shop-tabs button').forEach((b) => {
      b.addEventListener('click', () => {
        this.tab = b.dataset.tab;
        this.audio.click();
        this.render();
      });
    });
    $('shop-close').addEventListener('click', () => this.onClose());
  }
  get open() { return !this.el.classList.contains('hidden'); }
  show(state) {
    this.state = state;
    this.el.classList.remove('hidden');
    this.render();
  }
  hide() { this.el.classList.add('hidden'); }
  icon(kind, item) {
    const key = kind + item.id;
    if (!this.icons.has(key)) {
      let c;
      if (kind === 'outfit') c = outfitIcon(item);
      else if (kind === 'board') c = boardIcon(item);
      else c = accessoryIcon(kind, item);
      this.icons.set(key, c);
    }
    return this.icons.get(key);
  }
  render() {
    this.el.querySelectorAll('.shop-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === this.tab));
    const list = { outfit: OUTFITS, hat: HATS, glasses: GLASSES, board: BOARDS }[this.tab];
    const grid = $('shop-grid');
    grid.innerHTML = '';
    const cur = this.state[this.tab];
    for (const item of list) {
      const d = document.createElement('div');
      const locked = !this.isUnlocked(item);
      d.className = 'item' + (item.id === cur ? ' selected' : '') + (locked ? ' locked' : '');
      const c = this.icon(this.tab, item);
      const img = document.createElement('canvas');
      img.width = c.width;
      img.height = c.height;
      img.getContext('2d').drawImage(c, 0, 0);
      d.appendChild(img);
      const n = document.createElement('div');
      n.className = 'name';
      n.textContent = item.name;
      d.appendChild(n);
      if (locked) {
        const l = document.createElement('div');
        l.className = 'lock';
        l.textContent = `🔒 ${item.unlock} poeng`;
        d.appendChild(l);
      }
      d.addEventListener('click', () => {
        if (locked) {
          this.audio.bad();
          this.detail(item);
          return;
        }
        this.state[this.tab] = item.id;
        this.audio.click();
        this.onSelect(this.tab, item.id);
        this.render();
      });
      d.addEventListener('mouseenter', () => this.detail(item));
      grid.appendChild(d);
    }
    this.detail(list.find((x) => x.id === cur) || list[0]);
  }
  detail(item) {
    let html = `<h4>${item.name}</h4><div>${item.desc || ''}</div>`;
    if (!this.isUnlocked(item)) html += `<div class="lock-note">🔒 Lås opp med ${item.unlock} surfepoeng. ${item.giver || 'Chicken Joe'} gir deg den ved bålet.</div>`;
    if (item.stats) {
      const bar = (label, v) => `<div class="stat"><span>${label}</span><div class="bar"><i style="width:${Math.round(v * 100)}%"></i></div></div>`;
      html += bar('Padling', item.stats.paddle) + bar('Fart', item.stats.speed) + bar('Sving', item.stats.turn);
    }
    $('shop-detail').innerHTML = html;
  }
}
