# T-026: clean-checkout fixture repair (2026-10-22)

[Run 39771461612](https://github.com/JreyForFun/lite-voyager/actions/runs/39771461612),
attempt 1, exact `63dadc9dacd9c32b5ffb1a9ac10f7f83a572cc3b`, fails on Ubuntu,
Windows and macOS. GitHub REST run/job metadata independently confirms each failed
job/applicable verification step and successful locked install. The owner supplies
the three verification-step logs. They are retained byte-for-byte with SHA-256
in out/t026-ci-39771461612-evidence.json and the three platform .log files.

All platforms fail the same four FR-012 worker tests with ENOENT from mkdtemp:
out/t026-unicode-* and out/t026-unit-*. Windows reports 963 pass/4 fail;
Ubuntu and macOS each report 950 pass/4 fail/13 platform skips (967 total).
Types and lint pass. Build/packaging/host integration are not reached. Remote
host coverage and remote warning-free status are not claimed.

## Cause and acceptance

The real-worker suite builds dist in beforeAll, then attempts mkdtemp inside out
without creating that parent. out is ignored and absent on a fresh checkout.
This local workspace already contained it, hiding the fixture's dependence on
prior artifacts/suite order. No generator, application engine or platform-specific
autocomplete defect is indicated by these logs.

Retain every original test/assertion/schema/SQL/source-hash check and existing
30000-ms build setup/15000-ms worker-case budgets. Test the actual four-case suite
from an owned fresh project root with no out directory. Do not change the CI
workflow or global runner to pre-create a directory for this fixture.

## Red-first repair

- New sql-completion-clean-checkout.test.ts copies the actual source/webview/build
  inputs and original four-case worker suite to an owned OS temporary root, links
  existing dependencies and asserts out is absent. The first run fails all four
  child cases with the exact CI ENOENT paths; the parent regression fails too.
- Both fixture prefixes now use mkdtemp under the OS temp directory, matching
  established engine tests. Cleanup verifies the owned parent before recursive
  deletion. No application, engine, worker, workflow, dependency or limit changes.
- The regression removes the dependency link before guarded temporary-root
  cleanup. Its bounded wrapper covers the existing 30-second setup plus four
  15-second budgets; none of those existing budgets is increased.
- The same clean-root run then passes all four actual native/fallback worker
  cases, including accepted Unicode/quoted SQL, 125 tables/1003 columns, distant
  prefix matches, broken-view recovery, export preservation and source hashes.
- Focused tests PASS: 20 cases/three files, including the new parent regression;
  all four repeated child cases pass. Duration 12.75 seconds. Independent
  read-only review finds no concrete defect or assertion/cleanup weakening.

## Repaired candidate verification

Reviewed executable candidate: `cfa7bee`. Literal `npm run verify` PASSes all
968 units/98 files, typechecks, lint, production build and the unchanged
34-file/996.36-KB VSIX with zero warnings/errors. Its retained log/status are
out/t026-ci-repair-verify-1.log and -status.json. UTC window:
2026-10-22T12:41:15.424Z through 12:50:38.501Z (563.077 seconds).

One literal `npm run verify:full` for this repaired candidate PASSes 968 units
and 76 host tests, including all four FR-012 cases on both engines, complete
SQLite/JSON/JSONL/CSV workloads, exact data/source hashes and all 80 CSV pages per
size. Retained log/status: out/t026-ci-repair-full-1.log and -status.json.
UTC window: 2026-10-22T12:50:55.122Z through 13:35:16.004Z (2660.882 seconds).
All 282 captured files match before/after each gate; no source/spec/record edits
occur during either gate. Final record updates are documentation only.

The full run is **not warning-free**. Its sole exact approved diagnostic is
`VSCODE-HOST-001`, severity `warning`, source
`20261022T210019/window1/renderer.log`, line 10, message:
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
The strict scan passes without any other accepted warning/error.

CSV 1/5-GB sampled host/helper peaks are 278798336 /281505792 bytes;
paging growth is 29388800 /26963968 bytes; maximum observation gaps are
1198.7467 /1279.6227 ms under the unchanged 3000-ms guard. All 60 Browse/20 SQL
pages per size pass. SQLite peaks are 284299264 /291651584 bytes. JSON 1/5-GB
peaks are 305573888 /302821376 bytes; JSONL peaks are 264900608 /275374080 bytes.
Renderer residency is recorded separately; these are sampled peaks, not physical
paint/jank measurements. Raw metrics and exact diagnostic are retained in
out/t026-ci-repair-evidence-summary.json. Successful bounded-window Kernel-Power
506/507 queries return zero events for each current gate; checked raw results
are retained beside the logs. Earlier power events and failures stay retained.

The failed CI is retained; owner-pushed fresh actual-candidate Windows/macOS/Ubuntu
CI remains required and T-026 stays unchecked. Earlier local passes, failures,
exact diagnostics and delegated renderer QA remain in
[t026-autocomplete.md](t026-autocomplete.md). This repair changes no UI; earlier
scoped light/dark renderer QA remains applicable, with physical-screen paint/jank
unobserved. The owner retains pushing and remote CI.

Changed files for this repair: test/unit/sql-completion-engine.test.ts,
test/unit/sql-completion-clean-checkout.test.ts, this file, docs/t026-autocomplete.md,
PROGRESS.md, specs/PLAN.md, specs/TASKS.md and specs/VALIDATION.md. Preserve unrelated
owner edits. The owner retains pushing and remote CI.

```
npm test -- test/unit/sql-completion-clean-checkout.test.ts test/unit/sql-completion-engine.test.ts test/unit/sql-completion.test.ts
npm run verify
npm run verify:full
```
