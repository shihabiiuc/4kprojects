// Load a video's sources only once it nears the viewport; pause it off screen.
// video[data-lazy-video="eager"] (e.g. a page hero) is set up straight away,
// every other video[data-lazy-video] after the page has loaded.
function setup(video: HTMLVideoElement) {
  if (video.dataset.lazyVideo === 'ready') return;
  video.dataset.lazyVideo = 'ready';
  let loaded = false;
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return video.pause();
    if (!loaded) {
      loaded = true;
      video.querySelectorAll<HTMLSourceElement>('source[data-src]').forEach((s) => {
        s.src = s.dataset.src!;
        s.removeAttribute('data-src');
      });
      video.load();
    }
    video.play().catch(() => {});
  }).observe(video);
}

export function initLazyVideos() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll<HTMLVideoElement>('video[data-lazy-video="eager"]').forEach(setup);
  const all = () => document.querySelectorAll<HTMLVideoElement>('video[data-lazy-video]').forEach(setup);
  if (document.readyState === 'complete') all();
  else window.addEventListener('load', all, { once: true });
}
