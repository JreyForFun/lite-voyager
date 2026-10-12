# Progress

## Current phase / task
Milestone 1; T-018 CI viewport repair; feature and owner QA 1–6 pass.
T-018 remains unchecked pending independent review and fresh repaired CI.
Prior T-017 repairs/CI remain complete; no milestone closure or release tag.

## Verify status
- Repair `npm run verify`: 437 tests / 39 files, zero errors/warnings.
- Repair `verify:full`: 437 unit / 32 host tests; exit 0, one approved warning.
- Profile xLQJr4, 20261013T023925/window1/renderer.log:10, VSCODE-HOST-001.
- Exact warning in VALIDATION; final full is not warning-free, zero errors.
- Windows x64 / VS Code 1.140.0 / host Node 24.21.0.
- VSIX: 20 files / 617.71 KB; transform worker ships.
- Both backends: exact JSON/TSV, 1.1M-character cell, 1000 columns, source unchanged.
- Run 38289818635/attempt 1/d29dfff: Win/macOS fail, Ubuntu pass; history retained.

## Last session
Confirm CI metadata and Windows/macOS logs; REAL column was initially offscreen.
Reproduce 620px grid/report validation failures; two red-first regressions pass.
Report actual DOM column ordinals and navigate to all nine fidelity cells.
Preserve every expected value/label, fixture, deadline and source-safety assertion.

## Decisions made this session
Owner delegates implementation/uncertainties/scoped repairs; owner pushes.
TSV: unquoted `\N` NULL; empty/literal `\N` quoted; raw JSON, no headers.
Output budget: 16 Mi characters; oversized JSON shows full raw text with notice.
No dependency, Engine, fixture, CSS or deadline change; untracked files untouched.

## Known issues / blockers
Independent review including this repair and fresh repaired CI are outstanding.
Clipboard writes already started cannot be retracted by cancellation; UI says so.
Schema panel, T-014/later features and whole-milestone performance remain open.

## Next
Fresh chat: paste VALIDATION's T-018 prompt; review cumulative diff from 5ebbe7f.
After review, owner pushes with `git push origin main` in the project terminal.
Return CI run URL, tested SHA and Windows/macOS/Ubuntu job conclusions.
Tick T-018 only after review/CI pass; then start T-014 in a fresh chat.
