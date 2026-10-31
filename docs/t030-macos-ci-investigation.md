# T-030: macOS GPU failure and retained-log reporting

Status (2026-10-31): diagnostic reporting, passive opening evidence and the
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
