import * as vscode from "vscode";
import * as assert from "assert";
import { createDiagnosticFilter } from "../lsp/client";

suite("Diagnostic Filtering", function () {

  test("Diagnostic filter removes diagnostics for virtual documents", async function () {
    // Create mocks
    const virtualDocUri = vscode.Uri.file("/tmp/.vdoc.12345678-1234-1234-1234-123456789abc.py");
    const regularDocUri = vscode.Uri.file("/tmp/regular-file.py");

    // Create some test diagnostics
    const testDiagnostics = [
      new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 10),
        "Test diagnostic message",
        vscode.DiagnosticSeverity.Error
      )
    ];

    // Create a mock diagnostics handler function to verify behavior
    let capturedUri: vscode.Uri | undefined;
    let capturedDiagnostics: vscode.Diagnostic[] | undefined;

    const mockHandler = (uri: vscode.Uri, diagnostics: vscode.Diagnostic[]) => {
      capturedUri = uri;
      capturedDiagnostics = diagnostics;
    };

    // Create the filter function
    const diagnosticFilter = createDiagnosticFilter();

    // Test with a virtual document
    diagnosticFilter(virtualDocUri, testDiagnostics, mockHandler);

    // Verify diagnostics were filtered (empty array)
    assert.strictEqual(capturedUri, virtualDocUri, "URI should be passed through");
    assert.strictEqual(capturedDiagnostics!.length, 0, "Diagnostics should be empty for virtual documents");

    // Reset captured values
    capturedUri = undefined;
    capturedDiagnostics = undefined;

    // Test with a regular document
    diagnosticFilter(regularDocUri, testDiagnostics, mockHandler);

    // Verify diagnostics were not filtered
    assert.strictEqual(capturedUri, regularDocUri, "URI should be passed through");
    assert.strictEqual(capturedDiagnostics!.length, testDiagnostics.length, "Diagnostics should not be filtered for regular documents");
    assert.deepStrictEqual(capturedDiagnostics!, testDiagnostics, "Original diagnostics should be passed through unchanged");
  });

});
