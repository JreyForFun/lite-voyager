# T-026: CSV observer process-lifetime repair

The owner authorizes necessary repairs and complete local validation, retaining
push/CI. This repair affects verification only; autocomplete and extension runtime
behavior do not change. Earlier failed gates remain failed and retained.

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

New canonical standalone/full results are pending. Keep T-026 unchecked for full
acceptance and owner-supplied
actual-candidate Windows/macOS/Ubuntu CI. Scoped visual QA remains recorded in
[t026-native-qa.md](t026-native-qa.md); this repair changes no UI.

```
npm test -- test/unit/csv-memory-windows.test.ts test/unit/csv-import-memory.test.ts test/unit/csv-memory-metadata.test.ts
npm run verify
npm run verify:full
```
