import { reducedMotion } from "./site";
import "../styles/home.css";
import { closingWater, heroLandscape } from "./landscape";
import { breakString, qinInstrument } from "./qin";
import { mountStrings, type Instrument } from "./strings";

/**
 * Wraps each word of a title so it can rise into place on its own, as the
 * trailer's titles do. The words keep their text and their emphasis.
 */
function splitWords(title: HTMLElement) {
  let index = 0;
  const walk = (node: Node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
        continue;
      }
      if (child.nodeType !== Node.TEXT_NODE) continue;
      const fragment = document.createDocumentFragment();
      for (const part of (child.textContent ?? "").split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          fragment.append(" ");
          continue;
        }
        const word = document.createElement("span");
        word.className = "word";
        const inner = document.createElement("span");
        inner.textContent = part;
        inner.style.setProperty("--i", String(index++));
        word.append(inner);
        fragment.append(word);
      }
      child.replaceWith(fragment);
    }
  };
  walk(title);
}

function play(video: HTMLVideoElement) {
  void video.play().catch(() => undefined);
}

/** Calls back as the element comes on screen, by at least `share` of it, and as it leaves. */
function whenVisible(element: Element, share: number, change: (visible: boolean) => void) {
  let visible = false;
  new IntersectionObserver(
    ([entry]) => {
      const now = !!entry && entry.isIntersecting && entry.intersectionRatio >= share - 0.01;
      if (now !== visible) change((visible = now));
    },
    { threshold: [0, share] },
  ).observe(element);
}

/** How far through the trailer section's stretch it is in and playing. */
const SETTLED = 0.12;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Where the page is scrolled to bring the trailer in: on a pinned section,
 * the point where it has grown to fill the window; elsewhere, the trailer in
 * the middle of the window.
 */
function bringIn(section: HTMLElement) {
  const behavior = reducedMotion ? "auto" : "smooth";
  if (section.hasAttribute("data-pinned")) {
    const top = section.getBoundingClientRect().top + window.scrollY;
    const target = top + (section.offsetHeight - window.innerHeight) * SETTLED;
    if (Math.abs(window.scrollY - target) > 4) window.scrollTo({ top: target, behavior });
    return;
  }
  const figure = section.querySelector("[data-film]");
  const box = figure?.getBoundingClientRect();
  if (box && (box.top < 64 || box.bottom > window.innerHeight)) {
    figure?.scrollIntoView({ behavior, block: "center" });
  }
}

/**
 * The trailer plays quietly while it is on screen. Asked for, it comes in if
 * it is not already, starts over with sound and its controls, and goes quiet
 * again once it has ended. With reduced motion it waits to be asked.
 */
function film(figure: HTMLElement) {
  const video = figure.querySelector("video");
  const section = figure.closest<HTMLElement>("[data-theatre]");
  if (!video || !section) return;
  const loud = () => figure.hasAttribute("data-sound");
  whenVisible(figure, 0.25, (visible) => {
    if (!visible) video.pause();
    else if (!loud() && !reducedMotion) play(video);
  });

  const listen = () => {
    figure.setAttribute("data-sound", "");
    video.loop = false;
    video.muted = false;
    video.controls = true;
    video.currentTime = 0;
    play(video);
    bringIn(section);
    video.focus({ preventScroll: true });
  };
  for (const button of document.querySelectorAll("[data-film-sound]")) {
    button.addEventListener("click", listen);
  }
  video.addEventListener("click", () => {
    if (!loud()) listen();
  });
  // Once watched, it holds on its last frame, the way to the code, and plays
  // quietly again the next time it comes on screen.
  video.addEventListener("ended", () => {
    if (!loud()) return;
    figure.removeAttribute("data-sound");
    video.controls = false;
    video.muted = true;
    video.loop = true;
  });
}

/**
 * On a window large enough, with motion allowed, the trailer's section holds
 * while the trailer comes in and fills the window; its styles say how. Where
 * the browser cannot tie an animation to scrolling, this follows the scroll
 * itself. The hero's way on leads to where the trailer has come in.
 */
function theatre(section: HTMLElement) {
  const large = window.matchMedia(
    "(min-width: 900px) and (min-height: 600px) and (prefers-reduced-motion: no-preference)",
  );
  const native = CSS.supports("animation-timeline: view()");

  const follow = () => {
    if (native || !section.hasAttribute("data-pinned")) return;
    const { top } = section.getBoundingClientRect();
    const height = window.innerHeight;
    const run = section.offsetHeight - height;
    const through = run > 0 ? clamp01(-top / run) : 0;
    section.style.setProperty("--in", clamp01((height - top) / height).toFixed(4));
    section.style.setProperty("--out", clamp01((through - 0.7) / 0.3).toFixed(4));
  };
  const fit = () => {
    section.toggleAttribute("data-pinned", large.matches);
    follow();
  };

  let pending = false;
  window.addEventListener(
    "scroll",
    () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        follow();
      });
    },
    { passive: true },
  );
  window.addEventListener("resize", follow);
  large.addEventListener("change", fit);
  fit();

  for (const link of document.querySelectorAll(`a[href="#${section.id}"]`)) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      bringIn(section);
    });
  }
}

