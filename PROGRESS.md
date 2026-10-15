# Progress

## Current phase / task
Milestone 2, T-021 second CI repair only. Owner delegates QA/fixes, retains push/CI.
Local acceptance/review passes; T-021 stays unchecked only for fresh three-platform CI.

## Verify status
Final npm run verify: 668 tests/65 files, 238.36-second units, zero errors/warnings.
Final npm run verify:full: 668 units (193.12 sec), all 57 hosts (12 min), strict logs PASS.
Profile out/integration-profile-JKelee; VS Code 1.140.0 / Node 24.21.0 / Windows x64.
Sole approved final warning: HOST-001, 20261015T173711/window1/renderer.log:10.
Exact message/severity and earlier separate warning/failures: VALIDATION T-021.
Full runs are not warning-free; no diagnostic exception or guard changed.

## Last session
Run 38706558502/attempt 1/f1be89d passes Windows/Ubuntu, fails macOS paging at 51,216,384 bytes.
Mac log passes 666 units/56 hosts; no Mac 5-GB or passing strict-log scan claimed.
Red-first regression observes 6,101 decodes for 100 rows at offset 6,000, expected 101.
Optional Cursor.skipRows traverses the same native iterator before value decoding.
Initial candidate exposes native restart past end; guard it and keep exact totals.
Exact-end/empty results, one execution, int64/BLOB/text and recovery regressions pass.
Final DB-worker nursery 4 MiB; importer 8 MiB/default old/large-object limits unchanged.
16 MiB record/page-refusal/recovery passes. Independent final review finds no defect.
Final 1/5-GB CSV peaks: 373,563,392 /404,877,312 bytes; actual paging growth
31,764,480 /26,832,896 bytes. Exact rows/hashes and all 80 pages per size pass.
First DOM 255.3729 /457.2054 ms; host timer gaps 43.6710 /35.7311 ms.
Unchanged delegated visual QA remains valid; no owner visual-QA wait.

## Decisions / limits
Keep 500-MB peak, 50-MB growth, 3-second gap, helper/phase coverage and all deadlines.
No SQL rewrite, count rerun, forced GC, dependency, workflow or warning-policy change.
Warm populated sampled host/helpers only; renderer separate, no physical-paint/Mac proof.
Preserve owner README/T-015 edits/fixtures and all failed evidence.

## Next
Owner: git push origin main; provide fresh run URL/SHA and all three job outcomes.
Keep T-021 unchecked until actual-candidate Windows/macOS/Ubuntu CI passes.
No T-022, milestone/release closure or large local WSL retry.
