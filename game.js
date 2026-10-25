export class Hunt {
  constructor(width, height, { prey = 'mouse', speed = 2, random = Math.random } = {}) {
    this.random = random;
    this.prey = prey;
    this.speed = speed;
    this.width = width;
    this.height = height;
    this.x = width / 2;
    this.y = height / 2;
    this.angle = 0;
    this.time = 0;
    this.catches = 0;
    this.phase = 'moving';
    this.remaining = 2;
    this.scale = 1;
    this.ripples = [];
    this.pickTarget();
  }
  between(min, max) { return min + this.random() * (max - min); }
  bounds() { return { x: Math.min(48, this.width / 4), y: Math.min(90, this.height / 4) }; }
  pickTarget() {
    const b = this.bounds();
    this.targetX = this.between(b.x, this.width - b.x);
    this.targetY = this.between(b.y, this.height - b.y);
  }
  resize(width, height) {
    this.x *= width / this.width;
    this.y *= height / this.height;
    this.width = width;
    this.height = height;
    this.pickTarget();
  }
  step(dt) {
    dt = Math.min(Math.max(dt, 0), 0.05);
    this.time += dt;
    this.remaining -= dt;
    if (this.remaining <= 0) {
      if (this.phase === 'caught' || this.phase === 'hidden') {
        this.phase = 'moving';
        this.pickTarget();
        this.x = this.targetX;
        this.y = this.targetY;
        this.pickTarget();
        this.remaining = this.between(1.4, 3.5);
      } else {
        const n = this.random();
        this.phase = n < 0.23 ? 'hidden' : n < 0.49 ? 'waiting' : 'moving';
        this.remaining = this.phase === 'hidden' ? this.between(0.8, 2.2) : this.between(0.5, 2.8);
        this.pickTarget();
      }
    }
    if (this.phase === 'moving') {
      const dx = this.targetX - this.x, dy = this.targetY - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 10) this.pickTarget();
      else {
        const base = this.prey === 'feather' ? 60 : this.prey === 'bug' ? 80 : 115;
        const pace = base * (0.55 + this.speed * 0.3) * (0.75 + Math.sin(this.time * 3) * 0.25);
        const step = Math.min(dist, pace * dt);
        this.x += dx / dist * step;
        this.y += dy / dist * step;
        const heading = Math.atan2(dy, dx);
        this.angle += Math.atan2(Math.sin(heading - this.angle), Math.cos(heading - this.angle)) * Math.min(1, dt * 9);
      }
    }
    const visible = this.phase === 'hidden' || this.phase === 'caught' ? 0 : 1;
    this.scale += (visible - this.scale) * Math.min(1, dt * 9);
    this.ripples = this.ripples.map(r => ({ ...r, life: r.life - dt })).filter(r => r.life > 0);
  }
  tap(x, y) {
    const hit = this.phase !== 'hidden' && this.phase !== 'caught' && this.scale > 0.5 && Math.hypot(x - this.x, y - this.y) < 45;
    this.ripples.push({ x, y, life: 0.7, hit });
    if (hit) {
      this.catches++;
      this.phase = 'caught';
      this.remaining = this.between(0.7, 1.3);
    } else if (this.phase === 'waiting' || this.phase === 'moving') {
      this.phase = 'moving';
      this.remaining = 1.5;
      this.pickTarget();
    }
    return hit;
  }
}
