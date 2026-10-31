# Progress

## Current phase / task
T-030 canonical-path fixture repair locally verified (2026-10-31); CI pending.
Owner authorizes scoped fixes, QA and local commit; retains push and CI.
Only T-030 is active. Details: docs/t030-ci-fixture-repair.md.

## Accepted implementation / checks
Run41054019454 /attempt1 at8a1d9af: Windows/macOS fail7 fixtures; Ubuntu passes.
REST confirms exact candidate; both failing jobs stop before host tests.
Fixtures passed raw temp paths; worker requires the canonical snapshot path.
Forced-alias reproduction fails the exact7 cases locally before correction.
Fixture parents/maps are canonical; constructors now retain a distinct alias.
All original safety/writer/byte assertions remain; no runtime changes or new skips.
Focused53 tests/3 files pass; independent fixture review finds no concrete defect.
Final npm run verify passes1146 units/113 files, zero errors/warnings,691.519s.
All369 gate hashes match; only evidence records change afterward.
All165 runtime/host/verification files match the prior full run byte-for-byte.
No product source, host test, build/config or guard change in this repair.
Retain pasted CI logs and red/green records under out/t030-fixture-*.

## QA / remaining work
Prior local verify1146 units and full79 hosts pass; these are historical results.
Prior full is NOT warning-free; exact HOST-001 warning is in docs/t030-ci-repair.md.
No new full-host pass claimed for this fixture-only repair; fresh CI is required.
The earlier266.675ms macOS gap remains unexplained and untested by failed CI.
Scheduling zeros are indeterminate; no causal timing repair claim.
Retain prior physical-QA limits, fallback writer race and unknown save outcome.
Owner pushes the repair commit and supplies fresh CI run URL/exact SHA/OS results.
Keep T-030 unchecked; no later task, relaxed guard/policy or milestone closure.

## Preserved work / checkpoint
Preserve owner README/shared-spec/TASKS hunks, debug.log, gingTryWan and fixtures.
Prepared over failed8a1d9af; no push/tag/release/dependency change.
Manifest stays0.0.1; T-028 local v0.2.0 remains accepted.
