import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import * as deepl from "deepl-node";
import { options } from "./options";

export function isStringLiteral(text: string): boolean {
  return /^['"](.*?)['"]$/.test(text);
}

export function extractKeyNameFromText(text: string) {
  const newText = text
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ") // Replace all non-alphanumeric characters with space
    .replace(
      /(?:^\w|[A-Z]|\b\w|\s+)/g,
      (match, index) =>
        index === 0 ? match.toLowerCase() : match.toUpperCase() // Convert to camelCase
    ) // Convert to camelCase
    .replace(/\s+/g, ""); // Remove spaces
  // make sure the first is lowercase
  return newText.charAt(0).toLowerCase() + newText.slice(1);
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

//  "flutter.deeplApiKey": "your-deepl-api-key-here"
export function getDeeplApiKey(): string | undefined {
  const config = vscode.workspace.getConfiguration("flutter");
  return config.get<string>("deeplApiKey");
}

export async function translateText(
  text: string,
  // sourceLang: string,
  targetLang: string
): Promise<string> {
  const authKey = getDeeplApiKey();
  if (!authKey) {
    if (options.autoTranslate) {
      // show error only if autoTranslate is enabled
      vscode.window.showErrorMessage("DeepL API key is missing");
    }
    return text;
  }
  const translator = new deepl.Translator(authKey);

  // https://developers.deepl.com/docs/resources/supported-languages
  targetLang = targetLang.toLowerCase();
  if (targetLang === "en") targetLang = "en-US";
  if (targetLang === "pt") targetLang = "pt-PT";
  if (targetLang === "zh") targetLang = "zh-HANS";

  const result = await translator.translateText(
    text,
    null, // sourceLang as deepl.SourceLanguageCode,
    targetLang as deepl.TargetLanguageCode
  );

  return result.text;
}

export async function promptForKey(
  defaultValue?: string
): Promise<string | undefined> {
  return vscode.window.showInputBox({
    prompt: "Enter localization key name",
    placeHolder: "key name",
    value: defaultValue,
  });
}

export async function getKey(text: string) {
  if (options.autoGenerateKeyName === "ask")
    return await promptForKey(
      extractKeyNameFromText(await translateText(text, options.keyNameLanguage))
    );

  if (options.autoGenerateKeyName === true)
    return extractKeyNameFromText(
      await translateText(text, options.keyNameLanguage)
    );

  // false -> simple prompt
  return await promptForKey();
}
