import test from 'node:test';
import assert from 'node:assert/strict';
import { StringTail } from '../string.js';
import { Hunt } from '../game.js';
import { ManualHunt } from '../manual.js';
import { RunnerHunt } from '../runner.js';
import { WallHunt } from '../wall.js';
function advance(game, seconds) { for (let i = 0; i < seconds * 60; i++) game.step(1 / 60); }

test('the cord trails its moving head, keeps its length, and flutters when held still', () => {
  const cord = new StringTail(195, 422);
  for (let i = 0; i < 120; i++) cord.step(195 + i, 422 + Math.sin(i / 20) * 30, 1 / 60);
  assert.equal(cord.points[0].x, 314);
  assert.ok(Math.hypot(cord.points.at(-1).x - 314, cord.points.at(-1).y - cord.points[0].y) > 25);
  for (let i = 0; i < 120; i++) cord.step(314, 422, 1 / 60);
  const before = { ...cord.points.at(-1) };
  for (let i = 0; i < 30; i++) cord.step(314, 422, 1 / 60);
  assert.ok(Math.hypot(cord.points.at(-1).x - before.x, cord.points.at(-1).y - before.y) > .5);
  for (let i = 1; i < cord.points.length; i++) assert.ok(Math.hypot(cord.points[i].x - cord.points[i - 1].x, cord.points[i].y - cord.points[i - 1].y) < 10);
});
test('the full length can be caught in flat and runner stages, only once', () => {
  const flat = new Hunt(390, 844, { prey: 'string' });
  const tail = flat.stringTail.points.at(-2);
  assert.ok(Math.hypot(tail.x - flat.x, tail.y - flat.y) > 45);
  assert.equal(flat.tap(tail.x, tail.y), true); assert.equal(flat.tap(tail.x, tail.y), false);
  const runner = new RunnerHunt(390, 844, { prey: 'string' });
  const end = runner.targets[0].stringTail.points.at(-1);
  assert.equal(runner.tap(end.x, end.y), true); assert.equal(runner.score, 30);
});
test('manual strings follow a finger and keep fluttering after it stops', () => {
  const manual = new ManualHunt(390, 844, { prey: 'string' });
  manual.point(.8, .4); advance(manual, 1);
  assert.ok(Math.abs(manual.stringTail.points[0].x - 312) < .01);
  const before = { ...manual.stringTail.points.at(-1) };
  advance(manual, .5);
  assert.ok(Math.hypot(manual.stringTail.points.at(-1).x - before.x, manual.stringTail.points.at(-1).y - before.y) > .5);
  manual.hide(true); advance(manual, 1); assert.equal(manual.targets.length, 0);
  manual.hide(false); advance(manual, 1); assert.equal(manual.targets.length, 1);
});
test('strings remain finite through rapid turns, size changes, and phone rotation', () => {
  const cord = new StringTail(195, 422);
  for (let i = 0; i < 1800; i++) {
    cord.step(195 + Math.sin(i * .2) * 140, 422 + Math.cos(i * .13) * 300, i % 2 ? .016 : .033, [.6, 1, 1.45][Math.floor(i / 600)]);
    for (const p of cord.points) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  }
  const wall = new WallHunt(390, 844, { prey: 'string' }); advance(wall, .5);
  const tip = wall.targets[0].stringTail.points.at(-1);
  assert.equal(wall.tap(tip.x, tip.y), true); assert.equal(wall.score, 10);
  wall.resize(844, 390); advance(wall, .1);
  for (const t of wall.targets) for (const p of t.stringTail.points) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});
