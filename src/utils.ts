import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import * as deepl from "deepl-node";

export function isStringLiteral(text: string): boolean {
  return /^['"](.*?)['"]$/.test(text);
}

export function readL10nConfig(): any | null {
  try {
    const l10nConfigPath = path.join(
      vscode.workspace.workspaceFolders?.[0].uri.fsPath!,
      "l10n.yaml"
    );
    const l10nFile = fs.readFileSync(l10nConfigPath, "utf8");
    return yaml.load(l10nFile);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to read l10n.yaml: ${error}`);
    return null;
  }
}
