// Original lightweight perspective scenery: no WebGL or downloaded assets.
export function drawRunnerScene(c, hunt, { night, drawPrey }) {
  const w = hunt.width, h = hunt.height;
  const horizon = h * 0.36;
  const sway = Math.sin(hunt.time * 0.7) * w * 0.012;
  const center = w / 2 + sway;
  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, night ? '#152c43' : '#a7d3d6');
  sky.addColorStop(0.38, night ? '#516b79' : '#f0ecc9');
  sky.addColorStop(1, night ? '#182f37' : '#88a875');
  c.fillStyle = sky; c.fillRect(0, 0, w, h);
  c.fillStyle = night ? '#eee5b6' : '#fff3bc';
  c.beginPath(); c.arc(w * 0.77, h * 0.15, Math.min(w * 0.065, h * 0.045), 0, Math.PI * 2); c.fill();
  if (night) {
    c.fillStyle = '#ccdccc';
    for (let i = 0; i < 20; i++) { const x = (i * 137.5 % w); const y = (i * 53.7 % (h * 0.27)); c.globalAlpha = 0.4 + i % 3 * 0.2; c.fillRect(x, y, 1.6, 1.6); }
    c.globalAlpha = 1;
  } else {
    c.fillStyle = '#fffdf24a';
    for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(w * (0.15 + i * 0.34) - sway, h * (0.14 + i % 2 * 0.06), w * 0.11, h * 0.013, 0, 0, Math.PI * 2); c.fill(); }
  }
  for (let layer = 0; layer < 3; layer++) {
    c.fillStyle = night ? ['#546f70', '#3f605d', '#335448'][layer] : ['#a9bd9b', '#8daa80', '#76996b'][layer];
    c.beginPath(); c.moveTo(0, horizon + 30);
    for (let i = 0; i <= 20; i++) {
      const x = w * i / 20;
      const y = horizon - h * (0.025 + 0.014 * layer) * (Math.sin(i * 0.45 + layer * 2) + 1) + layer * h * 0.008;
      c.lineTo(x, y);
    }
    c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fill();
  }
  // Rows flow out from a vanishing point as the viewer travels forward.
  const project = (x, z) => ({ x: center + x * w * 0.8 / (z + 0.6), y: horizon + h * 1.1 / (z + 0.6) });
  const ground = night ? ['#35554a', '#3b5c4e'] : ['#a2b980', '#aec38c'];
  for (let row = 24; row >= 0; row--) {
    const z = (row - (hunt.distance % 1));
    const far = Math.max(0, z + 1), near = Math.max(0, z);
    const y1 = project(0, far).y, y2 = Math.min(h, project(0, near).y);
    if (y1 > h) continue;
    c.fillStyle = ground[(row + Math.floor(hunt.distance)) % 2];
    c.fillRect(0, y1, w, Math.max(0, y2 - y1 + 1));
  }
  const roadLeftFar = project(-0.48, 30), roadRightFar = project(0.48, 30);
  c.fillStyle = night ? '#748372' : '#e0d5a6';
  c.beginPath(); c.moveTo(roadLeftFar.x, horizon); c.lineTo(roadRightFar.x, horizon); c.lineTo(w * 1.25, h); c.lineTo(-w * 0.25, h); c.closePath(); c.fill();
  // Subtle bands on the trail make forward motion visible even between prey.
  for (let row = 24; row >= 0; row--) {
    const z = row - hunt.distance % 1;
    if (z < 0) continue;
    const p = project(0, z), q = project(0, z + 0.16);
    if (p.y > h) continue;
    const half = (p.y - horizon) / (h - horizon) * w * 0.75;
    const halfFar = (q.y - horizon) / (h - horizon) * w * 0.75;
    c.fillStyle = night ? '#61776655' : '#c4bd8b55';
    c.beginPath(); c.moveTo(center - half, p.y); c.lineTo(center + half, p.y); c.lineTo(center + halfFar, q.y); c.lineTo(center - halfFar, q.y); c.fill();
  }
  // Occlusion order is back to front. Roadside plants pass beside the camera.
  const plants = Array.from({ length: 36 }, (_, i) => ({ i, z: ((i * 1.73 - hunt.distance) % 26 + 26) % 26 })).sort((a, b) => b.z - a.z);
  for (const { i, z } of plants) {
    const side = i % 2 ? -1 : 1;
    const x = side * (0.95 + i % 4 * 0.23);
    const p = project(x, z), scale = 3 / (z + 0.6);
    if (p.y > h + 120 || p.x < -100 || p.x > w + 100) continue;
    if (i % 5 === 0) {
      c.fillStyle = night ? '#35564b' : '#668657';
      c.beginPath(); c.ellipse(p.x, p.y, 20 * scale, 7 * scale, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = night ? '#7c9670' : '#a1a370'; c.lineWidth = Math.max(1, 5 * scale);
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x, p.y - 48 * scale); c.stroke();
      c.fillStyle = night ? '#527455' : '#789b64';
      c.beginPath(); c.ellipse(p.x, p.y - 53 * scale, 22 * scale, 30 * scale, side * 0.1, 0, Math.PI * 2); c.fill();
      c.fillStyle = night ? '#607f5f' : '#8aac70';
      c.beginPath(); c.ellipse(p.x - 8 * scale, p.y - 61 * scale, 13 * scale, 19 * scale, -0.25, 0, Math.PI * 2); c.fill();
    } else {
      c.strokeStyle = night ? '#80966d' : '#718c54'; c.lineWidth = Math.max(0.6, 1.4 * scale);
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + 4 * scale, p.y - 14 * scale); c.moveTo(p.x, p.y); c.lineTo(p.x - 5 * scale, p.y - 9 * scale); c.stroke();
      if (i % 3 === 0) { c.fillStyle = '#f0d78a'; c.beginPath(); c.arc(p.x + 4 * scale, p.y - 16 * scale, 3 * scale, 0, Math.PI * 2); c.fill(); }
    }
  }
  for (const target of [...hunt.targets].sort((a, b) => b.z - a.z)) {
    const p = hunt.project(target);
    c.globalAlpha = Math.min(1, (16 - target.z) / 2);
    // A soft silhouette separates the prey from the moving ground.
    c.save(); c.shadowColor = night ? '#ffecb777' : '#fffae5aa'; c.shadowBlur = 8 * p.scale;
    drawPrey(c, { ...p, prey: hunt.prey, time: hunt.time }); c.restore();
    c.globalAlpha = 1;
  }
}
