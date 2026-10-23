import { reducedMotion } from "./site";
import "../styles/home.css";

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

/**
 * The trailer plays quietly while it is on screen. Asked for, it comes into
 * the window if it is not already, starts over with sound and its controls,
 * and goes quiet again once it has ended. With reduced motion it waits to be
 * asked.
 */
function film(figure: HTMLElement) {
  const video = figure.querySelector("video");
  if (!video) return;
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
    const box = figure.getBoundingClientRect();
    if (box.top < 64 || box.bottom > window.innerHeight) {
      figure.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    }
    video.focus({ preventScroll: true });
  };
  for (const button of document.querySelectorAll("[data-film-sound]")) {
    button.addEventListener("click", listen);
  }
  video.addEventListener("click", () => {
    if (!loud()) listen();
  });
  // Once watched, it holds on its last frame and plays quietly again the
  // next time it comes on screen.
  video.addEventListener("ended", () => {
    if (!loud()) return;
    figure.removeAttribute("data-sound");
    video.controls = false;
    video.muted = true;
    video.loop = true;
  });
}

/**
 * Gives a recording its controls on the mount's label: a way to watch it
 * again once it has ended and, for a run, a way to watch it larger.
 */
function addControls(figure: HTMLElement, video: HTMLVideoElement) {
  const template = document.querySelector<HTMLTemplateElement>("#screen-controls");
  const actions = template?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
  const label = figure.parentElement?.querySelector(".mount__label");
  if (!actions || !label) return;
  const replay = actions.querySelector<HTMLButtonElement>(".screen__replay");
  if (reducedMotion) replay?.remove();
  replay?.addEventListener("click", () => {
    video.currentTime = 0;
    play(video);
  });
  if (!figure.dataset.long) actions.querySelector(".screen__open")?.remove();
  if (actions.querySelector("button")) label.append(actions);
  const ended = (now: boolean) => {
    figure.toggleAttribute("data-ended", now);
    label.toggleAttribute("data-ended", now);
  };
  video.addEventListener("ended", () => ended(true));
  video.addEventListener("play", () => ended(false));
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
 * The story's mount shows the step being read: the step in the middle of the
 * window lights up, its title is written on the mount, and its recording
 * plays once, crossing in over the one before. Once it has ended, the way on
 * leads to the next step, or after the last, to the other runs. On a narrow
 * window each step has its own mounted recording instead.
 */
function followStory(story: HTMLElement) {
  const steps = [...story.querySelectorAll<HTMLElement>(".story__step")];
  const screen = story.querySelector<HTMLElement>("[data-screen]");
  if (!screen) return;
  const videos = [...screen.querySelectorAll<HTMLVideoElement>("video")];
  const title = screen.querySelector("[data-step-title]");
  const count = screen.querySelector("[data-step-at]");
  const wide = window.matchMedia("(min-width: 961px)");
  let current: HTMLVideoElement | undefined;
  let onScreen = false;
  let at = 0;

  const mark = () => {
    const ended = !!current?.ended;
    screen.toggleAttribute("data-ended", ended);
  };
  for (const video of videos) {
    video.addEventListener("ended", mark);
    video.addEventListener("play", mark);
  }
  const next = screen.querySelector<HTMLButtonElement>("[data-next]");
  const nextLabel = next?.querySelector("[data-next-label]");

  const start = () => {
    if (!current || !onScreen || !wide.matches || reducedMotion) return;
    if (current.ended) current.currentTime = 0;
    play(current);
  };

  const show = (clip: string) => {
    at = steps.findIndex((step) => step.dataset.clip === clip);
    steps.forEach((step, index) => step.toggleAttribute("data-active", index === at));
    if (title) title.textContent = steps[at]?.querySelector("h3")?.textContent?.trim() ?? "";
    if (count) count.textContent = String(at + 1);
    current = videos.find((video) => video.dataset.clip === clip);
    for (const video of videos) {
      video.toggleAttribute("data-active", video === current);
      if (video !== current) video.pause();
    }
    screen.toggleAttribute("data-sped", !!current?.hasAttribute("data-sped"));
    if (nextLabel) nextLabel.textContent = at < steps.length - 1 ? "Next step" : "More runs";
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

  // Narrow: each step gets its own recording, mounted under its words.
  const inline: HTMLVideoElement[] = [];
  for (const step of steps) {
    const source = videos.find((video) => video.dataset.clip === step.dataset.clip);
    if (!source) continue;
    const mount = document.createElement("div");
    mount.className = "mount story__inline";
    const figure = document.createElement("figure");
    figure.className = "mount__picture";
    const copy = source.cloneNode(true) as HTMLVideoElement;
    copy.removeAttribute("data-active");
    copy.controls = false;
    figure.append(copy);
    const label = document.createElement("div");
    label.className = "mount__label";
    const note = document.createElement("span");
    note.className = "mount__note";
    note.textContent = copy.hasAttribute("data-sped") ? "Sped up" : "";
    label.append(note);
    // The last step's mount opens the whole run, as the shared mount does.
    const story = screen.querySelector<HTMLElement>("[data-long]");
    if (step === steps.at(-1) && story) {
      Object.assign(figure.dataset, { long: story.dataset.long, longNote: story.dataset.longNote ?? "", ask: story.dataset.ask ?? "" });
    }
    mount.append(figure, label);
    step.append(mount);
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
    const typed = figure.dataset.ask ?? figure.closest(".run")?.querySelector(".run__ask")?.textContent ?? "";
    ask.textContent = typed.replace(/\s+/g, " ").trim();
    note.textContent = figure.dataset.longNote ?? "";
    if (video.getAttribute("src") !== long) video.src = long;
    video.currentTime = 0;
    for (const playing of figure.querySelectorAll("video")) playing.pause();
    dialog.showModal();
    if (!reducedMotion) play(video);
  };
  for (const figure of document.querySelectorAll<HTMLElement>("[data-long]")) {
    figure.parentElement?.querySelector("[data-open-long]")?.addEventListener("click", () => open(figure));
    // A run's own recording opens it too; the story's steps keep their clicks.
    if (!reducedMotion && figure.hasAttribute("data-run"))
      figure.querySelector("video")?.addEventListener("click", () => open(figure));
  }
  dialog.querySelector("[data-viewer-close]")?.addEventListener("click", () => dialog.close());
  // A click on the dimmed page around it closes it.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => video.pause());
}

/**
 * The plugins: choosing one marks it and shows its page, beside the list on
 * a wide window and under it on a narrow one. The other pages stay laid out,
 * unseen, so the section keeps the height of the tallest and the page does
 * not move as one is chosen; unseen, they are out of reach of the keyboard
 * and of screen readers. The arrow keys move along the list, as in a set of
 * tabs.
 */
function shelf(root: HTMLElement) {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>("[data-plugin]")];
  const choose = (chosen: HTMLButtonElement) => {
    for (const tab of tabs) {
      tab.setAttribute("aria-expanded", String(tab === chosen));
      const panel = document.getElementById(tab.getAttribute("aria-controls") ?? "");
      panel?.toggleAttribute("data-unchosen", tab !== chosen);
      panel?.toggleAttribute("inert", tab !== chosen);
    }
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => choose(tab));
    tab.addEventListener("keydown", (event) => {
      const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
      if (!step) return;
      const to = tabs[(index + step + tabs.length) % tabs.length];
      if (!to) return;
      event.preventDefault();
      to.focus();
      choose(to);
    });
  });
  const first = tabs.find((tab) => tab.getAttribute("aria-expanded") === "true") ?? tabs[0];
  if (first) choose(first);
}

const plugins = document.querySelector<HTMLElement>("[data-shelf]");
if (plugins) shelf(plugins);
const filmFigure = document.querySelector<HTMLElement>("[data-film]");
if (filmFigure) film(filmFigure);
const story = document.querySelector<HTMLElement>(".story");
if (story) followStory(story);
for (const figure of document.querySelectorAll<HTMLElement>("[data-run]")) playOnce(figure);
viewer();
