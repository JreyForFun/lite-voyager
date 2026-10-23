# T-026: CI repairs and failure investigation

## T-026 completion: run39904711322 (2026-10-23 Asia/Manila)

Owner reports PASS. GitHub REST independently confirms run39904711322,
attempt1, completed successfully at exact candidate
b46a14eda4ba3ad2594e3a8688345da26569d4c0. All three locked installs and applicable
full-verification steps succeed:

- Ubuntu job120253881017: completed2026-10-23T05:26:08Z.
- macOS job120253881287: completed2026-10-23T05:29:48Z.
- Windows job120253881296: completed2026-10-23T05:33:46Z.

The matrix starts at05:15:07Z. The last completion is13:33:46 Asia/Manila on
2026-10-23. Raw API evidence: out/t026-ci-39904711322-metadata.json. Remote raw
logs, per-platform test totals and approved-warning records are not retrieved;
no warning-free remote claim. No new CI execution or unchanged retry occurs.

This passes the reviewed macOS default-renderer candidate under the unchanged
strict gate. It does not establish the historical mailbox/timer/shutdown cause
or actual graphics backend. Every failed gate and exact retained diagnostic
below remains historical evidence; prior pending statements are dated snapshots.

SPEC FR-012 acceptance is covered by the documented keyword/schema/alias/quoted
insertion tests, bounded parameterized metadata tests, view-local abort/disposal
and retained-results tests, real-worker native/fallback execution/source hashes,
four real CodeMirror/imported-schema host cases and scoped light/dark renderer QA.
Existing independent reviews are clear. Physical paint/OS-level scrolling and
other-platform appearance limits remain exactly as recorded in t026-native-qa.md;
no new manual or rendering observation is invented.

The unchanged executable 59a236f has literal npm run verify evidence: 989 units/
100 files, strict types/lint/build/34-file 996.36-KB VSIX, zero warnings/errors;
585.006 seconds and all 295 captured hashes unchanged. Its log/status/summary are
out/t026-renderer-probe-verify-1* and out/t026-renderer-probe-evidence-summary.json.
b46a14e changes only records after that passing executable. This closure changes
only the same six evidence/spec records; prior executable checks remain applicable.
No additional full gate or new test is run for these status-only edits.
Independent read-only closure audit confirms the actual metadata, unchanged
executable, FR-012 acceptance and separate milestone limits, with no concrete
closure or overclaim issue. Owner's unrelated four-file edits remain unstaged.

Check only T-026. The whole-milestone universal/manual QA/review gate, release/tag,
publishing and any Milestone3 work remain separate. Owner pushes closure records.
Reproduction commands remain npm run verify and npm run verify:full; Linux full
uses dbus-run-session -- xvfb-run -a npm run verify:full. No product, dependency,
workflow, workload, deadline or diagnostic-policy change follows the successful CI.

Current-turn files (6): PROGRESS.md; docs/t026-autocomplete.md;
docs/t026-ci-repair.md; specs/PLAN.md; specs/TASKS.md; specs/VALIDATION.md.

## Run39894215400: controlled macOS renderer probe (2026-10-23 Asia/Manila)

GitHub REST confirms attempt1 at exact7f0a74e159981eea2b85a3819cdac37dfd4a1769.
Windows/Ubuntu locked installs and applicable full verification succeed; macOS
locked installation succeeds but its full step fails after all tests pass.
Confirmed jobs: Ubuntu120220752091; Windows120220752116; macOS120220752234.
Metadata: out/t026-ci-39894215400-metadata.json. Supplied macOS attachment is
retained byte-for-byte as out/t026-ci-39894215400-macos.log, SHA-256
45f0c9c8d1181b51ca49407a6ed34a6f1334594577b8668c8827215072409aea.

