# T-024 candidate CI repair (2026-10-18)

Scope: repair the owner-reported candidate failure without changing any test,
fixture, timing/memory threshold or diagnostic policy. Owner retains push and CI.
T-024 remains unchecked until actual-candidate three-platform evidence passes.
The earlier failures and limits in [the XLSX record](t024-xlsx.md) remain intact.

## Failed candidate

[Run 39059472250](https://github.com/JreyForFun/lite-voyager/actions/runs/39059472250),
attempt 1, tests exact commit `2139f7c3a6fd7d309f4cffce401209bc55eb67aa`.
Public read-only GitHub run/job metadata independently confirms:

- Windows job 117474288626: locked install succeeds, verification fails.
- macOS job 117474288439: locked install succeeds, verification fails.
- Ubuntu job 117474288650: locked install and applicable full verification succeed.
  Its raw logs/counts/diagnostics have not been retrieved; no warning-free claim.

Owner-pasted Windows log SHA-256:
`48c5defd74adcfa7f32e93ffd58b4f9481103d436fff9e20106d80c9e939b7d0`.
It reports 808 passing /40 failing units in 82 passing /2 failing files (93.91 s).
All 40 failures reject unchanged XLSX sources as changed.

Owner-pasted macOS log SHA-256:
`cc6f3fe001032db345d678764689ad4727dcff2ec92bda819acfaa44cf49139d`.
It passes 848 units, types/lint/build, then 67 host cases pass /1 fails (11 min).
The populated CSV cross-file growth check fails: combined host/helper peaks are
281,886,720 /357,597,184 bytes, growth 75,710,464 >50,000,000. Helper peaks grow
156,893,184 ->237,568,000; host peaks stay 134,938,624 /134,922,240. Actual paging
growth 23,937,024 /36,028,416, host gaps 42.624 /34.778625 ms, complete SQL/pages
and source hashes pass. This is a genuine full-window growth failure. No baseline
subtraction, discarded sample, fixture change, GC forcing or relaxed limit is used.

## Windows source identity: reproduced and repaired

A disposable mixed-case `MiXeD/Book.xlsx` reached through a lower-case Windows
alias reproduces the resolver mismatch. Legacy `realpathSync` retains alias
component casing while `fs.promises.realpath` returns native canonical spelling.
`realpathSync.native` returns the same native spelling as the async resolver.
This matches the [Node filesystem API](https://nodejs.org/download/release/latest-jod/docs/api/fs.html).
Short-name aliases in CI are a possibility, not an observed cause.

The new real-file FR-006 regression first fails with the exact source-change
error (`out/t024-ci-canonical-red.log`). Switch only the synchronous snapshot
resolver to `realpathSync.native`; do not lowercase canonical components or relax
device/inode/size/nanosecond timestamp checks. The regression additionally alters
each metadata field individually and requires rejection, exact int64 cells and
unchanged source bytes/snapshot. Non-Windows runs exercise the same native path.
Focused canonical/import/part suite: 42 pass /3 files, 54.54 s, exit 0
(`out/t024-ci-canonical-repaired.log`). The old drive-letter regression remains.

## CSV transient allocation repair

The macOS failing full-window workload is the retained failing regression.
Inspection of pinned Papa 5.7.0 shows each `Papa.parse` call constructs a cyclic
string-streamer/handle/parser graph, even for one plain field. Its quote-free
core path ultimately splits on the delimiter. Our complete-record scanner already
rejects NUL, invalid quote placement, malformed CR endings and invalid UTF-8.
After that scanner, use a direct split only when the completed record contains
no quote. Quoted records still use Papa. The decoder alone removes the file-start
BOM; later BOMs, spaces, empty fields and literal NULL remain data.

Before editing this branch, add eight focused fidelity/refusal cases: all four
delimiters, thousands of alternating plain/quoted records crossing 64-KiB reads,
embedded CRLF, quotes, Unicode/data BOMs, empty/trailing fields, no final newline,
and malformed data after complete records. These pass before and after the
optimization; they protect equivalence rather than pretend to reproduce macOS.
Both-engine/import/BOM/boundary suite: 48 pass /3 files, 40.90 s, exit 0
(`out/t024-ci-csv-repaired.log`), including the unchanged complete 16-MiB record,
oversized-page refusal and query-recovery check. No source/record size cap added.

A disposable Windows parser-only allocation diagnostic compares original and
repaired bundles with identical inputs/runtime/nursery, no forced GC: 40 scans
of a populated 128-MiB file, 1,310,720 exact 4,095-character records (5 GiB read).
All records are checked, no output retained. This isolates parser allocations;
it excludes SQLite, VS Code, independent OS sampling and actual 1/5-GB files.
It is not the full gate or macOS proof. Logs: `out/t024-parser-before.log` and
`out/t024-parser-after.log`; disposable harness: `out/t024-parser-diagnostic.ts`.
Both use Node 26.5.0 with `--max-semi-space-size=4` in a direct process; this
does not change or duplicate the production helper's existing 8-MiB worker setting.
Original/repaired sampled RSS peaks: 135,258,112 /71,663,616 bytes; sampled JS
heap peaks: 77,245,760 /7,105,528 bytes; elapsed 106,804.892 /101,984.766 ms.
No 50-MB/macOS claim follows from this narrower diagnostic. File generation is
identical in both invocations and precedes sampling; these are sampled runtime
statistics, not an independent OS observer or unsampled high-water mark.

Independent Bugbot review finds no concrete bug in these five production/test
files. It confirms the strict scanner/plain split, quoted path, BOM handling and
identity guards; it explicitly leaves macOS memory resolution to fresh evidence.

## Current validation and handoff

The repaired canonical full invocation passes its entire standalone portion:
857 units /86 files (376.52 s), strict types/lint, production build and 34-file
/979.26-KB VSIX, zero errors and warnings. Integration compilation and all 68
real-host cases pass (32 min), including all three current XLSX cases and the
unchanged large-file workloads. The complete `npm run verify:full` exits 0 with
`All verification checks passed.` (`out/t024-ci-repair-full.log`).

Its only approved diagnostic is `VSCODE-HOST-001`, original severity `warning`,
source `20261018T040318/window1/renderer.log:10`, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
Profile: `out/integration-profile-7aAgIy`. The full run is not warning-free.

Windows populated CSV evidence (1 GB /5 GB):

- Source bytes 1,000,013,832 /5,000,003,592; complete rows 244,144 /1,220,704.
- Sampled combined host/helper peaks 312,283,136 /308,166,656; signed cross-file
  growth -4,116,480 bytes, within the unchanged 50,000,000-byte allowance.
- Host peaks 172,773,376 /167,698,432; helper peaks 141,033,472 /141,025,280.
  Renderer separate: 505,131,008 /527,110,144; no renderer-budget claim.
- Actual paging growth 17,317,888 /32,956,416 bytes; maximum host timer gaps
  39.8703 /48.0517 ms; OS observation gaps 849.9478 /842.0194 ms.
- First populated DOM 238.2735 /579.1251 ms; full 60 Browse /20 SQL pages per
  size, exact complete-data SQL and source hashes pass. No samples discarded.

The full SQLite 1.285/5.874-GB comparison also passes at 279,904,256 /290,594,816
combined peaks, 10,690,560-byte growth and unchanged hashes; all ten-million-row
JSON/JSONL and populated 1/5-GB JSON/JSONL checks pass. These are sampled Windows
VS Code 1.140.0 /Node 24.21.0 x64 observations, not macOS/Ubuntu proof, physical
paint or unsampled-peak guarantees. The earlier unknown local timer/timeout causes
remain unknown; this causal production change permits this new candidate gate,
not an unchanged retry exception or an explanation of every historical failure.
Packaging uses the owner's local README; its unrelated edits remain excluded.
Earlier local/remote failures remain failed;
no unchanged retry-to-green is used. There are no UI changes; previous scoped
visual observations and native capture limits remain as recorded in t024-xlsx.md.
Local implementation/regression/review/full-gate coverage now passes. Fresh
owner-pushed actual-candidate three-platform CI is still required, especially
macOS CSV memory growth. Keep T-024 unchecked; no milestone closure/release/tag.

Changed files for this repair: `src/loaders/xlsx-book.ts`,
`src/loaders/xlsx-consent.ts`, `src/loaders/csv-records.ts`,
`test/unit/xlsx-canonical.test.ts`, `test/unit/csv-records.test.ts`,
`docs/t024-ci-repair.md`, `docs/t024-xlsx.md`, `PROGRESS.md`, and scoped T-024
updates in `specs/PLAN.md`, `specs/TASKS.md`, `specs/VALIDATION.md`.
Preserve owner README/T-015 edits and unrelated untracked files.

Commands: `npm test -- test/unit/xlsx-canonical.test.ts test/unit/xlsx-import.test.ts
test/unit/xlsx-parts.test.ts`, `npm test -- test/unit/csv-records.test.ts
test/unit/csv-import.test.ts test/unit/csv-import-bom.test.ts`,
`npm run verify`, `npm run verify:full`.
