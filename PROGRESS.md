# Progress

## Current phase / task
T-027 HOST-006 verified locally (2026-10-26); keep T-027 unchecked.
Current evidence/proposal: docs/t027-ci-startup-warning-proposal.md.

## CI status
Run 40178896696 / attempt 1 / exact 084ab2ba07f81cb4b2a4b3b69a35ba2dbc31596f:
Windows/Ubuntu SUCCESS; macOS FAIL, independently confirmed by REST metadata.
All installs pass. macOS 1,034 units pass/14 skips; all 77 hosts pass and exit 0.
Full fails on renderer.log:13, 2026-10-25 09:04:55.382 [warning]
Creation of workbench contribution 'chat.builtinTools' took 212ms.
HOST-001 also reported at renderer.log:16, session 20261025T090446/window1.
No GPU error or original >100-ms interval appears in the supplied macOS log.
Old 40055575496 failures remain retained; their causes/repairs are unestablished.

## Current candidate
Owner approves exact reviewed sixth-family proposal and delegates implementation.
Add only chat.builtinTools unsigned-integer timing regex/rule type; preserve
existing renderer/severity/reporting guards and every other diagnostic failure.
Installed vendor 1.140 Windows bundle identifies Eventually contribution and
synchronous constructor timing warning; exact macOS source fetch returns 404.
Update current AGENTS/SPEC/PLAN/VALIDATION; retain prior failed CI and limits.
No UI, dependency, launch-argument, performance guard or workload changes.

## Verify status
26 new acceptance/guard tests: red 6 fail/68 pass before rule, green 74 pass.
Standalone PASS: 1,074 units/108 files, zero errors/warnings, 583.110 s.
CI-enabled full PASS: same units plus 77 hosts, 2898.017 s; 314 unchanged hashes.
Full NOT warning-free: HOST-005 (49ms) line1 and HOST-001 line11, severity warning,
source 20261025T233217/window1/renderer.log; exact records/metrics in evidence.
All original large-file/data/source/timing/memory checks pass; no guard changes.
Independent review clear; retain red/green and sandbox/tool-preview failures.

## Decisions / next
Owner README/shared-spec hunks and unrelated fixtures/debug files stay untouched.
Commit only eight task files; post-gate edits are records only.
Owner pushes and supplies fresh actual-candidate three-platform CI.
No task/release/tag/milestone closure or historical GPU/timing repair claim.
