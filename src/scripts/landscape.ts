import { HUI, clamp, smooth, type Instrument } from "./strings";

/**
 * The page opens and closes on a qin's seven strings. Zhiyin is "one who
 * knows the tune": when Bo Ya's music turned to flowing water, his friend
 * heard the river, and when it turned to high mountains, he heard the
 * mountains. In the hero the strings ripple like water under the words and
 * rise into mountains beyond them, over the thirteen hui; now and then one is
 * plucked at a hui, as if someone were playing. At the close they lie as
 * still water.
 */

const STRINGS = 7;

/**
 * The mountains, as the range each string raises above the string below it,
 * the highest string's first: peaks as [centre, width to the left, width to
 * the right, height], across the hero's width. A string carries the ranges of
 * every string below it too, so the strings never cross and the highest draws
 * the tallest range, like ranges behind ranges.
 */
const RANGES: [number, number, number, number][][] = [
  [[0.78, 0.05, 0.04, 0.85], [0.7, 0.03, 0.025, 0.4], [0.86, 0.03, 0.035, 0.45]],
  [[0.82, 0.035, 0.035, 0.4], [0.66, 0.04, 0.03, 0.25], [0.9, 0.03, 0.03, 0.3]],
  [[0.745, 0.035, 0.04, 0.38], [0.87, 0.03, 0.03, 0.22]],
  [[0.7, 0.05, 0.03, 0.28], [0.91, 0.03, 0.04, 0.2]],
  [[0.8, 0.05, 0.04, 0.24], [0.62, 0.05, 0.04, 0.14]],
  [[0.73, 0.06, 0.045, 0.18], [0.93, 0.04, 0.04, 0.12]],
  [[0.84, 0.08, 0.06, 0.14], [0.67, 0.08, 0.08, 0.08]],
];
/** The broad rise every range stands on. */
const FOOT: [number, number, number, number] = [0.78, 0.18, 0.1, 0.05];

/** The height string `k`'s own range adds at `u`, never below nothing. */
function layer(k: number, u: number) {
  let sum = 0;
  for (const [centre, left, right, size] of [...RANGES[k]!, FOOT]) {
    const off = u - centre;
    sum += size * Math.exp(-((Math.abs(off) / (off < 0 ? left : right)) ** 1.6));
  }
  // Rock is rough: a little unevenness on every slope.
  const rough = 0.06 * Math.sin(u * 71 + k * 1.3) + 0.03 * Math.sin(u * 157 + k * 2.1);
  return sum * (1 + rough);
}

let tallest = 0;
for (let u = 0; u <= 1; u += 0.001) {
  let sum = 0;
  for (let k = 0; k < STRINGS; k++) sum += layer(k, u);
  tallest = Math.max(tallest, sum);
}

/** How high string `i` stands at `u`, 1 at the top of the highest peak. */
function mountain(i: number, u: number) {
  let sum = 0;
  for (let k = i; k < STRINGS; k++) sum += layer(k, u);
  return sum / tallest;
}

/** How far water moves string `i` at `x`, `t` seconds in, at full flow. */
const ripple = (i: number, x: number, t: number) =>
  (1.4 + i * 0.42) * (Math.sin(x / (24 + i * 3) - t * 1.15 + i * 0.9) + 0.5 * Math.sin(x / 63 - t * 0.55 + i * 2.3));

/** Distance between the points the mountains are kept at, in px. */
const SAMPLE = 3;

/** The hero's strings: water under the words, mountains beyond them. */
export function heroLandscape(hero: HTMLElement): Instrument {
  const copy = hero.querySelector<HTMLElement>(".hero__copy");
  const more = hero.querySelector<HTMLElement>(".hero__more");
  let width = 0;
  let gap = 10;
  let base = 0;
  let heights: Float32Array[] = [];
  let nextNote = 0;

  return {
    count: STRINGS,
    fade: "left",
    flowing: true,
    drawIn: 2400,
    measure(box) {
      width = box.width;
      gap = clamp(width * 0.0085, 8, 12);
      // The lowest string lies above the way on to the trailer; the range
      // rises to near the top on a wide window, where the words leave it
      // room, and to just under the words on a narrow one.
      const way = more ? more.getBoundingClientRect().top - box.top : box.height;
      base = way - gap * 2.6;
      const top = base - (STRINGS - 1) * gap;
      const ceiling =
        width >= 1024 || !copy ? box.height * 0.13 : copy.getBoundingClientRect().bottom - box.top + 28;
      const rise = Math.max(0, top - ceiling);
      const count = Math.ceil(width / SAMPLE) + 2;
      heights = Array.from({ length: STRINGS }, (_, i) =>
        Float32Array.from({ length: count }, (_, n) => rise * mountain(i, (n * SAMPLE) / width)),
      );
    },
    lie(i, x, t) {
      const own = heights[i]!;
      const lift = own[clamp(Math.round(x / SAMPLE), 0, own.length - 1)] ?? 0;
      // Water flows under the words and stills where the range begins.
      const calm = 1 - smooth((x / width - 0.38) / 0.22);
      return base - (STRINGS - 1 - i) * gap - lift + calm * ripple(i, x, t);
    },
    span: () => [0, width],
    // Lower strings are the thicker ones, as on a qin seen from its player.
    thickness: (i) => 0.75 + i * 0.14,
    dress(context, shown, ink) {
      // The hui, under the strings, appear as the lowest string passes them.
      const reached = width * smooth(shown * 1.35);
      context.globalAlpha = 0.55;
      context.fillStyle = ink.pearl;
      for (const at of HUI) {
        const x = width * at;
        if (x > reached) continue;
        context.beginPath();
        context.arc(x, base + gap * 1.5, at === 1 / 2 ? 2.6 : 1.7, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    },
    // Someone plays now and then, at a hui.
    play(since, pluck) {
      if (since < 400) return;
      if (!nextNote) nextNote = since + 600;
      if (since < nextNote) return;
      const i = Math.floor(Math.random() * STRINGS);
      const at = HUI[Math.floor(Math.random() * HUI.length)]!;
      pluck(i, width * at, 3 + Math.random() * 3);
      nextNote = since + 2200 + Math.random() * 2600;
    },
  };
}

/** The closing's strings: the same seven, lying as still water. */
export function closingWater(): Instrument {
  let width = 0;
  let gap = 10;
  let middle = 0;
  return {
    count: STRINGS,
    fade: "ends",
    flowing: true,
    drawIn: 2200,
    measure(box) {
      width = box.width;
      gap = clamp(width * 0.0085, 8, 12);
      middle = box.height / 2;
    },
    lie: (i, x, t) => middle + (i - (STRINGS - 1) / 2) * gap + 0.55 * ripple(i, x, t * 0.7),
    span: () => [0, width],
    thickness: (i) => 0.75 + i * 0.14,
  };
}
