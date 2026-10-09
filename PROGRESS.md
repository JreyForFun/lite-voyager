# Progress

## Current phase / task
Milestone 0B: T-007 CI regression repair is implemented and locally verified;
fresh three-platform CI evidence is required before checking T-007 again.
T-000, T-001, T-003, T-006, T-005, T-002, T-004, T-008, T-051 and T-050 remain checked.
The foundation milestone remains open; no milestone tag.

## Verify status
- Final npm run verify:full passes on Windows x64 (2026-10-10): 197 unit tests, strict types/lint, builds, 15-file VSIX packaging and eight integration tests in VS Code 1.140.0.
- One approved VSCODE-HOST-001 signed-out renderer warning is explicitly reported; no unexpected warnings or errors. This run is not warning-free.
- Earlier npm run verify passed with 185 tests before the diagnostic-policy tests; the final full command repeats every verify stage with the final code.
- Red-first profile tests exposed missing manifest/fixture setup; red-first diagnostic-policy tests verified the new reporting behavior. Original warnings, near matches, errors and wrong log sources still fail.
- No fresh remote CI result is claimed for this repair. Historical T-002 run 37922970386 passed three platforms at 0e3ec57 on 2026-10-09.

## Last session
- Inspected failed owner-supplied runs 37952380317/ad7c464, 37949436855/d6c359b and 37944872111/eb8c498. All failed on macOS; the oldest also had a Windows CSV responsiveness-test timeout.
- The supplied latest macOS log passes 179 unit/seven integration tests, then fails strict logs on competing extensions.json creation and missing GitHub authentication for dictation.
- Preinitialized an empty installed-extension manifest and added a separate signed-out authentication development fixture; its public VS Code provider returns no sessions and refuses sign-in/removal. It cannot activate outside the test host and is excluded from the VSIX.
- The first repaired real-host run exposed two further vendor warnings. After the owner explicitly approved them, added exact source-restricted classification and mandatory structured reporting; every other warning/error stays fatal.
- Retained the responsiveness test's 100,000 rows, timer assertion and 5-second timeout; reduced transaction count through test-only batching and added full row/source-hash assertions. Production imports are unchanged.
- Synchronized instructions, plan, task status and validation evidence. Changes belong to the local T-007 repair commit; the owner pushes.

## Decisions made this session
- Work only on the T-007 CI repair; no dependencies, application features or committed data fixtures changed.
- Use generated test infrastructure rather than real accounts, authentication requests or modified VS Code binaries.
- Allow only the two explicitly owner-approved renderer families in VALIDATION section 1: signed-out cloud lookup with exact scopes and the exact chatLanguageModelsData startup timing message. Report source, line, severity, rule and message.
- Reopened T-007 and the current local/CI gate checkboxes, preserving earlier successful evidence. Wait for fresh three-platform CI before rechecking them.

## Known issues / blockers
- Fresh Windows/macOS/Linux repair CI is pending; local evidence cannot establish other-platform success or eliminate CI timing variability.
- Milestone review, R-1, D-2 and the 24 existing requirement naming gaps remain open.
- T-004 owner evidence remains preliminary: 1.26 GB, 145.4 s import, 223.0 MB standalone peak RSS, 27.2 ms parsed preview; full row/hash checks pass. This does not prove the 5 GB extension-memory or visible-first-paint targets; disk space prevented the 5 GB run.
- T-050 remains complete: 576 locked paths reviewed, licenses resolved and the 2026-10-09 audit has zero known vulnerabilities. Its latest CI is part of the failed ad7c464 run above, not new green evidence.

## Next
Owner pushes the T-007 repair commit and supplies the Actions run URL and commit SHA,
plus any failing step logs. Check T-007 only after all three Full verification
jobs pass for that commit. Then continue assessing the foundation gate before
Milestone 1; do not start T-009 or create a milestone tag yet.
