# Lite Voyager: Validation

Status: Draft v0.1 | Applies to every task and every milestone.

**Rule:** nothing is "done" because an AI says it is. Done means there is evidence: command output you have seen, or a manual check you have performed.

**Honest limit:** validation lowers the risk of errors; it cannot prove there are none. Large-file speed, memory use, and behavior on other operating systems are only validated by actually running them.

---

## 1. Three layers of validation

### Layer 1: Automatic gate (every task, every commit)

Two commands, defined in task T-006:

| Command | Runs | When |
|---|---|---|
| `npm run verify` | typecheck (`tsc --noEmit`), lint, unit tests (Vitest), build (esbuild), and a `.vsix` package dry run | After every task, before every commit |
| `npm run verify:full` | everything in `verify`, plus integration tests in a real VS Code (`@vscode/test-electron`) | Before a phase gate, and in CI on Windows, macOS, and Linux |

Rules:
- Zero errors and zero warnings. A warning is a defect that has not been explained yet.
- **Owner-approved T-007 host exceptions:** only structured `[warning]` records
  in a dated VS Code session's `windowN/renderer.log` may match either exact
  message family below. Report every accepted record with source, line, original
  severity, rule ID and message; never call such a run warning-free. All errors,
  other warnings, altered scopes/messages and records from other log sources fail.
  - `VSCODE-HOST-001`: `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
    A signed-out test fixture deliberately has no credentials; the bundled host
    logs this during provider registration even with cloud sandboxes disabled.
  - `VSCODE-HOST-002`: `Creation of workbench contribution 'workbench.contrib.chatLanguageModelsData' took Nms.`
    `N` must be an integer duration. This is the vendor's synchronous startup
    schema contribution, not Lite Voyager work or its responsiveness measurement.
  The original manifest-creation and cloud-dictation timeout warnings remain
  failures. Console diagnostic checks, types, lint and builds retain zero
  errors/warnings. No blanket vendor-warning allowance or retry-to-green is permitted.
- Do not weaken a test, skip it, or delete it to make it pass. Fix the code, or change the spec first.
- Do not silence the type checker (`any`, `@ts-ignore`) or the linter without a written reason next to it.

T-007 CI runs the full gate on Windows, macOS, and Linux; Linux uses
`dbus-run-session -- xvfb-run -a npm run verify:full` for an isolated session bus
and virtual display. Workflow contract tests and a local YAML parse
verify configuration, not runner compatibility. To complete T-007, provide the
GitHub Actions CI run URL, tested commit SHA, and successful conclusions for all
three Full verification jobs. For failures, provide the failing step's log with
its first error or warning. Keep T-007 unchecked until that evidence is seen.
T-002 now covers both real database engines in the foundation spike. Production
Engine selection, fallback UX and its permanent force-fallback hook follow in
T-009; the milestone-specific engine gate below preserves that distinction.

T-007 evidence recorded on 2026-10-09:
[run 37884550873](https://github.com/JreyForFun/lite-voyager/actions/runs/37884550873),
commit `93b23bf1420cf10dd8b0ea82d3b4c2be0e35268d`. The user supplied the run URL;
GitHub API metadata confirms successful Ubuntu, Windows, and macOS jobs and
each applicable full-verification step. Local full verification also passed.
Only the two CI-related gate items below are checked; the milestone is open.

T-002 CI evidence recorded on 2026-10-09:
[run 37916047454](https://github.com/JreyForFun/lite-voyager/actions/runs/37916047454),
attempt 1, commit `f3085869c88262b2ffdbfddb47805f6287cdcc3a`. GitHub API metadata
confirms successful Windows, Ubuntu, and macOS Full verification jobs and each
applicable verification step. Owner manual QA confirms both engines cancel
(native 24 ms, fallback 92 ms), recover, and keep typing responsive. Independent
fresh-context review under section 6 found HIGH silent omission of committed WAL
rows in fallback and MEDIUM leaked sql.js statements on oversized column
metadata. Owner-authorized fixes now have red-first regressions; independent
follow-up review found no remaining concrete defect. Local full verification
passes with 103 unit tests, six integration tests and strict runtime logs in
VS Code 1.140.0; VS Code 1.141.0 also passes integration tests and strict logs.
The owner pushed the fixes and evidence. [Fresh run 37922970386](https://github.com/JreyForFun/lite-voyager/actions/runs/37922970386),
attempt 1, commit `0e3ec57de8254b80a2aa8bc830ea65c527e8301c`, succeeds on
2026-10-09. GitHub API metadata confirms all three Full verification jobs and
their applicable full-verification steps succeeded. T-002 and its specific
foundation checklist item are complete; all other milestone gate items retain
their previous status. No milestone gate or release tag is complete.

### Layer 2: Per-task validation (spec to test)

T-007 repair evidence (2026-10-10): final local `npm run verify:full` passes on
Windows x64 with 197 unit tests, eight integration tests in VS Code 1.140.0,
strict types/lint, builds and a 15-file VSIX that excludes the authentication
fixture. One `VSCODE-HOST-001` record is reported; no unexpected diagnostic is
accepted. Red-first tests cover missing profile initialization/fixture wiring
and the new diagnostic-policy behavior; rejection tests retain the original
warnings and cover errors, changed scopes/messages and wrong sources.
An earlier standalone `npm run verify` passed with 185 tests before the new
policy tests; final full verification repeats all those stages with 197 tests.
The owner's supplied latest macOS log passed its tests but failed on the
original manifest/dictation warnings. Old Windows annotations report a 5-second
responsiveness-test timeout. Current local tests retain the 100,000-row workload,
timer assertion and timeout, use fewer disk commits, and additionally verify
all rows and unchanged-source hashes. Fresh remote evidence is now verified:
[run 37956761308](https://github.com/JreyForFun/lite-voyager/actions/runs/37956761308),
attempt 1, commit `f3d82bb365f3886a18b950bbf61141a16b321faa`, passes on
2026-10-10. GitHub API metadata confirms successful locked installation and
all three Full verification jobs, including the applicable Linux session-bus/xvfb
step and Windows/macOS full-verification steps. This closes the T-007 repair
under the approved host policy; remote warning counts are not claimed.
Completion-documentation `npm run verify` also passes locally with 197 unit
tests, strict types/lint, builds and packaging; zero errors/warnings.

- Every acceptance criterion (Given / When / Then) becomes at least one test.
- Test names start with the requirement ID, for example `FR-002: shows NULL differently from empty string`. This lets you search for coverage.
- `npm run trace` (task T-051) lists every requirement that has no test yet, so gaps are visible rather than discovered later.
- Bug rule: when you find a bug, first write a failing test that reproduces it, then fix it. If the cause was an unclear spec, update the spec in the same commit.

### Layer 3: Manual QA (end of every milestone)

Some things automated tests cannot judge: whether scrolling feels smooth, whether an error message makes sense, whether a 2 GB file really opens fast. Use the checklists in section 4, in a real VS Code window (F5), with the fixtures from T-005.

---

## 2. Definition of Done (per task)

A task may be ticked in `TASKS.md` only when all of these are true:

- [ ] Acceptance criteria are covered by tests, and the tests fail without the code (the test is real).
- [ ] `npm run verify` passes with no errors and no warnings. You saw the output.
- [ ] Every new failure path shows a clear message to the user (no silent failures, no raw stack traces in the UI).
- [ ] No Constitution rule is violated (see the checklist in section 3).
- [ ] Spec and plan still match the behavior; changelogs updated if they changed.
- [ ] `PROGRESS.md` updated; changes committed with a message naming the task ID.

---

## 3. Constitution checklist (use in reviews)

- [ ] Source files are never modified except on explicit save (NFR-001).
- [ ] No network calls, no telemetry.
- [ ] No main-thread blocking; heavy work is in the worker; results are paged.
- [ ] SQL never built by concatenating user data; identifiers quoted.
- [ ] 64-bit integers displayed exactly.
- [ ] No silent truncation; limits are announced.
- [ ] Nothing added that the milestone does not need (stay lite).

---

## 4. Phase gates

A milestone is finished only when its gate passes. Then, and only then, tag the commit (for example `v0.1.0`) and start the next milestone in a **fresh AI chat** (see `CONTEXT.md`).

### Universal gate items (every milestone)
- [x] `npm run verify:full` is green locally and in CI on all three operating systems. *(T-052 adjusted-fixture local full gate plus run 37962951570/attempt 1/6b2d665; approved host policy applies.)*
- [x] NFR-001 test passes: a source file's hash is identical before and after browsing and querying. *(Foundation worker/query and CSV spike scope; production browse coverage follows T-016.)*
- [x] Every requirement for this milestone has at least one test (reconcile `npm run trace` against the milestone's scope; no gap in its required acceptance criteria). *(T-052 coverage regression passes; global future gaps remain reported.)*
- [x] Measured numbers (open time, peak memory) are recorded in `PLAN.md` and compared with the NFR targets. *(T-002 runtime/cancel, T-004 standalone memory/parsed preview, T-008 cache/render measurements; production targets stay open.)*
- [x] Manual QA checklist for the milestone is complete. *(Existing owner T-002/T-004/T-008 evidence reconciled below.)*
- [x] Independent review done (section 6) and its high-severity findings fixed. *(Fresh-context foundation review and post-fix checks below; no remaining concrete HIGH/MEDIUM finding.)*
- [x] No unexplained `TODO` or `FIXME` left in the code. *(Search of src, webview, scripts, test and .github on 2026-10-10 finds no markers.)*
- [x] Specs, changelogs, and `PROGRESS.md` are up to date; git tag created. *(Foundation closure records commit tagged locally v0.0.1; owner pushes.)*

### Milestone 0 (foundation)
Milestone 0 validates the explicit spike criteria, not completed production
features. Its linked requirement IDs are FR-004, FR-015, FR-016 and NFR-001
through NFR-005 plus NFR-009. The foundation coverage regression checks those
links against actual unit/integration test declarations. T-008 and tooling
criteria also have task-ID tests and the recorded owner QA. A matching test
name is an index, not evidence of full requirement completion: review the real
assertions and passing output. The global `npm run trace` must continue reporting
unimplemented later requirements; do not hide gaps, rename unrelated tests, or
implement future features to make the global list empty. Production performance,
fallback UX, custom editors, accessibility and logging remain their later tasks.

- [x] CI is green on three operating systems. *(Run 37962951570/attempt 1 verifies adjusted-fixture candidate 6b2d665, including all applicable full-verification steps.)*
- [x] Spike results (T-002, T-004, T-008) are written into `PLAN.md`. *(Measurement sections and T-052 feasibility decision.)*
- [x] T-002 proves worker open/query/cancel/reopen inside a killable helper, confirms helper exit within 1,000 ms after SQL execution begins, and verifies real sql.js fallback when the built-in is unavailable. Local verification, owner manual QA, and fresh three-platform CI pass (run/SHA above). The production `Engine` interface, fallback banner/large-file prompt, and permanent force-fallback hook follow in T-009 (Milestone 1).

#### T-052 foundation evidence reconciliation (2026-10-10)

The owner authorized necessary gate decisions, repairs and fixture edits and
retains responsibility for pushing. T-052 is the single closure task; T-009 is
not started. D-2 is accepted by delegated judgment and R-1 retains its documented
mitigation. No dependencies or committed fixture data changed.

Acceptance-to-test evidence:
- T-002 source preservation: `test/unit/sqlite-spike.test.ts` hashes disposable
  source copies after SELECT and refused writes on both engines. WAL/source
  hashes and fallback rejection are also tested in `src/test/sqlite-spike.test.ts`.
- T-002 runtime/cancellation/security: real native/fallback worker tests prove
  exact values, trusted_schema off, no extension loading, helper exit within
  1,000 ms, reopening and full serialized-page bounds. Actual cancellation tests
  now start with FR-015; checkpointed-WAL rejection starts with FR-016. Assertions
  and timeouts are retained, and other NFR-001/NFR-002/NFR-005 tests remain.
- T-004: `test/unit/csv-import-spike.test.ts` covers streaming text fidelity,
  malformed input, source hashes, row/value verification, caller responsiveness,
  cancellation/output cleanup and honest NFR-003/NFR-004 measurement scopes.
  PLAN records the owner-run 10-million-row benchmark and independent comparison.
- T-008: protocol, grid-window, virtual-grid and webview-spike unit tests cover
  bounded paging/cache/rendering, full-range navigation, exact/literal text,
  stale replies, CSP, visible failures and disposal. Real-host webview tests
  initialize/close/reopen. PLAN records owner typing, scrolling, navigation,
  resizing, themes and editor-choice checks, plus T-002/T-004 owner checks.
- Foundation tooling: fixture/generator/inventory, compiler/protocol, check-runner,
  CI/config/log-policy, spec-tools and dependency-audit tests cover the other
  completed tasks. `foundation-gate.test.ts` cross-checks all nine linked spike
  IDs against real test declarations; it initially failed on FR-015/FR-016.
  Global trace now reports 22 later requirement naming gaps. A matching spike
  name does not establish completed production FR-004/FR-015/FR-016 behavior.

Independent review: a fresh-context reviewer computed and examined the actual
`04c7bd7..e02f38f` foundation diff and current repair diff, using Constitution
and linked acceptance criteria rather than the author's summary. It reviewed
worker/helper lifecycle, source safety/fallback, CSV import, bounded webview/
protocol/security, fixtures, packaging and diagnostic policy. It found:
- MEDIUM, Constitution 6 / T-004: Papa Parse silently drops whitespace after a
  closing quote. Six new real-import cases reproduced acceptance/data loss before
  the fix. The streaming validator now rejects non-delimiter text after closing
  quotes, including across chunks; seven rejection cases verify source preservation
  and partial-output cleanup, and two valid whitespace/escaped-quote cases pass.
- LOW, NFR-005 recovery: a worker failure message can precede helper exit, so
  immediate reopening fails. The strengthened existing test failed before the
  fix. Failed sessions now terminate and confirm exit before replacement opening;
  the regression also checks the old PID is dead. The current command's explicit
  finally-close flow already allowed recovery, so this was not a user-blocking
  production failure.

Final local `npm run verify:full` passes on Windows x64 / VS Code 1.140.0:
207 unit tests, eight real-host integration tests, strict types/lint/build and
15-file VSIX packaging (468.83 KB). Native/fallback executing-query cancellation
takes 30 ms / 28 ms, with helper exit, reopening and source hashes verified.
One VSCODE-HOST-001 signed-out renderer warning is explicitly reported with
source, line, severity, rule and message. No unexpected warning/error is accepted;
this run is not warning-free. Fresh three-platform CI for the committed T-052
candidate is recorded below; the earlier f3d82bb run does not test these repairs.

The reviewer independently reran the 35 SQLite cases and the original CSV
reproductions after repairs; they pass/reject correctly, with no remaining
concrete HIGH/MEDIUM defect. Earlier focused review ran 135 tests and failed
only the newly strengthened crash regression before repair. Review lowers
risk; it does not prove absence of defects. Existing subjective owner QA is reused honestly;
production multi-GB UI performance, accessibility, dual-macOS-architecture and
built-in-extension coexistence remain later validation.

#### T-052 candidate CI and local fixture timing follow-up (2026-10-10)

The owner supplied [run 37961300752](https://github.com/JreyForFun/lite-voyager/actions/runs/37961300752).
Public GitHub API metadata verifies attempt 1 at exact commit
`d18e5e6c4f9045524bd2ec05bb7dcebea2dbb155`, completed successfully
2026-10-09 16:46:17 UTC (2026-10-10 in Asia/Manila). Ubuntu job 113924516849,
macOS 113924517083 and Windows 113924517213 all succeed, including locked
installation and each applicable platform's full-verification step. Only
inapplicable alternative platform steps are skipped. Remote warning counts
are not claimed; the approved diagnostic policy applies.

Completion-documentation `npm run verify` then failed locally: the existing
FR-004 quoted-header case took 5,045 ms and exceeded its original 5,000 ms
timeout. Its 70 KB header was read in 7-byte chunks (about 10,000 reads).
Retain the entire header, embedded LF, CRLF records, exact text/int64 assertion
and timeout; change this fixture to 4,096-byte reads so the header still spans
18 chunks, and assert that input bytes exceed the chunk size. Other quote and
UTF-8 boundary cases retain tiny/one-byte chunks. This preserves the actual
header-detection acceptance without tying it to thousands of tiny filesystem
reads. The focused adjusted case passes. Independent read-only follow-up review
confirms the original acceptance/assertions/time bound remain covered and finds
no concrete concern. No parser/helper/dependency or committed
data asset changes are made in this follow-up. Because the executable test
fixture changed, fresh full local and three-platform candidate evidence were
required before closure; that evidence is now verified below.
Final adjusted-fixture `npm run verify:full` now passes locally: 207 unit tests,
eight integration tests in Windows x64 / VS Code 1.140.0, strict checks/build and
a 15-file / 468.91 KB VSIX. Native/fallback cancellation is 28 ms / 37 ms, with
helper exit/reopening and source hashes verified. One approved VSCODE-HOST-001
record is explicitly reported from `20261010T005558/window1/renderer.log`, line
10, severity warning; no unexpected warning/error is accepted. This run is not
warning-free. The adjusted fixture's fresh three-platform CI is verified below.

#### T-052 foundation gate completion (2026-10-10)

The owner pushed the adjusted fixture and supplied
[run 37962951570](https://github.com/JreyForFun/lite-voyager/actions/runs/37962951570).
Public GitHub API metadata verifies attempt 1 at exact commit
`6b2d665f39aa5c544a74c1467b838acf6b45ac8a`, completed successfully
2026-10-09 17:00:09 UTC (2026-10-10 in Asia/Manila). All three jobs succeed:
Ubuntu 113930114003, macOS 113930114323 and Windows 113930114353. Locked
installation and every applicable full-verification step succeed; only each
job's inapplicable alternative platform step is skipped. Remote host-warning
counts are not claimed; the approved fail-closed diagnostic policy applies.

All foundation acceptance criteria are met by the existing local full gate,
scoped coverage/source safety, measurements, owner manual QA, independently
reviewed fixes and this fresh three-platform CI. Only closure documentation
changes after the tested candidate. T-052 and Milestone 0 are complete; the
closure records commit is tagged locally `v0.0.1`, which the owner pushes.
This is a foundation checkpoint; production requirements stay open and T-009
starts in a fresh chat.
Completion-record `npm run verify` also passes with 207 unit tests, strict
types/lint/build and packaging; zero errors/warnings.

### Milestone 1 manual QA (read-only SQLite)
#### T-009 local evidence (2026-10-10)

- Final closure `npm run verify` passes with 255 unit tests, strict types/lint/build
  and a 17-file / 476.95 KB VSIX; zero errors and zero warnings.

- Owner authorized full implementation, best-judgment clarifications and
  disposable fixture edits; only T-009 is implemented.
- `test/unit/engine.test.ts` and `fallback-ui.test.ts` contain 46 Engine/UI tests;
  `integration-environment.test.ts` adds two launcher regression cases:
  common Engine/backend operations, real runtime absence and force selection,
  accessible banner/prompt text, strict decimal consent boundary, decline,
  missing consent, actual approved load above 200 MB, prompt close/cancel,
  snapshot changes, WAL/journal rejection, source hashes/read-only files,
  exact int64/NULL/BLOB values, hostile identifiers/parameters, result paging,
  1-MB cells/1,000 columns, explicit 4-MiB payload boundary, cancellation,
  repeated cancellation, explicit close overriding recovery, helper crash,
  two simultaneous Engines, invalid/empty files, query recovery, and rejection
  of preparation-time EXPLAIN PRAGMA changes while retaining read-query plans.
- Initial behavior scaffolding produced 27 failing task tests. Red-first
  regressions subsequently caught valid `sqliteX` table omission and the
  concurrent-cancel lifecycle defect; both repairs pass on both backends.
- A final direct SQLite diagnostic found that EXPLAIN PRAGMA can change safety
  flags during preparation. Two failing real-backend regressions preceded the
  repair; only SELECT/WITH may follow EXPLAIN or EXPLAIN QUERY PLAN. The VS Code
  host query tests also assert rejection; final gates include this repair.
- `src/test/engine.test.ts` adds four real VS Code integration tests: selected
  production backend/off-thread querying/exact integers, rendered mode banner,
  script-free panel and confirmed helper exit on panel disposal, for both engines.
- Final full-check evidence passes: 255 unit / 12 integration tests,
  strict types/lint/build, 17-file / 476.89 KB VSIX, Windows x64 / VS Code 1.140.0.
  The packaged production helpers and local sql.js assets are present.
  The session was interrupted after the host tests; saved renderer logs contain
  all 12 passing tests and `12 passing`. Re-running `checkIntegrationLogs` on
  that profile completes successfully (exit 0), recovering the final strict step.
- Exactly one accepted host diagnostic: source
  `20261010T020007/window1/renderer.log`, line 10, severity `warning`,
  `VSCODE-HOST-001`: `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
  No unexpected warning/error; this full run is not warning-free.
