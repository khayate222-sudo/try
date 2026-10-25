// Direct manipulation for screen mirroring: the phone and TV show the same
// playground. No camera, pairing server, or remote-device discovery is needed.
export class ManualHunt {
  constructor(width, height, { prey = 'mouse', size = 1, stage = 'flat' } = {}) {
    this.mode = stage === 'wall' ? 'wall' : 'flat';
    this.manual = true;
    this.width = width; this.height = height; this.prey = prey; this.size = size;
    this.x = width / 2; this.y = height / 2; this.u = .5; this.v = .5;
    this.angle = 0; this.scale = 1; this.stride = 0; this.time = 0;
    this.visible = true; this.catches = 0; this.score = 0; this.missed = 0;
    this.ripples = [];
  }
  point(u, v) {
    if (!Number.isFinite(u) || !Number.isFinite(v)) return;
    this.u = Math.max(0, Math.min(1, u)); this.v = Math.max(0, Math.min(1, v));
  }
  hide(hidden) { this.visible = !hidden; }
  tap(x, y) { this.point(x / this.width, y / this.height); return false; }
  resize(width, height) {
    this.x *= width / this.width; this.y *= height / this.height;
    this.width = width; this.height = height;
  }
  get targets() { return this.scale > .01 ? [this] : []; }
  project() { return { x: this.x, y: this.y, angle: this.angle, scale: this.scale, size: this.size, stride: this.stride }; }
  step(dt) {
    dt = Math.min(Math.max(dt, 0), .05); this.time += dt;
    const marginX = Math.min(25, this.width * .1), marginY = Math.min(75, this.height * .15);
    const targetX = Math.max(marginX, Math.min(this.width - marginX, this.u * this.width));
    const targetY = Math.max(marginY, Math.min(this.height - marginY, this.v * this.height));
    const dx = (targetX - this.x) * (1 - Math.exp(-28 * dt));
    const dy = (targetY - this.y) * (1 - Math.exp(-28 * dt));
    this.x += dx; this.y += dy;
    const travel = Math.hypot(dx, dy);
    this.stride += travel;
    if (travel > .05) {
      const heading = Math.atan2(dy, dx);
      this.angle += Math.atan2(Math.sin(heading - this.angle), Math.cos(heading - this.angle)) * (1 - Math.exp(-20 * dt));
    }
    this.scale += ((this.visible ? 1 : 0) - this.scale) * (1 - Math.exp(-18 * dt));
  }
}
