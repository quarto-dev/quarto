import * as vscode from "vscode";
import * as assert from "assert";
import { WORKSPACE_PATH, examplesOutUri } from "./test-utils";

suite("YAML Providers", function () {
  suiteSetup(async function () {
    await vscode.workspace.fs.delete(examplesOutUri(), { recursive: true });
    await vscode.workspace.fs.copy(vscode.Uri.file(WORKSPACE_PATH), examplesOutUri());
  });

  suite("Document Links", function () {
    test("Provides document links for existing files in _quarto.yml", async function () {
      const quartoYmlUri = examplesOutUri("_quarto.yml");
      const doc = await vscode.workspace.openTextDocument(quartoYmlUri);

      const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
        "vscode.executeLinkProvider",
        doc.uri
      );

      assert.ok(links, "Should return document links");
      assert.ok(links.length >= 3, `Expected at least 3 links, found ${links.length}`);

      const helloLink = links.find(
        (link) => link.target?.fsPath.endsWith("hello.qmd")
      );
      assert.ok(helloLink, "Should have a link for hello.qmd");

      const validBasicsLink = links.find(
        (link) => link.target?.fsPath.endsWith("valid-basics.qmd")
      );
      assert.ok(validBasicsLink, "Should have a link for valid-basics.qmd");

      const bibLink = links.find(
        (link) => link.target?.fsPath.endsWith("references.bib")
      );
      assert.ok(bibLink, "Should have a link for references.bib");
    });

    test("Does not provide links for non-existent files", async function () {
      const quartoYmlUri = examplesOutUri("_quarto.yml");
      const doc = await vscode.workspace.openTextDocument(quartoYmlUri);

      const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
        "vscode.executeLinkProvider",
        doc.uri
      );

      const stylesLink = links?.find(
        (link) => link.target?.fsPath.endsWith("styles.css")
      );
      assert.ok(!stylesLink, "Should not have a link for non-existent styles.css");
    });
  });

  suite("Filepath Completions", function () {
    test("Provides file path completions in _quarto.yml", async function () {
      const quartoYmlUri = examplesOutUri("_quarto.yml");
      const doc = await vscode.workspace.openTextDocument(quartoYmlUri);
      await vscode.window.showTextDocument(doc);

      const position = new vscode.Position(7, 4);
      const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
        "vscode.executeCompletionItemProvider",
        doc.uri,
        position
      );

      assert.ok(completions, "Should return completions");
      assert.ok(completions.items.length > 0, "Should have completion items");

      const qmdCompletions = completions.items.filter(
        (item) => item.label.toString().endsWith(".qmd")
      );
      assert.ok(qmdCompletions.length > 0, "Should suggest .qmd files");
    });

    test("Completion replaces partial input with dot correctly", async function () {
      const testDir = examplesOutUri("test-completion");
      const tempYmlUri = vscode.Uri.joinPath(testDir, "_quarto.yml");

      const content = `project:
  type: default

render:
  - hello.q`;

      await vscode.workspace.fs.createDirectory(testDir);
      await vscode.workspace.fs.copy(
        examplesOutUri("hello.qmd"),
        vscode.Uri.joinPath(testDir, "hello.qmd")
      );
      await vscode.workspace.fs.writeFile(tempYmlUri, Buffer.from(content, "utf-8"));

      try {
        const doc = await vscode.workspace.openTextDocument(tempYmlUri);
        await vscode.window.showTextDocument(doc);

        const position = new vscode.Position(4, 11);
        const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
          "vscode.executeCompletionItemProvider",
          doc.uri,
          position
        );

        assert.ok(completions, "Should return completions");

        const helloCompletion = completions.items.find(
          (item) => item.label.toString() === "hello.qmd"
        );
        assert.ok(helloCompletion, "Should have hello.qmd completion for partial 'hello.q'");

        const range = helloCompletion.range;
        assert.ok(range, "Completion should have a range");

        if (range instanceof vscode.Range) {
          assert.strictEqual(range.start.character, 4, "Range should start at column 4 (after '  - ')");
          assert.strictEqual(range.end.character, 11, "Range should end at column 11");
        } else if (range && typeof range === "object" && "replacing" in range) {
          const replacingRange = (range as { replacing: vscode.Range }).replacing;
          assert.strictEqual(replacingRange.start.character, 4, "Replacing range should start at column 4 to replace 'hello.q'");
          assert.strictEqual(replacingRange.end.character, 11, "Replacing range should end at column 11");
        }
      } finally {
        await vscode.workspace.fs.delete(testDir, { recursive: true });
      }
    });
  });
});
