# Progress

## Current phase / task
Milestone 1; T-014 owner QA 1-6 and local full repair gate pass.
Run 38341388121/attempt 1/21da760 fails Windows/macOS; Ubuntu passes.
T-014 stays unchecked; no milestone closure or release tag.

## Verify status
- First repair gate: two unchanged five-second unit timeouts (444 pass).
- Switch candidate: 446 unit / 36 host pass, gate fails on 3 CLI warnings.
- Unsupported switches removed; diagnostic policy unchanged.
- Corrected full: 447 unit / 39 files, 36 host; exit 0, one approved warning.
- pubCu0, 20261013T121620/window1/renderer.log:10, VSCODE-HOST-001.
- Full is not warning-free; exact message retained in VALIDATION.
- Final verify: 447 tests / 39 files, zero errors/warnings (unit 161.37 s).

## Last session
Owner reports all six numbered QA checks PASS, including fallback check 6.
GitHub API confirms failed jobs/step/SHA; both pasted failures preserved.
Original CI omitted probe metrics on failure; raw logging now precedes assertions.

## Decisions made this session
Use keyed, opt-in 10 ms host pulses plus native webview timer observations.
One transport request in flight; stop awaits delivery and clears the timer.
Stale/stopped pulses do not count or change action acknowledgements.
Keep 5 samples, 100 ms gaps, 150 ms SQL and 1000 ms helper-exit bounds.
Serialize unit files; within-test concurrency/workloads/deadlines unchanged.
No dependency or fixture-data change. Normal cancellation behavior unchanged.

## Known issues / blockers
Fresh repair CI and independent review remain open; local gates pass.
Background timer starvation is supported but not proven from original CI logs.
Existing untracked files remain untouched; unrelated compiler is not stopped.

## Next
Local gates/evidence complete; owner pushes with git push origin main.
Only T-014 files are committed; existing untracked files remain untouched.
Review git diff 1d2fc4f..HEAD in a fresh chat; supply fresh three-platform CI.
Keep T-014 unchecked until closure evidence passes; stay on this task.