/**
 * Gives a recording its controls over the footage: whether it is sped up,
 * and, once it has ended, a way to watch it again.
 */
function addControls(figure: HTMLElement, video: HTMLVideoElement) {
  const template = document.querySelector<HTMLTemplateElement>("#screen-controls");
  const controls = template?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
  if (!controls) return;
  const replay = controls.querySelector<HTMLButtonElement>(".screen__replay");
  if (reducedMotion) replay?.remove();
  replay?.addEventListener("click", () => {
    video.currentTime = 0;
    play(video);
  });
  if (!video.hasAttribute("data-sped")) controls.querySelector(".screen__sped")?.remove();
  if (controls.childElementCount) figure.append(controls);
  video.addEventListener("ended", () => figure.setAttribute("data-ended", ""));
  video.addEventListener("play", () => figure.removeAttribute("data-ended"));
}

/**
 * A recording plays once, from the start, when it is on screen, and holds its
 * last frame: what the work came to. It pauses off screen and goes on when it
 * is back. With reduced motion it shows that last frame and its controls.
 */
function playOnce(figure: HTMLElement) {
  const video = figure.querySelector("video");
  if (!video) return;
  addControls(figure, video);
  if (reducedMotion) {
    if (video.dataset.endPoster) video.poster = video.dataset.endPoster;
    video.controls = true;
    return;
  }
  whenVisible(figure, 0.6, (visible) => {
    if (!visible) video.pause();
    else if (!video.ended) play(video);
  });
}

/**
 * The story's screen shows the step being read: the step in the middle of the
 * window lights up and its recording plays once, crossing in over the one
 * before; its bar fills as it plays. Once it has ended, the way on lights up
 * and leads to the next step, or after the last, to the other runs. On a
 * narrow window each step has its own recording instead.
 */
function followStory(story: HTMLElement) {
  const steps = [...story.querySelectorAll<HTMLElement>(".story__step")];
  const screen = story.querySelector<HTMLElement>("[data-screen]");
  if (!screen) return;
  const videos = [...screen.querySelectorAll<HTMLVideoElement>("video")];
  const bars = [...screen.querySelectorAll<HTMLElement>(".story__progress li")];
  const wide = window.matchMedia("(min-width: 961px)");
  let current: HTMLVideoElement | undefined;
  let onScreen = false;

  // The bar of the step being read follows its recording, frame by frame.
  const follow = () => {
    const video = current;
    const bar = bars.find((item) => item.dataset.clip === video?.dataset.clip);
    if (!video || !bar) return;
    if (video.duration) bar.style.setProperty("--played", String(video.currentTime / video.duration));
    if (!video.paused && !video.ended) requestAnimationFrame(follow);
  };
  // Whether the recording of the step being read has ended.
  const mark = () => {
    const ended = !!current?.ended;
    screen.toggleAttribute("data-ended", ended);
    for (const step of steps) step.toggleAttribute("data-ended", ended && step.hasAttribute("data-active"));
  };
  for (const video of videos) {
    video.addEventListener("playing", follow);
    video.addEventListener("ended", follow);
    video.addEventListener("ended", mark);
    video.addEventListener("play", mark);
  }
  const next = screen.querySelector<HTMLButtonElement>("[data-next]");
  const nextLabel = next?.querySelector("[data-next-label]");
  let at = 0;

  const start = () => {
    if (!current || !onScreen || !wide.matches || reducedMotion) return;
    if (current.ended) current.currentTime = 0;
    play(current);
  };

  const show = (clip: string) => {
    at = steps.findIndex((step) => step.dataset.clip === clip);
    steps.forEach((step, index) => step.toggleAttribute("data-active", index === at));
    bars.forEach((bar, index) => {
      bar.toggleAttribute("data-active", index === at);
      bar.toggleAttribute("data-passed", index < at);
    });
    current = videos.find((video) => video.dataset.clip === clip);
    for (const video of videos) {
      video.toggleAttribute("data-active", video === current);
      if (video !== current) video.pause();
    }
    screen.toggleAttribute("data-sped", !!current?.hasAttribute("data-sped"));
    if (nextLabel) nextLabel.textContent = at < steps.length - 1 ? "Next step" : "Other work";
    mark();
    start();
  };

  next?.addEventListener("click", () => {
    const behavior = reducedMotion ? "auto" : "smooth";
    const after = steps[at + 1];
    if (after) after.scrollIntoView({ behavior, block: "center" });
    else document.querySelector("#runs")?.scrollIntoView({ behavior, block: "start" });
  });

  screen.querySelector("[data-replay]")?.addEventListener("click", () => {
    if (!current) return;
    current.currentTime = 0;
    play(current);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      const lit = entries.find((entry) => entry.isIntersecting);
      const clip = (lit?.target as HTMLElement | undefined)?.dataset.clip;
      if (clip) show(clip);
    },
    { rootMargin: "-45% 0px -45% 0px" },
  );
  for (const step of steps) observer.observe(step);
  const first = steps[0]?.dataset.clip;
  if (first) show(first);

  whenVisible(screen, 0.3, (visible) => {
    onScreen = visible;
    if (visible) start();
    else current?.pause();
  });

  if (reducedMotion) for (const video of videos) video.controls = true;

  // Narrow: each step gets a copy of its recording, under its words.
  const inline: HTMLVideoElement[] = [];
  for (const step of steps) {
    const source = videos.find((video) => video.dataset.clip === step.dataset.clip);
    if (!source) continue;
    const figure = document.createElement("figure");
    figure.className = "screen story__inline";
    const copy = source.cloneNode(true) as HTMLVideoElement;
    copy.removeAttribute("data-active");
    copy.controls = false;
    figure.append(copy);
    step.append(figure);
    inline.push(copy);
    playOnce(figure);
  }
  wide.addEventListener("change", () => {
    if (wide.matches) {
      for (const video of inline) video.pause();
      start();
    } else current?.pause();
  });
}

