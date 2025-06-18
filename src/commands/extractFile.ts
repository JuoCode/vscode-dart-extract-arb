import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { options, setupConfig } from "../options";
import { getKey, runFlutterGenL10n, translateText } from "../utils";

export async function extractAllTextsInFile() {
  setupConfig();

  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage("No active editor");
    return;
  }

  const document = editor.document;
  const text = document.getText();

  // Regex to match Text("...") or Text('...') without interpolations or escaped quotes
  const regex = /Text\s*\(\s*(['"])([^$\\]*?)\1\s*[\),]/g;

  const matches = [...text.matchAll(regex)];

  if (matches.length === 0) {
    vscode.window.showInformationMessage("No hardcoded Text() widgets found.");
    return;
  }

  // We'll accumulate all replacements in this WorkspaceEdit
  const workspaceEdit = new vscode.WorkspaceEdit();

  // Collect keys & values for ARB update (key -> value)
  const arbUpdates: Record<string, string> = {};

  // Iterate matches in reverse to avoid messing offsets on replacement
  for (const match of matches.reverse()) {
    const quoteChar = match[1]; // ' or "
    const innerText = match[2]; // The string inside Text()

    if (!innerText.trim()) continue; // skip empty strings

    const literal = `${quoteChar}${innerText}${quoteChar}`;

    // Calculate range of the string literal inside the document
    const stringStart = match.index! + match[0].indexOf(literal);
    const stringEnd = stringStart + literal.length;

    const range = new vscode.Range(
      document.positionAt(stringStart),
      document.positionAt(stringEnd)
    );

    // Get localization key (prompt or infer)
    const key = await getKey(innerText);
    if (!key) continue; // skip if user cancels

    // Add replacement: replace the string literal with localized key reference
    workspaceEdit.replace(document.uri, range, `${options.keyPrefix}${key}`);

    // Add to ARB updates map
    arbUpdates[key] = innerText;
  }

  // Apply all text replacements at once
  const applySuccess = await vscode.workspace.applyEdit(workspaceEdit);
  if (!applySuccess) {
    vscode.window.showErrorMessage("Failed to apply text replacements.");
    return;
  }

  // Add import line if missing
  await addImportIfMissing(document, workspaceEdit);
  await vscode.workspace.applyEdit(workspaceEdit);

  // Update ARB files for all keys at once
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

async function addImportIfMissing(
  document: vscode.TextDocument,
  editor: vscode.WorkspaceEdit
) {
  const importStr = options.importStr.trim().replace(/^['"]+|['"]+$/g, "");
  if (!importStr) return;

  if (document.getText().includes(importStr)) return;

  editor.insert(document.uri, new vscode.Position(0, 0), importStr + "\n");
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

      for (const [key, value] of Object.entries(keyValues)) {
        const translatedValue =
          options.autoTranslate && arbFile
            ? await translateText(value, arbFile.split("_")[1].split(".")[0])
            : value;

        arbJson[key] = translatedValue;
      }

      fs.writeFileSync(fullArbPath, JSON.stringify(arbJson, null, 2), "utf8");
    }
    return true;
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to update ARB files: ${error}`);
    return false;
  }
}
