/*
 * previewCommandRender.test.ts
 * Author: Petr Ankudinov (Arista Networks)
 * SPDX-License-Identifier: MIT
 */

import * as assert from "assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { createPreviewCommandBridge } from "../providers/preview/command-bridge";

suite("Preview command render", function () {
  test("preserves authored includes, filters, books and Reveal.js formats", function () {
    this.timeout(90000);
    // This integration test needs the CLI; editor-only environments may omit it.
    if (spawnSync("quarto", ["--version"]).status !== 0) {
      this.skip();
    }
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quarto-command-render-"));
    // Everything rendered belongs to a disposable fixture, never the checkout.
    const bridge = createPreviewCommandBridge(path.join(__dirname, ".."));
    try {
      for (const format of ["html", "book", "revealjs"]) {
        const project = path.join(directory, format);
        fs.mkdirSync(project);
        // An authored footer and filter reveal whether bridge metadata replaces
        // user configuration instead of extending it.
        fs.writeFileSync(path.join(project, "footer.html"), "<footer>Authored footer</footer>");
        fs.writeFileSync(path.join(project, "authored.lua"), 'function Header(header) header.content:insert(pandoc.Str("AuthoredFilter")); return header end');
        const book = format === "book";
        const configuration = book
          ? "project:\n  type: book\nbook:\n  title: Test book\n  chapters: [index.qmd, chapter.qmd]\nformat: html\n"
          : `project:\n  type: default\nformat:\n  ${format}:\n    theme: ${format === "revealjs" ? "simple" : "cosmo"}\n`;
        fs.writeFileSync(path.join(project, "_quarto.yml"), configuration + "filters: [authored.lua]\ninclude-after-body: footer.html\n");
        const source = '# Preview\n\n[Run](command:example){data-args=\'["100%"]\'}\n\n## Next\n\nMore content.\n';
        fs.writeFileSync(path.join(project, "index.qmd"), source);
        if (book) {
          // A second page checks injection beyond the initially opened document.
          fs.writeFileSync(path.join(project, "chapter.qmd"), "# Chapter\n\n[Run](command:example)\n");
        }
        // Let each project's authored format choose its writer; forcing HTML
        // here would hide a regression that converts a presentation or book.
        const result = spawnSync("quarto", ["render", book ? project : path.join(project, "index.qmd"), "--metadata-file", bridge.metadataFile], { encoding: "utf8" });
        assert.strictEqual(result.status, 0, result.stdout + result.stderr);
        const output = path.join(project, book ? "_book/index.html" : "index.html");
        const html = fs.readFileSync(output, "utf8");
        // Check bridge presence alongside authored output and unchanged source.
        assert.ok(html.includes(bridge.token), `${format}: bridge missing`);
        assert.ok(html.includes("Authored footer"), `${format}: include lost`);
        assert.ok(html.includes("AuthoredFilter"), `${format}: filter lost`);
        assert.ok(html.includes("data-args="), `${format}: arguments lost`);
        assert.strictEqual(fs.readFileSync(path.join(project, "index.qmd"), "utf8"), source);
        if (book) {
          // Preserve both chapter injection and Quarto's normal project outputs.
          assert.ok(fs.readFileSync(path.join(project, "_book/chapter.html"), "utf8").includes(bridge.token));
          assert.ok(fs.existsSync(path.join(project, "_book/search.json")));
        } else if (format === "revealjs") {
          assert.ok(html.includes('class="reveal"'));
          // Quarto compiles themes to generated filenames; check the theme itself.
          const themeTag = [...html.matchAll(/<link\b[^>]*>/g)].map(match => match[0]).find(tag => tag.includes("/revealjs/dist/theme/"));
          assert.ok(themeTag);
          const themeHref = /href="([^"]+)"/.exec(themeTag!);
          assert.ok(themeHref);
          const css = fs.readFileSync(path.resolve(project, themeHref![1].split("?")[0]), "utf8");
          assert.match(css, /News[ +]Cycle/);
        }
      }
    } finally {
      // Release the filter and generated project even when a render assertion fails.
      bridge.dispose();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
