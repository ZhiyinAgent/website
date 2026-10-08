import { reducedMotion } from "./site";

/**
 * Strings drawn on a canvas, as a qin's are. Each lies where its instrument
 * says, is plucked by a pointer drawn across it or by the instrument itself,
 * and swings from its two ends until it is still again. The strings draw in
 * the first time they are seen. Frames run only while they are on screen and
 * something moves; with reduced motion they are drawn once and lie still.
 */

/** Where a qin's thirteen hui sit along a string, as shares of its length. */
export const HUI = [1 / 8, 1 / 6, 1 / 5, 1 / 4, 1 / 3, 2 / 5, 1 / 2, 3 / 5, 2 / 3, 3 / 4, 4 / 5, 5 / 6, 7 / 8];

export const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

export const smooth = (value: number) => {
  const v = clamp(value, 0, 1);
  return v * v * (3 - 2 * v);
};

/** The colours the strings take from the page: their ink, a plucked string's, and the hui's. */
export type Ink = { ink: string; lit: string; pearl: string };

export type Instrument = {
  readonly count: number;
  /** Lays the strings out for the canvas's box, in px from its top left. */
  measure(box: DOMRect): void;
  /** Where string `i` lies at `x`, `t` seconds in, when still. */
  lie(i: number, x: number, t: number): number;
  /** Where string `i` is held, at its two ends. */
  span(i: number): readonly [number, number];
  /** How thick string `i` is, in px. */
  thickness(i: number): number;
  /** Where the strings fade into the page: at the left edge, at both ends, or nowhere. */
  readonly fade: "left" | "ends" | "none";
  /** Whether the strings move on their own, as water does. */
  readonly flowing: boolean;
  /** How long the strings take to draw in once seen, in ms. */
  readonly drawIn: number;
  /** Draws what goes with the strings, behind them, `shown` from 0 to 1 as they draw in. */
  dress?(context: CanvasRenderingContext2D, shown: number, ink: Ink): void;
  /** Plucks the strings on its own, `since` ms after they have drawn in, on each frame. */
  play?(since: number, pluck: (i: number, x: number, strength: number) => void): void;
};

/** Distance between the points a string is drawn through, in px. */
const STEP = 3;
/** How long a plucked string sounds, in s. */
const RING = 3;

type Pluck = { at: number; x: number; strength: number };

