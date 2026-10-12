# Progress

## Current phase / task
Milestone 1; T-018 implementation and automated local acceptance pass.
T-018 remains unchecked pending owner visual QA and fresh-chat review.
Prior T-017 repairs/CI remain complete; no milestone closure or release tag.

## Verify status
- Final `npm run verify`: 435 tests / 39 files, zero errors/warnings.
- `npm run verify:full`: 435 unit / 32 host tests; exit 0, one approved warning.
- Profile `out/integration-profile-mvtPq6`, renderer.log:10, VSCODE-HOST-001.
- Exact warning in VALIDATION; final full is not warning-free, zero errors.
- Windows x64 / VS Code 1.140.0 / host Node 24.21.0.
- VSIX: 20 files / 617.67 KB; transform worker ships.
- Both backends: exact JSON/TSV, 1.1M-character cell, 1000 columns, source unchanged.
- Two failed host runs and red-first scoped repairs are preserved in VALIDATION.

## Last session
Owner QA (2026-10-13): 1/3 PASS; 2 selection TSV matches, row copy unreported.
4 scrolling PASS; typing unobserved, Cancel too fast to observe manually.
5 needs a single-statement retry; 6's supplied NUL query lacks a closing quote.
Rewrite QA navigation/expected output in VALIDATION; no feature code/test change.

## Decisions made this session
Owner delegates implementation/uncertainties/scoped repairs; owner pushes.
TSV: unquoted `\N` NULL; empty/literal `\N` quoted; raw JSON, no headers.
Output budget: 16 Mi characters; oversized JSON shows full raw text with notice.
No dependency, Engine interface or fixture edit; existing untracked files untouched.

## Known issues / blockers
Owner visual QA, independent fresh-chat review and post-push CI are outstanding.
Clipboard writes already started cannot be retracted by cancellation; UI says so.
Schema panel, T-014/later features and whole-milestone performance remain open.

## Next
Retry VALIDATION T-018 row copy, typing, JSON/escaping and remaining check 6 steps.
Fresh chat: review the actual T-018 diff; keep work scoped to this task.
Owner pushes with `git push origin main`; return CI URL/SHA and three outcomes.
Tick only T-018 after remaining closure checks pass; do not start another task here.