macOS passes 972 units/14 applicable platform skips (986 total), 99 files/1 skipped,
strict types/lint/build/package and all 76 host tests. All four FR-012 hosts and
the unchanged SQLite/JSON/JSONL/CSV large-file/data/source-hash checks pass.
The four raw JSON/JSONL interval maxima are 18.00241700001061,
19.11662499999511, 18.116333999991184 and 19.40487500000745 ms. The diagnostic
trace reports untracked resources/truncation; empty callback/GC lists cannot
prove absence of work. These successes do not establish either historical cause.

Strict assembled-console checking correctly rejects two native Chromium errors
at attached-log lines1005/1006, native producer PID4462 (its role is not established):

- Native timestamp1023/032446.440759:
  [4462:1023/032446.440759:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:395] SharedImageManager::ProduceMemory: Trying to Produce a Memory representation from a non-existent mailbox.
- Native timestamp1023/032446.459144:
  [4462:1023/032446.459144:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:395] SharedImageManager::ProduceMemory: Trying to Produce a Memory representation from a non-existent mailbox.

Both appear after the second all-formats case's completion line and before the
D-5 split-view case's completion line. The case waits for real
preview DOM, cancellation/import settlement, exact-tab closure/session cleanup,
independent second import/browser DOM and source equality. Independent read-only
review finds no concrete product lifecycle defect. Session closure proves owned
helper/storage cleanup, not compositor quiescence; timestamps do not attribute
the native error to a particular view/action. Chromium's primary source logs
this message when its mailbox has no registered backing; it does not identify
who removed/missed it. The same error family occurred on Ubuntu during T-020
with --disable-gpu already present; previous graphics probes established no fix.

The host runner exits0, but the strict console guard exits1. Structured runtime
log scanning is not reached after that rejection, so no structured warning count
or warning-free full claim is made. Windows/Ubuntu remote raw warning records
are not retrieved; their metadata success does not prove the old shutdown cause.

Controlled acceptance: remove only macOS's forced --disable-gpu argument and
exercise normal VS Code default rendering with the full unchanged workload.
This permits acceleration; actual backend selection and the historical cause
remain unestablished. Preserve every Windows/Linux argument, isolation path,
signed-out fixture, exact version, sequence, budget, timer/sample, source check
and error/warning rejection. No sleeps, forced redraw, unsupported/new switches,
vendor edits, new dependency, diagnostic allowance or unchanged full retry.
Owner retains push and the actual macOS experiment. A pass validates this
candidate/configuration; it cannot alone prove a graphics repair or causal fix.

Tests precede the implementation. Missing-helper import fails first; then a
baseline-preserving helper retaining --disable-gpu fails exactly the darwin
argument assertion while Windows/Linux pass. The new launcher helper omits only
that macOS argument. A real native configuration import must exactly match its
arguments; all prior empty-profile/extension/authentication assertions stay.
Retain out/t026-renderer-config-red.log and -behavior-red.log. All 63 focused
configuration/strict-diagnostic/workflow cases across three files pass in 8.81 s;
scoped lint has empty output. Independent actual-diff review finds no concrete
defect. Evidence: out/t026-renderer-config-focused.log and -lint.log.
Reviewed executable 59a236f3d1adec203584c5a1b5279c51e8b7f3ac passes literal npm run verify:
989 units/100 files, strict host/webview/tooling types, lint, production
bundles and temporary VSIX packaging (34 files, 996.36 KB). Zero errors and zero warnings.
UTC 2026-10-23T05:00:40.920Z through 2026-10-23T05:10:25.926Z,
585.006 seconds. All 295 captured hashes match, including .vscode-test.mjs,
workflow, source/tests/tooling/specs/records and compiler/Vitest configurations.
Evidence: out/t026-renderer-probe-verify-1.log, -before.json, -status.json and
out/t026-renderer-probe-evidence-summary.json. Only record updates follow.
No new full gate or macOS host run occurs locally. Current Windows native config
import is exercised; pure argument tests cover all three platforms. Owner pushes
the final reviewed probe and runs fresh platform CI once. Full macOS results,
actual renderer/backend and native visual paint remain unobserved locally.
This passing standalone cannot clear the failed CI or establish its GPU cause.
Independent read-only final audit confirms counts, timing, hashes, package size
and focused results match retained evidence, with no concrete overclaim/status
defect. PID role, native timestamp timezone, selected backend and GPU cause stay
unestablished; owner platform CI remains pending.

