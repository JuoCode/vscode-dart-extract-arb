import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

import { getKey, runFlutterGenL10n, translateText } from "./utils";
import { options, setupConfig } from "./options";

export async function extractStringToArb(
  document: vscode.TextDocument,
  range: vscode.Range,
  text: string
) {
  setupConfig();

  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const value = text.slice(1, -1); // Remove quotes from the string literal : "text" -> text

  const key = await getKey(value); // Prompt or infer key name

  if (!key) return;

  const arbWriteSucces = await updateArbFiles(key, value);
  if (!arbWriteSucces) return;

  const workspaceEdit = new vscode.WorkspaceEdit(); // enable Single Undo Action

  workspaceEdit.replace(document.uri, range, `${options.keyPrefix}${key}`);

  await addImportIfMissing(document, workspaceEdit);

  // Apply all edits as a single undoable action
  await vscode.workspace.applyEdit(workspaceEdit);

  if (options.autoRunGenL10n) await runFlutterGenL10n();

  vscode.window.showInformationMessage(`Added "${key}" to ARB files`);
}

async function addImportIfMissing(
  document: vscode.TextDocument,
  editor: vscode.WorkspaceEdit
) {
  const importStr = options.importStr.trim().replace(/^['"]+|['"]+$/g, ""); // Remove quotes if any
  if (!importStr) return;

  // Check if the import already exists
  if (document.getText().includes(importStr)) return;

  // Insert at the top of the file
  editor.insert(document.uri, new vscode.Position(0, 0), importStr + "\n");
}

function updateFile(filename: string, key: string, value: string) {
  try {
    let arbContent = fs.existsSync(filename)
      ? fs.readFileSync(filename, "utf8")
      : "{}";
    let arbJson = JSON.parse(arbContent);
    arbJson[key] = value;
    fs.writeFileSync(filename, JSON.stringify(arbJson, null, 2), "utf8");

    return true;
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to update ARB file: ${error}`);
    return false;
  }
}

async function updateArbFiles(key: string, value: string): Promise<boolean> {
  const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath!;
  // app_en.arb or lang_en.arb for example
  const arbDirPath = path.join(workspacePath, options.arbDirName);

  // app_en.arb -> app_fr.arb
  // const mainArbFileName = options.templateArbFile.replace(
  //   "en.arb",
  //   options.mainLocaleCode + ".arb"
  // );

  let ok = true;

  const arbFiles = fs.readdirSync(arbDirPath).filter((f) => f.endsWith(".arb"));

  for (const arbFile of arbFiles) {
    const fullArbPath = path.join(arbDirPath, arbFile);
    const val =
      options.autoTranslate && arbFile //!== mainArbFileName
        ? await translateText(
            value,
            // options.mainLocaleCode,
            arbFile.split("_")[1].split(".")[0] // lang_en.arb -> en
          )
        : value;

    ok = ok && updateFile(fullArbPath, key, val);
  }
  return ok;
}
