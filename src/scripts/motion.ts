// Site-wide scroll motion, ported from the live site:
// smooth scrolling, text reveals, scroll triggers, the hero fade-out,
// and the header's scroll states.
import Lenis from 'lenis';

const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Run `fn` at most once per frame on scroll and resize. */
function onScrollFrame(fn: () => void) {
  let queued = false;
  const tick = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn();
    });
  };
  fn();
  window.addEventListener('scroll', tick, { passive: true });
  window.addEventListener('resize', tick);
}

// ── Smooth scrolling ───────────────────────────────────────
function initSmoothScroll() {
  if (reducedMotion) return;
  const lenis = new Lenis({ duration: 2 });
  const raf = (time: number) => {
    lenis.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);

  // Same-page anchor links glide instead of jumping.
  document.addEventListener('click', (e) => {
    const link = (e.target as Element).closest<HTMLAnchorElement>('a[href*="#"]');
    if (!link || link.origin !== location.origin || link.pathname !== location.pathname) return;
    const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -parseInt(getComputedStyle(target).scrollMarginTop) || 0 });
  });
}

// ── Page loaded (fonts ready) — drives the hero intro ──────
function markLoaded() {
  document.fonts.ready.then(() => {
    requestAnimationFrame(() => root.toggleAttribute('data-loaded', true));
  });
}

// ── Text reveals ───────────────────────────────────────────
// data-reveal="word": each child <span> is a word, staggered 50ms apart.
// data-reveal="line": words (`> span > span`) are grouped into rendered lines,
//   and each line is staggered.
// data-reveal (no value): the whole element fades up.
// data-reveal-on="view" waits until half the element is on screen;
// anything else reveals as soon as the fonts are ready.
function indexWords(el: HTMLElement) {
  if (el.dataset.reveal === 'word') {
    [...el.children].forEach((child, i) => (child as HTMLElement).style.setProperty('--i', String(i)));
    return;
  }
  if (el.dataset.reveal === 'line') {
    const words = [...el.querySelectorAll<HTMLElement>(':scope > span > span')];
    const tops = words.map((w) => w.offsetTop);
    const lines = [...new Set(tops)].sort((a, b) => a - b);
    words.forEach((w, i) => w.style.setProperty('--i', String(lines.indexOf(tops[i]))));
  }
}

function reveal(el: HTMLElement) {
  indexWords(el);
  el.toggleAttribute('data-revealed', true);
}

function initReveals() {
  const els = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
  if (!els.length) return;

  const done = (el: HTMLElement) => {
    halfVisible.unobserve(el);
    tallCentered.unobserve(el);
    reveal(el);
  };
  const halfVisible = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && done(e.target as HTMLElement)),
    { threshold: 0.5 }
  );
  // Elements taller than two screens can never be half visible,
  // so reveal those once they cross the middle of the viewport.
  const tallCentered = new IntersectionObserver(
    (entries) =>
      entries.forEach(
        (e) => e.isIntersecting && e.boundingClientRect.height > 2 * innerHeight && done(e.target as HTMLElement)
      ),
    { rootMargin: '-50% 0px -50% 0px' }
  );

  document.fonts.ready.then(() => {
    for (const el of els) {
      if (el.dataset.revealOn === 'view') {
        halfVisible.observe(el);
        tallCentered.observe(el);
      } else {
        reveal(el);
      }
    }
  });
}

// ── Scroll triggers ────────────────────────────────────────
// [data-scroll-trigger] gets [data-active] while its trigger's top edge is
// above `data-threshold` (default 0.5) of the viewport. The trigger is the
// element whose id is in data-trigger, or the element itself.
// data-once keeps it active after the first time.
function initScrollTriggers() {
  const items = [...document.querySelectorAll<HTMLElement>('[data-scroll-trigger]')].flatMap((el) => {
    const trigger = el.dataset.trigger ? document.getElementById(el.dataset.trigger) : el;
    if (!trigger) return [];
    return [{
      el,
      trigger,
      threshold: el.dataset.threshold ? Number(el.dataset.threshold) : 0.5,
      once: el.hasAttribute('data-once'),
    }];
  });
  if (!items.length) return;

  onScrollFrame(() => {
    const vh = innerHeight;
    const states = items.map((it) => it.trigger.getBoundingClientRect().top <= 1 + it.threshold * vh);
    items.forEach((it, i) => {
      if (it.once && it.el.hasAttribute('data-active')) return;
      it.el.toggleAttribute('data-active', states[i]);
    });
  });
}

// ── Fade an element out while the section in data-fade-until scrolls in ──
function initFadeUntil() {
  const el = document.querySelector<HTMLElement>('[data-fade-until]');
  const until = el && document.getElementById(el.dataset.fadeUntil ?? '');
  if (!el || !until) return;

  onScrollFrame(() => {
    const start = until.getBoundingClientRect().top + scrollY - 1 - innerHeight;
    const progress = Math.min(Math.max((scrollY - start) / until.offsetHeight, 0), 1);
    el.style.opacity = String(1 - progress);
  });
}

// ── Header state ───────────────────────────────────────────
// html[data-nav-scrolled]  — page is scrolled at all
// html[data-nav-hidden]    — last scroll was downwards (burger fades out)
// html[data-nav-lines=…]   — colour of the [data-nav-lines] section under the top edge
// html[data-nav-whatsapp=hide] — home page only: the hero still fills the top edge
function initNavState() {
  let lastY = scrollY;
  let lastDir = 'down';
  root.toggleAttribute('data-nav-scrolled', lastY > 0);
  window.addEventListener(
    'scroll',
    () => {
      const y = scrollY;
      root.toggleAttribute('data-nav-scrolled', y > 0);
      if (y === lastY) return;
      const dir = y > lastY ? 'down' : 'up';
      lastY = y;
      // Only flip after two scroll events in the same direction, to ignore jitter.
      if (dir === lastDir) root.toggleAttribute('data-nav-hidden', dir === 'down');
      lastDir = dir;
    },
    { passive: true }
  );

  const sections = [...document.querySelectorAll<HTMLElement>('[data-nav-lines]')];
  let afterHero = document.querySelector('.home-hero')?.nextElementSibling;
  while (afterHero?.matches('script, style, template')) afterHero = afterHero.nextElementSibling;
  if (!sections.length && !afterHero) return;
  onScrollFrame(() => {
    const current = sections.filter((s) => s.getBoundingClientRect().top <= 1).pop();
    if (current) root.dataset.navLines = current.dataset.navLines;
    else delete root.dataset.navLines;

    if (afterHero && afterHero.getBoundingClientRect().top > 1) root.dataset.navWhatsapp = 'hide';
    else delete root.dataset.navWhatsapp;
  });
}

initSmoothScroll();
markLoaded();
initReveals();
initScrollTriggers();
initFadeUntil();
initNavState();
