import "@fontsource/barlow-semi-condensed/600.css";
import "@fontsource/barlow-semi-condensed/700.css";
import "../styles/base.css";

export const reducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

/** The header gains its ground and its line once the page has moved. */
function watchScroll() {
  const header = document.querySelector<HTMLElement>(".site-header");
  if (!header) return;
  const update = () => header.toggleAttribute("data-scrolled", window.scrollY > 8);
  update();
  window.addEventListener("scroll", update, { passive: true });
}

/** Content marked `data-reveal` rises into place the first time it is seen. */
function revealOnView() {
  const items = document.querySelectorAll<HTMLElement>("[data-reveal]");
  if (reducedMotion || !("IntersectionObserver" in window)) {
    for (const item of items) item.setAttribute("data-shown", "");
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-shown", "");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
  );
  for (const item of items) observer.observe(item);
}

watchScroll();
revealOnView();
