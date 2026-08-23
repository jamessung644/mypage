const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateAutoplayStep,
  calculateCarouselFrame,
  calculateCarouselSlotX,
  normalizeLocalFallback,
  normalizeManifest,
  resolveCarouselTarget,
  resolveFilmstripPosition,
  resolvePointerRelease,
  shouldAnimate,
} = require('../gallery-wheel.js');

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

test('calculateCarouselFrame keeps one full card centered while the next waits at the side', () => {
  const centered = calculateCarouselFrame?.(0, 8, 0);
  const next = calculateCarouselFrame?.(1, 8, 0);
  const far = calculateCarouselFrame?.(2, 8, 0);

  assert.deepEqual(centered, {
    xPercent: 0,
    yPercent: 0,
    scale: 1.12,
    opacity: 1,
    rotationDeg: 0,
    rotationYDeg: 0,
    zIndex: 100,
    interactive: true,
  });
  assert.equal(next.xPercent, 46);
  assert.equal(next.rotationYDeg, -70);
  assert.ok(next.scale < centered.scale);
  assert.equal(far.opacity, 0);
  assert.equal(far.interactive, false);
});

test('calculateAutoplayStep holds the centered photo before a smooth handoff', () => {
  assert.deepEqual(calculateAutoplayStep?.(2499, 2500, 900), { offset: 0, complete: false });
  assert.deepEqual(calculateAutoplayStep?.(2950, 2500, 900), { offset: 0.5, complete: false });
  assert.deepEqual(calculateAutoplayStep?.(3400, 2500, 900), { offset: 1, complete: true });
});

test('calculateCarouselSlotX keeps enlarged handoff cards separated by the requested gap', () => {
  const desktop = calculateCarouselSlotX?.(1168, 400, {
    gap: 32,
    projectionScale: 0.84,
    transitionScale: 0.98,
    minimumSlotX: 32,
  });
  const mobile = calculateCarouselSlotX?.(358, 211, {
    gap: 12,
    projectionScale: 0.84,
    transitionScale: 0.98,
    minimumSlotX: 32,
  });

  assert.equal(desktop, 32);
  assert.ok(Math.abs(mobile - 51.87017) < 0.00001);
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

test('resolveFilmstripPosition wraps the active thumbnail and reports a human position', () => {
  assert.deepEqual(resolveFilmstripPosition?.(0, 22), { index: 0, current: 1, total: 22 });
  assert.deepEqual(resolveFilmstripPosition?.(22, 22), { index: 0, current: 1, total: 22 });
  assert.deepEqual(resolveFilmstripPosition?.(-1, 22), { index: 21, current: 22, total: 22 });
  assert.deepEqual(resolveFilmstripPosition?.(4, 0), { index: 0, current: 0, total: 0 });
});

test('resolveCarouselTarget chooses the shortest rotation to a clicked thumbnail', () => {
  assert.equal(resolveCarouselTarget?.(2, 20, 22), -2);
  assert.equal(resolveCarouselTarget?.(20, 2, 22), 24);
  assert.equal(resolveCarouselTarget?.(5, 8, 22), 8);
  assert.equal(resolveCarouselTarget?.(5, 8, 0), 0);
});
