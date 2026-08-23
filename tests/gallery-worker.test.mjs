import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function loadWorker() {
  const source = await readFile(new URL('../cloudflare/gallery-worker.js', import.meta.url), 'utf8');
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  return (await import(moduleUrl)).default;
}

test('gallery endpoint lists only R2 gallery images newest first', async () => {
  const worker = await loadWorker();
  const env = {
    ALLOWED_ORIGIN: 'https://jamessung644.github.io',
    GALLERY_BUCKET: {
      async list() {
        return {
          objects: [
            {
              key: 'gallery/old photo.jpg',
              uploaded: new Date('2026-01-01T00:00:00Z'),
              size: 12,
              customMetadata: { alt: '오래된 사진', caption: 'Old' },
            },
            {
              key: 'gallery/new.webp',
              uploaded: new Date('2026-08-23T00:00:00Z'),
              size: 34,
              customMetadata: { alt: '새 사진', width: '1600', height: '1200' },
            },
            { key: 'gallery/notes.txt', uploaded: new Date('2026-09-01T00:00:00Z'), size: 4 },
            { key: 'private/hidden.jpg', uploaded: new Date('2026-10-01T00:00:00Z'), size: 56 },
          ],
          truncated: false,
        };
      },
    },
  };

  const response = await worker.fetch(
    new Request('https://gallery.example.workers.dev/gallery.json', {
      headers: { Origin: 'https://jamessung644.github.io' },
    }),
    env,
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://jamessung644.github.io');
  assert.deepEqual(payload, {
    images: [
      {
        id: 'gallery/new.webp',
        thumb: 'https://gallery.example.workers.dev/image/gallery/new.webp',
        large: 'https://gallery.example.workers.dev/image/gallery/new.webp',
        alt: '새 사진',
        caption: 'new',
        uploaded: '2026-08-23T00:00:00.000Z',
        width: 1600,
        height: 1200,
      },
      {
        id: 'gallery/old photo.jpg',
        thumb: 'https://gallery.example.workers.dev/image/gallery/old%20photo.jpg',
        large: 'https://gallery.example.workers.dev/image/gallery/old%20photo.jpg',
        alt: '오래된 사진',
        caption: 'Old',
        uploaded: '2026-01-01T00:00:00.000Z',
        width: 1200,
        height: 900,
      },
    ],
  });
});

test('image endpoint streams the requested R2 object with cache metadata', async () => {
  const worker = await loadWorker();
  const env = {
    ALLOWED_ORIGIN: '*',
    GALLERY_BUCKET: {
      async get(key) {
        if (key !== 'gallery/old photo.jpg') return null;
        return {
          body: new TextEncoder().encode('original-image'),
          httpEtag: '"r2-etag"',
          writeHttpMetadata(headers) {
            headers.set('content-type', 'image/jpeg');
          },
        };
      },
    },
  };

  const response = await worker.fetch(
    new Request('https://gallery.example.workers.dev/image/gallery/old%20photo.jpg'),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'original-image');
  assert.equal(response.headers.get('content-type'), 'image/jpeg');
  assert.equal(response.headers.get('etag'), '"r2-etag"');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
});

test('gallery image URLs change when an R2 object etag changes', async () => {
  const worker = await loadWorker();
  const env = {
    ALLOWED_ORIGIN: '*',
    GALLERY_BUCKET: {
      async list() {
        return {
          objects: [
            {
              key: 'gallery/reused-name.jpg',
              uploaded: new Date('2026-08-23T00:00:00Z'),
              etag: 'new-etag-2',
              size: 100,
            },
          ],
          truncated: false,
        };
      },
    },
  };

  const response = await worker.fetch(
    new Request('https://gallery.example.workers.dev/gallery.json'),
    env,
  );
  const payload = await response.json();

  assert.equal(
    payload.images[0].large,
    'https://gallery.example.workers.dev/image/gallery/reused-name.jpg?v=new-etag-2',
  );
});

test('image endpoint supplies a browser-safe content type when R2 metadata is absent', async () => {
  const worker = await loadWorker();
  const env = {
    ALLOWED_ORIGIN: '*',
    GALLERY_BUCKET: {
      async get(key) {
        if (key !== 'gallery/no-metadata.webp') return null;
        return {
          body: new Uint8Array([82, 73, 70, 70]),
          httpEtag: '"webp-etag"',
          writeHttpMetadata() {},
        };
      },
    },
  };

  const response = await worker.fetch(
    new Request('https://gallery.example.workers.dev/image/gallery/no-metadata.webp'),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/webp');
});
