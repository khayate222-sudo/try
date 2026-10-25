export const isInsect = prey => ['bug', 'ant', 'gnat', 'spider'].includes(prey);
export const insectRadius = (prey, size = 1, scale = 1) => Math.max(18, ({ bug: 25, ant: 12, gnat: 10, spider: 26 }[prey] || 40) * size * scale);

export function insectPalette(night, contrast = true) {
  return contrast
    ? { body: night ? '#f4e5b3' : '#252b28', detail: night ? '#b8ad86' : '#515846', wing: night ? '#f5efd5aa' : '#4b625b77' }
    : { body: '#756047', detail: '#a58a64', wing: '#b2bca888' };
}

// Irregular short bursts, inspection pauses, and abrupt reorientation. Random
// decisions happen on timers, not per frame, so behavior is frame-rate stable.
export class OrganicMotion {
  constructor({ random = Math.random, wall = false, prey = 'bug' } = {}) {
    this.random = random; this.wall = wall; this.prey = prey;
    this.angle = wall ? -Math.PI / 2 : this.between(-Math.PI, Math.PI);
    this.heading = this.angle;
    this.phase = 'dart'; this.remaining = this.between(.18, .5);
    this.turnIn = this.between(.07, .2); this.pace = 1.2; this.distance = 0;
  }
  between(a, b) { return a + (b - a) * this.random(); }
  escape(x, y, fromX, fromY) {
    this.heading = Math.atan2(y - fromY, x - fromX);
    this.phase = 'dart'; this.pace = 1.9; this.remaining = .45; this.turnIn = .3;
  }
  step(dt, position, bounds, speed) {
    this.remaining -= dt; this.turnIn -= dt;
    if (this.remaining <= 0) {
      const n = this.random();
      this.phase = n < .28 ? 'freeze' : n < .55 ? 'probe' : 'dart';
      this.pace = this.phase === 'freeze' ? 0 : this.phase === 'probe' ? this.between(.12, .4) : this.between(.9, 1.8);
      this.remaining = this.phase === 'freeze' ? this.between(.07, .65) : this.between(.12, .7);
    }
    if (this.turnIn <= 0) {
      const bigTurn = this.random() < .2;
      if (this.wall) this.heading = -Math.PI / 2 + this.between(bigTurn ? -2.3 : -1.2, bigTurn ? 2.3 : 1.2);
      else this.heading += this.between(bigTurn ? -2.8 : -.8, bigTurn ? 2.8 : .8);
      this.turnIn = this.between(.045, this.prey === 'gnat' ? .17 : .32);
    }
    const turn = Math.atan2(Math.sin(this.heading - this.angle), Math.cos(this.heading - this.angle));
    this.angle += turn * (1 - Math.exp(-24 * dt));
    const step = speed * this.pace * dt;
    const rawX = position.x + Math.cos(this.angle) * step;
    const rawY = position.y + Math.sin(this.angle) * step;
    const x = Math.max(bounds.left, Math.min(bounds.right, rawX));
    const y = Math.max(bounds.top, Math.min(bounds.bottom, rawY));
    if (rawX !== x) { this.heading = Math.PI - this.heading; this.angle = Math.PI - this.angle; }
    if (rawY !== y) { this.heading = -this.heading; this.angle = -this.angle; }
    this.distance += Math.hypot(x - position.x, y - position.y);
    return { x, y, angle: this.angle };
  }
}

export function drawInsect(c, prey, { time = 0, stride = 0, night = false, contrast = true } = {}) {
  const palette = insectPalette(night, contrast);
  const oval = (x, y, rx, ry, color) => { c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); };
  const legs = prey === 'spider' ? 4 : 3;
  const small = prey === 'ant' || prey === 'gnat';
  const body = small ? 4 : prey === 'spider' ? 8 : 13;
  c.strokeStyle = palette.body; c.lineWidth = small ? .85 : 1.5; c.lineCap = 'round';
  for (const side of [-1, 1]) for (let i = 0; i < legs; i++) {
    const gait = Math.sin(stride * .12 + i * 2.5 + (side + 1) * 1.5);
    const attachX = (i - (legs - 1) / 2) * (small ? 2.5 : 4.2);
    const kneeX = attachX + (i - (legs - 1) / 2) * (small ? 2.5 : 5.5) + gait * (small ? 1.5 : 3);
    const kneeY = side * (body + (small ? 1 : 4));
    c.beginPath(); c.moveTo(attachX, side * body * .35); c.lineTo(kneeX, kneeY); c.lineTo(kneeX + gait * (small ? 2 : 5) - 2, side * (body + (small ? 4 : 10))); c.stroke();
  }
  if (prey === 'spider') {
    oval(-7, 0, 11, 8, palette.body); oval(6, 0, 6.5, 5, palette.body);
    oval(-9, -2, 5, 3, palette.detail);
    c.strokeStyle = palette.body; c.lineWidth = 1.3;
    for (const side of [-1, 1]) { c.beginPath(); c.moveTo(10, side * 2); c.lineTo(15, side * 4); c.lineTo(17, side * 2); c.stroke(); }
  } else if (prey === 'ant') {
    oval(-6, 0, 4.8, 3, palette.body); oval(0, 0, 2, 1.6, palette.body); oval(5, 0, 3, 2.4, palette.body);
  } else if (prey === 'gnat') {
    c.save(); c.translate(-1, 0); c.rotate(Math.sin(time * 91) * .35);
    oval(-2, -5, 6, 2.3, palette.wing); oval(-2, 5, 6, 2.3, palette.wing); c.restore();
    oval(-1, 0, 4, 1.8, palette.body); oval(4, 0, 2, 2, palette.body);
  } else {
    oval(13, 0, 7, 7, palette.body); oval(-2, 0, 16, 12, contrast ? palette.body : '#ae583e');
    c.strokeStyle = palette.detail; c.lineWidth = .8; c.beginPath(); c.moveTo(-17, 0); c.lineTo(11, 0); c.stroke();
    for (const x of [-8, 3]) for (const y of [-5, 5]) oval(x, y, 2, 2, contrast ? palette.detail : '#302e27');
  }
  if (prey !== 'spider') for (const side of [-1, 1]) {
    const twitch = Math.sin(time * 7 + side) * .7;
    c.strokeStyle = palette.body; c.lineWidth = small ? .65 : 1;
    const nose = small ? 6 : 18;
    c.beginPath(); c.moveTo(nose, side * 1.3); c.lineTo(nose + 3, side * 4); c.lineTo(nose + 6, side * (4 + twitch)); c.stroke();
  }
}
