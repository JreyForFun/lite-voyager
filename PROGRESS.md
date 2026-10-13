# Progress

## Current phase / task
Milestone 1; T-014 implementation, local gates, owner QA 1-6 and repaired CI pass.
T-014 stays unchecked only for fresh-context independent review.
No milestone closure or release tag; do not start the next task yet.

## Verify status
- Final local verify: 447 tests / 39 files, zero errors/warnings (unit 161.37 s).
- Local full: 447 unit / 36 host, exit 0; one approved host warning.
- pubCu0, 20261013T121620/window1/renderer.log:10, VSCODE-HOST-001.
- Full is not warning-free; exact message remains in VALIDATION.
- Repair CI: run 38346736300/attempt 1/780f974 succeeds on all 3 platforms.
- Locked installs and applicable full checks independently verified via API.
- Raw remote logs/warning counts were not retrieved or called warning-free.
- Prior failed CI 38341388121/21da760 and local failures remain recorded.
- VSIX: 20 files / 618.15 KB; no dependency or fixture-data change.

## Last session
Update only PLAN, VALIDATION, TASKS and this handoff; no code/test changes.

## Decisions made this session
Use keyed opt-in host pulses plus native webview event observations.
At most one API delivery promise pending; stop clears its timer/awaits delivery.
Stale/stopped pulses do not count or change action acknowledgements.
Keep 5 samples, 100 ms gaps, 150 ms SQL and 1000 ms helper-exit bounds.
Serialize unit files; within-test concurrency/workloads/deadlines unchanged.
Retain all failed candidates and the originating-cause uncertainty.

## Known issues / blockers
Only independent review remains for T-014 closure.
Original timer-starvation cause is supported, not uniquely proven.
T-015/T-016, schema follow-up and whole-milestone QA remain open.
Existing untracked files remain untouched.

## Next
Use VALIDATION section 6 in a fresh chat with git diff 1d2fc4f..HEAD.
Fix concrete findings with failing tests first, then rerun required gates/CI.
Only tick T-014 after review/closure evidence passes. Owner pushes documentation.
