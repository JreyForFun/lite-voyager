# T-030: actual-candidate CI follow-up

Follow-up (2026-10-31): run41054019454 at8a1d9af fails seven fixture cases on
Windows/macOS before host tests; Ubuntu passes. Current fixture-only repair and
fresh-CI status are in [canonical-path fixture repair](t030-ci-fixture-repair.md).
The local gates and timing limitations below remain historical evidence.

Status (2026-10-30): path and sidecar safety repairs pass final local gates;
macOS timing cause remains unresolved. Fresh owner-pushed candidate CI pending.
Only T-030 is active. Existing owner authorization covers scoped repairs and QA;
the owner retains pushing and CI. No test limit or diagnostic policy is relaxed.

## Failed candidate and retained evidence

Owner supplied [run 40568873744](https://github.com/JreyForFun/lite-voyager/actions/runs/40568873744).
Public GitHub REST metadata independently confirms attempt1, completed failure,
at exact commit `1257ca596e9199f05266a94a9936b3174c77933d`:

- Windows job122417389339: locked installation passes; verification fails with
  17 unit failures /1117 passes across112 files. Fifteen failures report
  `Invalid owned save workspace.`; two interrupted-save spill cases report
  source-identity mismatch during authorized journal recovery. Host tests are
  not reached by that job.
- macOS job122417390006: locked installation and1134 unit tests pass. Host
  tests finish78 passing /1 failing: populated5-GB JSONL import has raw timer
  gap266.67524999997113ms against the original100ms guard.
- Ubuntu job122417389874: locked installation and the applicable full
  verification step succeed. Remote raw diagnostic counts are not independently
  retrieved; this is not a warning-free remote-run claim.

Owner-pasted logs are copied unchanged to
out/t030-ci-40568873744-windows.log and -macos.log. Initial browser fetch fails;
public REST metadata is obtained with TLS1.2 after the sandbox connection fails.
All failures and the original local passing gates remain historical evidence.
Those local passes did not establish this candidate's cross-platform acceptance.

## Windows cause and test-first repair

The host uses asynchronous realpath, which resolves Windows8.3 names to native
long paths. Worker editing used JavaScript realpathSync, which can preserve the
short spelling. The same directory/inode therefore appeared different during
owned-workspace or source-token checks. A local read-only probe demonstrates:

- realpathSync(`C:\PROGRA~1`) returns `C:\PROGRA~1`;
- realpathSync.native and asynchronous realpath return `C:\Program Files`.

Probe: out/t030-ci-path-probe.mts. The CI temp path contains `RUNNER~1`.
Four deterministic regressions reproduce both mismatches before the fix, using
real files, junctions/directory symlinks and SQLite. The JavaScript realpath
implementation is replaced by alias-preserving behavior, so the distinction is
tested on all platforms even when8.3 names are unavailable. Later sidecar cases
also model case-insensitive lookups using mapped real filesystem metadata;
unmapped filesystem calls, actual data and SQLite remain real. No OS case is skipped.

Opening snapshots, edit fingerprints, requested-path checks, destination-parent
checks, owned-workspace checks and recovery all now use realpathSync.native,
matching the host. Device/inode/version, regular-file/link, sidecar, private-
directory and stale-source guards remain. No string-only alias exemption is added.
The existing wrong-inode refusal and real hot-journal spill tests remain intact.

Retain out/t030-ci-paths-red.log (initial2 failures), -paths-red-2.log (all4
targeted failures), and -paths-green.log (46 passing tests /3 files, including
both complete staged-edit/safety suites). A later unchanged focused pass is
not evidence of a fix for the unrelated macOS timing cause.

## macOS investigation and honest limits

The failed interval runs from534167.50025 to534434.1755ms, within
`importing/reading`. Process CPU deltas are358us user /169us system. No retained
callback or GC span overlaps it. The only retained named operation is a
0.202292ms synchronous webview-state send near the interval's end. The trace
reports619 dropped operations and487 untracked resources. These observations
do not establish OS descheduling, blocking native work, GPU behavior or any
other cause. No speculative product optimization is labelled a repair.

The existing opt-in test-only trace now adds event-loop active/idle and process
voluntary/involuntary context-switch deltas sampled near timer endpoints. It
retains only the largest interval's bounded evidence. The raw timestamps,
phases, duration,100ms assertion, workloads and deadlines remain unchanged.
Disabled diagnostics call neither sampler. These counters are not an OS
scheduler trace and do not prove the cause of a wall-clock gap.

A failing deterministic regression precedes implementation. All9 diagnostic
tests pass, including unchanged raw-duration and disabled/live cleanup checks.
Evidence: out/t030-ci-interval-red.log and -interval-green.log. Fresh macOS
observations are still needed; a later passing run cannot establish a causal
repair of the retained266.675ms failure.

## Additional Save As sidecar repair

A further review identifies a distinct data-safety gap, not the cause of the
macOS timer failure. On a case-insensitive POSIX volume, destination basename
case variants can alias the source WAL/SHM/journal while the old lexical guard
folds case only on Windows. Existing target checks compare only main-source
inode; later destination/source version checks do not establish alias safety.
An absent uppercase sidecar name needs protection too, before creating output.

Six deterministic regressions (three sidecars, existing/absent) fail before the
repair: each reaches the writer sentinel. They exercise the POSIX branch and
case-lookup aliases returning real inode metadata on every OS. They are not
physical macOS filesystem observations. No writer can modify a source in the
regression even when its guard fails. Retain out/t030-ci-sidecar-case-red.log.

Before copying or opening a writer, Save As now compares existing target identity
against main plus every protected sidecar. For absent suffix variants, it checks
whether the filename prefix identifies the source and observes ASCII case lookup
using a differently cased entry for the already-owned, validated workspace in
the same destination parent. lstat prevents a distinct symlink spelling from
establishing probe identity. No probe file is created. Exact lowercase aliases
always refuse; genuinely case-sensitive parents retain distinct uppercase names.
The guard is inside cleanup handling. All earlier identity/version/link checks
remain. The documented external-writer race is not strengthened into a guarantee.

Focused61 tests /4 files pass after the repair. The final11-case path suite
also passes a case-sensitive-parent positive control that reaches a sentinel
writer without source writes. Logs: out/t030-ci-sidecar-case-green.log and
-sidecar-case-final.log. Independent follow-up finds no remaining concrete
defect; reviewer does not run tests/builds or claim physical macOS validation.

The first repair standalone passes1139 tests /113 files, zero verification
errors/warnings, in696.471s with368 unchanged hashes. Its first full is deliberately
stopped to add the new failing sidecar regression, not a gate PASS: exit1 after
721.609s, all368 hashes unchanged. Unit/build/35-file package checks pass; the
minimum host has only just started. No integration suite completion is claimed.
Only the exact task-owned npm child tree is stopped after executable/parent/PID
checks. Retain out/t030-ci-verify-1* and -full-1* and profile-urWJlq.

The interrupted host is NOT warning-free. Manual strict log scan passes with
one approved diagnostic, under out/integration-profile-urWJlq/logs/:

`{"source":"20261030T190738/window1/renderer.log","line":10,"severity":"warning","rule":"VSCODE-HOST-001","message":"[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]"}`

Retain out/t030-ci-full-1-logscan.log. A second standalone/full must use this
changed safety candidate; there is no unchanged retry-to-green.

## Validation and handoff

Required literal commands: `npm run verify` and `npm run verify:full`.
Both final gates pass with all368 before/after hashes unchanged; standalone-after
and full-before are identical. The owner-authorized T-030 reviewer independently
reviews all five code/test paths, read-only, and reports no concrete findings.
No tests/builds are executed by the reviewer; the macOS cause is not established.
Final results (after the sidecar repair and case-sensitive positive control):

- `npm run verify`: exit0,1146 unit tests /113 files, all strict type/lint/build/
  35-file VSIX checks; zero verification errors/warnings. Duration655.414s,
  2026-10-30T11:15:36.188Z through11:26:31.602Z. Log/status/hash records:
  out/t030-ci-verify-2*.
- `npm run verify:full`: exit0, the same1146 unit tests plus79 integration tests
  on minimum VSCode1.140.0 / bundled Node24.21.0. Both T-030 engine workflows,
  all original large-file/hash/paging/memory checks and strict runtime-log scan
  pass. Duration2488.068s, from11:26:42.163Z through12:08:10.231Z. Evidence:
  out/t030-ci-full-2*, isolated profile-o91RbA.

The full run is NOT warning-free. Its sole approved diagnostic is:

`{"source":"20261030T193906/window1/renderer.log","line":10,"severity":"warning","rule":"VSCODE-HOST-001","message":"[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]"}`

The source is under out/integration-profile-o91RbA/logs/. Every other warning
and every error still fail. No rule, deadline, workload or assertion was relaxed.
The earlier stopped run is not counted as a pass or replaced by this result.

Local5-GB JSONL passes with raw maximum gap40.8788999998942ms, full-data checks
and unchanged source hash. Its sampled host/helper peak is298860544 bytes.
This Windows result does not establish the cause or repair of the macOS gap.
The minimum-host startup probe emits the new scheduling fields, but all four
deltas are zero around a50.2988ms interval with47,000us process CPU. Treat zeros
as indeterminate embedded-host observations, not proof of idle time, absence of
descheduling or platform support for useful counters. Fresh macOS evidence is
still necessary; no causal claim follows from these new fields.

Only PROGRESS.md and this record change after the final gates. Runtime, tests
and all other checked files remain frozen. A final hash/index audit binds the
local task-only repair commit to this candidate. Existing owner authorization
to commit T-030 is retained; the owner pushes and runs the existing CI workflow.
Retain the new run URL/exact SHA and all three OS results before task closure.
No UI layout changes occur; earlier scoped physical QA remains historical,
separate from the new real-host workflows and unobserved macOS behavior.

The eight repair paths are PROGRESS.md, this document,
docs/t030-staged-edits.md, src/engine/file-snapshot.ts,
src/staging/sqlite-edits.ts, test/unit/staging-paths.test.ts,
src/test/host-interval-diagnostics.ts, test/unit/host-interval-diagnostics.test.ts.
Preserve all owner README/TASKS/shared-spec edits and unrelated untracked files.
No dependency, manifest version, workflow, tolerance, warning exception or
later-task implementation changes. Keep T-030 unchecked pending fresh
actual-candidate three-platform CI and an explicit record of the macOS limit.
