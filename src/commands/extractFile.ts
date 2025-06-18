import * as vscode from "vscode";
import { extractStringToArb } from "../action";

export async function extractAllTextsInFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const document = editor.document;
  const text = document.getText();

  const regex = /Text\s*\(\s*(['"])(.*?)\1/g;
  const matches = [...text.matchAll(regex)];

  if (matches.length === 0) {
    vscode.window.showInformationMessage("No hardcoded Text() widgets found.");
    return;
  }

  for (const match of matches.reverse()) {
    const quoteChar = match[1]; // " or '
    const innerText = match[2]; // Hello
    const literal = `${quoteChar}${innerText}${quoteChar}`;

    const stringStart = match.index! + match[0].indexOf(literal);
    const stringEnd = stringStart + literal.length;

    const range = new vscode.Range(
      document.positionAt(stringStart),
      document.positionAt(stringEnd)
    );
    console.log(`Extracting: ${literal} at range: ${range}`);

    await extractStringToArb(document, range, literal);
  }
}
