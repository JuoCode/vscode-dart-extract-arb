import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { options } from "./options";
import {
  chunkArray,
  getKey,
  runFlutterGenL10n,
  translateText,
  translateTextBatch,
} from "./utils";

export function updateFile(filename: string, key: string, value: string) {
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

export async function updateArbFiles(
  key: string,
  value: string
): Promise<boolean> {
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

export async function updateArbFilesBatch(
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
