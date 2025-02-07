import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import * as deepl from "deepl-node";

export function activate(context: vscode.ExtensionContext) {
  const provider = vscode.languages.registerCodeActionsProvider(
    { language: "dart", scheme: "file" },
    new ExtractToArbProvider(),
    { providedCodeActionKinds: [vscode.CodeActionKind.Refactor] }
  );

  const command = vscode.commands.registerCommand(
    "flutter.extractToArb",
    extractToArb
  );
  context.subscriptions.push(provider, command);
}

export function deactivate() {}

class ExtractToArbProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.CodeAction[] {
    let text = document.getText(range);

    // If no text is selected, expand to the nearest string literal
    if (!text) {
      const wordRange = document.getWordRangeAtPosition(
        range.start,
        /(['"])(.*?)\1/
      );
      if (!wordRange) return [];
      text = document.getText(wordRange);
      range = wordRange;
    }

    if (!isStringLiteral(text)) return [];

    const action = createExtractToArbAction(document, range, text);
    return [action];
  }
}

function isStringLiteral(text: string): boolean {
  return /^['"](.*?)['"]$/.test(text);
}

function createExtractToArbAction(
  document: vscode.TextDocument,
  range: vscode.Range,
  text: string
): vscode.CodeAction {
  const action = new vscode.CodeAction(
    "Extract String to ARB",
    vscode.CodeActionKind.RefactorExtract
  );
  action.command = {
    command: "flutter.extractToArb",
    title: "Extract String to ARB",
    arguments: [document, range, text],
  };
  return action;
}

async function extractToArb(
  document: vscode.TextDocument,
  range: vscode.Range,
  text: string
) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const key = await promptForKey();
  if (!key) return;

  const value = text.slice(1, -1); // Remove quotes from the string literal

  const l10nConfig = readL10nConfig();
  if (!l10nConfig) return;

  const arbDirName = l10nConfig["arb-dir"] || "lib/l10n";
  const templateArbFile = l10nConfig["template-arb-file"] || "app_en.arb";
  const mainLocaleCode = l10nConfig["main-locale"] || "en";
  const autoTranslate = l10nConfig["translate"] || true;
  const importStr = l10nConfig["import-line"] || "";
  const keyPrefix = l10nConfig["key-prefix"] || "context.l10n.";
  // const autoGenerateKeyName = l10nConfig["auto-name-key"] || false;

  const arbWriteSucces = updateArbFiles(
    arbDirName,
    key,
    value,
    templateArbFile,
    mainLocaleCode,
    autoTranslate
  );
  if (!arbWriteSucces) return;

  if (importStr) await addImportIfMissing(document, editor, importStr);

  updateEditorText(editor, range, key, keyPrefix);
  vscode.window.showInformationMessage(`Added "${key}" to app_en.arb`);
}

async function addImportIfMissing(
  document: vscode.TextDocument,
  editor: vscode.TextEditor,
  importStr: string
) {
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
    placeHolder: "titlePage1",
  });
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

async function updateArbFiles(
  arbDirName: string,
  key: string,
  value: string,
  templateArbFileName: string,
  mainLocaleCode: string,
  autoTranslate: boolean
): Promise<boolean> {
  const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath!;
  // app_en.arb or lang_en.arb for example
  const arbDirPath = path.join(workspacePath, arbDirName);

  // app_en.arb -> app_fr.arb
  const mainArbFileName = templateArbFileName.replace(
    "en.arb",
    mainLocaleCode + ".arb"
  );

  let ok = true;

  const arbFiles = fs.readdirSync(arbDirPath).filter((f) => f.endsWith(".arb"));

  for (const arbFile of arbFiles) {
    const fullArbPath = path.join(arbDirPath, arbFile);
    const val =
      autoTranslate && arbFile !== mainArbFileName
        ? await translateText(
            value,
            mainLocaleCode,
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
  key: string,
  keyPrefix: string
): void {
  editor.edit((editBuilder) => {
    editBuilder.replace(range, `${keyPrefix}${key}`);
  });
}
