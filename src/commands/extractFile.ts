import * as vscode from "vscode";
import { options, setupConfig } from "../options";
import { addImportIfMissing, getKey, runFlutterGenL10n } from "../utils";
import { updateArbFilesBatch } from "../files";

export async function extractAllTextsInFile() {
  setupConfig();

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage("No active editor");
    return;
  }

  const document = editor.document;
  const text = document.getText();

  const regex = /Text\s*\(\s*(['"])([^$\\]*?)\1\s*[\),]/g;
  const matches = [...text.matchAll(regex)];

  if (matches.length === 0) {
    vscode.window.showInformationMessage("No hardcoded Text() widgets found.");
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Extracting to ARB`,
      cancellable: false,
    },
    async (progress) => {
      const workspaceEdit = new vscode.WorkspaceEdit();
      const arbUpdates: Record<string, string> = {};
      const total = matches.length;

      for (let i = total - 1; i >= 0; i--) {
        const match = matches[i];
        const quoteChar = match[1];
        const innerText = match[2];

        if (!innerText.trim()) continue;

        const line = document
          .lineAt(document.positionAt(match.index!).line)
          .text.trim();
        if (line.startsWith("//")) continue;

        const literal = `${quoteChar}${innerText}${quoteChar}`;
        const stringStart = match.index! + match[0].indexOf(literal);
        const stringEnd = stringStart + literal.length;

        const range = new vscode.Range(
          document.positionAt(stringStart),
          document.positionAt(stringEnd)
        );

        progress.report({
          message: `(${total - i}/${total}) Extracting: "${innerText}" `,
          increment: (1 / total) * 100,
        });

        const key = await getKey(innerText);
        if (!key) continue;

        workspaceEdit.replace(
          document.uri,
          range,
          `${options.keyPrefix}${key}`
        );
        arbUpdates[key] = innerText;
      }

      //   if no changes were made
      if (Object.keys(arbUpdates).length === 0) {
        vscode.window.showInformationMessage("No strings to extract.");
        return;
      }

      await addImportIfMissing(document, workspaceEdit);
      const applySuccess = await vscode.workspace.applyEdit(workspaceEdit);
      if (!applySuccess) {
        vscode.window.showErrorMessage("Failed to apply text replacements.");
        return;
      }

      const updateSuccess = await updateArbFilesBatch(arbUpdates);
      if (!updateSuccess) {
        vscode.window.showErrorMessage("Failed to update ARB files.");
        return;
      }

      if (options.autoRunGenL10n) await runFlutterGenL10n();

      vscode.window.showInformationMessage(
        `Extracted ${Object.keys(arbUpdates).length} strings to ARB files`
      );
    }
  );
}
