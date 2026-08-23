(function initializeBloubExperience() {
  const loader = document.getElementById('siteLoader');
  const bloub = document.getElementById('heroBloub');
  const bloubAsset = bloub?.querySelector('[data-original-bloub]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const compactLayout = window.matchMedia('(max-width: 767px)');
  const centerSource = bloubAsset?.getAttribute('src') || '';
  const lookSources = {
    north: 'Img/bloub-look/north.svg',
    'north-east': 'Img/bloub-look/north-east.svg',
    east: 'Img/bloub-look/east.svg',
    'south-east': 'Img/bloub-look/south-east.svg',
    south: 'Img/bloub-look/south.svg',
    'south-west': 'Img/bloub-look/south-west.svg',
    west: 'Img/bloub-look/west.svg',
    'north-west': 'Img/bloub-look/north-west.svg',
  };

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

  if (!bloubAsset) return;

  bloubAsset.dataset.look = 'center';
  if (reducedMotion.matches) bloubAsset.setAttribute('loading', 'eager');

  const canTrackPointer = () => !reducedMotion.matches && !compactLayout.matches;
  const preloadedLooks = Object.values(lookSources).map((source) => {
    const image = new Image();
    image.decoding = 'async';
    image.src = source;
    return image;
  });

  let pendingPointer = null;
  let frame = 0;

  const setLook = (direction) => {
    const source = direction === 'center' ? centerSource : lookSources[direction];
    if (!source || bloubAsset.dataset.look === direction) return;
    bloubAsset.dataset.look = direction;
    bloubAsset.src = source;
  };

  const directionFromPointer = (clientX, clientY) => {
    const bounds = bloubAsset.getBoundingClientRect();
    const deltaX = clientX - (bounds.left + bounds.width / 2);
    const deltaY = clientY - (bounds.top + bounds.height / 2);
    if (Math.hypot(deltaX, deltaY) < Math.min(bounds.width, bounds.height) * .13) return 'center';

    const octant = (Math.round(Math.atan2(deltaY, deltaX) / (Math.PI / 4)) + 8) % 8;
    return ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'][octant];
  };

  const renderPointerLook = () => {
    frame = 0;
    if (!pendingPointer || !canTrackPointer()) return setLook('center');
    setLook(directionFromPointer(pendingPointer.x, pendingPointer.y));
  };

  const followPointer = (event) => {
    if (!canTrackPointer()) return setLook('center');
    pendingPointer = { x: event.clientX, y: event.clientY };
    if (!frame) frame = requestAnimationFrame(renderPointerLook);
  };

  const resetLook = () => {
    pendingPointer = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    setLook('center');
  };

  window.addEventListener('pointermove', followPointer, { passive: true });
  window.addEventListener('blur', resetLook);
  window.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget) resetLook();
  });
  reducedMotion.addEventListener?.('change', resetLook);
  compactLayout.addEventListener?.('change', resetLook);

  // Keep preload references alive for the lifetime of the page.
  bloub._lookAssets = preloadedLooks;
})();