Commands: npm run verify; npm run verify:full (owner's normal platform CI).
Focused tests: npm test -- test/unit/integration-config.test.ts test/unit/integration-logs.test.ts test/unit/ci-workflow.test.ts.

Primary sources:

- [VS Code CLI documentation](https://code.visualstudio.com/docs/configure/command-line) documents --disable-gpu.
- [Chromium source](https://chromium.googlesource.com/chromium/src/gpu/+/f2ce5726738369eaf8f7dadb75667225a2353a41/command_buffer/service/shared_image/shared_image_manager.cc) describes the missing-backing branch; this reference is not claimed to be the exact packaged Chromium revision.

Current-turn files (9): .vscode-test.mjs; scripts/integration-launch.mts;
test/unit/integration-config.test.ts; PROGRESS.md; docs/t026-autocomplete.md;
docs/t026-ci-repair.md; specs/PLAN.md; specs/TASKS.md; specs/VALIDATION.md.
No product, dependency or diagnostic-policy change. Keep T-026 unchecked.

## Run 39815054580: diagnostics ready, platform evidence pending (2026-10-23 Asia/Manila)

GitHub REST confirms attempt 1 at exact 25c95c7a0412a124d44458f0b4dbd7a8041fb816:
Ubuntu succeeds; Windows/macOS fail their applicable verification step; all locked
installs succeed. Both initial attachments are identical Windows logs, retained
as out/t026-ci-39815054580-windows-attachment-0.log and -1.log, SHA-256
b28df074f39f9bf1a57b3f77698242c2721223bae8777f9387f13f3326b7fe4f.
Run/job metadata: out/t026-ci-39815054580-metadata.json. The owner subsequently
supplies the macOS log inline; retained excerpts are labelled as excerpts.

Windows passes 972 units and all 76 host tests, then strict runtime-log scanning
rejects 20261022T163646/main.log:9, severity error, exact message:
`Extension host with pid 636 still exists, forcefully killing it...`.
The host reports exit code 0 at 16:44:33.519Z; the rejected probe is at
16:44:35.421Z. Installed VS Code 1.140 mainImpl.js confirms a delayed numeric-PID
probe after Electron's exit event without a creation-identity check. PID reuse
or a lifecycle anomaly is possible; neither is established by the log. An owned
native experiment holds a confirmed-exited process handle (HasExited=true,
ExitCode=0): Node kill(pid,0) correctly returns ESRCH before and after disposal.
That rules out only a simple retained-dead-handle explanation; it is not a fix.
The Windows full is not warning-free: sole approved VSCODE-HOST-001, warning,
20261022T163646/window1/renderer.log:15, exact message:
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.

macOS passes 959 units/13 platform skips and 75 host tests; one populated JSON
memory host case fails its unchanged 100-ms timer bound. The 5-GB JSONL interval
is 101.4173750000773 ms at 47418.126958000066 ms, bracketed by importing/reading.
All four FR-012 hosts pass. No 5-GB JSONL completed-memory/source-hash assertion
is claimed after that failure. The earlier JSON/JSONL sizes and both CSV sizes
pass. Independent read-only review finds no concrete product/source/timer bug.
Surrounding phase names do not identify the callback, GC or OS scheduling cause.

Diagnostic acceptance: keep original timers, every sample, full workloads,
100-ms/3000-ms bounds and all diagnostic rejection unchanged. An explicitly
enabled diagnostic wrapper must still run literal npm run verify:full and retain
its failure status. Observe Windows creation identities around shutdown without
pinning the original PID or killing any target. Record bounded process CPU,
async-callback durations and GC entries alongside the original JSON intervals;
report any trace truncation. No clock subtraction, retry, diagnostic allowance,
production mutation or speculative repair. Tests must first cover split console
records, original failure forwarding, identity-collector failures, unchanged raw
intervals, overlapping GC/callback evidence, bounded traces and disabled mode.
The implementation keeps the workflow's direct commands and 60-minute matrix
budget. CI sets LITE_VOYAGER_CI_DIAGNOSTICS=1; verify launches exactly one marked
diagnostic child running literal npm run verify:full. Its ordinary checks still
acquire/release the native awake lease. The child marker prevents recursion.
LITE_VOYAGER_INTERVAL_DIAGNOSTICS enables only the JSON test trace; ordinary local
verification stays unchanged. Windows lifecycle lines trigger an external CIM
collector: original creation UTC, then 20 snapshots spaced by 100 ms after exit.
Query times are printed; no target handle is retained and no target receives a
signal. Collector startup/failure/cleanup are bounded and fail closed.

The JSON trace retains raw intervals and process-wide CPU deltas, overlapping GC
and async callbacks of at least 1 ms. Each history is capped at 128 entries;
async resource maps are capped at 4096. Dropped/untracked entries and truncation
are explicit. Instrumentation itself can affect timing. Overlap is diagnostic
evidence, not attribution or permission to adjust the unchanged assertion.

New modules fail first when absent; the Unicode partial-line bound also fails
before its repair. Initial focused command passes 79 cases across five files:

```
npm test -- test/unit/host-interval-diagnostics.test.ts test/unit/ci-diagnostics.test.ts test/unit/ci-workflow.test.ts test/unit/integration-logs.test.ts test/unit/keep-awake.test.ts
```

This includes unchanged workflow, strict log rejection and awake-lease cases,
byte-for-byte stdout/stderr forwarding, failure/collector status preservation,
bounded parser/trace behavior, disabled mode and actual Windows owned-process
identity/exit observation. Both tooling and integration typechecks pass. A
separate headless probe of the installed VS Code 1.140 Node24.21.0 runtime records
an owned Immediate callback, preserves the raw interval and stops idempotently,
with exit0/empty stderr (out/t026-native-interval-trace*). It is not an editor,
host responsiveness or full-gate pass. Independent read-only review finds no
concrete defect in the diagnostic implementation; historical causes remain unknown.
Retained tests: out/t026-diagnostics-{red,unicode-red,workflow-red,focused-1,
focused-2,focused-3}.log. First standard gate failure and repair follow below.
No new full gate is attempted. This is a diagnostic candidate, not a repaired CI/task claim.

The first literal standalone gate on executable c021e88 fails before checks at
Node's import of ci-diagnostics.mts: constructor parameter properties require
transformation and are unsupported by native strip-only execution. This was a
diagnostic-helper defect missed by transformed Vitest imports. Retain
out/t026-ci-diagnostics-verify-1.log and -status.json (code1, 2.028 seconds,
293 unchanged hashes); it is not a passing gate. A plain-Node import regression
first reproduces the exact unsupported-syntax failure in
out/t026-diagnostics-native-loader-red.log. Use an explicit readonly field and
ordinary constructor assignment instead. All 80 focused cases/five files pass in
18.22 seconds (out/t026-diagnostics-focused-4.log), including native import with
zero module output. No diagnostic behavior or guard changes. Independent follow-up
finds no remaining concrete loader defect in the actual direct-import chain.
The revised candidate proceeds to standard verification below; no full run.

The second standard gate on 5778965 passes all three strict typechecks, then lint
rejects three require-await fixture methods and one unsafe event destructuring
in the new diagnostic test. Retain out/t026-ci-diagnostics-verify-2.log and
-status.json: code1, 84.389 seconds, 293 unchanged hashes; units/build not reached.
Return explicit resolved/rejected Promises and receive the event value as unknown;
keep every assertion/child command/lifecycle behavior. No lint disable or type
weakening. Focused lint passes with empty output; all 80 focused tests/five files
pass again in 18.60 seconds (out/t026-diagnostics-lint.log and -focused-5.log).
A fresh changed-candidate standard gate follows; no unchanged retry or full run.

Reviewed executable 649eb631ab2cf5d22b20b8880fc0abed690b2997 passes the changed-candidate literal standalone
gate: 986 units/100 files, strict host/webview/tooling types, lint,
production bundles and temporary VSIX packaging (34 files, 996.36 KB). Zero errors and zero
warnings. UTC 2026-10-23T02:54:48.191Z through 2026-10-23T03:04:31.065Z
(582.874 seconds); all 293 captured hashes match, including the workflow,
source/tests/tooling/specs/records and compiler/Vitest configurations. No tracked
file changes during the gate. Raw evidence: out/t026-ci-diagnostics-verify-3.log,
-before.json, -status.json and out/t026-ci-diagnostics-evidence-summary.json.
The earlier two failed standard gates remain failed and retained. Only record
updates follow this passing executable; no full attempt occurs. Windows/macOS
root causes remain unestablished; diagnostic acceptance is separate from repair
and T-026 remains unchecked pending causal evidence and actual-candidate CI.
Independent read-only final audit confirms these counts, timings, hashes and
package details match the retained evidence, with no concrete overclaim or
remaining material diagnostic defect. It does not establish either historical cause.

Owner handoff: push the reviewed candidate, then run the normal three-platform
workflow once on that exact commit. Return complete Windows/macOS verify logs,
including T026 shutdown identity evidence and T-026 JSON interval diagnostic
records, with the original failed guard/output if failure recurs. A diagnostic
pass does not clear or explain historical failures. Preserve the 100-ms timer
and every error rejection until causal evidence supports a reviewed repair.

Current-turn files (14): .github/workflows/ci.yml; scripts/ci-diagnostics.mts;
scripts/windows-exit-diagnostics.ps1; scripts/verify.mts;
src/test/host-interval-diagnostics.ts; src/test/json-import-memory.test.ts;
test/unit/ci-diagnostics.test.ts; test/unit/host-interval-diagnostics.test.ts;
PROGRESS.md; docs/t026-autocomplete.md; docs/t026-ci-repair.md; specs/PLAN.md;
specs/TASKS.md; specs/VALIDATION.md. No shipped product/UI/dependency change.

## Follow-up macOS fixture ordering repair

Owner run [39796846457](https://github.com/JreyForFun/lite-voyager/actions/runs/39796846457),
attempt 1 at exact fdf5ad20dcfccbdd6e7e256bb164066dead74e00, passes Windows and
Ubuntu locked installs/applicable full verification (GitHub REST confirmed).
macOS locked install/types/lint pass, then units fail one existing JSON mutation
case: 954 pass/1 fail/13 platform skips. The clean-root regression and all four
child cases pass. Build/package/host integration are not reached on macOS.
The attached macOS log is retained byte-for-byte as
out/t026-ci-39796846457-macos.log, SHA-256
789d54dd1a9183d4b8e397ad7f62f5278f488a4ec24c1d6a4b15f6522ab09c96;
confirmed run/job metadata is out/t026-ci-39796846457-metadata.json.

The nine-byte JSON fixture starts an asynchronous source write from parent IPC
progress, then expects import rejection before awaiting that write. Worker reads,
snapshot checks and completion do not await progress delivery or the write.
A controlled deferred-write diagnostic confirms import can resolve with the
original source unchanged; only releasing the write changes it afterward.
This establishes an invalid fixture ordering assumption, not a source-guard bug.
Diagnostic trace: out/t026-json-mutation-diagnostic.log. Independent read-only
source review confirms the ordering and proposed worker-local fixture barrier.

Acceptance: retain real production import, worker, relay, client and cleanup.
Inject exactly one synchronous size-changing fixture write inside an owned
disposable real-worker build, at complete reading progress (before the reader's
final snapshot) and publishing progress (before import's final snapshot).
Both engines must reject specifically for changed source, preserve the exact
externally changed bytes and leave only the source in its fixture directory.
Keep fallback-cap refusal on the ordinary loader; no sleeps, retries, deadline
increase, production/workflow/dependency change or diagnostic allowance.
The four expanded boundary cases first FAIL against uninstrumented real workers
(out/t026-json-mutation-red.log): the original valid source imports successfully.
The fixture then builds the actual production JSON worker with a test-only banner
which binds/forwards its original postMessage and writes once at the chosen
boundary. The unchanged real process/relay/client handle rejection and cleanup.
Generated worker/assets stay in a separate owned OS temporary directory; dist
and production sources are not modified. The changed bytes have a different size,
so mutation detection does not depend on filesystem timestamp precision.
All 51 focused cases/three files PASS (27.36 seconds), including four boundary
cases, the unchanged reader cases and fallback-race/cap refusal. Independent
read-only follow-up finds no concrete defect or source-safety weakening.
Reviewed executable candidate `1c53c72` passes literal `npm run verify`: all
972 units/98 files, typechecks, lint, build and unchanged 34-file/996.36-KB VSIX,
zero warnings/errors. UTC window: 2026-10-22T15:18:35.662Z through
15:32:13.824Z (818.162 seconds). Log/status: out/t026-json-mutation-verify-1.log
and -status.json.

One literal `npm run verify:full` for this changed candidate also PASSes:
972 units/76 host tests, including all four FR-012 cases and every original
SQLite/JSON/JSONL/CSV workload, exact data/source hashes and all 80 CSV pages per
size. UTC window: 2026-10-22T15:32:43.753Z through 16:25:53.499Z
(3189.746 seconds). Log/status: out/t026-json-mutation-full-1.log and -status.json.
All 282 captured hashes match before/after both gates. Final evidence updates
are documentation only; no tracked file changes occur during either gate.

The full run is **not warning-free**. Its three exact approved diagnostics all
have severity `warning` and source `20261022T234624/window1/renderer.log`:

- Line 2, `VSCODE-HOST-002`:
  `Creation of workbench contribution 'workbench.contrib.chatLanguageModelsData' took 22ms.`
- Line 3, `VSCODE-HOST-004`:
  `Creation of workbench contribution 'workbench.contrib.chatPetContext' took 21ms.`
- Line 12, `VSCODE-HOST-001`:
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.

No other warning/error is accepted. CSV 1/5-GB sampled host/helper peaks are
246624256 /250613760 bytes; paging growth is 29257728 /31547392 bytes;
maximum observer gaps are 1227.4508 /1301.8573 ms under the unchanged 3000-ms
guard. All 60 Browse/20 SQL pages per size and complete source hashes pass.
SQLite peaks are 248082432 /253964288 bytes; JSON 1/5-GB peaks are
238419968 /240119808 bytes; JSONL peaks are 231731200 /230002688 bytes.
Renderer residency remains separate; these are sampled metrics, not physical
paint/jank observations. Successful bounded-window Kernel-Power 506/507 queries
return zero events for each gate. Raw checked power, metrics and exact diagnostic
records are retained in out/t026-json-mutation-evidence-summary.json and beside
the logs. Prior scoped renderer QA remains applicable because no UI changes.

Retain the macOS failure and Windows/Ubuntu success at fdf5ad2. Fresh owner-pushed
actual-candidate Windows/macOS/Ubuntu CI remains required; T-026 stays unchecked.

Changed files for this follow-up: test/unit/json-import.test.ts, PROGRESS.md,
docs/t026-autocomplete.md, this file, specs/PLAN.md, specs/TASKS.md and
specs/VALIDATION.md. All unrelated owner edits remain excluded.

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

Changed files for the original clean-checkout repair: test/unit/sql-completion-engine.test.ts,
test/unit/sql-completion-clean-checkout.test.ts, this file, docs/t026-autocomplete.md,
PROGRESS.md, specs/PLAN.md, specs/TASKS.md and specs/VALIDATION.md. Preserve unrelated
owner edits. The owner retains pushing and remote CI.

```
npm test -- test/unit/sql-completion-clean-checkout.test.ts test/unit/sql-completion-engine.test.ts test/unit/sql-completion.test.ts
npm run verify
npm run verify:full
```
