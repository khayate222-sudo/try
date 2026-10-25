import { StringTail } from './string.js';
import { OrganicMotion, insectRadius } from './insects.js';

export class WallHunt {
  constructor(width, height, { prey = 'spider', speed = 2, size = 1, random = Math.random } = {}) {
    this.mode = 'wall'; this.width = width; this.height = height;
    this.prey = prey; this.speed = speed; this.size = size; this.random = random;
    this.time = 0; this.catches = 0; this.score = 0; this.missed = 0;
    this.targets = []; this.ripples = []; this.nextSpawn = 1;
    for (let i = 0; i < 3; i++) this.spawn(i === 0 ? .5 : .2 + .6 * random(), .5 + i * .16);
  }
  spawn(xRatio = .15 + .7 * this.random(), yRatio = .9) {
    if (this.targets.length >= 5) return;
    const target = { x: this.width * xRatio, y: this.height * yRatio, scale: .8 + this.random() * .3, motion: new OrganicMotion({ random: this.random, wall: true, prey: this.prey }) };
    if (this.prey === 'string') target.stringTail = new StringTail(target.x, target.y, this.size * target.scale);
    this.targets.push(target);
  }
  resize(width, height) {
    for (const t of this.targets) { t.x *= width / this.width; t.y *= height / this.height; }
    this.width = width; this.height = height; for (const t of this.targets) t.stringTail?.reset(t.x, t.y);
  }
  project(t) { return { x: t.x, y: t.y, angle: t.motion.angle, scale: t.scale, size: this.size, stride: t.motion.distance, stringTail: t.stringTail, radius: insectRadius(this.prey, this.size, t.scale) }; }
  step(dt) {
    dt = Math.min(Math.max(dt, 0), .05); this.time += dt;
    const margin = Math.min(25, this.width * .1);
    const bounds = { left: margin, right: this.width - margin, top: -50, bottom: this.height - Math.min(40, this.height * .12) };
    for (const t of this.targets) { t.motion.prey = this.prey; Object.assign(t, t.motion.step(dt, t, bounds, [65, 115, 185][this.speed - 1])); }
    if (this.prey === 'string') for (const t of this.targets) { t.stringTail ||= new StringTail(t.x, t.y, this.size * t.scale); t.stringTail.step(t.x, t.y, dt, this.size * t.scale); }
    this.targets = this.targets.filter(t => { if (t.y < -25) { this.missed++; return false; } return true; });
    this.nextSpawn -= dt;
    if (this.nextSpawn <= 0) { this.spawn(); this.nextSpawn = .8 + this.random() * .8; }
    this.ripples = this.ripples.map(r => ({ ...r, life: r.life - dt })).filter(r => r.life > 0);
  }
  tap(x, y) {
    const target = this.targets.filter(t => this.prey === 'string' && t.stringTail ? t.stringTail.hit(x, y) : Math.hypot(x - t.x, y - t.y) <= this.project(t).radius).sort((a, b) => Math.hypot(x - a.x, y - a.y) - Math.hypot(x - b.x, y - b.y))[0];
    const points = target ? (['ant', 'gnat'].includes(this.prey) ? 20 : 10) : 0;
    if (target) { this.targets.splice(this.targets.indexOf(target), 1); this.catches++; this.score += points; }
    else for (const t of this.targets) if (Math.hypot(x - t.x, y - t.y) < 100) t.motion.escape(t.x, t.y, x, y);
    this.ripples.push({ x, y, life: .7, hit: !!target, points }); this.ripples = this.ripples.slice(-30);
    return !!target;
  }
}

export function drawWallScene(c, hunt, { night, drawPrey }) {
  const w = hunt.width, h = hunt.height;
  const fill = c.createLinearGradient(0, 0, w, h);
  fill.addColorStop(0, night ? '#253743' : '#efece1'); fill.addColorStop(1, night ? '#172630' : '#d9d4c5');
  c.fillStyle = fill; c.fillRect(0, 0, w, h);
  // Quiet brick joints and plaster speckles keep tiny silhouettes readable.
  const rowHeight = Math.max(65, Math.min(w * .3, 110)), brickWidth = Math.max(100, w * .5);
  c.lineWidth = 1; c.strokeStyle = night ? '#81949c13' : '#7b75601a';
  for (let row = 0; row < h / rowHeight; row++) {
    const y = row * rowHeight, offset = row % 2 ? brickWidth / 2 : 0;
    c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
    for (let x = offset; x < w; x += brickWidth) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + rowHeight); c.stroke(); }
  }
  c.fillStyle = night ? '#ccd8d313' : '#625c4814';
  for (let i = 0; i < 140; i++) c.fillRect((i * 137.51 % 997) / 997 * w, (i * 263.73 % 991) / 991 * h, i % 3 ? 1 : 2, 1);
  for (const target of hunt.targets) {
    const p = hunt.project(target);
    c.save(); c.shadowColor = night ? '#00000055' : '#463b2940'; c.shadowBlur = 2; c.shadowOffsetX = 2; c.shadowOffsetY = 3;
    drawPrey(c, { ...p, prey: hunt.prey, time: hunt.time }); c.restore();
  }
}
