import test from 'node:test';
import assert from 'node:assert/strict';
import { OrganicMotion, insectPalette, insectRadius } from '../insects.js';
import { Hunt } from '../game.js';
import { RunnerHunt } from '../runner.js';
import { WallHunt } from '../wall.js';

function rng(seed = 312) { return () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646; }
const step = (game, seconds) => { for (let i = 0; i < seconds * 60; i++) game.step(1 / 60); };

test('organic movement alternates short bursts, stillness, and large direction changes', () => {
  for (const prey of ['bug', 'ant', 'gnat', 'spider']) {
    const motion = new OrganicMotion({ random: rng(), prey });
    const phases = new Set(); let p = { x: 5000, y: 5000 }, still = 0, turns = 0;
    for (let i = 0; i < 3600; i++) {
      const heading = motion.heading;
      const q = motion.step(1 / 60, p, { left: 0, right: 10000, top: 0, bottom: 10000 }, 160);
      phases.add(motion.phase);
      if (Math.hypot(q.x - p.x, q.y - p.y) < .001) still++;
      if (Math.abs(Math.atan2(Math.sin(motion.heading - heading), Math.cos(motion.heading - heading))) > 1) turns++;
      p = q;
    }
    assert.ok(still > 60 && still < 2000);
    assert.ok(turns > 5);
    assert.deepEqual(phases, new Set(['dart', 'freeze', 'probe']));
    assert.ok(motion.distance > 1000);
  }
});
test('tiny bugs can be captured without requiring pixel-perfect taps in flat and runner stages', () => {
  for (const prey of ['ant', 'gnat', 'spider']) {
    const flat = new Hunt(390, 844, { prey, size: .6, random: rng() });
    assert.ok(insectRadius(prey, .6) >= 18);
    assert.equal(flat.tap(flat.x + 12, flat.y), true);
    assert.equal(flat.tap(flat.x, flat.y), false);
    const runner = new RunnerHunt(390, 844, { prey, size: .6, random: rng() });
    const p = runner.project(runner.targets[0]);
    assert.equal(p.size, .6);
    assert.equal(runner.tap(p.x + 12, p.y), true);
    assert.equal(runner.score, 30);
  }
});
test('all crawling species stay on screen with irregular movement for a long session', () => {
  for (const prey of ['ant', 'gnat', 'spider']) {
    const flat = new Hunt(320, 568, { prey, speed: 3, random: rng() });
    const runner = new RunnerHunt(320, 568, { prey, speed: 3, random: rng() });
    for (let i = 0; i < 7200; i++) {
      flat.step(1 / 60); runner.step(1 / 60);
      assert.ok(flat.x >= 0 && flat.x <= 320 && flat.y >= 0 && flat.y <= 568);
      for (const t of runner.targets) { const p = runner.project(t); assert.ok(p.x > 0 && p.x < 320 && p.y > 0 && p.y < 568); }
    }
  }
});
test('wall spiders climb, can be caught once, and keep score on rotation', () => {
  const wall = new WallHunt(390, 844, { random: rng() });
  const spider = wall.targets[0], startY = spider.y;
  step(wall, .5);
  assert.ok(spider.y < startY - 20);
  const { x, y } = spider;
  assert.equal(wall.tap(x, y), true);
  assert.equal(wall.tap(x, y), false);
  assert.equal(wall.catches, 1); assert.equal(wall.score, 10);
  wall.resize(844, 390);
  assert.equal(wall.score, 10);
  for (const t of wall.targets) assert.ok(t.x > 0 && t.x < 844 && t.y > 0 && t.y < 390);
});
test('wall population is bounded, escaped bugs give no points, and tiny prey give 20', () => {
  for (const prey of ['bug', 'ant', 'gnat', 'spider']) {
    const wall = new WallHunt(320, 568, { prey, speed: 3, random: rng() });
    step(wall, 120);
    assert.ok(wall.targets.length <= 5);
    assert.ok(wall.missed > 0); assert.equal(wall.score, 0);
  }
  const wall = new WallHunt(390, 844, { prey: 'ant', size: .6, random: rng() });
  assert.equal(wall.tap(wall.targets[0].x, wall.targets[0].y), true);
  assert.equal(wall.score, 20);
});
test('high contrast palettes have strong luminance contrast on both walls', () => {
  function luminance(hex) { const rgb = hex.match(/[0-9a-f]{2}/gi).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; }
  for (const [night, background] of [[false, '#d9d4c5'], [true, '#253743']]) {
    const [a, b] = [luminance(insectPalette(night).body), luminance(background)].sort((a, b) => b - a);
    assert.ok((a + .05) / (b + .05) > 7);
  }
  assert.notEqual(insectPalette(false, true).body, insectPalette(false, false).body);
});
