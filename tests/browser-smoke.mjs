import fs from 'node:fs/promises';
import path from 'node:path';

const debugPort = process.env.CHROME_DEBUG_PORT || '9223';
const previewUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:4173/?preview=1';
const screenshotDir = process.env.SCREENSHOT_DIR || '';
const pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
const page = pages.find((entry) => entry.type === 'page' && entry.url.startsWith('http'));
if (!page) throw new Error('No debuggable preview page found.');

const socket = new WebSocket(page.webSocketDebuggerUrl);
let commandId = 0;
const pending = new Map();

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

function call(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, timeout = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function navigate(width, height) {
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  const separator = previewUrl.includes('?') ? '&' : '?';
  await call('Page.navigate', { url: `${previewUrl}${separator}browser_smoke=${Date.now()}` });
  await waitFor("document.readyState === 'complete' && document.querySelectorAll('.image-wheel__item').length === 15");
  await new Promise((resolve) => setTimeout(resolve, 500));
}

async function screenshot(filename) {
  if (!screenshotDir) return;
  await fs.mkdir(screenshotDir, { recursive: true });
  const result = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await fs.writeFile(path.join(screenshotDir, filename), Buffer.from(result.data, 'base64'));
}

await call('Page.enable');
await call('Runtime.enable');
await navigate(1440, 1000);

const initial = await evaluate(`(() => ({
  count: document.querySelectorAll('.image-wheel__item').length,
  bloubTag: document.querySelector('[data-original-bloub]')?.tagName || '',
  bloubEyeCount: document.querySelectorAll('[data-bloub-eye]').length,
  projectShowcases: document.querySelectorAll('.project-showcase').length,
  projectArchiveItems: document.querySelectorAll('.project-archive__item').length,
  projectOrder: [...document.querySelectorAll('.project-sequence [data-project-name]')].map((project) => project.dataset.projectName),
  projectAwards: [...document.querySelectorAll('.project-award-badge')].map((badge) => (badge.closest('[data-project-name]')?.dataset.projectName || '') + ':' + badge.textContent.trim()),
  projectAwardHeights: [...document.querySelectorAll('.project-award-badge')].map((badge) => badge.getBoundingClientRect().height),
  interestOrder: [...document.querySelectorAll('.interest-tag .lang-ko')].map((label) => label.textContent.trim()),
  interestIcons: [...document.querySelectorAll('.interest-tag > i')].map((icon) => icon.className),
  awardTarget: document.querySelector('.stat-number')?.getAttribute('data-target') || '',
  drone: (() => {
    const project = document.querySelector('[data-project-name="drone"]');
    const slider = project?.querySelector('[data-project-slider]');
    const slides = [...(project?.querySelectorAll('[data-project-slide]') || [])];
    const images = [...(project?.querySelectorAll('[data-project-slide] img') || [])];
    const iframe = slides[0]?.querySelector('iframe');
    const media = project?.querySelector('.project-showcase__media');
    return {
      slides: slides.length,
      mainVideo: iframe?.getAttribute('src') || '',
      imageSources: images.map((image) => image.getAttribute('src') || ''),
      mediaRadius: media ? parseFloat(getComputedStyle(media).borderTopLeftRadius) || 0 : 0,
      counter: slider?.querySelector('[data-project-slider-count]')?.textContent.trim() || '',
      facts: project?.querySelector('.project-showcase__facts')?.textContent.replace(/\s+/g, ' ').trim() || '',
    };
  })(),
  codeBuddy: (() => {
    const project = document.querySelector('[data-project-name="code-buddy"]');
    const media = project?.querySelector('.project-showcase__media');
    const icon = media?.querySelector('img');
    return {
      isShowcase: project?.classList.contains('project-showcase') || false,
      iconSrc: icon?.getAttribute('src') || '',
      iconLoaded: Boolean(icon?.complete && icon.naturalWidth > 0),
      iconWidth: icon?.getBoundingClientRect().width || 0,
      mediaRadius: media ? parseFloat(getComputedStyle(media).borderTopLeftRadius) || 0 : 0,
    };
  })(),
  pillosufferSlides: document.querySelectorAll('[data-project-name="pillosuffer"] [data-project-slide]').length,
  pillosufferMainSrc: document.querySelector('[data-project-name="pillosuffer"] [data-project-slide] img')?.getAttribute('src') || '',
  pillosufferRadius: parseFloat(getComputedStyle(document.querySelector('[data-project-name="pillosuffer"] .project-showcase__media')).borderTopLeftRadius) || 0,
  maskProjectPresent: document.body.textContent.includes('Mask R-CNN Reproduction'),
  brokenProjectMedia: [...document.querySelectorAll('.project-showcase__media img')].filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.currentSrc),
  bodyWidth: document.body.scrollWidth,
  viewportWidth: innerWidth,
  originalsLoaded: performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => /\\/Img\\/(?:[1-9]|1[0-5])\\.(?:jpg|jpeg|png)(?:$|\\?)/.test(name)),
  brokenImages: [...document.images].filter((image) => image.currentSrc && image.complete && image.naturalWidth === 0).map((image) => image.currentSrc),
}))()`);

const bloubPointerMotion = await evaluate(`(async () => {
  const svg = document.querySelector('svg[data-bloub-gaze]');
  if (!svg) return { mounted: false, center: [], nearRight: [], farRight: [], rest: [], mode: '' };
  const eyes = [...svg.querySelectorAll('[data-bloub-eye]')];
  const rect = svg.getBoundingClientRect();
  const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const sample = async (x, y, frames = 18) => {
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerType: 'mouse' }));
    for (let i = 0; i < frames; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
    return eyes.map((eye) => eye.getAttribute('transform') || '');
  };
  const centered = await sample(center.x, center.y);
  const nearRight = await sample(center.x + innerWidth * .2, center.y);
  const farRight = await sample(center.x + innerWidth * .38, center.y);
  document.dispatchEvent(new Event('pointerleave'));
  for (let i = 0; i < 32; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
  return {
    mounted: true,
    center: centered,
    nearRight,
    farRight,
    rest: eyes.map((eye) => eye.getAttribute('transform') || ''),
    mode: svg.dataset.look || '',
  };
})()`);

await screenshot('portfolio-hero-desktop-fixed.png');
await evaluate(`(() => {
  document.documentElement.style.scrollBehavior = 'auto';
  const projects = document.getElementById('projects');
  window.scrollTo(0, projects.offsetTop + 120);
  return true;
})()`);
await new Promise((resolve) => setTimeout(resolve, 800));
await screenshot('portfolio-projects-desktop-fixed.png');
const droneSlider = await evaluate(`(() => {
  const project = document.querySelector('[data-project-name="drone"]');
  const next = project.querySelector('[data-project-slider-next]');
  next?.click();
  const slides = [...project.querySelectorAll('[data-project-slide]')];
  return {
    activeIndex: slides.findIndex((slide) => slide.classList.contains('is-active')),
    counter: project.querySelector('[data-project-slider-count]')?.textContent.trim() || '',
  };
})()`);
const droneLightbox = await evaluate(`(() => {
  const project = document.querySelector('[data-project-name="drone"]');
  project.querySelector('.project-slider__slide.is-active')?.click();
  const box = document.getElementById('lightbox');
  const result = { open: box.classList.contains('open'), src: document.getElementById('lightboxImg').getAttribute('src') || '' };
  if (result.open) window.portfolioLightbox.close();
  return result;
})()`);
await evaluate(`(() => {
  const project = document.querySelector('[data-project-name="signature-mk1"]') || document.querySelectorAll('.project-showcase')[2];
  window.scrollTo(0, project.getBoundingClientRect().top + scrollY - 100);
  return true;
})()`);
await new Promise((resolve) => setTimeout(resolve, 800));
await screenshot('portfolio-projects-media-desktop-fixed.png');
await evaluate(`(() => {
  const project = document.querySelector('[data-project-name="pillosuffer"]');
  window.scrollTo(0, project.getBoundingClientRect().top + scrollY - 100);
  return true;
})()`);
await new Promise((resolve) => setTimeout(resolve, 500));
await screenshot('portfolio-pillosuffer-main-desktop-fixed.png');
const pillosufferSlider = await evaluate(`(() => {
  const project = document.querySelector('[data-project-name="pillosuffer"]');
  const next = project.querySelector('[data-project-slider-next]');
  if (!next) return { advanced: false, activeIndex: -1, counter: '' };
  next.click();
  return {
    advanced: true,
    activeIndex: [...project.querySelectorAll('[data-project-slide]')].findIndex((slide) => slide.classList.contains('is-active')),
    counter: project.querySelector('[data-project-slider-count]')?.textContent.trim() || '',
  };
})()`);
await new Promise((resolve) => setTimeout(resolve, 500));
await screenshot('portfolio-pillosuffer-slider-desktop-fixed.png');
const pillosufferLightbox = await evaluate(`(() => {
  const project = document.querySelector('[data-project-name="pillosuffer"]');
  project.querySelector('.project-slider__slide.is-active')?.click();
  const box = document.getElementById('lightbox');
  const result = { open: box.classList.contains('open'), src: document.getElementById('lightboxImg').getAttribute('src') || '' };
  if (result.open) window.portfolioLightbox.close();
  return result;
})()`);
const pillosufferAccessibleControls = await evaluate(`(() => {
  const project = document.querySelector('[data-project-name="pillosuffer"]');
  const slider = project.querySelector('[data-project-slider]');
  const slides = [...project.querySelectorAll('[data-project-slide]')];
  slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  const keyboardIndex = slides.findIndex((slide) => slide.classList.contains('is-active'));
  slider.dispatchEvent(new PointerEvent('pointerdown', { clientX: 280, bubbles: true }));
  slider.dispatchEvent(new PointerEvent('pointerup', { clientX: 180, bubbles: true }));
  const swipeIndex = slides.findIndex((slide) => slide.classList.contains('is-active'));
  return { keyboardIndex, swipeIndex };
})()`);
await evaluate(`(() => {
  const project = document.querySelector('[data-project-name="code-buddy"]');
  window.scrollTo(0, project.getBoundingClientRect().top + scrollY - 100);
  return true;
})()`);
await new Promise((resolve) => setTimeout(resolve, 500));
await screenshot('portfolio-code-buddy-desktop-fixed.png');
const codeBuddyIconLoaded = await evaluate(`(() => {
  const icon = document.querySelector('[data-project-name="code-buddy"] .project-showcase__media img');
  return Boolean(icon?.complete && icon.naturalWidth > 0);
})()`);
await evaluate(`(() => {
  const stage = document.querySelector('[data-wheel-stage]');
  window.scrollTo(0, stage.getBoundingClientRect().top + scrollY - 170);
  return true;
})()`);
await new Promise((resolve) => setTimeout(resolve, 150));

const stageCenter = await evaluate(`(() => {
  const rect = document.querySelector('[data-wheel-stage]').getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
})()`);
await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: stageCenter.x, y: stageCenter.y });
const beforePause = await evaluate("Number(document.querySelector('[data-wheel-slider]').value)");
await new Promise((resolve) => setTimeout(resolve, 350));
const afterPause = await evaluate("Number(document.querySelector('[data-wheel-slider]').value)");

