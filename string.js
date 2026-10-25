// A light cord with a fixed leading end and a free, fluttering tail.
export class StringTail {
  constructor(x, y, size = 1) { this.size = size; this.time = 0; this.reset(x, y); }
  reset(x, y) {
    this.points = [{ x, y, px: x, py: y }];
    for (let i = 1; i <= 14; i++) {
      const previous = this.points[i - 1], angle = Math.sin(i * .65) * .5;
      const p = { x: previous.x - Math.cos(angle) * 7.5 * this.size, y: previous.y + Math.sin(angle) * 7.5 * this.size };
      this.points.push({ ...p, px: p.x, py: p.y });
    }
  }
  step(x, y, dt, size = this.size) {
    dt = Math.min(Math.max(dt, 0), .05);
    this.size = size;
    if (!dt) return;
    if (Math.hypot(x - this.points[0].x, y - this.points[0].y) > 270 * size) this.reset(x, y);
    const count = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / count;
    const fromX = this.points[0].x, fromY = this.points[0].y;
    for (let n = 0; n < count; n++) {
      this.time += h;
      const head = this.points[0]; head.x = fromX + (x - fromX) * (n + 1) / count; head.y = fromY + (y - fromY) * (n + 1) / count;
      for (let i = 1; i < this.points.length; i++) {
        const p = this.points[i], oldX = p.x, oldY = p.y, damping = Math.exp(-2.5 * h);
        const flutter = Math.sin(this.time * 6 - i * .65) * i / 14;
        p.x += (p.x - p.px) * damping + Math.sin(this.time * 3.7 + i * .35) * 90 * size * h * h;
        p.y += (p.y - p.py) * damping + (22 + flutter * 190) * size * h * h;
        p.px = oldX; p.py = oldY;
      }
      for (let iteration = 0; iteration < 10; iteration++) for (let i = 1; i < this.points.length; i++) {
        const a = this.points[i - 1], b = this.points[i], dx = b.x - a.x, dy = b.y - a.y;
        const distance = Math.hypot(dx, dy) || 1;
        const correction = (distance - 7.5 * size) / distance;
        if (i === 1) { b.x -= dx * correction; b.y -= dy * correction; }
        else { a.x += dx * correction * .5; a.y += dy * correction * .5; b.x -= dx * correction * .5; b.y -= dy * correction * .5; }
      }
    }
  }
  hit(x, y, radius = 14) {
    return this.points.slice(1).some((b, i) => {
      const a = this.points[i], dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(x - a.x - t * dx, y - a.y - t * dy) <= radius;
    });
  }
}

export function drawString(c, hunt, { night = false } = {}) {
  const scale = hunt.stringTail?.size ?? hunt.size ?? 1;
  const points = hunt.stringTail?.points.map(p => ({ x: p.x - hunt.x, y: p.y - hunt.y }))
    || Array.from({ length: 15 }, (_, i) => ({ x: -i * 5.8 * scale, y: Math.sin(i * .65 - hunt.time * 5) * (4 + i * .65) * scale }));
  const path = () => {
    c.beginPath(); c.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) c.quadraticCurveTo(points[i].x, points[i].y, (points[i].x + points[i + 1].x) / 2, (points[i].y + points[i + 1].y) / 2);
    c.lineTo(points.at(-1).x, points.at(-1).y);
  };
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.globalAlpha *= hunt.thumbnail ? 1 : (hunt.stringOpacity ?? Math.min(1, hunt.scale));
  c.strokeStyle = night ? '#e2b878' : '#9b4e3c'; c.lineWidth = 4.5 * scale; path(); c.stroke();
  c.strokeStyle = night ? '#ffe6ad' : '#de9b78'; c.lineWidth = 1.3 * scale; path(); c.stroke();
  // A tiny loose end makes the silhouette read as a cord, rather than a worm.
  const end = points.at(-1); c.lineWidth = .7 * scale;
  for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(end.x, end.y); c.lineTo(end.x - 4 * scale, end.y + i * 3 * scale); c.stroke(); }
}
