import "@fontsource/barlow-semi-condensed/500.css";
import "@fontsource/barlow-semi-condensed/600.css";
import "../styles/base.css";

export const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

const lightTheme = window.matchMedia("(prefers-color-scheme: light)");

/** The header gains its ground and its line once the page has moved. */
function watchScroll() {
  const header = document.querySelector<HTMLElement>(".site-header");
  if (!header) return;
  const update = () => header.toggleAttribute("data-scrolled", window.scrollY > 8);
  update();
  window.addEventListener("scroll", update, { passive: true });
}

/**
 * A painting marked to be painted when seen holds its finished still until
 * then. Once its animated picture is fetched and it is in view, the picture
 * is painted in its place, drawing by drawing, in the theme's ink, and the
 * picture is told with a `painting` event. With reduced motion the still
 * stays.
 */
function paintOnView(picture: HTMLElement, seen: () => Promise<void>) {
  const image = picture.querySelector("img");
  const source = picture.querySelector<HTMLSourceElement>("source[media*='light']");
  const dark = image?.dataset.paint;
  const light = source?.dataset.paint;
  if (!image || !dark || reducedMotion) return;
  const url = lightTheme.matches && light ? light : dark;
  const fetched = new Promise<void>((resolve) => {
    const loader = new Image();
    loader.onload = () => resolve();
    loader.onerror = () => resolve();
    loader.src = url;
  });
  void Promise.all([fetched, seen()]).then(() => {
    if (source && light) source.srcset = light;
    image.src = dark;
    picture.dispatchEvent(new Event("painting"));
  });
}

/** How long the drop's rings take to die away, in milliseconds. */
const RINGS_FADE = 1300;

/**
 * The water at the foot of the page, as at the trailer's opening: the drop's
 * rings spread and die away on still paper, and only then is the river
 * painted. Without motion the river is simply there.
 */
function calmWater() {
  const water = document.querySelector<HTMLElement>(".site-footer__water");
  const ripple = water?.querySelector<HTMLElement>("[data-paint-on-view]");
  if (!water) return;
  const calm = () => water.setAttribute("data-calm", "");
  if (!ripple || reducedMotion || !("IntersectionObserver" in window)) return calm();
  ripple.addEventListener("painting", () => window.setTimeout(calm, RINGS_FADE), { once: true });
}

/**
 * Writing marked `data-reveal` settles into place the first time it is seen;
 * a mount marked with a matte arrives under its brush, and once the brush
 * has closed the mask is taken off. Paintings marked to be painted on view
 * start then.
 */
function revealOnView() {
  const items = document.querySelectorAll<HTMLElement>("[data-reveal], [data-matte], [data-paint-on-view]");
  const show = (item: HTMLElement) => item.setAttribute("data-shown", "");
  for (const item of document.querySelectorAll<HTMLElement>("[data-matte]")) {
    item.addEventListener("animationend", () => item.setAttribute("data-settled", ""), { once: true });
  }
  if (reducedMotion || !("IntersectionObserver" in window)) {
    for (const item of items) show(item);
    return;
  }
  const waiting = new Map<Element, () => void>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        show(entry.target as HTMLElement);
        waiting.get(entry.target)?.();
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
  );
  for (const item of items) {
    if (item.hasAttribute("data-paint-on-view")) {
      paintOnView(item, () => new Promise<void>((resolve) => waiting.set(item, resolve)));
    }
    observer.observe(item);
  }
}

watchScroll();
calmWater();
revealOnView();
