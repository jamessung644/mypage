const test = require('node:test');
const assert = require('node:assert/strict');

let gaze = {};
try {
  gaze = require('../bloub-gaze.js');
} catch (_) {
  // The first TDD run intentionally reaches this branch before the gaze engine exists.
}

const closeTo = (actual, expected, tolerance = 0.02) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
};

test('cursor offsets continuously steer the supplied excite expression', () => {
  assert.equal(typeof gaze.lookTarget, 'function');

  assert.deepEqual(gaze.lookTarget(0, 0), { yaw: 6, pitch: -14, roll: 0 });
  assert.deepEqual(gaze.lookTarget(1, -1), { yaw: 22, pitch: -1, roll: 0 });
  assert.deepEqual(gaze.lookTarget(4, -3), { yaw: 22, pitch: -1, roll: 0 });

  const almostRight = gaze.lookTarget(0.49, 0);
  const right = gaze.lookTarget(0.5, 0);
  assert.notEqual(almostRight.yaw, right.yaw);
  assert.ok(right.yaw - almostRight.yaw < 0.2);
});

test('spherical projection reproduces the measured excite eye pose', () => {
  assert.equal(typeof gaze.eyePoses, 'function');

  const [left, right] = gaze.eyePoses({ yaw: 6, pitch: -14, roll: 0 }, 100, 19.5);
  closeTo(left.x, -23.64);
  closeTo(left.y, 22.8);
  closeTo(left.depth, 0.9445);
  closeTo(right.x, 42.76);
  closeTo(right.y, 22.8);
  closeTo(right.depth, 0.8747);
  assert.ok(right.a < left.a, 'the eye nearer the edge should be compressed by depth');
});

test('eye frames preserve the excite capsules while blinking in screen space', () => {
  assert.equal(typeof gaze.eyeFrames, 'function');

  const open = gaze.eyeFrames({ yaw: 6, pitch: -14, roll: 0 }, 1);
  const closed = gaze.eyeFrames({ yaw: 6, pitch: -14, roll: 0 }, 0);

  assert.equal(open.length, 2);
  assert.equal(open[0].path, open[1].path);
  assert.equal(open[0].path, 'M-20 -8A20 20 0 0 1 0 -28L0 -28A20 20 0 0 1 20 -8L20 8A20 20 0 0 1 0 28L0 28A20 20 0 0 1 -20 8Z');
  assert.ok(Math.abs(closed[0].matrix[3]) < Math.abs(open[0].matrix[3]) * 0.1);
  closeTo(closed[0].matrix[4], open[0].matrix[4]);
  closeTo(closed[0].matrix[5], open[0].matrix[5]);
});

test('gaze easing moves toward the pointer without overshoot', () => {
  assert.equal(typeof gaze.easeGaze, 'function');

  const from = { yaw: 6, pitch: -14, roll: 0 };
  const to = { yaw: 22, pitch: -1, roll: 0 };
  assert.deepEqual(gaze.easeGaze(from, to, 0), from);

  const moving = gaze.easeGaze(from, to, 0.024);
  assert.ok(moving.yaw > from.yaw && moving.yaw < to.yaw);
  assert.ok(moving.pitch > from.pitch && moving.pitch < to.pitch);
  assert.deepEqual(gaze.easeGaze(from, to, 0.24), to);
});

test('resting liveliness is deterministic and keeps blink values bounded', () => {
  assert.equal(typeof gaze.liveliness, 'function');

  const first = gaze.liveliness(2.5);
  const replay = gaze.liveliness(2.5);
  assert.deepEqual(first, replay);
  assert.ok(first.lid >= 0 && first.lid <= 1);
  assert.ok(Number.isFinite(first.dYaw + first.dPitch + first.dRoll));
});