/** `rgb(r, g, b)` as the same colour at `alpha`. */
const withAlpha = (colour: string, alpha: number) => {
  const [r = 0, g = 0, b = 0] = colour.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Draws `instrument`'s strings on `canvas`; a pointer moving over `root` plucks them. */
export function mountStrings(root: HTMLElement, canvas: HTMLCanvasElement, instrument: Instrument) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const { count } = instrument;
  let width = 0;
  let height = 0;
  const ink: Ink = { ink: "", lit: "", pearl: "" };
  let stroke: CanvasGradient | string = "";
  const plucks: Pluck[][] = Array.from({ length: count }, () => []);
  let xs = new Float32Array(0);
  let ys = new Float32Array(0);
  let start = 0;

  const colours = () => {
    const style = getComputedStyle(canvas);
    ink.ink = style.color;
    ink.lit = style.getPropertyValue("--pluck").trim();
    ink.pearl = style.getPropertyValue("--pearl").trim() || ink.ink;
    if (instrument.fade === "none") {
      stroke = ink.ink;
      return;
    }
    const gradient = context.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, withAlpha(ink.ink, 0));
    gradient.addColorStop(instrument.fade === "left" ? 0.16 : 0.12, withAlpha(ink.ink, 1));
    if (instrument.fade === "ends") {
      gradient.addColorStop(0.88, withAlpha(ink.ink, 1));
      gradient.addColorStop(1, withAlpha(ink.ink, 0));
    }
    stroke = gradient;
  };

  const measure = () => {
    const box = canvas.getBoundingClientRect();
    width = box.width;
    height = box.height;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    xs = new Float32Array(Math.ceil(width / STEP) + 3);
    ys = new Float32Array(xs.length);
    instrument.measure(box);
    colours();
  };

  /** How far string `i`'s plucks move it at `x`, at `t` seconds. */
  const sounding = (i: number, x: number, t: number) => {
    const [from, to] = instrument.span(i);
    let moved = 0;
    for (const pluck of plucks[i]!) {
      const age = t - pluck.at;
      // The whole string swings from its two ends, around where it was
      // plucked, and shivers there a little longer.
      const shape = x < pluck.x ? (x - from) / (pluck.x - from) : (to - x) / (to - pluck.x);
      const swing = Math.exp(-age * 1.5) * Math.cos(age * Math.PI * 2 * 3.6) * clamp(shape, 0, 1);
      const near = Math.exp(-(((x - pluck.x) / 110) ** 2));
      const shiver = 0.45 * Math.exp(-age * 2.6) * near * Math.sin(age * Math.PI * 2 * 9 + (x - pluck.x) / 8);
      moved += pluck.strength * (swing + shiver);
    }
    return moved;
  };

  const ringing = (i: number, t: number) =>
    plucks[i]!.reduce((sum, pluck) => sum + (pluck.strength / 10) * Math.exp(-(t - pluck.at) * 1.5), 0);

  const draw = (now: number) => {
    const t = now / 1000;
    const shown = reducedMotion ? 1 : start ? clamp((now - start) / instrument.drawIn, 0, 1) : 0;
    context.clearRect(0, 0, width, height);
    context.lineJoin = "round";
    context.lineCap = "round";
    instrument.dress?.(context, shown, ink);
    for (let i = 0; i < count; i++) {
      plucks[i] = plucks[i]!.filter((pluck) => t - pluck.at < RING);
      const [from, to] = instrument.span(i);
      // Drawn in from the left, the lowest string a little ahead.
      const end = from + (to - from) * smooth(shown * 1.35 - (count - 1 - i) * 0.05);
      if (end <= from) continue;
      let n = 0;
      for (let x = from; n < xs.length; x += STEP) {
        const at = Math.min(x, end);
        xs[n] = at;
        ys[n++] = instrument.lie(i, at, t) + sounding(i, at, t);
        if (at >= end) break;
      }
      const trace = () => {
        context.beginPath();
        context.moveTo(xs[0]!, ys[0]!);
        for (let k = 1; k < n; k++) context.lineTo(xs[k]!, ys[k]!);
      };
      context.lineWidth = instrument.thickness(i);
      context.globalAlpha = 0.5;
      context.strokeStyle = stroke;
      trace();
      context.stroke();
      const energy = ringing(i, t);
      if (energy > 0.02 && ink.lit) {
        context.globalAlpha = Math.min(0.9, energy);
        context.strokeStyle = ink.lit;
        trace();
        context.stroke();
      }
    }
    context.globalAlpha = 1;
  };

  measure();
  if (reducedMotion) {
    draw(0);
    new ResizeObserver(() => {
      measure();
      draw(0);
    }).observe(canvas);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      colours();
      draw(0);
    });
    return;
  }

  let frame = 0;
  let onScreen = false;
  const awake = () => onScreen && document.visibilityState === "visible";
  const moving = (now: number) =>
    instrument.flowing || now - start < instrument.drawIn || plucks.some((list) => list.length > 0);

  const pluck = (i: number, x: number, strength: number, now: number) => {
    const [from, to] = instrument.span(i);
    const last = plucks[i]!.at(-1);
    if (last && now / 1000 - last.at < 0.12) return;
    const inset = (to - from) * 0.04;
    plucks[i]!.push({ at: now / 1000, x: clamp(x, from + inset, to - inset), strength });
  };

  const tick = (now: number) => {
    frame = 0;
    if (!start) start = now;
    const since = now - start - instrument.drawIn;
    if (since >= 0) instrument.play?.(since, (i, x, strength) => pluck(i, x, strength, now));
    draw(now);
    if (awake() && moving(now)) frame = requestAnimationFrame(tick);
  };
  const wake = () => {
    if (!frame && awake()) frame = requestAnimationFrame(tick);
  };

  // Seen once well inside the window, not as its edge reaches it.
  new IntersectionObserver(
    ([entry]) => {
      onScreen = !!entry?.isIntersecting;
      if (onScreen) wake();
      else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    },
    { rootMargin: "0px 0px -12% 0px" },
  ).observe(canvas);
  document.addEventListener("visibilitychange", wake);
  new ResizeObserver(() => {
    measure();
    if (!frame && start) draw(performance.now());
  }).observe(canvas);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    colours();
    if (!frame && start) draw(performance.now());
  });

  // A pointer plucks each string it crosses, harder the faster it moves.
  let previous: { x: number; y: number } | null = null;
  root.addEventListener(
    "pointermove",
    (event) => {
      if (!start) return;
      const box = canvas.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      if (previous) {
        const now = performance.now();
        for (let i = 0; i < count; i++) {
          const [from, to] = instrument.span(i);
          if (x < from || x > to) continue;
          const before = previous.y - instrument.lie(i, previous.x, now / 1000);
          const after = y - instrument.lie(i, x, now / 1000);
          if (before * after <= 0 && before !== after) {
            pluck(i, x, clamp(3 + Math.abs(y - previous.y) * 0.3, 3, 11), now);
            wake();
          }
        }
      }
      previous = { x, y };
    },
    { passive: true },
  );
  root.addEventListener("pointerleave", () => {
    previous = null;
  });
}