- The earlier pre-cancellation-repair full run also passed (247 unit / 12
  integration tests). Its one accepted record was source
  `20261010T014129/window1/renderer.log`, line 10, severity `warning`,
  `VSCODE-HOST-001`: `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
  That preliminary run was also not warning-free.
- The pre-EXPLAIN-repair full run passed 251 unit / 12 integration tests with one
  accepted source `20261010T014555/window1/renderer.log:10`, severity `warning`,
  `VSCODE-HOST-001`: `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
  It was not warning-free and does not cover the subsequent guard/launcher repair.
- Independent review identified one MEDIUM cancellation race and one LOW stale
  README statement; both are repaired. Focused review confirms the lifecycle fix.
- The post-EXPLAIN-repair full run passes 253 unit / 12 integration tests but
  **fails** the unchanged runtime-log gate: source
  `20261010T015401/window1/renderer.log:2`, severity `warning`,
  `Creation of workbench contribution 'chat.usagesTool' took 21ms.` is not an
  approved family. Its accepted `VSCODE-HOST-001` record is at line 11 of that
  same file, severity `warning`,
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
  Neither warning is suppressed. Investigation found the test host inherited
  `VSCODE_NODE_COMPILE_CACHE_ROOT` from the active 1.141 installation, pointing
  at an unavailable cache while 1.140 ships its own cache. Two red-first tests
  now verify removal of the parent's bootstrap/cache paths from the child only.
  The changed-environment final run reports its own packaged cache enabled,
  passes the host tests/strict logs, and has no unexpected warning/error.
  This does not prove host timing warnings cannot recur; every such record
  still fails unless it matches one of the two exact owner-approved families.
