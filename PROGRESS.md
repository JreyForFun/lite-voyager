# Progress

## Current phase / task
Milestone 2: T-024 CI repairs pass local full gate; task remains unchecked.
Owner delegates implementation/fixtures/repairs/visual QA; retains push/CI.
Acceptance/file list: docs/t024-xlsx.md; follow-up: docs/t024-ci-repair.md.

## Verify status
Run 39059472250 /attempt 1 /2139f7c fails Windows/macOS; Ubuntu passes.
Windows: 808 units pass /40 XLSX source-identity failures, reproduced locally.
macOS: 848 units pass; 67 hosts pass /1 CSV file-size memory-growth failure.
CSV combined peaks 281886720/357597184; growth 75710464 >50000000 bytes.
New Windows canonical-path regression fails first; repaired focused suite 42 pass.
Both-engine CSV/BOM/boundary suite 48 pass, including complete 16-MiB record.
Repaired verify:full passes 857 units /86 files and all 68 hosts (32 min).
Types/lint/build/34-file VSIX pass without errors/warnings; full has HOST-001.
Exact warning/source: docs/t024-ci-repair.md; full run is not warning-free.
CSV peaks 312283136/308166656; paging growth 17317888/32956416 bytes pass.
Keep every earlier failed gate/unknown timing cause; no unchanged retry-to-green.

## Last session
Use native sync realpath to match async snapshots; metadata guards unchanged.
After strict scanning, split quote-free CSV records without per-row Papa graphs.
Quoted parsing, source checks, fixtures and gate/resource limits retained.
Parser diagnostic reduces sampled RSS/heap; actual Windows CSV full also passes.
Independent Bugbot review finds no concrete bug; macOS proof remains pending.
Prior scoped XLSX visuals/host coverage retained; no UI changes in CI repair.
Native capture failed twice; no physical/native appearance claim.

## Decisions / limits
All-sheet import, exact numeric/cached-formula semantics and consent retained.
Original CSV timer failure, focused fallback timeout and failed CI retained.
Owner README/T-015 edits and unrelated untracked fixtures stay excluded.

## Next
Scoped repair is prepared; owner edits and all failed evidence remain preserved.
Owner pushes; repaired-candidate three-platform CI remains required.
No T-025, whole-milestone closure, release or tag is claimed.
