import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { placeVideos } from "./build/media.js";

const root = import.meta.dirname;

/**
 * Every page shares the same header and footer. A page names them with an
 * HTML comment, `<!-- @partial header -->`, and the build puts the file from
 * `src/partials` in its place, so the pages stay plain HTML.
 */
function partials(): Plugin {
  return {
    name: "zhiyin-partials",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html.replace(/<!-- @partial ([a-z-]+) -->/g, (_, name: string) =>
          readFileSync(resolve(root, "src/partials", `${name}.html`), "utf8"),
        );
      },
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
    plugins: [partials(), videos(), webAnalytics(env.CF_WEB_ANALYTICS_TOKEN)],
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
