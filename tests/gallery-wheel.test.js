const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateWheelFrame,
  normalizeManifest,
  normalizeProgress,
  shouldAnimate,
} = require('../gallery-wheel.js');

test('normalizeProgress wraps finite values into [0, 1)', () => {
  assert.equal(normalizeProgress(1.25), 0.25);
  assert.equal(normalizeProgress(-0.25), 0.75);
  assert.equal(normalizeProgress(Number.NaN), 0);
});

test('normalizeManifest keeps renderable images and sorts newest first', () => {
  const images = normalizeManifest({
    images: [
      { id: 'old', thumb: '/old.webp', large: '/old.jpg', alt: 'Old', uploaded: '2026-01-01T00:00:00Z' },
      { id: 'broken', thumb: '', large: '/broken.jpg', alt: 'Broken' },
      { id: 'new', thumb: '/new.webp', large: '/new.jpg', alt: 'New', uploaded: '2026-08-23T00:00:00Z' },
    ],
  });

  assert.deepEqual(images.map((image) => image.id), ['new', 'old']);
});

test('calculateWheelFrame produces a bounded elliptical orbit and depth', () => {
  const frame = calculateWheelFrame(0, 8, 0, { radiusX: 42, radiusY: 13, depth: 0.24 });
  assert.equal(frame.xPercent, 42);
  assert.ok(Math.abs(frame.yPercent) < 0.001);
  assert.ok(frame.scale >= 0.76 && frame.scale <= 1.24);
  assert.ok(frame.opacity >= 0.45 && frame.opacity <= 1);
});

test('calculateWheelFrame fans cards radially and faces the front card forward', () => {
  const right = calculateWheelFrame(0, 4, 0);
  const front = calculateWheelFrame(0, 4, 0.25);
  const left = calculateWheelFrame(2, 4, 0);

  assert.equal(right.rotationZDeg, -90);
  assert.equal(right.rotationYDeg, -68);
  assert.ok(Math.abs(front.rotationZDeg) < 0.001);
  assert.ok(Math.abs(front.rotationYDeg) < 0.001);
  assert.equal(left.rotationZDeg, 90);
  assert.equal(left.rotationYDeg, 68);
});

test('shouldAnimate requires multiple images and no pause reasons', () => {
  assert.equal(shouldAnimate(new Set(), false, 8), true);
  assert.equal(shouldAnimate(new Set(['hover']), false, 8), false);
  assert.equal(shouldAnimate(new Set(), true, 8), false);
  assert.equal(shouldAnimate(new Set(), false, 1), false);
  assert.equal(shouldAnimate(new Set(), false, 0), false);
});
