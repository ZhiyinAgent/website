import { HUI, clamp, smooth, type Instrument } from "./strings";

/**
 * A qin seen from above, as its player sees it: a long body, head to the
 * right, in the shape named for Confucius (Zhongni), with a shallow cut at its
 * waist and at its neck. Seven strings run from the dragon's gums at the tail
 * over the bridge (the yueshan) to the string holes in the head, the first
 * string, the thickest, farthest from the player; the thirteen hui are inlaid
 * along the near edge where the harmonics are played. It is drawn in once
 * seen, and its strings are run through once, from the nearest.
 */

const STRINGS = 7;
/** Along the body, as shares of its length from the tail. */
const GUMS = 0.02;
const BRIDGE = 0.94;
const HOLES = 0.972;
/** How wide the body is against its length, as on a qin of 120 cm. */
const WIDTH = 0.16;

/** Half the body's width at `u` along it, as a share of its widest. */
function halfWidth(u: number) {
  if (u < 0.33) return 0.345 + 0.035 * (u / 0.33);
  // The waist's cut.
  if (u < 0.38) return 0.362;
  if (u < 0.82) return 0.385 + 0.115 * smooth((u - 0.38) / 0.44);
  // The shoulders, then the neck's cut, then the head.
  if (u < 0.85) return 0.5;
  if (u < 0.88) return 0.43;
  return 0.45;
}

/** Where string `i` crosses the body at `u`, as a share of its widest from the centre line. */
function across(i: number, u: number) {
  const atGums = -0.21 + (i * 0.42) / (STRINGS - 1);
  const atBridge = -0.31 + (i * 0.62) / (STRINGS - 1);
  return atGums + (atBridge - atGums) * ((u - GUMS) / (BRIDGE - GUMS));
}

export function qinInstrument(): Instrument {
  let left = 0;
  let length = 0;
  let wide = 0;
  let centre = 0;
  let struck = 0;
  let outline: Path2D | null = null;
  let around = 0;

  const at = (u: number) => left + u * length;

  return {
    count: STRINGS,
    fade: "none",
    flowing: false,
    drawIn: 1800,
    measure(box) {
      length = Math.min(box.width * 0.98, (box.height * 0.82) / WIDTH);
      wide = length * WIDTH;
      left = (box.width - length) / 2;
      centre = box.height / 2;
      // The body's outline, with its cuts, and a little rounding at each end.
      const path = new Path2D();
      const corner = wide * 0.05;
      const edge = (u: number, side: number) => centre + side * halfWidth(u) * wide;
      const inset = corner / length;
      path.moveTo(at(inset), edge(0, -1));
      for (let u = inset; u < 1 - inset; u += 0.002) path.lineTo(at(u), edge(u, -1));
      path.arcTo(at(1), edge(1, -1), at(1), centre, corner);
      path.arcTo(at(1), edge(1, 1), at(1) - corner, edge(1, 1), corner);
      for (let u = 1 - inset; u > inset; u -= 0.002) path.lineTo(at(u), edge(u, 1));
      path.arcTo(at(0), edge(0, 1), at(0), centre, corner);
      path.arcTo(at(0), edge(0, -1), at(0) + corner, edge(0, -1), corner);
      path.closePath();
      outline = path;
      around = 2 * length + 2 * wide;
    },
    lie: (i, x) => centre + across(i, clamp((x - left) / length, GUMS, BRIDGE)) * wide,
    span: () => [at(GUMS), at(BRIDGE)],
    // The first string, farthest from the player, is the thickest.
    thickness: (i) => 1.5 - i * 0.12,
    dress(context, shown, ink) {
      if (!outline) return;
      // The body draws itself around, then fills faintly.
      context.strokeStyle = ink.ink;
      context.lineWidth = 1;
      context.globalAlpha = 0.04 * smooth(shown * 2 - 1);
      context.fillStyle = ink.ink;
      context.fill(outline);
      context.globalAlpha = 0.5;
      context.setLineDash([around * smooth(shown * 1.4), around]);
      context.stroke(outline);
      context.setLineDash([]);
      const appear = smooth(shown * 2 - 0.9);
      if (appear <= 0) return;
      // The bridge and the dragon's gums, which the strings run between.
      context.globalAlpha = 0.6 * appear;
      context.lineWidth = Math.max(1.5, wide * 0.014);
      for (const [u, reach] of [
        [BRIDGE, 0.4],
        [GUMS, 0.27],
      ] as const) {
        context.beginPath();
        context.moveTo(at(u), centre - reach * wide);
        context.lineTo(at(u), centre + reach * wide);
        context.stroke();
      }
      // Past the bridge the strings run on to their holes in the head.
      context.lineWidth = 1;
      context.globalAlpha = 0.35 * appear;
      context.fillStyle = ink.ink;
      for (let i = 0; i < STRINGS; i++) {
        const y = centre + across(i, BRIDGE) * wide;
        context.beginPath();
        context.moveTo(at(BRIDGE), y);
        context.lineTo(at(HOLES), y);
        context.stroke();
        context.beginPath();
        context.arc(at(HOLES), y, Math.max(1.2, wide * 0.008), 0, Math.PI * 2);
        context.fill();
      }
      // The hui, inlaid near the edge closest to the player, measured from
      // the bridge along the sounding length.
      context.globalAlpha = 0.7 * appear;
      context.fillStyle = ink.pearl;
      for (const share of HUI) {
        const u = BRIDGE - share * (BRIDGE - GUMS);
        context.beginPath();
        context.arc(at(u), centre + (0.3 + 0.07 * u) * wide, wide * (share === 1 / 2 ? 0.017 : 0.012), 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
    },
    // Once drawn, the strings are run through, from the nearest to the farthest,
    // where a player's right hand plucks, between the bridge and the first hui.
    play(since, pluck) {
      for (const due = Math.floor(since / 90); struck < STRINGS && struck <= due; struck++) {
        pluck(STRINGS - 1 - struck, at(BRIDGE - 0.07), 4.5);
      }
    },
  };
}

/** A single string between sections, plucked once as it comes into view. */
export function breakString(): Instrument {
  let width = 0;
  let middle = 0;
  let plucked = false;
  return {
    count: 1,
    fade: "ends",
    flowing: false,
    drawIn: 1100,
    measure(box) {
      width = box.width;
      middle = box.height / 2;
    },
    lie: () => middle,
    span: () => [0, width],
    thickness: () => 1,
    play(_since, pluck) {
      if (plucked) return;
      plucked = true;
      pluck(0, width * (0.3 + Math.random() * 0.4), 6);
    },
  };
}
