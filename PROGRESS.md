# Progress

## Current phase / task
T-027 CI investigation (2026-10-25); keep T-027 unchecked.
Evidence: docs/t027-ci-investigation.md and docs/t027-milestone2-qa.md.

## CI status
Run 40055575496 / attempt 1 / exact 176b18450b63a3a7c75382bb441b68ce60b6680c:
Ubuntu SUCCESS; Windows/macOS FAIL, independently confirmed from REST metadata.
Windows: 1,032 units pass, 75 hosts pass/1 fails; 1-GB JSONL startup 102.5402 ms
exceeds unchanged 100 ms. Separate blink WidgetHost console error also fails.
macOS: 1,018 units pass/14 platform skips, all 76 hosts pass; 40 GPU mailbox errors
fail strict diagnostics. Causes remain unestablished; no unchanged retry.

## Current candidate
Add bounded opt-in fixed-label sync/await host spans and passive OS process tree.
No subscriber preserves original values/promises/errors without clocks/CPU reads.
Keep original timer and every workload, deadline, renderer and diagnostic guard.
Reject and retain active CLI-status probe: assertion passes but GPU error fails;
it starts another Code/GPU tree. Replace with passive canonical-profile observer.
Stronger privacy/ownership/collector regressions pass: 42 focused tests/6 files.
Independent follow-up clears inspected implementation; no remaining concrete finding.
Changed passive probe passes 1 host with exact source; its three approved
warnings and all retained failures/observation limits are in the CI record.

## Verify status
Literal verify PASS: 1,048 units/108 files, zero errors/warnings, 598.476 s.
CI-enabled literal full PASS: same units plus 77 hosts, 2602.983 s.
Both retain 310 identical hashes and every original data/source/large-file check.
Full NOT warning-free: one warning HOST-001, signed-out CloudSandboxApi GitHub
session, 20261025T160104/window1/renderer.log:10; exact message in CI record.
Matching 1-GB JSONL raw 41.3198 ms/fork 30.1641 ms does not explain failed CI.

## Decisions / next
Owner README/shared-spec hunks and unrelated fixtures/debug files stay untouched.
No dependency, source-safety, diagnostic-exception or later-feature change.
Commit only task-owned changes. Owner pushes and supplies
fresh candidate CI URL/SHA plus complete Windows/macOS/Ubuntu verify logs.
Do not tick T-027 or claim release/tag/milestone closure from diagnostic success.
