# T-030: macOS GPU failure and retained-log reporting

## Follow-up run41205204032: current investigation

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
