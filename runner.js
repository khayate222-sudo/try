// A perspective camera moving forward. World depth decreases toward the viewer.
export class RunnerHunt {
  constructor(width, height, { prey = 'mouse', speed = 2, random = Math.random } = {}) {
    this.width = width;
    this.height = height;
    this.prey = prey;
    this.speed = speed;
    this.random = random;
    this.mode = 'runner';
    this.time = 0;
    this.distance = 0;
    this.catches = 0;
    this.score = 0;
    this.missed = 0;
    this.targets = [];
    this.ripples = [];
    this.nextSpawn = 0.8;
    this.spawn(9);
  }
  between(a, b) { return a + this.random() * (b - a); }
  spawn(z = 15) {
    if (this.targets.length >= 6) return;
    this.targets.push({ z, phase: this.between(0, Math.PI * 2), sway: this.between(1.1, 2), bias: this.between(-0.2, 0.2), lift: this.between(-0.2, 0.2) });
  }
  resize(width, height) { this.width = width; this.height = height; }
  project(target) {
    const depth = target.z + 0.6;
    const lateral = target.bias + Math.sin(this.time * target.sway + target.phase) * 0.55;
    const vertical = 0.35 + target.lift + Math.sin(this.time * target.sway * 1.3 + target.phase * 1.7) * 0.65;
    const scale = 2.6 / depth;
    return {
      x: this.width * (0.5 + lateral * 0.8 / depth),
      y: this.height * (0.36 + vertical * 0.65 / depth),
      scale,
      radius: Math.max(18, 27 * scale),
      angle: Math.sin(this.time * target.sway + target.phase) * 0.45 + Math.PI / 2,
    };
  }
  step(dt) {
    dt = Math.min(Math.max(dt, 0), 0.05);
    this.time += dt;
    const travel = [2.5, 3.8, 5.6][this.speed - 1] * dt;
    this.distance += travel;
    for (const target of this.targets) target.z -= travel;
    this.targets = this.targets.filter(target => {
      if (target.z < 0.9) { this.missed++; return false; }
      return true;
    });
    this.nextSpawn -= dt;
    if (this.nextSpawn <= 0) { this.spawn(); this.nextSpawn = this.between(0.7, 1.2); }
    this.ripples = this.ripples.map(r => ({ ...r, life: r.life - dt })).filter(r => r.life > 0);
  }
  tap(x, y) {
    // Test nearest first so a foreground target shields a target behind it.
    const target = [...this.targets].sort((a, b) => a.z - b.z).find(t => {
      const p = this.project(t);
      return t.z >= 0.9 && Math.hypot(x - p.x, y - p.y) <= p.radius;
    });
    let points = 0;
    if (target) {
      points = target.z > 7 ? 30 : target.z > 3 ? 20 : 10;
      this.targets.splice(this.targets.indexOf(target), 1);
      this.catches++;
      this.score += points;
    }
    this.ripples.push({ x, y, life: 0.7, hit: !!target, points });
    this.ripples = this.ripples.slice(-30);
    return !!target;
  }
}
