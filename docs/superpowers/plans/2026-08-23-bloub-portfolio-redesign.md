# Bloub Portfolio Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the existing static portfolio around a professional dusty-paper visual system, an interactive Bloub character, evidence-led current projects, and an accessible auto-rotating image wheel that can later consume Cloudflare Images automatically.

**Architecture:** Keep the existing static HTML/CSS/JavaScript site and layer focused modules around it: `gallery-wheel.js` owns wheel math, rendering, motion state, and manifest loading; `bloub.js` owns the loader and gaze; `redesign.css` owns the new visual system. The wheel consumes one stable manifest schema from local `gallery.json` first and a Cloudflare Worker endpoint later, with the local source retained as a runtime fallback.

**Tech Stack:** HTML5, CSS3, dependency-free browser JavaScript, Node.js built-in test runner, Cloudflare Images/Workers binding, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-08-23-bloub-portfolio-redesign-design.md`

## Global Constraints

- Preserve the user's existing uncommitted PilloSuffer award markup and responsive card changes.
- Continue using static `index.html`, `style.css`, and `script.js`; do not migrate to a framework.
- Add no runtime JavaScript dependency or animation library.
- Korean remains the default language and English remains selectable with the existing local preference.
- JavaScript enhancements fail safely: content and project links remain available without them.
- The image wheel pauses for hover, focus, manual input, dragging, lightbox, off-screen state, hidden document state, and reduced-motion preference.
- Large gallery images load only when the lightbox opens; wheel cards use thumbnail URLs.
- Cloudflare credentials and account tokens never appear in browser code or committed configuration.
- Existing local images remain the fallback until a Cloudflare Images endpoint is configured and verified.

## File Structure

- Modify `index.html`: new loader/Bloub markup, simplified navigation and hero, current project cards, image-wheel container, accessible lightbox attributes, stylesheet/script order.
- Modify `script.js`: keep language, navigation, reveal, contact, and video behavior; remove particle generation and old static-gallery click binding; expose reusable lightbox open/close events.
- Modify `style.css`: remove only obsolete rules that cause direct conflicts after the redesign is stable; preserve component rules still used by legacy sections.
- Create `redesign.css`: all Dusty Interaction Lab tokens, layout overrides, Bloub visuals, image wheel, responsive behavior, focus states, and reduced-motion rules.
- Create `gallery-wheel.js`: manifest normalization/loading, pure wheel geometry, image rendering, animation state machine, pointer/touch/slider interaction, and lightbox integration.
- Create `bloub.js`: first-session loader, pointer gaze, blink scheduling, project-focus gaze, failure fallback, and reduced-motion handling.
- Create `gallery.json`: local fallback manifest with the current 15 images.
- Create `Img/gallery/*.webp`: 800-pixel local wheel thumbnails generated from the current originals.
- Copy `/Users/sungsuhan/Downloads/bloub-squircle-excite-rouge.gif` to `Img/bloub-rouge.gif`.
- Create `tests/gallery-wheel.test.js`: Node tests for manifest validation, progress wrapping, wheel geometry, and pause-state resolution.
- Create `cloudflare/gallery-worker.js`: Images-binding list endpoint mapped to the gallery manifest schema.
- Create `cloudflare/wrangler.example.jsonc`: credential-free Worker binding, CORS origin, and delivery-account placeholders documented as values the user supplies before deployment.
- Create `cloudflare/README.md`: deployment, variants, filename convention, endpoint configuration, and rollback instructions.

---

### Task 1: Lock the image-wheel math and data contract with tests

**Files:**
- Create: `gallery-wheel.js`
- Create: `tests/gallery-wheel.test.js`

**Interfaces:**
- Produces: `normalizeProgress(value: number): number`
- Produces: `normalizeManifest(payload: unknown): GalleryImage[]`
- Produces: `calculateWheelFrame(index: number, count: number, progress: number, geometry?: WheelGeometry): WheelFrame`
- Produces: `shouldAnimate(pauses: Set<string>, reducedMotion: boolean, itemCount: number): boolean`
- Produces: browser global and CommonJS export named `GalleryWheel`

- [ ] **Step 1: Write failing tests for progress wrapping and manifest validation**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeProgress, normalizeManifest } = require('../gallery-wheel.js');

test('normalizeProgress wraps any finite value into [0, 1)', () => {
  assert.equal(normalizeProgress(1.25), 0.25);
  assert.equal(normalizeProgress(-0.25), 0.75);
  assert.equal(normalizeProgress(Number.NaN), 0);
});

test('normalizeManifest keeps only renderable images and sorts newest first', () => {
  const images = normalizeManifest({ images: [
    { id: 'old', thumb: '/old.webp', large: '/old.jpg', alt: 'Old', uploaded: '2026-01-01T00:00:00Z' },
    { id: 'broken', thumb: '', large: '/broken.jpg', alt: 'Broken' },
    { id: 'new', thumb: '/new.webp', large: '/new.jpg', alt: 'New', uploaded: '2026-08-23T00:00:00Z' }
  ] });
  assert.deepEqual(images.map(image => image.id), ['new', 'old']);
});
```

- [ ] **Step 2: Run the tests and confirm the module is missing**

Run: `node --test tests/gallery-wheel.test.js`

Expected: FAIL because `gallery-wheel.js` does not exist.

- [ ] **Step 3: Implement progress wrapping and strict manifest normalization**

```js
(function exposeGalleryWheel(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GalleryWheel = api;
})(typeof window !== 'undefined' ? window : globalThis, function buildGalleryWheelApi() {
  function normalizeProgress(value) {
    if (!Number.isFinite(value)) return 0;
    return ((value % 1) + 1) % 1;
  }

  function normalizeManifest(payload) {
    const list = payload && Array.isArray(payload.images) ? payload.images : [];
    return list
      .filter(image => image && image.id && image.thumb && image.large)
      .map(image => ({
        id: String(image.id),
        thumb: String(image.thumb),
        large: String(image.large),
        alt: String(image.alt || 'Portfolio gallery image'),
        caption: String(image.caption || ''),
        uploaded: String(image.uploaded || '')
      }))
      .sort((a, b) => Date.parse(b.uploaded || 0) - Date.parse(a.uploaded || 0));
  }

  return { normalizeProgress, normalizeManifest };
});
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `node --test tests/gallery-wheel.test.js`

Expected: 2 tests PASS.

- [ ] **Step 5: Add failing geometry and animation-state tests**

```js
const { calculateWheelFrame, shouldAnimate } = require('../gallery-wheel.js');

test('calculateWheelFrame produces a bounded elliptical orbit and depth', () => {
  const frame = calculateWheelFrame(0, 8, 0, { radiusX: 42, radiusY: 13, depth: 0.24 });
  assert.equal(frame.xPercent, 42);
  assert.ok(Math.abs(frame.yPercent) < 0.001);
  assert.ok(frame.scale >= 0.76 && frame.scale <= 1.24);
  assert.ok(frame.opacity >= 0.45 && frame.opacity <= 1);
});

test('shouldAnimate requires images and no pause reasons', () => {
  assert.equal(shouldAnimate(new Set(), false, 8), true);
  assert.equal(shouldAnimate(new Set(['hover']), false, 8), false);
  assert.equal(shouldAnimate(new Set(), true, 8), false);
  assert.equal(shouldAnimate(new Set(), false, 1), false);
});
```

- [ ] **Step 6: Implement geometry and pause-state resolution**

```js
function calculateWheelFrame(index, count, progress, geometry = {}) {
  const radiusX = geometry.radiusX ?? 42;
  const radiusY = geometry.radiusY ?? 13;
  const depth = geometry.depth ?? 0.24;
  const angle = ((index / Math.max(count, 1)) + normalizeProgress(progress)) * Math.PI * 2;
  const z = (Math.sin(angle) + 1) / 2;
  return {
    xPercent: Math.cos(angle) * radiusX,
    yPercent: Math.sin(angle) * radiusY,
    scale: 1 - depth + z * depth * 2,
    opacity: 0.45 + z * 0.55,
    rotationDeg: Math.cos(angle) * -9,
    zIndex: Math.round(z * 100)
  };
}

function shouldAnimate(pauses, reducedMotion, itemCount) {
  return !reducedMotion && itemCount > 1 && pauses.size === 0;
}
```

- [ ] **Step 7: Run the full unit test file**

Run: `node --test tests/gallery-wheel.test.js`

Expected: 4 tests PASS.

- [ ] **Step 8: Commit the tested core**

```bash
git add gallery-wheel.js tests/gallery-wheel.test.js
git commit -m "feat: add tested image wheel core"
```

### Task 2: Build the local gallery source and interactive wheel

**Files:**
- Modify: `gallery-wheel.js`
- Create: `gallery.json`
- Create: `Img/gallery/1.webp` through `Img/gallery/15.webp`
- Modify: `index.html` in the `#photo` section and lightbox markup
- Modify: `script.js` in the lightbox event section
- Test: `tests/gallery-wheel.test.js`

**Interfaces:**
- Consumes: `GalleryWheel.normalizeManifest`, `calculateWheelFrame`, `shouldAnimate`
- Produces: `GalleryWheel.mount(root: HTMLElement, options: { fallbackUrl: string, remoteUrl?: string, openLightbox: Function }): Promise<ImageWheelController>`
- Consumes from page: `window.portfolioLightbox.open(image, trigger)`
- Produces DOM event: `gallerywheel:ready` with `{ count }`

- [ ] **Step 1: Generate 800-pixel WebP thumbnails without modifying originals**

Run:

```bash
mkdir -p Img/gallery
for source in Img/1.jpg Img/2.jpg Img/3.jpg Img/4.jpg Img/5.jpg Img/6.png Img/7.jpeg Img/8.jpeg Img/9.jpeg Img/10.jpeg Img/11.jpg Img/12.jpeg Img/13.jpeg Img/14.jpeg Img/15.jpg; do
  name=$(basename "$source")
  stem=${name%.*}
  magick "$source" -auto-orient -resize '800x800>' -strip -quality 76 "Img/gallery/$stem.webp"
done
```

Expected: 15 WebP files, each no wider or taller than 800 pixels.

- [ ] **Step 2: Create the complete local fallback manifest**

Use IDs `photo-01` through `photo-15`; map thumbs to `Img/gallery/N.webp` and large URLs to the current original extension. Use these exact Korean alt descriptions:

```text
01 최우수상 수상 기록
02 챌린지상 수상 기록
03 프로젝트 시상식 기록
04 교내 창업경진대회 수상 기록
05 야외에서 상장을 든 프로젝트 수상 기록
06 군중 밀도 분석 시스템 실행 화면
07 프로젝트 일정 중 촬영한 현장 기록
08 프로젝트 수상 상장
09 Physical AI 로봇 프로토타입
10 실험 장비가 놓인 연구 공간
11 Microsoft Korea 경진대회 수상 기록
12 프로젝트 발표 현장
13 전공작품 최우수상 수상 기록
14 인공지능워크 2023 참가 기록
15 컴퓨터 비전 모델 구조 연구 자료
```

Each entry also includes its intrinsic `width` and `height` from the existing files and `caption` equal to the alt text. Set `uploaded` in ascending visual-history order from `2026-08-23T00:00:01Z` through `2026-08-23T00:00:15Z` only to preserve the existing 1–15 ordering locally; remote Cloudflare dates replace these values after migration.

- [ ] **Step 3: Replace the gallery grid with progressive image-wheel markup**

```html
<div class="image-wheel" id="imageWheel"
  data-fallback-url="gallery.json"
  data-remote-url=""
  aria-labelledby="imageWheelTitle">
  <div class="image-wheel__header">
    <span class="section__tag">Field Notes · 15 frames</span>
    <h3 id="imageWheelTitle">
      <span class="lang-ko">과정도 함께 남깁니다.</span>
      <span class="lang-en">The process stays in frame.</span>
    </h3>
  </div>
  <div class="image-wheel__stage" data-wheel-stage aria-live="off">
    <p class="image-wheel__fallback"><a href="Img/1.jpg">사진 기록 보기</a></p>
  </div>
  <label class="image-wheel__scrubber">
    <span class="lang-ko">이미지 휠 돌리기</span>
    <span class="lang-en">Rotate image wheel</span>
    <input type="range" min="0" max="1000" value="0" step="1" data-wheel-slider>
  </label>
  <p class="image-wheel__status" data-wheel-status aria-live="polite"></p>
</div>
```

- [ ] **Step 4: Refactor the lightbox into a reusable page interface**

Set `window.portfolioLightbox = { open, close }`. `open(image, trigger)` accepts `{ large, alt, caption }`, stores the triggering button, updates `src` and `alt`, and dispatches `portfolio:lightbox-open`. `close()` clears the source after the transition, restores trigger focus, and dispatches `portfolio:lightbox-close`.

- [ ] **Step 5: Implement manifest fallback and wheel rendering**

`mount()` first requests `remoteUrl` when non-empty, validates it with `normalizeManifest`, and falls back to `fallbackUrl` on fetch errors or an empty normalized array. Render every photo as:

```html
<button class="image-wheel__item" type="button" aria-label="확대: 군중 밀도 분석 시스템 실행 화면">
  <img src="Img/gallery/6.webp" alt="" width="800" height="520" loading="lazy" decoding="async">
  <span>군중 밀도 분석 시스템 실행 화면</span>
</button>
```

Keep semantic alt text on the button label and decorative `alt=""` on the nested image to prevent duplicate announcements.

- [ ] **Step 6: Implement synchronized automatic, slider, drag, and pause behavior**

Use `requestAnimationFrame` with elapsed time capped at 50ms and automatic speed `0.000018` progress units per millisecond. Maintain pause reasons in `Set<string>` using exact keys: `hover`, `focus`, `manual`, `drag`, `lightbox`, `offscreen`, `hidden`, `reduced-motion`. Update all item transforms and slider value from one `render(progress)` function.

Pointer drag starts after 5px movement; on pointerup, open the item only when movement stayed below the threshold. Slider `input` adds `manual`; `change` removes it after 1200ms. `mouseenter`/`mouseleave`, `focusin`/`focusout`, `visibilitychange`, IntersectionObserver, and portfolio lightbox events add and remove their respective keys.

- [ ] **Step 7: Add one unit test for zero-item and one-item rendering safeguards**

```js
test('shouldAnimate never runs an empty or one-image wheel', () => {
  assert.equal(shouldAnimate(new Set(), false, 0), false);
  assert.equal(shouldAnimate(new Set(), false, 1), false);
});
```

- [ ] **Step 8: Run unit and manual interaction checks**

Run: `node --test tests/gallery-wheel.test.js`

Expected: all tests PASS.

Open the page and verify: automatic rotation, hover pause, range input, pointer drag, click enlargement, Escape close, and restored focus.

- [ ] **Step 9: Commit the working local wheel**

```bash
git add gallery-wheel.js tests/gallery-wheel.test.js gallery.json Img/gallery index.html script.js
git commit -m "feat: replace gallery grid with interactive image wheel"
```

### Task 3: Restructure the page and update selected projects

**Files:**
- Modify: `index.html`
- Copy: `/Users/sungsuhan/Downloads/bloub-squircle-excite-rouge.gif` to `Img/bloub-rouge.gif`

**Interfaces:**
- Produces markup hooks consumed by `bloub.js`: `#siteLoader`, `#heroBloub`, `[data-bloub-eye]`, `[data-project-focus]`
- Preserves hooks consumed by `script.js`: `#header`, `#navToggle`, `#navMenu`, `.nav__link`, language buttons, contact form, video controls, and back-to-top button
- Preserves hook consumed by `gallery-wheel.js`: `#imageWheel`

- [ ] **Step 1: Copy the supplied Bloub GIF into the repository**

Run:

```bash
cp /Users/sungsuhan/Downloads/bloub-squircle-excite-rouge.gif Img/bloub-rouge.gif
file Img/bloub-rouge.gif
```

Expected: GIF 89a, 320×320.

- [ ] **Step 2: Add the first-session loader and accessible skip behavior**

```html
<div class="site-loader" id="siteLoader" role="status" aria-label="포트폴리오 불러오는 중">
  <img src="Img/bloub-rouge.gif" width="160" height="160" alt="">
  <span>SUHAN SUNG · PORTFOLIO 2026</span>
</div>
```

The loader is placed immediately after `<body>` and remains content-independent; `bloub.js` removes its active state within 1200ms even when the image errors.

- [ ] **Step 3: Replace the astronaut card with the interactive hero Bloub**

```html
<div class="bloub" id="heroBloub" aria-hidden="true">
  <div class="bloub__body">
    <span class="bloub__eye"><i data-bloub-eye></i></span>
    <span class="bloub__eye"><i data-bloub-eye></i></span>
  </div>
  <span class="bloub__note">CURIOUS BY DEFAULT</span>
</div>
```

Keep the character `aria-hidden` because the surrounding hero copy communicates identity and purpose.

- [ ] **Step 4: Rewrite the hero hierarchy without changing contact destinations**

Use the Korean thesis “물리적인 세계를 이해하는 AI를 만듭니다.” and English “I build AI that understands the physical world.” Keep Suhan Sung, Kangwon National University, AI Convergence, project CTA, email CTA, GitHub, Instagram, and bilingual switch.

- [ ] **Step 5: Simplify the supporting section hierarchy while preserving bilingual content**

Keep all verified biography facts, education, awards, email, social destinations, skill names, and video sources. Shorten the visible About introduction to three paragraphs per language, regroup Skills under `AI / Vision`, `Physical Computing`, and `Product Building`, rename Photo & Video to `Field Notes`, and reduce Contact to one direct invitation plus the existing name/message mailto form. Remove duplicated section subtitles and decorative icons that repeat visible labels.

- [ ] **Step 6: Reorder the project section into featured and archive groups**

Featured order and labels:

1. Brave Tylenol — `LATEST · 2026`
2. PilloSuffer — `AWARDED · 2026`
3. Mask R-CNN Reproduction — `RESEARCH · 2026`
4. Code Buddy — `BUILT · 2026`

Add `data-project-focus` to every featured card. Use the verified descriptions and evidence from the spec. Preserve the existing PilloSuffer award markup exactly while moving it. Move drone tourism, Eyes-Road, Pill Good, and Signature MK1 into the compact archive with every existing link and award retained.

- [ ] **Step 7: Update document metadata and load the new assets in order**

```html
<link rel="stylesheet" href="style.css?v=4">
<link rel="stylesheet" href="redesign.css?v=1">
<script src="script.js"></script>
<script src="gallery-wheel.js"></script>
<script src="bloub.js"></script>
```

Use title `Suhan Sung — AI · Computer Vision · Physical AI` and update Open Graph description to mention current medical AI and computer vision work.

- [ ] **Step 8: Validate HTML structure before styling**

Run:

```bash
python3 - <<'PY'
from html.parser import HTMLParser
HTMLParser().feed(open('index.html', encoding='utf-8').read())
print('HTML parse OK')
PY
```

Expected: `HTML parse OK` and no exception.

- [ ] **Step 9: Commit the semantic page restructure**

```bash
git add index.html Img/bloub-rouge.gif
git commit -m "feat: restructure portfolio around current work"
```

### Task 4: Apply the Dusty Interaction Lab system and Bloub behavior

**Files:**
- Create: `redesign.css`
- Create: `bloub.js`
- Modify: `style.css` only for rules proven obsolete after browser inspection
- Modify: `index.html` for focusable controls or missing labels discovered during styling

**Interfaces:**
- Consumes: `#siteLoader`, `#heroBloub`, `[data-bloub-eye]`, `[data-project-focus]`
- Produces CSS custom properties on `#heroBloub`: `--gaze-x`, `--gaze-y`, `--bloub-target-x`, `--bloub-target-y`
- Produces body class: `.is-loaded`

- [ ] **Step 1: Define the visual tokens and page foundation in `redesign.css`**

```css
body.portfolio-redesign {
  --dust-paper: #d7d4cb;
  --paper-highlight: #e7e4dc;
  --graphite: #191a17;
  --graphite-soft: #5f605a;
  --bloub-rouge: #ef463d;
  --rouge-deep: #a72e2a;
  --paper-rule: rgba(25, 26, 23, .18);
  --font-display: "Archivo Black", "Arial Black", sans-serif;
  --font-body: "IBM Plex Sans KR", "Apple SD Gothic Neo", sans-serif;
  --font-mono: "IBM Plex Mono", "SFMono-Regular", monospace;
  background: var(--dust-paper);
  color: var(--graphite);
}
```

Add one fixed, pointer-transparent noise overlay using an inline SVG turbulence data URI at low opacity. Remove visible gradients and glass blur from the redesigned surfaces.

- [ ] **Step 2: Implement asymmetric hero, ruled sections, and evidence-led project cards**

Use a maximum content width of 1280px, a two-column hero at widths ≥900px, and a single column below. Project cards use flat paper surfaces, 1px rules, square-to-small radii, and one rouge status detail. Do not reintroduce decorative glow, glass, or pill-shaped navigation.

- [ ] **Step 3: Implement the image-wheel geometry presentation**

The stage is `position: relative`, `overflow: hidden`, and `min-height: clamp(400px, 58vw, 700px)`. Every item starts centered and receives JS variables:

```css
.image-wheel__item {
  position: absolute;
  left: 50%;
  top: 50%;
  width: clamp(150px, 22vw, 300px);
  transform:
    translate(-50%, -50%)
    translate(calc(var(--wheel-x) * 1%), calc(var(--wheel-y) * 1%))
    rotate(calc(var(--wheel-rotation) * 1deg))
    scale(var(--wheel-scale));
  opacity: var(--wheel-opacity);
  z-index: var(--wheel-z);
}
```

Use 16:11 cards with 16–28px corners and subtle paper-toned shadow. The slider is visually integrated as a thin track with a rouge thumb but remains a native range input.

- [ ] **Step 4: Implement the loader, Bloub body, gaze, and blink scheduling**

`bloub.js` uses guarded session storage key `portfolio-loader-seen`. Pointer movement maps the viewport vector from the character center to clamped eye offsets of ±12px x and ±8px y. Featured card `pointerenter` and `focusin` temporarily target that card center. Blink delays use `4000 + Math.random() * 5000`; reduced motion disables scheduled animation.

- [ ] **Step 5: Add accessibility and motion rules**

```css
:focus-visible { outline: 3px solid var(--rouge-deep); outline-offset: 4px; }

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

Ensure `aria-expanded` updates on the mobile navigation toggle and visible focus is not clipped by wheel overflow.

- [ ] **Step 6: Inspect desktop and mobile screenshots and remove one unnecessary decorative treatment**

Capture 1440×1000 and 390×844 screenshots. Check hero fold, Korean line breaks, project status hierarchy, wheel overflow, slider reachability, gallery card readability, and contact form contrast. Remove any accent rule, badge, shadow, or animation that competes with the Bloub signature.

- [ ] **Step 7: Run syntax and unit checks**

Run:

```bash
node --check script.js
node --check gallery-wheel.js
node --check bloub.js
node --test tests/gallery-wheel.test.js
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit the finished visual system**

```bash
git add redesign.css bloub.js style.css index.html
git commit -m "feat: apply Bloub-led dusty portfolio design"
```

### Task 5: Add the Cloudflare Images automatic-gallery adapter

**Files:**
- Create: `cloudflare/gallery-worker.js`
- Create: `cloudflare/wrangler.example.jsonc`
- Create: `cloudflare/README.md`
- Modify: `gallery-wheel.js`
- Test: `tests/gallery-wheel.test.js`

**Interfaces:**
- Produces HTTP: `GET /gallery.json -> { images: GalleryImage[] }`
- Consumes binding: `env.IMAGES.hosted.list({ perPage, sortOrder })`
- Consumes variables: `env.DELIVERY_ACCOUNT`, `env.ALLOWED_ORIGIN`
- Filters: Cloudflare image `filename` beginning with `gallery-`
- Produces variants: `${deliveryBase}/${image.id}/wheel` and `${deliveryBase}/${image.id}/lightbox`

- [ ] **Step 1: Write a failing normalization test for a Cloudflare-shaped payload**

```js
test('normalizeManifest accepts the Worker gallery schema', () => {
  const images = normalizeManifest({ images: [{
    id: 'abc',
    thumb: 'https://imagedelivery.net/account/abc/wheel',
    large: 'https://imagedelivery.net/account/abc/lightbox',
    alt: 'Drone demo',
    caption: 'Drone demo',
    uploaded: '2026-08-23T00:00:00Z'
  }] });
  assert.equal(images[0].id, 'abc');
});
```

- [ ] **Step 2: Implement the Worker list and manifest mapping**

```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.pathname !== '/gallery.json') {
      return new Response('Not found', { status: 404 });
    }
    const result = await env.IMAGES.hosted.list({ perPage: 1000, sortOrder: 'desc' });
    const deliveryBase = `https://imagedelivery.net/${env.DELIVERY_ACCOUNT}`;
    const images = result.images
      .filter(image => image.filename && image.filename.startsWith('gallery-'))
      .map(image => ({
        id: image.id,
        thumb: `${deliveryBase}/${image.id}/wheel`,
        large: `${deliveryBase}/${image.id}/lightbox`,
        alt: String(image.metadata?.alt || image.filename.replace(/^gallery-/, '').replace(/[-_]+/g, ' ').replace(/\.[^.]+$/, '')),
        caption: String(image.metadata?.caption || ''),
        uploaded: image.uploaded
      }));
    return Response.json({ images }, {
      headers: {
        'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
        'Cache-Control': 'public, max-age=300, s-maxage=300'
      }
    });
  }
};
```

Wrap list failures in a `502` JSON response with `Cache-Control: no-store`; never return secrets or upstream bodies.

- [ ] **Step 3: Add credential-free Wrangler configuration**

Define Worker name `suhan-portfolio-gallery`, compatibility date `2026-08-23`, Images binding name `IMAGES`, and `[vars]` placeholders only for public delivery account hash and allowed portfolio origin. Do not include account ID, API token, or secret.

- [ ] **Step 4: Document the exact Cloudflare setup**

Document:

1. Create public variants `wheel` (cover, 800×600, metadata none) and `lightbox` (scale-down, 1800×1800, metadata copyright).
2. Bind Hosted Images as `IMAGES` to the Worker.
3. Set `DELIVERY_ACCOUNT` and `ALLOWED_ORIGIN` as Worker variables.
4. Deploy with Wrangler.
5. Set `data-remote-url` in `index.html` to the deployed `/gallery.json` URL.
6. Upload dashboard files with the `gallery-` filename prefix.
7. Confirm a new upload appears within five minutes.
8. Roll back instantly by clearing `data-remote-url`; local `gallery.json` remains active.

- [ ] **Step 5: Run checks without requiring Cloudflare credentials**

Run:

```bash
node --check cloudflare/gallery-worker.js
node --test tests/gallery-wheel.test.js
rg -n "API_TOKEN|X-Auth-Key|cloudflarestorage.com" cloudflare index.html gallery-wheel.js
```

Expected: syntax/tests pass; the secret scan finds documentation labels only and no credential value.

- [ ] **Step 6: Commit the optional hosted source**

```bash
git add cloudflare gallery-wheel.js tests/gallery-wheel.test.js
git commit -m "feat: add Cloudflare Images gallery adapter"
```

### Task 6: Verify the complete portfolio story and performance

**Files:**
- Modify only files implicated by verified defects
- Update: `docs/superpowers/plans/2026-08-23-bloub-portfolio-redesign.md` checkbox state during execution

**Interfaces:**
- Verifies all prior task interfaces together; produces no new runtime API.

- [ ] **Step 1: Run the full static check suite**

Run:

```bash
node --check script.js
node --check gallery-wheel.js
node --check bloub.js
node --check cloudflare/gallery-worker.js
node --test tests/gallery-wheel.test.js
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 2: Serve the site over HTTP**

Run: `python3 -m http.server 4173`

Expected: `http://127.0.0.1:4173/` returns the portfolio and `gallery.json` returns JSON.

- [ ] **Step 3: Verify desktop behavior at 1440×1000**

Check header navigation, KO/EN persistence, hero loader once per session, Bloub gaze and blink, every featured project link, archive links, wheel auto-rotation, hover pause, slider synchronization, drag threshold, lightbox focus restoration, videos, mailto form, and back-to-top button.

- [ ] **Step 4: Verify mobile behavior at 390×844**

Check menu `aria-expanded`, first-viewport hero hierarchy, no page horizontal overflow, touch drag, slider reachability, wheel image size/depth, lightbox close control, single-column project layout, gallery fallback, and contact form.

- [ ] **Step 5: Verify keyboard-only and reduced-motion behavior**

Navigate every control with Tab/Shift+Tab; confirm visible focus, focus-pause, Enter/Space image opening, Escape closing, and trigger focus restoration. Emulate reduced motion and confirm the loader is a static fade, Bloub gaze/blink stops, wheel automatic motion stops, and manual slider/lightbox still work.

- [ ] **Step 6: Verify image network behavior**

On a fresh mobile load, confirm wheel requests only `Img/gallery/*.webp`. Confirm no `Img/N.jpg`, `Img/N.jpeg`, or `Img/6.png` large file is requested until its image button opens the lightbox. Record total wheel-thumbnail transfer and ensure it is lower than serving all current originals.

- [ ] **Step 7: Review changes and repository state**

Run:

```bash
git status --short
git diff --stat HEAD~5..HEAD
git log -6 --oneline
```

Confirm unrelated user files were not changed, PilloSuffer award content remains, no credential was committed, and generated screenshots are outside the repository.

- [ ] **Step 8: Commit only verified defect fixes, if any**

```bash
git add index.html style.css redesign.css script.js gallery-wheel.js bloub.js gallery.json cloudflare/gallery-worker.js
git commit -m "fix: polish responsive portfolio interactions"
```

Skip this commit when verification required no code change.
