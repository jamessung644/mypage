(() => {
  const sliders = [...document.querySelectorAll('[data-project-slider]')];

  sliders.forEach((slider) => {
    const slides = [...slider.querySelectorAll('[data-project-slide]')];
    const previousButton = slider.querySelector('[data-project-slider-prev]');
    const nextButton = slider.querySelector('[data-project-slider-next]');
    const counter = slider.querySelector('[data-project-slider-count]');
    let activeIndex = Math.max(0, slides.findIndex((slide) => slide.classList.contains('is-active')));
    let pointerStartX = null;
    let suppressClick = false;

    const render = () => {
      slides.forEach((slide, index) => {
        const isActive = index === activeIndex;
        slide.classList.toggle('is-active', isActive);
        slide.setAttribute('aria-hidden', String(!isActive));
        slide.tabIndex = isActive ? 0 : -1;
      });
      if (counter) counter.textContent = `${activeIndex + 1} / ${slides.length}`;
    };

    const move = (step) => {
      activeIndex = (activeIndex + step + slides.length) % slides.length;
      render();
    };

    previousButton?.addEventListener('click', () => move(-1));
    nextButton?.addEventListener('click', () => move(1));

    slider.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      move(event.key === 'ArrowRight' ? 1 : -1);
    });

    slider.addEventListener('pointerdown', (event) => {
      pointerStartX = event.clientX;
      suppressClick = false;
    });

    slider.addEventListener('pointerup', (event) => {
      if (pointerStartX === null) return;
      const distance = event.clientX - pointerStartX;
      pointerStartX = null;
      if (Math.abs(distance) < 40) return;
      suppressClick = true;
      move(distance < 0 ? 1 : -1);
    });

    slides.forEach((slide) => {
      slide.addEventListener('click', () => {
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        const image = slide.querySelector('img');
        if (!image || !window.portfolioLightbox) return;
        window.portfolioLightbox.open({
          large: image.currentSrc || image.src,
          alt: image.alt,
        }, slide);
      });
    });

    render();
  });
})();
