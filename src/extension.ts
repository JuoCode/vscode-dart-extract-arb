import * as vscode from "vscode";

import { extractToArb } from "./action";
import { isStringLiteral } from "./utils";

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
