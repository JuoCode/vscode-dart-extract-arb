import * as vscode from "vscode";
import { ExtractToArbProvider } from "./codeActionProvider";
import { extractStringToArb } from "./action";
import { extractAllTextsInFile } from "./commands/extractFile";

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

  // Command: Extract all in current file
  const fileExtractCommand = vscode.commands.registerCommand(
    "flutter.extractAllTextsInFileToArb",
    extractAllTextsInFile
  );
  context.subscriptions.push(fileExtractCommand);

  // Command: Extract all in workspace
  // const projectExtractCommand = vscode.commands.registerCommand(
  //   "flutter.extractAllTextsInProjectToArb",
  //   extractAllTextsInProject
  // );
  // context.subscriptions.push(projectExtractCommand);
}

export function deactivate() {}
