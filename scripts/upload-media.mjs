// Uploads the site's videos to R2 and records the name each is stored under.
//
//   pnpm media:upload            upload new and changed videos
//   pnpm media:upload --all      upload every video again
//
// The videos are kept in videos/, out of git. Each is stored under a name
// carrying a hash of its bytes (build/media.js), with a cache lifetime of a
// year, and media.json is rewritten to match. Commit media.json after an
// upload: the pages are built from it. A replaced video's old name stays in
// the bucket, so pages already in browsers keep working; remove old names by
// hand once a new build is live.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { storedName } from "../build/media.js";

const BUCKET = "zhiyin-media";
const CACHE = "public, max-age=31536000, immutable";

const root = fileURLToPath(new URL("..", import.meta.url));
// Wrangler run by Node itself, with no shell between: a shell would split the
// cache lifetime at its spaces.
const wrangler = join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const source = join(root, "videos");
const manifestFile = join(root, "media.json");
const all = process.argv.includes("--all");

if (!existsSync(source)) throw new Error("No videos/ folder: put the site's videos there first.");
/** @type {Record<string, string>} */
const before = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, "utf8")) : {};

/** @param {string} folder @returns {string[]} */
const videos = (folder) =>
  readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return videos(path);
    return entry.name.endsWith(".mp4") ? [path] : [];
  });

/** @type {Record<string, string>} */
const after = {};
for (const file of videos(source).sort()) {
  const path = relative(source, file).split(sep).join("/");
  const name = storedName(path, readFileSync(file));
  after[path] = name;
  if (!all && before[path] === name) continue;
  console.log(`uploading ${path} as ${name}`);
  execFileSync(
    process.execPath,
    [wrangler, "r2", "object", "put", `${BUCKET}/${name}`, "--file", file,
      "--content-type", "video/mp4", "--cache-control", CACHE, "--remote"],
    { cwd: root, stdio: ["ignore", "ignore", "inherit"] },
  );
}

writeFileSync(manifestFile, `${JSON.stringify(after, null, 2)}\n`);
console.log(`media.json lists ${Object.keys(after).length} videos.`);
