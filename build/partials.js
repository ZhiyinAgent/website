// Every page shares the same header and footer. A page names them with an
// HTML comment, `<!-- @partial header -->`, and the build puts the partial in
// its place, so the pages stay plain HTML. The header's link to the page it
// is on is marked as the current page.

/**
 * @param {string} html the page
 * @param {string} pagePath the page's path in the site, as `/guide/index.html`
 * @param {(name: string) => string} read a partial's HTML, by its name
 */
export function insertPartials(html, pagePath, read) {
  const address = pagePath.replace(/index\.html$/, "");
  return html.replace(/<!-- @partial ([a-z-]+) -->/g, (_, name) =>
    read(name).replaceAll(
      `<a class="site-nav__link" href="${address}">`,
      `<a class="site-nav__link" href="${address}" aria-current="page">`,
    ),
  );
}
