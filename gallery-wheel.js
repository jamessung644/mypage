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

  function normalizeLocalFallback(entries) {
    if (!Array.isArray(entries)) return [];
    return entries
      .filter((entry) => entry && entry.large)
      .map((entry, index) => {
        const number = index + 1;
        const alt = String(entry.alt || `사진 기록 ${number}`);
        return {
          id: `local-photo-${String(number).padStart(2, '0')}`,
          thumb: `Img/gallery/${number}.webp`,
          large: String(entry.large),
          alt,
          caption: alt,
          uploaded: '',
          width: Number(entry.width) || 800,
          height: Number(entry.height) || 600,
        };
      });
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
    const itemStep = fullTurn / Math.max(count, 1);
    const handoffDistance = itemStep / 2;
    const normalizedFrontDistance = Math.min(Math.abs(frontOffset) / handoffDistance, 1);
    const frontFocus = 1 - normalizedFrontDistance;
    const easedFrontFocus = frontFocus * frontFocus * (3 - 2 * frontFocus);
    const depthOpacity = 0.44 + z * 0.56;
    const handoffOpacity = 0.58 + easedFrontFocus * 0.42;
    return {
      xPercent: Math.cos(angle) * radiusX,
      yPercent: Math.sin(angle) * radiusY,
      scale: 1 - depth + z * depth * 2,
      opacity: Math.min(depthOpacity, handoffOpacity),
      rotationDeg: Math.cos(angle) * -3.5,
      rotationYDeg: (frontOffset / Math.PI) * tiltY,
      zIndex: Math.round(z * 100),
    };
  }

  function shouldAnimate(pauses, reducedMotion, itemCount) {
    return !reducedMotion && itemCount > 1 && pauses.size === 0;
  }

  function resolvePointerRelease(dragState) {
    if (!dragState || dragState.moved || !Number.isInteger(dragState.imageIndex)) return -1;
    return dragState.imageIndex >= 0 ? dragState.imageIndex : -1;
  }

  async function fetchManifest(url) {
    if (!url) return [];
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Gallery request failed: ${response.status}`);
    return normalizeManifest(await response.json());
  }

  async function loadImages(remoteUrl, fallbackUrl, localFallback = []) {
    if (remoteUrl) {
      try {
        const remote = await fetchManifest(remoteUrl);
        if (remote.length) return remote;
      } catch (error) {
        console.warn('Remote gallery unavailable; using local images.', error);
      }
    }
    try {
      const fallback = await fetchManifest(fallbackUrl);
      if (fallback.length) return fallback;
    } catch (error) {
      console.warn('Gallery manifest unavailable; using embedded local images.', error);
    }
    return localFallback;
  }

  function mount(rootElement, options = {}) {
    if (!rootElement || typeof document === 'undefined') return Promise.resolve(null);

    const stage = rootElement.querySelector('[data-wheel-stage]');
    const status = rootElement.querySelector('[data-wheel-status]');
    if (!stage) return Promise.resolve(null);

    const remoteUrl = options.remoteUrl ?? rootElement.dataset.remoteUrl ?? '';
    const fallbackUrl = options.fallbackUrl ?? rootElement.dataset.fallbackUrl ?? 'gallery.json';
    const localFallback = normalizeLocalFallback(
      Array.from(document.querySelectorAll('.gallery-grid--legacy .gallery-item[data-src]'), (item) => {
        const image = item.querySelector('img');
        return {
          large: item.getAttribute('data-src'),
          alt: image?.alt || '',
          width: Number(image?.getAttribute('width')) || 800,
          height: Number(image?.getAttribute('height')) || 600,
        };
      })
    );
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pauses = new Set();
    let images = [];
    let items = [];
    let progress = 0;
    let lastTime = 0;
    let animationFrame = 0;
    let dragging = null;
    let suppressClick = false;

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

    const closestWheelItem = (target) => target instanceof Element
      ? target.closest('.image-wheel__item')
      : null;

    stage.addEventListener('pointerover', (event) => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      const item = closestWheelItem(event.target);
      if (item && stage.contains(item)) setPause('hover', true);
    });
    stage.addEventListener('pointerout', (event) => {
      if (event.pointerType && event.pointerType !== 'mouse') return;
      const fromItem = closestWheelItem(event.target);
      const toItem = closestWheelItem(event.relatedTarget);
      if (fromItem && (!toItem || !stage.contains(toItem))) setPause('hover', false);
    });
    stage.addEventListener('focusin', () => setPause('focus', true));
    stage.addEventListener('focusout', (event) => {
      if (!stage.contains(event.relatedTarget)) setPause('focus', false);
    });

    stage.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const trigger = closestWheelItem(event.target);
      const imageIndex = trigger ? Number(trigger.dataset.imageIndex) : -1;
      dragging = {
        id: event.pointerId,
        startX: event.clientX,
        startProgress: progress,
        moved: false,
        imageIndex: Number.isInteger(imageIndex) ? imageIndex : -1,
        trigger,
      };
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
      const releasedImageIndex = event.type === 'pointerup' ? resolvePointerRelease(dragging) : -1;
      const trigger = dragging.trigger;
      const moved = dragging.moved;
      if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
      dragging = null;
      setPause('drag', false);
      if (releasedImageIndex >= 0 && images[releasedImageIndex]) {
        suppressClick = true;
        openImage(images[releasedImageIndex], trigger);
      }
      if (moved || releasedImageIndex >= 0) {
        window.setTimeout(() => { suppressClick = false; }, 0);
      }
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

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

    return loadImages(remoteUrl, fallbackUrl, localFallback)
      .then((loadedImages) => {
        images = loadedImages;
        renderItems();
        if (status) status.textContent = `${images.length}개의 기록 · 사진 위에 커서를 올리면 멈추고, 클릭하면 원본을 엽니다.`;
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
    normalizeLocalFallback,
    normalizeManifest,
    normalizeProgress,
    resolvePointerRelease,
    shouldAnimate,
  };
});
