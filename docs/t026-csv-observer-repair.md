# T-026: CSV observer process-lifetime repair

The owner authorizes necessary repairs and complete local validation, retaining
push/CI. This repair affects verification only; autocomplete and extension runtime
behavior do not change. Earlier failed gates remain failed and retained.
Latest local acceptance is PASS on e64859c (967 units/76 hosts); actual-candidate
three-platform CI remains pending. The full has one exact approved renderer warning.

## Retained repaired-candidate gate

Candidate `c55ec7f` passes literal `npm run verify`: 956 units/96 files, strict
types/lint, production build and a 34-file/996.36-KB VSIX, zero errors/warnings.
UTC 2026-10-21 15:15:59.428 through 15:26:09.331 (609.903 seconds); all 277 captured
hashes match. Evidence: out/t026-final-verify-1.log and -status.json.

Its authorized literal `npm run verify:full` FAILS: 956 units/75 hosts pass, one
CSV memory case fails with `CSV memory observer failed: Missing or invalid process
metadata.` UTC 2026-10-21 15:27:12.963 through 16:08:19.198 (2466.235 seconds), exit
code 1, signal null; all 277 captured hashes match. All four FR-012 hosts, both
ten-million-row JSON/JSONL cases and every populated 1/5-GB JSON/JSONL import/data/
source-hash/memory case pass. JSON/JSONL host-plus-helper sampled peaks are
296730624 /299716608 /296210432 /294805504 bytes; host timer maxima are
45.0062 /47.0986 /49.8228 /43.0214 ms. Renderer residency is measured separately.
This run has no completed 1/5-GB CSV size comparison.

Evidence: out/t026-final-full-1.log and -status.json. Checked Windows System/
Kernel-Power queries find no 506/507 standby events during either run; query
failures other than no matching events are not accepted. Results are retained
in out/t026-final-verify-1-power-events-checked.json and
out/t026-final-full-1-power-events-checked.json.

The separate unchanged strict runtime scan rejects
`20261021T233850/window1/renderer.log:826`, severity error, `1 test failed.`
Its sole approved record is `VSCODE-HOST-001`, severity warning, same file line 10:
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
Evidence: out/t026-final-full-1-diagnostics.log. This full is not warning-free.

## Reproduction and repair

The old Windows collector samples native PID/start-time/RSS, then asks a separate
persistent CIM reader for missing immutable metadata. A process can exit between
these queries. A controlled diagnostic using owned short-lived Electron Node
processes reproduces exactly the missing-metadata error: counter PID 12644,
start stamp `639281959330508290`, subsequent metadata response `[]`. One snapshot
passes before failure. Evidence: out/t026-csv-metadata-probe-2-result.json and the
retained diagnostic console record. The first probe stops earlier because its
synthetic host has no renderer; it is retained and is not a memory acceptance pass.
This establishes the race; the historical failed gate did not retain its PID or
raw metadata, so its particular missing identity cannot be reconstructed.

One persistent native collector now opens the original process handle, obtains
metadata by PID/start-time identity, then refreshes/reads RSS. Processes that exit
before a counter is read produce no counter row. Every successfully read counter
keeps its matching metadata, including when the process exits immediately after
the read. Metadata is cached only by identity, never RSS. All original JS cache
validation remains: missing/invalid/duplicate/reused metadata still fails.

Only confirmed native lifetime errors at handle/start-time or counter access can
be recognized as exit; CIM, malformed metadata and access-denied diagnostics
propagate even during concurrent exit. Null RSS fails explicitly before casting.
Handles are disposed in finally. No warmup samples are discarded and no watchdog,
gap, memory, coverage, fixture, hashing or 80-page workload is relaxed.
The design follows Microsoft's [Process.HasExited contract](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.hasexited)
for retaining the original process identity through an open handle.

## Red-first and focused evidence

- New acceptance/order/exit/PID-reuse tests initially fail on the missing module.
- The first harness run rejects PowerShell progress on stderr. Match the existing
  native collector's noninteractive progress setting; retain empty-stderr checks.
- A null-returning property-getter failure exposes null-to-zero coercion; reject
  null counters explicitly. No diagnostic filtering is introduced.
- Independent review finds broad catch could hide invalid metadata/CIM errors
  during concurrent exit. Three regressions fail before narrowed exit handling.
- Eleven new Windows lifecycle cases plus seven unchanged cache/metadata cases
  PASS (18 total/3 files); access-denied concurrent exit still fails. These Windows
  API tests are platform-specific; other-platform OS sampling is unchanged.
- Read-only independent follow-up finds no remaining concrete defect.
- The same owned churn recipe passes with the repaired collector: 23 snapshots,
  22 observed identities, maximum gap 868.3015 ms, original 3000-ms watchdog.
  Evidence: out/t026-csv-metadata-probe-3-result.json. It is not a host-memory pass.

Unchanged CSV calibration and complete 1/5-GB acceptance PASS: two existing host
cases, all 60 Browse/20 SQL pages per size, full imported data and source hashes.
UTC 2026-10-21 16:23:51.707 through 16:30:51.545 (419.838 seconds). Sampled
host-plus-helper peaks are 313446400 /309764096 bytes, paging growth
31911936 /22913024 bytes, maximum observation gaps 1139.8795 /1200.4111 ms and
host timer maxima 42.7178 /49.5605 ms. Renderer residency is separate. Evidence:
out/t026-csv-repair-focused.log, -status.json and -result.json. Strict runtime scan
accepts only VSCODE-HOST-001 at `20261022T002359/window1/renderer.log:9`, severity
warning, exact message:
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
This scoped host run is not warning-free and does not clear the failed full.

