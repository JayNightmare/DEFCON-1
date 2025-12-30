/**
 * DEFCON 1 Extension
 *
 * Purpose: This extension monitors workspace diagnostics (specifically errors) and adjusts the
 * workbench color theme to reflect the current "DEFCON" level. It calculates the number of
 * errors across all files and updates `workbench.colorCustomizations` in the workspace settings.
 */

import * as vscode from "vscode";
import { DefconPanel } from "./PanelProvider";
import { isDeepStrictEqual } from "util";

let debounceTimer: NodeJS.Timeout | undefined;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    // Create Status Bar Item
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.command = "defcon1.openSettings";
    context.subscriptions.push(statusBarItem);

    // Register the settings panel command
    context.subscriptions.push(
        vscode.commands.registerCommand("defcon1.openSettings", () => {
            DefconPanel.createOrShow(context.extensionUri);
        })
    );

    const diagnosticCollection =
        vscode.languages.createDiagnosticCollection("defcon1");
    context.subscriptions.push(diagnosticCollection);

    context.subscriptions.push(
        vscode.languages.onDidChangeDiagnostics(
            (e: vscode.DiagnosticChangeEvent) => {
                triggerUpdate();
            }
        )
    );

    // Also listen for configuration changes to defcon1.settings to update immediately
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("defcon1.settings")) {
                triggerUpdate();
            }
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveColorTheme((e: vscode.ColorTheme) => {
            triggerUpdate();
        })
    );

    triggerUpdate();
}

function triggerUpdate() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
        updateDefconStatus();
    }, 1000);
}

function updateDefconStatus() {
    const allDiagnostics = vscode.languages.getDiagnostics();
    let errorCount = 0;

    for (const [uri, diagnostics] of allDiagnostics) {
        for (const diagnostic of diagnostics) {
            if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
                errorCount++;
            }
        }
    }

    applyDefconLevel(errorCount);
}

function applyDefconLevel(errorCount: number) {
    const workbenchConfig = vscode.workspace.getConfiguration("workbench");
    const defconConfig = vscode.workspace
        .getConfiguration("defcon1")
        .get<any>("settings");

    if (!defconConfig) {
        return; // No config, do nothing
    }

    let colorCustomizations =
        workbenchConfig.get<any>("colorCustomizations") || {};

    // Determine Level
    const levels = defconConfig.levels;
    let activeLevelConfig = levels.defcon5; // Default

    // Sort levels by threshold to find the matching one
    // Start checking from lowest threshold (Defcon 5 = 0) to highest
    // Actually, we want to find the highest threshold that is <= errorCount?
    // Or based on ranges? The previous logic was:
    // 5: 0
    // 4: <=2
    // 3: <=5
    // 2: <=10
    // 1: >10

    // Let's rely on the user defined thresholds.
    // We check if errorCount <= threshold.
    // Wait, typical DEFCON logic:
    // DEFCON 5: 0
    // DEFCON 4: <= 2
    // If I have 1 error, I am <= 2 (DEFCON 4).
    // If I have 0 errors, I am <= 0 (DEFCON 5) AND <= 2.
    // So we should pick the *smallest* threshold that satisfies `errorCount <= threshold`?
    // No, strictly `errorCount <= threshold`.
    // 0 <= 0 (Match 5)
    // 0 <= 2 (Match 4)
    // We want the most specific (lowest) match? Or highest priority?
    // DEFCON 5 is safest. DEFCON 1 is dangerous.
    // Let's sort levels by threshold ascending.
    // The first one where errorCount <= threshold is our level.

    // Example:
    // 5: 0
    // 4: 2
    // 3: 5
    // 2: 10
    // 1: 9999

    // errorCount = 0: <=0 (Defcon 5) -> Match.
    // errorCount = 1: <=0 (False). <=2 (True - Defcon 4).
    // errorCount = 11: <=10 (False). <=9999 (True - Defcon 1).

    // So, find first (smallest threshold) where errorCount <= threshold.

    // Sort levels by threshold to find the matching one
    const sortedLevels = Object.entries(levels).sort(
        (a: any, b: any) => a[1].threshold - b[1].threshold
    );

    let levelName = "DEFCON 5";
    for (const [key, value] of sortedLevels) {
        if (errorCount <= (value as any).threshold) {
            activeLevelConfig = value;
            levelName = key.toUpperCase().replace("DEFCON", "DEFCON "); // e.g. "DEFCON 1"
            // Check if we have a custom name or just use key?
            // let's format key "defcon5" -> "Defcon 5" or just use what we have.
            // The key is "defcon5", "defcon4"...
            // Let's make it look nice: "DEFCON 5"
            const num = key.replace("defcon", "");
            levelName = `DEFCON ${num}`;
            break;
        }
    }

    const color = activeLevelConfig.color;

    // Update Status Bar
    statusBarItem.text = `$(shield) ${levelName}`;
    statusBarItem.color = "white"; // Sets the text color
    statusBarItem.tooltip = `Current Level: ${levelName} (${errorCount} errors). Click to configure.`;
    statusBarItem.show();

    // Determine Targets
    const targets = defconConfig.targets;

    let newColors: any = { ...colorCustomizations };

    if (targets.titleBar) {
        newColors["titleBar.activeBackground"] = color;
        newColors["titleBar.inactiveBackground"] = color;
    } else {
        // If we previously set it, we might want to unset it.
        // Assuming we want to "clean up" our changes.
        // But simply deleting it depends on if it was there before.
        // For this iteration, let's just not set it if unchecked, but better to Explicitly set or unset.
        // If I uncheck "Title Bar", I expect it to go back to default.
        // So I should `delete` it from the object we are about to save.
        delete newColors["titleBar.activeBackground"];
        delete newColors["titleBar.inactiveBackground"];
    }

    if (targets.statusBar) {
        newColors["statusBar.background"] = color;
    } else {
        delete newColors["statusBar.background"];
    }

    if (targets.activityBar) {
        newColors["activityBar.background"] = color;
    } else {
        delete newColors["activityBar.background"];
    }

    if (isDeepStrictEqual(colorCustomizations, newColors)) {
        return;
    }

    workbenchConfig.update(
        "colorCustomizations",
        newColors,
        vscode.ConfigurationTarget.Workspace
    );
}

export function deactivate() {}