/**
 * Each run opens large, over the page, in its slower recording: from its
 * button, or from the recording itself. The large one plays from the start
 * with its controls, under the request as it was typed, and stops when
 * closed. With reduced motion it waits to be played.
 */
function viewer() {
  const dialog = document.querySelector<HTMLDialogElement>("[data-viewer]");
  const video = dialog?.querySelector("video");
  const ask = dialog?.querySelector("[data-viewer-ask]");
  const note = dialog?.querySelector("[data-viewer-note]");
  if (!dialog || !video || !ask || !note) return;

  const open = (figure: HTMLElement) => {
    const long = figure.dataset.long;
    if (!long) return;
    const typed = figure.closest(".run")?.querySelector(".run__ask")?.textContent ?? "";
    ask.textContent = typed.replace(/\s+/g, " ").trim();
    note.textContent = figure.dataset.longNote ?? "";
    if (video.getAttribute("src") !== long) video.src = long;
    video.currentTime = 0;
    figure.querySelector("video")?.pause();
    dialog.showModal();
    if (!reducedMotion) play(video);
  };
  for (const figure of document.querySelectorAll<HTMLElement>("[data-long]")) {
    figure.querySelector("[data-open-long]")?.addEventListener("click", () => open(figure));
    if (!reducedMotion) figure.querySelector("video")?.addEventListener("click", () => open(figure));
  }
  dialog.querySelector("[data-viewer-close]")?.addEventListener("click", () => dialog.close());
  // A click on the dimmed page around it closes it.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => video.pause());
}

if (!reducedMotion) {
  for (const title of document.querySelectorAll<HTMLElement>("[data-words]")) {
    splitWords(title);
  }
}

/** Mounts the strings drawn on `canvas` (found in `root`), plucked by a pointer over `root`. */
const strung = (root: HTMLElement | null, selector: string, instrument: (root: HTMLElement) => Instrument) => {
  const canvas = root?.querySelector<HTMLCanvasElement>(selector);
  if (root && canvas) mountStrings(root, canvas, instrument(root));
};
strung(document.querySelector(".hero"), "[data-landscape]", heroLandscape);
for (const line of document.querySelectorAll<HTMLElement>(".break")) strung(line, "[data-break]", breakString);
strung(document.querySelector(".name"), "[data-qin]", qinInstrument);
strung(document.querySelector(".closing"), "[data-water]", closingWater);
const stage = document.querySelector<HTMLElement>("[data-theatre]");
if (stage) theatre(stage);
const filmFigure = document.querySelector<HTMLElement>("[data-film]");
if (filmFigure) film(filmFigure);
const story = document.querySelector<HTMLElement>(".story");
if (story) followStory(story);
for (const figure of document.querySelectorAll<HTMLElement>("[data-run]")) playOnce(figure);
viewer();
