# Progress

## Current phase / task
T-030 CI diagnostics/collector repair locally verified (2026-10-31); macOS CI pending.
Owner authorizes scoped fixes, QA and local commit; retains push and CI.
Only T-030 is active. Details: docs/t030-macos-ci-investigation.md.

## Accepted implementation / checks
REST confirms run41174034992 /attempt1/exact8cf3116; Windows/Ubuntu succeed.
macOS passes1132 units/14 existing skips and79 hosts, then strict gate fails.
Twenty GPU errors:10 ProduceOverlay missing-mailbox plus10 Invalid mailbox.
Snapshot identifies GPU PID8580; D-5 closure proximity is not causation; review clear.
JSON/JSONL intervals pass; old266.675ms gap unexplained; no saved CI artifacts.
New validation helper scans saved logs after host failure, preserving both failures.
Strict scanners, renderers, versions, workloads and all guards stay unchanged.
Five regressions; old sequential behavior fails2/5; repaired focused94/4 pass.
First standalone lint corrected; second fails Windows collector's10s cap (1150/1).
Probe confirms cumulative CIM query cost exceeds the cap; no EOF hang proved.
Keyed cmdlet proposal passes once then fails102/1 and is reverted; retain it.
Direct local CimSession.GetInstance avoids repeated cmdlet/session setup.
Provider edge tests and all20 exact-identity observations pass; guards unchanged.
Passive D-5 format/view lifecycle timestamps added; no source data or GPU calls.
Focused107/6 and independent reviews clear; standalone1155/115 passes,711.140s.
Standalone zero errors/warnings; full1155+79 passes2564.210s;375 hashes match both.

## QA / remaining work
Full is NOT warning-free: exact HOST-00233ms and HOST-001 records are in the CI doc.
194 lifecycle/20 shutdown records validated; no physical macOS QA/GPU cause claim.
New saved-log scan and bounded lifecycle evidence support owner-pushed macOS CI.
Scheduling zeros are indeterminate; no causal graphics/timing repair claim.
Retain prior physical-QA limits, fallback writer race and unknown save outcome.
Prepare verified local commit; owner retains pushes/CI; macOS acceptance remains open.
Keep T-030 unchecked; no later task, relaxed guard/policy or milestone closure.

## Preserved work / checkpoint
Preserve owner README/shared-spec/TASKS hunks, debug.log, gingTryWan and fixtures.
Continue here as owner directs; prepared over8cf3116; no push/tag/dependency change.
Manifest stays0.0.1; T-028 local v0.2.0 remains accepted.
