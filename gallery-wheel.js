(function exposeGalleryWheel(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GalleryWheel = api;
})(typeof window !== 'undefined' ? window : globalThis, function buildGalleryWheelApi() {
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

  function calculateCarouselFrame(index, count, progress, geometry = {}) {
    const safeCount = Math.max(count, 1);
    const slotX = geometry.slotX ?? 46;
    const sideRotation = geometry.sideRotation ?? 70;
    let relative = index - progress;
    relative = ((relative + safeCount / 2) % safeCount + safeCount) % safeCount - safeCount / 2;

    const distance = Math.abs(relative);
    const focus = Math.max(0, 1 - distance);
    const easedFocus = focus * focus * (3 - 2 * focus);
    const opacity = distance <= 1
      ? 1 - distance * 0.25
      : Math.max(0, 0.75 * (1 - (distance - 1) / 0.25));

    return {
      xPercent: relative * slotX,
      yPercent: 0,
      scale: 0.84 + easedFocus * 0.28,
      opacity,
      rotationDeg: relative === 0 ? 0 : Math.max(-3, Math.min(3, relative * -2.5)),
      rotationYDeg: relative === 0 ? 0 : Math.max(-90, Math.min(90, relative * -sideRotation)),
      zIndex: Math.max(1, Math.round(100 - distance * 24)),
      interactive: distance <= 1 && opacity > 0.05,
    };
  }

  function calculateAutoplayStep(elapsedMs, holdMs = 2500, transitionMs = 900) {
    const elapsed = Math.max(Number(elapsedMs) || 0, 0);
    const hold = Math.max(Number(holdMs) || 0, 0);
    const transition = Math.max(Number(transitionMs) || 0, 1);
    if (elapsed <= hold) return { offset: 0, complete: false };
    if (elapsed >= hold + transition) return { offset: 1, complete: true };

    const linear = (elapsed - hold) / transition;
    const eased = linear * linear * (3 - 2 * linear);
    return { offset: eased, complete: false };
  }

  function calculateCarouselSlotX(stageWidth, cardWidth, options = {}) {
    const minimumSlotX = Math.max(Number(options.minimumSlotX) || 0, 0);
    if (stageWidth <= 0 || cardWidth <= 0) return minimumSlotX;

    const gap = Math.max(Number(options.gap) || 0, 0);
    const projectionScale = Math.max(Number(options.projectionScale) || 1, 0);
    const transitionScale = Math.max(Number(options.transitionScale) || 1, 0);
    const requiredSlotX = ((cardWidth * transitionScale * projectionScale + gap) / stageWidth) * 100;
    return Math.max(minimumSlotX, requiredSlotX);
  }

  function shouldAnimate(pauses, reducedMotion, itemCount) {
    return !reducedMotion && itemCount > 1 && pauses.size === 0;
  }

  function resolvePointerRelease(dragState) {
    if (!dragState || dragState.moved || !Number.isInteger(dragState.imageIndex)) return -1;
    return dragState.imageIndex >= 0 ? dragState.imageIndex : -1;
  }

  function resolveFilmstripPosition(activeIndex, itemCount) {
    const total = Math.max(Math.trunc(Number(itemCount) || 0), 0);
    if (!total) return { index: 0, current: 0, total: 0 };
    const rawIndex = Math.trunc(Number(activeIndex) || 0);
    const index = ((rawIndex % total) + total) % total;
    return { index, current: index + 1, total };
  }

  function resolveCarouselTarget(currentProgress, targetIndex, itemCount) {
    const total = Math.max(Math.trunc(Number(itemCount) || 0), 0);
    if (!total) return 0;
    const current = Number(currentProgress) || 0;
    const target = ((Math.trunc(Number(targetIndex) || 0) % total) + total) % total;
    const currentWrapped = ((current % total) + total) % total;
    let delta = target - currentWrapped;
    if (delta > total / 2) delta -= total;
    else if (delta < -total / 2) delta += total;
    return current + delta;
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
    const thumbnailsRoot = rootElement.querySelector('[data-wheel-thumbnails]');
    const counter = rootElement.querySelector('[data-wheel-counter]');
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
    let thumbnails = [];
    let progress = 0;
    let activeIndex = 0;
    let cycleElapsed = 0;
    let lastTime = 0;
    let animationFrame = 0;
    let dragging = null;
    let thumbnailNavigation = null;
    let suppressClick = false;
    let currentSlotX = 46;

    const setPause = (reason, paused) => {
      if (paused) pauses.add(reason);
      else pauses.delete(reason);
    };

    const updateFilmstrip = (nextIndex = activeIndex, centerActive = false) => {
      const position = resolveFilmstripPosition(nextIndex, images.length);
      thumbnails.forEach((thumbnail, index) => {
        const isActive = index === position.index;
        thumbnail.classList.toggle('is-active', isActive);
        if (isActive) thumbnail.setAttribute('aria-current', 'true');
        else thumbnail.removeAttribute('aria-current');
      });
      if (counter) {
        const width = Math.max(String(position.total).length, 2);
        counter.textContent = `${String(position.current).padStart(width, '0')} / ${String(position.total).padStart(width, '0')}`;
      }
      if (centerActive && thumbnailsRoot && thumbnails[position.index]) {
        const activeThumbnail = thumbnails[position.index];
        const left = activeThumbnail.offsetLeft - (thumbnailsRoot.clientWidth - activeThumbnail.offsetWidth) / 2;
        thumbnailsRoot.scrollTo({
          left: Math.max(left, 0),
          behavior: reducedMotionQuery.matches ? 'auto' : 'smooth',
        });
      }
    };

    const render = (nextProgress = progress) => {
      progress = Number.isFinite(nextProgress) ? nextProgress : 0;
      const stageWidth = stage.clientWidth || 800;
      const stageHeight = stage.clientHeight || 500;
      const cardWidth = items[0]?.offsetWidth || 400;
      currentSlotX = calculateCarouselSlotX(stageWidth, cardWidth, {
        gap: stageWidth < 768 ? 12 : 32,
        projectionScale: 0.84,
        transitionScale: 0.98,
        minimumSlotX: 32,
      });
      const geometry = { slotX: currentSlotX, sideRotation: 70 };

      items.forEach((item, index) => {
        const frame = calculateCarouselFrame(index, items.length, progress, geometry);
        item.style.setProperty('--wheel-x', `${(frame.xPercent / 100) * stageWidth}px`);
        item.style.setProperty('--wheel-y', `${(frame.yPercent / 100) * stageHeight}px`);
        item.style.setProperty('--wheel-scale', frame.scale.toFixed(3));
        item.style.setProperty('--wheel-opacity', frame.opacity.toFixed(3));
        item.style.setProperty('--wheel-rotation', frame.rotationDeg.toFixed(2));
        item.style.setProperty('--wheel-tilt-y', frame.rotationYDeg.toFixed(2));
        item.style.setProperty('--wheel-z', String(frame.zIndex));
        item.style.pointerEvents = frame.interactive ? 'auto' : 'none';
        item.tabIndex = frame.interactive ? 0 : -1;
        item.setAttribute('aria-hidden', frame.interactive ? 'false' : 'true');
      });
    };

    const navigateToThumbnail = (targetIndex) => {
      if (!items.length) return;
      const targetProgress = resolveCarouselTarget(progress, targetIndex, items.length);
      const targetPosition = resolveFilmstripPosition(targetIndex, items.length);
      const distance = Math.abs(targetProgress - progress);
      cycleElapsed = 0;

      if (distance < 0.001 || reducedMotionQuery.matches) {
        thumbnailNavigation = null;
        activeIndex = targetPosition.index;
        progress = activeIndex;
        render(progress);
        updateFilmstrip(activeIndex, true);
        return;
      }

      thumbnailNavigation = {
        elapsed: 0,
        duration: Math.min(1400, 480 + distance * 100),
        startProgress: progress,
        targetProgress,
        targetIndex: targetPosition.index,
      };
    };

    const tick = (time) => {
      const elapsed = lastTime ? Math.min(time - lastTime, 50) : 0;
      lastTime = time;
      if (thumbnailNavigation) {
        thumbnailNavigation.elapsed += elapsed;
        const step = calculateAutoplayStep(
          thumbnailNavigation.elapsed,
          0,
          thumbnailNavigation.duration
        );
        const nextProgress = thumbnailNavigation.startProgress
          + (thumbnailNavigation.targetProgress - thumbnailNavigation.startProgress) * step.offset;
        render(nextProgress);
        if (step.complete) {
          activeIndex = thumbnailNavigation.targetIndex;
          thumbnailNavigation = null;
          progress = activeIndex;
          cycleElapsed = 0;
          render(progress);
          updateFilmstrip(activeIndex, true);
        }
      } else if (shouldAnimate(pauses, reducedMotionQuery.matches, items.length)) {
        cycleElapsed += elapsed;
        const step = calculateAutoplayStep(cycleElapsed, 2500, 900);
        render(activeIndex + step.offset);
        if (step.complete) {
          activeIndex = (activeIndex + 1) % items.length;
          cycleElapsed = 0;
          render(activeIndex);
          updateFilmstrip(activeIndex, true);
        }
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

      if (thumbnailsRoot) {
        thumbnailsRoot.innerHTML = '';
        const thumbnailFragment = document.createDocumentFragment();
        images.forEach((image, index) => {
          const thumbnail = document.createElement('button');
          thumbnail.type = 'button';
          thumbnail.className = 'image-wheel__thumbnail';
          thumbnail.setAttribute('aria-label', `${index + 1}번째 사진으로 이동`);

          const thumbnailImage = document.createElement('img');
          thumbnailImage.src = image.thumb;
          thumbnailImage.alt = '';
          thumbnailImage.loading = 'lazy';
          thumbnailImage.decoding = 'async';
          thumbnail.appendChild(thumbnailImage);
          thumbnail.addEventListener('click', () => navigateToThumbnail(index));
          thumbnailFragment.appendChild(thumbnail);
        });
        thumbnailsRoot.appendChild(thumbnailFragment);
        thumbnails = Array.from(thumbnailsRoot.querySelectorAll('.image-wheel__thumbnail'));
      }

      render();
      updateFilmstrip(activeIndex);
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
        const slotWidth = Math.max(stage.clientWidth, 320) * (currentSlotX / 100);
        render(dragging.startProgress - delta / slotWidth);
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
      if (moved && items.length) {
        activeIndex = ((Math.round(progress) % items.length) + items.length) % items.length;
        progress = activeIndex;
        cycleElapsed = 0;
        render(progress);
        updateFilmstrip(activeIndex, true);
      }
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
    window.addEventListener('resize', () => {
      render();
      updateFilmstrip(activeIndex, true);
    });

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
    calculateAutoplayStep,
    calculateCarouselFrame,
    calculateCarouselSlotX,
    mount,
    normalizeLocalFallback,
    normalizeManifest,
    resolveCarouselTarget,
    resolveFilmstripPosition,
    resolvePointerRelease,
    shouldAnimate,
  };
});
