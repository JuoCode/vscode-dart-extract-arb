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

export function extractKeyNameFromText(text: string) {
  return text
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ") // Replace all non-alphanumeric characters with space
    .replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, index) =>
      index === 0 ? match.toLowerCase() : match.toUpperCase()
    ) // Convert to camelCase
    .replace(/\s+/g, ""); // Remove spaces
}

export async function runFlutterGenL10n() {
  const task = new vscode.Task(
    { type: "shell" },
    vscode.TaskScope.Workspace,
    "Generate L10n",
    "flutter",
    new vscode.ShellExecution("flutter gen-l10n")
  );
  await vscode.tasks.executeTask(task);
}
