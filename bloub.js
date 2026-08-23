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

  // The supplied SVG owns the character's shape and motion. Keeping the page
  // from manipulating its internals preserves the original Bloub animation.
  if (bloub && reducedMotion.matches) bloub.querySelector('img')?.setAttribute('loading', 'eager');
})();
