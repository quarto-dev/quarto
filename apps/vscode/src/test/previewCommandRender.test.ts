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
        // Compare actual rendered inline/reference anchors, including a styled
        // reference. Percent and ampersand arguments must survive in both links.
        const source = '# Preview\n\n[Inline](command:example){#inline-command data-args=\'["100%","a&b"]\'}\n\n[Reference][action]\n\n[action]: command:example {#reference-command .btn .btn-primary data-args=\'["100%","a&b"]\'}\n\n## Next\n\nMore content.\n';
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
        // Only inspect the generated anchors in this controlled fixture. Their
        // serialized arguments must agree before the browser decodes attributes.
        const anchors = [...html.matchAll(/<a\b[^>]*>/g)].map(match => match[0]);
        const argumentsByLink = ["inline-command", "reference-command"].map(id => {
          const anchor = anchors.find(tag => tag.includes(`id="${id}"`));
          assert.ok(anchor, `${format}: ${id} missing`);
          assert.match(anchor!, /href="command:example"/);
          const args = /data-args="([^"]*)"/.exec(anchor!);
          assert.ok(args, `${format}: ${id} arguments missing`);
          return args![1];
        });
        assert.strictEqual(argumentsByLink[0], argumentsByLink[1]);
        assert.ok(argumentsByLink[0].includes("100%"));
        assert.ok(argumentsByLink[0].includes("a&amp;b"));
        assert.match(anchors.find(tag => tag.includes('id="reference-command"'))!, /class="[^"]*btn-primary/);
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

  test("leaves non-HTML output unchanged", function () {
    this.timeout(30000);
    if (spawnSync("quarto", ["--version"]).status !== 0) {
      this.skip();
    }
    // GFM needs no TeX/browser runtime and proves the HTML-only filter does not
    // insert raw script blocks or force a different output format.
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quarto-command-nonhtml-"));
    const bridge = createPreviewCommandBridge(path.join(__dirname, ".."));
    try {
      const sourceFile = path.join(directory, "document.qmd");
      fs.writeFileSync(sourceFile, '# Heading\n\n[Run](command:example){data-args=\'["100%"]\'}\n');
      for (const bridged of [false, true]) {
        const args = ["render", sourceFile, "--to", "gfm", "--output", bridged ? "bridged.md" : "baseline.md"];
        if (bridged) {
          args.push("--metadata-file", bridge.metadataFile);
        }
        const result = spawnSync("quarto", args, { cwd: directory, encoding: "utf8" });
        assert.strictEqual(result.status, 0, result.stdout + result.stderr);
      }
      assert.strictEqual(
        fs.readFileSync(path.join(directory, "bridged.md"), "utf8"),
        fs.readFileSync(path.join(directory, "baseline.md"), "utf8")
      );
    } finally {
      bridge.dispose();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
