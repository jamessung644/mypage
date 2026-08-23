(function exposeGalleryWheel(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GalleryWheel = api;
})(typeof window !== 'undefined' ? window : globalThis, function buildGalleryWheelApi() {
  const DEFAULT_GEOMETRY = { radiusX: 40, radiusY: 16, depth: 0.22, tiltY: 90 };

  function normalizeProgress(value) {
    if (!Number.isFinite(value)) return 0;
    return ((value % 1) + 1) % 1;
  }

  function normalizeManifest(payload) {
    const list = payload && Array.isArray(payload.images) ? payload.images : [];
    return list
      .filter((image) => image && image.id && image.thumb && image.large)
      .map((image) => ({
        id: String(image.id),
        thumb: String(image.thumb),
        large: String(image.large),
        alt: String(image.alt || 'Portfolio gallery image'),
        caption: String(image.caption || ''),
        uploaded: String(image.uploaded || ''),
        width: Number(image.width) || 800,
        height: Number(image.height) || 600,
      }))
      .sort((a, b) => Date.parse(b.uploaded || 0) - Date.parse(a.uploaded || 0));
  }

  function calculateWheelFrame(index, count, progress, geometry = {}) {
    const radiusX = geometry.radiusX ?? DEFAULT_GEOMETRY.radiusX;
    const radiusY = geometry.radiusY ?? DEFAULT_GEOMETRY.radiusY;
    const depth = geometry.depth ?? DEFAULT_GEOMETRY.depth;
    const tiltY = geometry.tiltY ?? DEFAULT_GEOMETRY.tiltY;
    const angle = ((index / Math.max(count, 1)) + normalizeProgress(progress)) * Math.PI * 2;
    const fullTurn = Math.PI * 2;
    const frontOffset = ((angle - Math.PI / 2 + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
    const z = (Math.sin(angle) + 1) / 2;
    return {
      xPercent: Math.cos(angle) * radiusX,
      yPercent: Math.sin(angle) * radiusY,
      scale: 1 - depth + z * depth * 2,
      opacity: 0.44 + z * 0.56,
      rotationDeg: Math.cos(angle) * -3.5,
      rotationYDeg: (frontOffset / Math.PI) * tiltY,
      zIndex: Math.round(z * 100),
    };
  }

  function shouldAnimate(pauses, reducedMotion, itemCount) {
    return !reducedMotion && itemCount > 1 && pauses.size === 0;
  }

  async function fetchManifest(url) {
    if (!url) return [];
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Gallery request failed: ${response.status}`);
    return normalizeManifest(await response.json());
  }

  async function loadImages(remoteUrl, fallbackUrl) {
    if (remoteUrl) {
      try {
        const remote = await fetchManifest(remoteUrl);
        if (remote.length) return remote;
      } catch (error) {
        console.warn('Remote gallery unavailable; using local images.', error);
      }
    }
    return fetchManifest(fallbackUrl);
  }

  function mount(rootElement, options = {}) {
    if (!rootElement || typeof document === 'undefined') return Promise.resolve(null);

    const stage = rootElement.querySelector('[data-wheel-stage]');
    const slider = rootElement.querySelector('[data-wheel-slider]');
    const status = rootElement.querySelector('[data-wheel-status]');
    if (!stage || !slider) return Promise.resolve(null);

    const remoteUrl = options.remoteUrl ?? rootElement.dataset.remoteUrl ?? '';
    const fallbackUrl = options.fallbackUrl ?? rootElement.dataset.fallbackUrl ?? 'gallery.json';
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pauses = new Set();
    let images = [];
    let items = [];
    let progress = 0;
    let lastTime = 0;
    let animationFrame = 0;
    let dragging = null;
    let suppressClick = false;
    let manualTimer = 0;

    const setPause = (reason, paused) => {
      if (paused) pauses.add(reason);
      else pauses.delete(reason);
    };

    const render = (nextProgress = progress) => {
      progress = normalizeProgress(nextProgress);
      const stageWidth = stage.clientWidth || 800;
      const stageHeight = stage.clientHeight || 500;
      const compact = stageWidth < 640;
      const geometry = compact
        ? { radiusX: 36, radiusY: 19, depth: 0.16, tiltY: 90 }
        : DEFAULT_GEOMETRY;

      items.forEach((item, index) => {
        const frame = calculateWheelFrame(index, items.length, progress, geometry);
        item.style.setProperty('--wheel-x', `${(frame.xPercent / 100) * stageWidth}px`);
        item.style.setProperty('--wheel-y', `${(frame.yPercent / 100) * stageHeight}px`);
        item.style.setProperty('--wheel-scale', frame.scale.toFixed(3));
        item.style.setProperty('--wheel-opacity', frame.opacity.toFixed(3));
        item.style.setProperty('--wheel-rotation', frame.rotationDeg.toFixed(2));
        item.style.setProperty('--wheel-tilt-y', frame.rotationYDeg.toFixed(2));
        item.style.setProperty('--wheel-z', String(frame.zIndex));
      });
      slider.value = String(Math.round(progress * 1000));
    };

    const tick = (time) => {
      const elapsed = lastTime ? Math.min(time - lastTime, 50) : 0;
      lastTime = time;
      if (shouldAnimate(pauses, reducedMotionQuery.matches, items.length)) {
        render(progress + elapsed * 0.000018);
      }
      animationFrame = requestAnimationFrame(tick);
    };

    const openImage = (image, trigger) => {
      if (window.portfolioLightbox && typeof window.portfolioLightbox.open === 'function') {
        window.portfolioLightbox.open(image, trigger);
      }
    };

    const renderItems = () => {
      stage.innerHTML = '';
      const fragment = document.createDocumentFragment();
      images.forEach((image, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'image-wheel__item';
        button.setAttribute('aria-label', `확대: ${image.alt}`);
        button.dataset.imageIndex = String(index);

        const img = document.createElement('img');
        img.src = image.thumb;
        img.alt = '';
        img.width = image.width;
        img.height = image.height;
        img.loading = index < 5 ? 'eager' : 'lazy';
        img.decoding = 'async';

        const caption = document.createElement('span');
        caption.textContent = image.caption || image.alt;
        button.append(img, caption);
        button.addEventListener('click', () => {
          if (!suppressClick) openImage(image, button);
          suppressClick = false;
        });
        fragment.appendChild(button);
      });
      stage.appendChild(fragment);
      items = Array.from(stage.querySelectorAll('.image-wheel__item'));
      render();
    };

    stage.addEventListener('mouseenter', () => setPause('hover', true));
    stage.addEventListener('mouseleave', () => setPause('hover', false));
    stage.addEventListener('focusin', () => setPause('focus', true));
    stage.addEventListener('focusout', (event) => {
      if (!stage.contains(event.relatedTarget)) setPause('focus', false);
    });

    stage.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      dragging = { id: event.pointerId, startX: event.clientX, startProgress: progress, moved: false };
      setPause('drag', true);
    });
    stage.addEventListener('pointermove', (event) => {
      if (!dragging || dragging.id !== event.pointerId) return;
      const delta = event.clientX - dragging.startX;
      if (Math.abs(delta) > 5) dragging.moved = true;
      if (dragging.moved) {
        if (!stage.hasPointerCapture(event.pointerId)) stage.setPointerCapture(event.pointerId);
        suppressClick = true;
        render(dragging.startProgress - delta / Math.max(stage.clientWidth, 320) * 0.55);
      }
    });
    const endDrag = (event) => {
      if (!dragging || dragging.id !== event.pointerId) return;
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
      dragging = null;
      setPause('drag', false);
      window.setTimeout(() => { suppressClick = false; }, 0);
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    slider.addEventListener('input', () => {
      window.clearTimeout(manualTimer);
      setPause('manual', true);
      render(Number(slider.value) / 1000);
    });
    slider.addEventListener('change', () => {
      manualTimer = window.setTimeout(() => setPause('manual', false), 1200);
    });

    const updateReducedMotion = () => setPause('reduced-motion', reducedMotionQuery.matches);
    updateReducedMotion();
    reducedMotionQuery.addEventListener?.('change', updateReducedMotion);

    document.addEventListener('visibilitychange', () => setPause('hidden', document.hidden));
    document.addEventListener('portfolio:lightbox-open', () => setPause('lightbox', true));
    document.addEventListener('portfolio:lightbox-close', () => setPause('lightbox', false));
    window.addEventListener('resize', () => render());

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => setPause('offscreen', !entry.isIntersecting), {
        threshold: 0.15,
      }).observe(rootElement);
    }

    return loadImages(remoteUrl, fallbackUrl)
      .then((loadedImages) => {
        images = loadedImages;
        renderItems();
        if (status) status.textContent = `${images.length}개의 기록 · 커서를 올리면 멈추고, 클릭하면 원본을 엽니다.`;
        rootElement.classList.add('is-ready');
        rootElement.dispatchEvent(new CustomEvent('gallerywheel:ready', { detail: { count: images.length } }));
        animationFrame = requestAnimationFrame(tick);
        return {
          get progress() { return progress; },
          get count() { return images.length; },
          pause: (reason = 'external') => setPause(reason, true),
          resume: (reason = 'external') => setPause(reason, false),
          destroy: () => cancelAnimationFrame(animationFrame),
        };
      })
      .catch((error) => {
        console.error('Gallery failed to load.', error);
        if (status) status.textContent = '사진을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
        return null;
      });
  }

  if (typeof document !== 'undefined') {
    const initialize = () => {
      const root = document.getElementById('imageWheel');
      if (root) mount(root);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
    else initialize();
  }

  return {
    calculateWheelFrame,
    mount,
    normalizeManifest,
    normalizeProgress,
    shouldAnimate,
  };
});
