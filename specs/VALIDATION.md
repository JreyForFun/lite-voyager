# Lite Voyager: Validation

Status: Draft v0.1 | Applies to every task and every milestone.

**Rule:** nothing is "done" because an AI says it is. Done means there is evidence: command output you have seen, or a manual check you have performed.

**Honest limit:** validation lowers the risk of errors; it cannot prove there are none. Large-file speed, memory use, and behavior on other operating systems are only validated by actually running them.

---

## 1. Three layers of validation

### T-024 repaired-candidate CI and closure (2026-10-18)

Owner reports [run 39067782337](https://github.com/JreyForFun/lite-voyager/actions/runs/39067782337)
PASS. Public GitHub API metadata independently confirms attempt 1 /completed
success /exact repaired `7e8eaef0ec4a699f67a02b6f596d302b3e8de941`. Windows job
117498918122, Ubuntu job 117498918257 and macOS job 117498918356 all succeed
at locked installation and applicable full verification. Remote raw logs/counts/
diagnostics are not retrieved; no remote warning-free or numerical memory claim.
[CI record](../docs/t024-ci-repair.md) preserves failed 39059472250 /2139f7c,
all earlier failures/unknown causes, source/performance guards and visual limits.
Together with both-engine acceptance, delegated scoped QA, independent review
and 857-unit/68-host local full verification, this closes only T-024. The local
full is not warning-free: its exact approved warning/source/severity/HOST-001
record is retained there. Closure-only `npm run verify` passes 857 units /86
files (361.99 s), strict types/lint/build and 34-file /979.26-KB packaging with
zero errors and zero warnings. Only final evidence/status updates follow.
Owner pushes closure records; T-025 starts in a fresh chat. No milestone/tag.

### T-023 repaired actual-candidate CI and closure (2026-10-17)

Owner reports [run 39002490041](https://github.com/JreyForFun/lite-voyager/actions/runs/39002490041)
PASS. Public GitHub API metadata independently confirms attempt 1 /completed
success /exact `db28c92ea6e8406e02b999899a38843c8bfa0ce7`, the reviewed repair.
Windows job 117308167927, Ubuntu job 117308167922 and macOS job 117308167800
all succeed at locked installation and their applicable full-verification step.
Remote raw logs, counts and diagnostic records are not retrieved; no warning-free
remote claim. [Repair evidence](../docs/t023-windows-ci.md) preserves every earlier
failure, unknown timing cause, exact local diagnostics and scoped visual limits.
Together with prior local acceptance and independent review, this closes only
T-023 under unchanged guards. Documentation-only local closure `npm run verify`
passes 790 units /78 files (334.99 seconds), strict types/lint/build and 31-file
/694.21-KB packaging with zero errors and zero warnings. Only final documentation
status updates follow. Owner retains push; no whole-milestone closure, release/tag
or T-024 work.

### T-022 storage / SQLite save evidence (2026-10-16)

Owner delegates implementation, fixture changes, fixes and visual QA; owner retains
push/CI. Acceptance is SPEC FR-007/T-022 and PLAN section 5/T-022. The complete
file list, coverage, exact failing-first history, independent review and visual
observation limits are in [docs/t022-storage.md](../docs/t022-storage.md).

An earlier standalone candidate passes 702 units/71 files, types/lint/build and
28-file/675.26-KB packaging without errors/warnings. It predates the reviewed
source-identity/cleanup repairs and worker-whitelist fix. Preserve its initial
two-assertion lint failure and the genuine missing-worker package regression.
Three independent-review regressions first fail; repaired focused tests and
independent follow-up clear original-rename overwrite, absent-original save
refusal and unhandled live cleanup failure. Actual-vsce-list worker inclusion
now passes. No dependency, guard, deadline or diagnostic policy is relaxed.

Earlier targeted VS Code 1.140.0 tests pass all three T-022 cases. Only approved
diagnostic: `VSCODE-HOST-001`, original severity `warning`,
`20261016T021502/window1/renderer.log:10`, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
That run is not warning-free and predates the final reviewed host assertions.

Delegated light/dark/narrow/keyboard visual observations pass within their stated
Chromium scope. Native Computer Use fails its documented recovery. The separate
visual bridge passes/host exits 0, but the strict runner rejects its exact console
warning: `Warning: 'remote-debugging-port' is not in the list of known options, but still passed to Electron/Chromium.`
This failed instrumentation gate is retained; there is no new diagnostic exception
or retry-to-green. Native OS picker appearance and other platforms are unobserved.

After explicit low-space-decision wiring (its new regression fails first), the
full gate stops at units: 706 pass / one native foundation test fails, 70 passing
files / one failing file, 437.89 seconds. Exact failure:
`test/unit/sqlite-spike.test.ts:169`, `NFR-002: Given zero-byte.sqlite, When opened,
Then it fails clearly without falling back on database errors`, exceeding its
existing 5,000-ms test deadline. The full invocation has no package/host/log pass.
All T-022 units pass; that full invocation remains failed. Preserve
`out/t022-full.log`. A separate real-helper stage diagnostic completes in 524.516
ms (invalid open 271.382, recovery open 223.693, query 2.794, close 20.138 ms),
without reproducing/explaining the timeout. This is diagnostic evidence only.
No deadline, assertion or automatic unchanged retry is allowed to clear it.
Owner explicitly answers "Authorize one rerun; retain the failure" on 2026-10-16
after the reported 706/707 outcome and 524.516-ms diagnostic. This permits exactly
one unchanged full rerun after the independent host QA, retaining the failed gate
and unknown cause. It adds no diagnostic exception or permission for more retries.

Independent `npm run test:integration` passes all 60 real-host cases in 15 minutes.
Unchanged populated 1/5-GB CSV combined peaks are 408,854,528 / 396,554,240 bytes;
actual paging growth is 29,298,688 / 30,691,328 bytes, with source hashes preserved.
Its only approved diagnostic is `VSCODE-HOST-001`, severity `warning`, source
`20261016T024746/window1/renderer.log:10`, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
This is not warning-free.

The ONE owner-authorized unchanged `npm run verify:full` rerun passes: 707 units /
71 files in 278.63 seconds, strict types/lint/build, 29-file / 676.66-KB VSIX with
the save worker, integration compilation and all 60 hosts in 14 minutes. Its only
approved diagnostic is `VSCODE-HOST-001`, severity `warning`, source
`20261016T031110/window1/renderer.log:10`, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
The full run is not warning-free. The explicit one-rerun authorization is consumed;
the earlier 5-second timeout remains unexplained and retained.

Passing full-run populated 1/5-GB CSV combined peaks: 365,527,040 / 364,597,248
bytes; actual paging growth: 25,387,008 / 33,861,632 bytes. First-DOM reports:
482.377 / 505.156 ms; maximum host timer gaps: 60.132 / 48.650 ms. All 60 Browse /
20 SQL pages per size and source hashes pass. SQLite combined peaks:
276,332,544 / 284,983,296 bytes; paging growth: 8,011,776 / 14,503,936 bytes;
source hashes unchanged. Renderer residency remains separate, with sampled warm
workload/physical-paint limits stated in docs/t022-storage.md. All guards remain
unchanged. Final standalone `npm run verify` after the full/evidence update also
passes all 707 units / 71 files (287.38 s), strict types/lint/build and 29-file /
676.66-KB packaging with zero errors and zero warnings. Only documentation status
updates follow; code, tests and guards remain unchanged.

#### T-022 actual-candidate CI and closure (2026-10-16)

Owner reports [run 38795642328](https://github.com/JreyForFun/lite-voyager/actions/runs/38795642328)
PASS. Public GitHub API run/job metadata independently confirms attempt 1,
completed success, at exact `a1c1fceb12fe25e52c01dda809d45426b7927e07`, the
T-022 implementation commit and local HEAD before these closure records.

- Windows job 116631182411: locked installation and Windows/macOS full-verification
  step succeed.
- Ubuntu job 116631182912: locked installation and Linux session-bus/virtual-display
  full-verification step succeed.
- macOS job 116631182924: locked installation and Windows/macOS full-verification
  step succeed.

Remote raw logs, test counts and diagnostic counts are not retrieved; no
warning-free remote claim. Preserve every earlier failure, the unexplained
5-second unit timeout, the explicit single-rerun authorization, exact local host
diagnostics, visual observation limits and unchanged data/memory/timing guards.
Together with observed local acceptance, delegated visual QA and cleared
independent review, this completes only T-022. Check its task box. Closure changes
documentation only. Local closure `npm run verify` passes 707 units /71 files
(342.08 s), strict types/lint/build and 29-file /676.66-KB packaging with zero
errors and zero warnings. Only final documentation status updates follow. Owner pushes the
closure records, then T-023 planning starts in a fresh chat. No whole-milestone
closure, release or tag is claimed.

### Layer 1: Automatic gate (every task, every commit)

Two commands, defined in task T-006:

| Command | Runs | When |
|---|---|---|
| `npm run verify` | typecheck (`tsc --noEmit`), lint, unit tests (Vitest), build (esbuild), and a `.vsix` package dry run | After every task, before every commit |
| `npm run verify:full` | everything in `verify`, plus integration tests in a real VS Code (`@vscode/test-electron`) | Before a phase gate, and in CI on Windows, macOS, and Linux |

Rules:
- Zero errors and zero warnings. A warning is a defect that has not been explained yet.
- **Owner-approved T-007 host exceptions:** only structured `[warning]` records
  in a dated VS Code session's `windowN/renderer.log` may match one of the exact
  message family below. Report every accepted record with source, line, original
  severity, rule ID and message; never call such a run warning-free. All errors,
  other warnings, altered scopes/messages and records from other log sources fail.
  - `VSCODE-HOST-001`: `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
    A signed-out test fixture deliberately has no credentials; the bundled host
    logs this during provider registration even with cloud sandboxes disabled.
  - `VSCODE-HOST-002`: `Creation of workbench contribution 'workbench.contrib.chatLanguageModelsData' took Nms.`
    `N` must be an integer duration. This is the vendor's synchronous startup
    schema contribution, not Lite Voyager work or its responsiveness measurement.
  - `VSCODE-HOST-003`: `Creation of workbench contribution 'workbench.contrib.preferencesActions' took Nms.`
    Owner approved on 2026-10-14. `N` must be an integer duration. This is
    the vendor's settings/keybinding registration before Lite Voyager loads.
  - `VSCODE-HOST-004`: `Creation of workbench contribution 'workbench.contrib.chatPetContext' took Nms.`
    Owner approved on 2026-10-14. `N` must be an integer duration. This is
    the vendor's pet-service context binding before Lite Voyager loads.
  - `VSCODE-HOST-005`: `Creation of workbench contribution 'workbench.contrib.remoteStatusIndicator' took Nms.`
    Owner delegates the decision on this exact reviewed proposal on 2026-10-14;
    adopt only this family. `N` must be an unsigned integer duration. Official
    VS Code source registers its remote-status indicator at BlockStartup and
    logs synchronous constructor time before the extension host starts.
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

**T-012 CI and owner QA confirmation (2026-10-10):** owner supplies
[run 38039805436](https://github.com/JreyForFun/lite-voyager/actions/runs/38039805436),
attempt 1, commit `a72052004ebc8a383e6c195e12956801b101a099`, and reports GOOD
after the requested F5 fixture checks: distinct NULL/empty/exact integers,
201-row paging/count, slow-count cancellation/recovery, themes and keyboard
scrolling. This is owner-reported QA; individual observations were not supplied
and the assistant did not independently observe the physical desktop.

Public GitHub API metadata independently confirms completed/successful run
and all three full-verification jobs, locked installations and applicable steps:

- [Ubuntu](https://github.com/JreyForFun/lite-voyager/actions/runs/38039805436/job/114177613090): Linux session-bus/xvfb full verification succeeds.
- [Windows](https://github.com/JreyForFun/lite-voyager/actions/runs/38039805436/job/114177613233): Windows/macOS full verification succeeds.
- [macOS](https://github.com/JreyForFun/lite-voyager/actions/runs/38039805436/job/114177613238): Windows/macOS full verification succeeds.

The workflow runs `npm ci` and `npm run verify:full` on each platform, using
`dbus-run-session -- xvfb-run -a` on Linux. Alternative OS-specific steps are
skipped by their platform condition, not skipped tests. Remote full logs were
not independently inspected and remote runs are not claimed warning-free.
Preserve the exact accepted local host diagnostic and earlier failures above.
Scoped T-012 remains complete and checked. Independent milestone review,
cold-disk/multi-GB memory targets, schema panel and whole-milestone QA remain
open; T-013 is not started and no release tag is claimed. These changes affect
only PROGRESS.md, TASKS.md and VALIDATION.md; owner pushes the completion record.
CI-record `npm run verify` passes (exit 0): 357 unit tests in 30 files,
strict host/webview/tooling types, lint, production builds and a 19-file /
489.84 KB VSIX; zero errors and zero warnings.

### T-013 SQL editor validation (2026-10-10)

Owner authorizes implementation, scoped fixes and fixture choices; owner pushes.
Acceptance/decisions are in SPEC.md (T-013) and PLAN.md (production SQL editor).
No new dependency, static fixture edit or later-task implementation is required.

Coverage:
- `sql-editor.test.ts`: full-document/caret execution, literal backwards Unicode
  selection and the Mod-Enter binding. Real shortcut dispatch is verified below.
- `protocol.test.ts`: bounded literal SQL, exact transport boundary, page/ID
  validation, invalid timing and sparse result rows.
- `sqlite-browser.test.ts`: literal Engine dispatch, bounded page address,
  elapsed time and diagnostic preservation; inherited queue/disposal/cancel tests.
- `query-view.test.ts` and `browser-view.test.ts`: honest final-page counts/time,
  zero results, error-preserved DOM/summary/paging SQL, stale replies, explicit
  return to the same table, SQL limits and restored query/editor/table state.
  Edits during catalog restoration persist, and oversized text is never saved.
- `engine.test.ts`: real-worker SQLite missing-table/column and syntax errors,
  recovery on both backends; original source safety and engine tests remain.
- `sqlite-editor-ui.test.ts`: accessible controls, nonce-injected CodeMirror
  styles, local CSP and honest paging/SQL-limit help. Existing package selection
  tests verify shipped browser JS/CSS; no package whitelist change is required.
- `src/test/sqlite-browser.test.ts`: real CodeMirror highlighting, Run/backwards
  selection/keyboard shortcut, 201-row paging, edited/error SQL preserving the
  previous page and paging SQL, literal hostile diagnostics, duplicate columns,
  context recreation, exact values/NULL/empty/BLOBs, zero/large/wide results,
  existing cancel/reopen and unchanged read-only sources on both engines.

Failure history (no test, workload, deadline or diagnostic rule weakened):
- Red-first tests fail on missing editor/query modules, unrecognized query
  messages, missing host dispatch and lost SQLite diagnostics on both backends.
- Browser regressions fail before Browse table wiring, editor edits during
  restoration and saved table selection are corrected.
- Initial gate stops at a nullable SQL test argument; narrowing fixes it. A
  subsequent gate stops at a Vitest matcher's unsafe type; a typed text assertion
  replaces the matcher. Existing assertions are retained.
- A full unit run passes 366/374: eight existing recovery tests require query
  context. Adding a context prefix around the original SQLite diagnostic fixes
  behavior while retaining every original test unchanged.
- A later full run passes 375 unit tests and 27/28 host tests. The fallback SQL
  test receives a late old settled-DOM report during resize/Run, then clicks a
  disabled Run button before resize completes. Subscribe before awaiting message
  delivery and require each SQL/resize action's busy-to-settled transition.
  All original data, paging, error, source, transport and deadline assertions stay.

Standalone `npm run test:integration` then passes (exit 0): 28 real-host tests,
including both T-013 engine cases, on Windows x64 / VS Code 1.140.0 / bundled
Node 24.21.0. The run is not warning-free; exactly one accepted diagnostic:
- source `20261010T181033/window1/renderer.log`, line 10, severity `warning`,
  rule `VSCODE-HOST-001`:
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
No other diagnostic is accepted.

Final `npm run verify:full` passes (exit 0): 375 unit tests in 32 files,
28 real-host tests, strict host/webview/tooling/integration types, lint,
production builds and a 19-file/606.63 KB VSIX including the SQL/browser assets
and existing dependency notices. The final isolated host/profile
`out/integration-profile-Zri0f8` has no accepted diagnostic records: this final
full run has zero errors and zero warnings. Preserve the earlier standalone
accepted warning and failed runs above; they are not called warning-free.
Both T-013 host cases pass. Inherited warm ten-million-row first DOM readiness
is 875.4 ms, 100 cached/15 rendered rows; this is not a cold-disk/physical-paint
or multi-GB memory measurement. Completion-record `npm run verify` also passes
(exit 0): 375 tests, strict types/lint/builds and 19-file/606.63 KB VSIX; zero
errors and zero warnings. Scoped T-013 local acceptance is complete and checked;
the task changes are committed with T-013 in the message and owner pushes.
No fresh CI, owner visual QA, milestone closure or release tag is claimed.

Owner fixture: `out/t013-owner-20261010/browser.sqlite` (4,874,240 bytes) and
`generation.json`, generated/ignored and excluded from the VSIX. README.md has
exact F5 SQL/theme/keyboard/error/paging/cancel/restoration steps. Fresh remote
three-platform CI, owner visual judgement, independent milestone review and
cold-disk/multi-GB memory targets are not claimed. Later tasks remain open.

**T-013 owner QA report (2026-10-12):** owner reports PASS for all nine
listed SQL/browser checks against the T-013 handoff:

- `SELECT id, value FROM "b pages" ORDER BY id` — PASS.
- `SELECT FROM` — PASS.
- `SELECT 1; SELECT '🚀' AS value;` — PASS.
- `SELECT * FROM "a values"` — PASS.
- `SELECT 1 WHERE 0` — PASS.
- `SELECT * FROM "e large cells"` — PASS.
- `SELECT * FROM "f wide"` — PASS.
- `SELECT sum(x) FROM "g slow count"` — PASS.
- Browse table — PASS.

These are owner-reported results, not independently observed desktop QA.
Individual paging/value/error/cancellation observations were not supplied.
Light/dark themes, focus/highlighting/undo-redo, selection/shortcut details,
tab restoration and forced-fallback manual checks were not explicitly reported.
Do not infer a backend, tested commit SHA, or passing remote CI from this report.
Fresh three-platform CI and the remaining milestone checks stay open.
Only the T-013 completion/progress/validation records change in this follow-up;
implementation, tests, fixtures and other task checkboxes stay unchanged.
QA-record `npm run verify` passes (exit 0): 375 tests in 32 files, strict
host/webview/tooling types, lint, production builds and 19-file/606.63 KB VSIX;
zero errors and zero warnings. No new full-host or remote CI run is claimed.

**T-013 failed CI and repair candidate (2026-10-12):** owner supplies
[run 38204288838](https://github.com/JreyForFun/lite-voyager/actions/runs/38204288838)
and Windows/macOS failure excerpts. Public GitHub API metadata independently
confirms attempt 1, tested commit `92c12e98224edb31f75ad50407c0538bc8f0cf1e`,
and completed/failure. Locked installs succeed on all three jobs:

- [Windows](https://github.com/JreyForFun/lite-voyager/actions/runs/38204288838/job/114664224611): applicable verification fails; 374/375 unit tests pass, with the original five-second wide-browser fixture test timing out.
- [macOS](https://github.com/JreyForFun/lite-voyager/actions/runs/38204288838/job/114664224825): applicable verification fails; 375 unit tests pass, but native T-013 fidelity assertions see the previous `101`/`row 101` page. Host results are 27/28.
- [Ubuntu](https://github.com/JreyForFun/lite-voyager/actions/runs/38204288838/job/114664224869): applicable session-bus/xvfb verification succeeds according to public job/step metadata; full logs are not independently inspected or claimed warning-free.

The Windows fixture previously committed each of 102 CREATE statements
separately. Batching the unchanged SQL workload into one explicit transaction
removes that avoidable synchronous disk work; repaired Windows CI is still
needed to establish the deadline on the runner. Red-first real-SQLite fixture
tests prove rollback leaves no partial schema and successful creation preserves
all 103 objects, 1,000 columns and the final value. No deadline is extended.

The host observer previously accepted old-context rows after hide/show. A late
report could satisfy restoration, causing Run to target a still-restoring view;
generic busy/settled status could then belong to that restoration query. New
red-first protocol/view regressions require fresh context identity, exact action
acknowledgements and rejection of malformed tokens. Host tests wait for a new
settled context and match each unique action; edits wait for restoration to finish.
Every original value, paging, delivery, source-hash and timing assertion remains.

Targeted regressions pass: 42 tests across browser fixture/Engine/view/protocol
suites. The atomicity test first fails against the original auto-commit setup
with a persisted `first` table; context/token tests fail before their wiring.
Candidate `npm run verify:full` passes (exit 0): 381 unit tests in 33 files,
28 real-host tests, strict types/lint/builds and a 19-file/606.76 KB VSIX. Both
T-013 SQL cases pass, and inherited browser hide/show also waits for the actual
new context. Warm ten-million-row first DOM report is 430.7 ms with 100 cached /
15 rendered rows; cold-disk, physical paint and multi-GB targets are not claimed.
The candidate full run is not warning-free; exactly one accepted record:
- source `20261012T125026/window1/renderer.log`, line 10, original severity
  `warning`, rule `VSCODE-HOST-001`:
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
No other diagnostic is accepted. Candidate standalone `npm run verify` also
passes (exit 0): 381 tests, strict types/lint/builds and 19-file/606.91 KB VSIX
with the final changelog; zero errors and zero warnings. The repair candidate
is committed with T-013 in the message; owner pushes and supplies fresh CI.
T-013 is reopened/unchecked until the repair has fresh passing three-platform
CI. T-012's historical completion and the nine owner-reported T-013 QA passes
remain recorded; no macOS/remote Windows fix is claimed from local tests alone.

**T-013 repaired CI confirmation (2026-10-12):** owner supplies PASS and
[run 38206014267](https://github.com/JreyForFun/lite-voyager/actions/runs/38206014267).
Public GitHub API metadata independently confirms completed/successful,
attempt 1, tested repair commit `88e8a510338e0c0cd2be5bfe408e3a118cb67959`,
matching the local implementation commit. Locked installs and applicable full
verification steps succeed on all three jobs:

- [Windows](https://github.com/JreyForFun/lite-voyager/actions/runs/38206014267/job/114669562817): Windows/macOS verification step succeeds.
- [macOS](https://github.com/JreyForFun/lite-voyager/actions/runs/38206014267/job/114669562906): Windows/macOS verification step succeeds.
- [Ubuntu](https://github.com/JreyForFun/lite-voyager/actions/runs/38206014267/job/114669562767): Linux session-bus/xvfb verification step succeeds.

Alternate OS-specific steps are skipped by their platform condition; they do
not substitute for the applicable verification step. Remote full logs are not
independently inspected and these remote runs are not called warning-free.
Preserve the failed run/excerpts, red-first regressions and exact accepted local
host warning above. Scoped T-013 is complete and checked again, with local
381-unit/28-host evidence, repaired three-platform CI and the nine owner-reported
SQL/Browse table PASS results. Unreported manual theme/shortcut/restoration/
fallback details, independent review, full milestone QA and performance targets
remain open; no milestone closure or release tag is claimed.
This follow-up changes only PROGRESS.md, TASKS.md and VALIDATION.md.
Completion-record `npm run verify` passes (exit 0): 381 tests in 33 files,
strict host/webview/tooling types, lint, production builds and a 19-file /
606.91 KB VSIX; zero errors and zero warnings. Changes are committed with
T-013 in the message; owner pushes the completion record.

The following checklist is the remaining whole-milestone QA:

T-019 closes these items using the owner's delegated observable QA and five
explicit physical preview PASS checks (2026-10-14), plus the repaired
531-unit/49-host full gate recorded below. This does not claim the owner
manually replayed every automated fixture. First-DOM/memory evidence retains
its scoped warm-input and sampled-process limits.

- [x] Open every fixture database. Open an invalid file, an empty (0-byte) file, and a database with no tables: each gives a clear result.
- [x] A generated multi-GB database shows its first rows within the NFR-004 target, and memory stays flat while scrolling.
- [x] NULL, empty string, BLOB placeholder, and a 64-bit integer (for example 9223372036854775807) all display correctly.
- [x] Table and column names with spaces, quotes, and unicode work.
- [x] Run a long query and cancel it: the UI stays responsive and the app recovers.
- [x] A bad SQL statement shows the error and keeps the previous results.
- [x] Sort and filter work on a large table; sorting an unindexed column shows the warning.
- [x] Export results to CSV, open the exported file, and compare it with the grid.
- [x] Two tabs open on the same file; closing a tab during a query does not crash.
- [x] Light and dark themes; the grid is usable by keyboard only.
- [x] Force the fallback engine and repeat the basics; the banner appears.

### Milestone 2 manual QA (other formats)
- [ ] CSV files with a BOM, CRLF line endings, quoted commas, quoted line breaks, and ragged rows all load correctly.
- [ ] A generated 1 GB CSV: preview appears quickly, import shows progress, cancel works, and the temp file is removed afterward.
- [ ] Kill VS Code in the middle of an import, restart, and confirm the orphaned temp file is cleaned up.
- [ ] Low disk space (simulated) gives the pre-check message instead of a crash.
- [ ] JSONL streams; a JSON array of objects loads; nested JSON can be queried with `json_extract()`; a bad shape gives a clear message.
- [ ] XLSX with several sheets loads as several tables; the large-file warning appears.
- [ ] "Open With", the Explorer menu entry, the editor-title button, and the `openCsvByDefault` setting all behave as specified.
- [ ] Autocomplete suggests real table and column names.

#### T-021 streaming CSV / TSV import (2026-10-15)

The owner approves full T-021 implementation, fixture edits and necessary repairs,
delegates unresolved decisions, and retains pushing. SPEC's T-021 acceptance and
PLAN's scoped import design precede implementation. Other tasks remain open.

Tests-first evidence and preserved failures:

- Initial sandbox Vitest startup fails with spawn EPERM. Normal process access
  resolves the tooling restriction; this is not an application pass.
- First loader suite: 24 failures because CsvLoader is not implemented. First
  UI/session suites: missing import modules. Implementation follows these failures.
- Loader implementation initially passes 23/24: empty native import creates an
  invalid zero-byte database. Explicit SQLite initialization repairs it.
- Two new rowid-shadow cases fail on both engines with reordered source records.
  A collision-free alias/private stage order column repairs finalization.
- Initial real-host baseline: 0/3 pass because the DOM exercise driver is absent.
  After wiring controls, both engine cases pass but the hidden-first-view DOM
  wait fails. The fixture now observes the first view before opening the second.
- The next focused host run passes both engine controls and both populated CSV
  memory workloads but fails cancellation notification. State is already cancelled;
  status listeners are not notified. A new unit regression reproduces importing
  instead of cancelled; using the normal state update path repairs it.
- OS-observer regression initially omits csv-import-process residency. Extend only
  helper recognition; preserve the 500-MB cap, sample/gap guards and observer
  exclusion. Generator test initially fails with the generator absent.
- An early standalone gate encounters that new fixture test before its generator
  exists: 633 pass/1 fail, 58 files. Preserve this failed run. Scoped generator/
  observer/protocol/session checks subsequently pass after implementation.
- The first full gate stops on an unused destructured preview in lint. Replace it
  with a copied state and remove the preview only from progress delivery.
- Strict ready-state validation and bounded final-progress relay tests start red.
  Ready requires a bounded preview; coalescing keeps final counters before terminal
  completion and ignores later worker-exit notifications.
- A DOM clock-origin regression initially reports 0 instead of 550 ms. The
  controller now supplies the timestamp taken before panel creation.

Pre-final measured evidence (not a passing focused run because cancellation fails):

- Windows x64, VS Code 1.140.0 / Node 24.21.0. Real controls/250-row exact paging
  and SQL pass on native and fallback; first-row DOM 856.0499/515.2942 ms.
- Populated 1,000,013,832-byte CSV: 244,144 rows, sampled combined host/helper
  peak 434,991,104 bytes; 78 samples/75 actual import-helper samples; max OS gap
  645.0603 ms; host timer max gap 62.9674 ms. First-row DOM 442.5711 ms.
- Populated 5,000,003,592-byte CSV: 1,220,704 rows, combined peak 459,517,952
  bytes; 483 samples/480 import-helper samples; max OS gap 665.0587 ms;
  host timer max gap 47.5366 ms. First-row DOM 597.2002 ms. File-size peak
  growth is 24,526,848 bytes, below the scoped 50-MB guard.
- Every row is a real 4,096-byte record, not sparse padding. Full pre/post source
  hashes match generation: 1 GB d9ca2d901ce394b65f350d58e6acfb7aa5de1ff6c709ef59cc165cfb0de68789;
  5 GB 350d6e4f39ac41dfa814bb65b80c11f24ff58469c4df6beb8d2b6888cb871e68.
  Host and actual import/database helpers include worker residency; generators/
  observer are excluded; renderer peaks are separate (383,410,176/379,559,936).
  These are warm single-TEXT-column sampled measurements, not physical paint,
  every possible record shape, unsampled peaks, or cross-platform evidence.

Additional pre-final evidence and preserved failures:

- Full candidate: 646 units/60 files and 28-file/670.68-KB packaging pass; 55
  real-host tests pass, but the CSV 5-GB OS reader exceeds its unchanged 3,000-ms
  watchdog. The run fails. Its 1-GB sampled peak is 493,944,832 bytes. No complete
  5-GB measurement is claimed for that run; later success cannot erase it.
- Four new BOM cases fail: Papa's string API strips a record-leading data BOM.
  Protect only that rare case with a temporary parser field; remove that field
  after parsing. Preview/full stream retain all data BOMs and only the decoder
  removes the file-start BOM. The four cases then pass. Real-host assertions now
  inspect the later BOM-bearing value in preview and SQL on both engines.
- Native-counter metadata caching and acknowledged-snapshot tests start red,
  then pass with PID/start-time identity guards and fresh RSS on every snapshot.
  First native calibration fails the existing 3,000-ms maximum observation gap:
  per-discovery PowerShell startup is too expensive. Preserve this failure.
- A persistent, prewarmed metadata-reader suite starts with the module absent.
  Its first implementation rejects malformed JSON without an actionable domain
  diagnostic; the test fails. Domain diagnostics repair it; all 15 memory/cache/
  reader/watchdog cases pass, including original timeout/error rejection cases.
- Persistent reader calibration passes in the real Windows host: one million
  rows, combined peak 415,342,592 bytes; 28 samples/25 actual import-helper
  samples; maximum gap 1,301.2599 ms. Metadata caching never caches RSS or
  accepts a reused PID without rediscovery. Incomplete identities fail.
- Import worker young-generation GC is tuned to 8 MiB; old-generation limits
  stay at runtime defaults. The 16-MiB full-record test passes complete length
  and endpoints; no preview or nursery limit becomes a primary import cap.
- All 35 worker cases (including canonical tiny/large REALs) pass before the
  new large-record case. Empty-import summary regression starts red and is
  repaired to say no table exists, rather than claiming rows went into records.

- Next full candidate: 660 units/62 files and 28-file/670.77-KB package pass.
  56 host cases pass, including BOM SQL, cancellation (47.3211 ms) and native
  calibration (323,878,912-byte peak; 790.1773-ms gap). Its 1-GB CSV peak is
  383,365,120 bytes; 132 samples/68 actual helper samples; OS gap 830.3797 ms;
  host timer gap 59.3321 ms; first-row DOM 337.9489 ms. The 5-GB full-data SQL
  check then hits the unchanged 120-second deadline, so this full run fails.
- Repair the verification algorithm, not its deadline or coverage: compare every
  payload with the fixed generated 4,095-x TEXT using NULL-aware binary equality
  instead of repeated length/GLOB scans. This detects changed ends, changed length,
  NULL and BLOB storage; a new test starts with the helper absent, then passes
  all corruption/valid-data cases. No row/sample is skipped and no limit changes.
  Timeout diagnostics now include operation state without fixture cell contents.

Focused final T-021 host gate (profile out/integration-profile-wLPvoN) passes five
cases with strict runtime-log validation. Windows x64 / VS Code 1.140.0 / Node
24.21.0. Native/fallback controls, BOM-bearing data, paged SQL, exact values,
independent sessions and source safety pass. First DOM 802.8872/369.9352 ms;
native cancel and cleanup 71.8302 ms. Sampler calibration: 351,068,160-byte peak,
27 samples/24 actual helper samples, 1,010.6197-ms maximum gap.

- 1-GB CSV: 1,000,013,832 bytes /244,144 actual SQL-verified records, combined
  peak 375,255,040 bytes; 74 samples/64 actual import-helper samples; OS gap
  777.7134 ms; host timer gap 40.1621 ms; first DOM 324.7697 ms.
- 5-GB CSV: 5,000,003,592 bytes /1,220,704 actual SQL-verified records, peak
  406,544,384 bytes; 392 samples/316 actual import-helper samples; OS gap
  1,133.4434 ms; host timer gap 44.0706 ms; first DOM 1,009.0309 ms. Peak
  file-size growth 31,289,344 bytes. Every payload is exact TEXT; NULL/BLOB,
  byte/length changes would fail the full-data equality check. Source hashes
  match the recipe and the previous full-source hashes listed above.
- Renderer peaks remain separate: 387,416,064 /376,434,688 bytes. These are warm
  generated single-column sampled resident-memory/DOM observations, not physical
  paint, unsampled instantaneous peaks, every record shape or cross-platform proof.
- Accepted host record: source `20261015T022741/window1/renderer.log`, line 9,
  original severity `warning`, rule `VSCODE-HOST-001`, message
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
  No other diagnostic is accepted; this focused run is not warning-free.

Final standalone `npm run verify` passes: 661 tests/63 files, strict host/webview/
tooling types, zero-warning lint, production builds and 28-file/670.78-KB package
dry run, with zero errors and zero warnings.

Final `npm run verify:full` on the frozen implementation passes those same 661
unit tests and checks, integration compilation and all 57 real-host cases.
Profile: `out/integration-profile-xLJe8S`; Windows x64, VS Code 1.140.0 / Node
24.21.0. Host exit code is 0. After output recovery, a read-only invocation of the
unchanged `checkIntegrationLogs` confirms exactly the two approved records below.
No tests are rerun unchanged to replace failed evidence.

- Native/fallback options, BOM data, exact values and paged SQL pass; first-row
  DOM 597.0196/320.4753 ms. Primary cancel/cleanup 42.9740 ms; independent preview
  and recovery pass. Calibration observes 27 samples/24 actual helper samples,
  peak 312,680,448 bytes and maximum gap 1,034.0094 ms.
- Populated 1-GB CSV: 1,000,013,832 bytes /244,144 records, combined sampled
  host/helper peak 404,656,128 bytes; host peak 155,430,912; helper peak
  258,793,472. 83 samples/71 helper samples; maximum OS gap 1,213.6146 ms;
  host timer gap 48.9489 ms; first-row DOM 358.4108 ms; measured workload
  57,356.3549 ms. Renderer peak, separately, 421,810,176 bytes.
- Populated 5-GB CSV: 5,000,003,592 bytes /1,220,704 records, combined peak
  386,256,896 bytes; host peak 159,358,976; helper peak 229,728,256. 379 samples/
  321 helper samples; maximum OS gap 1,337.6764 ms; host timer gap 36.6253 ms;
  first-row DOM 439.3129 ms; measured workload 251,806.6056 ms. Renderer peak
  410,497,024 bytes. Combined peak decreases by 18,399,232 bytes rather than
  growing with file size. Paging growth is zero in both workloads.
- Full source hashes before/after match the generated recipes listed above.
  Every stored payload and row count passes the NULL-aware exact TEXT check.
  Both sampled peaks are below 500,000,000 bytes, file-size growth below
  50,000,000 bytes, OS gaps below 3,000 ms and host timer gaps below 100 ms.
  Scope remains warm generated single-TEXT-column CSV, host plus actual helpers/
  workers; renderer separately. Physical paint, unsampled peaks, universal record
  shapes and other platforms are not established by these measurements.

Final full is not warning-free. Accepted records (original severity `warning`):

- Source `20261015T025102/window1/renderer.log`, line 2; rule `VSCODE-HOST-002`;
  exact message `Creation of workbench contribution 'workbench.contrib.chatLanguageModelsData' took 24ms.`
- Source `20261015T025102/window1/renderer.log`, line 11; rule `VSCODE-HOST-001`;
  exact message `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.

No HOST-003/004/005 occurs. Every other warning and every error remains a failure.
Owner physical QA, fresh-chat independent review and new-code three-platform CI
remain pending. Exact commands, five owner checks and every task file are in
`docs/t021-import.md`. T-021 remains unchecked; no later task is started.

T-021 delegated QA/review follow-up (2026-10-15): the owner explicitly asks the
assistant to perform QA and fixes, removing the owner visual-QA wait and retaining
only push/CI. A fresh independent read-only agent finds one MEDIUM export-close
notification defect. Two FR-014 regressions fail with zero notifications; observing
the imported database's closed promise repairs both. All seven panel tests pass;
independent follow-up clears the repair with no remaining concrete finding.
The first repair verify fails strict TS2683 in the test mock; adding the explicit
`this: SqliteSession` annotation repairs it without unsafe types or suppression.

All five delegated visual/interaction checks pass within the documented scope:
actual isolated VS Code pixels and webview controls, light/dark themes, complete
multiline/int64 values, keyboard selection, tab/semicolon/header-off/all-text,
native schema/SQL, fallback paging, progress/retained cells, independent cancel,
fallback refusal and malformed/UTF-8 errors with fresh preview recovery. Seven
generated sources match their recipes after inspection. Native OS picker, physical
paint latency and other-platform behavior are unobserved. `docs/t021-qa.md` records
the exact method, screenshots, hashes, input corrections and limits.

Preserve QA tooling failures: Computer Use native pipe stays unavailable after
retry/reset; first disposable bridge glob finds zero cases. Corrected bridge case
passes/host exits 0, but both debugging launches FAIL the unchanged strict console
gate on `Warning: 'remote-debugging-port' is not in the list of known options, but still passed to Electron/Chromium.`
No exception/filter is added. The corrected profile's sole accepted runtime-log
record: `20261015T125240/window1/renderer.log:10`, severity `warning`, HOST-001,
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
An attempted sandbox build fails spawn EPERM; authorized canonical gates use
normal process access and no debugging flag. Repaired final gates follow below.

Repaired final standalone `npm run verify` PASS: 663 tests/63 files, all strict
type/lint checks, production build and 28-file/670.8-KB VSIX package check.
Zero errors and zero warnings. Retain the earlier 661-unit full as earlier evidence.

Repaired canonical full `npm run verify:full` PASS (exit 0): 663 units/63 files,
all types/lint/build/package checks (28 files/670.8 KB), integration compilation and
57 real-host cases. Profile `out/integration-profile-I4pQJG`; complete capture
`out/t021-reviewed-full.log`. Windows x64 / VS Code 1.140.0 / Node 24.21.0.
Native/fallback import DOM 454.2316 /199.7250 ms; native cancellation/recovery
41.8827 ms. Existing SQLite source safety, populated multi-GB, export, metadata,
SQL and independent-view suites pass. No checker, deadline or threshold changes.

- CSV calibration: peak 296,636,416 bytes, 37 samples/34 actual helper samples,
  maximum OS gap 960.9174 ms; renderer separately 931,074,048 bytes.
- Populated 1-GB CSV: 1,000,013,832 bytes /244,144 exact TEXT rows; combined
  sampled host/helper peak 375,705,600 bytes, host peak 131,149,824 and helper
  peak 256,864,256. Renderer separately 431,632,384. 135 samples/114 helper
  samples; OS gap 645.8867 ms; host timer gap 41.8086 ms; first DOM 362.9496 ms;
  measured workload 55,923.2586 ms. Paging growth zero.
- Populated 5-GB CSV: 5,000,003,592 bytes /1,220,704 exact TEXT rows; combined
  peak 343,932,928 bytes, host peak 132,206,592 and helper peak 214,675,456.
  Renderer separately 429,801,472. 569 samples/481 helper samples; OS gap
  790.4200 ms; host timer gap 90.6496 ms; first DOM 494.9270 ms; measured
  workload 236,560.3908 ms. Paging growth zero. Combined peak decreases by
  31,772,672 bytes with the larger file; the 50-MB size-growth guard passes.
- Full source hashes still match pre/post generation recipes above. Every stored
  payload and row count passes exact NULL-aware SQL verification. Both peaks are
  below 500,000,000 bytes, OS gaps below 3,000 ms and host gaps below 100 ms.
  Scope remains warm single-TEXT-column sampled host plus actual helpers/workers;
  renderer separate. No physical-paint, unsampled-peak, universal-shape or
  other-platform claim is made.

Repaired full is not warning-free. Exactly one accepted record: source
`20261015T131059/window1/renderer.log`, line 10, original severity `warning`,
rule `VSCODE-HOST-001`, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
No HOST-002/003/004/005 occurs. Every other warning and every error still fails.

After full verification, help-text-only cleanup removes the internal T-022
reference and states directly that imported storage is removed on tab closure.
No import/parser/worker/observer behavior changes; no expensive benchmark repeat
is needed for that copy edit. Fresh rebuilt inspection confirms the text, exact
multiline preview and completed two-row native import (`11-final-help.png`).
The bridge case passes/host exits 0, but its strict console gate again FAILS on the
same unapproved debugging-flag warning above. Preserve this third instrumentation
failure; its sole runtime record is HOST-001 at
`20261015T132559/window1/renderer.log:10`, severity `warning`, the exact
CloudSandboxApi message above. Final standalone after the copy edit PASSes:
663 tests/63 files, strict host/webview/tooling types, zero-warning lint, production
build and 28-file/670.78-KB package check. Zero errors and zero warnings.
Owner push and actual-candidate three-platform CI remain; no owner visual wait.

T-021 first post-push CI failure and phase repair (2026-10-15):

[Run 38689094274](https://github.com/JreyForFun/lite-voyager/actions/runs/38689094274),
attempt 1, FAILS on all three platforms at exact local implementation commit
`e03f357873a178162caadfe19e1c3de95a9a6e58`. Public GitHub API run/job metadata
independently confirms the SHA and failed full-verification steps; locked installs
succeed on Windows (job 116270616311), macOS (116270616577) and Ubuntu
(116270616592). The owner's three complete pasted verification logs each pass
663 units/63 files and 56 host cases, then fail the populated CSV memory test:

- Ubuntu: `Repeated-paging memory growth 102371328 exceeds 50 MB.`
- Windows: `Repeated-paging memory growth 100528128 exceeds 50 MB.`
- macOS: `Repeated-paging memory growth 98697216 exceeds 50 MB.`

No complete 5-GB CSV CI result is established. Failure happens before the strict
runtime-log scan, so remote approved-record counts or warning-free logs are not
claimed. All three failures remain failed; there is no unchanged retry-to-green.

Root cause: the CSV workload calls the SQLite paging checker with the import
helper PID and its default `settledAt = 0`. Its first three import-worker samples
can precede normal runtime allocation on fast CI hosts; later import samples are
then mislabeled as repeated-paging growth. It performs no repeated pages at all.
Earlier CSV `pagingGrowthBytes` values therefore do not validate repeated paging;
their sampled absolute peaks and source/value observations remain historical
evidence within their reported scope. A slower local observer is not a repair.

Failing-first regressions preserve this CI-shaped startup rise: the old checker
rejects 100,000,000 bytes of startup growth even though the full peak is only
280,000,000 and the subsequent SQL helper's paging is flat. The new phase suite
initially fails because its module is absent; the panel identity assertion also
fails (`undefined` instead of actual database helper PID). Implementation follows.

The repair preserves the unchanged generic checker and every threshold:

- All samples from before preview through import, finalization, full-data SQL,
  repeated paging and final observations reach the same absolute 500,000,000-byte
  cap and 3,000-ms gap check. No sample is dropped or idle memory subtracted.
- Require at least five actual import-helper samples. After the browser is ready,
  record its actual Engine process ID, require a distinct identity, and collect
  five baseline samples. Import samples cannot overlap that settled baseline.
- Execute 60 real Browse pages and 20 SQL pages, checking context/exercise IDs,
  mode, exact offsets, 100 cached rows, virtualized rendered rows and payload
  lengths. Collect at least five observations during paging and five afterward.
  The same 50,000,000-byte paging-growth guard now compares actual settled browser
  samples. The cross-file 50,000,000-byte growth guard also remains unchanged.
- The original full-data SQL, generated populated sizes, source hashes, engine,
  cancellation, timer and DOM requirements/deadlines remain intact. No dependency,
  warning exception, production import algorithm or CI workflow is changed.

All 18 focused phase/panel/legacy-gate tests pass, including over-budget import/
handoff/final peaks, actual 50,000,001-byte paging growth, missing phase/helper
coverage, reused IDs and excessive gaps. Independent read-only review finds no
concrete defect and runs no competing workloads.

Actual host calibration PASS: profile `out/integration-profile-vACM2o`, one million
rows, all 60 Browse/20 SQL pages, peak 324,210,688 bytes. 61 samples; 36 actual
import-helper samples and 22 browser-helper samples, including 5 baseline/12 paging/
5 final. Maximum gap 845.2815 ms; actual paging growth 45,056 bytes. Renderer peak
464,044,032 bytes is separate. Sole approved record: source
`20261015T152925/window1/renderer.log:9`, severity `warning`, `VSCODE-HOST-001`,
exact message `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
This calibration is not warning-free. The first repaired standalone gate passes
666 units/64 files (219.87 seconds), types/lint/build/VSIX, zero errors/warnings.

The first repaired full gate FAILS: all 666 units/64 files (209.21 seconds) and
56 host cases pass, but the newly exercised 1-GB CSV paging grows 81,838,080 bytes,
above the unchanged 50-MB guard. Profile `out/integration-profile-LY4t0I`.
Its calibration passes with peak 328,003,584 bytes, paging growth 5,201,920 bytes,
36 import/23 browser observations and 5 baseline/13 paging/5 final samples.
The populated workload reaches all 60 Browse/20 SQL pages before failing. No
5-GB CSV completion or passing strict runtime-log scan is claimed for this run.

A diagnostic-only first/last residency report reproduces the failure, not an
unchanged retry to green: profile `out/integration-profile-V3Zm1L`, growth
82,309,120 bytes. Initial host/helper 152,317,952 /124,215,296 bytes; final
162,435,072 /196,407,296 bytes. Helper growth accounts for 72,192,000 bytes.
Read-only independent diagnosis identifies transient allocation churn: the native
cursor hex-encodes/decodes TEXT before collectPage discards skipped offset rows;
60 Browse pages repeatedly process about 183,000 skipped 4,095-byte payloads.
No retained-page collection is found in CSV host wiring. This actual paging
failure is separate from the original CI's mislabeled import-startup measurement.

Use the existing import worker's `maxYoungGenerationSizeMb: 8` setting for the
database worker to collect transient objects promptly. Default old-generation
and large-object limits stay unchanged; no file/record cap or forced GC is added.
The failing populated 60/20 workload remains the regression. Both failures stay
recorded. Independent follow-up finds no concrete defect in the worker change or
the diagnostic reporting; it does not run competing tests.

Worker-repair focused host regression PASS (394,157 ms), profile
`out/integration-profile-iua2rB`, native Node v24.21.0, both populated sizes,
complete-data SQL and identical source hashes, 60 Browse/20 SQL pages per size:

- 1,000,013,832 source bytes /244,144 rows: peak 395,177,984 bytes, paging growth
  31,555,584 bytes; 133 samples, 75 import/55 browser, 5 baseline/35 paging/5 final.
  Maximum sample gap 821.5047 ms; first DOM 808.3289 ms; host timer gap 46.6835 ms.
- 5,000,003,592 source bytes /1,220,704 rows: peak 394,162,176 bytes, paging growth
  44,941,312 bytes; 568 samples, 420 import/145 browser, 5 baseline/36 paging/5 final.
  Maximum sample gap 702.1188 ms; first DOM 454.3842 ms; host timer gap 42.4599 ms.
- Cross-file peak-growth check passes with the same 50-MB limit. Renderer peaks
  429,088,768 /403,947,520 bytes remain separate from the guarded host/helpers.
- Strict runtime-log scan passes with exactly one approved record: source
  `20261015T155602/window1/renderer.log:9`, original severity `warning`,
  `VSCODE-HOST-001`, exact message `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
  This focused host run is not warning-free.

Strengthen the existing 16-MiB record case: requesting the full cell must return
the explicit 4-MiB page-payload refusal, then a query of its exact length and
endpoints succeeds on the same client. Focused check passes and independent
review finds no concrete defect. This tests worker survival without adding an
8-MiB record limit or weakening the existing payload budget.

Final worker-candidate canonical gates PASS:

- `npm run verify`: 666 tests/64 files, 194.88-second units, strict host/webview/
  tooling types, lint, production build and 28-file/670.84-KB package. Zero errors
  and zero warnings. This includes the strengthened 16-MiB refusal/recovery case.
- `npm run verify:full`: 666 tests/64 files (190.72-second units), every standalone
  check, integration compilation, all 57 real-host cases (14 minutes), then the
  strict runtime-log scan. Profile `out/integration-profile-2NTUCC`; VS Code
  1.140.0 /Node v24.21.0 /Windows x64. No competing workloads or unchanged retries.
- Native/fallback import controls, exact int64, paging, source safety, independent
  cancellation/recovery pass. First DOM 354.2382 /192.8190 ms; primary cancel
  42.7050 ms. Existing SQLite 1/5-GB memory/source tests also pass with peaks
  272,351,232 /285,028,352 bytes and 12,677,120-byte cross-file peak growth.
- CSV calibration: one million rows, 60 Browse/20 SQL pages, peak 326,635,520,
  paging growth 393,216 bytes; 50 samples, 26 import/22 browser, 5/12/5 phase
  observations, maximum gap 776.0070 ms. Renderer 978,595,840 bytes is separate.
- Populated 1-GB CSV: 1,000,013,832 bytes /244,144 rows, complete-data SQL and
  all 80 pages PASS. Peak 428,367,872 bytes; paging growth 33,869,824 bytes.
  136 samples, 77 import/56 browser, 5 baseline/35 paging/5 final observations.
  Maximum sample gap 895.3063 ms; first DOM 229.5558 ms; host timer gap 37.7110 ms.
  Renderer peak 624,766,976 bytes remains separate.
- Populated 5-GB CSV: 5,000,003,592 bytes /1,220,704 rows, complete-data SQL and
  all 80 pages PASS. Peak 368,214,016 bytes; paging growth 36,433,920 bytes.
  526 samples, 381 import/143 browser, 5 baseline/38 paging/5 final observations.
  Maximum sample gap 744.1852 ms; first DOM 501.8770 ms; host timer gap 42.5171 ms.
  Renderer peak 541,937,664 bytes remains separate. Cross-file peak-growth passes.
- Both sources retain their exact before/after SHA-256: 1-GB
  `d9ca2d901ce394b65f350d58e6acfb7aa5de1ff6c709ef59cc165cfb0de68789`;
  5-GB `350d6e4f39ac41dfa814bb65b80c11f24ff58469c4df6beb8d2b6888cb871e68`.
  Scope remains warm populated single-TEXT-column CSV, sampled host/helpers with
  renderer separate; physical paint and unsampled peaks are not claimed.

The final full runtime scan has exactly one approved diagnostic: source
`20261015T161408/window1/renderer.log:10`, original severity `warning`,
`VSCODE-HOST-001`, exact message `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
The full run is not warning-free. All other warnings and every error still fail;
no diagnostic rule, threshold, deadline, fixture or workload is relaxed.

Local acceptance, delegated visual QA and independent review are complete. Keep
T-021 unchecked until owner push and fresh actual-candidate Windows/macOS/Ubuntu
CI pass. No owner visual-QA wait, T-022 work, release or milestone closure.

T-021 second post-push CI and native offset repair (2026-10-15):

[Run 38706558502](https://github.com/JreyForFun/lite-voyager/actions/runs/38706558502),
attempt 1, tests exact `f1be89d0437e70ae1197b73f02965e416ac59d9c`. Public GitHub
API metadata confirms Windows job 116327295157 and Ubuntu job 116327295673 PASS
their locked installs and applicable full checks. macOS job 116327295569 installs
successfully but FAILS full verification. No raw warning counts are claimed for
the successful remote jobs. The owner's macOS arm64 log passes 666 units/64 files
(76.07 seconds) and 56 host cases, then the 1-GB CSV's actual paging growth fails:
`Repeated-paging memory growth 51216384 exceeds 50 MB.`

Its five initial browser samples have host/helper 127,582,208 /90,587,136 bytes;
final samples reach 151,535,616 /117,850,112 bytes. Host grows 23,953,408 bytes
and helper 27,262,976 bytes. All 60 Browse/20 SQL pages complete before failure.
The macOS calibration passes, but no 5-GB CSV completion or successful strict
runtime-log scan is established. Keep this run failed; no unchanged retry.

The existing small nursery reduced growth but does not remove needless work:
collectPage discards offset rows after the native cursor hex-decodes their TEXT
into Buffer/string objects. A failing-first regression reads 100 rows at offset
6,000 from 7,000 populated 4,095-character rows: 6,101 decoder calls instead of
101 (including existing lookahead). Its companion one-execution/fidelity case
already passes. Do not raise memory limits or move the settled baseline.

Add an optional worker-only Cursor.skipRows operation, used after page-address
validation. Native skips advance the same raw iterator and report actual skipped
rows before TEXT decoding. Fallback keeps its original streaming path. A first
candidate exposes native iterator restart after exhaustion, failing both past-end
total checks; guard exhaustion explicitly instead of weakening those assertions.
The corrected 20 focused native/fidelity/legacy-memory/phase tests pass. Exact-end
and empty-result assertions are also added before final verification.

Returned/lookahead rows keep the existing fatal decoding and exact type handling.
Unrequested offset rows are traversed without value conversion; the SQL executes
once, without rewriting parameters, issuing a count query or retaining rows.
Exports never invoke skipRows and still decode every result. A fresh read-only
independent review finds no concrete defect. Build/integration compilation pass.
All memory, timing, sample-coverage and diagnostic guards remain unchanged.
Source-skip-only `npm run verify` PASS: 668 tests/65 files (234.65-second units), strict
host/webview/tooling types, lint, build and 28-file/670.90-KB package, zero errors
and warnings. This includes exact-end/empty results and the complete existing
native/fallback, large-record and export coverage.

Source-skip-only full verification PASS, before the final nursery change:
668 units/65 files (249.44-second units), all 57 hosts (13 minutes), strict logs.
Profile `out/integration-profile-EAWi3C`, Windows x64 /VS Code 1.140.0 / Node 24.21.0.
Both populated CSVs complete all exact-data/hash and 60 Browse/20 SQL page checks:
1/5-GB peaks 395,771,904 /429,641,728 bytes, paging growth 39,489,536 /42,983,424.
Sample gaps 809.2592 /972.5332 ms; first DOM 279.8724 /638.7133 ms; host timer
gaps 42.7375 /99.1710 ms. Cross-file peak-growth guard passes. Sole approved log
record: `20261015T171023/window1/renderer.log:10`, original severity `warning`,
`VSCODE-HOST-001`, exact `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
This full run is not warning-free. Its passing result is preserved separately
from the final configuration; it is not evidence of a macOS repair pass.

The 1-GB samples still show host/helper growth 21,741,568 /17,747,968 bytes.
Removing decoding reduces work, but transient raw hex/iterator allocations still
fill the worker's nursery. Independent read-only assessment favors a 4-MiB
database-worker nursery for margin against the actual macOS failure. This is
not proof of a particular RSS saving or macOS pass; more minor GC is a tradeoff.
Importer nursery stays 8 MiB, default old/large-object limits stay unchanged.
No further sampling/baseline/threshold change is made. The existing 16-MiB
record/page-refusal/exact-query-recovery test passes on this final configuration.
Independent final review finds no concrete defect, including exact-end/empty
results. Final-configuration `npm run verify` PASS: 668 tests/65 files,
238.36-second units, all types/lint/build and 28-file/670.90-KB packaging checks,
zero errors and warnings.

Final 4-MiB configuration `npm run verify:full` PASS: 668 units/65 files
(193.12-second units), all types/lint/build/package checks, integration compilation,
all 57 hosts (12 minutes), then strict runtime logs. Profile
`out/integration-profile-JKelee`, Windows x64 /VS Code 1.140.0 / Node 24.21.0.
Existing native/fallback exact cell, SQL, export, source-safety, independent-view
and cancellation checks pass. CSV controls first DOM 441.8097 /238.5373 ms;
primary cancellation 46.7189 ms. Existing SQLite 1/5-GB peaks are
234,954,752 /245,448,704 bytes; cross-file peak growth 10,493,952 bytes.

- CSV calibration: one million rows/all 80 pages, peak 287,137,792 bytes, paging
  growth 1,167,360 bytes. 50 samples, 28 import/20 browser, 5 baseline/10 paging/
  5 final; maximum gap 693.7427 ms. Renderer peak 960,978,944 bytes is separate.
- 1-GB CSV: 1,000,013,832 bytes /244,144 rows, exact full-data SQL and all
  60 Browse/20 SQL pages PASS. Peak 373,563,392 bytes; actual paging growth
  31,764,480 bytes. 139 samples, 89 import/47 browser, 5 baseline/26 paging/5 final.
  Maximum sample gap 714.6748 ms; first DOM 255.3729 ms; host timer gap 43.6710 ms.
  Renderer peak 636,588,032 bytes is separate.
- 5-GB CSV: 5,000,003,592 bytes /1,220,704 rows, exact full-data SQL and all
  60 Browse/20 SQL pages PASS. Peak 404,877,312 bytes; actual paging growth
  26,832,896 bytes. 480 samples, 378 import/100 browser, 5 baseline/24 paging/5 final.
  Maximum sample gap 661.8453 ms; first DOM 457.2054 ms; host timer gap 35.7311 ms.
  Renderer peak 622,387,200 bytes is separate. Cross-file peak growth 31,313,920
  bytes passes the unchanged 50-MB guard. No sample/window/identity check changes.
- Before/after source bytes and SHA-256 stay exact: 1-GB
  `d9ca2d901ce394b65f350d58e6acfb7aa5de1ff6c709ef59cc165cfb0de68789`;
  5-GB `350d6e4f39ac41dfa814bb65b80c11f24ff58469c4df6beb8d2b6888cb871e68`.
  The warm single-TEXT-column/sampled host+helper scope remains; renderer is
  separate. Physical paint, unsampled peaks and a repaired macOS pass are not claimed.

The final full log scan accepts exactly one record:
`20261015T173711/window1/renderer.log:10`, original severity `warning`,
`VSCODE-HOST-001`, exact `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
This final full run is not warning-free. Earlier source-skip-only full has its
separate exact record above. Every other warning and every error still fails.

Final local acceptance and independent review pass; unchanged delegated visual QA
remains valid. All old failures and every memory/timing/sample/diagnostic guard
remain. Keep T-021 unchecked only for owner push and fresh actual-candidate
Windows/macOS/Ubuntu CI. No owner visual-QA wait or T-022 work.

#### T-021 repaired-candidate CI confirmation and closure (2026-10-15)

Owner supplies [run 38718762528](https://github.com/JreyForFun/lite-voyager/actions/runs/38718762528)
as PASS. Public GitHub API metadata independently confirms attempt 1, completed
success, at `e97ea5724757a66293382d7de46e7ffce2b6486c`, matching local HEAD and
the final native paging/nursery repair:

- macOS job 116367823036: locked install and Windows/macOS full verification PASS.
- Ubuntu job 116367823496: locked install and Linux session-bus/virtual-display
  full verification PASS.
- Windows job 116367823508: locked install and Windows/macOS full verification PASS.

This establishes repaired actual-candidate CI on all three platforms. Remote raw
logs, test counts and warning counts were not retrieved; do not describe these
remote runs as warning-free. Preserve all previous failed candidates, local
measurements, exact approved warning records and observation limits above.
Local acceptance, delegated visual QA and independent review pass. Closure changes
only documentation. Fresh closure-only `npm run verify` PASS (exit 0): 668 tests/
65 files, 194.88-second units, all strict type/lint/build checks and 28-file/
670.9-KB packaging, zero errors and warnings. No unchanged full retry is needed
for documentation-only records; the actual implementation's local full and fresh
three-platform CI evidence remain valid. T-021 is checked and complete. T-022,
later formats, whole-Milestone-2 QA/review and release/tag remain open; owner
retains pushing.

#### T-020 CSV / TSV preview implementation (2026-10-14)

Owner authorizes decisions, fixture edits and needed repairs, then explicitly
selects T-020 only. Scope: format-neutral loader types and read-only CSV/TSV
preview command; no import, storage service, other format or opening menus.

Acceptance coverage:
- `test/unit/file-loader.test.ts`: strict common contract accepts non-CSV preview
  metadata, without inventing CSV delimiter/header fields.
- `test/unit/csv-preview.test.ts`: real worker, exact BOM/CRLF/multiline/Unicode,
  unsafe integers/REAL/date/leading-zero text, >1-MB cells, 1,000 columns, empty
  and header-only files, generated headers/ragged/blank records, internal options,
  explicit whole-row/payload/record/column limits, tiny byte boundaries, missing/
  directory/binary/invalid-UTF-8 inputs, cancellation, crash/invalid replies and
  reopening. Sparse 3 GB returns 100 complete rows after reading 65,536 bytes.
- `csv-preview-snapshot.test.ts`: real reads/descriptors/metadata with injected
  post-read replacement/deletion; stale rows rejected and source handles closed.
- `csv-preview-ui.test.ts` and shared `browser-grid.test.ts`: bounded unknown
  messages, correct host direction, sparse/oversize/phase-coercion rejection,
  nonce CSP/escaped names, safe complete selected text, distinct missing/empty/
  literal NULL, context/cancel guarding and existing keyboard/virtualization.
- `csv-preview-panel.test.ts`: independent views, late success, cleanup/errors,
  unsupported schemes, full command timing, secure startup and failed/closed
  transport without reader leaks.
- `src/test/csv-preview.test.ts`: three real-host cases for command/editor tab,
  retained default text association, worker/message/CSP/DOM/source safety,
  sparse-file timing and cancel/error/close/recovery.
- Extended `dependency-audit.test.ts`: inspect actual parser worker, complete
  MIT notice and package exclusions. Its missing inventory first failed.
  No locked dependency or static fixture changes; new fixtures are disposable.

Retained failures and repairs; no retry-to-green:
- Initial sandbox Vitest startup failed `spawn EPERM`. Authorized process access
  observed missing modules before implementation. Reader tests exposed blank
  records. Enlarge the oversized fixture beyond one read chunk so early-stop I/O
  remains measurable; keep the bound/assertion intact.
- Red regressions exposed host-guard omission, missing-file guidance, bare CR at
  row 100 and omitted panel-creation time; strict typing exposed CSV-only common
  metadata. Later cases exposed array phase coercion, worker/snapshot failures.
  Strict checks also caught parser typing/import and an untyped matcher; repair
  them without lint suppression or unsafe casts.
- First full: 564 unit/52 host cases passed but the gate FAILED on
  `integration-profile-dXrSf7/logs/20261014T143355/window1/exthost/exthost.log:6`,
  original severity `warning`: `jreyinnovarev.lite-voyager created a webview
  without a content security policy: https://aka.ms/vscode-webview-missing-csp`.
  Its approved HOST-001 warning was `window1/renderer.log:10`. Passing tests do
  not make that run green. One focused test command overlapped part of its SQLite
  observation; do not use it as final benchmark evidence. Final full runs alone.
- Installed VS Code source confirms options updates send current HTML; initial
  HTML was empty. A failing regression captured it. Configure scripts/roots at
  creation. First focused repaired probe passed three cases but its log gate
  FAILED on `integration-profile-n2O5JO/logs/20261014T144831/main.log:8`, severity
  `error`: `Blocked vscode-webview request vscode-webview://06iqv2d9elcg6hh2ss0aqr70naobe63r0bur4877b8uv8dj0hrs2/index.html?id=60e678cf-5e89-4ceb-8280-9dc85d4ffaec&parentId=1&origin=922eef37-7aa7-4925-b314-afb5b46bc667&swVersion=6&extensionId=jreyinnovarev.lite-voyager&platform=electron&vscode-resource-base-authority=vscode-resource.vscode-cdn.net&parentOrigin=vscode-file%3A%2F%2Fvscode-app`.
  Its HOST-001 warning was `window1/renderer.log:9`. Another failing regression
  captured returning/reading before transport readiness. Await the typed loading
  handshake, retaining immediate cancel and all closure assertions.
- Corrected focused probe `integration-profile-MOQ7XC` passes all three cases and
  full log scan with zero errors/warnings; first DOM 297.103 ms. A later full
  stopped at the new matcher lint error; typed assertions repair it. One automatic
  permission-review timeout prevented a command starting; permitted retry starts.

Final `npm run verify:full`: strict types/lint, 572 unit tests/52 files, builds,
24-file/646.33-KB VSIX dry run and 52 real-host cases pass on Windows x64,
VS Code 1.140.0 / bundled Node 24.21.0. Sparse 3 GB CSV first-row DOM is 212.230 ms,
65,536 bytes read, 100 cached rows. DOM readiness is not physical paint. Existing
SQLite 1/5-GB hashes/scans/pages/sampled memory and 540/600-second budgets pass.

Final full is NOT warning-free. Its only accepted record:
- Source: `integration-profile-8Lzpli/logs/20261014T151322/window1/renderer.log:10`
- Original severity: `warning`; rule: `VSCODE-HOST-001`
- Exact message: `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`

No HOST-002/003/004 occurs in the final run. No other warning or any error is
accepted; CSP/blocked-request failures gain no exception. Earlier clean standalone
verify passed 560 cases. Final standalone `npm run verify` passes 572 tests in
52 files, strict types/lint, production builds and the 24-file/646.33-KB package
check, with zero errors/warnings. The retained local preview is
`out/t020-preview/lite-voyager-t020.vsix`; packaging/asset inspection is local,
not an owner-installed or physical-preview claim.

T-020 retained VSIX inspection: 24 ZIP entries and all 18 runtime assets match
the verified `dist` build byte-for-byte by SHA-256. Artifact SHA-256:
`BF6CD3283A9F6062531550D45181ACFC7C087D877A1B88C2A219F70B2308D3A2`.

Owner preview/install steps and every task file: `docs/t020-preview.md`.
Subsequent owner evidence (2026-10-14): installed extension in VS Code 1.141.1
matches the verified runtime, is enabled, and its manifest includes the preview
command. Owner explicitly reports `T-020 visual checks 1–5: PASS` for the guide's
complete checklist: ordinary text opening, multiline cell inspection, generated
headers/ragged fields, keyboard/theme/resize/scroll, errors/cancel/reopen, honest
limits and unchanged source. These are owner observations, not new automated
measurements or cold-paint/cross-platform evidence.
T-020 remains unchecked pending fresh review. New-code three-platform
CI and cold paint are unclaimed. Full import performance remains T-021.
No other Milestone 2 task is implemented.

T-020 first post-push CI (2026-10-14):
[run 38539935087](https://github.com/JreyForFun/lite-voyager/actions/runs/38539935087),
attempt 1 at `256ebb273ef273e2b37b72223380a1be2974e8b5`, FAILS overall.
Public GitHub API metadata confirms locked installs succeeded on all three
platforms; Windows/macOS full-verification steps succeed, Ubuntu's full step fails.
The owner-pasted Ubuntu log passes 572 unit tests and 52 host cases, including
all three T-020 cases (sparse 3 GB first DOM 59.040 ms, 65,536 bytes, 100 rows).
The console contains 30 errors from
`gpu/command_buffer/service/shared_image/shared_image_manager.cc:395`:
`SharedImageManager::ProduceMemory: Trying to Produce a Memory representation from a non-existent mailbox.`
They occur during T-012 before T-020; the strict gate correctly fails despite
host exit 0. No error exception or retry-to-green is authorized. The existing
test configuration already supplies `--disable-gpu`; the cause/repair is not
yet established. Remote raw runtime logs were not independently downloaded.
Local historical passes and owner QA stay valid; current three-platform CI and
fresh review remain open.

Focused Ubuntu 24.04 WSL diagnostics (2026-10-14), not replacement CI:
- Owner's installation permission covers Xvfb/Xauth, VS Code runtime libraries
  and libatomic1 in the existing distro, plus a checksum-verified portable Node
  26.5.0 in `out/t020-linux`. An isolated source archive is exactly pushed HEAD.
  Locked npm installs emit the existing glob@10.5.0 deprecation and pending
  vsce-sign/esbuild install-script warnings; scripts stay disabled. These setup
  commands are not warning-free verification. No project dependency is changed.
- First probe uses Windows-mounted source/tools and original tests/limits.
  Profile `out/t020-linux/project/out/integration-profile-Gpo9Us`: four of six
  selected cases pass; T-012 native first rows 2171.780 ms fails the 2000-ms bound,
  and its ten-million-row case exceeds the unchanged 60000-ms test deadline.
  T-020's three cases pass (sparse first DOM 280.729 ms). Strict logs also reject
  `20261014T173627/window1/renderer.log:2`, original severity `warning`:
  `Creation of workbench contribution 'workbench.contrib.remoteStatusIndicator' took 23ms.`
  Test-runner errors remain failures. The accepted HOST-001 record is renderer
  line 18 with its exact CloudSandboxApi message above; no other family is added.
- Native `/tmp` source copy, unchanged tests/limits, profile
  `/tmp/lite-voyager-t020-linux-vYyqgP/out/integration-profile-DhdKoN`: five of six
  cases pass. T-020 sparse rows render in 199.934 ms, but the case later exceeds
  its unchanged 15000-ms total deadline; the stalled stage is not established.
  Test-runner errors fail the log gate. The exact HOST-001 message above is
  accepted at `20261014T174835/window1/renderer.log:14`. WSL subsequently clears
  `/tmp` between sessions, preventing an instrumented startup there; tool output
  preserves the failure, but that temporary profile is no longer on disk.
- Persistent source copy `/home/pengging/lite-voyager-t020-ci.hFKC34` links only
  to the already installed tools/cache. Add stage timestamps to its compiled
  sparse test only; preserve every assertion/deadline and production byte.
  Six selected T-012/T-020 cases pass, with no GPU mailbox error reproduced.
  Sparse setup 12.107 ms; first DOM 251.638 ms, 65,536 bytes and 100 rows;
  session closure 266.686 ms and removal 270.633 ms from test start.
  Profile `out/integration-profile-tRiwYa`, exact accepted HOST-001 message above
  at `20261014T175727/window1/renderer.log:17`, original severity `warning`.
  This focused run is NOT warning-free and is not a full verification or repair.
  The earlier timeout's cause remains unknown; a later pass does not erase it.

No extension, test-source, configuration, fixture or diagnostic-policy change
is made from these observations. GPU failure is not reproduced or repaired;
the first GitHub CI failure and both failed local probes remain valid evidence.
Next fresh-context investigation should exercise the full preceding webview
sequence and inspect the actual Linux renderer/graphics state before proposing
a tested repair. T-020 stays unchecked; owner QA remains PASS.

T-020 continued investigation and independent review (2026-10-14):
The owner explicitly keeps repairs in this chat and authorizes a separate
fresh-context review agent here, satisfying section 6's independent review
without starting T-021. The reviewer reads the actual T-020 diff and acceptance
criteria; no production edits or heavy benchmarks are delegated.

- Broad original webview sequence, profile `out/integration-profile-9VpVZQ`,
  passes 22 of 23 cases; the BOM preview case exceeds its unchanged 15000-ms
  deadline. Sparse first DOM is 272.917 ms. No mailbox error is reproduced.
  Exact HOST-001 message above, severity `warning`, is at
  `20261014T181624/window1/renderer.log:17`; test errors still fail.
- A Mesa software-rendering experiment initially fails to remove `--disable-gpu`
  because its replacement misses CRLF. Profile `out/integration-profile-CPBo7l`
  passes 23 cases with the original flag still present (sparse 330.198 ms).
  This is not evidence of a backend change. Exact HOST-001 message above,
  severity `warning`, is at `20261014T183747/window1/renderer.log:17`.
- Corrected experiment removes that flag only in the isolated copy and sets
  Mesa's documented `LIBGL_ALWAYS_SOFTWARE=true`. Profile
  `out/integration-profile-YQnd4P` fails: 22 of 23 cases pass; BOM again exceeds
  15000 ms, and Chromium emits `gpu/ipc/client/command_buffer_proxy_impl.cc:285`:
  `ContextResult::kTransientFailure: Failed to send GpuControl.CreateCommandBuffer.`
  Exact HOST-001 message above, severity `warning`, is at
  `20261014T184211/window1/renderer.log:17`. This configuration is rejected and
  is NOT applied to the repository. All earlier failures remain recorded.
- Independent review confirms two reader defects: decoding an entire fetched
  chunk validates bad UTF-8 beyond a completed preview; opening a POSIX FIFO
  can block indefinitely before regular-file validation and worker termination.
  Red regressions precede line/budget-bounded decoding, regular-file preflight,
  POSIX nonblocking open and descriptor-snapshot comparison. A further red
  astral-code-point carry case precedes the one-unit decoding slack fix.
  Windows and Linux each pass 38 focused reader/snapshot cases afterward.
- Review confirms a third defect with an undismissed error notification:
  failed transport closes its panel but leaves `open()` pending indefinitely.
  Three new regressions fail for remote/construction/transport errors before
  removing the notification-dismissal wait; all 48 reader/controller cases pass.
  The reviewer independently confirms all three fixes and finds no further
  concrete defect. This does not attribute or fix Chromium's CI mailbox error.
- Stage tracing with the original GPU flag restored, profile
  `out/integration-profile-T0sxFl`, passes all 23 selected cases. BOM text open,
  preview initialization, worker exit, rendered rows, disposal, closure,
  close-all-editors and source removal all settle. Sparse first DOM is
  281.347 ms; closure/removal are prompt. The strict log gate still FAILS on
  `20261014T185409/window1/renderer.log:2`, severity `warning`:
  `Creation of workbench contribution 'workbench.contrib.remoteStatusIndicator' took 23ms.`
  Exact HOST-001 message above, severity `warning`, is at renderer line 18.
  The earlier intermittent timeout cause remains unconfirmed. No new diagnostic
  family is accepted; none of these probes is warning-free full verification.

All persistent profiles above are under
`/home/pengging/lite-voyager-t020-ci.hFKC34`; helpers and original mounted tools
are in ignored `out/t020-linux`. Source repairs are reviewed, but final local
verification and fresh three-platform CI remain required. The GPU cause remains
unresolved, and the T-020 checkbox stays open.

Repaired-source Windows `npm run verify` passes strict host/webview/tooling
types, lint, all 586 unit tests in 52 files, production builds and the
24-file/646.48-KB VSIX dry run, with zero errors and zero warnings. Fourteen
regressions were added to the existing files; no test was weakened, removed or
skipped. Full verification is still pending at this point.

Repaired-source Windows full attempt, profile `out/integration-profile-0YryqQ`,
retained in `out/t020-preview/t020-review-full.log`, FAILS after 586 passing
unit tests and 50 passing host cases. The unchanged T-016 preflight requires
9 GB free; Windows reports about 2.7 GB during this run. T-020's 3 GB fixture
then fails with `ENOSPC: no space left on device, ftruncate`. Neither threshold,
workload nor assertion is relaxed. Its accepted severity `warning`, HOST-001
exact message above, is at `20261014T191244/window1/renderer.log:10`;
test-runner errors still fail. This run is not warning-free and is not a pass.

Free space subsequently recovers to about 9.6 GB without the assistant deleting
files; the reason for that external-state change is not established. A new
Windows OS-attribute regression proves that ordinary truncate does NOT make
the supposed sparse CSV fixture sparse (`False`, expected `True`). The test
precedes a disposable-test-only helper using Windows' built-in `fsutil sparse
setflag` before truncation; both unit and host 3 GB fixtures use it, preserving
their size, rows, byte-read bounds and timing assertions. POSIX truncation
remains sparse, checked through allocated blocks. Official behavior:
[Microsoft fsutil sparse](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/fsutil-sparse)
and [FileAttributes.SparseFile](https://learn.microsoft.com/en-us/dotnet/api/system.io.fileattributes).
The helper uses exclusive creation, closes handles in finally, and does not
ship or introduce an extension dependency. Windows focused reader/fixture
checks pass 37 cases. Independent review finds the remaining unflagged unit
fixture and it is routed through the same tested helper without weaker checks.

To restore test headroom, remove only 355 old generated profile browser-cache
directories after verifying their resolved paths remain inside workspace out,
their fixed cache names and the signed-out development-fixture publisher.
All logs, settings, test data, source files and current profiles are retained.
Manifest: `out/t020-linux/cleared-cache-paths.json`; C: has 9,901,101,056 free
bytes afterward. No user files or old failure evidence are deleted. Final
verification of the corrected fixture and repaired source is pending.

Final corrected-source Windows full gate PASSES (`out/t020-preview/t020-repair-full.log`):
strict types/lint, 587 unit tests/53 files, production builds, 24-file/646.48-KB
VSIX dry run and all 52 real VS Code 1.140.0 host cases. The populated
1,285,033,984-byte and 5,874,388,992-byte SQLite fixtures, source hashes, complete
scans, grids and original 540/600-second budgets pass (354,535 ms workload).
Sampled extension/helper peaks are 270,188,544 and 280,723,456 bytes; file-size
memory growth is 10,534,912 bytes. T-020 genuine sparse 3 GB first-row DOM is
237.054 ms, reading 65,536 bytes and caching 100 rows. DOM is not physical paint.
All confirmed review findings, including both sparse fixtures, are independently
cleared. No source change follows this passing gate.

This full run is NOT warning-free. Its only accepted record:
- Source: `integration-profile-UfrsrS/logs/20261014T193346/window1/renderer.log:10`
- Original severity: `warning`; rule: `VSCODE-HOST-001`
- Exact message: `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`
No HOST-002/003/004 or other warning/error occurs in the complete log scan.
The earlier space/fixture failure remains a failure. Native Linux full and
fresh actual-candidate three-platform CI remain pending; no GPU repair is claimed.

Native Linux full setup attempt is retained as
`/home/pengging/lite-voyager-t020-ci.hFKC34/out/native-full-setup-failure.log`.
Types pass, but ESLint 10.12.0 correctly fails when a copied tool directory
outside ignored paths exposes VS Code's `ms-vscode.js-debug-companion/eslint.config.mjs`
and its unavailable `@eslint/js` dependency. This is a setup/layout defect,
not a completed Linux validation. Relocate only generated tool folders into
the existing `out` and `.vscode-test` locations; preserve that failure, the
original lint configuration and all assertions. Node and locked packages are
now native; VS Code 1.140.0 is downloaded through the installed official
test-electron package. No product dependency or additional lint ignore is added.

The next native attempt passes types/lint and 586 of 587 unit cases; it fails
only `fixture-generator.test.ts`'s existing T-005 Git-ignore contract because
`git archive` omits `.git`. Preserve `out/native-full-git-setup-failure.log` in
the isolated copy. Initialize private local Git metadata there, confirm both
generated-output paths are ignored, and rerun the unchanged full gate. No
test, ignore rule, application source, remote or owner's repository is altered
to accommodate the copy. All Linux setup failures remain failures.

Native Linux's corrected setup passes strict types/lint, all 587 unit cases
in 53 files, production builds and packaging. Its full host run, profile
`out/integration-profile-CZ8L92`, is interrupted while generating the unchanged
multi-GB T-016 fixtures: `tee: out/native-full.log: Read-only file system` and
VS Code exits `SIGBUS`. This is a FAILED/incomplete Linux full, not replacement CI.
Preserve the partial raw log as `out/t020-linux/native-full-io-failure.log` in
the Windows workspace and `out/native-full-io-failure.log` in the isolated copy.
The final termination is also captured in tool output. No graphics error cause
or successful Linux large-file gate is inferred from this interruption.

Subsequent WSL commands observe a restarted distro: root `/dev/sdd` is mounted
read/write; boot diagnostics record an unclean journal shutdown. A write probe
confirms recovery. Remove only the verified disposable
`out/t016-memory-N1zhBR` fixture directory (1,285,033,984-byte small database,
5,279,277,056-byte unfinished large database and its 9,728-byte journal), after
preserving the failed log. No user's Linux files are removed. `fstrim -v /`
discards unused guest blocks, but the non-sparse 12,417,236,992-byte Ubuntu VHDX
still occupies host space; C: has about 3.6 GB free. Current Windows token is
not Administrator and Optimize-VHD is unavailable. Prepare a guarded,
owner-run Administrator PowerShell compaction script in ignored
`out/t020-linux/compact-test-distro.ps1`; its syntax is parsed, but no disk
compaction or forced distro shutdown has been executed. It selects only the
registry-verified Ubuntu disk, attaches read-only, compacts unused blocks and
detaches; no formatting/deletion operation exists. Official compaction semantics:
[Microsoft compact vdisk](https://learn.microsoft.com/windows-server/administration/windows-commands/compact-vdisk).
The cause of the WSL restart/read-only episode remains unconfirmed; optional
owner clarification is pending. Further complete Linux large-file runs require
restored host space and a stable environment; existing budgets remain intact.

T-020 bounded post-recovery graphics experiment, profile `GaZF20`, replaces
`--disable-gpu` only in the isolated copy with the documented
`--ozone-platform=x11` and uses Mesa `LIBGL_ALWAYS_SOFTWARE=true`.
All 23 selected cases pass, including genuine sparse 3 GB preview first DOM
226.490 ms, 65,536 bytes read and 100 rows. The strict diagnostic gate FAILS:
`gpu/ipc/client/command_buffer_proxy_impl.cc:285` reports
`ContextResult::kTransientFailure: Failed to send GpuControl.CreateCommandBuffer.`
The accepted record is `VSCODE-HOST-001`, original severity `warning`, at
`integration-profile-GaZF20/logs/20261014T201728/window1/renderer.log:14`:
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
Preserve `out/x11-mesa-probe.log` in the isolated native copy. This experiment
is rejected, the isolated configuration is restored by its exit trap, and
the owner's root configuration is unchanged. The original mailbox error is
still not reproduced; no graphics repair or Linux full pass is claimed.

Independent read-only review of the ignored compaction helper identifies
unchecked final detachment. Repair it to retain all three operation logs,
check detachment failure before completion metrics and refuse overwriting
prior operation logs. Follow-up clears the finding; PowerShell syntax parsing
reports zero errors. No compaction or forced shutdown is executed by the agent.

T-020 final repaired standalone verification PASSES. Run the unchanged
`scripts/verify.mts` entry point used by `npm run verify`; raw output is
`out/t020-preview/t020-repair-verify.log`. Strict host/webview/tooling types,
lint, all 587 unit tests in 53 files, production builds and the 24-file,
646.48-KB VSIX dry run pass with zero errors and zero warnings. No runtime
source change follows either this run or the passing Windows full gate.
Stage only the 11 reviewed repair/evidence files; leave the owner's pre-existing
T-015 hunks and unrelated untracked files untouched. Fresh actual-candidate
three-platform CI and the Linux diagnostic failure remain open in this chat.

T-020 owner recovery evidence (2026-10-14): owner explicitly reports no
intentional WSL restart during the interrupted full run; its originating
filesystem/restart cause remains unconfirmed. The owner then runs the reviewed
compaction helper in Administrator PowerShell and pastes successful read-only
attachment, compaction and detachment. Retained operation logs corroborate
completion. VHD bytes decrease from 12,417,236,992 to 5,906,628,608;
C: free bytes are 10,061,910,016 in the pasted output. This restores test
headroom without deleting allocated Linux files. Resume the unchanged Linux
full after checking its writable filesystem, with original GPU configuration,
all workloads/assertions/deadlines and prior failure evidence preserved.
Use a new `out/post-compaction-full.log` in the isolated native copy, never
overwrite the earlier read-only/SIGBUS failure or substitute a later pass for it.
Post-compaction checks observe root `/dev/sdd` mounted read/write and a successful
temporary write probe. All 186 tracked runtime, test, fixture and verification
files match the reviewed workspace: only Git's CRLF/LF text conversion is
normalized, while binary fixture bytes must match exactly. The resumed run
uses native Node 26.5.0 and unmodified locked dependencies/VS Code 1.140.0.

T-020 resumed unchanged Linux full FAILS/incompletes, profile `4bvgAe`:
types/lint, all 587 unit tests in 53 files, production builds and VSIX dry run
pass; host output records a failed native T-002 live-WAL case but the command
exits 1 during subsequent multi-GB fixture generation, before the final failure
summary. The exact WAL assertion/reason is unavailable and must not be guessed.
The original mailbox error is not reproduced before interruption. Preserve
`out/t020-linux/post-compaction-full-failure.log` and
`out/t020-linux/post-compaction-profile-logs.tar` in the Windows workspace,
plus original `out/post-compaction-full.log` and profile in the isolated copy.
This is not a complete Linux pass or replacement CI. No new runtime defect
or source repair is inferred from an interrupted run.

C: free bytes fall to 69,865,472 while the Ubuntu VHD grows from
5,906,628,608 to 7,785,676,800 bytes (later observed 7,819,231,232).
Windows reports a 15,477-MB allocated paging file, 4,832 MB in use and
5,347 MB peak use. No earlier paging-allocation baseline was captured;
these observations do not prove the complete cause of the space loss.
Subsequent Ubuntu inspection finds no active test processes, a writable root
and boot journal evidence of an unclean shutdown. Preserve that interruption;
do not retry the full workload under renewed host pressure.

Emergency recovery removes only resolved, nonlinked, obsolete generated
mounted Linux `out/t020-linux/tools`, `project/node_modules` and
`project/.vscode-test/vscode-linux-x64-1.140.0`. Native tools/dependencies,
all application sources, user files and every retained diagnostic log stay.
Manifest: `out/t020-linux/removed-unused-mounted-tools.json`; C: free bytes
recover to 1,637,785,600 (later 1,394,388,992). After archiving the new log/profile,
remove only the exact verified native `out/t016-memory-Q0KxBs` disposable
fixture directory: 1,285,033,984-byte small database, 511,713,280-byte unfinished
large database and 9,728-byte journal. `fstrim -v /` discards unused guest blocks.
Prepare `out/t020-linux/compact-after-test.ps1` for the owner to reclaim those
blocks with Administrator rights. Independent review confirms only its separate
fixed log directory and directory creation differ from the prior reviewed
helper; exact disk/distro guards and checked/logged detachment remain intact.
Parsing has zero errors. No second compaction is executed by the agent.

Owner says repair commit `7748ac0` is not yet pushed. Public Actions metadata
still reports the earlier `38539935087`/`256ebb2` failure; no fresh candidate
CI exists. Continue remaining Linux validation on the hosted CI runner after
owner push, preserving all assertions/budgets and these local failures. No
test or diagnostic rule is weakened and T-020 remains unchecked in this chat.
T-020 supplemental scan of the interrupted profile's retained logs passes
the unchanged strict checker with one accepted record, not warning-free:
`integration-profile-4bvgAe/logs/20261014T204652/window1/renderer.log:15`,
original severity `warning`, `VSCODE-HOST-001`, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
This partial scan cannot establish a completed full run or explain the missing
native WAL assertion. No tests are rerun for this read-only evidence scan.

T-020 second owner compaction completes successfully (2026-10-14). Pasted
output and preserved `out/t020-linux/compaction-after-full` operation logs
confirm attachment, compaction and detachment. VHD bytes fall from
7,819,231,232 to 5,907,677,184; pasted C: free bytes are 10,463,645,696.
This recovers host headroom without another test run. Prior failures stay
failed, and no originating WAL, graphics or space-loss cause is inferred.
No additional large local Linux run follows; actual-candidate hosted CI
after owner push remains the next T-020 gate.

T-020 next actual-candidate CI (2026-10-14):
[run 38572461954](https://github.com/JreyForFun/lite-voyager/actions/runs/38572461954),
attempt 1 at `ceb05b2f98110561d8a2684fb9c46aa80ed3bd32`, FAILS overall.
Public API metadata is retained in `out/t020-linux/ci-38572461954-metadata.json`.
Ubuntu job 115880911400 succeeds, including locked install and unchanged full
verification. This establishes hosted Linux full success for that candidate;
raw remote logs/counts/warnings were not retrieved, so it is not described as
warning-free or as proof that the original mailbox cause was repaired.
Windows job 115880911974 fails locked install; both verification steps are
skipped. Owner-pasted log's fatal error is `ECONNRESET`, syscall `read`, errno
`-4077`, from npm's network download. It also contains existing `glob@10.5.0`
deprecation and cleanup `EPERM` warnings; retain all of them. Do not infer a
runtime/test failure or change packages/workflow to silence this install log.
macOS job 115880911941 installs successfully but fails its full step at unit
tests: 586 pass, one fails, 52 files pass/one fails. The owner-pasted assertion
is `expected undefined to be an instance of Error` in the replacement-race
test at `test/unit/csv-preview.test.ts:79`; no host cases run there.

T-020 red-first race-injector portability repair: the reader stats its
`realpathSync` canonical source, while the test injector compared that path
with the original caller's path. Directory aliases therefore bypass the
replacement. Keep the original direct-path case and add a directory-alias
case using Windows's junction/POSIX's directory symlink. Before changing the
injector, Windows's direct case passes but the alias case fails with the exact
macOS assertion, `expected undefined to be an instance of Error`. This proves
the fixture defect locally; no production reader failure is inferred.

Canonicalize the injector's path with the same `fs.realpathSync` before its
stat hook, and additionally assert the source is no longer a regular file.
Preserve expected rejection, 1,000-ms deadline and regressed-FIFO unblocking.
All 37 CSV reader cases pass on Windows. A separately scoped small Linux run
passes the three actual nonregular/direct-race/alias-race FIFO cases (2.06 s);
other cases are excluded only by this diagnostic filter and remain in complete
verification. It launches no VS Code or large-file benchmark. Raw focused
output is `out/path-race-posix.log` in the native isolated copy.
Independent follow-up finds no concrete defect; verifies canonical matching,
mutation assertion, unchanged deadline and disposable junction/symlink cleanup.
No runtime source, locked package, static fixture, workflow or diagnostic rule
changes. Actual macOS CI confirmation and current-candidate all-platform full
remain pending; complete 588-test standalone verification is running with
raw output in `out/t020-preview/path-race-verify.log`.

T-020 final canonical-path repair standalone PASSES: unchanged `npm run verify`
entry point passes all three strict type checks, zero-warning lint, 588 unit
tests in 53 files, production builds and 24-file/646.48-KB VSIX dry run.
Complete raw output is `out/t020-preview/path-race-verify.log`; zero errors and
zero warnings. No production runtime file is changed. The prior passing
Windows full and latest hosted Ubuntu full apply to that unchanged runtime;
neither substitutes for fresh macOS/current-test three-platform CI. Stage only
the test and T-020 PROGRESS/TASKS/VALIDATION hunks, preserving all owner edits.

T-020 canonical repair actual-candidate CI (2026-10-14):
[run 38585494750](https://github.com/JreyForFun/lite-voyager/actions/runs/38585494750),
attempt 1 at `5dd4770b278d50374831bb30ac299df343a25f38`, FAILS overall.
Public API evidence: `out/t020-linux/ci-38585494750-metadata.json`.
Windows job 115926268535 and Ubuntu job 115926268197 pass their locked install
and applicable full steps. Their raw logs/counts/diagnostics were not retrieved;
do not describe them as warning-free or infer an original GPU cause repair.
macOS job 115926267769 installs and passes strict types/lint, all 588 unit
tests/53 files, builds/24-file package, integration compilation and all 52 host
cases (VS Code 1.140.0, Node 24.21.0, darwin arm64). Its T-020 sparse 3 GB first
DOM is 81.455 ms, with 65,536 bytes read and 100 rows; all three preview cases
pass. The earlier alias injector defect is confirmed repaired on actual macOS.
The owner-pasted log is retained at the provided attachment path; the strict
log gate correctly fails one additional vendor startup warning:
- Source: `integration-profile-vWQsqL/logs/20261014T150236/window1/renderer.log:2`
- Original severity: `warning`; no currently approved rule matches.
- Exact message: `Creation of workbench contribution 'workbench.contrib.remoteStatusIndicator' took 66ms.`
The same source contains two explicitly accepted warnings, not warning-free:
- Line 4, original severity `warning`, `VSCODE-HOST-002`:
  `Creation of workbench contribution 'workbench.contrib.chatLanguageModelsData' took 43ms.`
- Line 17, original severity `warning`, `VSCODE-HOST-001`:
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`

Official VS Code 1.140.0 source identifies this exact contribution and
unconditional `WorkbenchPhase.BlockStartup` registration. Its registry's
constructor-timing logger produces the observed family; the log precedes
extension-host startup. Sources: [registration](https://github.com/microsoft/vscode/blob/1.140.0/src/vs/workbench/contrib/remote/browser/remote.contribution.ts#L43),
[contribution](https://github.com/microsoft/vscode/blob/1.140.0/src/vs/workbench/contrib/remote/browser/remoteIndicator.ts#L73),
[timing logger](https://github.com/microsoft/vscode/blob/1.140.0/src/vs/workbench/common/contributions.ts#L369).
Prepare a concrete, unapplied fifth-family proposal in ignored
`out/t020-preview/host005-proposal.md`, retaining severity/source/reporting,
all other failures, budgets and no-retry-to-green. The active checker and
four-family policy are unchanged. Explicit owner policy approval is required;
functional passes do not authorize silently accepting a fifth family or
reclassifying this failed run. T-020 remains unchecked pending that decision
and subsequent current-candidate full CI. No code, dependency or launch flag
is changed while approval is pending.
The pasted macOS log is also preserved byte-for-byte as
`out/t020-preview/ci-38585494750-macos-full.log`, SHA-256
`2192F3D60D5350EEF2EF69E13DBAE2A618E412420719B403C6673ECBD9200DD8`.
Independent read-only review finds no concrete guard/source/reporting defect
in the proposal and confirms the active four-family policy is unchanged;
that review does not grant owner approval. No tests are rerun or weakened.

T-020 owner policy decision (2026-10-14): in direct response to the exact
HOST-005 approval question, owner says `Use your best judgemet. Do what's best
for now and the future.` Treat this as delegation to decide that concrete
proposal and adopt only the reviewed remoteStatusIndicator family. Persist
the fifth exact exception in section 1 and AGENTS, with unchanged source,
severity, reporting and all-other-diagnostic rejection rules. This authorizes
no blanket vendor allowance, timing-budget change or retry-to-green. The prior
macOS run remains failed under its then-active four-family policy.

Add the exact acceptance/reporting regressions first: current checker rejects
both, while 46 cases pass. Extend guard coverage to reject fractional/signed/
unknown durations, trailing text, altered contribution name, errors, extension
host log source, missing timestamp, undated session and nested renderer paths.
After adding only the HOST-005 union member and anchored message matcher,
all 48 log-policy tests pass. Console checks and existing source/severity guards
are untouched. No production runtime, dependency, launch flag or workflow
changes. Complete standalone verification and independent implementation
review are running; fresh actual-candidate three-platform full remains pending.

T-020 HOST-005 implementation follow-up is independently clear: only the
union member and exact anchored matcher are added; source/severity/timestamp
parsing and report formatter remain unchanged. All prior test cases remain.
Final standalone `npm run verify` entry point PASSES all strict type checks,
zero-warning lint, all 601 unit tests in 53 files, production builds and the
24-file/646.48-KB VSIX dry run. Raw output:
`out/t020-preview/host005-verify.log`; zero errors and zero warnings.
No subsequent checker/test/runtime change follows. Prepare only the six
reviewed T-020 policy/test/evidence files for owner push; preserve unrelated
owner hunks. Fresh actual-candidate three-platform full remains required;
old CI failures are neither erased nor retroactively described as passing.

T-020 final actual-candidate CI and closure (2026-10-14):
[run 38592857439](https://github.com/JreyForFun/lite-voyager/actions/runs/38592857439),
attempt 1 at exact `6f193683f4b7547eddeddc96f6f15ae2adeae9f7`, SUCCEEDS.
Owner reports PASS; independent public API check confirms completed/success
run and all three locked installations/applicable full-verification steps:
- Windows job 115951954520: install and Windows/macOS full step succeed.
- Ubuntu job 115951954814: install and session-bus/virtual-display full succeed.
- macOS job 115951955248: install and Windows/macOS full step succeed.
Metadata: `out/t020-linux/ci-38592857439-metadata.json`. Final remote raw logs,
test counts and diagnostic records are not retrieved; do not call these full
runs warning-free or invent per-platform warning counts. Existing exact local
and owner-pasted approved diagnostics, every failed run, budgets and no-retry-
to-green policy remain preserved. No original graphics/WSL cause repair is
inferred solely from fresh hosted success.

This clears the actual-candidate CI gate after the independently reviewed
red-first implementation/fixture/policy repairs. The verified 601-test
zero-error/zero-warning standalone, prior 52-host real runtime evidence and
owner visual QA 1-5 PASS complete the scoped T-020 acceptance. Check only T-020.
No code/test/dependency/workflow change follows the tested commit; closure
updates documents only. Whole Milestone 2, full import, cold physical paint
and production import memory/performance remain separate and unclaimed.
Next chat is T-021 planning, following AGENTS and only its linked task pack.
Owner pushes closure records; preserve all unrelated working-tree edits.

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

### T-017 sort/filter implementation and validation (2026-10-12)

Owner authorizes full scoped implementation, judgment on unspecified behavior,
fixes and disposable fixture edits; owner pushes. SPEC's T-017 acceptance and
PLAN's T-017 section record the chosen behavior. No dependency added.

Acceptance-to-test evidence:

- `test/unit/grid-query.test.ts`: quoted identifiers, bound literal values,
  count predicates without ORDER BY, malformed/sparse/duplicate controls,
  aggregate filter-text limit and conservative unknown/temp-sort plan detection.
- `test/unit/browser-engine.test.ts`: both actual backends order/filter the
  full 207-row dataset before bounded paging; second filtered page and count
  agree. Exact int64, case-sensitive literal percent/underscore/quote/emoji,
  NULL, empty/non-NULL and BLOB exclusion are covered. Quoted composite
  WITHOUT ROWID keys, 1.1-MB text, partial/expression/composite indexes, views,
  unknown columns and native FILE temp_store are checked with source hashes.
  Existing 1,000-column/page-budget fixtures remain unchanged.
- `test/unit/browser-view.test.ts`: actual rendered header activation and
  filter controls, count requests, warning/continuation/dismissal, stale replies,
  errors/cancellation retaining the successful page, controls-only state and
  restored active filter selection. Existing SQL/browser restoration stays covered.
- `src/test/sqlite-browser.test.ts`: two FR-017 real-host cases drive physical
  header buttons and filter controls on both engines, indexed ascending/descending
  order, three filtered rows/count, destroyed-tab restoration, filter removal,
  slow-view warning/continuation/Cancel, recovery and unchanged source hashes.
  No T-014 timing claim or universal large-file sorting benchmark is made.

Retained failures and repairs:

- The initial sandboxed focused test command failed at startup with `spawn EPERM`;
  approved execution outside the sandbox runs the same real child-process tests.
- Initial engine tests fail on both backends because controls were ignored
  (expected first matching descending ID `205`, got `-9223372036854775808`).
  Grid-helper tests initially fail to import the unimplemented module.
- Three initial DOM tests fail on missing sort/filter requests and persistence.
- Native temporary-storage regression expects `1` (FILE), gets `0` (DEFAULT);
  configure connection-local FILE storage, keeping the source read-only.
- State allowlisting regression reproduces unexpected `rows` fields surviving
  inside saved controls; reconstruct known fields only, including no sort consent.
- Initial real-host run: 28 pass / two T-017 failures because the disposable
  fixture's value column lacked the tested index. Both stop at the correct warning.
  Add only that index; preserve all rows/table/view workload and deadlines.
  Logs: `out/integration-profile-vgCwVb/logs/20261012T132708`.
- First full gate: 393 unit tests pass, 28 host tests pass / two T-017 failures
  (`3 !== 100` after filter removal). Restoration had selected the first column
  instead of the restored active filter. A new red-first unit test reproduces
  `id` instead of `text`; prefer the active filter column when no selection exists.
  The host assertion now waits for the unchanged expected 100 rows after removal.
  All 19 view tests pass after the repair. Logs:
  `out/integration-profile-69RAqg/logs/20261012T133201`.
- Earlier strict typecheck/lint failures (literal union widening, exact optional
  properties and unsafe library matcher values) were fixed without suppressions.

Initial candidate local `npm run verify:full` passes on Windows x64 / VS Code 1.140.0 /
bundled Node 24.21.0: 394 unit / 30 real-host tests, strict types/lint/builds and
19-file / 610.99-KB VSIX packaging. Both T-017 host cases report indexed sorting,
filtered count `3`, restored controls, sort cancellation/recovery and unchanged
source hashes. Existing SQL/editor/browser/metadata tests pass. The existing
warm generated ten-million-row browse measurement is 808.0 ms to first DOM rows,
100 cached / 15 rendered; this does not measure sorting or physical paint.

Exactly one approved host diagnostic is accepted, and explicitly reported:

- Source: `out/integration-profile-DEruJR/logs/20261012T133704/window1/renderer.log`.
- Line: `10`; original severity: `warning`; rule: `VSCODE-HOST-001`.
- Message: `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.

This full run is **not warning-free**. No error or other warning is accepted;
the diagnostic policy is unchanged. Final standalone `npm run verify` also passes:
394 unit tests, strict types/lint/build and 19-file / 610.99-KB packaging, with
zero errors and zero warnings. Subsequent independent-review repairs are recorded below.
Owner reports all six numbered T-017 QA checks PASS (record below). Fresh Windows /
macOS / Ubuntu CI was not yet supplied at that checkpoint; independent review
and delegated local closure are recorded below. Later tasks and the whole
milestone remain open. There is no multi-GB sort memory/performance claim.

Owner QA commands (choose a new fixture directory if this already exists):

```powershell
npm run verify
npm run verify:full
node scripts/browser-fixture.mts out/t017-owner-qa
```

Press F5 (`Run Extension`; its existing prelaunch task compiles), then open the
printed `browser.sqlite` path in the Extension Development Host. Report PASS /
FAIL and observations for each check:

1. On `b pages`, click `value` three times: first row `row 1`, then `row 99`,
   then unsorted `row 1`. The arrow and ascending/descending state agree.
2. Filter `value` contains `row 20`: three rows. Count rows shows `3`.
   Hide/reopen the tab: the filter survives, total returns to not counted;
   Remove column filter returns to 100 rows on page one.
3. On `a values`, nullable is NULL matches its row; empty contains empty text
   matches; bytes contains empty text matches no rows. Maximum contains
   `9223372036854775807` matches and displays that exact integer.
4. On `d view`, sort a header: warning appears before execution. Dismiss keeps
   the previous page; repeat and Continue sort succeeds.
5. On `g slow count`, sort `x`, Continue sort, then Cancel operation. Controls
   stay responsive; selecting `b pages` afterwards succeeds. Do not count the
   billion-row view as part of manual QA.
6. Use Tab and Enter/Space on headers/filter controls; inspect light, dark and
   high-contrast themes. Confirm readable controls, focus indicators and NULL/empty
   styling; verify existing SQL Run/shortcut/Browse table behavior still works.

Owner QA report (2026-10-12): the owner supplied `1 - PASS`, `2 - PASS`,
`3 - PASS`, `4 - PASS`, `5 - PASS`, and `6 - PASS`, corresponding to the six
checks above. This covers the reported sorting cycle, filter/count/restoration/
removal, NULL/empty/BLOB/int64 checks, view warning/dismissal/continuation,
slow-sort cancellation/recovery, and keyboard/theme/existing-SQL checks.
No additional observations, host version, backend or screenshots were supplied;
manual coverage of both engines is not inferred. Both-engine automated evidence,
earlier failures and the exact accepted host diagnostic remain recorded above.
The QA-record update changed no executable code; subsequent independent-review
repairs are recorded below. The whole milestone remains open.
Owner-QA-record `npm run verify` passes: 394 tests, strict types/lint/build and
19-file / 610.99-KB packaging, with zero errors and zero warnings.

T-017 independent review and delegated local closure (2026-10-12):

The owner asks the assistant to use its best judgment to complete the remaining
work and move on; the owner retains pushing. A separate Bugbot reviewer, with
no implementation chat history, reviews the actual scoped uncommitted diff and
both new files under section 6. It finds two concrete MEDIUM defects:

- Pending sort confirmation left Count/paging/page-size controls enabled. Count
  cleared the warning while unexecuted filters stayed active, permitting a new
  filtered page at the old offset with an unfiltered count. A red-first view test
  reproduces the enabled controls. They now wait for Continue/Dismiss; continuation
  retains the requested reset offset and invalidated count. Both real-host cases
  also exercise Count/Next while waiting and assert the warning/page remain intact.
- A flat AND chain exceeds SQLite's expression-depth limit with valid 1,000-filter
  controls. New real-engine tests fail on both backends before the fix. Balanced
  conjunctions preserve every predicate, bound value and the full accepted limit.
  Tests check all 1,000 returned values, the last nonmatching predicate, matching
  row counts, 1,000 NULL predicates and validator rejection at 1,001 filters.

The same independent reviewer rechecks both repairs read-only using executed
in-memory tests and both actual backends, confirms both findings resolved and
reports no remaining concrete defect. No existing assertion, workload, timeout,
limit or diagnostic policy was weakened; no dependency was added.
Canonical repaired `npm run verify:full` passes: 397 unit / 30 real-host tests,
strict types/lint/builds and 19-file / 611.06-KB VSIX packaging on Windows x64 /
VS Code 1.140.0 / bundled Node 24.21.0. Both T-017 host cases also confirm
Count/Next cannot dismiss a pending warning or change its retained page.
Exactly one approved host diagnostic is accepted:

- Source: `out/integration-profile-twKf13/logs/20261012T151223/window1/renderer.log`.
- Line: `10`; original severity: `warning`; rule: `VSCODE-HOST-001`.
- Message: `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.

This repaired full run is **not warning-free**; all other warnings and every error
remain failures. Prior failed runs and the earlier candidate's diagnostic remain
recorded. Completion-record standalone `npm run verify` passes: 397 unit tests,
strict types/lint/build and 19-file / 611.06-KB packaging, zero errors/warnings.
Local completion records belong to the task-named T-017 commit; owner pushes.
No fresh remote CI result is claimed.

Under the owner's delegated judgment, local T-017 closure follows the per-task
Definition of Done in section 2: tests/verify, source safety, current specs/plan,
updated progress and a local commit naming T-017. Fresh three-platform CI remains
required for the Milestone 1 gate after the owner's push. This does not close a
milestone, waive CI or authorize a release tag. Owner QA PASS reports are retained
for the earlier candidate; the edge-case repairs have independent and automated
validation rather than a fabricated new manual QA report.
Scoped T-017 acceptance, source-safety checks, owner QA, independent review,
current specs/plan and the required local verification pass. T-017 is checked
as complete in the local task commit. Start T-018 in a fresh chat; the remaining
milestone requirements and post-push CI confirmation stay open.

Push only the reviewed T-017 files; existing untracked `debug.log`, `gingTryWan/`
and fixture aliases were not changed. Return the CI run URL / tested commit SHA
and per-check QA results. No release tag or milestone closure is authorized here.

T-017 repaired CI confirmation (2026-10-12):

The owner supplies [run 38239600604](https://github.com/JreyForFun/lite-voyager/actions/runs/38239600604)
and reports GOOD. Public GitHub API run/job/step metadata confirms attempt `1`,
event `push`, branch `main`, status `completed`, conclusion `success`, tested
commit `dbf76f8808048d3407a25049cd95d7a5d87bfca0`, matching the local T-017 commit.
All three jobs and their locked-install/applicable full-verification steps succeed:

- [macOS job 114778656026](https://github.com/JreyForFun/lite-voyager/actions/runs/38239600604/job/114778656026):
  `Install locked dependencies` and `Verify on Windows and macOS` succeed.
- [Ubuntu job 114778656373](https://github.com/JreyForFun/lite-voyager/actions/runs/38239600604/job/114778656373):
  `Install locked dependencies` and `Verify with session bus and virtual display on Linux` succeed.
- [Windows job 114778656437](https://github.com/JreyForFun/lite-voyager/actions/runs/38239600604/job/114778656437):
  `Install locked dependencies` and `Verify on Windows and macOS` succeed.

The alternate platform-specific step is intentionally skipped in each job, as
defined by the verified workflow. Remote full logs are not independently fetched
or inspected; no remote warning count or warning-free claim is made. The exact
local host diagnostic and all earlier failed evidence remain recorded above.
The web fetch initially fails; an approved public read outside the restricted
network sandbox obtains the metadata, without authentication or writes.

This confirms fresh three-platform CI for implementation `dbf76f8`. T-017's
sorting/filtering acceptance remains complete; the whole Milestone 1 gate and
later tasks remain open, with no release tag. The record initially changes only
documentation; its required local check then exposes the startup defect below.

T-017 CI-record validation startup repair (2026-10-12):

- The first record `npm run verify` fails: 396 pass / one failure in the unchanged
  fallback `NFR-001: Given a source file, When querying or attempting a write,
  Then its bytes remain unchanged` spike test. Opening rejects with
  `The SQLite spike worker stopped. Reopen the file to recover.` The exact timing
  of that original exit was not captured. An isolated unchanged 35-test spike
  suite passes; this alone is not treated as resolution or a retry-to-green.
- Inspection finds the spike's message listener registered only after awaiting
  WASM initialization. A new deterministic NFR-002 test copies the actual bundled
  worker/engine to an isolated directory and delays its initializer with a
  100-ms unreferenced timer. It fails before the fix with the same worker-stopped
  error: the pending promise cannot keep the worker alive.
- Move the existing handler registration before the await, as the production
  DB worker already does. The host still sends queries only after `opened`;
  initialization failures close the database and port. The new regression checks
  opening, real fallback queries, unchanged source hashes and confirmed helper
  shutdown. All 36 spike tests pass after the fix.
- The separate reviewer independently runs the packaged worker three times with
  the unreferenced delay, confirms safety flags/queries/source hashes and reports
  no concrete defect. No assertions, timeouts, limits or warning rules change;
  no dependency or T-017 grid behavior changes. This is a scoped validation repair
  required to finish the record, rather than a new feature task.
- The first repaired full gate fails in the unit stage: 396 pass / two failures
  out of 398 tests, in 383.48 seconds. Both are unchanged 5-second timeouts:
  `checks.test.ts` agent=true/colors=false stderr-severity-error reporter case,
  and `csv-import-spike.test.ts` malformed closing-quote case `"a" ,b`.
  No host/build/package stages run after that unit failure. Inspection finds no
  concrete defect in these cases; host contention is possible but not proven.
  The two unchanged suites pass together (73 tests, 34.46 seconds). A sandboxed
  diagnostic invocation cannot load the config (`spawn EPERM`); the successful
  invocation uses approved process access. No deadlines or assertions change.
- After inspection and the unchanged targeted suites, full verification passes:
  398 unit tests in 34 files (77.23 seconds), strict types/lint, production build,
  VSIX dry run (19 files, 611.05 KB), integration compilation and 30 real-host
  tests on Windows x64 / VS Code 1.140.0 / host Node 24.21.0. Both real engine
  modes pass T-017 sorting/filtering/restoration/cancellation/source-safety checks.
  The earlier timeout run remains a failure with its cause unresolved; this later
  result establishes a passing run, not proof that those timeouts cannot recur.
  The full run is not warning-free: its only approved diagnostic is source
  `out/integration-profile-37FTid/logs/20261012T192908/window1/renderer.log`,
  line 10, severity `warning`, rule `VSCODE-HOST-001`, message
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
- Final standalone `npm run verify` passes (exit 0): 398 tests in 34 files
  (80.49 seconds), all three typechecks, zero-warning lint, production build and
  VSIX dry run (19 files, 611.05 KB), with zero errors and zero warnings.
  The known passing CI above tests
  `dbf76f8`, before this legacy-spike startup repair; post-push CI for the follow-up
  commit is reported separately and is not inferred from that run.

T-017 Windows follow-up CI fixture repair (2026-10-12):

- Owner supplies [run 38245178358](https://github.com/JreyForFun/lite-voyager/actions/runs/38245178358)
  and the failing Windows unit log. Public run/job metadata confirms attempt 1,
  tested commit `4a8be0e5e9457a9e1f3408f547a45ac8be36760c`, overall failure,
  Windows job `114797153052` failure, macOS `114797153360` success and Ubuntu
  `114797153430` success. Remote logs beyond the pasted Windows output are not
  independently inspected. The log reports 397 pass / one failure of 398 tests
  (38.07 seconds): stress fixture generation exceeds its unchanged 5-second
  deadline; teardown also fails with EBUSY unlinking the active `stress.sqlite`.
  The unit gate stops before build/package/host stages.
- Inspection finds four separately committed stress SQLite writes. The exact
  runner disk latency is not captured; unnecessary durable commits are observed,
  not a proven explanation for every earlier timeout. Two new real-SQLite worker
  regressions fail before repair because writes are outside a transaction.
  A third regression starts teardown while actual generation runs; it also fails
  before repair with cleanup rejecting. Preserve these failures as red evidence.
- Wrap the same stress CREATE/INSERT workload in one BEGIN/COMMIT transaction.
  The existing finally-close rolls back incomplete generation on failure. Track
  test generation promises and await settlement before removing disposable output:
  a test timeout does not cancel its asynchronous body, and generation settles
  after worker exit. Original test failures remain failures; teardown never turns
  a timeout or rejected generation into a passing test.
- All 15 fixture tests pass after repair (2.51 seconds). New checks cover actual
  transaction state for every write, one commit, exact 1,048,577-byte cell, all
  1,000 column values, integrity, rollback after injected late failure, database
  closure and cleanup during real in-flight generation. Existing workloads,
  assertions, five-second deadlines, SQLite durability and warning rules remain;
  no dependency or production grid changes.
- `npm run verify:full` passes (exit 0): 401 unit tests in 35 files (77.79 seconds),
  all typechecks, zero-warning lint, production build, VSIX dry run (19 files,
  611.05 KB), integration compilation and 30 real-host tests on Windows x64 /
  VS Code 1.140.0 / host Node 24.21.0. T-017 real-host behavior passes on both
  engines. This full run is not warning-free: its sole approved diagnostic is
  source `out/integration-profile-5XhnQo/logs/20261012T200630/window1/renderer.log`,
  line 10, severity `warning`, rule `VSCODE-HOST-001`, message
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
  Final `npm run verify` also passes (exit 0): 401 tests in 35 files (82.07 seconds),
  all typechecks, lint, build and VSIX dry run (19 files, 611.05 KB), zero errors
  and zero warnings. Fresh three-platform CI for this repair awaits the owner's
  push. The supplied failed run remains a failure.

T-017 final repair CI confirmation (2026-10-12):

The owner supplies [run 38248216036](https://github.com/JreyForFun/lite-voyager/actions/runs/38248216036)
and reports pass. Public GitHub run/job/step metadata confirms attempt 1, push
on main, completed/success, tested commit
`9f73531fdb30eb93b7b2997e7267dba9c13a7c6f`, matching the local fixture repair.
All three jobs, locked installs and applicable full-verification steps succeed:

- [Windows job 114807400454](https://github.com/JreyForFun/lite-voyager/actions/runs/38248216036/job/114807400454):
  `Install locked dependencies` and `Verify on Windows and macOS` succeed.
- [Ubuntu job 114807400823](https://github.com/JreyForFun/lite-voyager/actions/runs/38248216036/job/114807400823):
  `Install locked dependencies` and `Verify with session bus and virtual display on Linux` succeed.
- [macOS job 114807401038](https://github.com/JreyForFun/lite-voyager/actions/runs/38248216036/job/114807401038):
  `Install locked dependencies` and `Verify on Windows and macOS` succeed.

Alternate platform steps are intentionally skipped. Remote full logs are not
independently inspected; no remote test count or warning-free claim is inferred
from metadata. The supplied Windows failure at 4a8be0e, red-first regressions,
prior local failures, exact approved local diagnostic and unresolved historical
timeout causes remain recorded. The failed web fetch is followed by an approved
public metadata read outside the network sandbox, without credentials or writes.

This confirms fresh three-platform CI for the startup and fixture repairs.
T-017 acceptance, owner QA, review and repaired local/CI gates are satisfied;
its checkbox remains checked. This closure changes only the three evidence/status
documents. Final record `npm run verify` passes (exit 0): 401 tests in 35 files
(92.00 seconds), all typechecks, lint, production build and VSIX dry run (19 files,
611.05 KB), zero errors and zero warnings. No further feature change, release
tag or whole-milestone closure is implied. T-018 belongs in a fresh chat.

### T-018 cell details and TSV (2026-10-12)

Owner approved implementation judgment, resolution of uncertainties and scoped
repairs/fixtures; owner handles push. FR-018 acceptance and PLAN T-018 describe
the resulting behavior. No dependency or committed fixture change was needed.

Failing-first evidence is preserved here:
- The sandbox's first Vitest start failed with spawn EPERM; authorized elevated
  execution then reached the tests. Initial missing-module failure was followed
  by executable transformer stubs: 16 behavior tests failed, four existing grid
  tests passed. Details/TSV and page selection implementations made them pass.
- Four worker-service tests failed on its not-implemented stub; panel/stale
  response/shell tests then failed three assertions before their implementation.
- First-context activation regression failed before the lifecycle fix.
  Offscreen active-descendant regression failed before clearing absent DOM IDs.
- First real-host run (`out/integration-profile-SbS6N3`) failed: 23 passing,
  nine failing. Clearing details synchronously reported old DOM under new page
  metadata. A red unit regression captured renderedRows=1/first='old' during
  replacement, rather than zero/undefined, before callback ordering was repaired.
- Second host run (`out/integration-profile-CiqEjD`) passed both T-018 engine
  cases and 28 others, but failed two existing empty-page cases: prior 'Row count
  complete.' appeared instead of 'No rows'. A further failing regression proves
  details clearing must not emit intermediate settled BrowserView status.
- Late cancellation status regression failed before requiring the current
  operation ID. Initial required verify failed five lint errors in new test
  matcher/Promise code; those were corrected without suppressions or weakened
  assertions. No timeout, prior assertion or diagnostic policy was changed.
- Final fidelity audit added a red embedded-NUL copy test (no error before the
  repair). Engine regression then passed on native but failed on fallback:
  `before<NUL>after` became `before`, and leading BOM+Unicode lost the BOM.
  Installed sql.js getBlob(column) was inspected before use; TEXT now decodes
  its complete byte-length value, preserving NUL/BOM and rejecting invalid UTF-8
  explicitly. Three focused Engine cases pass; subsequent valid reads recover.
  Both real-host cases assert a failed NUL copy leaves prior clipboard unchanged.

Coverage:
- `test/unit/cell-details.test.ts`: exact JSON numbers/escapes/duplicate keys,
  invalid/raw text, NULL/empty/literal NULL, Unicode, hostile text, BLOB labels,
  TSV escaping/original JSON, >1-MiB cells, 1,000 columns and budget failures.
- `test/unit/browser-grid.test.ts` and `browser-view.test.ts`: mouse/keyboard
  rectangles, offscreen access, replacement/reset, safe panel rendering,
  stale details/cancellation and atomic page/empty-state reports.
- `test/unit/cell-service.test.ts`: bounded pending work, independent copy,
  clipboard rejection, cancellation/disposal/context changes, malformed replies,
  worker errors and watchdog recovery.
- `test/unit/cell-worker.test.ts`: real bundled worker thread, 1.1-million-character
  exact JSON/TSV, host timer progress, clipboard-after-preparation and exit recovery.
- `test/unit/cell-protocol.test.ts`, editor-shell and browser-package tests:
  typed/dense/bounded messages, accessible controls/CSP and shipped worker assets.
- `test/unit/engine.test.ts`: exact NUL/BOM/Unicode TEXT on both engines,
  unchanged int64/NULL/empty/BLOB types, strict fallback invalid-UTF-8 rejection,
  successful next read and source hash preservation.
- `src/test/sqlite-browser.test.ts`: two real-host FR-018 cases, one per Engine;
  Browse/table/view/SQL details, exact/null/empty/BLOB/JSON/escaped TSV clipboard
  results, rectangular/row copy, 1.1-million-character cell, column 999,
  page reset, recreated context and byte-identical read-only sources. Clipboard
  contents are restored in cleanup. Existing browser/query checks remain intact.

Earlier local verification (before final NUL/BOM/UTF-8 closure):
- Standalone `npm run verify` passed 431 tests in 39 files (80.30 seconds),
  types/lint/build/packaging, zero errors/warnings. It included the repaired
  behavior; a clearer equivalent expected-TSV test literal was then substituted.
- `npm run verify:full` passed (exit 0): 431 unit tests in 39 files (80.10 seconds),
  all types/lint/build/VSIX checks and 32 host tests. Windows x64, VS Code 1.140.0,
  host Node 24.21.0; package 20 files / 617.31 KB.
- Final host profile `out/integration-profile-HCyxNV`: runtime-log validation
  passed with no approved exceptions printed, zero errors and zero warnings.
  No VSCODE-HOST-001/002 allowance was needed for this passing full run.
- Both T-018 host cases report Browse/view/SQL=true, exact JSON/TSV=true,
  1,100,000-character cell, 1,000 columns, recreated context and sourceUnchanged=true.
  Existing warm ten-million-row test still passes (536.519 ms to first DOM rows);
  this does not establish cold-disk, physical-paint or multi-GB memory targets.
- Follow-up `npm run verify` passed 432 tests (79.80 seconds), zero errors/warnings.
  Follow-up full passed 432 unit/32 host checks and included the repaired backend
  in the build/host stage; its unit suite had loaded before the three new Engine
  cases were added. A fresh final full gate covers the complete suite separately.
- Follow-up full profile `out/integration-profile-TcIRRk` has one approved
  diagnostic and is NOT warning-free: source
  `logs/20261012T211330/window1/renderer.log:10`, severity `warning`,
  rule `VSCODE-HOST-001`, original message
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.

T-018 implementation and automated local acceptance pass. Its task checkbox
remains open pending the owner visual QA and fresh-chat review below. Owner push
and fresh three-platform CI remain outstanding; no milestone closure or tag.

Final repair verification (2026-10-12): `npm run verify:full` passes (exit 0),
435 unit tests in 39 files (79.29 seconds), 32 real-host tests, all typechecks,
zero-warning lint/build and VSIX packaging (20 files / 617.67 KB). Both FR-018
host cases include full NUL details and rejected-copy/unchanged-clipboard checks.
Windows x64 / VS Code 1.140.0 / host Node 24.21.0. No new test is skipped in the
full gate; the three-case `-t FR-018` probe did not execute 45 unrelated Engine
cases, all of which execute in the complete gate.

Final full is NOT warning-free: one approved renderer diagnostic, source
`out/integration-profile-mvtPq6/logs/20261012T211723/window1/renderer.log:10`,
original severity `warning`, rule `VSCODE-HOST-001`, original message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
There are zero errors and no other warnings; VSCODE-HOST-002 was not present.
The earlier TcIRRk warning above is a separate record, not erased or relabeled.
Final standalone `npm run verify` passes (exit 0): 435 tests in 39 files
(79.52 seconds), all types/lint/build/VSIX checks, zero errors and zero warnings.
Only these observed result lines were recorded after that gate; source/tests
are unchanged. All 31 T-018 files belong in the scoped local implementation
commit. Existing debug.log, gingTryWan/ and untracked fixture aliases are excluded.

Owner QA setup: if the development window is already open with the generated
fixture, continue there. Otherwise run `npm run build`, then
`node scripts/browser-fixture.mts out/t018-owner-qa` using a new directory name
if a database already exists there. In the project VS Code window press F5.
In the new Extension Development Host window press Ctrl+O and open the generated
`out/t018-owner-qa/browser.sqlite` using its full project path. If it opens as
text, right-click its tab, choose Reopen Editor With, then Lite Voyager.

For EVERY SQL check below: inside the Lite Voyager tab, click in the text box
directly below the SQL heading/Run SQL button. Press Ctrl+A THERE (not in the
results grid), then paste only the complete SQL statement shown. This replaces
the default/previous SQL; do not append to it and do not paste surrounding
Markdown backticks. Click Run SQL. An empty selection runs all editor text;
a selection runs just the selected text. Each check uses one statement.
To inspect copied text, press Ctrl+N in the Development Host, then Ctrl+V in
that new plain text editor tab. Return by clicking the browser.sqlite tab.

Report numbered PASS/FAIL or NOT OBSERVED, including visible errors:
1. Open the Table or view dropdown above the grid and choose `a values (table)`.
   Click row 1's nullable, empty, literal, maximum, minimum, bytes and hostile
   cells one at a time. Inspect the Cell details panel beside/below the grid.
   NULL/empty/literal NULL remain distinct; integers are exact, bytes shows only
   the BLOB placeholder, and hostile text is literal. Click Copy cell in that
   panel and paste in the plain text tab to verify the copied value.
2. Choose `b pages (table)`. Click the row 1 cell under id (value 1). Hold Shift
   and click row 2 under value (row 2). Click Copy selection in Cell details.
   Pasted output is `1<TAB>row 1<LF>2<TAB>row 2`, without outer enclosing quotes.
   Return to browser.sqlite, click row 2 under value again (tab hiding clears
   selection), then click Copy row and paste again: expect
   `2<TAB>row 2`. This last step independently checks copying the active row.
3. Click a data cell to focus the grid. Arrows move the active cell; Shift-arrows
   extend the rectangle. Page Up/Down, Home/End and Ctrl+End navigate. Ctrl+A
   selects the current loaded page and Ctrl+C copies it. Press Tab to reach a
   column header button; Enter/Space cycles sorting. Click Next page: cell
   selection/details clear. Do not use Ctrl+A in the SQL editor for this check.
4. Set Rows per page to 1, then choose `e large cells (table)`. Click its x-filled
   cell; scroll inside Cell details and use Copy cell to inspect full long text.
   With the long value still displayed, click inside the SQL editor and type
   `-- QA typing` on a new line WITHOUT running it. Letters should appear promptly
   with no frozen UI; this checks typing responsiveness, not data loading.
   Choose `f wide (table)`, click a data cell and press Ctrl+End to reach column 999.
   Assess scrolling. If Cancel preparation stays enabled long enough, click it
   during a fresh cell/copy operation and verify cancellation status/retry. If
   preparation finishes before you can click, report NOT OBSERVED (too fast);
   no manual failure or fabricated manual pass. Automated cancellation evidence
   remains separate; no artificial delay is needed.
5. Replace all SQL text using the instructions above and run
   `SELECT '{"n":9223372036854775807,"n":1e999}' AS json;`.
   Click row 1 under json. Cell details should show an indented JSON object with
   BOTH n keys and the exact tokens 9223372036854775807 and 1e999.
   Click Copy cell, then paste: expect
   `"{""n"":9223372036854775807,""n"":1e999}"`, one line, preserving stored JSON.
   Return to the database tab, replace all SQL again, and run
   `SELECT 'left' || char(9) || 'middle' || char(10) || 'right "quoted"' AS escaped;`.
   Click row 1 under escaped, Copy cell, and paste. Expect two lines: first
   `"left<TAB>middle`, second `right ""quoted"""`; the tab/newline are actual
   characters, not the angle-bracket labels, and embedded quotes are doubled.
6. Press Ctrl+K then Ctrl+T in the Development Host to choose light/dark/high
   contrast themes. Inspect readable details/copy controls in each, then narrow
   the window: the details panel may move below the grid. Use Tab to reach and
   activate copy controls with Enter. With a cell selected, create a text tab
   (Ctrl+N), then click browser.sqlite again: query/page restore but cell selection
   clears. For error retention, first run `SELECT 1 AS retained;`, click its cell,
   then replace SQL with `SELECT FROM;` and Run SQL. The error must leave the
   previous value/details visible.
   For the optional NUL check, replace ALL SQL and run the complete statement
   `SELECT 'before' || char(0) || 'after' AS value;` (including the quote after after).
   After it runs, click inside the SQL editor, Ctrl+A then Ctrl+C to put that
   complete statement on the clipboard as a known baseline. Click the result
   cell. Details contain before and after separated by an invisible NUL (12
   stored characters). Click Copy cell: expect a visible NUL clipboard limitation.
   Press Ctrl+N, then Ctrl+V: expect the full SQL statement copied as the baseline,
   proving the rejected cell copy did not overwrite the clipboard.

Owner report (2026-10-13):
- 1: explicit PASS. 2: supplied two rows match selection TSV; selection copy PASS,
  assuming the message's enclosing quotes are narration, not copied characters.
  Copy row output was not supplied. 3: explicit PASS.
- 4: scrolling PASS. Typing responsiveness not yet observed: owner interpreted
  typing as data loading. Manual Cancel NOT OBSERVED because preparation finished
  too fast to click; automated cancellation tests remain passing evidence.
- 5: submitted text was rejected as more than one read statement; JSON/escaping
  QA is not yet verified. Actual full editor/selection contents were not supplied,
  so appending to the default SQL is a possibility, not an established cause.
- 6: supplied SQL `SELECT 'before'||char(0)||'after` lacks the closing single quote.
  Its unrecognized-token error is consistent with malformed SQL. Optional NUL
  check awaits a complete-statement retry; themes/restoration/error-retention
  observations were not supplied. Do not claim these checks PASS.
- Owner requests more specific navigation; revised steps identify exact controls,
  editor focus, full replacement, complete SQL and expected clipboard output.
  No feature code/test change is warranted by the supplied reports so far.
- Documentation-record `npm run verify` passes on 2026-10-13 (exit 0): 435 tests
  in 39 files (116.77 seconds), all types/lint/build/VSIX checks, zero errors and
  zero warnings. Only PROGRESS.md and VALIDATION.md change; T-018 stays unchecked.

Owner final report (2026-10-13):
- Owner explicitly reports checks 1, 3, 4, 5 and 6 PASS; check 2 supplies the
  two-row selection content again and concludes PASS. Together with the earlier
  exact two-line TSV report, all six owner QA checks are accepted as PASS.
- Earlier incomplete-query errors and partial observations above remain history;
  the latest numbered report resolves their pending QA status. No additional
  timing, per-theme measurements or specific manual Cancel click is fabricated.
  Cancellation still has its recorded automated evidence; the earlier too-fast
  manual observation is retained rather than rewritten as a measured interruption.
- Only the owner-QA gate closes here. Fresh-chat independent review and fresh
  post-push three-platform CI remain open; T-018 remains unchecked. No source,
  tests, fixtures, dependencies or milestone/release status change.
- Owner-QA record `npm run verify` passes on 2026-10-13 (exit 0): 435 tests in
  39 files (102.00 seconds), all types/lint/build/VSIX checks, zero errors/warnings.
  Only PROGRESS.md, TASKS.md and VALIDATION.md are updated for this record; the
  owner's pre-existing one-character QA-setup edit remains unstaged/uncommitted.

Fresh-chat review should inspect implementation commit `908fb76` and any later
source repairs, not just the documentation-only HEAD, focusing on worker
lifecycle, exact token/TSV fidelity, clipboard gating and stale page reporting.
After owner push, return the CI run URL/tested SHA and all three job outcomes.
Tests can be rerun with `npm run verify` and `npm run verify:full`.

T-018 handoff (2026-10-13): implementation and owner QA 1–6 pass; independent
review and fresh post-push CI are the only remaining T-018 closure checks.
The stray x in the QA setup heading is corrected in this owner-requested
documentation update; earlier records of its preservation remain history.
No feature source/test/fixture change or new QA observation is introduced.
Handoff-document `npm run verify` passes (exit 0): 435 tests in 39 files
(98.47 seconds), all types/lint/build/VSIX checks, zero errors and zero warnings.

Historical review handoff prompt (superseded by the owner's in-chat review
preference and completed isolated review recorded below):

```text
Read AGENTS.md, specs/CONSTITUTION.md and PROGRESS.md in that order.
Review only T-018 / FR-018 and its scoped CI repairs. Read its acceptance,
plan and validation sections.
Owner QA 1–6 passes. Repaired local verification passes 437 unit and 32 host tests;
the approved full-run renderer warning is recorded in VALIDATION.md.
Inspect the actual implementation diff:
git diff 5ebbe7f HEAD -- src webview test esbuild.js .vscodeignore
Read relevant current code and tests as needed. Do not review only the
documentation-only HEAD. Do not modify files or tick a task checkbox.
Report concrete HIGH / MEDIUM / LOW defects with file/line, why they violate
the requirements, and a reproduction or failing test that would catch them.
Focus on exact JSON/TSV fidelity, NUL/BOM decoding, clipboard gating, worker
lifecycle/cancellation, bounded work and stale page/detail responses.
Do not invent problems. If no concrete findings remain, say so explicitly.
Keep review results separate from owner QA and CI evidence.
```

For each confirmed review defect, make a scoped T-018 failing-test-first
repair under the owner's existing repair authorization, then rerun the required
verification. Repeat owner QA only where a repair changes an observed behavior.
Repaired commit 0004369 already passes three-platform CI (record below). If the
review requires further source repairs, owner runs `git push origin main` in
the project terminal. Open the repository's Actions tab and select the run for
that pushed commit. Return the run URL, tested commit SHA and Windows/macOS/Ubuntu
job conclusions. For a failure, supply the failing step's first error/warning
and its surrounding log.

T-018 CI viewport repair (2026-10-13):
- Owner supplied run https://github.com/JreyForFun/lite-voyager/actions/runs/38289818635
  and Windows/macOS Full verification excerpts. GitHub REST run/job metadata
  confirms attempt 1, main, tested SHA d29dfff9355bbb02f1d191c59df1d7053a8ce23d:
  Windows and macOS failure; Ubuntu success. Locked dependency installs pass
  on all three; Windows/macOS full steps fail, Linux session-bus/xvfb full step
  succeeds. The web page fetch missed its cache; Node HTTPS fetched REST metadata.
- Both supplied failing excerpts pass 435 unit tests and both T-018 host cases,
  but finish with 30 host tests passing / two FR-002 cases failing: expected
  `firstRow[6].text === '1e-200'`, actual undefined, on native and fallback.
  Windows reports 35.60-second units, macOS 26.82-second units. This run is not
  a passing three-platform gate and is not erased by local repair evidence.
- Cause reproduced with a 620px grid: the T-018 sidebar leaves six initial
  virtualized columns. The REAL column at ordinal 6 is offscreen; firstRow
  summarizes actual rendered cells, not the entire result row. No data loss
  was observed, and both T-018 clipboard/source-safety cases pass in the excerpts.
- Two failing-first regressions capture missing DOM column identities and
  acceptance of malformed/out-of-range ordinals. Both fail before the repair;
  the focused grid/protocol command then passes all 29 tests.
- Read aria-colindex into bounded DOM summaries and validate optional ordinals
  against the result-column count. The host navigates to all nine fidelity cells
  and compares exact text/labels from each actual rendered column. All earlier
  values remain asserted, including NULL/empty/literal NULL, int64 extremes,
  BLOB, REAL, stored date and hostile text. No fixture, timeout, CSS, Engine,
  expected value, test weakening, dependency or diagnostic-policy change.
- Pasted macOS console contains the known CloudSandbox and 74ms chat-model
  contribution diagnostics. The failed host gate did not reach renderer-log
  validation; no remote approved-warning count or warning-free claim is made.
  Ubuntu run metadata confirms success; its raw logs were not inspected here.
- Owner QA 1–6 remains passing evidence for the visible feature, which this
  report/navigation repair does not change. Independent review must include
  the implementation and this repair: use the cumulative diff in the prompt
  above, not only the older 908fb76 feature commit. Fresh repaired three-platform
  CI and review remain required; no T-018 checkbox, milestone closure or tag.
- Repaired `npm run verify:full` passes (exit 0): 437 unit tests in 39 files
  (102.19 seconds), all types/lint/build/VSIX checks (20 files / 617.71 KB) and
  32 real-host tests. Both previously failing FR-002 engine cases now pass while
  asserting all nine exact DOM values/labels and unchanged sources. Windows x64,
  VS Code 1.140.0 / host Node 24.21.0. The existing warm ten-million-row probe
  passes at 780.2938 ms to first DOM rows; no new broader performance claim.
- Repaired full is NOT warning-free: exactly one accepted diagnostic, source
  `out/integration-profile-xLQJr4/logs/20261013T023925/window1/renderer.log:10`,
  original severity `warning`, rule `VSCODE-HOST-001`, original message
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
  Zero errors/other warnings; no VSCODE-HOST-002 record. Prior failures and exact
  earlier warning records remain intact.
- Final standalone `npm run verify` passes (exit 0): 437 tests in 39 files
  (99.52 seconds), all types/lint/build/VSIX checks, zero errors and zero warnings.
  Only observed result lines are added afterward; the repaired source/tests
  remain unchanged. Owner pushes the scoped T-018 CI repair and returns the new
  CI URL/tested SHA/three job outcomes. Existing untracked files stay excluded.

T-018 green CI confirmation (2026-10-13):
- Owner reports GREEN CHECK for
  https://github.com/JreyForFun/lite-voyager/actions/runs/38293986528.
  GitHub REST run/job metadata confirms attempt 1, main, tested SHA
  `00043694905b03973fb82a7513436ccd031f6467`, completed/success.
- Full verification jobs on Windows, macOS and Ubuntu all succeed. Each locked
  dependency install succeeds. Windows/macOS applicable full-verification steps
  succeed; Ubuntu's session-bus/virtual-display full-verification step succeeds.
  The opposite-platform steps are skipped as intended by the workflow.
- The supplied web-page fetch missed its cache; Node HTTPS fetched REST metadata.
  Raw logs for this successful remote run were not inspected: no remote test
  totals, warning counts or warning-free claim are inferred from the green jobs.
- This satisfies the repaired three-platform CI gate. Failed run 38289818635,
  all prior evidence and the exact approved local full-run warning remain history.
  Owner QA 1–6 remains passing; no source/test/fixture changes or new QA claims.
  Independent fresh-chat review must include the feature and viewport repair.
  T-018 stays unchecked; further source repairs require new verification and CI.
- CI-record `npm run verify` passes (exit 0): 437 tests in 39 files (104.49 seconds),
  all types/lint/build/VSIX checks (20 files / 617.71 KB), zero errors and warnings.
  Only this observed result is added after the run; feature source/tests stay unchanged.

T-018 independent review (2026-10-13):
- Owner explicitly wants a new chat only when proceeding to another task. For
  this task, that instruction overrides the separate user-created review-chat
  workflow. Keep T-018 review/closure here; start T-014 in a new chat afterward.
- The dedicated Bugbot tool is unavailable. One isolated read-only reviewer,
  `/root/bugbot`, starts with fresh context (`fork_turns: none`) and independently
  computes the cumulative 25-file source/test/build diff from `5ebbe7f` to
  `b2ecd2af430b30486f7fb8acb493ebfc928ba97b`. This is a review subagent fallback,
  not a claim that an external Bugbot service ran.
- Review reports no concrete HIGH, MEDIUM or LOW defects. It inspects exact
  JSON tokens and TSV escaping, NUL/BOM/UTF-8 decoding, clipboard gating,
  worker lanes/queues/watchdog/cancellation/recovery, stale details/page responses,
  virtualized selection, actual DOM column identities and worker packaging.
  No review repair is needed; no source/test/build/fixture file changes.
- Reviewer execution limitation: its focused existing-test command cannot start
  because Vite/Vitest reports `spawn EPERM` in the sandbox. No test executes in
  that attempt; it is not counted as a passing test run. The reviewer does not
  retry alongside root verification, rerun real-host tests, or fetch raw remote
  CI logs. Its independent source/test inspection supplements the separate
  observed local gates, owner QA and repaired three-platform CI above.

T-018 closure (2026-10-13):
- Root `npm run verify` passes (exit 0): 437 tests in 39 files (106.05 seconds),
  all types/lint/build checks and VSIX package dry run (20 files / 617.71 KB),
  zero errors and zero warnings. Final documentation adds only these observed
  results and task status after the run; no implementation/test changes.
- Independent inspection, local acceptance/gates, owner QA 1–6 and repaired
  three-platform CI pass. Check only T-018. The exact prior full-run approved
  renderer warning and failed CI remain recorded; full is not called warning-free.
- Owner pushes the documentation commit with `git push origin main`. No source
  repairs follow the successful CI commit, so its implementation gate remains
  applicable. Untracked files remain untouched and excluded from staging.

This does not close Milestone 1 or authorize a release tag. The next feature task
is T-014 in a new chat after T-018 closure; do not start it in the current chat.

### T-014 production cancellation (2026-10-13)

Owner authorizes implementation, resolution of uncertainties and scoped repairs;
owner pushes. T-014 uses the existing process supervisor and adds a typed,
nonterminal SQL-start acknowledgement, SQL retry guidance and opt-in local timer
probes. No new dependency, source writes or normal-session timer is introduced.
The 1,000 ms target measures old-helper exit; reopening is reported separately.

Tests-first evidence:
- The first focused invocation could not start Vitest because the sandbox denied
  its build subprocess (`spawn EPERM`); this is not a failing behavior test.
- The authorized invocation outside the sandbox ran the tests: five failed,
  36 passed. Failures cover the missing worker-start forwarding, response
  validation, nonterminal UI acknowledgement and opt-in probe exercises.
- After implementation, all 41 focused tests passed. Added coverage retains
  cancellation recovery errors, disposal, queued retry and stale replies.
- `test/unit/browser-view.test.ts` covers previous SQL results/count/context,
  repeated Cancel, recovery busy state, retry, visible recovery failure, probe
  validation and timer cleanup. An injected 250 ms stall must remain visible
  rather than being clamped to the 100 ms target.
- `test/unit/sqlite-browser.test.ts` covers worker-start forwarding without
  completing the query, suppression after cancellation, queued retry waiting
  for recovery, recovery failure, disposal and typed response validation.
- `src/test/engine.test.ts` runs both real backends in the extension host. It
  waits for the worker acknowledgement and 150 ms of sustained execution,
  verifies the query has not settled, observes the old PID becoming absent,
  requires exit within 1,000 ms, awaits supervised recovery, runs `SELECT 42`,
  measures 10 ms host timer intervals and compares source hashes. Only ESRCH
  counts as an absent process; permission errors do not count as helper exit.
- `src/test/sqlite-browser.test.ts` runs both real CodeMirror/grid editors,
  waits for acknowledged execution, cancels twice with a repeated click, checks
  retained successful results/count/editor length, retries SQL and then closes
  during a third executing query. Opt-in 10 ms webview timers must tick with no
  observed interval above 100 ms. Source hashes remain identical.
- Existing Engine tests retain repeated cancellation, confirmed process exit,
  close overriding recovery, crashes and read-only/source safety coverage.

Initial full gate: `npm run verify:full` exits 0 with 444 unit tests in 39 files
and 36 real-host tests. Types, lint, build and a 20-file / 618.08 KB VSIX pass.
Windows x64, VS Code 1.140.0, host Node 24.21.0. It contains one approved host
warning and is **not warning-free**:
- Profile `out/integration-profile-outiXH`; source
  `20261013T090909/window1/renderer.log:10`; original severity `warning`;
  rule `VSCODE-HOST-001`; exact message:
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.

Initial real-host measurements, all within the scoped targets:
- Native: helper exit 1.1675 ms; direct Engine recovery 271.1975 ms;
  host maximum timer interval 45.689 ms / 25 ticks.
- Fallback: helper exit 0.7361 ms; direct Engine recovery 352.0498 ms;
  host maximum timer interval 34.5325 ms / 32 ticks.
- Native DOM attempts: recovery 264.6267 / 276.6438 ms; webview maximum timer
  intervals 21.7 / 19.3 ms, with 29 / 32 ticks.
- Fallback DOM attempts: recovery 309.2579 / 308.1124 ms; webview maximum timer
  intervals 22.8 / 18.8 ms, with 34 / 34 ticks.

These observations cover the deterministic aggregate on a 28,672-byte SQLite
fixture. They do not establish responsiveness for every workload or machine,
multi-GB fallback reopening, physical-paint quality or remote CI compatibility.
No owner manual QA, fresh independent review or post-push CI is claimed.
T-014 remains unchecked pending that closure evidence; Milestone 1 remains open.

Final full gate after strengthening the observer tests: `npm run verify:full`
exits 0 with 445 unit tests in 39 files (89.27 s) and 36 real-host tests.
Types/lint/build/package pass; VSIX remains 20 files / 618.08 KB. The injected
stall test and ESRCH-only process observation pass without changing production
behavior or relaxing a target. Zero errors; one approved host warning, so this
full run is **not warning-free**:
- Profile `out/integration-profile-VMKJ6y`; source
  `20261013T091423/window1/renderer.log:10`; original severity `warning`;
  rule `VSCODE-HOST-001`; exact message:
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
- Native: helper exit 0.7971 ms; Engine recovery 264.4193 ms; host maximum
  timer interval 40.1677 ms / 25 ticks. DOM recovery 253.2175 / 253.2526 ms;
  webview maximum intervals 11.9 / 12 ms, with 43 / 42 ticks.
- Fallback: helper exit 0.6179 ms; Engine recovery 309.5686 ms; host maximum
  timer interval 35.6103 ms / 29 ticks. DOM recovery 343.0191 / 315.4338 ms;
  webview maximum intervals 19 / 14.2 ms, with 55 / 48 ticks.

For fresh-chat review, use the complete diff from the starting commit:
`git diff 1d2fc4f..HEAD`. No independent review is claimed by this implementation
session. Manual QA and fresh CI remain required before checking T-014.

Final standalone `npm run verify` exits 0: 445 tests / 39 files (unit 80.94 s),
all three typechecks, lint, production build and the 20-file / 618.08 KB VSIX
pass with zero errors and zero warnings. Final evidence/handoff edits only
record these observed results; no production or test change follows the full
gate. Existing untracked files remain untouched and are excluded from staging.

Owner QA, native and forced fallback (report each numbered observation):
1. Run `npm run verify` and `npm run verify:full` in the project terminal and
   retain the output. For visual QA, press F5 with `Run Extension`, then open
   `test/fixtures/sample.sqlite` in the Extension Development Host. The native
   run should say the primary engine reads from disk.
2. Run `SELECT 42 AS preserved;`. Verify the result is `42` and total rows `1`.
   Replace the editor text with the single statement below and Run:

   ```sql
   WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<20000000) SELECT sum(x) FROM n;
   ```

   While running, type a SQL comment and scroll/select the existing result.
   Verify typing and scrolling respond and Cancel operation remains available.
3. Click Cancel operation. Verify cancellation/reopening feedback, followed by
   ready status with Run guidance; previous result/count and the edited SQL
   document remain. Run `SELECT 7 AS recovered;` and verify `7`.
4. Repeat the long query and click Cancel twice quickly. Verify one recovery,
   no stale error/result and a successful `SELECT 8 AS recovered;` retry.
5. Run the long query again, close its editor while executing, reopen the file
   and run `SELECT 9;`. Verify recovery without a frozen window or revived tab.
6. Close the Development Host. Temporarily add
   `"env": { "LITE_VOYAGER_FORCE_FALLBACK": "1" }` inside the `Run Extension`
   configuration in `.vscode/launch.json`, preserving its other properties.
   Press F5, confirm the persistent memory-limited notice, repeat checks 2-5,
   then remove only that temporary `env` property. Report native and fallback
   separately, including any failure and exact visible message. Assess light
   and dark themes and keyboard access to Cancel and Run during these checks.

After owner QA, arrange a fresh-chat independent review under section 6 and
push the implementation. Provide the new CI run URL/SHA and all three platform
conclusions; preserve any failures and exact diagnostics before closure.

### T-014 owner QA and failed CI probe (2026-10-13)

Owner supplies `1 - PASS` through `6 - PASS` against the numbered QA above.
Accept these as completion of owner QA, including forced fallback in check 6.
The earlier 1-5 message is superseded by the complete 1-6 report. No individual
typing, theme, timing or separate engine observation beyond that report is
invented. Implementation acceptance has its existing automated evidence.

Owner provides [run 38341388121](https://github.com/JreyForFun/lite-voyager/actions/runs/38341388121)
and two pasted platform logs. Public GitHub API metadata independently confirms
attempt 1 at `21da760bc5151fbf7b0bce037e1ad16cdae474a1`, overall failure:
- Windows job 115112931298: locked dependency installation succeeds;
  `Verify on Windows and macOS` fails. Pasted log: 445 unit tests pass;
  35 host tests pass / one fails, specifically T-014 fallback DOM at
  `assert.ok(measured.responsiveness.ticks >= 5)` (compiled test line 126).
- macOS job 115112931487: locked installation succeeds; the same verification
  step fails. Pasted log identifies darwin/arm64, 445 passing unit tests and
  35 passing / one failing host test: T-014 native DOM at the identical sample
  assertion. Fallback DOM and both direct helper/host tests pass.
- Ubuntu job 115112931537: locked installation and
  `Verify with session bus and virtual display on Linux` succeed. Raw Ubuntu
  logs/diagnostic counts were not retrieved; metadata success is the evidence.

Preserve this failed run; do not describe it as green or warning-free. The two
failed full runs exit before the structured runtime-log scan. Console copies of
host messages do not establish approved source/severity/line records, so no
host-warning classification is claimed for those failed runs.

Scoped repair under the owner's standing authorization:
- The supplied failures establish too few webview samples, but omit their
  actual count and maximum interval. Thus a blocking SQL/UI fault is not proven.
  Background/occlusion timer starvation is the current hypothesis, supported
  by platform selectivity, successful helper/host measurements and documented
  Chromium background scheduling. Fresh CI must confirm resolution.
- Primary references: [Chromium switch definitions](https://chromium.googlesource.com/chromium/src/+/HEAD/content/public/common/content_switches.cc)
  document `disable-background-timer-throttling` and the testing switch
  `disable-backgrounding-occluded-windows`;
  [Electron supported command-line switches](https://www.electronjs.org/docs/latest/api/command-line-switches#--disable-renderer-backgrounding)
  document `disable-renderer-backgrounding`.
- A new NFR-005 launch-contract regression in
  `test/unit/integration-config.test.ts` fails first because all three switches
  are absent (one failed / four passed). Add them only to `.vscode-test.mjs`'s
  isolated host; all five configuration tests then pass. This candidate is
  subsequently rejected by the strict CLI warning gate, as recorded below.
- Move T-014 raw probe logging before the sample/interval assertions and
  include the observed probe values in the five-sample assertion's message.
  A future failure retains count/gap evidence for diagnosis.
- Preserve the five-sample minimum, 100 ms bound, 150 ms sustained SQL,
  20-million-step aggregate, 1,000 ms helper-exit bound, both attempts/backends,
  all deadlines, source/delivery assertions and strict diagnostic policy.
  No production behavior, dependency, fixture data or acceptance target changes.

Owner QA passes; repaired local gate, fresh repair CI and independent review
are tracked separately. Keep T-014 unchecked until closure evidence passes.

First repair `verify:full` stops at the unit stage: 444 pass / two five-second
timeouts, 37 passing / two failing files (143.96 s). Exact failures:
- `test/unit/csv-import-spike.test.ts:243`, NFR-005 worker-insert event-loop
  responsiveness, with its existing 100,000-row workload and five-second limit.
- `test/unit/engine-schema.test.ts:158`, fallback FR-016 metadata/read-only/
  cancellation/source-recovery case, also with its existing five-second limit.

No integration or diagnostic-scan pass is claimed for that invocation. A
diagnostic run of these two suites plus the launch-contract suite passes all
76 tests / three files in 21.36 s with unchanged bodies, workload and deadlines.
A nominal two-second process sample records an unrelated `vbc` compiler using
8.48 CPU-seconds. Do not stop the owner's unrelated process. Resource contention
is supported, not uniquely proven. Change only unit-file scheduling to one
worker, preserving within-test concurrency, all 446 tests, all assertions and
every timeout. Record the resulting complete gate separately; no failed run is
discarded or called a pass.

Chromium-switch candidate gate: 446 unit / 39 files pass (183.52 s) and all
36 real-host tests pass, but verification exits 1 because these three CLI
warnings are failures, not approved renderer exceptions:
- `Warning: 'disable-background-timer-throttling' is not in the list of known options, but still passed to Electron/Chromium.`
- `Warning: 'disable-backgrounding-occluded-windows' is not in the list of known options, but still passed to Electron/Chromium.`
- `Warning: 'disable-renderer-backgrounding' is not in the list of known options, but still passed to Electron/Chromium.`

No warning exemption/filter is added. Inspection of the tested version's
[startup source](https://github.com/microsoft/vscode/blob/1.140.0/src/mainImpl.ts)
shows its runtime-argument switch whitelist also excludes these options.
Withdraw all three launch switches and replace the measurement route:
- An opt-in `pulseResponsiveness` typed exercise samples the same webview
  monotonic clock as the native timer. Host pulses arrive every 10 ms with
  at most one API delivery promise pending, within the existing 60 s test
  deadline. API delivery is not an acknowledgement that the inner frame has
  processed a pulse; stale/late pulses are rejected by its context/probe key.
- The key includes webview context and starting exercise ID. Wrong/stopped/
  old-probe pulses neither count nor change action IDs or send periodic reports.
  Stop clears the host timer and awaits pending delivery, including failures.
- A deterministic NFR-005 regression suppresses the native timer scheduler,
  delivers five keyed pulses, verifies exact observed gaps and action IDs,
  rejects stale/wrong contexts and retains an injected 250 ms stall in full.
  Existing native-timer stall, validation and cleanup tests remain intact.
- The configuration regression is revised to reject each unsupported switch,
  because the abandoned route violates the zero-warning requirement. It does
  not permit or suppress any warning. With the candidate still present and
  before pulse implementation, the two regressions fail (32 pass / two fail).
  After switch removal and implementation, all 34 focused tests pass.
- Retain five samples, 100 ms maximum observed event gap, 150 ms executing SQL,
  every helper-exit/deadline/source assertion and all diagnostic rules. The
  measurement includes host-delivered events and native timer samples; do not
  describe the aggregate count as native timer ticks alone. Ordinary user
  cancellation behavior is unchanged; only opt-in local test hooks change.

The first asset-hash comparison mixed the owner's non-minified F5 build with
the minified production build and did not match. No byte-identical-bundle claim
is made; esbuild selects minification/maps using `--production`. At that stage,
the production-source diff was empty. The later pulse route changes only
opt-in protocol/webview instrumentation, so normal cancellation QA is retained.

The first pulse-route full invocation stops at lint: `only-throw-error` rejects
throwing the captured `unknown` transport failure (`src/test/sqlite-browser.test.ts:56`).
Normalize non-Error rejection values to an Error and retain real Error objects;
no lint disable or test/diagnostic weakening is used. No later stage is claimed
for that invocation. Validate the corrected route with a new complete gate.

Final pulse-route `npm run verify:full` passes (exit 0): 447 unit / 39 files
(186.84 s), 36 real-host tests, strict typechecks/lint/build and the 20-file /
618.15 KB VSIX. Windows x64 / VS Code 1.140.0 / host Node 24.21.0. No CLI
warning remains and no warning policy is changed. Zero errors; one explicitly
approved host warning means the full run is **not warning-free**:
- Profile `out/integration-profile-pubCu0`; source
  `20261013T121620/window1/renderer.log:10`; original severity `warning`;
  rule `VSCODE-HOST-001`; exact message:
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
- Native: helper exit 1.1164 ms; Engine recovery 225.4138 ms; maximum host
  timer interval 37.1712 ms / 24 ticks. DOM recovery 227.983 / 268.0528 ms;
  maximum webview event intervals 13.6 / 10.9 ms, with 63 / 70 observations.
- Fallback: helper exit 0.7492 ms; Engine recovery 312.9 ms; maximum host
  timer interval 39.7769 ms / 28 ticks. DOM recovery 359.9459 / 366.2187 ms;
  maximum webview event intervals 12 / 14.1 ms, with 85 / 88 observations.

The repaired local acceptance and owner QA 1-6 pass. All earlier failures remain
recorded. Fresh three-platform repair CI and fresh-context independent review
are still required; do not tick T-014 or close Milestone 1 yet. Subsequent edits
only record evidence/clarify comments, with no behavior change after this gate.

Final standalone repair `npm run verify` passes (exit 0): 447 unit tests in
39 files (161.37 s), strict typechecks/lint/build and the 20-file / 618.15 KB
VSIX, with zero errors and zero warnings. No behavior/test change follows
these successful gates; final edits record evidence and handoff only.
Commit the 11 scoped files, leaving existing untracked files untouched.
Owner pushes with `git push origin main` and provides a fresh CI run URL/SHA.
At that checkpoint, no independent review or three-platform repair success was
claimed. The subsequently verified repair CI is recorded below.

### T-014 repaired three-platform CI confirmation (2026-10-13)

Owner provides [run 38346736300](https://github.com/JreyForFun/lite-voyager/actions/runs/38346736300)
and reports it good. Public GitHub API metadata independently confirms attempt
1 at `780f9741166ecfce821df81fbb9025e57eba9d12`, completed with success:
- Windows job 115129797822: locked dependencies and
  `Verify on Windows and macOS` succeed.
- macOS job 115129798144: locked dependencies and the same full-verification
  step succeed.
- Ubuntu job 115129798091: locked dependencies and
  `Verify with session bus and virtual display on Linux` succeed.

The repair clears the original failing platform steps at the tested commit.
This does not uniquely prove the originating cause of the earlier missed timer
samples; the original logs omitted their raw metrics. Preserve failed run
38341388121, local failed candidates/timeouts and exact approved host warnings.
Remote raw logs and diagnostic counts were not independently retrieved: do not
describe remote full runs as warning-free. No implementation/test change
follows the successful repair commit; this update records metadata only.

Local acceptance/gates, owner QA 1-6 and fresh repaired three-platform CI pass.
Owner subsequently confirms T-014 checked and explicitly directs the next chat
to T-015. Close T-014 at the owner's direction using the passing acceptance,
owner QA and repaired CI evidence above. No separate task-specific independent
review has been performed or claimed; retain section 6's whole-milestone review
requirement. No milestone closure or release tag. The complete T-014 diff starts
at `1d2fc4f`. Existing untracked files remain untouched.

### T-015 streamed result export (2026-10-13)

Owner approves full T-015 implementation and delegates unresolved decisions.
SPEC T-015 defines full successful-query export, exact string-valued JSON,
quoted CSV with unquoted NULL `\N`, duplicate/blank headers and BLOB placeholders.
No dependency, source write, table-export feature or export page/cell cap.

Coverage (new tests have FR-014 Given/When/Then names):
- `result-export.test.ts`: exact int64/REAL/TEXT/NULL/BLOB, stored JSON,
  Unicode/NUL/BOM, quoting/CRLF/NULL collisions, duplicate/blank/1,000 headers,
  empty results, multi-MiB cells, bounded chunks, slow-sink backpressure and
  cursor closure on failure.
- `export-engine.test.ts`: both backends, 25,000 rows beyond paging limits,
  4,300,000-character cell, bounded progress, invalid SQL/existing temporary path,
  aggregate/writing cancellation, forced helper death, closure, cleanup after
  helper exit, recovery and byte-identical source fixtures.
- `export-service.test.ts` / `export-failures.test.ts`: atomic replacement,
  source/hard-link/linked-parent and sidecar protection, pre-commit recheck,
  dismissed/pending dialogs, stale/cancelled completion, missing-source guidance,
  failed rename, existing output preservation and visible cleanup failure.
- Browser/provider/protocol suites: successful SQL context after edits/failures,
  table-mode rejection, nonterminal progress, Saving/Cancel state, stale replies,
  retained page/state, validated counter strings and closure-failure notification.
- `export-memory.test.ts`: isolated million-row serializer with discard sink;
  output >100 MB, chunks <=65,536 bytes and RSS growth <128 MiB (scoped test).
  It does not establish backend sort memory, fallback database memory, real disk
  throughput or the separate T-016/NFR-003 target.
- `src/test/result-export.test.ts`: real Chromium export buttons/messages on
  both backends, 50,000-row CSV/JSON files, final values, edited-SQL isolation,
  preserved DOM page/summary, host timers and writing cancellation. Only the Save
  chooser is controlled; all output/publication/cleanup uses production code.

Red-first evidence: missing serializer module; six engine tests fail on missing
exportResults; absent browser controls/exporter; raw ENOENT for missing source;
absent notification after closure cleanup failure. Initial sandbox startup has
spawn EPERM; approved outside-sandbox runs execute the actual tests. No skip,
weakened assertion, dependency, `any` or lint suppression.

First host candidate: 36 existing tests pass, both new tests fail because their
comparison baseline firstRow is empty before grid rendering. Actual saved-page
reports contain all three expected cells. Strengthen the successful-query wait
with renderedRows >0 and firstRow.length ===3; retain full comparisons, workload,
timer targets and deadlines. Native/fallback CSV host gaps in this failed run:
26.6299 /21.0948 ms. JSON/cancellation are not reached. Runtime-log scanning does
not complete after failing host tests; no warning-free claim applies.

Initial serializer measurement: 1,000,000 rows, 141,888,926 output bytes,
2,166 writes, max chunk 65,536; RSS baseline 51,150,848 /sampled peak 85,643,264
bytes; 15,882.2294 ms. Scoped Windows-process evidence only.
Required gate results are recorded below from observed command output.

Pre-race-repair standalone `npm run verify` passes 476 tests /44 files, zero
errors/warnings; unit stage 197.37 s, 20-file /621.71-KB package. This is not the
final candidate: two new red-first regressions then reproduce a late Cancel
request at/after Saving leaving the UI busy. Host now returns the actual save
outcome using the Cancel request ID; the webview accepts that terminal outcome.
Pre-commit cancellation still aborts and preserves existing output. Focused
48-test browser run passes after repair. Final candidate gates remain required.

Repaired final-candidate `npm run verify:full` passes, exit 0: 478 unit tests /
44 files (195.39 s), 38 real-host tests in VS Code 1.140.0 /Node 24.21.0 /Windows
x64, strict types/lint/builds and 20-file /622.66-KB VSIX. One approved renderer
record is accepted; full is NOT warning-free:
- Source `out/integration-profile-WfSRTK/logs/20261013T132107/window1/renderer.log`,
  line 10; original severity `warning`; rule `VSCODE-HOST-001`; exact message:
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
No other warning/error is accepted. The failed host candidate remains above.

Repaired real-host workload: 50,000 rows, duplicate blank headers, maximum int64
and 128-character text; both files checked through the final row. Native CSV/JSON:
941.2715 /920.1156 ms, 61 /60 host ticks, max gaps 16.7076 /19.6511 ms.
Fallback CSV/JSON: 1284.5997 /1425.1728 ms, 83 /91 ticks, max gaps 17.3339 /
24.3824 ms. Both larger writing exports cancel and preserve existing output,
successful DOM results and source hash. These are scoped host measurements,
not every-machine performance or the separate T-016 memory target.

Full-run serializer: 1,000,000 rows, 141,888,926 bytes, 2,166 writes, max chunk
65,536 bytes; RSS baseline 58,777,600 /sampled peak 93,069,312 bytes;
10,293.3959 ms. Native-dialog QA, independent review and new CI stay open.

Final standalone `npm run verify` passes, exit 0: 478 tests /44 files (201.82 s),
strict host/webview/tooling types, lint, production bundles and 20-file /622.66-KB
package; ZERO errors and ZERO warnings. Final serializer output is unchanged:
141,888,926 bytes in 2,166 bounded writes; RSS baseline 58,822,656 /sampled peak
93,097,984 bytes; 12,682.742 ms. Only evidence/handoff documentation is updated
after this gate; no implementation/test change follows it.

Native-dialog and visual owner QA (owner reports all six PASS; F5 / Run Extension):
1. Open `test/fixtures/sample.sqlite`. Run `SELECT *, zeroblob(24) AS bytes FROM
   fidelity ORDER BY rowid`. Keyboard-activate Export CSV and Export JSON to
   disposable local paths. Inspect exact int64 strings, REAL strings, NULL/empty
   conventions and BLOB placeholders; check controls/help in light/dark themes.
2. Run `WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<205)
   SELECT x AS id FROM n`. Export from page 2: verify all 205 rows starting at 1.
   Edit SQL without Run: export still uses that successful query. JSON contains
   columns and row arrays of strings.
3. Dismiss the Save dialog: old results remain, no output appears. Choose the
   source SQLite file: clear rejection; source still opens unchanged.
4. Export over an existing disposable file: native overwrite confirmation and
   complete replacement. Run `SELECT 1 AS empty WHERE 0`: CSV header only,
   JSON empty rows.
5. Run `WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<10000000)
   SELECT x, printf('%.*c',1024,'x') FROM n`. Export over existing disposable
   output; Cancel while counters increase. Old output survives, temporary folder
   disappears, page/text survive and a new query works.
6. Repeat writing export and close the tab before Saving: old output survives
   and temporary files disappear. Progress/Cancel work during writing; Cancel
   disables at Saving. Existing memory-limited banner stays if using fallback.
Report numbered PASS/FAIL results; do not overwrite valuable files for QA.

Commands: `npm run verify`; `npm run verify:full`. Owner reports every numbered
QA check PASS. Local automated acceptance and owner QA are now covered. Section 6
fresh-chat review and CI on a commit containing T-015 remain pending. Keep T-015
unchecked until that evidence is reconciled. T-016 is not started.

#### T-015 owner QA and supplied CI audit (2026-10-13)

Owner says "All QA number PASS" and supplies
[run 38352950470](https://github.com/JreyForFun/lite-voyager/actions/runs/38352950470).
Record all six numbered native-dialog/visual checks above as owner-reported PASS.
Individual observations and separate manual backend results are not supplied.
Existing automated both-backend evidence remains unchanged.

Public GitHub API metadata confirms attempt 1, push on main, completed success
at `6e25977cc72c6d879b4b49919ff631b5492cb8bd`:
- Windows job 115149266147: locked installation and Windows/macOS verification
  step succeed.
- Ubuntu job 115149266156: locked installation and Linux session-bus/virtual-display
  verification step succeed.
- macOS job 115149266161: locked installation and Windows/macOS verification
  step succeed.

That SHA is the local HEAD, `docs: close T-014 and hand off T-015 per owner
direction`. Its tree contains none of the new export service, serializer or
export host/unit tests; T-015 changes are still uncommitted at audit time.
Consequently this is valid green CI evidence for the previous commit, not for
T-015. Do not close candidate CI from this run. Commit the actual export code and
tests, then obtain fresh three-platform CI after the owner's push. Remote raw
logs/test counts/warning counts were not retrieved or called warning-free.
Fresh-chat review must include the complete cumulative diff from 6e25977,
including all eight newly created source/test files. No review result is claimed.
No implementation or test change follows the prior passing local gates.

Follow-up `npm run verify` after the owner QA/CI audit passes, exit 0: 478 tests /
44 files (217.06 s), zero errors/warnings, all strict checks/builds and a 20-file /
622.68-KB package. Only documentation evidence is updated after this gate.
Prepare a local T-015 implementation/test/handoff commit for the owner's push;
keep fresh-chat review and actual-candidate CI pending, and exclude generated
owner exports and unrelated untracked files from that commit.

#### T-015 independent review and owner-delegated closure checks (2026-10-13)

Owner delegates checking both commits and finishing T-015 in this session using
best judgment so the next task can proceed. One fresh-context read-only reviewer
examines the full 30-file /1,145-insertion diff from 6e25977 to 204197a, including
all eight new source/test files. The dedicated Bugbot backend is unavailable;
this is an independent reviewer fallback, not a claim of a Bugbot service run.

Review confirms one MEDIUM FR-014 defect: after Closing during Saving, failed
atomic rename is swallowed by ExportService.settled and disposed browser delivery;
session/provider do not notify the save failure. An in-process probe using actual
Session/Browser/ExportService with deferred mocked rename proves old output stays
intact and cleanup succeeds, but the save error disappears. A spawned esbuild
probe has EPERM; the successful in-process reproduction is separate evidence.
No other concrete defect or scope creep is found in the original cumulative diff.

Two root regressions fail before repair: settled resolves after failed rename;
provider replaces save guidance with cleanup text. Retain post-commit failure,
preserve its actionable session message, and notify it after closure. Actual
deferred-rename session regressions cover failure and successful save during
closure, unchanged source/output, and completed cleanup. Independent follow-up
reproduces the repaired error and finds no concrete new defect.

Root then reproduces a collateral case: retained export failure wrongly turns
cancellation of a later SQL query into database recovery failure. A red-first
regression fails; snapshot the active-export state before engine cancellation and
await export settlement only when cancelling an export. Independent follow-up
confirms the original notification fix stays intact and no defect remains.
Focused 42 tests pass. Reviewer makes no edits and does not run full gates.

GitHub branch/API checks still put remote main at 6e25977; candidate 204197a is
not resolved by GitHub (HTTP 422). The latest supplied green run is therefore
previous-commit evidence only. Owner reserves pushing. Under VALIDATION section 2,
the scoped task may close after current local gates, acceptance, owner QA, review,
handoff and commit; three-platform CI remains the Milestone 1 gate in TASKS.
Preserve pending actual-candidate CI without claiming it passed or closing the
milestone. Do not change any behavioral criterion, workload, deadline or warning
policy. T-016 begins only in a fresh task chat after the current checks finish.

Final repaired gate/closure evidence follows below from command output.

First closure-gate attempt passes all three typechecks but fails lint at
export-failures.test.ts:40 on an unsafe inferred `any` from an asymmetric matcher
inside an object. Split that matcher into equivalent typed phase/message
assertions; preserve output/source/cleanup checks and do not suppress the rule.
The failed gate remains recorded; the repaired gate is rerun.

Final repair `npm run verify` passes, exit 0: 482 unit tests /44 files (216.37 s),
all three strict typechecks, lint, builds and a 20-file /622.89-KB VSIX; ZERO
errors and ZERO warnings. Serializer evidence remains scoped: 1,000,000 rows /
141,888,926 bytes /2,166 writes /65,536-byte max chunk; RSS baseline 58,712,064 /
sampled peak 93,224,960 bytes; 15,567.601 ms.

Final `npm run test:integration` passes, exit 0: compilation/build and 38 real-host
tests on Windows x64 /VS Code 1.140.0 /Node 24.21.0. Its strict runtime-log scan
accepts exactly one record; this host run is NOT warning-free:
- Source `out/integration-profile-kcCfbJ/logs/20261013T142447/window1/renderer.log`,
  line 10; severity `warning`; rule `VSCODE-HOST-001`; exact message:
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
No other warning/error is accepted. These two observed commands cover the local
unit/build/package and real-host/log gates; do not claim a new combined
`verify:full` invocation. Retain the earlier full-run evidence separately.

Current 50,000-row export measurements: native CSV/JSON 982.4584 /1009.4963 ms,
63 /66 host ticks, max gaps 16.1898 /21.2563 ms; fallback 1418.1927 /1816.5761 ms,
91 /116 ticks, max gaps 26.4483 /21.4174 ms. Both formats/end rows, source hashes,
DOM preservation and larger writing cancellation pass on both engines.

Final API recheck still reports remote main at 6e25977 and latest green run
38352950470 at that SHA. Actual repair-candidate CI is pending the owner's push.
Under the owner's instruction to check both commits and use best judgment to
move to the next task, close scoped T-015 against the per-task Definition of Done:
test-first acceptance, clean current verify, actionable failures, Constitution,
matching spec/plan, owner QA, independent review/follow-up, handoff and local
commit. Keep three-platform actual-candidate CI, whole-milestone review/QA,
T-016/schema follow-up and milestone release/tag open. No behavior, workload,
deadline or diagnostic allowance is weakened. Only closure/evidence docs change
after these final passing gates. Existing generated/unrelated untracked files
are not included in the repair/closure commit. Next task starts in a fresh chat.

### T-016 implementation and validation (2026-10-13)

The owner authorizes full implementation, scoped fixes and fixture changes,
and will handle pushing. The owner separately approves the native transient
SHM coordination exception after the initial WAL hash test fails. The exact
SQLite acceptance and sampled-memory contract are in SPEC's T-016 section;
PLAN documents implementation and the fixture README gives repeatable commands.

Coverage:
- `sqlite-safety.test.ts`: real custom editor on both engines; invalid header,
  truncated/zero-byte input and valid-header damaged schema page; valid empty
  recovery; writable/read-only files; table/view paging, exact int64 values,
  1,000 columns and large cells; visible prohibited-write rejection; cancellation,
  helper crash and successful reopening. Final byte counts/SHA-256 must match,
  and unexpected sidecars must not appear.
- Idle WAL writer: native must read a committed WAL-only row; fallback must
  refuse visibly without any SHM change. Main database/WAL hashes stay exact.
  Native SHM changes may touch only reader marks at bytes 100..119 of the
  controlled fixture, per [SQLite WAL-index format](https://www.sqlite.org/walformat.html).
  No source checkpoint, SHM restoration, forced write or ignored failure.
- `sqlite-memory.test.ts`: calibrates the actual OS observer in a real host,
  then generates ten-million-row 1 GB/5 GB databases and exercises 60 Browse
  pages, a complete payload scan and 20 SQL pages on each. Record full source
  hashes outside the memory window. The default full suite includes this test;
  insufficient disk space fails explicitly and never skips it.
- `sqlite-memory.test.ts` under `test/unit`: OS parser/units/process attribution,
  strict peak/growth/gap/process/sample rejection and actual generator fidelity,
  integrity and existing-destination refusal. Tests fail before support exists;
  the PID-zero Windows idle-process regression also demonstrably fails before
  its repair and passes afterward.

Retained failed candidates:
- Sandbox Vitest startup fails with `spawn EPERM`; the same command runs with
  approved escalation and exposes missing test support before implementation.
- Initial real-host safety adapter observes completed SQL before DOM paint;
  three assertions fail. Correlated painted-row waits repair the adapter.
- The first corrected safety run passes four cases and fails on native SHM
  bytes, while database/WAL hashes match. Owner approves the explicit contract
  correction; the revised test constrains SHM changes rather than ignoring it.
- Observer calibration exposes Node 24's typeless `.ts` module diagnostic.
  Load the already compiled CommonJS support instead of suppressing the warning.
- Windows EncodedCommand emits module-preparation CLIXML progress. Disable only
  that progress UI; all warning/error streams remain enabled and fail the gate.
- The OS snapshot legitimately includes Windows PID-zero Idle. A failing unit
  regression precedes the parser repair; actual host/helper IDs stay positive.
- An in-progress first full unit gate observes the pre-repair parser and ends
  with 484 passing /1 failing tests. Final verification must use repaired code.
- Large-file attempt fails before generation because free C: space is about
  2.56 GB, below the documented 9 GB requirement. Owner elects to free space.
- First actual full run passes 485 unit tests but ends with 43 real-host passes
  and two failures: the large case exceeds its unchanged 600,000 ms deadline,
  and its late asynchronous close-all cleanup interferes with the following
  fallback `.db3` editor test. Do not treat numeric memory observations as a
  passing test or gate. Both source hashes and observed memory criteria finish
  successfully afterward, which exposes the harness isolation bug rather than
  proving task completion.
- Red-first deadline/hash tests fail before budget support exists. Repair uses
  a fixed 1 MiB hash batch instead of 64 KiB filesystem requests, a 540-second
  abort budget propagated to generation/hashing/observation, remaining query
  deadlines and a minute for teardown before Mocha can advance. Preserve both
  full ten-million-row databases, all 80 UI pages, complete scans, source hashes,
  500 MB/50 MB targets, five samples, 3,000 ms gaps and the 600 s outer deadline.

Observed scoped results so far:
- Three measurement/fixture unit tests pass; final canonical gates follow.
- Two added hash/deadline regressions pass as well (five scoped unit tests):
  the child stops before the outer test timeout; complete final-partial-chunk
  hashing detects a last-byte edit, and an aborted stream rejects.
- Five real-host safety tests pass after the owner-approved SHM clarification.
- Repaired observer calibration passes on Windows x64 /VS Code 1.140.0 /
  Node 24.21.0: seven samples, six containing the helper; combined sampled peak
  271,093,760 bytes, host peak 162,148,352, helper peak 108,945,408, separate
  renderer peak 461,873,152, largest gap 1,685.7676 ms, paging growth 450,560.
  This is small-file observer evidence, not a multi-GB memory result.
- Calibration strict log gate exits 0 with these two explicitly accepted records
  from `out/integration-profile-t016-H5vfj3/logs/` (not warning-free):
  - `20261013T161818/window1/renderer.log:2`, severity `warning`, rule
    `VSCODE-HOST-002`, exact message:
    `Creation of workbench contribution 'workbench.contrib.chatLanguageModelsData' took 23ms.`
  - `20261013T161818/window1/renderer.log:10`, severity `warning`, rule
    `VSCODE-HOST-001`, exact message:
    `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.

T-016 remains unchecked until the large-file acceptance and required gate pass.
The CSV memory target, physical/cold-disk first paint, schema follow-up, whole-
milestone QA/review, fresh three-platform CI and release/tag remain separate.

Additional repaired scoped run (2026-10-13): all 44 currently runnable real-host
tests pass, including all pre-existing 38 and the six new safety/calibration
cases. The temporary targeted runner uses the same isolated environment and
strict runtime-log scanner while the owner frees space; it explicitly excludes
the still-required large-file case and is **not** `verify:full` completion.
The source/observer scenarios pass alongside the previous browsing, SQL,
cancellation, metadata and export assertions with their existing deadlines.
`out/integration-profile-t016-bjclhM/logs/20261013T162132/window1/renderer.log:10`
contains one accepted severity `warning`, rule `VSCODE-HOST-001`, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
The run exits 0 under that policy and is not warning-free. Disk capacity grows
to about 7.17 GB but the 9 GB large-fixture requirement is still unmet.

Repaired actual large-file run (2026-10-13): the same ten-million-row populated
databases, byte-for-byte identical to the first measured candidate, now pass
in 345,191 ms under the unchanged 600,000 ms deadline. Generation, all hashes,
80 actual UI pages per file, complete payload scans, helper closure and final
cleanup complete before the framework advances. Reported measured-work elapsed
time is 344,735.8128 ms; the rest is final fixture cleanup.

- Smaller file: 1,285,033,984 bytes; SHA-256
  `7fe4e06f189cc8bcc833521f82a2833118a98245d3c9f26d8bbae21032e0b298`;
  sampled combined peak 315,715,584 bytes; independent host/helper component
  peaks 201,498,624 /121,741,312; separate renderer peak 395,165,696;
  23 samples /22 with helper; maximum gap 1,242.5107 ms; paging growth 0.
- Larger file: 5,874,388,992 bytes; SHA-256
  `203e3860172622ef1a65108ae8d14acfe51c25b0f689ae267f4184e4721a535e`;
  sampled combined peak 268,271,616 bytes; independent host/helper component
  peaks 242,352,128 /123,109,376; separate renderer peak 395,452,416;
  46 samples /45 with helper; maximum gap 1,433.2078 ms; paging growth 2,908,160.
- Combined peaks sum components at the same observation. Independent component
  maxima need not happen together and must not be added as a simultaneous peak.
  The larger input grows by 4,589,355,008 bytes; sampled combined peak changes
  by -47,443,968 bytes. Do not subtract idle host memory or claim instantaneous
  unsampled peaks. Both observed peaks satisfy the strict 500,000,000-byte cap
  and both growth checks satisfy the 50,000,000-byte allowance.
- VS Code 1.140.0 /Node 24.21.0 /Windows x64; primary engine only. Two scoped
  real-host tests pass (calibration and large case), followed by strict log-gate
  exit 0. This run is not warning-free: one severity `warning` record at
  `out/integration-profile-t016-oty9rU/logs/20261013T165516/window1/renderer.log:9`,
  rule `VSCODE-HOST-001`, exact message
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.

Final repaired complete gate (2026-10-13): `npm run verify:full` exits 0 with
487 unit tests /45 files (190.33 s), all 45 real-host tests (about eight minutes),
strict types/lint, builds and the 20-file 622.93 KB VSIX package check. Tests and
observers are excluded from the VSIX. The legacy fallback `.db3` test also
passes, confirming the timeout repair no longer closes a following test's tab.
All memory workloads, budgets, caps and diagnostic rules remain unchanged.

Final full-run memory observations, preserved in
`out/integration-profile-BqiNnE/logs/20261013T171030/window1/renderer.log:37`
and `:39`:
- 1,285,033,984-byte file: combined peak 269,840,384 bytes; host/helper peaks
  147,640,320 /122,200,064; separate renderer peak 418,476,032; 23 samples /22
  with helper; maximum gap 1,790.0809 ms; paging growth 3,981,312 bytes.
- 5,874,388,992-byte file: combined peak 284,991,488 bytes; host/helper peaks
  162,189,312 /123,363,328; separate renderer peak 404,979,712; 41 samples /40
  with helper; maximum gap 1,932.3043 ms; paging growth 0.
- Same complete SHA-256 values as above; ten million rows in each; all 80 pages
  per file and full payload sums pass. Larger-file peak growth is 15,151,104
  bytes against the 50,000,000-byte allowance. Measured-work elapsed time is
  339,262.2889 ms, safely inside the unchanged outer deadline.

The final strict log gate accepts exactly one record and is **not warning-free**:
`out/integration-profile-BqiNnE/logs/20261013T171030/window1/renderer.log:10`,
original severity `warning`, rule `VSCODE-HOST-001`, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
No error or other warning is accepted. Earlier standalone `npm run verify`
passed 485 tests /45 files with zero errors/warnings before the two additional
deadline/hash regressions; final full verification repeats every automatic
stage with all 487 tests. Retain both facts without calling the earlier run
a 487-test standalone verification.

Final standalone completion-record `npm run verify` also exits 0 after the
repair and handoff updates: 487 tests /45 files in 197.35 s, strict types/lint,
builds and the 20-file package check, with zero errors and zero warnings. This
is the current warning-free automatic-gate evidence; the separate full host
run retains its one explicitly reported approved warning.

Only T-016's scoped acceptance is complete. The owner handles pushing and fresh
three-platform CI. CSV import memory, physical/cold-disk first paint, schema
follow-up, whole-milestone QA/review and release/tag remain open. Preserve every
failed candidate and the late-cleanup defect; no independent review or remote
warning/test-count claim is added by this task.

### T-016 failed candidate CI and harness repair (2026-10-13)

Owner supplies Windows/macOS full-step logs for
[run 38378099885](https://github.com/JreyForFun/lite-voyager/actions/runs/38378099885).
Public GitHub API confirms commit `caf209b2a72ffe6363d4f2ff470f05809db2c6fb`,
completed/failure, Ubuntu success, Windows failure and macOS failure. Keep the
previous local result; reopen T-016 pending repaired validation.

- Windows: 487 unit tests pass, 43 host tests pass, two T-016 memory tests fail
  because the OS observer's PowerShell command fails without a useful reason.
  Its cold per-snapshot subprocess has a 3,000 ms command timeout; the supplied
  text alone does not establish whether the command timed out or another
  process failure occurred. Subsequent repair reports explicit phase/timeouts.
- macOS arm64: 487 unit tests pass and 44 host tests pass. Real memory reports
  have peaks 270,581,760 /354,779,136 bytes, size growth 84,197,376, above the
  unchanged 50,000,000 allowance. Paging growth is zero, gaps 443.019417 /
  360.307833 ms, and both complete hashes match. This is a failed memory
  acceptance; do not treat the sub-500 MB individual peaks as a complete pass.
- Streamed hashes allocated new 1 MiB chunks for every read in the measured
  extension host before/after each window. Those allocations may remain
  resident and contaminate the next window despite bounded live stream storage.
  The remote log does not prove this is the sole cause of macOS growth.

Red-first behavioral regressions reproduce a reader killed during delayed
initialization and 14 different hash buffers instead of one (two failing/five
passing tests). Repair reuses one fixed hash buffer and starts one persistent
Windows PowerShell/CIM reader. Its initial bootstrap is bounded at 20 seconds
before opening; every later snapshot retains the 3,000 ms watchdog, and every
observed gap remains subject to the existing gate. Diagnostics, unexpected
exit and missing/invalid process evidence still fail; stop awaits actual child
closure. No retries, skipped data, idle subtraction, dependency or production
behavior change. All full hashes, 10-million-row files, 80 pages per file,
payload scans, cap/growth rules and 540/600-second budgets remain unchanged.

At repair kickoff, local gates and fresh owner-pushed three-platform CI are pending.

Local repair attempts retained without a pass claim:
- `out/t016-ci-repair-full.log`: lint rejects two newly added `async`
  callbacks without `await`. Return resolved promises instead; no lint disable.
- `out/t016-ci-repair-full-2.log`: types/lint pass; 471 tests /44 files pass,
  but Vitest reports one worker-start handshake timeout for the existing
  `sqlite-browser.test.ts` before its tests execute (285.61 s). The full gate
  fails and does not reach integration. No test or runner timeout is changed.
- `out/t016-ci-worker-diagnosis.log`: the same unchanged browser suite passes
  all 18 tests in isolation (783 ms). This diagnoses the missing suite; it does
  not turn the failed full attempt into a pass or prove a specific host cause.
Run the separate real-host gate and required standalone automatic gate; record
each outcome independently. Fresh CI must still run full verification.

Separate repaired `npm run test:integration` exits 0: all 45 tests pass in
VS Code 1.140.0 /Node 24.21.0 /Windows x64, including both-engine invalid/source
safety, cancellation/crash recovery, constrained SHM/WAL checks and unchanged
full SHA-256 values for both ten-million-row databases. No acceptance limits
or workloads change.

- 1,285,033,984-byte file: combined peak 270,688,256; host/helper peaks
  149,954,560 /121,946,112; renderer peak 413,040,640; 44 samples /43 helper;
  maximum gap 543.206 ms; repeated-paging growth 6,770,688 bytes.
- 5,874,388,992-byte file: combined peak 276,115,456; host/helper peaks
  153,399,296 /123,113,472; renderer peak 424,046,592; 100 samples /99 helper;
  maximum gap 584.9556 ms; repeated-paging growth 9,945,088 bytes.
- Larger-file peak growth 5,427,200 bytes; workload elapsed 192,188.2255 ms.
  Both 60 Browse/20 SQL page sequences and complete payload scans pass.
  Hashes are the same complete SHA-256 values recorded above. Raw numeric
  evidence is retained in `out/t016-ci-repair-integration.log` lines 76/78/79.

Exactly one structured record is accepted; this host gate is **not warning-free**:
`out/integration-profile-jdqstT/logs/20261013T181428/window1/renderer.log:10`, original severity `warning`,
rule `VSCODE-HOST-001`, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
No error or other warning is accepted. Fresh full CI remains pending;
do not rename the failed full attempt as a success.

Required final standalone `npm run verify` exits 0 with all 489 tests /45
files (202.69 s), strict types/lint, production builds and the 20-file 622.93 KB VSIX.
It has zero errors and zero warnings; output is retained in
`out/t016-ci-repair-verify.log`. Together with the separately passing 45-host
integration/log gate this validates the repaired local candidate. It does not
overwrite either failed full attempt, establish the sole macOS cause or
prove remote completion. Keep T-016 unchecked until fresh owner-pushed full CI
confirms the repaired candidate on Windows/macOS/Ubuntu.

#### T-016 repaired-candidate CI confirmation (2026-10-13)

Owner supplies [run 38384170955](https://github.com/JreyForFun/lite-voyager/actions/runs/38384170955)
as GOOD. Public GitHub API independently confirms attempt 1, completed success,
at `284fbee92d7c81ade010393e8438faf318c8e819`, matching the local repair commit.
- Ubuntu job 115251701433: locked installation and Linux session-bus/virtual-
  display full-verification step succeed.
- macOS job 115251701563: locked installation and Windows/macOS full-verification
  step succeed.
- Windows job 115251701728: locked installation and the same full-verification
  step succeed.

The opposite-platform conditional step is skipped as designed; the applicable
full gate succeeds on each platform. Raw remote logs, exact test/memory figures
and warning counts were not retrieved; do not claim remote warning-free runs.
Retain the independently observed 489-test clean local verify, passing 45-host
integration/log gate and its exact local VSCODE-HOST-001 record above. The green
macOS result confirms repaired acceptance under the unchanged limits, not sole
causation of the previous allocation hypothesis. Preserve all prior CI, lint,
deadline, late-cleanup and Vitest-startup failures.

T-016 is checked: invalid-input recovery, both-engine source safety and scoped
real 1 GB/5 GB primary SQLite memory acceptance pass, with repaired three-platform
full CI confirmed. No implementation, fixture, workload, limit or dependency
changes follow 284fbee. Only completion/evidence documents change. Schema
follow-up, CSV memory, cold/physical first paint, whole-milestone QA/review and
release/tag remain open. Closure-documentation `npm run verify` exits 0 with
489 tests /45 files in 202.04 s, zero errors/warnings, strict types/lint,
builds and the 20-file 622.93 KB package check. Output is retained in
`out/t016-ci-closure-verify.log`. No behavior or acceptance change follows
the green candidate; the exact approved prior local host warning remains.

### T-019 Milestone 1 delegated QA/review candidate (2026-10-13)

The owner explicitly delegates the remaining QA/review and repairs, selects a
local VSIX preview, and retains pushing. This is one Milestone 1 gate task;
no Milestone 2 feature or dependency is added. The checked universal items
above describe the foundation gate and must not be reused as Milestone 1 proof.

Fresh-context Bugbot reviews the real cumulative `v0.0.1`-to-working-tree diff,
including the production changes, rather than the latest documentation commit.
Six confirmed MEDIUM findings are repaired: missing opt-in schema UI, shared
same-file view lifetime, rejected legal empty identifiers, prematurely committed
page size on failure/cancel, invented shrinking query totals, and silently
replaced native malformed TEXT. Follow-up identifies a schema/sort-confirmation
bypass, oversized typed-index Loading hang, and missing schema context after SQL
restoration/empty catalog replacement. Each is reproduced before repair.
Independent follow-up probes confirm all repairs and find no remaining concrete
defect. Reviewer probes are separate from root full verification, not a host pass.
The proposed abort-listener leak is not reproduced and Chromium's weak listener
references do not support labelling it a confirmed leak; no speculative refactor.

Preserved red/failure evidence:

- `out/t019-regressions-red.log`: seven initial native/identifier/total/size failures.
- `out/t019-regressions-partial.log`: three remaining native encoding failures.
- `out/t019-schema-views-red.log`: schema UI/host and per-view failures.
- `out/t019-followup-red.log`: sort-confirmation bypass and oversized-index failures.
- `out/t019-schema-context-red.log`: restored SQL and empty-catalog schema failures.
- `out/t019-appearance-red.log`: absent opt-in appearance observation.
- First strict candidates stop at new QA type errors; fixes use no suppressions.
- `out/t019-full-candidate-3.log`: 504 pass /one failure of 505 unit tests,
  198.80 s; the appearance harness omitted its action correlation ID. The real
  bridge reports correlated actions; supply the required ID and retain the
  positive computed-color assertion. No production assertion or deadline weakens.
- The empty-identifier fixture initially attempted identical empty table/index
  names in one database. SQLite shares that namespace; split the two valid
  cases into separate databases and retain both positive source-safe checks.
- `out/t019-full-candidate-4.log`: 506 unit tests /47 files pass (188.95 s),
  strict types/lint/build/package pass; real host has 47 pass /two failures.
  Both native-only failures expose WITH DELETE reaching the text wrapper and
  getting a synthetic near-`)` error instead of the required read-only refusal.
  Keep both source-safety and SQL-editor assertions/deadlines unchanged.
- `out/t019-with-write-red.log` reproduces the missing pre-wrapper refusal;
  `out/t019-with-syntax-red.log` catches incorrectly classifying a malformed
  CTE column list as a completed body. Recognize AS/[NOT]/MATERIALIZED bodies
  and the following main statement. Refuse confirmed DML with or without
  RETURNING; preserve valid `replace` CTE names, recursive/multiple/nested
  reads, VALUES, quoting/comments, and genuine SQLite syntax diagnostics.
  Focused engine/encoding/regression run passes 61 tests; final scanner's
  seven regression tests pass. No assertion, workload or diagnostic weakens.

The failed full candidate nonetheless passes all four new real-host schema and
same-file-view cases, including ten metadata pages, literal defaults/index SQL,
empty/quoted names, malformed text rejection, retained SQL, actual grid keyboard
events and computed light/dark colors. Both-engine view sessions retain separate
results; closing one during the other's acknowledged query leaves the survivor
available for cancellation/retry and all helpers close. These are observable
DOM/transport tests, not a physical-paint or subjective visual assessment.

Its real large-file checks pass: 1,285,033,984 /5,874,388,992 bytes, ten million
populated rows each; warm first DOM readiness 974.363 /940.437 ms (under 2 s).
Combined sampled host/helper peaks 272,936,960 /285,229,056 bytes (under 500 MB),
size growth 12,292,096 (under 50 MB), repeated-paging growth 8,744,960 /13,570,048;
47/129 samples, 46/128 helper samples, maximum gaps 504.171 /476.780 ms (under 3 s).
Renderer peaks 433,418,240 /431,292,416 are separate. Workload 264,104.161 ms
retains complete hashes, 60 Browse/20 SQL pages and full payload scans. Hashes
equal the previously recorded SHA-256 values. This does not turn the overall
failed full attempt into a pass or establish an unsampled memory peak.

Compatibility focused run passes 69 tests /four files. The repaired production
candidate `out/t019-full-final.log` passes 513 unit tests /47 files (195.64 s),
strict types/lint/build/package and all 49 real-host tests on Windows x64 /
VS Code 1.140.0 /Node 24.21.0. Both native failures above now pass with the
unchanged assertions/deadlines. All six UTF-8/UTF-16 worker cases pass too.

This full run is **not warning-free**. Exactly one approved record is accepted:

- Source: `out/integration-profile-NhurTQ/logs/20261013T223647/window1/renderer.log`.
- Line: `10`; original severity: `warning`; rule: `VSCODE-HOST-001`.
- Message: `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.

No other warning/error is accepted. The prior failed profile also has an
offline VS Code background-gallery error at
`out/integration-profile-hBRuRA/logs/20261013T221514/network-shared.log:1`:
`#2: https://main.vscode-cdn.net/extensions/marketplace.json - error GET net::ERR_INTERNET_DISCONNECTED`,
plus the renderer's two-test-failure error at `window1/renderer.log:136`.
An independent strict scan fails on both; do not allowlist or erase them.
Its approved warning is `window1/renderer.log:10`, severity `warning`,
VSCODE-HOST-001, the same exact CloudSandboxApi message quoted above.

The subsequent production-candidate full result passes, but a single pass does
not prove the intermittent background request cannot recur. A configuration
regression first fails (`out/t019-gallery-red.log`, one fail/four pass), then
passes all five cases after setting only the isolated profile's signed-out
private-gallery route plus automatic-update settings. VS Code 1.140's shipped
service code confirms that a nonempty private URL and no account yield a null
manifest before any fetch, also sent to the shared process. The control cache
handles that at TRACE. No vendor binary/product file, user profile, dependency
or diagnostic rule changes. `out/t019-full-gallery-final.log` passes 513 unit
tests /47 files (204.48 s) and all 49 host cases (six minutes), including
assertions of effective settings/sign-out and strict runtime logs. Its one
approved diagnostic is source
`out/integration-profile-KmTMDI/logs/20261013T225537/window1/renderer.log`,
line `10`, severity `warning`, rule `VSCODE-HOST-001`, message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
This full result is not warning-free.

Additional large-grid acceptance retains both primary-key sort directions,
descending broad filtering, a complete eleven-row literal filter, unindexed
sort confirmation retaining the page, and clearing back to offset zero.
The original 60 Browse/20 SQL pages, full payload scan/hashes, 500 MB/50 MB
caps and 540/600 s budgets are unchanged. Preserve these failed attempts:
`out/t019-full-large-grid-final.log` has 513 unit passes and 48 host passes /
one failure because the new harness mistook a retained sort-confirmation
page for completed sorting. Await correlated completion and accept the
confirmation before checking actual rows. `out/t019-full-large-grid-repaired.log`
has the same counts; all added 1 GB controls pass, but a reverse 5 GB rare
filter exceeds its new 120 s action deadline. It is not a source/memory pass
for the unfinished second file. Retain both directional sort and descending
broad-filter assertions, then use forward primary-key traversal for the full
rare-filter scan, as for the original payload scan. Do not claim the reverse
full scan passed. Fresh reviewer finds no weakened original criterion and
no spec target requiring a reverse scan within 120 s.

`out/t019-full-large-grid-forward-final.log` passes 513 unit tests /47 files
(287.33 s) and all 49 host tests (eight minutes), including both strengthened
large-grid cases, but **fails** strict logs on an unapproved renderer warning.
Source `out/integration-profile-UwjrWd/logs/20261014T000528/window1/renderer.log`,
line `3`, severity `warning`, exact message
`Creation of workbench contribution 'workbench.contrib.chatPetContext' took 25ms.`
Keep this failure; do not extend the warning policy. Its approved records
in that same source are line `2`, severity `warning`, VSCODE-HOST-002,
`Creation of workbench contribution 'workbench.contrib.chatLanguageModelsData' took 24ms.`,
and line `12`, severity `warning`, VSCODE-HOST-001,
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.

That failed attempt's observed large-file workload nonetheless meets every
numeric/source assertion: 1,482.977 /1,889.464 ms first DOM; combined sampled
peaks 273,494,016 /289,894,400 bytes, growth 16,400,384, paging growth
4,562,944 /18,702,336. Renderer peaks 412,758,016 /412,004,352 are separate.
There are 81/194 samples (80/193 with helpers), maximum gaps 734.762 /740.806 ms.
Both files contain ten million rows; both exact original hashes match.
Total 337,944.229 ms includes both added full filters and every original
page/hash/scan, within the unchanged 540/600 s budgets. This is scoped warm
DOM and sampled resident-memory evidence, not physical feedback or an overall
full pass. `out/t019-full-clean-retry.log` was started as an unchanged rerun
before correctly applying section 1's explicit no-retry-to-green prohibition.
It reproduces additional unapproved warnings and is stopped once that is
established; it cannot erase the first failed gate or count as a complete run.
All 513 units pass again (274.59 s); both new large-grid cases pass, but the
second file's final workload/hash is interrupted and no completed memory
comparison is claimed. Only this verified run's process tree is stopped;
the user's VS Code remains open. Its owned `out/t016-memory-Nc7kBa` directory
is verified within the project before cleanup; generation metadata is retained
in `out/t019-aborted-retry-generation.json` and logs remain intact.

Its renderer source is
`out/integration-profile-eVmO6a/logs/20261014T002237/window1/renderer.log`:
line `1`, severity `warning`, unapproved
`Creation of workbench contribution 'workbench.contrib.preferencesActions' took 31ms.`;
line `3`, severity `warning`, unapproved
`Creation of workbench contribution 'workbench.contrib.chatPetContext' took 21ms.`;
line `12`, severity `warning`, approved VSCODE-HOST-001,
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.

Read-only inspection of shipped VS Code 1.140.0's
`out/vs/workbench/workbench.desktop.main.js` confirms these are workbench
contributions created and timed by `safeCreateContribution` using `Date.now()`.
Preferences registers settings/keybinding actions; pet context binds the
vendor pet-service enabled state. The warnings precede loading either
development extension in this run. No vendor edit or warning suppression is
applied. The concrete proposal is to permit only these two additional exact
renderer startup-timing families with integer durations, using the same
source/severity/reporting restrictions as HOST-002, while preserving every
other diagnostic rule and all responsiveness targets. At that point the
proposal awaits explicit approval and section 1/scanner tests are unchanged.
That full gate remains a recorded failure. Final standalone `npm run verify`
(`out/t019-verify-final.log`, 2026-10-14) passes all 513 unit tests /47 files
in 273.46 s, strict host/webview/tooling types, lint, production builds and
the 20-file /626.61 KB package dry run, with zero errors and zero warnings.
This clean non-host gate does not clear the full host-log failure.

Local preview prepared: `out/t019-preview/lite-voyager-t019-preview.vsix`,
641,652 bytes, 20 ZIP entries; SHA-256
`8251a4e36304a82ad65d1f277e232941885a3057d7e4da813b4ab4e7978ffd34`.
Archive inspection confirms required worker/webview/WASM assets and excludes
src/scripts/test/out/node_modules/authentication fixtures. `PREVIEW.md` contains
the installation command and five physical feedback checks; disposable
`gate.sqlite` /`browser.sqlite` are provided in the same directory. Candidate
manifest version stays 0.0.1 until release closure. Feedback is pending when
prepared; availability alone does not complete the preview-feedback gate.

The owner's "Do it" authorizes installation/QA; it is not PASS feedback.
CLI installation succeeds in VS Code 1.141.0; locate/list confirm
`C:/Users/ADMIN/.vscode/extensions/jreyinnovarev.lite-voyager-0.0.1`.
All fourteen installed runtime assets match the VSIX byte-for-byte.
Installation emits the tool's `[DEP0169] DeprecationWarning` about `url.parse()`;
do not call installation warning-free or change the vendor to suppress it.

The same four host schema/view/theme/key/source cases target the actually
installed artifact; fixture scripts and compiled test controller remain in
the project, outside the VSIX. `out/t019-installed-preview.log` passes four
cases but fails strict logs on stock VS Code's `Error mutex already exists`
while the user's app runs. Use isolated cached VS Code 1.141.0 instead of
closing the user's windows. `out/t019-installed-preview-isolated.log` also
passes four cases but fails on the external controller's require-path warning:
`out/integration-profile-packaged-Z49lVI/logs/20261013T234826/window1/exthost/exthost.log:5`,
severity `warning`, `Could not identify extension for 'vscode' require call from file:///c%3A/Users/ADMIN/lite-voyager/out/integration/test/milestone-one.test.js. These are the extension path mappings: `.
It also has approved warnings at `window1/renderer.log:2`, VSCODE-HOST-002,
`Creation of workbench contribution 'workbench.contrib.chatLanguageModelsData' took 25ms.`,
and `window1/renderer.log:11`, VSCODE-HOST-001, the exact CloudSandboxApi
message above. `out/t019-installed-preview-mapped.log` still fails that mapping
warning and an unapproved `workbench.contrib.preferencesActions` 21 ms warning;
neither is added to the policy.

A separate activatable QA controller fixture maps the tests without placing
test assets in the installed extension or replacing its production entry point.
`out/t019-installed-preview-controller.log` passes all four cases /18 s plus
strict logs. Its only approved record is source
`out/integration-profile-packaged-owlgK7/logs/20261013T235639/window1/renderer.log`,
line `11`, severity `warning`, rule `VSCODE-HOST-001`, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
This installed-preview result is not warning-free. Desktop visual inspection
remains unavailable: the approved `@oai/sky` API returns
`Computer Use native pipe is unavailable: failed to connect native pipe: The system cannot find the file specified. (os error 2)`.
Do not substitute computed colors/key events for physical feedback or launch
a custom automation helper. The five feedback checks remain open at that point.

The scoped trace finds all 16 linked Milestone 1 requirement IDs in real test
declarations: FR-001/002/003/010/011/014/015/016/017/018 and
NFR-001/002/003/004/005/009. FR-016 is the read-only/refusal/source-safety subset;
write mode remains Milestone 3. Matching names index actual assertions, rather
than establish every future acceptance clause. Global trace still reports
FR-005/006/007/012/013/020/021/022/030/040 and NFR-006/007/008/010; these remain
later work. A source search finds no TODO/FIXME in src/webview/scripts/test/.github.

#### Owner preview feedback and narrow host approval (2026-10-14)

The owner explicitly answers **"All five checks pass"** after installation
and the `PREVIEW.md` checklist: literal empty-name schema/index details,
all 1,000 columns with recoverable metadata errors, retained SQL/export context
and visible malformed-text refusal, independent views with close/cancel/retry,
and visible light/dark readability plus keyboard navigation. This is owner
physical preview feedback in addition to the delegated real-host observations;
it does not establish universal cold/physical paint or unsampled memory peaks.

The owner separately answers **"Approve the two exact host families"** to
the concrete preferencesActions/chatPetContext renderer-only timing proposal.
Persist exactly HOST-003/004 in section 1 and AGENTS, using the unchanged
dated renderer path, structured warning severity, integer-duration wording and
explicit source/line/severity/rule/message reporting. Errors, other sources,
other contribution names, suffixes and altered/noninteger durations still fail.
The console gate, types/lint, original workloads/caps/deadlines and no-retry-to-
green policy are unchanged. Prior failed runs retain their original outcomes;
no retrospective pass or warning-free claim.

Tests first: `out/t019-host-exceptions-red.log` fails four cases with 31 passing
before implementation; `out/t019-host-exceptions-green.log` passes all 35.
The two new positive classifications and console reports fail first. Added
negative cases preserve errors/wrong-source rejection and reject lookalike
names, appended diagnostics, signed/fractional/unknown durations. Fresh full
verification after this explicitly authorized policy change is pending.
The existing independent reviewer checks the actual narrow diff from d16dcc6
and finds no concrete defect or unintended broadening. A separate read-only
scanner probe accepts four valid cases and rejects sixteen invalid cases,
including zero-duration, signed/fractional/unknown values, wrong/undated sources,
errors and appended text. No assertion or diagnostic rule outside the approved
two families changes; these probes are not a completed full-host verification.

`out/t019-approved-host-full.log` passes 530 unit tests /47 files (240.41 s)
and 48 host tests but fails the genuine 1 GB first-DOM assertion:
2,177.673 ms exceeds the unchanged two-second target. No 5 GB/full memory
completion is claimed for that attempt. Preserve the failure; no averaging,
deadline increase, readiness-predicate change or unchanged-code retry is used.
Its host warnings match the now-approved policy; the measured test failure
still fails the gate.
For that failed attempt, source
`out/integration-profile-BItMH0/logs/20261014T013006/window1/renderer.log`
has approved severity `warning` records: line `1`, VSCODE-HOST-003,
`Creation of workbench contribution 'workbench.contrib.preferencesActions' took 29ms.`;
line `3`, VSCODE-HOST-002,
`Creation of workbench contribution 'workbench.contrib.chatLanguageModelsData' took 21ms.`;
line `12`, VSCODE-HOST-001,
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
Line `131` is severity `error`, `1 test failed.`; it remains a failure.
Investigation finds redundant native opening-document
assignments before the ready browser, including an intermediate mode-only
document replacement. The targeted provider regression fails first in
`out/t019-opening-frame-red.log` (one fail/15 pass), then all 16 provider
cases pass in `out/t019-opening-frame-green.log` after suppressing redundant
opening/native-mode replacements. Fallback pre-consent banners and terminal
error/cancellation states remain rendered; the same existing assertions pass.
The first-DOM target, worker/source logic, measurements and workloads remain
unchanged. Fresh full verification of this production repair is required.
Independent follow-up uses the actual provider/session with controlled engine
and VS Code surfaces: native two assignments opens the browser; fallback three
assignments show the banner before consent; decline shows a visible error;
cancellation shows its state without a late browser revival. No concrete
consent, per-view lifetime or state regression is found. Actual first-DOM
latency remains a separate real-host assertion, not inferred from these probes.
The first repaired full candidate (`out/t019-opening-repair-full.log`) stops
at lint: the new mock is an async arrow with no await. Return a genuine
resolved promise directly; do not add a fake await or suppress the rule.
No test assertion, production behavior or target changes for this correction.

The repaired candidate `out/t019-opening-repair-full-2.log` passes all 531
unit tests /47 files (209.46 s), strict types/lint/build/package, all 49
real-host tests (seven minutes), and strict runtime logs on Windows x64 /
VS Code 1.140.0 /Node 24.21.0. The unchanged large-file assertion now measures
1,339.026 /1,203.989 ms, both under two seconds. Both directional sorts,
descending broad filters and complete eleven-row filters pass, alongside
all original 60 Browse/20 SQL pages, full payload scans and full hashes.
Combined sampled host/helper peaks are 271,155,200 /287,035,392 bytes,
growth 15,880,192; paging growth 6,070,272 /15,925,248, all within unchanged
500 MB/50 MB bounds. Renderer peaks 418,734,080 /421,400,576 are separate.
There are 75/183 observations (74/182 with helpers), maximum gaps
587.410 /560.942 ms. Ten million rows and 1,285,033,984 /5,874,388,992 bytes
per file are genuine; both previously recorded complete SHA-256 values match.
Workload 279,424.918 ms meets the same 540/600 s budgets. This is observed
warm DOM readiness and sampled resident memory, not universal physical paint.

This full result is **not warning-free**. Exactly one accepted record:

- Source: `out/integration-profile-v0vZHu/logs/20261014T015515/window1/renderer.log`.
- Line: `10`; original severity: `warning`; rule: `VSCODE-HOST-001`.
- Message: `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.

No other warning/error occurs in that complete runtime-log scan. The old
failed attempts remain failures; this pass follows the tested production
repair and explicit policy approval. Current-code three-platform CI and
release/tag remain unobserved.

The updated preview preserves the owner-tested original archive as
`out/t019-preview/lite-voyager-t019-original-preview.vsix` (original hash above).
The refreshed `lite-voyager-t019-preview.vsix` is 641,687 bytes /20 entries,
SHA-256 `f66bdd8c215a5bd144a506f0f0a6c9fd65e105ce345df6530a9adee1b54694c1`.
Archive comparison finds only `extension/dist/extension.js` changed for the
native opening repair; browser CSS/JS, workers and WASM are byte-identical.
The owner's five physical passes cover that unchanged post-open UI; native
opening transitions have separate provider/real-host proof above. No owner
retest of the refreshed host bundle is claimed. CLI force-install succeeds,
again emitting the vendor's DEP0169 url.parse deprecation (recorded in
`out/t019-refreshed-preview-install.log`); installation is not warning-free.
The same installed-artifact suite passes four cases /17 s and strict logs
in `out/t019-refreshed-preview-host.log` on VS Code 1.141.0. Its single
approved record is source
`out/integration-profile-packaged-X0Scei/logs/20261014T021100/window1/renderer.log`,
line `11`, severity `warning`, VSCODE-HOST-001, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
This refreshed-preview host result is not warning-free.
All fourteen installed runtime assets match the final production build.
Final `npm run verify` (`out/t019-approved-final-verify.log`) passes all 531
tests /47 files in 237.04 s, strict host/webview/tooling types, lint, production
builds and a 20-file /626.65 KB package dry run with zero errors/warnings.
No source change follows these passing gates. Current-code CI/release remain
the outstanding T-019 phase steps; the checkbox is not ticked prematurely.

#### T-019 exact-candidate CI and milestone closure (2026-10-14)

The owner supplies [run 38516745918](https://github.com/JreyForFun/lite-voyager/actions/runs/38516745918)
as PASS. Public GitHub API metadata independently confirms attempt 1,
completed success at 2026-10-14 05:32:31 UTC, on main at exact local candidate
`6e381571f9306b01b9d3e229281c1b41f7bf60fe`.

- Ubuntu job 115697150635: locked installation and Linux session-bus/virtual-
  display full verification succeed.
- macOS job 115697150668: locked installation and Windows/macOS full
  verification succeed.
- Windows job 115697150733: locked installation and Windows/macOS full
  verification succeed.

Only each job's inapplicable alternative platform step is skipped. Remote
raw logs/test counts/approved-warning counts were not retrieved; do not call
these remote full runs warning-free. Existing local exact approved records,
all prior failures and scoped DOM/memory limits remain above. No production
source, tests, dependency or diagnostic policy changes after this candidate.

The local full gate, source safety, requirement coverage, recorded numeric
targets, independent review and owner-confirmed five physical preview checks
now satisfy the Milestone 1 acceptance gate. Closure documents are committed
and tagged locally v0.1.0 after clean `npm run verify`; owner pushes records
and tag. This is a milestone checkpoint, not a Marketplace/Open VSX release.
The installed owner preview remains version 0.0.1; publishing/versioning is
T-070. Only T-019 is closed. Start Milestone 2 in a fresh chat.

Closure-record `npm run verify` (`out/t019-ci-closure-verify.log`) exits 0:
531 tests /47 files (193.43 s), strict host/webview/tooling types, lint,
production builds and 20-file /626.85 KB package pass with zero errors/warnings.

Milestone 1 gate status (separate from foundation):

- [x] Current candidate `npm run verify:full` passes locally; approved record explicit.
- [x] Current candidate full CI succeeds on Windows/macOS/Ubuntu (run above).
- [x] Current-code source safety, memory and first-DOM measurements recorded.
- [x] Requirement scope and independent review reconciled; confirmed findings repaired.
- [x] Observable delegated host QA passes on both engines; host-log failure is separate.
- [x] Physical preview feedback is received; owner confirms all five checks.
- [x] Local preview, owner feedback and local milestone `v0.1.0` tag recorded.

## 5. Edge cases every format must be tested against

T-024 XLSX scoped acceptance/evidence: [XLSX import](../docs/t024-xlsx.md).
T-024 candidate run 39059472250 /2139f7c: Windows source-identity and macOS CSV growth
fail; Ubuntu succeeds. [CI repair/evidence](../docs/t024-ci-repair.md) preserves
both failures, red-first Windows reproduction, quoted/plain CSV fidelity,
allocation diagnostic limits and all original guards. Repaired run 39067782337
/attempt 1/exact 7e8eaef now passes all three platforms; T-024 closure is above.
No unchanged retry or diagnostic/memory-policy change is authorized.
Repaired local full passes 857 units /68 hosts; its single exact approved HOST-001
warning is recorded in that link. The full run is not warning-free. Populated CSV
combined peaks 312283136 /308166656 and paging growth 17317888 /32956416 bytes
pass unchanged guards, exact complete-data SQL, all 80 pages and source hashes.
Preserve all existing gates and diagnostic rules. Test both engines, cached/missing
formulas, exact raw numeric tokens, hidden/empty/header-only sheets, implicit and
sparse addresses, names, malformed ZIP/XML, memory-consent boundaries/cancellation,
fallback expansion refusal, source mutation, cleanup, paging and complete SQLite save.

T-023 scoped acceptance/evidence: [JSON / JSONL import](../docs/t023-json.md).
T-023 Windows CI repair and exact retained failures: [repair record](../docs/t023-windows-ci.md).
No existing diagnostic, memory, per-operation timing or source-safety gate is
relaxed. The aggregate CI job budget becomes 60 minutes for the added sequential
JSON workloads; all individual test deadlines and full-gate commands stay intact.

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
- T-024 completion (2026-10-18): Independently confirm actual repaired 7e8eaef /run 39067782337 /attempt 1 passes locked installs/full verification on all platforms. Close only T-024; preserve prior failures, exact local warning, scoped visuals and remote raw-log limits.
- T-024 CI repair (2026-10-18): Retain failed run 39059472250 /2139f7c and original assertions; link native-path fix, exact CSV coverage, allocation diagnostic limits and 857-unit/68-host local full pass with one exact HOST-001 warning. No retry exception, fixture or policy change; new-candidate CI required.
- T-024 (2026-10-17): Link scoped XLSX acceptance and delegated QA/evidence record; retain all historical failures, diagnostics and unchanged gate policies. Candidate full checks/CI remain separate evidence.
- T-023 completion (2026-10-17): Independently confirm run 39002490041 /attempt 1/exact db28c92 passes locked installs/applicable full verification on Windows/macOS/Ubuntu. Close only T-023; preserve earlier failures, unknown causes, local warning records and remote raw-log limits. No guard change or unchanged retry-to-green.
- T-023 Windows CI repair (2026-10-17): Record exact dfab68e/run 38857662893 Windows preview failure, conservative delimiter optimization, red-first regressions, 790-unit standalone, separate 995.4049-ms 5-GB preview diagnostic and unresolved local failures. Keep all original clocks/bounds/workloads/diagnostic rules and T-023 closure open; no unchanged retry-to-green.
- T-023 implementation (2026-10-16): Link scoped acceptance, 777-unit standalone and separate 65-host/stress pass with exact HOST-004/HOST-001 warnings. Preserve red-first repairs, failed canonical full runs including unexplained T-015 unit timeout, and component-rendering limitations in docs/t023-json.md. Completion gates remain open pending clean actual-candidate full CI.
- T-022 completion (2026-10-16): Independently confirm run 38795642328 /attempt 1/exact a1c1fce succeeds on all three platforms with locked installs and applicable full steps. Close only T-022 using existing local acceptance/QA/review; retain prior failures, exact diagnostics, remote raw-log limits and all remaining milestone work.
- T-022 implementation (2026-10-16): Record red-first storage/save/review/package repairs, delegated visual scope and independent 60-host pass. The owner's single unchanged full rerun passes 707 units/60 hosts with its exact HOST-001 record; final 707-unit standalone passes with zero errors/warnings. Preserve every guard, prior 706/707 failure, unexplained timeout, rejected debugging launch and actual-candidate three-platform CI gate.
- T-021 completion (2026-10-15): Independently confirm run 38718762528/attempt 1 at exact e97ea57 and all three successful locked installs/full steps. Close only T-021 with passing local acceptance, delegated QA and independent review; retain failed evidence, exact approved diagnostics and remote raw-log limits.
- T-021 native paging repair (2026-10-15): Record exact second-CI jobs/SHA and macOS failure, retained red allocation/iterator-total failures, independent reviews and separate source-skip/final 4-MiB gates. Final 668 units/65 files and 57 hosts pass with exact HOST-001 reporting and unchanged guards; no repaired macOS or warning-free full claim. Retain owner push/fresh CI.
- T-021 CI repair (2026-10-15): Record exact failed CI jobs/SHA, red-first phase regressions, real 80-page failures, residency diagnosis and independently reviewed worker allocation repair. Preserve every failed run and unchanged limit. Final 666-unit clean standalone and 57-host full pass; report the sole exact HOST-001 warning and retain actual-candidate three-platform CI as the open gate.
- T-021 reviewed local handoff (2026-10-15): Record independently cleared export-close repair, 663-unit/57-host full with exact sole HOST-001 record and populated CSV peaks 375.7/343.9 MB. After a help-text-only cleanup, fresh rebuilt visual/native-import inspection and final 663-test zero-diagnostic standalone pass; retain the third rejected debugging launch and all physical/CI limits. Only owner push/actual-candidate CI remain external.
- T-021 delegated QA/review (2026-10-15): Owner removes the visual-QA wait and retains push/CI. Record scoped actual VS Code visual passes, unavailable native helper, rejected debugging-flag instrumentation runs, exact HOST-001 runtime record, fresh independent export-close finding, two red-first notification repairs and cleared follow-up. Preserve the strict-type regression failure and all existing gates/limits.
- T-021 local implementation (2026-10-15): Record tests-first streaming import, exact staging/options/cancellation/source safety, preserved failing runs and scoped repairs. Final standalone passes 661 tests/63 files with zero diagnostics; full passes 57 host tests and populated 1/5-GB memory/data gates with both exact approved HOST-001/002 records. Keep owner QA, fresh review and new-code three-platform CI pending; no task closure or diagnostic relaxation.
- T-019 milestone closure (2026-10-14): Independently confirm run 38516745918 /attempt 1 at exact 6e38157 with all three locked installs/applicable full gates passing. Close the acceptance gate and local checkpoint; preserve every failed run, exact local warning and remote raw-log limitation. Owner pushes; no Marketplace release or Milestone 2 work.
- T-019 owner approvals (2026-10-14): Record all five physical preview checks PASS and explicit approval of only the preferencesActions/chatPetContext renderer timing families. Preserve every prior failure and diagnostic/performance rule. Red-first native-opening repair passes 531-unit/49-host full gate, refreshed installed preview passes four cases, and final verify passes 531 tests with zero errors/warnings. Exact approved host records remain explicit; current-code CI/release are still pending.
- T-019 QA/review candidate (2026-10-13): Record owner delegation/local-preview choice, cumulative fresh-context review, red-first repairs and failed full candidates. Preserve source/workload/diagnostic limits and distinguish observable DOM/theme/key evidence from physical preview feedback; current-code full gate/CI/release remain pending.
- T-016 repaired-candidate CI (2026-10-13): Independently confirm successful 38384170955 /attempt 1 at final repair 284fbee and all three applicable full gates/locked installs. Check only T-016 after clean 489-test completion verify; preserve prior failures, the exact approved local warning, remote raw-log limits and remaining milestone work.
- T-016 CI repair (2026-10-13): Independently confirm failed caf209b run 38378099885, retain OS/full-startup failures and red-first regressions. Separate final 489-test zero-diagnostic verify and 45-host/log gates pass with 270.7/276.1 MB peaks, 5.4 MB size growth and one exact approved renderer warning. Reopen T-016 pending fresh full CI; all acceptance limits remain unchanged.
- T-016 local completion (2026-10-13): Final repaired full gate passes 487 unit/45 host tests; record genuine 1.285 GB/5.874 GB source-safe memory evidence, 269.8 MB/285.0 MB sampled peaks and the exact approved renderer warning. Preserve failed candidates and owner push/CI/milestone work.
- T-016 implementation (2026-10-13): Record source-safety and sampled-memory coverage, owner-approved SHM clarification, red-first observer repairs, exact calibration diagnostics and disk-space block. Retain the large acceptance and final gates as pending.
- T-015 delegated closure/review (2026-10-13): Record independent cumulative review, confirmed post-closure save-error defect, red-first notification/cancellation repairs and independent follow-up. Keep actual-candidate CI explicitly at the milestone gate; scoped task closure awaits current local gates and commit.
- T-015 owner QA/CI audit (2026-10-13): Record QA 1–6 PASS; independently verify green 38352950470 on the old 6e25977 tree. Preserve missing actual-candidate CI and fresh-review requirements.
- T-015 (2026-10-13): Record delegated contract, red-first tests, scoped memory evidence, failed pre-render comparison and strengthened DOM wait. Retain native-dialog QA, fresh review and post-push CI.
- T-014 owner-directed closure (2026-10-13): Record the owner's confirmation that checks are complete and the next chat is T-015. Close the task with existing passing evidence, without inventing an independent review result or closing the milestone.
- T-014 green repair CI (2026-10-13): Independently confirm run 38346736300/attempt 1/780f974 success for locked installs and applicable full checks on all three platforms. Preserve failures, exact local warning records and remote-log limits; leave only independent review open.
- T-014 final CI measurement repair (2026-10-13): Replace rejected startup flags with keyed opt-in host pulses/native observations, preserve complete gap and failure metrics, and serialize unit files without changing test workloads/deadlines. Record final 447-test zero-warning verify and 36-host full pass with its exact approved renderer warning. Owner QA 1-6 passes; fresh CI/review remain open.
- T-014 owner QA/CI probe repair (2026-10-13): Record numbered QA 1-6 PASS and independently confirmed failed Windows/macOS / successful Ubuntu run 38341388121 at 21da760. Add red-first isolated-host background controls without changing workloads, thresholds or diagnostics; retain the unproven-cause limit and require fresh repair CI/review.
- T-014 implementation (2026-10-13): Record red-first production cancellation acknowledgement, bounded opt-in responsiveness probes, both-engine real-host measurements and the exact approved host warning. Keep owner QA, independent review and fresh CI open.
- T-018 closure (2026-10-13): Check the task after observed final 437-test zero-error/zero-warning verify and independent isolated review, owner QA and repaired three-platform CI. Update the handoff to T-014 in a new chat; preserve all earlier evidence and limits.
- T-018 independent review (2026-10-13): Honor the owner's preference to finish this task in the current chat. Record one fresh-context isolated review of cumulative implementation/CI repair with no concrete findings, preserving its sandbox execution limitation and separate gate evidence.
- T-018 green CI confirmation (2026-10-13): Verify 38293986528/attempt 1/0004369 and all three successful jobs, locked installs and applicable full checks. Record metadata-only remote evidence, preserve failed CI/exact local renderer warning history, and leave only independent review open for task closure.
- T-018 failed CI/viewport repair (2026-10-13): Record 38289818635/attempt 1/d29dfff Windows/macOS fidelity failures and Ubuntu success. Preserve both failing excerpts; add red-first actual-column/validation regressions and retain every fidelity value, fixture, deadline and source assertion. Repair CI/review remain open.
- T-018 handoff (2026-10-13): Provide a precise fresh-chat review prompt and push/CI return instructions; correct the stray QA-heading character under the owner's documentation-update request. Preserve all evidence and keep T-018 unchecked.
- T-018 final owner QA (2026-10-13): Accept the six numbered PASS reports, preserve prior partial/error observations and automated cancellation evidence, and keep only independent review/post-push CI open. T-018 remains unchecked.
- T-018 owner QA clarification (2026-10-13): Record explicit PASS reports and matching selection TSV; distinguish unobserved typing/cancellation and incomplete SQL retries. Rewrite navigation and complete single-statement examples without claiming missing observations or changing feature code.
- v0.1 T-018 implementation (2026-10-12): Record tests-first cell details/TSV, worker/clipboard/lifecycle and bounded protocol coverage; preserve lint and two failed host runs. Scoped stale-report/cancellation repairs pass 431 unit/32 host checks with zero errors/warnings. Owner QA, fresh-chat review and post-push CI remain open.
- v0.1 T-017 final repair CI confirmation (2026-10-12): Confirm successful 38248216036/attempt 1/9f73531 run, locked installs and full steps on all three platforms. Close only scoped T-017, preserve failed evidence and remote-log limits, and hand off T-018 to a fresh chat.
- v0.1 T-017 Windows fixture repair (2026-10-12): Record failing follow-up CI at 4a8be0e, red-first real-SQLite transaction/rollback and in-flight teardown regressions. Batch identical stress data in one durable transaction and await worker completion during test cleanup without changing deadlines or assertions.
- v0.1 T-017 validation repair (2026-10-12): Add a red-first packaged fallback-startup regression and register the existing message handler before WASM initialization. Preserve failed startup/timeout evidence, independent review, 398-unit/30-host full results and the exact approved renderer diagnostic; follow-up CI awaits owner push.
- v0.1 T-017 CI confirmation (2026-10-12): Verify owner-supplied successful 38239600604/attempt 1/dbf76f8 run/job/step metadata on Windows/macOS/Ubuntu. Record confirmed locked installs/full steps, preserve failed evidence and remote-log limits, and keep only scoped T-017 complete.
- v0.1 T-017 independent review/local completion (2026-10-12): Owner delegates completion judgment. Record two reproduced MEDIUM findings, failing-first repairs and independent confirmation. Final verify/full pass 397 unit/30 host tests under the exact reported host-warning policy; standalone verify has zero errors/warnings. Close scoped T-017 in its local task commit; preserve prior evidence and keep post-push CI/milestone gates open.
- v0.1 T-017 owner QA report (2026-10-12): Record six explicit numbered PASS results against the supplied checklist and passing 394-test standalone verification with zero errors/warnings. Update progress/task status without closing T-017; preserve prior failures, exact automated diagnostics and remaining fresh CI/independent review requirements.
- v0.1 T-017 implementation (2026-10-12): Record tests-first sort/filter acceptance, scoped fixture/native-storage/persistence/restoration repairs and failed host/full runs. Repaired full gate passes 394 unit/30 host tests with the exact approved renderer warning reported; standalone verify passes with zero errors/warnings. Owner/CI/review closure remains pending.
- v0.1 T-013 repaired CI confirmation (2026-10-12): Independently verify successful 38206014267/attempt 1/88e8a51 run/job/step metadata on Windows/macOS/Ubuntu and close scoped T-013 again. Preserve failed CI, exact local diagnostics, remote-log limits and remaining milestone/manual QA.
- v0.1 T-013 failed CI/repair (2026-10-12): Verify failed 38204288838/attempt 1/92c12e9 metadata and preserve supplied Windows/macOS failures plus Ubuntu's successful job. Reopen T-013; record red-first fixture atomicity and context/action correlation with unchanged deadlines/workloads and fresh CI required.
- v0.1 T-013 owner QA report (2026-10-12): Record the owner's nine explicit SQL/Browse table PASS results; distinguish supplied observations from unreported theme/shortcut/restoration/fallback checks and pending remote CI. Preserve existing local verification and diagnostic evidence.
- v0.1 T-013 SQL editor (2026-10-10): Record requirement-to-test coverage, preserved red-first/verification failures, stricter host-action synchronization, both-engine SQL UI evidence, exact accepted host diagnostics and remaining owner/milestone checks.
- v0.1 T-012 CI/owner QA confirmation (2026-10-10): Independently verify public run/job/step metadata for 38039805436/attempt 1/a720520 on Windows/macOS/Ubuntu and record owner-reported GOOD after requested browser checks. Preserve exact local diagnostics, remote-log/manual-observation limits and whole-milestone requirements.
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
- T-020 preview (2026-10-14): Record exact coverage, red-first repairs, two failed host initialization records and final 572-unit/52-host full with explicit HOST-001 warning. Preserve original budgets, all four narrow diagnostic families and no-retry-to-green; owner preview/review and new-code CI remain separate.
- T-020 owner QA (2026-10-14): Record installed/enabled verified runtime and the owner's explicit visual checks 1-5 PASS. Preserve automated evidence, cold-paint/remote limits and pending fresh review; no code or fixture changes.
- T-020 first CI failure (2026-10-14): Confirm 38539935087/attempt 1/256ebb2 fails Ubuntu on 30 Chromium GPU mailbox errors despite passing tests; Windows/macOS succeed. Preserve the failure and diagnostic policy; investigate without claiming a repair or three-platform pass.
- T-020 WSL diagnostics (2026-10-14): Preserve mounted/native probe failures and the later instrumented six-case pass with exact HOST-001 records. No GPU failure reproduction or source repair; retain unknown timeout cause and fresh-context investigation/review.
- T-020 independent repairs (2026-10-14): Owner authorizes fresh-context review in this chat. Record three confirmed red-first reader/controller fixes, independent follow-up and 48 focused passing cases. Preserve broad/Mesa/stage-trace failures and exact diagnostics; no GPU repair or weakened gate is claimed.
- T-020 repaired gates (2026-10-14): Record red-first genuine sparse fixtures and independently cleared repairs, final 587-unit/52-host Windows full with explicit HOST-001, and retained native Linux setup/read-only/SIGBUS and rejected X11/Mesa failures. Prepare independently reviewed owner-run compaction without executing it or claiming a GPU repair or three-platform pass.
- T-020 host recovery (2026-10-14): Preserve successful owner disk compaction, 186-file source parity and the failed resumed Linux full with unknown native WAL assertion and host-space exhaustion. Record guarded generated-tool/fixture cleanup and independently reviewed second compaction; continue with hosted actual-candidate CI, not further large local retries.
- T-020 canonical race fixture (2026-10-14): Record 38572461954/ceb05b2 hosted Ubuntu full success, Windows ECONNRESET install failure and macOS alias-injector failure. Preserve exact local red regression, canonical test-only repair and independent review; 37 reader/3 targeted POSIX cases and 588-test zero-diagnostic standalone pass, with fresh current-candidate full CI still required.
- T-020 vendor startup gate (2026-10-14): Record 38585494750/5dd4770 Windows/Ubuntu full passes and macOS 588-unit/52-host passes followed by strict remoteStatusIndicator warning failure. Report both approved records and the exact unapproved record; preserve official-source evidence and an unapplied fifth-family proposal pending explicit owner approval. No checker, test, launch flag or active policy change.
- T-020 HOST-005 decision (2026-10-14): Owner delegates judgement on the exact reviewed proposal; adopt only remoteStatusIndicator's unsigned timing family with unchanged guards/reporting. Preserve red-first acceptance failures and 48 passing policy cases; independent implementation review and 601-test zero-diagnostic standalone pass. Original CI remains failed; fresh candidate three-platform full is pending.
- T-020 completion (2026-10-14): Independently confirm 38592857439/attempt 1 at exact 6f19368 succeeds for all three locked installs/applicable full checks. Close only T-020 after local 601-test clean standalone, scoped independent reviews and owner QA 1-5 PASS; preserve every failure and explicit diagnostic/raw-log limit. Hand off T-021 planning to the next chat; owner pushes documents.
