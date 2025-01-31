"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
function activate(context) {
  let provider = vscode.languages.registerCodeActionsProvider(
    { language: "dart", scheme: "file" },
    new ExtractToArbProvider(),
    {
      providedCodeActionKinds: [vscode.CodeActionKind.Refactor]
    }
  );
  context.subscriptions.push(provider);
  let command = vscode.commands.registerCommand("flutter.extractToArb", extractToArb);
  context.subscriptions.push(command);
}
function deactivate() {
}
var ExtractToArbProvider = class {
  provideCodeActions(document, range) {
    const text = document.getText(range);
    console.log(text);
    if (!text.match(/^['"]([^'"]+)['"]$/)) {
      return [];
    }
    const action = new vscode.CodeAction("Extract String to ARB", vscode.CodeActionKind.Refactor);
    action.command = {
      command: "flutter.extractToArb",
      title: "Extract String to ARB",
      arguments: [document, range, text]
    };
    return [action];
  }
};
async function extractToArb(document, range, text) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const key = await vscode.window.showInputBox({
    prompt: "Enter localization key name",
    placeHolder: "titlePage1"
  });
  if (!key) return;
  const value = text.slice(1, -1);
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return;
  const arbPath = path.join(workspaceFolders[0].uri.fsPath, "lib/l10n/app_en.arb");
  try {
    let arbContent = fs.existsSync(arbPath) ? fs.readFileSync(arbPath, "utf8") : "{}";
    let arbJson = JSON.parse(arbContent);
    arbJson[key] = value;
    fs.writeFileSync(arbPath, JSON.stringify(arbJson, null, 2), "utf8");
    editor.edit((editBuilder) => {
      editBuilder.replace(range, `context.l10n.${key}`);
    });
    vscode.window.showInformationMessage(`Added "${key}" to app_en.arb`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to update ARB file: ${error}`);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
