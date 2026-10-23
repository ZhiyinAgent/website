// The site's videos live in R2 and are served from MEDIA_ORIGIN, each under a
// name carrying a hash of its bytes: a changed video gets a new name, so any
// copy of a name, in a browser or at Cloudflare's edge, is never stale and is
// kept for a year. `media.json` maps each video's plain path to that name. The
// pages name a video by its plain path, `/media/<path>.mp4`, and the build
// writes its address in R2 in its place.

import { createHash } from "node:crypto";

export const MEDIA_ORIGIN = "https://media.zhiyinagent.app";

/**
 * The name a video is stored under: its path, with a hash of its bytes before
 * the extension.
 * @param {string} path
 * @param {Uint8Array} bytes
 */
export function storedName(path, bytes) {
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  const dot = path.lastIndexOf(".");
  return `${path.slice(0, dot)}.${hash}${path.slice(dot)}`;
}

/**
 * `html` with each `/media/<path>.mp4` replaced by the video's address in R2.
 * A video missing from `manifest` stops the build rather than leaving a page
 * with a video that cannot load.
 * @param {string} html
 * @param {Record<string, string>} manifest
 * @param {string} [origin]
 */
export function placeVideos(html, manifest, origin = MEDIA_ORIGIN) {
  return html.replace(/\/media\/([\w./-]+\.mp4)/g, (_, /** @type {string} */ path) => {
    const stored = manifest[path];
    if (!stored) throw new Error(`The video ${path} is not in media.json: add it to videos/ and run pnpm media:upload.`);
    return `${origin}/${stored}`;
  });
}

/** A name as `storedName` makes it: a path, a 12-digit hash, then `.mp4`. */
const STORED = /^[\w./-]+\.[0-9a-f]{12}\.mp4$/;

/**
 * The stored names of the videos a built page shows, read from their
 * addresses in R2.
 * @param {string} html
 * @param {string} [origin]
 */
export function videosNamedIn(html, origin = MEDIA_ORIGIN) {
  const at = new RegExp(`${origin.replace(/[.]/g, "\\.")}/([\\w./-]+\\.mp4)`, "g");
  return [...html.matchAll(at)].map((match) => /** @type {string} */ (match[1]));
}

/**
 * The stored videos nothing uses any more: named neither in `manifest` nor by
 * the live site. Only names shaped like an upload's are ever listed.
 * @param {string[]} stored
 * @param {Record<string, string>} manifest
 * @param {string[]} live
 */
export function unusedVideos(stored, manifest, live) {
  const used = new Set([...Object.values(manifest), ...live]);
  return stored.filter((name) => STORED.test(name) && !used.has(name));
}
