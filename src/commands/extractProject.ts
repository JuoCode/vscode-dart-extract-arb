import * as vscode from "vscode";
import * as path from "path";

import { getKey, runFlutterGenL10n } from "../utils";
import { options, setupConfig } from "../options";
import { updateArbFilesBatch } from "../files";

export async function extractAllTextsInProject() {
  setupConfig();

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showInformationMessage("No workspace folder open");
    return;
  }

  // We'll accumulate all keys and values globally for ARB update
  const globalArbUpdates: Record<string, string> = {};

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Extracting all Text() strings in workspace",
      cancellable: false,
    },
    async (progress) => {
      let fileCount = 0;
      const dartFiles = await vscode.workspace.findFiles(
        "lib/**/*.dart",
        "**/*.g.dart,**/*.freezed.dart,**/*.pb.dart,**/*.pbjson.dart"
      );

      for (const fileUri of dartFiles) {
        fileCount++;
        progress.report({
          message: `Processing ${path.basename(fileUri.fsPath)} (${fileCount}/${
            dartFiles.length
          })`,
        });

        const document = await vscode.workspace.openTextDocument(fileUri);
        const text = document.getText();

        const regex = /Text\s*\(\s*(['"])([^$\\]*?)\1\s*[\),]/g;
        const matches = [...text.matchAll(regex)];
        if (matches.length === 0) continue;

        // WorkspaceEdit for the current file
        const workspaceEdit = new vscode.WorkspaceEdit();

        // Keep track of keys for ARB updates for this file
        const fileKeyValues: Record<string, string> = {};

        for (const match of matches.reverse()) {
          // reverse to not mess offsets
          const innerText = match[2];

          // ignore comments and empty strings
          if (!innerText.trim()) continue;

          const line = document
            .lineAt(document.positionAt(match.index!).line)
            .text.trim();
          if (line.startsWith("//")) continue;

          // Get key for this string
          const key = await getKey(innerText);
          if (!key) continue;

          // Save for ARB update
          globalArbUpdates[key] = innerText;
          fileKeyValues[key] = innerText;

          // Replace string literal range with key prefixed key
          const quoteChar = match[1];
          const literal = `${quoteChar}${innerText}${quoteChar}`;
          const stringStart = match.index! + match[0].indexOf(literal);
          const stringEnd = stringStart + literal.length;
          const range = new vscode.Range(
            document.positionAt(stringStart),
            document.positionAt(stringEnd)
          );

          workspaceEdit.replace(
            document.uri,
            range,
            `${options.keyPrefix}${key}`
          );
        }

        // Add import if missing
        const importStr = options.importStr
          .trim()
          .replace(/^['"]+|['"]+$/g, "");
        if (importStr && !text.includes(importStr)) {
          workspaceEdit.insert(
            document.uri,
            new vscode.Position(0, 0),
            importStr + "\n"
          );
        }

        //   if no changes were made
        if (Object.keys(fileKeyValues).length === 0) continue;

        // Apply all edits to this Dart file
        const applied = await vscode.workspace.applyEdit(workspaceEdit);
        if (!applied) {
          vscode.window.showErrorMessage(
            `Failed to update file: ${fileUri.fsPath}`
          );
        } else {
          // Optionally save the document
          const editedDoc = await vscode.workspace.openTextDocument(fileUri);
          await editedDoc.save();
        }
      }
    }
  );

  if (Object.keys(globalArbUpdates).length === 0) {
    vscode.window.showInformationMessage(
      "No hardcoded Text() strings found in workspace."
    );
    return;
  }

  // Update ARB files for all found keys at once
  const updateSuccess = await updateArbFilesBatch(globalArbUpdates);
  if (!updateSuccess) {
    vscode.window.showErrorMessage("Failed to update ARB files.");
    return;
  }

  if (options.autoRunGenL10n) await runFlutterGenL10n();

  vscode.window.showInformationMessage(
    `Extracted ${
      Object.keys(globalArbUpdates).length
    } strings from workspace to ARB files`
  );
}
