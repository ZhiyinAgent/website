// The download links and the release notes link point at the release named in
// `.env`. Until that release exists (VITE_RELEASE_OPEN is not "true"), each
// link is shown as an inactive label instead, with the words in its
// `data-soon`, so the site never offers a link that leads nowhere.

const releaseLink = /<a\b([^>]*?)\s+href="%VITE_RELEASE_(?:URL|NOTES)%"([^>]*)>([\s\S]*?)<\/a>/g;
const soon = /\s+data-soon="([^"]*)"/;

/**
 * `html` with its release links kept when the release is open, or made
 * inactive labels when it is not.
 * @param {string} html
 * @param {boolean} open
 */
export function releaseLinks(html, open) {
  return html.replace(releaseLink, (link, /** @type {string} */ before, /** @type {string} */ after) => {
    const label = (before + after).match(soon);
    if (open) return link.replace(soon, "");
    if (!label) throw new Error(`A release link needs data-soon, the words it shows until the release exists: ${link}`);
    const attributes = (before + after).replace(soon, "");
    return `<span${attributes} data-closed aria-disabled="true">${label[1]}</span>`;
  });
}
