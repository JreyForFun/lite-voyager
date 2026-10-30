# Progress

## Current phase / task
T-030 local CI repair gates pass (2026-10-30); fresh candidate CI pending.
Owner authorized scoped fixes, QA and local commit; retains push and CI.
Only T-030 is active. Current details: docs/t030-ci-repair.md.

## Accepted implementation / checks
Failed run40568873744 /attempt1 at1257ca5: Windows/macOS fail, Ubuntu passes.
Windows17 failures: native/short path mismatch reproduced and repaired test-first.
Case-insensitive POSIX Save As sidecar bypass also repaired;11 path cases pass.
Bounded test-only scheduling diagnostics pass9 cases; raw100ms guard unchanged.
Independent review and follow-up find no remaining concrete repair defects.
Final npm run verify:1146 units/113 files, zero errors/warnings,655.414s.
Final npm run verify:full:1146 units plus79 integration tests,2488.068s.
Minimum VSCode1.140.0/Node24.21.0; both T-030 engine workflows pass.
Both gates preserve368 hashes, identical between gates; only records change later.
Full is NOT warning-free: VSCODE-HOST-001, warning, renderer.log:10,
source20261030T193906/window1 under out/integration-profile-o91RbA/logs/.
Exact message: [CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]
Logs/status/hashes: out/t030-ci-verify-2* and out/t030-ci-full-2*.

## QA / remaining work
Mac's266.675ms JSONL5GB gap remains unexplained; no causal repair claim.
Local JSONL5GB passes at40.879ms; this does not establish macOS behavior.
Minimum-host scheduling counters emit zeros; treat them as indeterminate.
Retain all failed/stopped runs, including the first repair full stopped for safety.
Earlier physical QA limits, fallback writer race and unknown save outcome remain.
Owner pushes the repair commit and supplies new CI run URL/exact SHA/OS results.
Keep T-030 unchecked until fresh three-platform candidate CI passes.
No relaxed guard, warning policy, later task or milestone-release closure.

## Preserved work / checkpoint
Preserve owner README/shared-spec/TASKS hunks, debug.log, gingTryWan and fixtures.
Repair is prepared over failed1257ca5; no push/tag/release/dependency change.
Manifest stays0.0.1; T-028 local v0.2.0 remains accepted.
