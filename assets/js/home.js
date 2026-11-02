// LENS 101 home: hover backdrop, per-chapter accent + logo, scroll arrivals. No libraries.
(function () {
  const root = document.documentElement;
  const backdrop = document.querySelector('.backdrop');
  const bdImg = backdrop.querySelector('img');
  const canHover = matchMedia('(hover: hover) and (min-width: 721px)').matches;

  // 1. Point at a name in the index and its picture fills the screen behind the page.
  if (canHover) {
    let hideTimer;
    document.querySelectorAll('.index a').forEach(a => {
      const show = () => {
        clearTimeout(hideTimer);
        if (bdImg.getAttribute('src') !== a.dataset.img) bdImg.src = a.dataset.img;
        backdrop.classList.add('on');
        root.style.setProperty('--accent', a.style.getPropertyValue('--c'));
      };
      const hide = () => { hideTimer = setTimeout(() => backdrop.classList.remove('on'), 120); };
      a.addEventListener('mouseenter', show); a.addEventListener('focus', show);
      a.addEventListener('mouseleave', hide); a.addEventListener('blur', hide);
    });
  }

  // 2. Each chapter recolors the page and rewrites the logo: "LENS 101 & Blender".
  const word = document.querySelector('.logo-word');
  const hero = document.querySelector('.hero');
  const defaults = { accent: '#ff5a36', logo: 'the Artistic Space' };
  let current = '';
  function setChapter(accent, logo) {
    root.style.setProperty('--accent', accent);
    if (logo === current) return;
    current = logo;
    word.classList.add('out');
    setTimeout(() => { word.textContent = logo; word.classList.remove('out'); }, 350);
  }
  const chapters = [...document.querySelectorAll('.chapter')];
  function onScroll() {
    const mid = innerHeight * 0.45;
    let hit = null;
    for (const c of chapters) { const r = c.getBoundingClientRect(); if (r.top < mid && r.bottom > mid) { hit = c; break; } }
    if (hit) setChapter(hit.dataset.accent, hit.dataset.logo);
    else if (hero.getBoundingClientRect().bottom > 0 || !chapters.length) setChapter(defaults.accent, defaults.logo);
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // 3. Tiles and headings arrive as they scroll into view.
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = (el.classList.contains('tile') ? (i % 3) * 60 : 0) + 'ms';
    io.observe(el);
  });
})();
