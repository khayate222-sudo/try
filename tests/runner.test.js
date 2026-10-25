import test from 'node:test';
import assert from 'node:assert/strict';
import { Hunt } from '../game.js';
import { RunnerHunt } from '../runner.js';

function rng(seed = 321) { return () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646; }
function advance(game, seconds) { for (let i = 0; i < Math.ceil(seconds * 60); i++) game.step(1 / 60); }

test('flat prey is substantially faster, with a distinct fastest setting', () => {
  for (const prey of ['mouse', 'bug', 'feather']) {
    const games = [1, 2, 3].map(speed => new Hunt(390, 844, { prey, speed, random: () => 0 }));
    const distances = games.map(game => { const start = { x: game.x, y: game.y }; advance(game, 0.2); return Math.hypot(game.x - start.x, game.y - start.y); });
    assert.ok(distances[1] > 40, `${prey} should visibly move in 0.2s`);
    assert.ok(distances[2] > distances[0] * 2.5);
  }
});
test('runner approaches and grows while swaying horizontally and vertically', () => {
  const game = new RunnerHunt(390, 844, { random: rng() });
  const target = game.targets[0], start = game.project(target);
  advance(game, 1);
  const next = game.project(target);
  assert.ok(target.z < 9);
  assert.ok(next.scale > start.scale * 1.5);
  assert.ok(Math.abs(next.x - start.x) > 2);
  assert.ok(Math.abs(next.y - start.y) > 2);
  assert.ok(game.distance > 3);
});
test('early capture gives 30 points once; foreground capture gives 10', () => {
  const game = new RunnerHunt(390, 844, { random: rng() });
  let p = game.project(game.targets[0]);
  assert.equal(game.tap(p.x, p.y), true);
  assert.equal(game.score, 30);
  assert.equal(game.catches, 1);
  assert.equal(game.tap(p.x, p.y), false);
  game.spawn(2);
  p = game.project(game.targets[0]);
  assert.equal(game.tap(p.x, p.y), true);
  assert.equal(game.score, 40);
  assert.equal(game.catches, 2);
  game.spawn(5); p = game.project(game.targets[0]);
  assert.equal(game.tap(p.x, p.y), true);
  assert.equal(game.score, 60);
});
test('passing prey expires without points and cannot be caught afterward', () => {
  const game = new RunnerHunt(390, 844, { random: rng() });
  const target = game.targets[0]; target.z = 0.91;
  game.step(.05);
  assert.equal(game.targets.includes(target), false);
  assert.equal(game.missed, 1);
  assert.equal(game.score, 0);
  const p = game.project(target);
  assert.equal(game.tap(p.x, p.y), false);
  assert.equal(game.catches, 0);
});
test('runner stays bounded over a long session and resizes without resetting score', () => {
  for (const [width, height] of [[320, 568], [844, 390]]) {
    const game = new RunnerHunt(width, height, { random: rng(), speed: 3 });
    const p = game.project(game.targets[0]); game.tap(p.x, p.y);
    for (let i = 0; i < 180 * 60; i++) {
      game.step(1 / 60);
      assert.ok(game.targets.length <= 6);
      for (const target of game.targets) {
        const view = game.project(target);
        assert.ok(view.x > 0 && view.x < width && view.y > 0 && view.y < height);
      }
    }
    assert.ok(game.missed > 100);
    game.resize(height, width);
    assert.equal(game.score, 30);
    for (const target of game.targets) { const view = game.project(target); assert.ok(view.x > 0 && view.x < height && view.y > 0 && view.y < width); }
  }
});
