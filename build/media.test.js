import assert from "node:assert/strict";
import { test } from "node:test";
import { placeVideos, storedName, unusedVideos, videosNamedIn } from "./media.js";

const manifest = {
  "zhiyin-demo.mp4": "zhiyin-demo.0123456789ab.mp4",
  "clips/work.mp4": "clips/work.ba9876543210.mp4",
};

test("a video named in a page is given its address in R2", () => {
  const page = `<source src="/media/zhiyin-demo.mp4" type="video/mp4" /><figure data-long="/media/clips/work.mp4">`;
  assert.equal(
    placeVideos(page, manifest),
    `<source src="https://media.zhiyinagent.app/zhiyin-demo.0123456789ab.mp4" type="video/mp4" />` +
      `<figure data-long="https://media.zhiyinagent.app/clips/work.ba9876543210.mp4">`,
  );
});

test("posters and other files stay where they are", () => {
  const page = `<video poster="/media/clips/work.webp" data-end-poster="/media/clips/work-end.webp"></video>`;
  assert.equal(placeVideos(page, manifest), page);
});

test("a video that was never uploaded stops the build, by name", () => {
  assert.throws(() => placeVideos(`<video src="/media/clips/missing.mp4">`, manifest), /clips\/missing\.mp4/);
});

test("a video is stored under its path with a hash of its bytes", () => {
  const name = storedName("clips/work.mp4", new TextEncoder().encode("frames"));
  assert.match(name, /^clips\/work\.[0-9a-f]{12}\.mp4$/);
  assert.equal(storedName("clips/work.mp4", new TextEncoder().encode("frames")), name);
  assert.notEqual(storedName("clips/work.mp4", new TextEncoder().encode("other frames")), name);
});

test("a live page's videos are read from their addresses in R2", () => {
  const page =
    `<source src="https://media.zhiyinagent.app/zhiyin-demo.0123456789ab.mp4" type="video/mp4" />` +
    `<figure data-long="https://media.zhiyinagent.app/clips/work.ba9876543210.mp4">` +
    `<img src="/media/clips/work.webp">`;
  assert.deepEqual(videosNamedIn(page), ["zhiyin-demo.0123456789ab.mp4", "clips/work.ba9876543210.mp4"]);
});

test("a stored video that neither media.json nor the live site names is unused", () => {
  const stored = ["zhiyin-demo.0123456789ab.mp4", "zhiyin-demo.aaaaaaaaaaaa.mp4", "clips/work.ba9876543210.mp4", "clips/work.bbbbbbbbbbbb.mp4"];
  assert.deepEqual(unusedVideos(stored, manifest, []), ["zhiyin-demo.aaaaaaaaaaaa.mp4", "clips/work.bbbbbbbbbbbb.mp4"]);
});

test("a video the live site still shows is kept, though media.json has moved on", () => {
  const stored = ["clips/work.ba9876543210.mp4", "clips/work.bbbbbbbbbbbb.mp4"];
  assert.deepEqual(unusedVideos(stored, manifest, ["clips/work.bbbbbbbbbbbb.mp4"]), []);
});

test("a file not stored the way uploads are is never listed", () => {
  assert.deepEqual(unusedVideos(["notes.txt", "clips/work.mp4", "clips/work.BA9876543210.mp4"], manifest, []), []);
});