- No new dependency or committed fixture asset. Full FR-001 editor browsing,
  multi-GB extension memory/visible-row performance, macOS architectures and
  milestone manual QA remain open. The first T-009 CI evidence and its repair
  are recorded below; fresh three-platform evidence for the repair remains open.

#### T-009 CI reporter follow-up (2026-10-10)

The owner supplied [run 38015468652](https://github.com/JreyForFun/lite-voyager/actions/runs/38015468652).
Public GitHub API metadata verifies attempt 1 at commit
`4d0d4358303de5a223c5f379b146cc515a813191`, with successful macOS
job 114104635908 and Windows job 114104636063. Ubuntu job 114104636010
fails its full-verification step. The pasted Ubuntu output passes all 255 unit
tests, then the console gate mistakes "error" in two slow successful test names
for a diagnostic. The Ubuntu build/package/integration stages are not reached;
this run does not establish three-platform success or remote warning counts.

Ten real-Vitest subprocess regressions cover slow successful prose, stdout and
stderr warnings/errors in CI and agent environments, and failed assertions.
Before the fix, the slow successful test reproduces the false error rejection;
four agent-environment diagnostic cases also fail because the automatically
selected minimal reporter hides passing console output. The configuration now
explicitly selects the dot reporter. All 18 check-runner tests pass, including
the ten new cases. No existing test names, diagnostic scanner, runtime-log exception,
dependency or committed fixture is changed, and no output filter is added.
Local `npm run verify` passes with 265 unit tests, strict types/lint/build and
a 17-file / 477.07 KB VSIX; zero errors and zero warnings. Local
`npm run verify:full` also completes successfully (exit 0) with all 265 unit
and 12 integration tests, that same package, and strict runtime logs in
Windows x64 / VS Code 1.140.0. Its sole accepted record is source
`20261010T101619/window1/renderer.log`, line 10, original severity `warning`,
`VSCODE-HOST-001`: `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
No unexpected warning/error is accepted; this full run is not warning-free.
Fresh three-platform CI for the repair still requires the owner's push and run
evidence. T-009 remains locally complete; no later task or milestone is closed.

#### T-009 colored-console regression repair (2026-10-10)

The owner supplied [run 38016821325](https://github.com/JreyForFun/lite-voyager/actions/runs/38016821325).
Public GitHub API metadata verifies attempt 1 at commit
`ece4194f4b54dc507d8dc73754f9984ae9d2006b`. All full-verification jobs fail:
Windows 114108825644, macOS 114108825791 and Ubuntu 114108825819.
Each pasted log reports the same four non-agent diagnostic regressions failing
with `promise resolved "undefined" instead of rejecting`; 261 other unit tests
pass. No job reaches the build/package/integration stages. The earlier local
265-test evidence above remains historical and did not prove CI compatibility.

The missed environment difference is terminal color: local `NO_COLOR=1` hid
the scanner defect. Vitest writes a terminal reset immediately before a console
message in colored mode; that control sequence breaks the severity regex's
prefix boundary. Tests now explicitly cover color on/off for agent/non-agent
subprocesses. Before the code fix, all eight forced-color diagnostic cases fail;
both new segmented-formatting cases also fail. The scanner now applies Node's
`stripVTControlCharacters` to the fully assembled scan text. It keeps the
original captured/echoed output, both diagnostic patterns, nonzero-exit rejection
and the two exact renderer-log exceptions intact. No dependency is added.
All 28 focused check-runner tests pass, including 18 reporter cases and two
segmented-formatting cases. Independent review of this repair finds no bugs.
Local verification and an additional full probe with injected CI/color settings
are recorded below; fresh three-platform CI remains pending owner push.
T-009 is reopened for this failed CI follow-up; later tasks stay open.

The normal `npm run verify` passes with 275 unit tests, strict types/lint/build
and a 17-file / 477.16 KB VSIX; zero errors and zero warnings, Node 26.5.0.
An additional full probe explicitly sets `CI=true`, `GITHUB_ACTIONS=true`,
`FORCE_COLOR=1`, `TERM=xterm` and removes the parent agent/no-color flags.
Its colored unit stage passes all 275 tests and build/package/compilation pass;
all 12 host tests also pass. **The full probe fails** its console gate on
`Unable to retrieve mac address (unexpected format)`. A separate strict-log
audit confirms seven errors and one unapproved warning; none is accepted:
- `20261010T103933/main.log:2`, error: `Error: Unable to retrieve mac address (unexpected format)`.
- `20261010T103933/network-shared.log:1`, error: `#1: https://main.vscode-cdn.net/extensions/marketplace.json - error GET net::ERR_INTERNET_DISCONNECTED`.
- `20261010T103933/window1/network.log:1`, error: `#1: https://main.vscode-cdn.net/extensions/chat.json - error GET Offline`.
- `20261010T103933/window1/network.log:2`, error: `#2: https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery - error POST Offline`.
- `20261010T103933/window1/network.log:3`, error: `#3: https://main.vscode-cdn.net/core/stable.json - error GET Offline`.
- `20261010T103933/window1/renderer.log:3`, warning: `[LM] Failed to request chat control data Offline`.
- `20261010T103933/window1/renderer.log:9` and `:28`, error: `Offline: Offline`.
The audit also identifies one matching approved-family record: source
`20261010T103933/window1/renderer.log`, line 24, original severity `warning`,
`VSCODE-HOST-001`: `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
This probe is not green or warning-free and does not establish remote host
compatibility. No host setting, exception or diagnostic filter is changed to
clear it. The expanded unit fixtures always exercise both terminal modes.

The canonical `npm run verify:full` in the normal local environment completes
successfully (exit 0): all 275 unit and 12 integration tests, strict types/lint,
build/package/compilation and runtime logs, Windows x64 / VS Code 1.140.0,
Node 26.5.0 for the verifier and a 17-file / 477.16 KB VSIX. It accepts only
source `20261010T104857/window1/renderer.log`, line 10, original severity
`warning`, `VSCODE-HOST-001`: `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
No unexpected warning/error is accepted; this successful full run is not
warning-free. It does not erase the failed injected-environment probe or prove
remote platform compatibility by itself. No host/harness settings are changed.
Fresh three-platform evidence for closure is recorded below; the Engine
implementation's existing coverage remains intact.

#### T-009 completion (2026-10-10)

The owner supplied green [run 38018867617](https://github.com/JreyForFun/lite-voyager/actions/runs/38018867617).
Public GitHub API metadata independently confirms attempt 1 on `main` at
`7114b629eaeaa2fe3ce413ccf3bb5fa93f9b40c6`, completed successfully at
2026-10-10 03:00:10 UTC. Windows job 114115196917, macOS job 114115196990
and Ubuntu job 114115197067 each pass locked dependency installation and
their applicable full-verification step. Ubuntu uses the isolated session bus
and virtual display; the other platforms use the Windows/macOS step.
Inapplicable platform steps are skipped as designed.

This verifies the repaired candidate on all three CI platforms. Metadata does
not enumerate host diagnostic records; remote warning counts are not claimed.
The strict rejection policy and its two exact approved warning families remain
unchanged. Earlier failed runs and the failed injected-environment probe above
remain failures and are not erased by this evidence.

T-009's Engine interface, fallback notice, large-file consent and force-fallback
hook acceptance are covered by the recorded tests and reviewed implementation,
canonical local gates and this fresh CI. Only T-009 is checked. Completion
records change documentation only; full FR-001 editor browsing, production
performance and the whole-milestone manual QA below remain open.

Completion-record `npm run verify` passes (exit 0): all 275 unit tests in 20
files, strict host/webview/tooling types, lint, production builds and a 17-file /
477.23 KB VSIX. This local gate has zero errors and zero warnings.

**T-010 custom-editor implementation (2026-10-10):** owner approved the explicit
FR-001 editor opening/validation/fallback/lifecycle scope before coding. Full
table/view browsing and NFR-004 first-row performance remain later tasks.

- `test/unit/sqlite-editor.test.ts`: 11 FR-001 tests cover manifest association,
  one Engine per document, mode-before-consent, approval/decline, unsupported
  resources, visible opening failures, late replies, pre-open cancellation,
  cleanup failures and confirmed cleanup before opening completion.
- `test/unit/sqlite-editor-ui.test.ts`: two FR-001 tests cover escaped untrusted
  names/errors, script-free restrictive CSP and the persistent accessible banner.
- `test/unit/sqlite-editor-provider.test.ts`: nine FR-001 tests exercise the
  production provider with typed VS Code/Engine mocks: modal approval/dismissal,
  progress cancellation, virtual/untitled errors, idempotent disposal, close
  during a pending prompt, already-cancelled opening and extension shutdown.
- `src/test/sqlite-editor.test.ts`: five real-host FR-001 tests cover default
  binary tabs for all four extensions under both engines, invalid/zero-byte
  inputs and valid empty databases, unchanged source hashes, read-only files,
  awkward Unicode paths, helper exit, recovery and explicit Open With for a
  valid database with another extension. Closing/reopening creates fresh helpers.
- Existing Engine tests retain real fallback loading/decline, the exact decimal
  threshold, snapshot/WAL rejection, bounded pages and source-safety checks.

Tests were written before implementation; initial suites failed on missing
modules. Two later failing regressions reproduced repeated disposal removing a
replacement document and opening completion preceding cancellation cleanup.
Both are repaired without weakening assertions. Sandbox spawn EPERM prevented
the first test launch; authorized normal-process runs executed the tests.
Intermediate lint/typecheck failures in the test mocks were corrected; no rule
or check was disabled. No dependency or committed fixture change was needed.

Standalone host tests pass (17); the initial full candidate passes 296 unit/17
host tests. Final repaired `npm run verify:full` passes (exit 0): 297 unit tests
in 23 files, 17 integration tests, strict types/lint/builds and a 17-file /
479.70 KB VSIX, Windows x64 / VS Code 1.140.0 / Node 24.21.0 extension host;
development Node 26.5.0. Each host run accepts only the following renderer
record, original severity warning, rule `VSCODE-HOST-001`, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`:

- Standalone: `20261010T115315/window1/renderer.log:10`.
- Initial full candidate: `20261010T120017/window1/renderer.log:10`.
- Final repaired full candidate: `20261010T120259/window1/renderer.log:10`.

No other diagnostic was accepted; these host runs are not warning-free.

Completion-record `npm run verify` passes (exit 0): 297 unit tests, strict
host/webview/tooling types, lint, production builds and a 17-file / 479.75 KB
VSIX. This gate has zero errors and zero warnings.

Owner F5 checks (README T-010 report), pushing and fresh three-platform CI remain
pending. T-010 stays unchecked until owner QA is confirmed. Whole-milestone
large-file/performance/accessibility/manual validation remains open.

**T-010 Reopen Editor With repair (2026-10-10):** owner reports VS Code
1.141.0 and PASS for the four default SQLite extensions, but Lite Voyager is
absent from the picker for another extension. The earlier host test called
`vscode.openWith` with an explicit view type; it bypassed picker eligibility.

Before changing the manifest, focused session tests fail on two registration
assertions (10 pass / two fail). One is the new picker regression; the other
preserves the existing four-default contract using the specified registration.
After repair, all 23 task unit tests pass. No assertions were skipped or weakened.
The optional `**/*` selector makes other filenames eligible; contributed
`workbench.editorAssociations` defaults retain automatic SQLite opening.
The extension does not write user settings. Two new real-host tests confirm
CSV keeps its text editor and an explicit user association overrides SQLite
defaults. They use the existing disposable profile and restore their settings.
Existing real-host four-extension, both-engine and source-hash tests remain.

Repair `npm run verify:full` passes (exit 0): 298 unit tests, 19 integration
tests, strict types/lint/builds and 17-file / 480.04 KB VSIX on Windows x64 /
VS Code 1.140.0. The sole accepted diagnostic is source
`20261010T130219/window1/renderer.log`, line 10, original severity `warning`,
rule `VSCODE-HOST-001`, message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
No unexpected diagnostic is accepted; this full run is not warning-free.

Compatibility `npm run test:integration` with
`LITE_VOYAGER_TEST_VSCODE_VERSION=1.141.0` also passes (exit 0, 19 tests).
Its sole accepted diagnostic is source
`20261010T130300/window1/renderer.log`, line 10, original severity `warning`,
rule `VSCODE-HOST-001`, message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
No other diagnostic is accepted; this compatibility run is not warning-free.
Final standalone `npm run verify` passes (exit 0): 298 unit tests, strict
host/webview/tooling types, lint, builds and a 17-file / 480.04 KB VSIX.
This standalone gate has zero errors and zero warnings.
Owner now confirms the other-extension Reopen Editor With check PASS after
repair 9ea86eb. Subsequent QA reports VS Code 1.141 and PASS for defaults,
picker, invalid/zero-byte errors, valid empty database, close/reopen,
responsiveness, light/dark themes and exactly 200 MB without a prompt.
Quoted opened-state text confirms the memory-limited notice persists after
loading, supporting fallback-notice PASS. Proceed opens the larger fixture.
Escape reportedly also shows opened; it is unresolved whether a fresh consent
dialog appeared after closing/reopening the tab. Do not mark dismissal PASS
or diagnose a code defect without that reproduction. Explicit Cancel was not
reported. Cancel/close during opening is too quick for manual observation;
existing automated cancellation/lifecycle tests do not establish manual PASS.
T-010 stays unchecked. User-created fixture copies and launch settings are preserved.
QA follow-up reruns `npm test -- test/unit/sqlite-editor-provider.test.ts
test/unit/sqlite-editor.test.ts test/unit/engine.test.ts`: all 64 tests pass
(exit 0), including refusal/approval, pending consent closure and late replies.
This checks extension/Engine behavior with mocked dialog results; it does not
reproduce the owner's actual Escape key interaction. No executable code changed.

**T-010 fresh-dialog Escape follow-up (2026-10-10):** owner subsequently
confirms the tab was closed, reopened, and a fresh Proceed/Cancel warning
appeared before Escape. This confirms failed manual dismissal acceptance;
it is no longer treated as potentially reopening an already-open tab.
The source approved only a string Proceed result and relied on VS Code's
implicit Cancel. Official API docs and local types support an explicit
`MessageItem.isCloseAffordance` for Escape. The exact native-dialog failure
has not been reproduced here: native desktop control is unavailable.

Before changing the provider, the expanded suite fails five tests (six pass):
four consent-action cases reject the missing explicit Cancel contract, and the
late-approval case requires the actual supplied Proceed action. This is a
red-first guard for explicit routing, not a reproduction of the desktop key
event. After repair, 23 provider/session tests pass. Cancel and Escape-route
results plus undefined dismissal yield declined consent, no opened message
and helper cleanup; Proceed still opens, and closing during pending consent
rejects late approval. Existing real Engine consent tests remain intact.
Actual desktop Escape/Cancel confirmation and fresh CI remain pending.
Consent-candidate `npm run verify:full` passes (exit 0): 300 unit tests,
19 integration tests, strict types/lint/builds and a 17-file / 480.33 KB VSIX
on Windows x64 / VS Code 1.140.0 / bundled Node 24.21.0.
Its sole accepted record is source `20261010T133634/window1/renderer.log`,
line 10, original severity `warning`, rule `VSCODE-HOST-001`, message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
No unexpected diagnostic is accepted; this full run is not warning-free.

Consent-candidate compatibility `npm run test:integration` with
`LITE_VOYAGER_TEST_VSCODE_VERSION=1.141.0` passes (exit 0, 19 tests).
Its sole accepted record is source `20261010T133731/window1/renderer.log`,
line 10, original severity `warning`, rule `VSCODE-HOST-001`, message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
No other diagnostic is accepted; this compatibility run is not warning-free.
Final consent-candidate `npm run verify` passes (exit 0): 300 unit tests,
strict host/webview/tooling types, lint, builds and a 17-file / 480.33 KB VSIX.
This standalone gate has zero errors and zero warnings. Actual desktop
Escape/Cancel retesting remains required despite the passing automated gates.

**T-010 Escape retest (2026-10-10):** after candidate fd9bd13, the fresh
isolated fallback development host opens the 200,000,001-byte fixture. The
owner supplies its result after Escape:
`Unable to open: Memory-limited mode: the file was not loaded because consent was declined.`
The memory-limited notice remains visible, without the earlier opened status.
This confirms manual Escape PASS and resolves that observed failure. Explicit
Cancel and Proceed on this build remain to confirm; T-010 stays unchecked.
No executable change or new test run accompanies this evidence-only update.

**T-010 completion QA (2026-10-10):** owner confirms Cancel PASS and Proceed
PASS on repaired fd9bd13 after the Escape result above. Observable editor,
header/error/empty-file, reopening/responsiveness/theme, fallback-notice and
decimal-threshold/consent checks now pass on VS Code 1.141.0, Windows x64.
Opening cancellation/closure remains too quick for manual observation; do not
label it manual PASS. Its task acceptance has automated evidence: provider
progress cancellation and panel closure reject late replies/approval, session
tests await helper cleanup, and real Engine pending-consent closure settles
opening without loading or waiting for late approval. Existing source-hash
and real-helper exit/reopen tests remain passing. No test/check is skipped.

Under the owner's delegated judgment, this satisfies T-010's scoped task
acceptance with both automated and owner evidence. Whole-milestone manual QA,
table/view browsing, first-row/multi-GB performance and fresh three-platform
CI remain open; no milestone completion or release tag is claimed. Remove
the temporary fallback launch setting used by the QA guide to restore normal
runtime detection on subsequent F5 launches. Completion changes are records
and temporary QA-setting cleanup only; final standalone verification precedes
the T-010 completion commit.

Completion-record `npm run verify` passes (exit 0): all 300 unit tests,
strict host/webview/tooling types, lint, builds and a 17-file / 480.32 KB VSIX.
This final standalone gate has zero errors and zero warnings. Only T-010 is
checked in its completion commit; prior full/compatibility host warnings stay
explicitly recorded above, and new remote CI remains pending the owner's push.

**T-010 CI lifecycle follow-up (2026-10-10):**
[run 38029094981](https://github.com/JreyForFun/lite-voyager/actions/runs/38029094981),
attempt 1 at `7981bf2ce23e66695379606ec28f37d51f92a972`, fails on macOS;
Windows and Ubuntu full-verification jobs pass. The supplied macOS log passes
all 300 unit / 19 integration tests but the runtime gate correctly rejects an
error in `20261010T055556/main.log:8`: a blocked SQLite editor webview request.
This is not an approved warning. Reopen T-010 until repaired-candidate CI passes.

Original rejected record from the supplied log:
```text
20261010T055556/main.log:8: 2026-10-10 05:56:06.109 [error] Blocked vscode-webview request vscode-webview://07hsas9arjnn012qt486b8124bvn42nvn6gng51995aioc2rqvd6/index.html?id=da248b05-2ae4-4a3f-8ac8-68b8a2cd11ff&parentId=1&origin=a98e0787-99e0-4b01-9696-5467c7be959d&swVersion=6&extensionId=jreyinnovarev.lite-voyager&platform=electron&vscode-resource-base-authority=vscode-resource.vscode-cdn.net&parentOrigin=vscode-file%3A%2F%2Fvscode-app
```
The failed run also accepted one original diagnostic: source
`20261010T055556/window1/renderer.log`, line 15, severity `warning`, rule
`VSCODE-HOST-001`, message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
That exception does not excuse the error or make this run warning-free.

Lifecycle regression acceptance: given a normally opened script-free SQLite
panel, when an integration test closes it, then it first asserts successful
webview transport delivery and still awaits confirmed database-helper exit.
Missing panels or failed delivery must fail the test. This checks VS Code's
outer frame initialization, not DOM paint or visible-row performance. It must
not introduce sleeps, retries, scripts, or diagnostic exceptions. Early user
cancellation/disposal and late-reply production tests remain unchanged.

The pre-repair close helper immediately issued close after backend completion.
Four new regressions fail before repair and pass afterward: wait for delivery
before closing, keep waiting for helper exit, reject failed delivery/missing
panels, and accept the typed no-op probe. Existing assertions and timeouts stay.
The first candidate full gate stopped on two new fixture `require-await` lint
errors; replacing unnecessary async arrows fixes them without rule disables.

The cause is a lifecycle hypothesis pending macOS confirmation, not a proven
platform diagnosis. VS Code 1.140.0 queues transport sends until `webview-ready`
([WebviewElement source](https://github.com/microsoft/vscode/blob/1.140.0/src/vs/workbench/contrib/webview/browser/webviewElement.ts));
its main process rejects webview index requests when the requesting frame is
missing/destroyed or outside a live main window
([app source](https://github.com/microsoft/vscode/blob/1.140.0/src/vs/code/electron-main/app.ts)).
Awaiting successful public `postMessage` delivery prevents normal host tests
from destroying an initializing outer frame. No production close action is
delayed and no app scripts are enabled.

Repaired candidate `npm run verify:full` passes locally (exit 0): strict types,
lint, all 304 unit / 19 real VS Code integration tests, builds and a 17-file /
480.52 KB VSIX. Host: Windows x64, VS Code 1.140.0, bundled Node 24.21.0;
development Node 26.5.0. The new readiness assertions pass across native and
fallback valid/error/empty/reopen cases; source hashes/helper exits still pass.
One original diagnostic is accepted: source
`20261010T140740/window1/renderer.log`, line 10, severity `warning`, rule
`VSCODE-HOST-001`, message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
There are no unexpected diagnostics; this run is not warning-free. Preserve
earlier owner QA, including the manually unobserved early-cancel case. T-010
remains unchecked pending fresh repaired-candidate Windows/macOS/Ubuntu CI.

Final standalone `npm run verify` passes (exit 0): strict host/webview/tooling
types, lint, all 304 unit tests, production builds and a 17-file / 480.52 KB
VSIX; zero errors and zero warnings. The lifecycle test additionally drains
pending promise continuations before asserting that closure still waits for
helper exit. No new host implementation change follows the passing full run.

**T-010 CI completion (2026-10-10):** owner supplies GREEN
[run 38030277300](https://github.com/JreyForFun/lite-voyager/actions/runs/38030277300),
attempt 1 at `55e5da0fe62d7468f76c213ce3b34fec96849b24`. Public GitHub API
metadata independently confirms the completed/successful run and each job:

- [macOS](https://github.com/JreyForFun/lite-voyager/actions/runs/38030277300/job/114149566616): locked installation and `Verify on Windows and macOS` succeed.
- [Windows](https://github.com/JreyForFun/lite-voyager/actions/runs/38030277300/job/114149566864): locked installation and `Verify on Windows and macOS` succeed.
- [Ubuntu](https://github.com/JreyForFun/lite-voyager/actions/runs/38030277300/job/114149566972): locked installation and `Verify with session bus and virtual display on Linux` succeed.

Each applicable workflow verification step runs `npm run verify:full` with
the existing fail-closed diagnostic policy. The alternative platform-specific
step is skipped by its OS condition, not a skipped test. The public log archive
endpoint returns HTTP 403 without authentication; this remote evidence is
run/job/step metadata, not an independent reading of every remote log record.
Do not claim these host runs are warning-free; prior exact accepted diagnostic
records and the failed macOS error remain above.

Fresh repaired-candidate macOS full verification now succeeds, along with
Windows and Ubuntu. Together with the passing local 304-unit/19-host gate and
owner observable QA, this closes scoped T-010 acceptance. Early opening
cancellation/closure remains manually unobserved and covered by automated
provider/session/real Engine cleanup tests; its manual status is unchanged.
Only T-010 may be checked. Table/view browsing, first-row/multi-GB performance,
whole-milestone QA and milestone/release tagging remain later work.
Completion edits are records only. Completion-record `npm run verify` passes
(exit 0): all 304 unit tests, strict host/webview/tooling types, lint, production
builds and a 17-file / 480.58 KB VSIX; zero errors and zero warnings.

**T-011 worker metadata completion (2026-10-10):** owner authorizes T-011
alone, judgment on schema details, necessary fixes/fixtures and local validation;
the owner handles pushing. T-012 remains unstarted. No new dependency, committed
fixture edit or source-file mutation is introduced. Disposable test databases
cover schema stress cases; existing owner fixture copies and debug.log remain.

The initial new metadata cases fail before implementation because the Engine
methods do not exist. The first empty-database test setup accidentally creates
a zero-byte file; initialize a valid empty SQLite database with VACUUM before
testing absent metadata. A SQL alias quoting/type-narrowing correction precedes
the first passing 16-case run. The initial standalone gate passes 324 tests,
but is not final evidence for the later name-collision repair.

Self-review reproduces main-schema tables hiding PRAGMA functions. Six new
red-first cases (columns/indexes/indexColumns on each backend) fail before the
repair. Qualify metadata functions through the empty temp schema and retain
their explicit main-schema argument. All 26 task unit cases now pass; this is
local author review, not an independent fresh-chat review.

Acceptance coverage in `test/unit/engine-schema.test.ts`:
- FR-001: complete paged table/view catalog, real sqlite_sequence exclusion,
  retained sqliteX/user names, creation SQL and a valid empty database.
- FR-003: exact types/default SQL/NULLs, NOT NULL, composite primary-key order,
  generated columns, views, no-key/no-index tables, explicit/implicit/partial/
  expression indexes, WITHOUT ROWID primary indexes and key/auxiliary terms.
- FR-003: literal Unicode/quote/injection-like names, missing/wrong-table indexes,
  invalid identifiers/pages, 1,000 columns, explicit >4 MiB metadata failure,
  malformed-view error recovery and PRAGMA-function name collisions.
- FR-016: read-only source, rejected writes, unchanged hashes, no new sidecars,
  cancel/reopen and pending-request close/overlap handling on both backends.

`src/test/engine-schema.test.ts` adds four real-host cases: native/fallback
column/index/term pages, unusual names, view and WITHOUT ROWID metadata,
off-thread execution, source hashes/sidecars, cancel/close and error recovery.
The final implementation `npm run verify:full` passes (exit 0): 330 unit tests,
23 integration tests, strict typechecks/lint, builds and a 17-file / 481.24 KB
VSIX on Windows x64, VS Code 1.140.0, bundled Node 24.21.0.

Exactly one accepted record: source `20261010T144855/window1/renderer.log`,
line 10, original severity `warning`, rule `VSCODE-HOST-001`, message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
No other warning or error is accepted. This full run is not warning-free.
Logs remain in `out/integration-profile-MGgJI1/logs`; prior failed evidence and
the strict host diagnostic policy remain unchanged.

All scoped T-011 acceptance passes locally. Fresh three-platform CI requires
the owner's push; cross-platform results, independent milestone review,
visible schema/grid QA and production first-row/multi-GB targets are not claimed.
Completion-record `npm run verify` passes (exit 0): 330 unit tests, strict
types/lint/builds and a 17-file / 481.24 KB VSIX, zero errors and warnings.
Only T-011 is checked in its task commit. No milestone completion or release
tag is claimed.

**T-011 CI confirmation (2026-10-10):** owner supplies GREEN
[run 38034122214](https://github.com/JreyForFun/lite-voyager/actions/runs/38034122214),
attempt 1, commit `f49f87d9faaab5aa082ab70c0daf566a45c41de8`.
Public GitHub API metadata independently confirms the run is completed/successful
and all three full-verification jobs succeed:

- [Ubuntu](https://github.com/JreyForFun/lite-voyager/actions/runs/38034122214/job/114160913111): locked installation and Linux session-bus/xvfb full verification succeed.
- [Windows](https://github.com/JreyForFun/lite-voyager/actions/runs/38034122214/job/114160913193): locked installation and Windows/macOS full verification succeed.
- [macOS](https://github.com/JreyForFun/lite-voyager/actions/runs/38034122214/job/114160913206): locked installation and Windows/macOS full verification succeed.

The workflow runs `npm ci` and `npm run verify:full` on each platform, with
`dbus-run-session -- xvfb-run -a` on Linux. Alternative OS-specific steps are
skipped by their platform condition, not skipped tests. This confirms candidate
CI against the existing strict diagnostic policy; remote full logs were not
independently inspected and remote runs are not claimed warning-free. Preserve
the exact accepted local host warning and earlier failed evidence above.

T-011 remains complete and checked. T-012 UI, production first-row/multi-GB
targets, independent milestone review and whole-milestone QA remain open.
These completion-record changes modify only documentation; owner pushes them.
CI-record `npm run verify` passes (exit 0): 330 unit tests, strict types/lint,
builds and a 17-file / 481.24 KB VSIX; zero errors and zero warnings.

### T-012 browser validation (2026-10-10)

Owner authorizes implementation, best-judgment scoped repairs and disposable
fixtures; owner pushes. SPEC.md FR-002 records this task's detailed acceptance.
The schema panel is an unimplemented milestone follow-up, not claimed here.

Coverage:
- `sqlite-browser.test.ts`: worker-only paged catalog/rows, no automatic COUNT,
  quoted hostile names, exact count strings, one superseding request, cancellation,
  closure and visible metadata/count/recovery errors; dense message guards reject
  sparse arrays, invalid sizes/IDs and unsafe offsets.
- `browser-view.test.ts` / `browser-grid.test.ts`: automatic selection, page
  controls, distinct NULL/empty/literal values and safe text, exact int64/REAL/time,
  rows/columns virtualized, keyboard edges, 1-MiB cells, stale replies/DOM cleanup,
  empty/error states and small saved state through repeated context destruction.
- `browser-engine.test.ts`: both real supervised backends on unchanged read-only
  sources; empty/exact-100/partial-203 pages, views, hostile identifiers, 103
  objects, 1,000 columns, full 1.1-million-character cells and explicit 4-MiB
  failures. A 4.3-million-character schema default cannot prevent name listing.
- `browser-package.test.ts`: built browser JS/CSS are selected by the actual
  production VSIX whitelist; generated fixtures are excluded. A small staging
  directory avoids scanning cached hosts/profiles; no assertion/deadline changed.
- `src/test/sqlite-browser.test.ts`: actual Chromium/custom-editor messages,
  DOM labels/values, paging/counting, empty/view/error recovery, list paging,
  1-MiB text, 1,000-column navigation, both-engine count cancellation/recovery,
  hide/show state restoration and byte-identical read-only sources. A separate
  real-host primary case opens a warm ten-million-row/135,122,944-byte file.
  Existing T-010 consent, opening/disposal, association and transport tests remain.

Red-first/failure history is retained:
- Initial browser/grid/view suites fail on missing implementation modules.
  Five new shell/provider expectations fail before production assets are wired.
- A page-replacement regression reports old DOM under the new page before its
  frame; replacing DOM/metrics immediately fixes it without dropping cell data.
- Two real-backend large-schema tests fail on the catalog's unnecessary CREATE
  SQL. Selecting only names/kinds fixes them without weakening metadata APIs.
- Actual package-file selection fails because browser assets were omitted.
  The preceding 350-unit/26-host full run passed but packaged only 17 files;
  it is not completion evidence. The whitelist now includes both assets.
- A first host run fails two URI-casing checks and two viewport-width assumptions;
  URI equality uses canonical Uri serialization and fidelity checks navigate
  horizontally. Every original value/source/consent assertion remains.
- Context-recreation tests first lose IDs/selection, then lose selection on a
  second hide before catalog completion. Small VS Code getState/setState fixes
  both. A later host run has 24 passing/two failures: native DOM jumps 101→104,
  fallback DOM report revisions restart. Disabling Chromium scroll anchoring and
  giving document observers a monotonic report sequence fixes both; a new unit
  regression first fails on restarted revisions (1 is not greater than 10).
- A package-test run times out at its original 30 s deadline while traversing
  the complete development tree. Staging the identical whitelist/real built
  assets fixes test efficiency; the full gate still packages the real project.
- A full run passes 356 of 357 unit tests but the unchanged T-009 nested reporter
  exceeds its existing 5 s deadline under parallel process contention. All 28
  checks/reporter tests pass in isolation. Two unit file workers bound competing
  helper processes; no tests, data, deadlines or diagnostic rules are changed.

Latest standalone real-host integration passes (26 tests) in Windows x64 /
VS Code 1.140.0 / bundled Node 24.21.0. DOM readiness for the 4,874,240-byte fixture
is 565.1 ms native / 598.1 ms fallback. The warm ten-million-row table is 422.5 ms,
100 cached rows and 15 rendered rows. Timings include openWith through the first
rendered-DOM report, excluding fixture generation/hash; physical paint judgement,
cold-disk behavior, multi-GB flat memory and other OS results are not established.
One accepted diagnostic is reported explicitly (not warning-free):
- source `20261010T161717/window1/renderer.log`, line 10, original severity
  `warning`, rule `VSCODE-HOST-001`:
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
No other diagnostic is accepted.

Final implementation `npm run verify:full` passes (exit 0): 357 unit tests in 30
files, 26 real-host tests, strict host/webview/tooling types, zero-warning lint,
production builds and a 19-file/489.84 KB VSIX including browser JS/CSS. In the
final host run, native/fallback 4,874,240-byte DOM readiness is 593.0/587.5 ms;
the warm ten-million-row file is 493.3 ms (100 cached / 15 rendered rows).
No test is skipped; unit concurrency alone is bounded to two file workers.
The full run is not warning-free: exactly one accepted record is reported:
- source `20261010T162557/window1/renderer.log`, line 10, original severity
  `warning`, rule `VSCODE-HOST-001`:
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
Every other warning/error fails. Fresh three-platform CI is not yet claimed;
owner pushes the task commit. Completion-record `npm run verify` also passes
(exit 0): 357 tests, strict types/lint/builds and 19-file/489.84 KB VSIX;
zero errors and zero warnings. Only scoped T-012 is checked after local
acceptance; the whole milestone remains open. Changes are committed with T-012
in the message; owner pushes and supplies fresh CI/visual QA evidence later.

Owner fixture: `out/t012-owner-20261010/browser.sqlite` (4,874,240 bytes) and
`generation.json`; generated/ignored, not committed or packaged. README.md gives
F5 visual/keyboard/theme checks and generation commands. Original owner copies
and debug.log are untouched. Independent milestone review, manual smoothness/
theme judgement, source editing, SQL UI and full performance remain later work.

The following checklist is the remaining whole-milestone QA:

- [ ] Open every fixture database. Open an invalid file, an empty (0-byte) file, and a database with no tables: each gives a clear result.
- [ ] A generated multi-GB database shows its first rows within the NFR-004 target, and memory stays flat while scrolling.
- [ ] NULL, empty string, BLOB placeholder, and a 64-bit integer (for example 9223372036854775807) all display correctly.
- [ ] Table and column names with spaces, quotes, and unicode work.
- [ ] Run a long query and cancel it: the UI stays responsive and the app recovers.
- [ ] A bad SQL statement shows the error and keeps the previous results.
- [ ] Sort and filter work on a large table; sorting an unindexed column shows the warning.
- [ ] Export results to CSV, open the exported file, and compare it with the grid.
- [ ] Two tabs open on the same file; closing a tab during a query does not crash.
- [ ] Light and dark themes; the grid is usable by keyboard only.
- [ ] Force the fallback engine and repeat the basics; the banner appears.

### Milestone 2 manual QA (other formats)
- [ ] CSV files with a BOM, CRLF line endings, quoted commas, quoted line breaks, and ragged rows all load correctly.
- [ ] A generated 1 GB CSV: preview appears quickly, import shows progress, cancel works, and the temp file is removed afterward.
- [ ] Kill VS Code in the middle of an import, restart, and confirm the orphaned temp file is cleaned up.
- [ ] Low disk space (simulated) gives the pre-check message instead of a crash.
- [ ] JSONL streams; a JSON array of objects loads; nested JSON can be queried with `json_extract()`; a bad shape gives a clear message.
- [ ] XLSX with several sheets loads as several tables; the large-file warning appears.
- [ ] "Open With", the Explorer menu entry, the editor-title button, and the `openCsvByDefault` setting all behave as specified.
- [ ] Autocomplete suggests real table and column names.

### Milestone 3 manual QA (editing)
- [ ] Edit, save, close, reopen: the change persisted. Edit then revert: the file is unchanged.
- [ ] The dirty marker appears and clears correctly; write mode is clearly indicated.
- [ ] A table without a primary key edits by `rowid`; a valid `WITHOUT ROWID` table edits by its full primary key, including composite keys.
- [ ] Kill VS Code in the middle of a save: the database is still intact and openable.
- [ ] Changing the file from another program triggers the refresh prompt and never silently overwrites it.

### Milestone 4 manual QA (differentiators)
- [ ] `orders.csv JOIN customers.json` returns the right rows; name collisions get suffixes and are shown.
- [ ] CSV write-back is atomic: kill during write and confirm the original file is intact.
- [ ] Benchmark results (T-060) are recorded, and README claims match the numbers.

---

## 5. Edge cases every format must be tested against

T-005 creates fixtures for these. Add new ones whenever a bug is found.
The inventory and setup guide are [manifest.json](../test/fixtures/manifest.json)
and [fixture README](../test/fixtures/README.md). Checks validate fixture data;
future feature tasks still need tests that use these inputs against real behavior.
Static assets retain byte-for-byte hashes. Dynamic file conditions, cancellation,
and worker exit are reproduced on disposable copies using the runtime guide.
Generated stress files are git-ignored; run `npm run fixtures -- stress` and
`npm run fixtures -- large --rows 10000000` locally. Retain the printed output
directory, row/byte report, and `generation.json` as evidence, not large assets.
Apply cases to formats that can represent them: Excel worksheets allow 1,048,576
rows and 32,767 characters per cell, so the 10-million-row/1-MB-cell cases use
CSV/JSON/JSONL/SQLite where applicable. No format limit authorizes silent truncation.

- Empty file, 0-byte file, header-only CSV, database with no tables
- Corrupt or truncated file, non-UTF-8 text, binary data inside a text file
- A single cell larger than 1 MB; a table with 1,000 columns; a table with 10 million rows
- Names with spaces, quotes, emoji, and SQL keywords (`select`, `order`)
- NULL versus empty string versus the text `NULL`
- Integers beyond 2^53; very small and very large REAL values
- Duplicate or blank column headers in CSV
- Read-only file, file in use by another program, file deleted while open
- Cancel in the middle of a query; cancel in the middle of an import
- Worker crash: the extension must recover and tell the user

---

## 6. Independent review (fresh chat, once per milestone and for risky tasks)

The AI that wrote the code is the worst reviewer of it. Open a **new chat**, ideally with a different model, and use this prompt. Paste the real diff, not a summary.

```
You are a strict code reviewer. Do NOT rewrite the code. Find defects.

Context:
- specs/CONSTITUTION.md (pasted below)
- Requirements this change must satisfy (pasted below)
- The diff (pasted below)

Report, in order of severity (HIGH / MEDIUM / LOW):
1. Violations of the Constitution or the requirements. Cite the ID.
2. Bugs, race conditions, unhandled errors, resource leaks.
3. Missing tests or edge cases from the list below.
4. Anything that is not in the spec (scope creep).
For each finding: where it is, why it is a problem, and a suggested test
that would catch it. If you are not sure, say so. Do not invent problems.
```

Then triage the findings yourself. For each real one, write a failing test first, then fix.

---

## 7. When the AI goes wrong

- It claims success without evidence: ask for the exact command, run it yourself, paste the output.
- It starts changing unrelated files: stop, revert with git, start a new chat with the task pack.
- Tests pass but behavior is wrong: the tests are too weak. Add the missing test from the acceptance criteria.
- The same bug comes back twice: the spec is probably unclear. Fix the spec.

## Changelog
- v0.1 T-012 browser (2026-10-10): Record scoped acceptance coverage, real-host DOM/source/cancellation evidence and all failed/regression runs. Preserve strict diagnostics and exact host-warning reporting; separate task browser readiness from later manual, CI and whole-milestone performance/review requirements.
- v0.1 T-011 CI confirmation (2026-10-10): Verify run 38034122214/attempt 1/f49f87d success and successful locked installs/applicable full checks on Windows/macOS/Ubuntu via public API metadata. Preserve exact local host diagnostics, remote-log limitations and later-task/milestone scope.
- v0.1 T-011 metadata (2026-10-10): Record tests-first metadata implementation, six red-first function-name-collision repairs, 26 task unit/four host cases and passing 330-unit/23-host full gate. Report the exact approved host warning; retain later UI/performance/CI and independent milestone-review limits.
- v0.1 T-010 CI completion (2026-10-10): Independently verify run/job/step metadata for fresh 55e5da0/run 38030277300 success on Windows/macOS/Ubuntu. Close scoped T-010 only; preserve failed CI, exact historical host diagnostics, manually unobserved cancellation and later milestone requirements. Remote logs are not independently retrieved or called warning-free.
- v0.1 T-010 CI lifecycle follow-up (2026-10-10): Preserve failed macOS run 38029094981/7981bf2 and passing Windows/Ubuntu conclusions. Normal test closure must assert webview transport readiness and await helper exit; four red-first regressions cover ordering and failures. No diagnostic rule is changed; fresh candidate CI remains required.
- v0.1 T-010 completion QA (2026-10-10): Owner passes repaired Cancel/Proceed after Escape; scoped task acceptance has passing automated/observable manual evidence. Preserve unobserved manual cancellation, its automated coverage, earlier failures, exact host warnings and later milestone/CI gaps. Restore normal F5 engine detection by removing the temporary QA setting.
- v0.1 T-010 Escape confirmation (2026-10-10): Owner supplies declined-consent output after Escape in the fresh fd9bd13 fallback QA host. Escape passes; explicit Cancel and Proceed retests remain. Preserve earlier failed QA and automated-run diagnostics.
- v0.1 T-010 explicit consent candidate (2026-10-10): Owner confirms fresh-dialog Escape failed. Add red-first explicit Cancel/Escape routing and only-Proceed approval tests; candidate full verification passes with 300 unit/19 integration tests and the exact approved host diagnostic recorded. Desktop retest remains required; native root cause is not claimed.
- v0.1 T-010 QA validation (2026-10-10): Record passing owner checks and opened fallback notice; Proceed succeeds, Escape remains unresolved pending a fresh-dialog reproduction, and Cancel is not reported. Retain cancellation's too-quick manual status and existing automated evidence.
- v0.1 T-010 owner picker confirmation (2026-10-10): Record actual Reopen Editor With PASS after 9ea86eb; remaining six manual checks and fresh CI remain open. Navigation setup creates separate ignored consent copies of exactly 200,000,000 and 200,000,001 bytes; committed fixtures are untouched.
- v0.1 T-010 picker repair (2026-10-10): Retain the owner's failed picker report, explain the direct-command test gap, record red-first registration coverage and passing 298-unit/19-host full check with its exact approved diagnostic. Owner menu/remaining QA and fresh CI are pending.
- v0.1 T-010 implementation (2026-10-10): Recorded 22 unit/five new host tests, two red-first lifecycle repairs and passing local full verification with every accepted host warning reported. Owner QA/push/fresh CI and production browsing/performance remain pending; T-010 stays unchecked.
- v0.1 T-009 completion (2026-10-10): Verified run 38018867617/attempt 1/7114b62 and successful locked installs/full checks on Windows, macOS and Ubuntu. Closed only T-009; preserved failed probes, exact diagnostic policy and later-task/manual QA gaps. No executable changes.
- v0.1 T-009 colored-console repair (2026-10-10): Preserve failed run 38016821325/ece4194 on all platforms and the incomplete earlier local coverage. Explicit color/agent matrices and segmented-formatting regressions precede scan-only terminal normalization; original output and strict rejection policy remain intact. Canonical verify/full pass with 275 unit/12 integration tests and one reported approved warning; the injected-CI probe fails on host startup/offline diagnostics and is retained. T-009 remains reopened pending fresh three-platform CI.
- v0.1 T-009 CI follow-up (2026-10-10): Recorded failed run 38015468652/4d0d435 and its successful Windows/macOS jobs. Ten real-runner regressions cover the Ubuntu prose false positive and hidden passing diagnostics under automatic agent reporting; explicitly select dot reporting without relaxing rejection policy. Local verify/full pass with 265 unit/12 integration tests and one explicitly reported approved host warning; fresh repair CI remains required.
- v0.1 T-009 evidence (2026-10-10): Recorded 48 task unit/four production integration cases, red-first reviewed repairs, final local full-check evidence and exact host diagnostics. Preserve the failed startup-warning run; isolate parent cache paths without weakening policy. Saved host results/strict checks recovered after interruption. Later browsing/performance/manual QA and new remote CI remain open.
- v0.1 T-052 completion (2026-10-10): Verified run 37962951570/attempt 1/6b2d665 and successful locked installs/full-verification steps on all three platforms; completed the foundation gate and local v0.0.1 checkpoint, preserving production limitations.
- v0.1 T-052 fixture follow-up (2026-10-10): Verified three-platform candidate run 37961300752/d18e5e6, then recorded a real local quoted-header timeout and preserved its data/assertions/time bound while reducing redundant tiny reads; require fresh verification/CI for the adjusted fixture before tagging.
- v0.1 T-052 local gate (2026-10-10): Full verification passes with 207 unit/eight integration tests, source/cancellation evidence and one explicitly reported approved host warning; fresh remote candidate evidence and final tag remain required.
- v0.1 T-052 evidence reconciliation (2026-10-10): Checked evidenced source safety, scoped coverage, measurements, owner QA, independent review, marker search and spike records; reopened only current gate CI items for new executable review repairs. T-007 remains complete and no tag is claimed.
- v0.1 T-052 scope clarification (2026-10-10): Under the owner's delegated closure judgment, clarified the existing milestone-specific coverage rule without changing the global trace or production requirements; the foundation checks explicit spike acceptance and preserves future gaps.
- v0.1 T-007 repair completion (2026-10-10): Verified fresh run 37956761308, attempt 1 at f3d82bb, and successful applicable full-verification steps on Ubuntu/Windows/macOS; rechecked only the two local/CI gate items. Other foundation checklist items remain open.
- v0.1 T-007 local repair evidence (2026-10-10): Recorded final full verification, red-first coverage and the explicitly reported host diagnostic; current local/remote milestone gate checkboxes remain open for fresh three-platform CI.
- v0.1 T-007 host diagnostic policy: Owner explicitly approved two exact, source-restricted VS Code host warning families, with mandatory reporting and fail-closed tests; all other warnings and every error remain failures.
- v0.1 T-007 CI regression repair: Reopened current local/CI gate items after failed owner-supplied runs, preserving the earlier passing evidence and the zero-warning rule.
- v0.1 T-002 completion (2026-10-09): Recorded fresh run 37922970386/0e3ec57 and passing reviewed fixes, local gates and owner manual QA; checked the T-002-specific foundation item only.
- v0.1 T-002 cancellation redesign (2026-10-09): Owner authorized confirmed helper exit within one second; local, manual, and fresh CI evidence are required for closure.
- v0.1 T-002 scope clarification (2026-10-09): Owner approved keeping the production Engine interface in T-009; the foundation gate measures the worker/fallback spike instead.
- v0.1 T-007 completion (2026-10-09): Recorded run 37884550873/commit 93b23bf with three successful full-gate jobs; checked only the two evidenced CI gate items. All other milestone gate items remain open.
- v0.1 T-007 Ubuntu environment (2026-10-09): Added isolated D-Bus session setup after the supplied Ubuntu log passed tests but failed on Electron errors. Error/warning rejection remains required; a fresh three-platform run is still needed.
- v0.1 T-007 CI (2026-10-09): Clarified approved full-gate execution on every platform and remote evidence required before checking T-007; local workflow checks do not establish CI success or engine coverage.
- v0.1 T-005 fixtures (2026-10-09): Linked inventory, runtime recipes and generator evidence; documented format applicability. Corrected the impossible WITHOUT ROWID/no-primary-key QA item to match approved FR-020.
- v0.1: Initial version.