await evaluate(`(() => {
  const slider = document.querySelector('[data-wheel-slider]');
  slider.value = '500';
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  slider.dispatchEvent(new Event('change', { bubbles: true }));
  return slider.value;
})()`);
const manualValue = await evaluate("Number(document.querySelector('[data-wheel-slider]').value)");
await screenshot('portfolio-wheel-desktop-fixed.png');

await evaluate("document.querySelector('.image-wheel__item').click(); true");
await waitFor("document.getElementById('lightbox').classList.contains('open')");
const lightbox = await evaluate(`(() => ({
  open: document.getElementById('lightbox').classList.contains('open'),
  src: document.getElementById('lightboxImg').getAttribute('src'),
}))()`);
await screenshot('portfolio-lightbox-fixed.png');
await evaluate("window.portfolioLightbox.close(); true");

await navigate(390, 844);
const mobileBloubGaze = await evaluate(`(async () => {
  const svg = document.querySelector('svg[data-bloub-gaze]');
  if (!svg) return { mounted: false, before: [], after: [] };
  const eyes = [...svg.querySelectorAll('[data-bloub-eye]')];
  const before = eyes.map((eye) => eye.getAttribute('transform') || '');
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: innerWidth, clientY: 0 }));
  for (let i = 0; i < 5; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
  return { mounted: true, before, after: eyes.map((eye) => eye.getAttribute('transform') || '') };
})()`);
const mobile = await evaluate(`(() => ({
  bodyWidth: document.body.scrollWidth,
  viewportWidth: innerWidth,
  legacyDisplay: getComputedStyle(document.querySelector('.gallery-grid--legacy')).display,
  heroRight: document.querySelector('.hero__title').getBoundingClientRect().right,
}))()`);
await screenshot('portfolio-hero-mobile-fixed.png');
await evaluate(`(() => {
  document.documentElement.style.scrollBehavior = 'auto';
  const project = document.querySelector('[data-project-name="drone"]') || document.querySelectorAll('.project-showcase')[1];
  window.scrollTo(0, project.getBoundingClientRect().top + scrollY - 72);
  return true;
})()`);
await new Promise((resolve) => setTimeout(resolve, 800));
await screenshot('portfolio-projects-mobile-fixed.png');
await evaluate(`(() => {
  const project = document.querySelector('[data-project-name="pillosuffer"]');
  window.scrollTo(0, project.getBoundingClientRect().top + scrollY - 72);
  return true;
})()`);
await new Promise((resolve) => setTimeout(resolve, 500));
await screenshot('portfolio-pillosuffer-slider-mobile-fixed.png');
await evaluate(`(() => {
  document.documentElement.style.scrollBehavior = 'auto';
  const stage = document.querySelector('[data-wheel-stage]');
  window.scrollTo(0, stage.getBoundingClientRect().top + scrollY - 120);
  return true;
})()`);
await new Promise((resolve) => setTimeout(resolve, 150));
await screenshot('portfolio-wheel-mobile-fixed.png');

