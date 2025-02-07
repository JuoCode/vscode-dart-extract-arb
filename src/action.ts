import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import * as deepl from "deepl-node";
import { readL10nConfig } from "./utils";

let options = {
  // flutter options
  arbDirName: "lib/l10n",
  templateArbFile: "app_en.arb",
  // package specific options
  mainLocaleCode: "en",
  autoTranslate: true,
  keyPrefix: "AppLocalizations.of(context).",
  importStr: "",
  autoGenerateKeyName: false,
};

// update global object with options
function setupConfig() {
  const l10nConfig = readL10nConfig();
  if (!l10nConfig) return;

  options = {
    ...options, // Preserve existing defaults
    arbDirName: l10nConfig["arb-dir"] ?? options.arbDirName,
    templateArbFile: l10nConfig["template-arb-file"] ?? options.templateArbFile,
    mainLocaleCode: l10nConfig["main-locale"] ?? options.mainLocaleCode,
    autoTranslate: l10nConfig["translate"] ?? options.autoTranslate,
    importStr: l10nConfig["import-line"] ?? options.importStr,
    keyPrefix: l10nConfig["key-prefix"] ?? options.keyPrefix,
    autoGenerateKeyName:
      l10nConfig["auto-name-key"] ?? options.autoGenerateKeyName,
  };
}

export async function extractToArb(
  document: vscode.TextDocument,
  range: vscode.Range,
  text: string
) {
  setupConfig();

  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const key = await promptForKey();
  if (!key) return;

  const value = text.slice(1, -1); // Remove quotes from the string literal

  const arbWriteSucces = updateArbFiles(key, value);
  if (!arbWriteSucces) return;

  await addImportIfMissing(document, editor);

  updateEditorText(editor, range, key);
  vscode.window.showInformationMessage(`Added "${key}" to app_en.arb`);
}

async function addImportIfMissing(
  document: vscode.TextDocument,
  editor: vscode.TextEditor
) {
  const importStr = options.importStr;
  if (!importStr) return;

  // Check if the import already exists
  if (document.getText().includes(importStr)) return;

  // Insert at the top of the file
  await editor.edit((editBuilder) => {
    editBuilder.insert(new vscode.Position(0, 0), importStr + "\n");
  });
}

async function promptForKey(): Promise<string | undefined> {
  return vscode.window.showInputBox({
    prompt: "Enter localization key name",
    placeHolder: "key name",
  });
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

//  "flutter.deeplApiKey": "your-deepl-api-key-here"
export function getDeeplApiKey(): string | undefined {
  const config = vscode.workspace.getConfiguration("flutter");
  return config.get<string>("deeplApiKey");
}

async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<string> {
  const authKey = getDeeplApiKey();
  if (!authKey) {
    vscode.window.showErrorMessage("DeepL API key is missing");
    return text;
  }
  const translator = new deepl.Translator(authKey);

  const result = await translator.translateText(
    text,
    sourceLang as deepl.SourceLanguageCode,
    targetLang as deepl.TargetLanguageCode
  );
  return result.text;
}

async function updateArbFiles(key: string, value: string): Promise<boolean> {
  const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath!;
  // app_en.arb or lang_en.arb for example
  const arbDirPath = path.join(workspacePath, options.arbDirName);

  // app_en.arb -> app_fr.arb
  const mainArbFileName = options.templateArbFile.replace(
    "en.arb",
    options.mainLocaleCode + ".arb"
  );

  let ok = true;

  const arbFiles = fs.readdirSync(arbDirPath).filter((f) => f.endsWith(".arb"));

  for (const arbFile of arbFiles) {
    const fullArbPath = path.join(arbDirPath, arbFile);
    const val =
      options.autoTranslate && arbFile !== mainArbFileName
        ? await translateText(
            value,
            options.mainLocaleCode,
            arbFile.split("_")[1].split(".")[0]
          )
        : value;

    ok = ok && updateFile(fullArbPath, key, val);
  }
  return ok;
}

function updateEditorText(
  editor: vscode.TextEditor,
  range: vscode.Range,
  key: string
): void {
  editor.edit((editBuilder) => {
    editBuilder.replace(range, `${options.keyPrefix}${key}`);
  });
}
