import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directions = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
];

test('directional Bloub SVGs position both eyes with portable SVG transforms', async () => {
  for (const direction of directions) {
    const svg = await readFile(resolve(projectRoot, 'Img/bloub-look', `${direction}.svg`), 'utf8');
    const leftEye = svg.match(/<path\b[^>]*class="oeil0"[^>]*>/)?.[0] || '';
    const rightEye = svg.match(/<path\b[^>]*class="oeil1"[^>]*>/)?.[0] || '';

    assert.match(leftEye, /\stransform="matrix\([^\"]+\)"/, `${direction}: left eye needs an SVG transform attribute`);
    assert.match(rightEye, /\stransform="matrix\([^\"]+\)"/, `${direction}: right eye needs an SVG transform attribute`);
    assert.doesNotMatch(svg, /@keyframes|transform-box/, `${direction}: directional asset must be static`);
  }
});
