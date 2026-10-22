// Tastatur og mus.
export class Input {
  constructor(canvas) {
    this.down = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.dragging = false;
    this.lastMouse = -10;
    this.time = 0;
    window.addEventListener('keydown', (e) => {
      const k = this.key(e);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
      if (!this.down.has(k)) this.pressed.add(k);
      this.down.add(k);
    });
    window.addEventListener('keyup', (e) => this.down.delete(this.key(e)));
    window.addEventListener('blur', () => this.down.clear());
    canvas.addEventListener('mousedown', (e) => {
      this.dragging = true;
      e.preventDefault();
    });
    window.addEventListener('mouseup', () => (this.dragging = false));
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
      this.lastMouse = this.time;
    });
    canvas.addEventListener('wheel', (e) => {
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  key(e) {
    return e.code || e.key;
  }
  is(...codes) {
    return codes.some((c) => this.down.has(c));
  }
  hit(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }
  get fwd() { return (this.is('KeyW', 'ArrowUp') ? 1 : 0) - (this.is('KeyS', 'ArrowDown') ? 1 : 0); }
  get turn() { return (this.is('KeyA', 'ArrowLeft') ? 1 : 0) - (this.is('KeyD', 'ArrowRight') ? 1 : 0); }
  get run() { return this.is('ShiftLeft', 'ShiftRight'); }
  endFrame(dt) {
    this.time += dt;
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}
