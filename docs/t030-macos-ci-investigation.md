# T-030: macOS CI investigation

## Run41959956546: Windows/macOS pass; Ubuntu console gate fails (2026-11-05)

### Supplied complete Ubuntu step: rejection identified

Owner supplies the complete step after the initial summary. Ubuntu passes1301
units with17 pre-existing platform skips/124 passed files and one skipped file,
all types/lint/build/package/host compilation, then79 host tests (6m) and host
exit0. Nine native console errors follow the second all-formats opening case
and precede the split-view case's completion. They share PID8245 and exact text:

`ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:395] SharedImageManager::ProduceMemory: Trying to Produce a Memory representation from a non-existent mailbox.`

Native timestamps1105/031859.112463,.112495,.112500,.112505,.112510,.112514,
.112518,.112523,.112527 are retained from the pasted step; no claim is made
that this compact excerpt is a downloaded raw archive. The earlier passive OS
snapshot identifies8245 as the GPU process with --use-gl=disabled and its parent
as the VS Code launch explicitly carrying --disable-gpu. The strict console
gate correctly rejects these errors. The saved-log scan separately reports one
approved warning: source20261105T031348/window1/renderer.log:15, original severity
warning, VSCODE-HOST-001, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
The failed full is not warning-free. No signed-in session/scopes repair is needed.

Independent review finds no demonstrated successful-path lifecycle defect:
the split test awaits cancellation/import settlement, exact first-tab closure
and session cleanup, independent second import/render, then closure and source
equality. Those guarantees do not prove compositor quiescence or identify the
view/action responsible for the native mailbox lookup. Chromium's linked source
below explains the missing-backing branch, not this run's originating cause.
All four JSON/JSONL and both CSV size checks complete; their successful timing/
source/memory results do not make the console errors acceptable.

Controlled candidate acceptance, written before tests/code: omit only Linux's
helper-supplied --disable-gpu argument so VS Code may choose its ordinary renderer.
Freeze exact Windows/macOS arrays and retain all other platforms' current
behavior with an explicit darwin-or-linux predicate. Retain Xvfb/D-Bus, exact
versions, isolated directories/auth fixture, all workloads/order/deadlines,
source checks and every warning/error rejection. No new switches, sleeps,
forced redraws, dependency or diagnostic allowance. Test Linux's desired array
before implementation; it must fail against the current helper. Add regressions
that the exact ProduceMemory console error on either stream still fails with
approved HOST-001 metadata reported. This is a single-variable environment
experiment, not a demonstrated causal repair or acceptance of historical errors.
Next native CI must inspect actual process arguments/backend evidence and retain
any failure. Windows/macOS remain byte-identical at the argument boundary.

Scoped files: scripts/integration-launch.mts;
test/unit/integration-config.test.ts; test/unit/integration-validation.test.ts;
this report; PROGRESS.md. No product or workflow changes. Red-first execution
fails exactly the Linux argument case (21 pass/one fail), retained in
out/t030-ubuntu-renderer-red.log. After the one-argument change,143 focused tests/
six files pass in61.65s; scoped tooling types/lint pass with empty logs. An
independent actual-diff review finds no concrete defect. Evidence: matching
-focused/-types/-lint.log files. Local WSL inspection
finds Xvfb/D-Bus but no native Node on the inspected PATH; it does not establish
a ready Linux runtime. No tools are installed and no large native retry is made.
Actual Linux execution remains owner CI evidence. Owner retains push/dispatch.

Reviewed candidate passes canonical npm run verify:1321 units/125 files,
strict types/lint, production build and VSIX packaging, zero errors/warnings,
668.646s. All391 tracked file hashes remain unchanged throughout the gate.
Evidence: out/t030-ubuntu-renderer-verify-1.log and -status/-before/-after.json.
Only this report/PROGRESS change afterward. A pure argument comparison against
committedbf22428 confirms exact original darwin/win32/freebsd arrays and only
the single Linux removal; retained in out/t030-ubuntu-renderer-arguments.json.
The installed @vscode/test-electron runner does not add --disable-gpu back.
The existing CI workflow, all application/host tests, bounds and diagnostic
scanners remain unchanged. Prior UI QA is retained for unchanged application
code; no new native Linux renderer/physical-paint or local full-host pass is
claimed. No causal graphics repair is established by these local checks.

Owner next: push the scoped local commit and allow one fresh actual-candidate
three-platform full run. Return the run URL; if anything fails, retain/paste the
complete affected step rather than only its tail. Do not rerun this unchanged
failed run to seek green. Reproduction: npm run verify; focused
npm test -- test/unit/integration-config.test.ts test/unit/integration-validation.test.ts
test/unit/integration-logs.test.ts test/unit/checks.test.ts test/unit/ci-workflow.test.ts
test/unit/integration-environment.test.ts (one command). Hosted Linux retains
dbus-run-session -- xvfb-run -a npm run verify:full. Owner retains push/dispatch;
T-030 remains unchecked pending actual-candidate platform acceptance.

