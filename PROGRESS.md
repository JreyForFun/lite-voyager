# Progress

## Current phase / task
Milestone 2, T-021 CI repair only. Owner delegates QA/fixes and retains push/CI.
Local acceptance/review passes; T-021 stays unchecked only for fresh three-platform CI.

## Verify status
Final npm run verify: 666 tests/64 files, 194.88-second units, zero errors/warnings.
Final npm run verify:full: 666 units (190.72 sec), all 57 hosts (14 min), strict logs PASS.
Profile out/integration-profile-2NTUCC; VS Code 1.140.0, Node24.21.0, Windows x64.
Exactly one approved HOST-001 warning: 20261015T161408/window1/renderer.log:10.
Exact message/severity and all retained failures: VALIDATION T-021; not warning-free.

## Last session
CI 38689094274/attempt1/e03f357 fails all three platforms; locked installs pass.
Import startup was mislabeled as paging, and the CSV test did no actual paging.
Red-first phase/identity tests repair measurement without dropping any sample.
Real 60 Browse/20 SQL pages expose 81.8-MB growth; diagnostic run reproduces 82.3 MB.
Helper decoding churn dominates; use the existing import nursery setting for DB.
Default old/large-object limits stay unchanged. Independent follow-up clears repair.
Final 1/5-GB CSV peaks: 428,367,872 /368,214,016 bytes; actual paging growth
33,869,824 /36,433,920 bytes. Exact rows/hashes, all 80 pages per size and guards pass.
First DOM 229.5558 /501.8770 ms; host timer gaps 37.7110 /42.5171 ms.
16-MiB record survives explicit oversized-page refusal and exact SQL recovery.
Delegated scoped visual QA remains passed; no owner visual-QA wait.

## Decisions / limits
Every sample remains in 500-MB absolute peak/3-second gap checks; distinct import/
browser identities and five baseline/paging/final observations stay mandatory.
Both 50-MB growth guards, all deadlines, fixtures and diagnostic rules unchanged.
No dependency/workflow change; unrelated owner README/T-015 edits/fixtures preserved.

## Next
Owner: git push origin main; provide fresh run URL/SHA and all three job outcomes.
Keep T-021 unchecked until actual-candidate Windows/macOS/Ubuntu CI passes.
No T-022, milestone/release closure or large local WSL retry.
