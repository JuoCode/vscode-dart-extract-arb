import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";

interface Options {
  arbDirName: string;
  templateArbFile: string;
  autoTranslate: boolean;
  keyPrefix: string;
  importStr: string;
  autoGenerateKeyName: boolean | string;
  autoRunGenL10n: boolean;
  keyNameLanguage: string;
}

export let options: Options = {
  // flutter options
  arbDirName: "lib/l10n",
  templateArbFile: "app_en.arb",
  // package specific options
  autoTranslate: true,
  keyPrefix: "AppLocalizations.of(context)!.",
  importStr: "",
  autoGenerateKeyName: true,
  autoRunGenL10n: true,
  keyNameLanguage: "en",
};

// update global object with options
export function setupConfig() {
  const l10nConfig = readL10nConfig();
  if (!l10nConfig) return;

  const nullableGetter = l10nConfig["nullable-getter"] ?? true; // nullable by default

  const defaultKeyPrefix = nullableGetter
    ? "AppLocalizations.of(context)!."
    : "AppLocalizations.of(context).";

  options = {
    ...options, // Preserve existing defaults
    arbDirName: l10nConfig["arb-dir"] ?? options.arbDirName,
    templateArbFile: l10nConfig["template-arb-file"] ?? options.templateArbFile,
    autoTranslate: l10nConfig["translate"] ?? options.autoTranslate,
    importStr: l10nConfig["import-line"] ?? options.importStr,
    keyPrefix: l10nConfig["key-prefix"] ?? defaultKeyPrefix,
    autoGenerateKeyName:
      l10nConfig["auto-name-key"] ?? options.autoGenerateKeyName,
    autoRunGenL10n: l10nConfig["generate"] ?? options.autoRunGenL10n,
    keyNameLanguage: l10nConfig["key-name-language"] ?? options.keyNameLanguage,
  };
}

function readL10nConfig(): any | null {
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

export function watchL10nYamlChanges(context: vscode.ExtensionContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return;

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(workspaceRoot, "l10n.yaml")
  );

  const reloadConfig = () => {
    setupConfig();
    vscode.window.showInformationMessage("l10n.yaml updated, config reloaded.");
  };

  watcher.onDidChange(reloadConfig);
  watcher.onDidCreate(reloadConfig);
  watcher.onDidDelete(() => {
    setupConfig();
    vscode.window.showInformationMessage("l10n.yaml deleted, config reset.");
  });

  context.subscriptions.push(watcher);
}
