import * as vscode from "vscode";
import { ExtractToArbProvider } from "./commands/codeActionProvider";
import { extractStringToArb } from "./commands/action";

export function activate(context: vscode.ExtensionContext) {
  // Code Action Provider
  const provider = vscode.languages.registerCodeActionsProvider(
    { language: "dart", scheme: "file" },
    new ExtractToArbProvider(),
    { providedCodeActionKinds: [vscode.CodeActionKind.Refactor] }
  );

  // Command: Extract selected string
  const singleExtractCommand = vscode.commands.registerCommand(
    "flutter.extractToArb",
    extractStringToArb
  );
  context.subscriptions.push(provider, singleExtractCommand);
}

export function deactivate() {}
