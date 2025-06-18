import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { options, setupConfig } from "../options";
import { getKey, runFlutterGenL10n, translateTextBatch } from "../utils";

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
      title: "Extracting strings to ARB",
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

        const literal = `${quoteChar}${innerText}${quoteChar}`;
        const stringStart = match.index! + match[0].indexOf(literal);
        const stringEnd = stringStart + literal.length;

        const range = new vscode.Range(
          document.positionAt(stringStart),
          document.positionAt(stringEnd)
        );

        progress.report({
          message: `Extracting: "${innerText}" (${total - i}/${total})`,
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

      const applySuccess = await vscode.workspace.applyEdit(workspaceEdit);
      if (!applySuccess) {
        vscode.window.showErrorMessage("Failed to apply text replacements.");
        return;
      }

      await addImportIfMissing(document, workspaceEdit);
      await vscode.workspace.applyEdit(workspaceEdit);

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

async function addImportIfMissing(
  document: vscode.TextDocument,
  editor: vscode.WorkspaceEdit
) {
  const importStr = options.importStr.trim().replace(/^['"]+|['"]+$/g, "");
  if (!importStr) return;

  if (document.getText().includes(importStr)) return;

  editor.insert(document.uri, new vscode.Position(0, 0), importStr + "\n");
}

function chunkArray<T>(arr: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }
  return chunks;
}

async function updateArbFilesBatch(
  keyValues: Record<string, string>
): Promise<boolean> {
  const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath!;
  const arbDirPath = path.join(workspacePath, options.arbDirName);

  try {
    const arbFiles = fs
      .readdirSync(arbDirPath)
      .filter((f) => f.endsWith(".arb"));

    for (const arbFile of arbFiles) {
      const fullArbPath = path.join(arbDirPath, arbFile);
      let arbContent = fs.existsSync(fullArbPath)
        ? fs.readFileSync(fullArbPath, "utf8")
        : "{}";
      const arbJson = JSON.parse(arbContent);

      const targetLang = arbFile.split("_")[1].split(".")[0];

      const keys = Object.keys(keyValues);
      const texts = Object.values(keyValues);

      // chunk size, adjust as needed based on rate limits and payload size
      const chunkSize = 50;

      const keyChunks = chunkArray(keys, chunkSize);
      const textChunks = chunkArray(texts, chunkSize);

      for (let i = 0; i < keyChunks.length; i++) {
        let translations: string[] = [];

        if (options.autoTranslate && arbFile) {
          translations = await translateTextBatch(textChunks[i], targetLang);
        } else {
          translations = textChunks[i];
        }

        translations.forEach((translatedValue, idx) => {
          arbJson[keyChunks[i][idx]] = translatedValue;
        });
      }

      fs.writeFileSync(fullArbPath, JSON.stringify(arbJson, null, 2), "utf8");
    }
    return true;
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to update ARB files: ${error}`);
    return false;
  }
}
