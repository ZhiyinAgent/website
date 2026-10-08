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