Primary references: [VS Code CLI](https://code.visualstudio.com/docs/configure/command-line)
documents --disable-gpu as disabling hardware acceleration;
[Chromium missing-backing source](https://chromium.googlesource.com/chromium/src/gpu/+/f2ce5726738369eaf8f7dadb75667225a2353a41/command_buffer/service/shared_image/shared_image_manager.cc)
is explanatory source, not the claimed exact bundled Chromium revision.

### Initial access and summary review (superseded by the supplied step above)

Public GitHub REST confirms attempt1/exactbf224283831b42502840ad70ea43217e2bbba46e:
Windows job127023712349 and macOS job127023712216 succeed; Ubuntu job127023712060
fails. No artifacts are retained for this run. Metadata is preserved in
out/t030-ubuntu-41959956546-metadata.json. Existing executable CI/application/
integration bytes are unchanged by bf22428; that commit adds only the separate
manual capability workflow/collector/unit coverage and investigation records.
The new macOS pass does not establish a causal repair of its historical pauses.

Owner quotes79 passing/extension-host exit0 followed by an approved HOST-001
record, then "VS Code integration tests emitted an error; verification requires
zero errors." These establish a reported console-gate failure after passing
assertions, not a missing-authentication root cause. The signed-out record is
already owner-approved, renderer/source/severity-restricted and explicitly
reported. The quoted failure originates in runCheck's raw child-console scan;
validateIntegrationRun still scans/reports saved logs after that failure and
then rethrows it. An approved warning printed near that rethrow is not itself
evidence that it triggered rejection. The exact rejected console text remains
unknown without the complete Ubuntu step log.

Existing checks/integration-validation/integration-logs suites pass122 tests/
three files in41.70s. A separate synthetic child emitting the exact formatted
HOST-001 report passes the unchanged console scanner; this is local fixture
evidence, not an Ubuntu reproduction or proof of its cause. Evidence is retained
in out/t030-ubuntu-41959956546-gates-focused.log and -approved-probe.json.
Public job-log access returns403 (repository admin rights required); existing
GitHub authentication is unavailable noninteractively. No credential changes,
workflow changes, diagnostic relaxation, test changes or CI retry are made.
The owner is asked for the complete Ubuntu "Verify with session bus and virtual
display on Linux" output, including lines before79 passing. Preserve the seven
approved families and every other warning/error failure. T-030 remains unchecked.

## Run41629924409: current diagnostic candidate still fails (reviewed 2026-11-05)

Owner now supplies the ZIP; its45148 bytes/digest match GitHub exactly. Safe
extraction produces19 files under out/t030-macos-41629924409-artifact, with
per-entry hashes and structured evidence in -inspection.json. The console has
78 passing/one failing host: JSON1GB raw111.89050000003772ms during importing/
reading, from277523.070417 to277634.960917ms, at1685.058292ms from timer start.
Process CPU is224us user/87us system, involuntary switches7. Both new capability
endpoints explicitly report loop-start-unset, loopStart=-1 and ELU0/0. ELU cannot
classify this pause. No retained callback/GC/operation overlaps it, but47 dropped
operations/108 untracked resources limit that negative evidence. No product
blockage, native wait or OS scheduling cause is established by this trace.

The import reaches opened with matching engine/row/byte assertions, but the
timer failure precedes all JSON1GB full-data/memory/post-hash assertions and
the remaining JSON5GB/JSONL sizes. No completed JSON memory record is present.
Both CSV1/5GB data/hash/memory/60Browse+20SQL checks pass: raw host intervals
65.651584/62.529916ms, sampled combined peaks253181952/240369664 bytes. No GPU
error appears in the console. Saved severities are only the three failed-test
errors at20261103T114742/window1/exthost/exthost.log:10 and renderer.log:1046/1047.
No approved warning is present. The full remains FAILED. Earlier unavailable
evidence notes below are historical, superseded by this supplied archive.

### Next native evidence: manual runner capability check

Owner confirms GitHub Actions is the only available Mac. Independent causal
review finds no demonstrated product defect. A CPU-only profile/post-gap stack
cannot distinguish overdue native wakeups from runnable-but-unscheduled threads.
The next useful capture needs the actual utility host's main and embed/poll
threads, wakeups/ready-to-run latency and syscall/wait stacks aligned to raw
timer endpoints. Normal poll waits are expected and are not defects by themselves.
[Apple hang analysis](https://developer.apple.com/tutorials/instruments/getting-started-with-hang-analysis)
describes native thread-state tracing; Apple's
[Xcode CLI reference](https://developer.apple.com/documentation/xcode/xcode-command-line-tool-reference)
directs readers to the installed man xctrace reference. Do not invent recorder
options, assume permissions, change renderer flags or call a new probe a repair.

Under existing delegated judgment, prepare a separate workflow_dispatch-only
macOS capability job. Acceptance: collect OS/architecture, selected Xcode version,
xctrace path, installed xctrace manual and template listing; preserve bounded
stdout/stderr bytes, exit/signal/killed/limit status for every attempted command.
Read template-list syntax from the captured manual before executing that listing;
if unavailable, record explicit failure instead of guessing. A nonzero exit,
signal, launch/capture failure, output bound, empty stdout or stderr makes the
collection fail while retaining evidence. Never reinterpret these outcomes as
passing verification. No native recording, process attachment, elevated access,
security/configuration change, workload rerun or new npm dependency occurs.
Non-macOS invocation refuses before commands/output writes. Use only built-in
Node modules and already-used CI actions; unique owned output prevents overwrite.
Keep existing ci.yml bytes, every existing application/test source, matrix and gate intact.
The owner pushes/dispatches this new workflow and returns its artifact. Pushing
still triggers the repository's existing CI as configured; its result cannot
establish a causal fix for these retained timing failures. This job only prepares
a verified native recorder protocol; it does not prove tracing permissions.

Scoped files: .github/workflows/macos-native-capabilities.yml;
scripts/macos-native-capabilities.mts; test/unit/macos-native-capabilities.test.ts;
this report; PROGRESS.md. Tests precede code. A separate review identified lost
maxBuffer termination fields and SIGTERM's ignorable timeout. A real output-limit
regression failed before the fix (18 pass/one fail); capture now uses SIGKILL for
its owned child and records actual close status separately from capture errors.
The deadline fixture installs a SIGTERM handler; the output-limit fixture checks
that actual termination is retained. Focused regression:19 tests/one file PASS.
The first lint attempt found three require-await errors, corrected without
disables. Final scoped type/lint pass; independent follow-up finds both issues
addressed and no remaining actionable collector defect. Canonical npm run verify
passes1318 units/125 files, production build and VSIX packaging, zero errors and
warnings,809.410s. All391 source hashes remain unchanged throughout the gate.
Evidence: out/t030-native-capabilities-verify-1.log and -status/-before/-after.json;
focused/type/lint-final logs retain scoped checks. These local fixtures do not
exercise Apple's native tools. Baseline audit preserves all existing CI/app/
integration bytes, four owner-dirty tracked files and both supplied ZIP digests.
Prior visual QA remains applicable to the unchanged UI; no new Mac visual or
host-test pass is claimed. T-030 remains unchecked and the Mac failure unresolved.

Owner next steps: push this local commit, open Actions > macOS native trace
capabilities > Run workflow on the pushed branch, then download and attach
macos-native-capabilities-<run_id>-<run_attempt>.zip, including when the collector
job fails. Existing CI will also run on push as configured. Do not treat a fresh
passing timing sample as proof of a causal repair. We will inspect the installed
manual/templates before preparing the native thread-state capture; no recorder
command or permission is assumed here. Local reproduction commands are
npm run verify and node node_modules/vitest/vitest.mjs run
test/unit/macos-native-capabilities.test.ts; the native collector itself is
macOS-only. npm run verify:full remains the unchanged full gate, not newly run
for this isolated capability-workflow addition.

### Historical pre-upload access notes (superseded above)

Public REST confirms attempt1 at exact33149f07ff3a13e0e5e10ff231e77ffe52be587d.
Windows125896588628 and Ubuntu125896588339 succeed; macOS125896588789 fails.
Remote raw logs are not retrieved; no counts or warning-free claim for this run.
The owner reports exactly one integration failure in json-import-memory.test.js,
Context.<anonymous>, line224. The retained local compilation of this same source
maps that line to assert.ok(hostGap <= 100), the unchanged responsiveness guard.
An integration failure is established; exit1 alone cannot identify product
blocking, native waiting or OS scheduling as the cause. The exact new duration,
format/size and raw macOS capability snapshots remain unavailable. Do not copy
the previous run's114.567291ms or5-GB JSON identity into this run as fact.

The run retains artifact13228317857, macos-verification-diagnostics-41629924409-1,
45148 bytes, public digest
c972d60b4a3940372447ce4ef73ecbfe27529fcffd9c6bb0da3e99fc19462a55,
created2026-11-03T11:55:57Z and expiring2026-11-10T11:55:55Z. Public metadata is
saved in out/t030-macos-41629924409-metadata.json. An existing-credential download
attempt cannot authenticate noninteractively; no secret/signed URL is printed
or saved, no credential configuration changes and no authentication UI opens.
Browser inventory reports its access host unavailable; no browser input follows.
The owner must supply this new ZIP; the41611740185 ZIP is different evidence.

No executable change, test relaxation, new verification run or unchanged CI retry
is made. Only this report/PROGRESS records change while awaiting the artifact.
Current executable retains the prior1299-unit/79-host local evidence below;
those passes do not clear this new failed macOS run. T-030 stays unchecked.

## Run41611740185: populated JSON timer failure and runtime capability (2026-11-03)

Public REST confirms attempt1 at exact05eb47c9d4455b5f9892f4c9eff17424b79a1ea8.
Windows125835060430 and Ubuntu125835060541 pass locked installs/applicable full
verification. Raw logs for those jobs are not retrieved; no warning-free claim.
macOS125835060014 passes1267 units/17 existing platform skips across123 passed
files/one skipped file, build/package, then78 host tests pass and one fails:
5-GB JSON import records114.56729099998483ms against the original100ms guard.
All T-030 staged-edit hosts pass. No GPU error occurs in the supplied transcript.
The earlier GPU failures remain unexplained; absence here does not repair them.

The failure interval is190056.27175–190170.839041ms, at6134.179958ms from timer
start, with both endpoints importing/reading. Process CPU deltas are107us user
and58us system; voluntary/involuntary switch deltas0/5. Retained overlapping
callbacks/GC/operations are empty, but393 dropped operations and405 untracked
resources make that evidence incomplete. No product blockage, native wait or
OS scheduling cause is established. The completed import/row/byte assertions
precede the timer failure. Subsequent5-GB full-data/memory/post-source-hash checks
and both JSONL sizes are not reached. JSON1GB completes all its checks with
17.641541ms maximum, sampled combined peak272695296 bytes and matching source.
Both CSV1/5GB full-data/hash/memory/60Browse+20SQL checks pass. Their host timer
maxima are19.37675/26.356542ms. No assertion, workload or deadline is relaxed.

The failure-only upload succeeds. Owner-supplied archive has19 entries,45004
bytes, SHA2568ec9c1c58554a1a4f2ba22eecd09fe4ffcef1397bc97480f0b21737da5fe3d66,
matching GitHub artifact13220290706, macos-verification-diagnostics-41611740185-1.
Its console transcript is122357 bytes plus18 runtime logs. Safe extraction and
per-entry hashes are under out/t030-macos-41611740185-artifact and -inspection.json.
All saved severities are three errors caused by the failed test: exthost.log:10
and renderer.log:1049/1050 under20261103T093434/window1. No saved severity warning
or approved warning family is present. This full remains FAILED, not clean.
The pasted verify log is148660 bytes, SHA256
491736b326eb7793734d1e830a873c8c52b94003f9851382dc92361b7bb2b635,
retained as out/t030-macos-41611740185.log; REST metadata and388-file baseline
are matching -metadata.json/-before.json. Preserve the owner ZIP untracked.

Independent read-only causal review finds no demonstrated product defect.
It identifies a diagnostic limitation: zero ELU deltas lack cumulative endpoints
and initialization state. [Node24.21 source](https://raw.githubusercontent.com/nodejs/node/v24.21.0/lib/internal/perf/event_loop_utilization.js)
returns zero counters when the loop-start milestone is unset. A separate local
one-turn calibration on actual Windows VS Code1.140.0 utility host, embedded
Node24.21.0/Electron43.7.3, records loopStart=-1 and all-zero ELU at both ends.
The ordinary80ms timer takes135.7963ms wall time; it has no responsiveness PASS
claim or import workload. Matched executable in ELECTRON_RUN_AS_NODE mode starts
with loopStart=-1, then reports55.1496ms loopStart,85.0012ms idle/0.7836ms active.
This demonstrates a Windows embedding limitation, not the failed macOS state.
Evidence: out/t030-macos-elu-calibration-host.log/-status.json and -node.log.
The host calibration is NOT warning-free: approved VSCODE-HOST-001, severity
warning,20261103T182334/window1/renderer.log:10, exact signed-out GitHub message.

The scoped diagnostic change adds only macOS raw ELU/loop-start endpoints around
the retained largest interval. Status distinguishes an unset milestone from
reported values and invalid data. Valid zeros stay reported, never proof of
idleness; invalid values become explicit nulls with fixed field names. Getter
failures propagate. Only the two endpoints of the retained largest interval are
reported, with no new timer, history, file IO, retry or profiler in the measured
path. Instrumentation can affect timing; it cannot establish historical cause.
Existing numeric fields,
timers, CPU/context deltas, bounds, GC handling and non-macOS sampling remain.
No product/UI/renderer/workflow/dependency change or proven timer repair.
Files: src/test/host-interval-diagnostics.ts; its unit test; PROGRESS.md; this report.
Red-first11fail/11pass is retained in out/t030-macos-elu-red-1.log; focused43/3
and initial tooling types/scoped lint pass. Independent implementation review is
clear. Final literal npm run verify passes1299 units/124 files, all types/lint/
build/package, zero warnings/errors,774.301s. All388 tracked-file hashes remain
unchanged throughout. Evidence: out/t030-macos-elu-verify-1.log and matching
-status/-before/-after.json.

One subsequent current-candidate Windows regression runs integration compilation
and canonical scripts/integration-check.mts with the existing CI diagnostic
wrapper/identity collector:79 hosts and strict runtime logs PASS,2123.607s,
all388 tracked-file hashes unchanged. This is staged validation following the
standalone gate, not a new literal verify:full invocation or macOS execution.
It is NOT warning-free: one VSCODE-HOST-001, severity warning,
20261103T184339/window1/renderer.log:10,
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
All four JSON/JSONL full-data/hash/memory checks pass: raw maxima58.7579/57.4645/
42.9446/44.435ms, combined sampled peaks298594304–302563328 bytes. Both CSV sizes
pass complete data/source hashes,60Browse+20SQL pages and memory; raw maxima
57.04/46.2642ms, peaks319930368/320106496, actual paging growth34832384/32837632.
Both ten-million-row SQLite sizes pass hashes/data/paging/memory. Renderers remain
reported separately; no physical paint or unsampled-peak claim. Evidence:
out/t030-macos-elu-host-1.log/-status/-before/-after.json and -host-evidence.json.
No unchanged failed-workload retry is run. Final audits allow only this report
and PROGRESS updates after the gates and preserve all owner files/archive bytes.
T-030 remains unchecked; actual macOS capability/cause and current-candidate
three-platform CI are still unknown. Owner retains push/CI.

## Run41602840009: recurrent macOS GPU errors (2026-11-03)

Public REST confirms attempt1/exact1d07b3e0b21c4ab3d4bf7ded8b4b7dcb4df175b1.
Windows job125805434556 and Ubuntu job125805434761 pass locked installs and
applicable full verification. Their raw logs are not retrieved; no warning-free
remote claim. macOS job125805434719 passes1251 units/17 existing platform skips,
123 passed files/one platform-skipped file, build/package and all79 host tests.
The host exits0, but strict console validation correctly rejects12 Chromium GPU
errors: six ProduceOverlay/non-existent-mailbox and six Invalid-mailbox records,
native timestamps1103/083317.395950 through.407448. No error allowance is added.

The passive snapshot identifies PID7765 as --type=gpu-process under isolated
Code PID7747, VS Code1.140.0/darwin-arm64 revisionb224f6bf5a4fcad5fa4c640ed10f179c3b613e48.
All194 D-5 lifecycle records are present. Final fallback cleanup completes
08:33:17.219Z, about177ms before the first GPU error; the next split-view case
reports success afterward. This cannot distinguish prior teardown from subsequent
creation/compositor activity. Independent read-only review finds no demonstrated
product defect or failed closure. Five temporary hide/show tabs are retained
until the existing bounded finally cleanup; this does not prove a leak or justify
changing fixture ordering to claim a GPU repair. Renderer toggles/sleeps/redraws,
upstream version changes and diagnostic exceptions are not adopted.

All four populated JSON/JSONL1/5GB data/source/memory checks pass, with original
raw timer maxima26.626292/31.829667/28.167208/33.976250ms. CSV1/5GB full data,
60 Browse+20 SQL pages, source hashes and memory checks also pass. Sole approved
severity-warning record:20261103T082559/window1/renderer.log:15, VSCODE-HOST-001,
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
This failed full is NOT warning-free. The saved-log scan runs despite console
rejection and reports that warning; there is no saved runtime error in its report.

Byte-identical attachment: out/t030-macos-41602840009.log,154227 bytes, SHA256
bb6448ed17d06ce4f68f656591c2b850051da64725eafa676bd96db04ea14e00.
Metadata and388-file pre-change baseline: matching -metadata.json/-before.json.
The artifacts endpoint reports total_count0. The failed runner's raw host logs
cannot now be recovered through that endpoint. Previous GPU/watchdog/timer and
watcher failures remain explicit below; this recurrence is not an unchanged retry.

### Failure evidence retention candidate

The supported correction is evidence retention, not an established GPU repair.
On macOS with existing LITE_VOYAGER_INTERVAL_DIAGNOSTICS exactly1, integration
verification selects integration-console.log inside its unique isolated profile.
runCheck writes its existing merged decoded stdout/stderr text only after a
rejection is determined, then rejects with the original failure. This is not
lossless separate byte streams. Success creates no transcript. Native warning,
error, exit and signal rules keep their original priority and regexes. Async and
synchronous launch failures retain empty text if nothing was emitted. wx prevents
overwriting earlier evidence; persistence failure rejects AggregateError with the
original failure first in both errors and message. The finishing guard prevents
a close event resolving success while persistence is pending. No writes or new
waits occur inside the host's measured workloads; default/non-macOS calls do not
request persistence.

The original three workflow run commands, two full invocations, matrix, budgets,
permissions, runtime, lockfile install and failure rules remain. A failed macOS
desktop verification with CI diagnostics exactly1 uploads only isolated profile
console transcripts and logs for seven days. This uses official
[actions/upload-artifact v7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2),
MIT, pinned to verified commitcf430e030ddbb5b0abf93d22962f4752f3646cd9. Its tagged
action.yml inputs/runtime and license are checked; no npm/runtime dependency is
added. No source data, whole profiles, extensions, hidden files or caches are in
the artifact paths. Missing files fail the upload; if verification fails before
integration creates evidence, this is an expected secondary failure and no host
logs can be claimed. Successful upload never clears the failed verification.

Red-first out/t030-macos-artifacts-red-1.log records11fail/41pass. The second red
records5fail/29pass; its incorrectly quoted title filter runs the whole checks
file rather than a selected title and is not an acceptance gate. Initial focused
61/4 passes; added signal/ANSI cases pass63/4. Review then identifies synchronous
launch validation bypassing persistence; its new NUL-argument test fails missing
transcript in -sync-red.log, then final focused64/4 passes. The first typecheck
rejects an explicit undefined optional path; the type now explicitly models its
disabled value and subsequent types/lint pass. No test/strict compiler rule is
weakened. Final independent implementation review finds no concrete defect.

Nine scoped project files: .github/workflows/ci.yml; scripts/checks.mts;
scripts/integration-check.mts; scripts/integration-validation.mts;
test/unit/checks.test.ts; test/unit/ci-workflow.test.ts;
test/unit/integration-validation.test.ts; PROGRESS.md; this report.
Product/UI/renderer arguments, test workloads/clocks, seven warning families and
owner README/shared-spec/TASKS edits remain unchanged. Final standalone verification
passes:1284 tests/124 files, all types/lint/build/package, zero warnings/errors,
727.854s. All388 tracked-file hashes remain identical throughout that run.
Evidence:out/t030-macos-artifacts-verify-1.log and matching -status/-before/-after.json.
Parsed YAML comparison preserves all five original steps except the desktop id;
the sixth step is the guarded upload. Final source audit checks the nine-file
scope and permits only this report/PROGRESS updates after verification.
Hosted upload and the macOS GPU cause remain unverified. T-030 stays
unchecked; owner retains push/CI and this chat stays on the same task.

## Run41477363734: Windows JSONL timer investigation (2026-11-03)

Public REST confirms attempt1/exact0da70fb064d6ba920055618159d28a60d15b4fd4.
macOS job125386353753 and Ubuntu job125386354401 pass locked install/full.
Their raw logs/warning counts are not retrieved; no warning-free remote claim.
Windows job125386354542 passes1212 units/120 files, types/lint/build/package,
then78 hosts pass and the populated JSON/JSONL memory host fails:

```text
AssertionError [ERR_ASSERTION]: JSON host timer gap 102.45370000001276ms
```

This is the JSONL1GB case, not the two earlier JSON cases (69.3425/53.0275ms,
both with complete data/source/memory checks). JSONL1GB import/row/byte assertions
complete before its unchanged100ms timer guard fails; its later SQL/source/memory
assertions and JSONL5GB are not reached. All original tests and guards remain.
Saved errors at20261102T160634/window1/exthost/exthost.log:10 and renderer.log:1053–1054
report that failed assertion; no independent runtime cause is inferred from them.
The exact approved record is severity warning, source
20261102T160634/window1/renderer.log:15, VSCODE-HOST-001:
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
This failed full is NOT warning-free. No macOS watcher probe runs on Windows.

Metadata: out/t030-ci-41477363734-metadata.json; no remote artifacts available.
Byte-identical supplied log: out/t030-ci-41477363734-windows.log, SHA256
9a35f4bb9d43e8c9cd6e585eb97271d2548139d390bbabeb587e1de1a74804f9.
The original largest interval334287.7364–334390.1901ms overlaps GC
334287.8878–334390.0292ms (102.1414ms) and an asynchronous helper-marker
registration span334287.5873–334390.5705ms. CPU deltas are0 user/16000 system
microseconds; scheduling deltas are0 and the trace reports truncated/untracked
resources. Empty callback arrays are not proof of no callback work.

Source ordering and independent read-only review show the helper's empty PID
marker is awaited before its import request is sent; this import's JSON parsing
has not begun during that interval. The marker write is asynchronous; its await
duration includes GC/scheduling time. Source hashing reuses one1MiB buffer,
fixture generation is external, preview workers terminate, and diagnostic/session
retention is bounded with explicit cleanup. No demonstrated allocation/retention
defect supports changing the parser, storage ordering or product saves. The GC
overlap does not identify its kind, flags, allocation trigger or historical cause.

The candidate fills only that Windows diagnostic gap. Existing opt-in GC spans
retain raw start/end/duration and additionally copy native detail.kind/flags,
monotonic delivery time and six selected heap counters at delivery. Heap at
delivery is not GC-start heap or allocation provenance. Unknown/private fields
are discarded. Unavailable metadata counts as untracked evidence while the raw
span survives. Existing128-entry bounds, dropped counts and stop/drain/cleanup
semantics remain. There is no additional observer, forced GC or adjusted clock.

macOS/Linux take the original plain-span branch: no GC-detail, heap or delivery-
clock reads. Disabled diagnostics initialize no observer. Canonical launch,
seven warning families, console scanner, workflow, all tests/workloads/deadlines,
product sources/dependencies and owner edits remain unchanged. Current Windows
CI remains failed; a local passing diagnostic cannot clear it or prove a repair.

Failing-first tests: missing module in out/t030-windows-gc-red-1.log; then the
old recorder drops metadata (1fail/15pass), out/t030-windows-gc-red-2.log.
Initial focused53/5 and tooling types/scoped lint pass. Independent review finds
no concrete defect and requests observer callback/queued-drain coverage; those
tests plus missing metadata/raw-span retention, stable repeated stop and direct
macOS/Linux/disabled no-observation checks pass in focused57/6.
Final focused57/6 after removing non-Windows per-event metadata calls/empty-spread
allocation is out/t030-windows-gc-focused-final.log. Final independent review
finds no blocking defect. Final candidate gate results and limits follow below.

The API fields are checked against installed Node24 types and the official
[Node24 GC-detail documentation](https://nodejs.org/docs/latest-v24.x/api/perf_hooks.html#garbage-collection-gc-details).
The nondeprecated detail fields avoid kind/flags getter deprecations. An embedded
Node24.21 standalone cost probe captures10000 valid records in21.6829ms,
average0.00216829ms, maximum observed1.1849ms; stderr is empty. This is a local
cost observation, not a future timing bound, responsiveness gate or GC-pause
reproduction. Evidence: out/t030-windows-gc-overhead-2.json. The first PowerShell
GUI-executable redirection produced an empty capture; no pass is claimed from it.

One separate Windows diagnostic runs the two unchanged populated JSON tests,
including ten-million-row and1/5GB workloads, with an additional bounded GC
observer and startup heap snapshots. It retains every original assertion and
raw100ms guard; it is not canonical verification or a retry-to-green. Evidence:
out/t030-windows-gc-probe-1.log and -status.json. Both tests pass on Windows1.140.0/
embedded Node24.21.0;18m host suite, UTC01:53:26.671Z–02:11:24.459Z on2026-11-03.
Four populated-case raw maxima: JSON1GB57.0476ms/5GB35.1063ms, JSONL1GB46.5626ms/
5GB40.6034ms. Source hashes/full-data/memory checks pass in all four cases;
combined sampled peaks255410176–259194880 bytes, renderer reported separately.
The28 extra GC/startup records have no drops; largest observed GC24.9033ms.
It does NOT reproduce the102.4537ms CI gap or identify its kind/allocation cause.
One approved severity-warning record:20261103T095331/window1/renderer.log:11,
VSCODE-HOST-001, exact signed-out CloudSandboxApi message quoted above.
It is not warning-free. Its paths/heap/GC events belong to that separate run,
not the failed CI; generated data are warm and memory is sampled, not a cold-
disk/physical-paint or unsampled-peak guarantee. Current task stays T-030; owner
retains push/CI, and historical timing/watcher/GPU failures remain explicit.

### Frozen candidate gates and CSV follow-up

Literal standalone `npm run verify` passes1232 units/122 files, strict types,
lint, production build and35-file1012.28-KB package, zero errors/warnings.
Evidence: out/t030-windows-gc-verify-1.log, -before.json, -after.json and
-status.json;730.452s, all385 captured tracked/task-new hashes unchanged.

One changed-candidate literal `npm run verify:full` with the workflow's diagnostic
flag FAILS after1232 units/122 files pass and77 hosts pass/2 fail;2824.321s,
all385 hashes unchanged. Evidence: out/t030-windows-gc-full-1.log and matching
before/after/status files; minimum VS Code1.140.0, embedded Node24.21.0.
All four populated JSON/JSONL cases complete full data/source-hash/memory checks:
JSON1GB/5GB raw maxima47.8217/91.7948ms, sampled peaks295931904/298942464 bytes;
JSONL1GB/5GB49.8393/57.5140ms, peaks295505920/290734080 bytes. The original100ms
guard passes in each. Both ten-million-row full-data/hash cases pass too.
These local results do not reproduce or repair the failed CI's102.4537ms gap.
The four largest-interval records have no overlapping GC event and report
untracked/truncated evidence; no complete callback or historical-cause claim.

The two failures are the unchanged Windows CSV observer:
- Calibration: `OS observer startup exceeded 20000 ms; stage=waiting for first snapshot; snapshots=0.`
- Populated CSV1GB: `OS observer snapshot exceeded 3000 ms; stage=waiting for next snapshot; snapshots=42.`
Its later data/source/memory/paging checks and5GB CSV are not reached. Do not
report those workloads as passing. Strict saved-log validation rejects the
resulting error `2 tests failed.` at20261103T104137/window1/renderer.log:1052.
The sole approved record is severity warning, VSCODE-HOST-001, at the same file
line10, exact signed-out CloudSandboxApi message quoted above. Full is NOT
warning-free and remains failed. No unchanged full retry is run.

Independent read-only review confirms all eight CSV sampler/support/test files
match the before-study baseline. The active native sampler has identity-pruned
metadata caching, refreshed RSS, original-handle metadata ordering and normal-path
disposal. The new GC capture is not invoked on the CSV observer path; JSON GC
observers disconnect at stop. Startup0 shows no first complete native stdout
snapshot within20s. Snapshot42/waiting-next shows that snapshot's JS processing
finished, then no next complete native line within3s. The log cannot distinguish
PowerShell/CIM initialization, process enumeration, metadata/counter reads, OS
scheduling or pipe delivery. No demonstrated defect supports a sampler repair,
deadline change, product edit or passing-platform change.

Separate ignored native-boundary probes retain original20s/3s watchdogs; they
cannot clear the failed full. Stable owned-helper probe completes60 snapshots,
first8.6038632s, maximum later gap905.291ms, empty child stderr. Its sidecar caps
at512 and truncates;21 first-discovery metadata calls total6468.1052ms. Evidence:
out/t030-csv-native-probe-1-result.json, -native.jsonl and
out/t030-csv-native-probe-summary.json. Instrumented native collection/sidecar
writes add observation cost; these are local measurements, not future bounds.

The original one-million-row CSV calibration in a separate isolated1.140 host
then passes39 snapshots/import-helper/renderer coverage, maximum gap1350.0078ms,
40.255s test;377 native records below2048 cap. Its first native flush is11.9016s
after the native clock starts;32 metadata calls total10906.419ms. Evidence:
out/t030-csv-native-host-2.log/-status.json and
out/t030-csv-native-host-9804.jsonl. No watchdog failure is reproduced. The sole
approved severity-warning HOST-001 is20261103T112619/window1/renderer.log:9,
exact signed-out CloudSandboxApi message; this probe is NOT warning-free.

Retain the preceding failed diagnostic fixture, out/t030-csv-native-host-1.log/
-status.json: a relative-to-host-CWD script path fails before native observation,
not a sampler reproduction. Corrected paths are module-relative only in ignored
probe files. Its error `1 test failed.` is renderer.log:45 in20261103T112526;
approved severity-warning records there: HOST-002 line2/chatLanguageModelsData23ms,
HOST-004 line3/chatPetContext21ms and HOST-001 line11/exact signed-out message.
It is NOT a passing or warning-free probe.

The system-log query succeeds with no matching Kernel-Power42/107/506/507 in
the full gate window10:29:42–11:16:47+08:00; exact query/result retained in
out/t030-csv-power-events-query.json. A WMI5858 query around the failures initially displays many
ClientProcessId22760/ResultCode0x80041032 records; output truncates and exact count/
raw event file are not retained. Later identity lookup returns no row. A repeat
event query finds no entries for that window; oldest available is then11:18:05,
after it. No client identity, sampler relation or cause is established. Evidence:
out/t030-csv-system-events-observations.json. Do not change or stop owner processes.

At that frozen full gate, scope is six project files, Windows diagnostic context/tests and
these progress records only. Independent preliminary audit compares all382 old
tracked hashes: only host-interval-diagnostics.ts and these two records differ;
three new helper/test files are expected. Owner edits, Mac/Linux branches,
original workloads/deadlines, launch/scanners/workflow/product remain unchanged.
No full-pass, repaired-CI, task-closure or ready-to-push claim is justified.

### Windows CSV native checkpoint follow-up

Owner answers "Not sure" about process monitoring around the two local CSV
failures. Keep WMI activity/client identity unattributed; do not alter or stop
owner processes. Independent design review supports bounded native observation,
not a speculative sampler repair. The new follow-up changes scripts/csv-memory.mts
and adds src/test/csv-native-diagnostics.ts plus its unit test. Alongside the
existing GC candidate and two records, that initial scope was nine project files.

Only Windows with existing LITE_VOYAGER_INTERVAL_DIAGNOSTICS exactly1 loads the
new helper. Off/other flags do not require it; macOS/Linux retain their original
ps branch. The native script retains original counter/metadata functions and
snapshot stdout, stderr failure, acknowledgment and20s/3s watchdogs. Instrumented
source structure must match exactly or fail collection. No workflow, warning
allowance, product, workload, raw timer or memory assertion changes.

Fixed begin/end markers cover warm CIM, process enumeration, each uncached
metadata PID and the aggregate counter batch. A unique owned directory under
repository out/csv-native-* initially retained checkpoint.json and at most one
incomplete checkpoint.json.tmp. This replacement design later fails in the
native probe documented below and is superseded by two alternating slots.
The last16 markers and up to two active nested operations stay below16384 bytes
per file, with sequence and dropped counts.
Fields are fixed labels, numeric PIDs/counts and native Stopwatch elapsed times;
no commands, paths, source data or arbitrary diagnostic strings enter context.
Before the first marker, native bootstrap remains unobserved. Writes themselves
add cost inside measured native work; a latest marker cannot establish OS cause.
The File.Replace and PowerShell NullString APIs are checked against Microsoft
[File.Replace](https://learn.microsoft.com/dotnet/api/system.io.file.replace?view=netframework-4.8.1)
and [NullString](https://learn.microsoft.com/dotnet/api/system.management.automation.language.nullstring) documentation and actual PowerShell.

After failed native termination, the original error is emitted before checkpoint
reading. Supplemental waiting is capped at1000ms; malformed, unavailable or late
context explicitly means unknown and cannot replace the original error/status.
The read has a16385-byte buffer for rejecting over-limit evidence. Its reporting
deadline does not cancel an underlying filesystem request or guarantee sampler
exit at1s; original outer5s forced cleanup remains the final process bound.
Full/truncated history is checked by reverse active-stack replay; no omitted-
prefix reconstruction or cause claim. Original failures remain failures.

Test-first missing-module/reporting/disabled-module and reviewer findings are
retained in out/t030-csv-native-red-*.log. Initial focused native fixture,
serialization and null-string failures are retained in focused-1 through-3;
all are corrected without assertion/deadline changes. Review regressions first
show7fail/20pass, then focused-7 passes45 tests/four files, including the eleven
unchanged Windows native lifecycle scenarios and unchanged metadata/phase cases.
Coverage includes opt-out/non-Windows, unique ownership, byte/ring bounds,
private-field discard, latest active metadata after44 markers/28 dropped,
unchanged counters/original CIM error, contradictory history, immediate original
error and a never-resolving reader. Final tooling types/scoped lint/integration
compilation pass; follow-up independent review finds no blocking defect.

One scoped original CSV calibration against this reviewed checkpoint candidate
passes37 snapshots/import-helper/renderer coverage, maximum gap1357.2722ms,
46.267s test. Evidence: out/t030-csv-checkpoint-1.log/-status.json. Its retained
checkpoint is1349 bytes,214 markers/198 dropped/16 retained/active empty, final
counter-end marker, no temporary file; out/t030-csv-checkpoint-state.json records
path/hash. Sole approved severity-warning HOST-001 is
20261103T120158/window1/renderer.log:9, exact signed-out CloudSandboxApi message.
This scoped run is NOT warning-free and cannot clear the failed full or CI.
It does not reproduce either watchdog failure or identify their native stage.
That reviewed checkpoint candidate's literal npm run verify passes1259 units/123 files,
strict types/lint/build and35-file1012.28-KB VSIX, zero errors/warnings,
730.898s, all387 captured hashes unchanged. Evidence:
out/t030-csv-checkpoint-verify-1.log and its before/after/status files.
Its changed-candidate literal npm run verify:full FAILS after1259 units/123 files
and77 host tests pass, with2 failures;1728.512s, all387 hashes unchanged.
Evidence: out/t030-csv-checkpoint-full-1.log and matching before/after/status files.
Both failures are native CSV stderr containing only `#< CLIXML`: JSON1GB before
the import/timer window and CSV1GB after native sampling has begun. JSON timers,
large-import data/hash/memory gates and later CSV paging/5GB checks are not
reached; do not report them as passing. Both ten-million-row JSON/JSONL cases,
SQLite1/5GB and T-030 native/fallback staged-edit/save/revert DOM cases pass.
CSV calibration separately passes36 samples/max gap952.0195ms/34.400s test.
The sole approved severity-warning HOST-001 is20261103T123210/window1/renderer.log:10,
exact signed-out CloudSandboxApi message quoted above. The same file:1045 records
the disallowed error `2 tests failed.` Full is NOT warning-free and remains failed.
JSON's checkpoint ends at metadata-begin/PID20328, sequence56; CSV's ends at
enumeration-end, sequence236. A latest marker cannot distinguish native work
from a subsequent checkpoint-write error. The missing error bodies preclude
attribution; this run is not an unchanged retry and cannot clear previous failures.

### Bounded stderr capture and checkpoint replacement repair

The existing observer kills its child on the first stderr chunk and keeps only
that chunk. The header-only errors demonstrate an evidence-retention gap, not
their native cause. New test/unit/observer-stderr.test.ts first records6fail/1pass
in out/t030-stderr-red-1.log. The repaired optional path marks failure immediately,
stops snapshots/acknowledgments, retains at most16384 raw bytes, decodes once and
allows at most100ms for remaining stderr. The original20s/3s watchdogs stay armed,
can kill sooner, and are never reset by diagnostics. Forced termination and byte
truncation are explicit. Earlier parser/watchdog failures remain primary; stderr
still rejects zero exit and cancellation. Both timers clear on close. Only the
enabled Windows CSV diagnostic caller opts in; default/SQLite/macOS/Linux behavior
retains immediate termination. Focused43/3 and independent review pass; that
review does not claim a native repair. Current scope adds this observer and test,
bringing the scoped project files to eleven.

A separate real EncodedCommand probe then fails after6 snapshots/14.2018212s,
capturing the actual CLIXML body: File.Replace throws IOException, "Unable to
remove the file to be replaced." Evidence: out/t030-stderr-native-probe-1.json.
This proves a defect in the new diagnostic writer under this environment. It
does not establish the cause of the earlier header-only errors, original CSV
watchdogs or remote JSONL GC/timer failure. No owner process is identified/stopped.

The writer now alternates exactly two fixed owned checkpoint.json.0/.1 files by
sequence modulo2, with no replacement, deletion, retry or swallowed write error.
Each stays within16KiB; total disk footprint is bounded by32KiB. The reader bounds
and validates both slots, parity and adjacent sequences, selects the latest
complete history and explicitly reports incompleteSlots. Missing/partial/invalid
slots can hide newer operations; both-invalid or contradictory evidence means
unknown. Direct writes can still fail and every native stderr byte still fails.
Test-first slot regressions record3fail/25pass in out/t030-checkpoint-slots-red-1.log.
Focused1 retains an EncodedCommand fixture progress failure; its setup now applies
the unchanged production SilentlyContinue setting before fixture module loading.
Focused2 passes56 tests/four files, including real encoded stderr/body capture,
interrupted/missing slots, byte bounds and all eleven original lifecycle cases.
A subsequent parity assertion passes in final verification below.
The changed native EncodedCommand probe completes60 snapshots in41.9432601s with
empty stderr; out/t030-stderr-native-probe-2.json. It cannot clear either failed
full or establish historical cause. The first implementation-review attempt was
interrupted by a usage limit. A separate available independent reviewer completes
the actual slot writer/tests, observer/tests and caller review with no concrete
defect or cross-platform regression found. It checks failure ordering, raw bounds,
original deadlines, default/other-platform behavior and retained red/probe evidence;
it runs no gates. Prior GC implementation review remains applicable unchanged.

### Final frozen gates and scope

Literal npm run verify passes1268 units/124 files, strict types/lint/production
build and35-file1012.28-KB VSIX, zero errors/warnings. Evidence:
out/t030-slots-verify-1.log and before/after/status files;638.427s, all388 captured
tracked/task-new hashes unchanged during the run.

One changed-writer literal npm run verify:full with the workflow diagnostic flag
passes1268 units/124 files and all79 host tests;2381.342s, all388 hashes unchanged.
Evidence: out/t030-slots-full-1.log and before/after/status files. It retains every
original test, workload and deadline. All four populated JSON/JSONL cases complete
data/source-hash/memory checks: JSON1GB/5GB raw timer maxima46.3601/41.3059ms,
sampled host+helper peaks271355904/268091392 bytes; JSONL1GB/5GB42.8895/55.1604ms,
peaks262135808/264802304 bytes. The original100ms guard passes in each. Both
ten-million-row full-data/hash cases and SQLite1/5GB checks also pass.

CSV calibration passes36 samples/max gap1078.3226ms. CSV1GB/5GB each complete
60 Browse+20 SQL pages, source hashes and data/memory checks, with sampled peaks
288952320/288931840 bytes, paging growth10842112/26251264 bytes and host timer
maxima38.3134/52.0742ms. Native/fallback T-030 real-editor staged edit, undo, revert,
explicit save, exact DOM/dirty state and source-safety cases pass. No product/UI
source changes invalidate the retained light/dark/NULL/int64/BLOB visual QA;
these DOM results are not a new physical-paint or unsampled-peak claim.

Strict saved-log validation passes with exactly one approved severity warning:
20261103T154804/window1/renderer.log:10, VSCODE-HOST-001, exact signed-out
CloudSandboxApi message quoted above. Full is NOT warning-free. No other warning,
error, diagnostic allowance or retry is accepted. Seven new full-run native
directories contain exactly14 bounded slot files, maximum observed1419 bytes;
even two intact slots cannot prove an attempted newer marker was written.

Final measurements, warning records, slot hashes and limits are recorded in
out/t030-slots-final-evidence-1.json; retained raw evidence hashes are in
out/t030-slots-evidence-inventory-1.json. The scope audit verifies the owner's
README/PLAN/TASKS/VALIDATION bytes against the pre-study baseline. Only the eleven
task project files change; product/UI/dependencies/version/launch/scanner/workflow
remain unchanged. Final PROGRESS/report updates follow the gates; executable
candidate hashes must continue matching their frozen records.

These local passes do not establish the original remote GC/timer cause or original
CSV-watchdog/macOS-watcher cause. The observed new File.Replace failure is repaired,
with red-first coverage and full regression evidence. Owner retains push and fresh
actual-candidate three-platform CI; T-030 remains unchecked and no later task starts.

## Run41463176404: watcher deletion investigation (2026-11-02)

Public REST confirms attempt1 at exact4c7c51311989cf35ab4169652a8627b269027287.
Windows job125337148371 and Ubuntu job125337148130 pass locked install/full.
macOS job125337147814 passes1173 units/14 existing platform skips and all79
hosts, exits0, then strict saved-log validation correctly rejects:

```text
20261102T143927/window1/fileWatcher.log:1: 2026-11-02 14:39:47.953 [warning] [File Watcher (node.js)] Watcher shutdown because watched path got deleted
20261102T143927/window1/renderer.log:31: 2026-11-02 14:39:47.938 [warning] [File Watcher (node.js)] Watcher shutdown because watched path got deleted
```

Metadata: out/t030-ci-41463176404-metadata.json. No remote artifacts are available.
Byte-identical supplied log: out/t030-ci-41463176404-macos.log, SHA256
69ef0bb56c2f41e1b5dffe9605adb67438838c463649941aee54073752076bad.
No historical GPU error or HOST-007 rejection appears in this supplied log;
do not infer either historical cause or guaranteed future reliability.

Console delivery falls between first native T-030 close-command start and
completion. Fixture deletion follows close/helper exit, so that deletion cannot
be attributed from these labels alone. Native Save uses an in-place transaction;
Save As removes a separate owned work directory. Prior import fixtures remove
their directories after session closure. Independent read-only diagnosis finds
no demonstrated extension defect or originating watched path. Installed official
Windows1.140 watcher source raises this warning after a delayed rename handler
finds a watched root absent; this is supporting vendor evidence, not inspection
of the exact macOS revision or identification of its root. No speculative fixture
lifetime change or eighth warning allowance is adopted.

Global --log=trace in the canonical launch was considered and rejected before
gates: the isolated two-host probe emits expected ENOENT Error tokens that the
unchanged console scanner rejects. Its native exit0 and saved-log HOST-001 at
20261102T231000/window1/renderer.log:110 do NOT make it a passing or warning-free
gate. Evidence: out/t030-watcher-probe-1.log/-status.json and retained profile.
Canonical launch/config, workload, deadline, console scanner and seven exact
approved warning families remain byte-identical to4c7c513.

The candidate instead reports the original full rejection first and retains
status1. Only macOS, existing diagnostic flag exactly1 and an exact dated
window/fileWatcher.log deletion record trigger one separate focused trace host.
Its four original early suites run all seven tests unchanged in an additional
isolated profile. Complete raw console, native logs and JSON status are retained.
This is supplemental diagnosis, never a canonical verification retry or a
successful replacement. A successful or failed probe cannot clear the original
failure. Its native watcher output is a labelled recent tail: at most64 JSON
records/16384 characters, text at most1024 characters including any truncation
marker. Older tail records may be omitted; full raw logs remain.

The saved-log scanner also appends bounded adjacent native trace if available,
otherwise explicitly records unknown path evidence. Shared bounds apply across
windows without an unbounded auxiliary line-index collection. Its complete
severity scan, all rejected records and approved-warning reports remain intact.
No unsupported flag, sleep, clock correction, workload reduction, dependency,
workflow change or ignored warning/error is introduced.

Failing-first evidence: context/launch baseline4fail/3pass in
out/t030-watcher-red-2.log (sandbox startup EPERM retained separately); missing
probe module in out/t030-watcher-probe-red.log; warning-only false-trace report
1fail/2pass in out/t030-watcher-tail-red.log. Independent review catches nested
source matching and inherited-CI-env test isolation; each is reproduced before
repair (out/t030-watcher-trigger-red.log and -env-red.log). Canonical global
trace is discarded, not described as an implemented repair. After source-anchor,
bounded-context and deterministic/inherited-env repairs, focused142/7 passes
with the actual CI diagnostic flag1: out/t030-watcher-focused-final.log.

The actual separate probe implementation runs once locally on Windows1.140.0:
all seven early hosts pass and native source-watcher paths are retained; no
deletion warning recurs. Its saved-log approved HOST-001 is
20261102T231656/window1/renderer.log:103, original severity warning and exact
signed-out CloudSandboxApi message. Raw trace retains expected ENOENT Error
strings. This is NOT a console-gate pass, warning-free run, macOS reproduction,
or cause/repair claim. Evidence: out/t030-watcher-production-probe-1.log and
out/integration-profile-watcher-probe-ocBwmQ/watcher-probe-{console.log,status.json}.

Both approved probe records have original severity warning, rule VSCODE-HOST-001,
and exact message `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
The two sources/lines are stated separately above. Neither probe is a passing
console gate. Trace output can affect scheduling, and a separate fresh host's
paths cannot recover the discarded original watcher identity or prove its cause.

Final independent read-only review finds no remaining concrete defect after the
failing-first repairs. Literal `npm run verify` passes1212 units/120 files, strict
host/webview/tooling types, lint, production build and35-file/1012.28KB VSIX.
Zero gate warnings/errors; exit0; UTC2026-11-02T15:22:27.102Z through15:34:02.187Z,
695.085 seconds. All382 tracked/task-new before/after hashes match. Evidence:
out/t030-watcher-verify-1.log, -before.json, -after.json and -status.json.
Only PROGRESS.md and this evidence record change after the gate. Normal launch,
console checker and workflow match the parent; owner README/PLAN/TASKS/VALIDATION
work remains excluded from the eight-file local commit. The staging/commit
proofs are retained under out/t030-watcher-{prepare,staged,committed}-proof.json.

No new canonical full gate is claimed. The executable product is unchanged;
current evidence covers diagnostic boundaries plus the actual seven-host probe,
not physical macOS QA or repaired macOS CI. Fresh owner-pushed evidence is
required; retain run41463176404 even if a later run passes. T-030 remains unchecked.
Owner retains push/CI. Prior scoped visual evidence/limits below stay.

Files: scripts/integration-check.mts; scripts/integration-logs.mts;
scripts/integration-watcher-probe.mts; test/unit/integration-watcher-diagnostics.test.ts;
test/unit/integration-watcher-probe.test.ts; test/unit/integration-watcher-tail.test.ts;
PROGRESS.md; this document. Commands: npm run verify; focused npm test --
test/unit/integration-watcher-diagnostics.test.ts test/unit/integration-watcher-probe.test.ts
test/unit/integration-watcher-tail.test.ts. Owner's full CI command stays npm run verify:full.

## Follow-up run41205204032: historical investigation

Public REST confirms attempt1 at exact `bd3f85e7930fc05123661156c1b8ad014e792eb9`.
Ubuntu job124548761467 succeeds. Windows job124548761450 fails two native
staged-edit unit tests at their unchanged5000ms whole-test deadline (1153 pass,
2 fail). macOS job124548761232 passes all79 host tests and then correctly
rejects the new warning below. No prior GPU mailbox error appears in the supplied
macOS log; this does not establish a graphics repair or future reliability.

```text
20261031T132559/window1/renderer.log:16: 2026-10-31 13:26:04.774 [warning] Creation of workbench contribution 'workbench.contrib.dynamicWindowConfiguration' took 116ms.
```

Its approved HOST-001 record is renderer.log line15, original severity warning:
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
Metadata: out/t030-ci-41205204032-metadata.json. Byte-identical supplied logs:
out/t030-ci-41205204032-windows.log SHA256
1999e951e681e53e8ec080205ace071f4e42d571d22ee4c3f2c52622c6fe715f;
out/t030-ci-41205204032-macos.log SHA256
30b3a4e3eb40667d031a4efea9fafb4f531083745ab4d78724b7dd2ca17ae960.

### Exact HOST-007 policy proposal and owner decision

Propose only `VSCODE-HOST-007`, anchored message pattern:
`/^Creation of workbench contribution 'workbench\.contrib\.dynamicWindowConfiguration' took \d+ms\.$/`.
Duration must contain ASCII digits only. Retain the timestamped `[warning]`,
dated session/windowN/renderer.log source, exact wording, severity and reporting
guards. Report every original source/line/severity/rule/message. All errors,
other sources, malformed durations, altered wording and unrelated warnings fail.
Console/type/lint/build checks remain unchanged; no unchanged retry-to-green.
This proposal remained inactive until the owner replied to its exact approval
question on2026-10-31 and delegated implementation judgement. That specific reply
authorizes only this reviewed family, preserving all other diagnostic failures.

The installed official Windows1.140.0 revision07f806f999227108933c2e30515b26eecc1fda74
bundle defines this contribution at workbench.desktop.main.js line705. It registers
window.newWindowProfile configuration and profile/configuration listeners at
Eventually. Its registry measures synchronous construction with Date.now and
warns above100ms after restore. It is not proven to run before the extension.
The macOS log identifies a different revision, b224f6bf5a4fcad5fa4c640ed10f179c3b613e48;
do not claim inspection of that exact macOS source, its timing cause or GPU cause.
Independent read-only review supports the narrow proposal subject to explicit
owner approval, retaining every existing fail-closed diagnostic restriction.

### Windows fixture investigation (not a proven CI cause)

The old fixture executes15 setup statements as separate autocommits inside
each5000ms test. The supplied timeout stacks do not identify a stalled phase.
Existing local baseline passes24 cases in20.18s; retain
out/t030-ci41205204032-staged-baseline-elevated.log. The preceding sandbox-only
startup fails spawn EPERM before tests; it is not a product failure or passing gate.
The fixture candidate seeds identical SQL in one transaction with unchanged
SQLite durability settings. No production engine/save behavior, data, assertion,
payload size or deadline is changed. Cleanup is strengthened to run even after
seed/open/body/close failure. New tests preserve exact
int64/rowid/generated data and require failed setup to roll back and close.
The extracted old autocommit helper fails the rollback case (1fail/1pass),
retained in out/t030-ci41205204032-fixture-behavior-red.log, following the
missing-module red in out/t030-ci41205204032-fixture-red.log.
Focused26/2 passes, both with diagnostics disabled and enabled; opt-in fixed
phase names, fallback and monotonic timestamps contain no paths/SQL/cell values.
All24 existing test bodies are unchanged. The enabled log is
out/t030-ci41205204032-fixture-phases.log. Native large-value and rowid-gap
cases take1065ms/509ms locally, including seed/open/body/close/cleanup.
Five alternating disposable-file probes measure65.0743–82.5156ms original
setup versus4.9362–9.1003ms transaction setup, each with DELETE journal and
synchronous2, identical7 tables. Evidence: out/t030-ci41205204032-seed-probe.json.
This ad-hoc Node probe emits MODULE_TYPELESS_PACKAGE_JSON when importing the
test helper; retain it, do not call the probe warning-free or change package mode.
No such warning occurs in the Vitest runs. No timing is subtracted from a test.
Independent read-only implementation review confirms equivalent seed SQL and
unchanged test bodies, finds no concrete defect, and makes no CI-causation claim.
Standalone `npm run verify` passes1157 units/116 files, strict host/webview/tooling
types, lint, production build and35-file/1012.28KB package with zero gate
warnings/errors. Elapsed784.529s; all377 before/after hashes match. Evidence:
out/t030-ci41205204032-verify-1.log, -before.json, -after.json and -status.json.
Only this evidence document and PROGRESS.md are updated after that gate.
That fixture-only candidate was not committed while the exact HOST-007 decision
was pending. The owner subsequently authorized this exact proposal;30 new
regressions run first against the six-family implementation (6fail/24pass),
retained in out/t030-host007-red.log. The implementation adds only the anchored
rule/type member and documents the explicit policy amendment in AGENTS.md and
VALIDATION section1. No console scanner, source/severity guard, report formatter,
existing rule, renderer flag, workload, timeout or existing test is changed.
The combined focused suite passes135 tests/5 files (out/t030-host007-focused-green.log).
Independent cumulative nine-file read-only review finds no concrete defect:
exact message/ASCII duration, all old source/severity/reporting/console guards,
seed SQL equivalence, unchanged test bodies/budgets and cleanup/privacy retained.
### Final combined verification and supplemental visual QA

Both literal gates pass on the same frozen378-file candidate:

- `npm run verify`:1187 units/117 files, strict types/lint, production build and
 35-file/1012.28KB VSIX;623.667s, exit0, zero gate warnings/errors.
- `npm run verify:full`, workflow `LITE_VOYAGER_CI_DIAGNOSTICS=1`:1187 units and
 all79 real-host tests (34m host suite);2844.361s, exit0. Minimum VS Code1.140.0,
 embedded Node24.21.0; tooling Node26.5.0 matches the workflow.
- Full is NOT warning-free. Exactly one accepted record: source
 `20261031T222944/window1/renderer.log`, line10, severity `warning`, rule
 `VSCODE-HOST-001`, message
 `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
 No other warning/error is accepted. HOST-007 acceptance is covered by the new
 unit regressions; do not claim this Windows host emitted it.
- All four before/after manifests are identical. All original1/5GB SQLite,
 JSON/JSONL/CSV workloads, counts, paging, source hashes, memory, DOM readiness
 and raw timer assertions pass. No cold-disk, unsampled-peak or OS-cause claim.
- Evidence validation confirms194 private D-5 records (97 per engine),22
 staged-fixture phase records (11 per engine), maximum measured fixture1410.2326ms
 and seed10.7249ms, plus20 original-identity shutdown records. Existing5000ms
 tests and all other deadlines/assertions remain unchanged. These local results
 do not establish the hosted Windows timeout's cause or future reliability.

Evidence: out/t030-host007-{verify,full}-1.log, each -status.json, -before.json
and -after.json; out/t030-host007-final-evidence.json. The independent cumulative
code review and final staging-audit plan review find no concrete defect.
Only PROGRESS.md and this record change after these gates to record results.

Supplemental fresh physical UI checking uses the installed VS Code1.144.0, a
new isolated profile and disposable two-row database, not the minimum host or
macOS. The stale pre-update package path first fails ENOENT before launch;
the current CLI identifies resource directory2c33b50b16 and the corrected ignored
launcher starts once. The database initially appears in the binary text editor;
the explicit Open in Lite Voyager action opens the real panel. Direct screenshots
from returned task window460798 show light/dark layouts, explicit write mode,
exact signed int64 values, distinct literal NULL/SQL NULL/empty text, BLOB
placeholders, Unicode staged-cell marker and dirty tab. Before Save, the original
database hash remains e561056aa19e790f72c0ec3359c50c95eda52da75d9b9435f84a5755a5140b1d.
Clicking Save changes clears dirty/pending state and persists the complete
`HOST-007 visual QA 😀` value; unchanged other values are independently read back.
Saved hash:f868d9d44b9cc3eca47e51a555f1d222e99f671bdc9e356c7fd8e81173d16ca9.
Proofs: out/t030-host007-visual-proof-{staged,saved}.json. Both task window and
owned PID6912 are confirmed absent after normal close; no owner window is acted on.
The first sandbox-only CIM closure query is denied; the elevated read-only
confirmation returns no process. This is not a product failure or gate pass.

This visual host is NOT a clean diagnostic gate. Its scanner correctly rejects:

- `20261031T230506/main.log:3`: error `Error: Error mutex already exists`.
- `window1/exthost/exthost.log:3-4` in that session: activation failure and
 `The signed-out authentication fixture can only run in the integration test host.`
- `window1/renderer.log:1`: warning that github.vscode-pull-request-github asks
 for the nonexistent `agentsWindowActivation` API proposal.
- renderer lines11/13/14: DefaultAccount attempt1/2/3 provider-registration timeout
 warnings; line12: the cloud-dictation provider timeout warning; line15: the
 DefaultAccount failure error. Original exact records are retained in
 out/t030-host007-visual-diagnostics.json and the profile's raw logs.
- Console additionally retains DEP0169 url.parse() DeprecationWarning (and the
 mutex error). None of these records is added to the approved warning families.

Profile/logs: out/integration-profile-t030-host007-visual-xw5f7T/;
console: out/t030-host007-visible-host.log. These observations support the scoped
physical UI check only; the strict minimum-version full gate remains separate.

### Local commit scope and owner handoff

Nine task files: AGENTS.md, PROGRESS.md, this record, scripts/integration-logs.mts,
specs/VALIDATION.md (only the new HOST-007 block), test/unit/staged-edits.test.ts,
test/unit/fixtures/staged-edit-database.ts, test/unit/staged-edit-fixture.test.ts,
and test/unit/integration-logs-host007.test.ts. Preserve owner README/PLAN/TASKS,
pre-existing VALIDATION hunks, debug.log, gingTryWan and untracked fixtures.
The local gates include those unchanged owner documentation bytes; no byte-identical
committed-tree VSIX claim is made. The audit reconstructs the VALIDATION index
from bd3f85e plus only HOST-007, preserving the complete owner worktree content.
Staged/committed nine-file content audits and their SHA/proofs are recorded under
out/t030-host007-final-*.json. Owner retains pushing and CI; no remote write,
renderer/version/dependency/tag/release change. Keep T-030 unchecked until fresh
actual-candidate three-platform CI. Continue here if it fails; no later task.
Historical GPU/interval causes, fallback writer race and unknown-save-outcome
limits remain explicitly retained. Neither the policy amendment nor these local
samples establish a GPU repair or a causal hosted-timeout repair.

Historical checkpoint (before run41205204032): diagnostic reporting, passive opening evidence and the
direct-session collector repair pass final local standalone/full verification.
macOS CI remains failed until the owner pushes and supplies actual-candidate
platform results. No GPU cause is established. Only T-030 is active; stay here.
Owner retains pushing and CI. No renderer, workload or diagnostic policy changes.

## Actual candidate and failure

Public REST confirms [run41174034992](https://github.com/JreyForFun/lite-voyager/actions/runs/41174034992),
attempt1, exact commit `8cf3116dde61e7079e75468cbd8551a14f4cd0d5`:

- Ubuntu job124457766981 and Windows job124457767182 succeed, including locked
  installs and their applicable full-verification steps. Their raw diagnostic
  logs are not retrieved; no remote warning-free claim is made.
- macOS job124457767149 installs successfully, passes1132 unit tests with14
  existing platform skips across113 files, builds/packages and passes79 host
  tests. The host runner exits0, but strict console validation correctly fails.
- There are20 Chromium GPU errors at native timestamp1031/055851.365017 through
  .382702:10 ProduceOverlay/non-existent-mailbox and10 Invalid-mailbox records.
  These are errors, not any of the six approved renderer warning families.
- The retained passive process snapshot identifies PID8580 as the GPU child of
  isolated Code PID8575 (VS Code1.140.0, darwin-arm64). This establishes its
  observed role; it is not an OS/compositor trace or proof of the selected backend.
- Errors follow the successful fallback=true five-format D-5 opening test and
  precede the successful two-view closure test. That ordering does not identify
  a responsible format, panel or operation. Normal tests await exact-tab closure
  and helper/session cleanup; these do not establish GPU compositor quiescence.

All original JSON/JSONL1/5GB interval assertions pass on this run: maxima
26.452333/33.353167/32.447166/28.817167ms. The older266.675ms failure remains
unexplained; a passing sample is not a causal timing repair. Previous failures
and local full-run warning records remain in docs/t030-ci-repair.md.

Owner attachment is copied byte-for-byte to out/t030-macos-ci-41174034992.log;
SHA-256:50d0fcf213d36dfda8619577520bfa81daf2149646b22981da951814a69b629e.
Metadata and extracted exact error/interval evidence are retained in
out/t030-macos-41174034992-metadata.json and out/t030-macos-ci-evidence.json.
The artifacts endpoint reports total_count0. Saved main/renderer logs from this
runner are therefore unavailable through that endpoint.

## Confirmed reporting defect and acceptance

The existing integration-check awaited runCheck before calling
checkIntegrationLogs. A console failure therefore bypassed saved-log scanning,
including approved-warning reporting, precisely as this failed run demonstrates.
This is an evidence gap; the gate already failed correctly.

Acceptance: after the host settles, scan its isolated saved logs exactly once
even if the host failed. Retain the original sole failure; retain both original
failures and their messages if both fail. Report approved warnings even when
the host fails. Missing logs and every unapproved warning/error still fail.
Do not retry the host, change severity rules, toggle renderers or relax tests.

New scripts/integration-validation.mts implements that sequencing, and
scripts/integration-check.mts delegates to it with the same host command,
environment, profile and scanner. Neither source scanner nor console regex is
changed. A scanner failure still includes its exact diagnostic sources/lines
and approved records. No product runtime, fixture, dependency, version, workflow,
deadline or renderer switch changes. No existing assertion is weakened.

Five regressions use real subprocess console validation and disposable saved
logs. Tests are written first (missing-module red); an explicit restoration of
the old sequential control flow subsequently fails2 cases with3 passing.
Restoring the repair passes94 focused tests/4 files. Evidence:
out/t030-macos-reporting-red.log, -baseline-red.log and -final-green.log.
Independent read-only lifecycle and reporting reviews find no concrete defect;
reviewer runs no builds/tests. No GPU repair follows from these checks.

## Local verification blocker and rejected collector proposal

The first standalone stops at one require-await lint error in a new rejected-
promise test callback (zero lint warnings);372 hashes match. Replace its async
throw with an explicit rejected promise, preserving the assertion/failure.
Retain out/t030-macos-verify-1.log and -status.json; this is not a passing gate.

The second literal standalone passes types/lint and1150 unit tests but fails
one existing Windows collector test: shutdown exceeds the unchanged10000ms cap.
All372 hashes match;682.341s, exit1. Retain out/t030-macos-verify-2.log and
-status.json. This failure is separate from macOS CI and is not retried unchanged.

A separately instrumented owned-child probe reproduces that timeout. Seventeen
exit observations finish before the cap; queries average450.1ms, which requires
about10.9s for20 queries plus19x100ms spacing before output overhead. The child
is still producing observations when killed; no EOF hang is established.
Session reuse and a Handle-filter microprobe do not establish enough improvement.
Retain out/t030-collector-probe-1.log and out/t030-cim-*-probe.log.

Microsoft documents [Win32_Process.Handle](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-process)
as the process-ID key, and [Get-CimInstance example5](https://learn.microsoft.com/en-us/powershell/module/cimcmdlets/get-ciminstance?view=powershell-5.1#example-5-get-the-cim-instances-with-only-key-properties-filled-in)
constructs a client-only key and retrieves the current instance through it.
An experimental collector does that for each fresh observation. This is a metadata key,
not an opened process handle. Only typed CimException/NativeErrorCode.NotFound
maps to absence, matching the old empty query result; every other provider error
propagates. The installed enum/API and live/absent lookup behavior are checked.
Only the existing creation/parent/name fields are retained in output.

Before changing lookup, strengthen the owned-child test to require all20 exit
records with the exact PID and original-creation/query-timestamp fields.
The old lookup fails the same timeout (1fail/8pass), retained in
out/t030-collector-count-red.log. Keyed lookup passes103 focused cases/5 files;
the changed probe completes all20 observations under the same10000ms cap.
Evidence: out/t030-collector-key-green.log and out/t030-collector-probe-2.log.
Independent review finds no concrete lookup/identity/error-handling defect;
its identified assertion gap is then closed by comparing every originalCreation
with the started record's exact creation value and parsing all query timestamps.
The subsequent stronger focused run FAILS the same collector timeout:
102passes/1failure, out/t030-collector-final-green.log (the filename is not a
passing-status claim). The keyed-lookup runtime change is therefore rejected
and fully reverted at that checkpoint; the later direct-session variant below
is a different implementation. Keep the stronger count/identity/timestamp assertions.
Retain the proposed diff in out/t030-collector-proposed-key-diff.txt. No fresh
standalone gate is run on unchanged failure evidence to seek green.

No sample count, spacing, startup/shutdown deadline, warning policy, target
handle, process signal or test workload changes. This does not establish the
macOS GPU cause or guarantee all future timing samples.

## Verification and remaining work

The earlier checkpoint is not acceptance: both failed standalone runs retain
all372 matching hashes. Preserve out/t030-macos-checkpoint.json as historical.
Owner explicitly directs continuing here through resolution; no new task/chat.

The next candidate uses one local CimSession and its installed, verified
GetInstance(namespace,key) overload directly. Each observation still fetches a
fresh provider instance; only an exact wrapped CimException/NativeErrorCode.NotFound
means absence. Returned ProcessId must match the requested PID. Instances,
client-only keys and session are disposed, with no OS target handle or signal.
The same creation precision/parent/name schema,20 observations,19x100ms spacing,
15000ms startup/10000ms shutdown/30000ms owned-child test limits remain.
The isolated candidate completes20 records under the original Node guard:
out/t030-method-probe.log. This does not guarantee every future timing sample.

Test-first provider fixture extracts the actual production Read-TaskIdentity
function through PowerShell's AST. It compares live creation precision/parent/name
with the provider; verifies absent-key handling, propagation of a real invalid-
class provider error, and mismatched-PID refusal. It runs inside the existing
Windows-only test without new skips or a raised budget. Baseline fails missing
function (1fail/8pass), out/t030-direct-method-red.log; repaired focused103/5
passes, out/t030-direct-method-green.log. Independent review is clear.

Mac evidence adds fixed-label D-5 stage records around the original two five-
format opening tests. Existing LITE_VOYAGER_INTERVAL_DIAGNOSTICS=1 opts in.
Each record copies only fallback/format/kind/test-view number and paired UTC/
monotonic/timezone-offset values. These are logical owned-view labels, not
native compositor IDs. No paths, SQL, cells, waits, hooks, renderer APIs or new
awaits are added. Capacity256 per case fails visibly; diagnostic errors cannot
prevent the existing finally cleanup. Disabled collection samples nothing.
Tests first fail missing module; privacy/disabled/capacity/invalid-clock tests
then pass. Combined focused107 tests/6 files pass:
out/t030-diagnostics-final-focused.log. Instrumentation can affect scheduling;
it is not a GPU repair or an OS scheduler trace.

Final literal `npm run verify` PASS:1155 unit tests/115 files, strict host/webview/
tooling types, lint, production build and35-file VSIX package. Zero errors and
zero warnings. UTC2026-10-31T11:59:44.074Z through12:11:35.214Z,711.140s, exit0.
All375 tracked/task-new hashes match. Evidence: out/t030-macos-verify-3.log,
-before.json, -after.json and -status.json. Earlier failed runs remain retained.

CI-enabled literal `npm run verify:full` PASS on the exact same375-file candidate:
1155 units/115 files plus79 real-host tests on minimum VS Code1.140.0, Node24.21.0.
UTC2026-10-31T12:12:31.709Z through12:55:15.919Z,2564.210s, exit0; all375 hashes
match. Evidence: out/t030-macos-full-1.log, -before.json, -after.json, -status.json.
Only these two records change afterward; all verified code/tests remain frozen.

Full is NOT warning-free. Exactly two owner-approved severity-warning records,
source `20261031T202324/window1/renderer.log`:

- Line2, VSCODE-HOST-002: `Creation of workbench contribution 'workbench.contrib.chatLanguageModelsData' took 33ms.`
- Line11, VSCODE-HOST-001: `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.

No other warning/error is accepted. All original populated1/5GB SQLite/CSV/JSON/
JSONL data/source hashes, memory/paging/DOM/timer checks pass. Combined host/helper
peaks remain below500000000 bytes; renderer is reported separately and is not
claimed below that cap (CSV1GB renderer peak705695744 bytes). JSON/JSONL maxima
are54.6092/55.0365/45.8392/32.4283ms against the unchanged100ms limit. CSV1/5GB
maxima38.6379/43.4017ms and paging growth21233664/42713088 bytes also pass.
These are warm generated inputs and sampled memory, not cold-disk/physical-paint
or unsampled-peak guarantees; prior historical graphics/timing causes stay unknown.

The real D-5 cases emit194 lifecycle records (97 per engine), with exactly the
approved fields and confirmed final cleanup. The outer live Windows collector
emits all20 shutdown observations with the original creation identity retained,
without triggering the unchanged deadline. Extraction/assertions are retained
in out/t030-macos-final-evidence.mts and -evidence.json. Independent review is
read-only; execution evidence comes from these primary-agent gate logs.

The reporting repair can expose saved runtime diagnostics on the next failed
host run; it cannot recover the already-discarded macOS logs or guarantee that
they contain compositor evidence. First inspect matching raw main/renderer/GPU
logs alongside the bounded passive lifecycle timestamps around D-5 hide/show/
closure and final closeAll. Preserve
all failures, original clocks/workloads and strict guards. Do not infer a fix
from renderer toggles, sleeps, redraws, unsupported flags or a passing retry.

Chromium's [ProduceOverlay implementation](https://chromium.googlesource.com/chromium/src/gpu/+/f2ce5726738369eaf8f7dadb75667225a2353a41/command_buffer/service/shared_image/shared_image_manager.cc)
logs this family when a mailbox lookup has no backing. That reference is not
claimed to be the exact packaged Chromium revision or an explanation of how
this run reached that branch. Independent lifecycle review finds no concrete
extension defect supported by the supplied log.

Commands: npm run verify; focused checks:
npm test -- test/unit/opening-lifecycle-diagnostics.test.ts test/unit/ci-diagnostics.test.ts test/unit/integration-validation.test.ts test/unit/integration-logs.test.ts test/unit/integration-config.test.ts test/unit/ci-workflow.test.ts.
Owner's acceptance command remains npm run verify:full on all three platforms.
The new local Windows full pass does not clear macOS or establish a graphics
repair. No new physical macOS QA pass is claimed. Keep T-030 unchecked. Owner
pushes the verified local commit and supplies the new run URL/SHA/complete macOS
log here; inspect the new saved-log and lifecycle evidence if the error recurs.

Files: scripts/integration-check.mts; scripts/integration-validation.mts;
scripts/windows-exit-diagnostics.ps1; test/unit/ci-diagnostics.test.ts;
test/unit/fixtures/windows-identity-provider.ps1; src/test/file-opening.test.ts;
src/test/opening-lifecycle-diagnostics.ts; test/unit/opening-lifecycle-diagnostics.test.ts;
test/unit/integration-validation.test.ts; PROGRESS.md; this document.
Preserve owner README/shared-spec/TASKS hunks and unrelated untracked files.
No push, CI dispatch, tag, release or later-task work.
