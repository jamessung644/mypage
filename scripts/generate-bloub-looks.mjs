import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(projectRoot, 'Img/bloub-squircle-excite-rouge-anime.svg');
const outputDirectory = resolve(projectRoot, 'Img/bloub-look');
const source = await readFile(sourcePath, 'utf8');

const directions = {
  north: [0, -8],
  'north-east': [6, -6],
  east: [8, 0],
  'south-east': [6, 6],
  south: [0, 8],
  'south-west': [-6, 6],
  west: [-8, 0],
  'north-west': [-6, -6],
};

const number = (value) => Number(value.toFixed(2));

function setEyeTransform(svg, className, matrix) {
  const eyePath = new RegExp(`(<path\\b[^>]*class="${className}"[^>]*)(/>)`);
  const transformed = svg.replace(eyePath, `$1 transform="${matrix}"$2`);
  if (transformed === svg) throw new Error(`Could not find ${className} in source SVG`);
  return transformed;
}

function makeVariant(offsetX, offsetY) {
  const leftX = number(-23.23 + offsetX);
  const leftY = number(23.27 + offsetY);
  const rightX = number(47.62 + offsetX);
  const rightY = number(20.65 + offsetY);

  let variant = source.replace(/<style>[\s\S]*<\/style>/, '');
  variant = setEyeTransform(variant, 'oeil0', `matrix(.97 -.11 .15 .97 ${leftX} ${leftY})`);
  variant = setEyeTransform(variant, 'oeil1', `matrix(.87 .09 -.18 .98 ${rightX} ${rightY})`);
  return variant;
}

await mkdir(outputDirectory, { recursive: true });

for (const [direction, [offsetX, offsetY]] of Object.entries(directions)) {
  const variant = makeVariant(offsetX, offsetY);
  await writeFile(resolve(outputDirectory, `${direction}.svg`), variant);
}
