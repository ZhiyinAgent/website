import assert from "node:assert/strict";
import { test } from "node:test";
import { insertPartials } from "./partials.js";

const header =
  `<nav><a class="site-nav__link" href="/guide/">Setup guide</a>` +
  `<a class="site-nav__link" href="https://github.com/ZhiyinAgent/Zhiyin">GitHub</a></nav>`;
/** @type {Record<string, string>} */
const files = { header, footer: "<footer></footer>" };
/** @param {string} name */
const read = (name) => files[name] ?? "";

test("a page's partials are put where it names them", () => {
  assert.equal(
    insertPartials(`<body><!-- @partial footer --></body>`, "/privacy/index.html", read),
    `<body><footer></footer></body>`,
  );
});

test("the header marks the link to the page it is on", () => {
  const page = insertPartials(`<!-- @partial header -->`, "/guide/index.html", read);
  assert.match(page, /<a class="site-nav__link" href="\/guide\/" aria-current="page">/);
  assert.equal(page.split("aria-current").length - 1, 1);
});

test("on a page the header has no link to, no link is marked", () => {
  const page = insertPartials(`<!-- @partial header -->`, "/index.html", read);
  assert.doesNotMatch(page, /aria-current/);
});
