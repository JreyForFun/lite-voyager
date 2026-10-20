# Progress

## Current phase / task
Milestone 2: T-025 CI fixture repair; owner retains push/actual-candidate CI.
Current evidence: docs/t025-ci-repair.md; earlier history: docs/t025-opening.md.

## Verify status
Run 39304280687 /attempt 1/exact 3c836def34a65eaec26e627908df18014c017485 FAILS.
Ubuntu rejects a main-process blocked webview request after 916 units/72 hosts.
Windows/macOS install/full succeed; remote raw logs remain unread.
Repaired final standalone PASS: 920 units/93 files, zero errors/warnings.
Repaired full-2 PASS: 920 units/72 hosts, 49m22s; ci-full-2.log/status.json.
All 317 source/spec/record hashes match across full; FDM absent at preflight.
Exactly two approved warnings in 20261020T112015/window1/renderer.log:
HOST-002 line 2: Creation of workbench contribution 'workbench.contrib.chatLanguageModelsData' took 32ms.
HOST-001 line 11: [CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]
Both severity warning; full is not warning-free. No other diagnostic accepted.

## Last session
Renamed SQLite fixtures now await transport, exact-URI close and helper exit.
Two regressions fail first; seven lifecycle units/four focused hosts pass.
Focused sole HOST-001 is 20261020T102059/window1/renderer.log:9, warning.
Historical blocked-request UUID is unmapped; exact causation remains unproven.
First full fails: 917 units pass; fallback FR-016 exceeds unchanged 5000ms.
Read-only preparation moves before first engine open, removing unused startup.
Two regressions fail first; 30 metadata cases and independent review pass.
Final full passes all four T-025 cases, large-file guards and source safety.
Standalone caption/lint failures and review-driven interruption remain recorded.

## Decisions / limits
No production/dependency/protocol/timeout/sample/diagnostic-policy change.
No skipped test, weaker safety assertion or unchanged full retry.
Prior ten component renders stand; native/other-platform visuals unobserved.
Owner README/PLAN/T-015 edits and unrelated fixtures stay excluded.

## Next
Owner pushes scoped repair commit and supplies fresh three-platform CI.
T-025 stays unchecked until actual-candidate CI passes; no other task may close.
No milestone, release or tag. Earlier failed/interrupted runs stay separate.
