const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateSpacedRadiusX,
  calculateWheelFrame,
  normalizeLocalFallback,
  normalizeManifest,
  normalizeProgress,
  resolvePointerRelease,
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

test('normalizeLocalFallback builds thumbnail records when fetch is unavailable', () => {
  const images = normalizeLocalFallback?.([
    { large: 'Img/1.jpg', alt: '첫 번째 기록' },
    { large: 'Img/2.jpg', alt: '두 번째 기록' },
  ]);

  assert.deepEqual(images, [
    {
      id: 'local-photo-01',
      thumb: 'Img/gallery/1.webp',
      large: 'Img/1.jpg',
      alt: '첫 번째 기록',
      caption: '첫 번째 기록',
      uploaded: '',
      width: 800,
      height: 600,
    },
    {
      id: 'local-photo-02',
      thumb: 'Img/gallery/2.webp',
      large: 'Img/2.jpg',
      alt: '두 번째 기록',
      caption: '두 번째 기록',
      uploaded: '',
      width: 800,
      height: 600,
    },
  ]);
});

test('calculateWheelFrame produces a bounded elliptical orbit and depth', () => {
  const frame = calculateWheelFrame(0, 8, 0, { radiusX: 42, radiusY: 13, depth: 0.24 });
  assert.equal(frame.xPercent, 42);
  assert.ok(Math.abs(frame.yPercent) < 0.001);
  assert.ok(frame.scale >= 0.76 && frame.scale <= 1.24);
  assert.ok(frame.opacity >= 0.45 && frame.opacity <= 1);
});

test('calculateWheelFrame turns continuously from the front to a 90 degree back card', () => {
  const right = calculateWheelFrame(0, 4, 0);
  const front = calculateWheelFrame(0, 4, 0.25);
  const left = calculateWheelFrame(2, 4, 0);
  const back = calculateWheelFrame(0, 4, 0.75);

  assert.equal(right.rotationDeg, -3.5);
  assert.equal(right.rotationYDeg, -45);
  assert.ok(Math.abs(front.rotationDeg) < 0.001);
  assert.ok(Math.abs(front.rotationYDeg) < 0.001);
  assert.equal(left.rotationDeg, 3.5);
  assert.equal(left.rotationYDeg, 45);
  assert.equal(Math.abs(back.rotationYDeg), 90);
});

test('calculateWheelFrame crossfades adjacent cards at the front handoff', () => {
  const count = 15;
  const handoffProgress = 0.25 + 1 / (count * 2);
  const outgoing = calculateWheelFrame(0, count, handoffProgress);
  const incoming = calculateWheelFrame(count - 1, count, handoffProgress);
  const centered = calculateWheelFrame(0, count, 0.25);

  assert.ok(centered.opacity > 0.99);
  assert.ok(outgoing.opacity >= 0.55 && outgoing.opacity <= 0.62);
  assert.ok(incoming.opacity >= 0.55 && incoming.opacity <= 0.62);
  assert.ok(Math.abs(outgoing.opacity - incoming.opacity) < 0.001);
});

test('calculateWheelFrame smoothly enlarges only the centered card', () => {
  const count = 15;
  const centered = calculateWheelFrame(0, count, 0.25);
  const approaching = calculateWheelFrame(0, count, 0.25 + 1 / (count * 4));
  const handoff = calculateWheelFrame(0, count, 0.25 + 1 / (count * 2));

  assert.ok(Math.abs(centered.scale - 1.3) < 0.001);
  assert.ok(centered.scale > approaching.scale);
  assert.ok(approaching.scale > handoff.scale);
});

test('calculateSpacedRadiusX preserves a visible gap as the gallery grows', () => {
  const count = 22;
  const stageWidth = 1168;
  const cardWidth = 330;
  const gap = 24;
  const maxScale = 1.3;
  const radiusX = calculateSpacedRadiusX?.(count, stageWidth, cardWidth, {
    baseRadiusX: 44,
    gap,
    maxScale,
  });
  const adjacentDistance = Math.sin((Math.PI * 2) / count) * (radiusX / 100) * stageWidth;

  assert.ok(radiusX > 44);
  assert.ok(adjacentDistance >= cardWidth * maxScale + gap - 0.001);
});

test('shouldAnimate requires multiple images and no pause reasons', () => {
  assert.equal(shouldAnimate(new Set(), false, 8), true);
  assert.equal(shouldAnimate(new Set(['hover']), false, 8), false);
  assert.equal(shouldAnimate(new Set(), true, 8), false);
  assert.equal(shouldAnimate(new Set(), false, 1), false);
  assert.equal(shouldAnimate(new Set(), false, 0), false);
});

test('resolvePointerRelease opens a stationary card but not a drag', () => {
  assert.equal(resolvePointerRelease?.({ moved: false, imageIndex: 4 }), 4);
  assert.equal(resolvePointerRelease?.({ moved: true, imageIndex: 4 }), -1);
  assert.equal(resolvePointerRelease?.({ moved: false, imageIndex: -1 }), -1);
  assert.equal(resolvePointerRelease?.(null), -1);
});
