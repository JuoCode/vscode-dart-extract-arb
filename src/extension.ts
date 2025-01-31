import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    let provider = vscode.languages.registerCodeActionsProvider(
        { language: 'dart', scheme: 'file' },
        new ExtractToArbProvider(),
        {
            providedCodeActionKinds: [vscode.CodeActionKind.Refactor]
        }
    );

    context.subscriptions.push(provider);

    let command = vscode.commands.registerCommand('flutter.extractToArb', extractToArb);

    context.subscriptions.push(command);
}

export function deactivate() {}

class ExtractToArbProvider implements vscode.CodeActionProvider {
    provideCodeActions(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] {
        const text = document.getText(range);
        console.log(text);
        // Match simple string literals
        if (!text.match(/^['"]([^'"]+)['"]$/)) {
            return [];
        }

        const action = new vscode.CodeAction("Extract String to ARB", vscode.CodeActionKind.Refactor);
        action.command = {
            command: 'flutter.extractToArb',
            title: "Extract String to ARB",
            arguments: [document, range, text]
        };

        return [action];
    }
}


async function extractToArb(document: vscode.TextDocument, range: vscode.Range, text: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // Prompt for key name
    const key = await vscode.window.showInputBox({
        prompt: "Enter localization key name",
        placeHolder: "titlePage1",
    });

    if (!key) return;

    // Remove quotes from extracted string
    const value = text.slice(1, -1);

    // Find the ARB file (assumes it's under `lib/l10n/app_en.arb`)
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const arbPath = path.join(workspaceFolders[0].uri.fsPath, 'lib/l10n/app_en.arb');

    // Read and update ARB file
    try {
        let arbContent = fs.existsSync(arbPath) ? fs.readFileSync(arbPath, 'utf8') : "{}";
        let arbJson = JSON.parse(arbContent);
        arbJson[key] = value;
        fs.writeFileSync(arbPath, JSON.stringify(arbJson, null, 2), 'utf8');

        // Replace the string with `context.l10n.<key>`
        editor.edit(editBuilder => {
            editBuilder.replace(range, `context.l10n.${key}`);
        });

        vscode.window.showInformationMessage(`Added "${key}" to app_en.arb`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to update ARB file: ${error}`);
    }
}