Candidate `9d85f46` standalone FAILS before build/hosts: 966 units pass and the
first new Windows fixture case exceeds Vitest's unchanged 5000-ms default while
starting cold PowerShell. UTC 2026-10-21 16:32:46.843 through 16:41:48.294
(541.451 seconds), exit 1, signal null, all 280 frozen hashes unchanged. Evidence:
out/t026-csv-repair-verify-1.log and -status.json. No full attempt follows it.

Retain every scenario/assertion and share one cold PowerShell initialization in
beforeAll; recreate fake processes/cache/events for each case. The original
10000-ms native-command deadline bounds all eleven scenarios; per-test defaults
remain unchanged. A name-shadowing error and then Windows ENAMETOOLONG expose
fixture-refactor mistakes before passing: rename the loop variable and use one
owned temporary ps1 instead of an oversized encoded command line. Process-only
PowerShell flags match the existing native awake helper; no machine policy is
changed. Remove only that file and its now-empty directory, without recursive
deletion. Focused checks PASS all eighteen cases/three files, with fixture setup
4982.9124 ms. Independent read-only review confirms unchanged assertions/state
isolation/cleanup and finds no concrete defect. Production sampling is unchanged.

## Final local gates (2026-10-22 Asia/Manila)

Reviewed candidate `e64859c749d1fd5cca50f5c1b19eef56337b3ea6`:

- Literal `npm run verify` PASS: 967 units/97 files, all strict types/lint, builds
  and 34-file/996.36-KB VSIX, zero errors/warnings. Local 00:46:44.099 through
  00:56:38.552 (UTC 2026-10-21 16:46:44.099 through 16:56:38.552), 594.453 seconds.
  All 280 captured hashes match; Windows fixture 5548.0793 ms for all eleven cases
  under the original native-command deadline. Evidence:
  out/t026-csv-repair-verify-2.log and -status.json.
- Literal `npm run verify:full` PASS: 967 units/97 files and all 76 host cases,
  including every FR-012/both-engine/all-format case and all original multi-GB
  SQLite, ten-million-row JSON/JSONL, populated JSON/JSONL and CSV workloads.
  Local 00:57:00.122 through 01:41:18.770 (UTC 2026-10-21 16:57:00.122 through
  17:41:18.770), 2658.648 seconds; exit 0/signal null. All 280 hashes match.
  Evidence: out/t026-csv-repair-full-1.log and -status.json.
- The full's only approved runtime diagnostic is VSCODE-HOST-001, source
  `20261022T010708/window1/renderer.log:10`, severity warning, exact message:
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
  No other warning/error is accepted. This full is not warning-free.
- Final populated CSV 1/5-GB sampled host-plus-helper peaks are
  318492672 /313462784 bytes; paging growth 22425600 /31137792 bytes; maximum
  observation gaps 965.9866 /905.8858 ms; host timer gaps 40.2347 /38.1083 ms.
  All 60 Browse/20 SQL pages per size, imported data and full source hashes pass.
- SQLite 1.285/5.874-GB sampled peaks are 284688384 /289665024 bytes. JSON 1/5-GB
  peaks are 295784448 /295895040; JSONL peaks 297705472 /300396544 bytes. Their
  complete-data/source-hash checks pass. Renderer residency remains separate;
  these are sampled observations, not unsampled peak or physical-paint claims.

Power queries are retained, not summarized as no events: standalone has two
506/507 records (completed record 132469: SleepEntered=false, SleepDurationInUs=0,
DripsResidencyInUs=0). Full has five records; completed 132473 has SleepEntered=false,
sleep/DRIPS zero; 132478 near the end has SleepEntered=true, SleepDurationInUs=1097601,
DripsResidencyInUs=0. Its screen-off duration is 1270435661 microseconds. No phase
or release cause is inferred from these fields. Native acquire/release checks and
every original workload/deadline pass; no sleep time is subtracted. Compare original
failed JSON record 132021 (SleepDurationInUs=278406364, DripsResidencyInUs=265758405)
and CSV record 132006 (100136047 /88144913 respectively). An event 506/507 interval
alone does not prove the CPU was asleep for its entire duration. Raw checked power
queries and extracted fields: out/t026-csv-repair-verify-2-power-events-checked.json,
out/t026-csv-repair-full-1-power-events-checked.json, out/t026-final-evidence-summary.json.

No executable edits or further unchanged full run follow these passes. Scoped
light/dark actual-host renderer QA remains in [t026-native-qa.md](t026-native-qa.md).
Owner pushes and supplies the final SHA/Actions URL and successful locked-install/
applicable full-verification results on Windows/macOS/Ubuntu. Keep T-026 unchecked
until that evidence passes; no milestone/release/tag closure.

```
npm test -- test/unit/csv-memory-windows.test.ts test/unit/csv-import-memory.test.ts test/unit/csv-memory-metadata.test.ts
npm run verify
npm run verify:full
```
