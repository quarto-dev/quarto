/*
 * images.test.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import * as assert from "assert";
import * as path from "path";

import { ensureForwardSlashes, uniqueImagePath } from "../providers/editor/images";

suite("Image paths", function () {
  const imagesDir = path.join("doc", "images");

  test("Pasted images get a numbered name in the images dir", function () {
    const taken = new Set([path.join(imagesDir, "paste-1.png")]);
    assert.strictEqual(
      uniqueImagePath(imagesDir, "paste", ".png", false, (p) => taken.has(p)),
      path.join(imagesDir, "paste-2.png")
    );
  });

  test("Copied images keep their name when it is free", function () {
    assert.strictEqual(
      uniqueImagePath(imagesDir, "plot", ".jpg", true, () => false),
      path.join(imagesDir, "plot.jpg")
    );
  });

  test("Missing extension defaults to .png", function () {
    assert.strictEqual(
      uniqueImagePath(imagesDir, "plot", "", true, () => false),
      path.join(imagesDir, "plot.png")
    );
  });

  test("Fallback after 100 collisions keeps the images dir and extension", function () {
    assert.strictEqual(
      uniqueImagePath(imagesDir, "paste", ".jpeg", false, () => true, () => "abc"),
      path.join(imagesDir, "paste-abc.jpeg")
    );
    assert.strictEqual(
      uniqueImagePath(imagesDir, "plot", "", true, () => true, () => "abc"),
      path.join(imagesDir, "plot-abc.png")
    );
  });

  test("Backslashes in relative paths all become forward slashes", function () {
    assert.strictEqual(
      ensureForwardSlashes("..\\..\\assets\\images\\plot.png"),
      "../../assets/images/plot.png"
    );
    assert.strictEqual(ensureForwardSlashes("images/plot.png"), "images/plot.png");
  });
});
