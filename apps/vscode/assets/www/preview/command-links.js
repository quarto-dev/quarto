/*
 * command-links.js
 * Author: Petr Ankudinov (Arista Networks)
 * SPDX-License-Identifier: MIT
 */

(() => {
  // The renderer writes the current session token on this script element.
  // Standalone HTML has no editor parent to receive command requests.
  const token = document.currentScript?.getAttribute("data-quarto-command-token");
  if (!token || window.parent === window) {
    return;
  }

  // Compatibility workaround: the CLI's existing relay forwards only the URL,
  // so the host cannot read data-args. Capture both fields before that handler.
  // Extending the CLI relay to include data-args could replace this script once
  // the extension can rely on a compatible CLI version.
  document.addEventListener("click", (event) => {
    // A click can land on a label, icon or text node inside an anchor. Read the
    // authored attribute: SVG href properties are objects, and URL properties
    // can normalize text that the host needs to validate unchanged.
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const anchor = target?.closest("a");
    const href = anchor?.getAttribute("href") ?? anchor?.getAttribute("xlink:href");
    // Preserve ordinary navigation and clicks another handler already cancelled.
    if (event.defaultPrevented || typeof href !== "string" || !/^command:/i.test(href)) {
      return;
    }

    // Suppress browser navigation and Quarto's later bare-URL handler so this
    // click follows exactly one command-dispatch path.
    event.preventDefault();
    event.stopPropagation();
    const link = { href };
    // Preserve both sources unchanged so the host can reject conflicts.
    if (anchor.hasAttribute("data-args")) {
      link.dataArgs = anchor.getAttribute("data-args");
    }
    // Only the parent receives this; it checks frame identity, origin and token.
    window.parent.postMessage({ type: "quarto.preview.command", token, link }, "*");
  }, true);
})();