const checks = {
  fifteenImages: initial.count === 15,
  usesInlineBloubSvg: initial.bloubTag === 'svg' && initial.bloubEyeCount === 2 && bloubPointerMotion.mounted,
  bloubTracksContinuously: bloubPointerMotion.nearRight.length === 2
    && JSON.stringify(bloubPointerMotion.center) !== JSON.stringify(bloubPointerMotion.nearRight)
    && JSON.stringify(bloubPointerMotion.nearRight) !== JSON.stringify(bloubPointerMotion.farRight),
  bloubReturnsToLivingRest: bloubPointerMotion.mode === 'rest'
    && JSON.stringify(bloubPointerMotion.rest) !== JSON.stringify(bloubPointerMotion.farRight),
  bloubStaysCenteredOnMobile: mobileBloubGaze.mounted
    && JSON.stringify(mobileBloubGaze.before) === JSON.stringify(mobileBloubGaze.after),
  fiveProjectShowcases: initial.projectShowcases === 5,
  oneProjectArchiveItem: initial.projectArchiveItems === 1,
  requestedProjectOrder: JSON.stringify(initial.projectOrder) === JSON.stringify(['drone', 'pillosuffer', 'brave-tylenol', 'code-buddy', 'signature-mk1', 'pill-good']),
  awardBadgesVisible: JSON.stringify(initial.projectAwards) === JSON.stringify(['drone:대상', 'drone:최우수상', 'pillosuffer:우수상 · 장려상']),
  awardBadgesAreCompact: initial.projectAwardHeights.length === 3 && Math.max(...initial.projectAwardHeights) <= 36,
  interestsUseRequestedOrder: JSON.stringify(initial.interestOrder) === JSON.stringify(['AI/머신러닝', '컴퓨터 비전', '웹 개발', '로보틱스', '환경 지속가능성']),
  interestsUseBrainAndRobot: initial.interestIcons[0]?.includes('fa-brain') && initial.interestIcons[3]?.includes('fa-robot'),
  twelveAwardsShown: initial.awardTarget === '12',
  droneHasVideoFirstGallery: initial.drone.slides === 3 && /youtube\.com\/embed\/WXHzLcVCvhw/.test(initial.drone.mainVideo) && initial.drone.counter === '1 / 3',
  droneUsesRequestedPhotos: JSON.stringify(initial.drone.imageSources) === JSON.stringify(['Img/projects/drone-award-2024.webp', 'Img/projects/drone-graduation-panel.webp']),
  droneGalleryUsesAppleRounding: initial.drone.mediaRadius >= 24,
  droneAwardsReplaceFirstPlace: initial.projectAwards.includes('drone:대상') && initial.projectAwards.includes('drone:최우수상') && !initial.drone.facts.includes('1st') && !initial.drone.facts.includes('1위'),
  droneSliderAdvances: droneSlider.activeIndex === 1 && droneSlider.counter === '2 / 3',
  dronePhotoExpands: droneLightbox.open && /drone-award-2024\.webp$/.test(droneLightbox.src),
  codeBuddyUsesGithubIconCard: initial.codeBuddy.isShowcase && initial.codeBuddy.iconSrc === 'Img/codebuddy_icon.png' && codeBuddyIconLoaded && initial.codeBuddy.iconWidth >= 96 && initial.codeBuddy.mediaRadius >= 24,
  pillosufferHasThreeSlides: initial.pillosufferSlides === 3,
  pillosufferAppIsMain: initial.pillosufferMainSrc === 'Img/projects/pillosuffer-app-home.webp',
  pillosufferUsesAppleRounding: initial.pillosufferRadius >= 24,
  pillosufferSliderAdvances: pillosufferSlider.advanced && pillosufferSlider.activeIndex === 1 && pillosufferSlider.counter === '2 / 3',
  pillosufferPhotoExpands: pillosufferLightbox.open && /pillosuffer-award-2026\.webp$/.test(pillosufferLightbox.src),
  pillosufferKeyboardAndSwipe: pillosufferAccessibleControls.keyboardIndex === 0 && pillosufferAccessibleControls.swipeIndex === 1,
  maskProjectRemoved: initial.maskProjectPresent === false,
  projectMediaLoads: initial.brokenProjectMedia.length === 0,
  noDesktopOverflow: initial.bodyWidth <= initial.viewportWidth,
  originalsDeferred: initial.originalsLoaded.length === 0,
  noBrokenImages: initial.brokenImages.length === 0,
  hoverPauses: beforePause === afterPause,
  manualSlider: manualValue === 500,
  lightboxOpens: lightbox.open && /^Img\//.test(lightbox.src),
  noMobileOverflow: mobile.bodyWidth === mobile.viewportWidth,
  legacyGridHidden: mobile.legacyDisplay === 'none',
  mobileHeadlineFits: mobile.heroRight <= mobile.viewportWidth + 1,
};

console.log(JSON.stringify({ checks, details: { initial, bloubPointerMotion, mobileBloubGaze, droneSlider, droneLightbox, codeBuddyIconLoaded, pillosufferSlider, pillosufferLightbox, pillosufferAccessibleControls, beforePause, afterPause, manualValue, lightbox, mobile } }, null, 2));
socket.close();
if (Object.values(checks).some((value) => value !== true)) process.exitCode = 1;
