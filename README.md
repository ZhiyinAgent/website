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
pnpm media:prune    # list the videos in R2 nothing uses; --delete deletes them
```

`pnpm exec wrangler dev` serves `dist/` the way Cloudflare does, with the
headers from `public/_headers` and the 404 page.

## How it is put together

- `index.html`, `guide/index.html`, `privacy/index.html` and `404.html` are
  the pages. They share `src/partials/` (header, footer, icons), which the
  build inserts where a page says `<!-- @partial name -->`
  (`build/partials.js`), marking the header's link to the page it is on.
- `src/styles/tokens.css` holds every colour, in the app's own tokens: dark
  by default, light when the system asks for it.
- The site shares the trailer's ink identity. It stands on the app's paper:
  warm, grained and darker toward the edges of the window, with a light grain
  over what is read. Everything drawn on it is painted ink, from the same
  simulation that paints the trailer (`trailer/ink/paint.py` in the app's
  repository): the opening's high mountains and flowing water, the Z mark,
  the river at the foot of the page and the drop's rings on it, and the brush
  sweep under which each mounted recording arrives. They live in
  `public/ink/`, each painting as an animated WebP that plays once and holds
  its last drawing, with a still of the finished painting for reduced
  motion, in cream ink for the dark theme and dark ink for the light; the
  sweep is a sprite sheet the styles step through as a mask. Red is the
  app's own accent and appears only on the Download button. Only recordings
  are mounted; everything else is written straight on the paper, divided by
  hairlines. Recorded footage and the commands to type stand above the grain
  and stay clean.
- The display face is Bahnschrift, as in the app and the trailer, at its
  natural width; the wordmark is widely tracked capitals, and 知音 is set in
  KaiTi. Where Bahnschrift is missing, the site falls back to Barlow Semi
  Condensed, which it ships.
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
- The home page reads like a hanging scroll, and like the tune in the name's
  story. It opens as the trailer opens: the landscape painted across the foot
  of the window, the mark painted above the valley with the name beneath it,
  and the promise. The trailer is mounted under it. The story's seven steps
  stand beside one mount, which plays the step being read with its words
  written on the mount, as the trailer writes them; the other runs hang in a
  hall of mounts, the model's name on each, the request and its cost written
  beneath; the plugins are laid out as the app's Plugins page. The name's
  story comes near the end, under the two characters, and the page ends at
  the water, where a drop falls as it comes into view.
- The guide and the missing page carry the same landscape at the foot of
  their heads; the privacy page is the plain writing.

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
old name stays in the bucket for pages already open. Once the new build is
live, `pnpm media:prune` lists the videos neither `media.json` nor the live
site names, with their size, and `pnpm media:prune --delete` deletes them.
It needs `pnpm build` first, to know the site's pages, and Wrangler's login
or `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. A deleted video cannot
be recovered.

## A new release

Change the `VITE_RELEASE_*` values in `.env`. Every download link, the size
and the version on the site come from there. A push deploys at once, so keep
`VITE_RELEASE_OPEN=false` until the release is published on GitHub: until
then each download link shows the words in its `data-soon` attribute, as an
inactive label, and the build stops on a release link without one. Once the
release is up, set the size it shows and `VITE_RELEASE_OPEN=true`.

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
