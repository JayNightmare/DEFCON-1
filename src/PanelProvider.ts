import * as vscode from "vscode";
import { TextDecoder } from "util";

export class DefconPanel {
        public static currentPanel: DefconPanel | undefined;
        public static readonly viewType = "defcon1.settings";

        private readonly _panel: vscode.WebviewPanel;
        private readonly _extensionUri: vscode.Uri;
        private _disposables: vscode.Disposable[] = [];

        public static createOrShow(extensionUri: vscode.Uri) {
                const column = vscode.window.activeTextEditor
                        ? vscode.window.activeTextEditor.viewColumn
                        : undefined;

                // If we already have a panel, show it.
                if (DefconPanel.currentPanel) {
                        DefconPanel.currentPanel._panel.reveal(column);
                        return;
                }

                // Otherwise, create a new panel.
                const panel = vscode.window.createWebviewPanel(
                        DefconPanel.viewType,
                        "DEFCON 1 Settings",
                        column || vscode.ViewColumn.One,
                        {
                                enableScripts: true,
                                localResourceRoots: [
                                        vscode.Uri.joinPath(
                                                extensionUri,
                                                "src",
                                                "webview"
                                        ),
                                ],
                        }
                );

                DefconPanel.currentPanel = new DefconPanel(panel, extensionUri);
        }

        private constructor(
                panel: vscode.WebviewPanel,
                extensionUri: vscode.Uri
        ) {
                this._panel = panel;
                this._extensionUri = extensionUri;

                // Set the webview's initial html content
                this._update();

                // Listen for when the panel is disposed
                // This happens when the user closes the panel or when the panel is closed programmatically
                this._panel.onDidDispose(
                        () => this.dispose(),
                        null,
                        this._disposables
                );

                // Update the content based on view state changes
                this._panel.onDidChangeViewState(
                        (e) => {
                                if (this._panel.visible) {
                                        this._update();
                                }
                        },
                        null,
                        this._disposables
                );

                // Handle messages from the webview
                this._panel.webview.onDidReceiveMessage(
                        (message) => {
                                switch (message.command) {
                                        case "ready":
                                                this._sendSettings();
                                                return;
                                        case "updateSettings":
                                                vscode.workspace
                                                        .getConfiguration(
                                                                "defcon1"
                                                        )
                                                        .update(
                                                                "settings",
                                                                message.settings,
                                                                vscode
                                                                        .ConfigurationTarget
                                                                        .Global
                                                        );
                                                return;
                                }
                        },
                        null,
                        this._disposables
                );
        }

        public dispose() {
                DefconPanel.currentPanel = undefined;

                // Clean up our resources
                this._panel.dispose();

                while (this._disposables.length) {
                        const x = this._disposables.pop();
                        if (x) {
                                x.dispose();
                        }
                }
        }

        private async _update() {
                const webview = this._panel.webview;
                this._panel.webview.html = await this._getHtmlForWebview(
                        webview
                );
                // We do NOT send settings here immediately anymore to avoid race condition.
                // We wait for 'ready' message.
                // However, if the webview is already alive and we are just updating HTML (re-rendering),
                // we might need to send it? No, if we set HTML, it reloads.
        }

        private _sendSettings() {
                const config = vscode.workspace.getConfiguration("defcon1");
                const settings = config.get("settings");
                this._panel.webview.postMessage({
                        command: "loadSettings",
                        settings: settings,
                });
        }

        private async _getHtmlForWebview(webview: vscode.Webview) {
                const scriptPathOnDisk = vscode.Uri.joinPath(
                        this._extensionUri,
                        "src",
                        "webview",
                        "index.html"
                );

                // Read file content with error handling
                try {
                        const fileContent = await vscode.workspace.fs.readFile(
                                scriptPathOnDisk
                        );
                        return new TextDecoder().decode(fileContent);
                } catch (e) {
                        console.error("Failed to read webview HTML:", e);
                        vscode.window.showErrorMessage(
                                `DEFCON 1: Could not load settings panel. Error: ${e}`
                        );
                        return `<html><body><h1>Error loading panel</h1><p>${e}</p></body></html>`;
                }
        }
}
