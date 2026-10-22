import assert from "node:assert/strict";
import test from "node:test";

import MarkdownIt from "markdown-it";
import attrPlugin from "markdown-it-attrs";
import { divPlugin } from "../src/markdownit/divs";
import { calloutPlugin } from "../src/markdownit/callouts";
import { decoratorPlugin } from "../src/markdownit/decorator";
import { shortcodePlugin } from "../src/markdownit/shortcodes";
import { yamlPlugin } from "../src/markdownit/yaml";

// These plugins create tokens and escape HTML through the markdown-it instance
// they're installed on (in the notebook renderer that's the host's copy), so
// exercise them end to end.

const md = () => new MarkdownIt({ html: true });

test("callouts take their title from a heading", () => {
  const html = md().use(attrPlugin).use(divPlugin).use(calloutPlugin)
    .render("::: {.callout-note}\n## My title\n\nBody\n:::\n");
  assert.equal(
    html,
    '<div  class="callout callout-note callout-style-default">\n' +
      '<div class="callout-header">\n' +
      '<div class="callout-icon-container">\n  <i class="callout-icon"></i>\n</div>\n' +
      '<div class="callout-title-container">\nMy title</div>\n</div>' +
      '<div class="callout-body-container callout-body"><p>Body</p>\n</div></div>'
  );
});

test("callouts take their title from the title attribute, or the type", () => {
  const withAttr = md().use(attrPlugin).use(divPlugin).use(calloutPlugin)
    .render('::: {.callout-warning title="Heads up"}\nBody\n:::\n');
  assert.match(withAttr, /<div class="callout-title-container">Heads up\n/);

  const withType = md().use(attrPlugin).use(divPlugin).use(calloutPlugin)
    .render("::: {.callout-tip}\nBody\n:::\n");
  assert.match(withType, /<div class="callout-title-container">Tip\n/);
});

test("decorators are added before fenced code with an info string", () => {
  const html = md().use(decoratorPlugin).render("```{python}\n1\n```\n");
  assert.equal(
    html,
    '<div class="quarto-attribute-decorator"><span class="quarto-attribute-decorator-content">{python}</span></div>' +
      '<pre><code class="language-{python}">1\n</code></pre>\n'
  );
});

test("shortcodes are rendered with their content HTML-escaped", () => {
  assert.equal(
    md().use(shortcodePlugin).render('{{< var foo "<b>" >}}'),
    '<p><span class="shortcode">{{&lt; var foo &quot;&lt;b&gt;&quot; &gt;}}</span></p>\n'
  );
});

test("front matter is passed to the yaml callback as a string", () => {
  let yaml: unknown;
  md().use(yamlPlugin, (y: unknown) => { yaml = y; }).parse("---\ntitle: Hi\n---\n\nText\n", {});
  assert.equal(yaml, "title: Hi");
});
