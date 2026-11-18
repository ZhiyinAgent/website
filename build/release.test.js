import assert from "node:assert/strict";
import { test } from "node:test";
import { releaseLinks } from "./release.js";

const download = `<a class="button button--red" href="%VITE_RELEASE_URL%" data-soon="Download coming soon"><svg></svg> Download for Windows</a>`;
const notes = `<li><a href="%VITE_RELEASE_NOTES%" data-soon="Release notes coming soon">Release notes</a></li>`;

test("a closed release shows each download link as an inactive label saying it is coming", () => {
  assert.equal(
    releaseLinks(download, false),
    `<span class="button button--red" data-closed aria-disabled="true">Download coming soon</span>`,
  );
});

test("a closed release shows the release notes link as an inactive label too", () => {
  assert.equal(releaseLinks(notes, false), `<li><span data-closed aria-disabled="true">Release notes coming soon</span></li>`);
});

test("an open release keeps the links as they are written", () => {
  assert.equal(
    releaseLinks(download + notes, true),
    `<a class="button button--red" href="%VITE_RELEASE_URL%"><svg></svg> Download for Windows</a><li><a href="%VITE_RELEASE_NOTES%">Release notes</a></li>`,
  );
});

test("links elsewhere are left alone", () => {
  const other = `<a class="button" href="/guide/">Read the setup guide</a>`;
  assert.equal(releaseLinks(other, false), other);
});

test("a release link that does not say what it shows while closed stops the build", () => {
  assert.throws(() => releaseLinks(`<a href="%VITE_RELEASE_URL%">Download</a>`, false), /data-soon/);
});
