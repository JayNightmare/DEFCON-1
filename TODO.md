# Extension Meltdown - Project Scope

## MoSCoW Priorities

### Must Have

- **Diagnostic Listener**: Analyze current workspace diagnostics (problems/errors).
- **DEFCON Logic**: Determine alert level based on error count.
- **Visual Feedback**: Modify `workbench.colorCustomizations` in settings (user or workspace) to reflect the current DEFCON level.
- **Performance Safety**: Debounce updates to prevent crashing the extension host or the UI on rapid typing.

### Should Have

- **Status Bar Item**: Show current DEFCON level and error count in the status bar.
- **Configuration**: Allow users to customize error thresholds for each level.

### Could Have

- **Animations**: Pulse effects for high DEFCON levels (limited by VS Code API capabilities, might need CSS hacks or creative color cycling).
- **Sound Effects**: Play alarm sounds on DEFCON 1 (requires caution).

### Won't Have

- **Heavy visual effects**: Anything that explicitly drags down VS Code performance.
- **External Dependencies**: No remote servers or heavy telemetry.
- **Blocking UI**: Modal alerts that interrupt typing.

## DEFCON Logic (Linting Error Counts)

| Level        | Condition (Error Count) | Description            | Color Theme     |
| :----------- | :---------------------- | :--------------------- | :-------------- |
| **DEFCON 5** | 0 Errors                | Normal Readiness       | Green / Default |
| **DEFCON 4** | 1-2 Errors              | Increased Intelligence | Blue            |
| **DEFCON 3** | 3-5 Errors              | Round House            | Yellow          |
| **DEFCON 2** | 6-10 Errors             | Fast Pace              | Orange          |
| **DEFCON 1** | > 10 Errors             | Cocked Pistol          | Red             |

## Current Sprint Goal

Implement the Core Diagnostic Listener and colored workbench customizations without performance regression.
