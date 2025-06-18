import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

import {
  addImportIfMissing,
  getKey,
  runFlutterGenL10n,
  translateText,
} from "../utils";
import { options, setupConfig } from "../options";
import { updateArbFiles } from "../files";

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
