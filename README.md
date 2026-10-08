# zhiyinagent.app

The website of [Zhiyin](https://github.com/ZhiyinAgent/Zhiyin), an AI agent
for your PC. A static site built with Vite and served by Cloudflare Workers
static assets, with its videos in Cloudflare R2.

## Work on it

Requires Node 22.12 or newer and pnpm (`corepack enable pnpm`).

```
pnpm install
pnpm dev        # live preview at http://localhost:5173
pnpm build      # type-check and build into dist/
pnpm test       # the build's tests
pnpm preview    # serve dist/ as built
pnpm media:upload   # upload new or changed videos to R2 (see Videos)
```

`pnpm exec wrangler dev` serves `dist/` the way Cloudflare does, with the
headers from `public/_headers` and the 404 page.

## How it is put together

- `index.html`, `guide/index.html`, `privacy/index.html` and `404.html` are
  the pages. They share `src/partials/` (header, footer, icons), which the
  build inserts where a page says `<!-- @partial name -->`.
- `src/styles/tokens.css` holds every colour, in the app's own tokens: dark
  by default, light when the system asks for it.
- The display face is Bahnschrift, as in the app. Where it is missing, the
  site falls back to Barlow Semi Condensed, which it ships.
- `public/` is copied as is: icons, the videos' posters, the social image,
  `robots.txt`, `sitemap.xml`, `.well-known/security.txt` and `_headers`.
- The videos are the launch trailer, which plays muted after the hero and
  with sound on request, and the recordings: one clip per step of the story
  and one per example run. Each clip is one continuous stretch of the
  trailer's 4K takes, framed with the trailer's camera, with the pointer
  drawn where the take clicked and speed-ups only while the app works. They
  are 1600 × 900 H.264 without sound, with their first and last frames as
  posters. Each run also has a slower version at 1920 × 1080 (`<run>-long`),
  which opens over the page to be watched large.
- The page is drawn as a qin, from the story of the name. In the hero its
  seven strings ripple like flowing water under the words and rise into high
  mountains beyond them, over the qin's thirteen hui. A single string lies
  between sections, the name section draws the qin itself, and the page closes
  on the seven strings lying as still water. Every set of strings is a canvas
  drawn by `src/scripts/strings.ts`: it draws in when first seen, is plucked
  by a pointer drawn across it, and runs frames only while on screen and
  moving. With reduced motion the strings are drawn once and lie still.
- On a large window the trailer's section holds while the trailer comes in
  and fills the window. That is a CSS scroll-driven animation where the
  browser has them (Chrome, Edge, Safari 26); elsewhere the script follows
  the scroll.

## Videos

The videos are served from R2, at `media.zhiyinagent.app`, which answers a
player's byte ranges itself, so a video can be seeked, and sits behind
Cloudflare's cache. They are not in this repository: keep them in `videos/`
(ignored by git), laid out as the pages name them, `videos/zhiyin-demo.mp4`
and `videos/clips/<name>.mp4`. Their posters stay in `public/media`.

A page names a video by its plain path, `/media/clips/work.mp4`, and the
build writes its address in R2 in its place, from `media.json`; a video
missing from `media.json` stops the build. `pnpm media:upload` stores each
new or changed video under a name carrying a hash of its bytes, with a cache
lifetime of a year, and rewrites `media.json`; commit it. A changed video
gets a new name, so no browser or edge cache ever holds a stale copy. The
old name stays in the bucket for pages already open; remove it by hand once
the new build is live.

## A new release

Change the `VITE_RELEASE_*` values in `.env`. Every download link, the size
and the version on the site come from there.

## Analytics

Cloudflare Web Analytics is added only when `CF_WEB_ANALYTICS_TOKEN` is set,
in `.env` or as a build variable in Cloudflare. The token is public; it ends
up in every page.

## Deploy

Cloudflare Workers Builds deploys on every push to `main`, running
`pnpm build` and then `npx wrangler deploy`. `wrangler.jsonc` attaches the
site to `zhiyinagent.app`. It has no Worker code, so every request to it is
a static asset.

## Security headers

`public/_headers` sets a Content-Security-Policy that allows the page's one
inline script by its SHA-256. If that script changes, update the hash.

## License

Apache License 2.0, as Zhiyin itself.
