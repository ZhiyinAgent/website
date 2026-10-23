import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { placeVideos } from "./build/media.js";
import { insertPartials } from "./build/partials.js";
import { releaseLinks } from "./build/release.js";

const root = import.meta.dirname;

/** The shared header and footer, from `src/partials` (build/partials.js). */
function partials(): Plugin {
  return {
    name: "zhiyin-partials",
    transformIndexHtml: {
      order: "pre",
      handler(html, context) {
        return insertPartials(html, context.path, (name) =>
          readFileSync(resolve(root, "src/partials", `${name}.html`), "utf8"),
        );
      },
    },
  };
}

/**
 * The download and release notes links, made inactive "coming soon" labels
 * until the release is published (build/release.js). It runs after the
 * partials, which carry links of their own.
 */
function release(open: boolean): Plugin {
  return {
    name: "zhiyin-release",
    transformIndexHtml: {
      order: "pre",
      handler: (html) => releaseLinks(html, open),
    },
  };
}

/**
 * The pages name each video by its plain path; the build writes its address
 * in R2 from media.json (build/media.js).
 */
function videos(): Plugin {
  return {
    name: "zhiyin-videos",
    transformIndexHtml(html) {
      return placeVideos(html, JSON.parse(readFileSync(resolve(root, "media.json"), "utf8")));
    },
  };
}

/**
 * Cloudflare Web Analytics, added only when its site token is set, so a local
 * build sends nothing. The token is public: it ends up in every page.
 */
function webAnalytics(token: string | undefined): Plugin {
  return {
    name: "zhiyin-web-analytics",
    transformIndexHtml() {
      if (!token) return [];
      return [
        {
          tag: "script",
          attrs: {
            defer: true,
            src: "https://static.cloudflareinsights.com/beacon.min.js",
            "data-cf-beacon": JSON.stringify({ token }),
          },
          injectTo: "body",
        },
      ];
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");
  return {
    plugins: [
      partials(),
      release(env.VITE_RELEASE_OPEN === "true"),
      videos(),
      webAnalytics(env.CF_WEB_ANALYTICS_TOKEN),
    ],
    build: {
      rolldownOptions: {
        input: {
          home: resolve(root, "index.html"),
          guide: resolve(root, "guide/index.html"),
          privacy: resolve(root, "privacy/index.html"),
          notFound: resolve(root, "404.html"),
        },
      },
    },
  };
});
