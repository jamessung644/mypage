(function initializeBloubExperience() {
  const loader = document.getElementById('siteLoader');
  const bloub = document.getElementById('heroBloub');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

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

  if (!bloub || reducedMotion.matches) return;

  const eyes = Array.from(bloub.querySelectorAll('[data-bloub-eye]'));
  let target = null;
  let blinkTimer = 0;

  function updateGaze(clientX, clientY) {
    const rect = bloub.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.max(Math.hypot(dx, dy), 1);
    const x = Math.max(-12, Math.min(12, dx / distance * 12));
    const y = Math.max(-8, Math.min(8, dy / distance * 8));
    eyes.forEach((eye) => {
      eye.style.setProperty('--gaze-x', `${x.toFixed(2)}px`);
      eye.style.setProperty('--gaze-y', `${y.toFixed(2)}px`);
    });
  }

  document.addEventListener('pointermove', (event) => {
    if (!target && event.pointerType !== 'touch') updateGaze(event.clientX, event.clientY);
  }, { passive: true });

  document.querySelectorAll('[data-project-focus]').forEach((card) => {
    const lookAtCard = () => {
      target = card;
      const rect = card.getBoundingClientRect();
      updateGaze(rect.left + rect.width / 2, rect.top + rect.height / 2);
    };
    const releaseCard = () => { target = null; };
    card.addEventListener('pointerenter', lookAtCard);
    card.addEventListener('pointerleave', releaseCard);
    card.addEventListener('focusin', lookAtCard);
    card.addEventListener('focusout', releaseCard);
  });

  function scheduleBlink() {
    window.clearTimeout(blinkTimer);
    blinkTimer = window.setTimeout(() => {
      bloub.style.setProperty('--blink', '.08');
      window.setTimeout(() => bloub.style.setProperty('--blink', '1'), 130);
      scheduleBlink();
    }, 4000 + Math.random() * 5000);
  }
  scheduleBlink();
})();
