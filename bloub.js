(function initializeBloubExperience() {
  const loader = document.getElementById('siteLoader');
  const bloub = document.getElementById('heroBloub');
  const sourceAsset = bloub?.querySelector('[data-original-bloub]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const compactLayout = window.matchMedia('(max-width: 767px)');

  function hasSeenLoader() {
    try { return sessionStorage.getItem('portfolio-loader-seen') === '1'; }
    catch (_) { return false; }
  }

  function rememberLoader() {
    try { sessionStorage.setItem('portfolio-loader-seen', '1'); }
    catch (_) { /* The experience still works when storage is unavailable. */ }
  }

  const finishLoading = () => {
    document.body.classList.add('is-loaded');
    loader?.setAttribute('aria-hidden', 'true');
    rememberLoader();
  };

  const previewMode = new URLSearchParams(window.location.search).has('preview');
  if (hasSeenLoader() || reducedMotion.matches || previewMode) {
    finishLoading();
  } else {
    window.setTimeout(finishLoading, 1050);
    loader?.querySelector('img')?.addEventListener('error', finishLoading, { once: true });
  }

  if (!sourceAsset || !window.BloubGaze) return;

  async function inlineSourceSvg() {
    const source = sourceAsset.getAttribute('src');
    if (!source) throw new Error('Bloub SVG source is missing');

    const response = await fetch(source);
    if (!response.ok) throw new Error(`Bloub SVG failed to load: ${response.status}`);
    const parsed = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
    if (parsed.querySelector('parsererror')) throw new Error('Bloub SVG could not be parsed');

    const svg = document.importNode(parsed.documentElement, true);
    svg.querySelector('style')?.remove();
    svg.classList.add('bloub__asset');
    svg.setAttribute('data-original-bloub', '');
    svg.setAttribute('data-bloub-gaze', '');
    svg.setAttribute('aria-label', sourceAsset.getAttribute('alt') || '빨간 Bloub 캐릭터');
    svg.setAttribute('focusable', 'false');
    svg.removeAttribute('width');
    svg.removeAttribute('height');

    const eyes = [svg.querySelector('.oeil0'), svg.querySelector('.oeil1')];
    if (eyes.some((eye) => !eye)) throw new Error('Bloub eye paths are missing');
    eyes.forEach((eye, index) => eye.setAttribute('data-bloub-eye', String(index)));
    sourceAsset.replaceWith(svg);
    return { svg, eyes };
  }

  function startGaze({ svg, eyes }) {
    const gaze = window.BloubGaze;
    let pointer = null;
    let current = { ...gaze.BASE_GAZE };
    let frame = 0;
    let lastTime = 0;

    const canAnimate = () => !reducedMotion.matches && !compactLayout.matches;

    const paint = (pose, lid = 1) => {
      gaze.eyeFrames(pose, lid).forEach((eyeFrame, index) => {
        eyes[index].setAttribute('d', eyeFrame.path);
        eyes[index].setAttribute('transform', eyeFrame.transform);
        eyes[index].setAttribute('opacity', String(eyeFrame.opacity));
      });
      svg.dataset.yaw = pose.yaw.toFixed(2);
      svg.dataset.pitch = pose.pitch.toFixed(2);
    };

    const targetFromPointer = () => {
      if (!pointer) return null;
      const bounds = svg.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return null;
      return gaze.lookTarget(
        (pointer.x - (bounds.left + bounds.width / 2)) / Math.max(1, window.innerWidth / 2),
        (pointer.y - (bounds.top + bounds.height / 2)) / Math.max(1, bounds.height / 2),
      );
    };

    const tick = (milliseconds) => {
      const time = milliseconds / 1000;
      const delta = lastTime ? Math.min(time - lastTime, .064) : 0;
      lastTime = time;

      if (!canAnimate()) {
        current = { ...gaze.BASE_GAZE };
        svg.dataset.look = 'rest';
        paint(current, 1);
        frame = 0;
        return;
      }

      const pointerTarget = targetFromPointer();
      const life = gaze.liveliness(time);
      const target = pointerTarget || {
        yaw: gaze.BASE_GAZE.yaw + life.dYaw,
        pitch: gaze.BASE_GAZE.pitch + life.dPitch,
        roll: gaze.BASE_GAZE.roll + life.dRoll,
      };
      current = gaze.easeGaze(current, target, delta);
      svg.dataset.look = pointerTarget ? 'tracking' : 'rest';
      paint(current, life.lid);
      frame = requestAnimationFrame(tick);
    };

    const followPointer = (event) => {
      if (event.pointerType === 'touch' || !canAnimate()) return;
      pointer = { x: event.clientX, y: event.clientY };
    };

    const releasePointer = () => {
      pointer = null;
      svg.dataset.look = 'rest';
    };

    const resetMotionMode = () => {
      releasePointer();
      current = { ...gaze.BASE_GAZE };
      lastTime = 0;
      if (frame) cancelAnimationFrame(frame);
      paint(current, 1);
      frame = canAnimate() ? requestAnimationFrame(tick) : 0;
    };

    window.addEventListener('pointermove', followPointer, { passive: true });
    window.addEventListener('blur', releasePointer);
    document.addEventListener('pointerleave', releasePointer);
    reducedMotion.addEventListener?.('change', resetMotionMode);
    compactLayout.addEventListener?.('change', resetMotionMode);
    resetMotionMode();
  }

  inlineSourceSvg().then(startGaze).catch(() => {
    // The supplied animated SVG remains visible as a resilient fallback.
    if (reducedMotion.matches) sourceAsset.setAttribute('loading', 'eager');
  });
})();
