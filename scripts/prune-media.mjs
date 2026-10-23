// Lists the videos in R2 that nothing uses any more, and deletes them when
// asked.
//
//   pnpm media:prune             list the unused videos and their size
//   pnpm media:prune --delete    delete them
//
// A video is unused when media.json does not name it and the live site does
// not show it: each page the build makes is fetched from the site, so a video
// the deployed pages still show is kept even after media.json has moved on.
// Only names shaped like an upload's are ever listed. Deleting cannot be
// undone; read the list first.
//
// Wrangler cannot list a bucket, so the list comes from Cloudflare's API, with
// CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID when they are set, or else
// with the account Wrangler is logged in to. Deleting goes through Wrangler.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { unusedVideos, videosNamedIn } from "../build/media.js";

const BUCKET = "zhiyin-media";
const SITE = "https://zhiyinagent.app";

const root = fileURLToPath(new URL("..", import.meta.url));
const wrangler = join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const remove = process.argv.includes("--delete");
const run = (/** @type {string[]} */ args) =>
  execFileSync(process.execPath, [wrangler, ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

/** The token and account the bucket is listed with. */
function credentials() {
  const token = process.env.CLOUDFLARE_API_TOKEN ?? run(["auth", "token"]).trim().split(/\r?\n/).pop()?.trim();
  let account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!account) {
    const accounts = JSON.parse(run(["whoami", "--json"])).accounts ?? [];
    if (accounts.length !== 1) throw new Error("Wrangler sees more than one account, or none: set CLOUDFLARE_ACCOUNT_ID.");
    account = accounts[0].id;
  }
  if (!token || !account) throw new Error("No Cloudflare credentials: run wrangler login, or set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.");
  return { token, account };
}

/** Every object in the bucket, with its size. */
async function stored() {
  const { token, account } = credentials();
  /** @type {{ key: string, size: number }[]} */
  const objects = [];
  let cursor = "";
  do {
    const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${BUCKET}/objects`);
    url.searchParams.set("per_page", "1000");
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const body = await response.json();
    if (!response.ok || !body.success) throw new Error(`Listing the bucket failed (${response.status}): ${JSON.stringify(body.errors ?? body)}`);
    objects.push(...body.result.map((/** @type {{ key: string, size: number }} */ { key, size }) => ({ key, size })));
    cursor = body.result_info?.is_truncated ? body.result_info.cursor : "";
  } while (cursor);
  return objects;
}

/** The pages the build makes, as paths on the site. */
const pages = (/** @type {string} */ folder) =>
  readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return pages(path);
    if (!entry.name.endsWith(".html")) return [];
    const page = `/${relative(join(root, "dist"), path).split(sep).join("/")}`;
    return [page.replace(/(^|\/)index\.html$/, "$1")];
  });

/** The videos the live site shows. A page that cannot be read stops the run. */
async function live() {
  const paths = pages(join(root, "dist"));
  if (!paths.length) throw new Error("No built pages in dist/: run pnpm build first.");
  const named = await Promise.all(
    paths.map(async (path) => {
      const response = await fetch(`${SITE}${path}`);
      // The 404 page answers 404 by design; anything else must load.
      if (!response.ok && !(path === "/404.html" && response.status === 404)) throw new Error(`${SITE}${path} answered ${response.status}.`);
      return videosNamedIn(await response.text());
    }),
  );
  return named.flat();
}

const manifest = JSON.parse(readFileSync(join(root, "media.json"), "utf8"));
const objects = await stored();
const unused = new Set(unusedVideos(objects.map((object) => object.key), manifest, await live()));
const listed = objects.filter((object) => unused.has(object.key));
const mb = (/** @type {number} */ bytes) => `${(bytes / 1e6).toFixed(1)} MB`;

for (const { key, size } of listed) console.log(`${remove ? "deleting" : "unused"}  ${key}  ${mb(size)}`);
console.log(`${listed.length} of ${objects.length} videos unused, ${mb(listed.reduce((sum, object) => sum + object.size, 0))}.`);
if (!remove) {
  if (listed.length) console.log("Run pnpm media:prune --delete to delete them.");
} else {
  for (const { key } of listed) run(["r2", "object", "delete", `${BUCKET}/${key}`, "--remote"]);
  console.log(`${listed.length} deleted.`);
}
