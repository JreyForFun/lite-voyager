# T-030: staged SQLite editing

Owner authorization: 2026-10-27 (Asia/Manila), implement T-030 completely,
resolve uncertainties, repair scoped defects/fixtures and perform visual QA.
The owner retains push and actual-candidate CI.

Current follow-up (2026-10-30): actual-candidate run40568873744 fails Windows
and macOS at1257ca5; Ubuntu passes. Earlier local results below remain historical.
See [CI repair/investigation](t030-ci-repair.md) for the test-first Windows path
repair and the still-unresolved macOS266.675ms timer gap. Keep T-030 unchecked.

## Acceptance and decisions

- FR-016: opening is read-only, including in the fallback. Write mode is an
  explicit document-scoped switch, shared by views. Switching off preserves
  pending work but prevents further edits; Save/Revert remain available.
- FR-020: selected Browse cells have an inline editor with explicit TEXT,
  INTEGER, REAL and NULL choices. Empty text and literal NULL remain distinct.
  INTEGER accepts only the signed 64-bit range, transported as decimal text
  and bound through CAST; REAL must be finite. No BLOB or generated-column
  editing. Views and ambiguous/unaddressable rows explain their refusal.
- Address by all primary-key components, otherwise an unshadowed rowid alias.
  Nullable/duplicate primary keys require exactly one match. Original keys
  remain the identity while key edits are staged. No offset is used for UPDATE.
- Given staged edits, Browse overlays their values and identifies pending work
  without changing source bytes. Sorting/filtering/counts and SQL still use
  saved data until Save; explain this in the editing toolbar.
- SQL Run remains read-only. An explicit Stage SQL action in write mode queues
  one UPDATE, INSERT or DELETE (including RETURNING, whose rows are discarded).
  Stage SQL uses the whole editor. Unbound parameters are refused because this
  action has no parameter-entry UI; quoted placeholder text remains literal.
  SQL is executed only on Save. No transaction control, DDL, ATTACH, VACUUM,
  PRAGMA or extension loading. No SQL-result grid editing or row add/delete UI
  (T-031). Failed SQL keeps the entire queue dirty and rolls back every write.
- Explicit Save executes the queue in order in a single transaction. Native
  writes use SQLite locking, foreign keys and trusted_schema=OFF. Source identity
  and version are checked before writes; detected external changes refuse Save
  and preserve pending work. Fallback uses its documented memory limitation,
  a complete transaction in memory and fsynced temporary output plus atomic
  replacement; sidecars and multiply linked files are refused. Its final
  version check cannot lock out a separate writer between check and rename.
- Native Save uses an exclusive transaction and a reader/writer handoff. Its
  confirmed rollback captures the restored version while the lock remains held
  and returns that token to the host queue, including backups. Automatic SQLite
  rollback is confirmed through the native transaction state. Owned secondary
  readers pause during Save and resume afterward; the saving engine stays pinned
  across active-view changes. External WAL readers can prevent exclusive lock
  acquisition; that failure preserves the queue and requires closing those readers.
- Native Save As uses SQLite backup in a fresh worker, retaining hidden rowids
  and committed WAL data. The helper owns all worker lifetimes; the host owns
  temporary save directories and removes them only after confirmed helper exit
  on cancellation. Existing source and sidecar aliases are protected.
- Undo/redo operate on staged operations; Revert discards all pending work.
  Dirty state uses VS Code's custom document API, with close confirmation and
  persisted backup/recovery. No automatic save may write a source: when VS Code
  auto-save is enabled, use the explicit Save changes button; automatic provider
  saves refuse with actionable guidance. Save As is an explicit atomic copy.
- Enabling write mode requires files.autoSave off because VS Code skips normal
  custom-document backups with auto-save enabled. If the setting changes while
  dirty, automatic saves still refuse; explicit Save changes remains available.
- Cancellation preserves the host queue and interrupts the complete helper.
  Save and Save As subscribe to VS Code cancellation, expose busy state and
  await helper recovery before reporting final state. Invalid/oversized UI
  requests are explained locally before changing busy state or sending IPC.
  SQLite commits atomically; a late Cancel cannot undo a committed save. An
  interrupted save can have an unknown all-or-nothing outcome, so inspect the
  saved source before retrying. Its old version token refuses duplicate replay
  after an observed commit/source change. Source files are never partially saved.
- If a supervised native in-place Save is interrupted after disk spill, helper
  shutdown waits for a fresh worker to let SQLite recover its own journal, after
  checking the canonical source path and original device/inode. Ordinary opens
  remain read-only. Recovery never deletes journals manually or replays the queue.
  It does not rebase the queue token; the unknown outcome still requires inspection.
  Closing a helper and crash recovery use the same guarded shutdown. New readers
  wait for recovery, and disposal invalidates any Open already waiting for it.
- Queue/transport bounds are explicit, reject before mutation and never truncate.
  File size is not capped on the primary engine. Worker failure/cancellation
  preserves the host queue; recovery cannot silently replace its source version.
- Tests first, covering both backends, exact int64, awkward identifiers,
  NULL/empty/literal NULL, composite/WITHOUT ROWID keys, nullable keys, rowid
  shadowing, schema restrictions, rollback, source changes, lifecycle and UI.
  Required gates: npm run verify and npm run verify:full, with unchanged strict
  diagnostics. Retain every failed run; no retry-to-green.

## Evidence

The final recovery candidate passes both required local gates. T-030 remains
unchecked pending actual-candidate owner-pushed CI. Scoped visual QA and
independent review pass as recorded below. The final local handoff record at
the end of this document supersedes earlier pending-gate status. No later task
is implemented.

Test-first records under ignored out/: initial missing-module red, protocol/UI
red, provider forwarding red, protected-sidecar red, malformed recovery/WAL red,
auto-save/cancel red, atomic-backup cancellation red and staged-page/scalar red.
The first sandbox Vitest launch fails with spawn EPERM; approved unsandboxed
execution reaches the expected missing-module failure. Every failure is retained.

Latest focused suite: 105 tests / eight files pass (out/t030-focused-4.log).
Types pass (out/t030-types-7.log). Native/fallback coverage includes unchanged
sources before Save, rollback, exact int64, rowid/composite identities, source
changes, NULL/empty text, >1-MB values and bounded pages, recovery and cleanup.

The first real-host run fails both tests: the registered TabularEditorProvider
was still read-only and did not forward dirty/persistence events. A failing
router unit regression precedes its repair. The repaired second real-host run
passes both engines, actual dirty tabs, Undo/Redo, Revert and explicit Save.
It is NOT warning-free. Exact approved diagnostic, severity warning:
20261027T152702/window1/renderer.log:9, VSCODE-HOST-001,
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
Evidence: out/t030-host-1.log and out/t030-host-2.log.

Native Save As using async backup in the browser worker times out at the
unchanged 5,000-ms test deadline. Retain out/t030-core-backup-3.log,
-limits-green.log, -copy-trace-suite.log and -copy-active-probe.log. A minimal
fresh worker completes, including the encoding PRAGMA. This does not establish
the underlying cause. A dedicated fresh backup worker passes the unchanged
rowid-gap cases and the full focused suite. An early multiword -t invocation
skips every case; out/t030-copy-trace.log is not a successful test execution.
Temporary product trace output is removed. No deadline or assertion is relaxed.

The third focused host run adds Save As and fails both backends on a Windows
drive-letter case mismatch in the owned-directory guard. Its cleanup also emits
`The database was closed` stack diagnostics; retain the failure and do not claim
an established general cleanup cause. Normalizing Windows paths before comparing
owned parents repairs the demonstrated guard failure. The fourth focused host
run passes both complete workflows, including Save As, under VS Code 1.140.0's
bundled Node24.21.0. It is NOT warning-free. Exact approved diagnostic, severity
warning: 20261027T160908/window1/renderer.log:2, VSCODE-HOST-004,
`Creation of workbench contribution 'workbench.contrib.chatPetContext' took 22ms.`
Evidence: out/t030-host-3.log and out/t030-host-4.log. Full gates remain pending.

The first literal standalone gate passes 1,109 units /112 files, strict types,
lint, build and 34-file/1009.62-KB VSIX dry run, zero verification errors/warnings.
Started2026-10-27T08:13:16.205Z, finished08:26:24.261Z,788.056s, exit0;
all366 before/after hashes match. Evidence: out/t030-verify-1*. This is retained
as evidence for that source revision, not the later repairs below.

Post-gate package review discovers the explicit VSIX whitelist omits the new
snapshot worker. A real vsce-ls regression fails before adding that one asset.
Installed sql.js source (dist/sql-wasm-debug.js bindString, lines684-697) binds
TEXT with length-1; embedded NUL would truncate a key or edited value. Native
tests pass while fallback UTF-8/UTF-16 key tests fail before repair. Bind NUL
TEXT through a parameterized JSON string and SQLite json_extract(), using the
already-required JSON support to retain TEXT and the database's encoding.
Both complete-value and byte-level assertions now pass, including leading BOM,
embedded NUL, Unicode/quoted identifiers and original UTF-16 encoding.
Direct staged SQL also refuses unbound placeholders before either backend can
treat them differently; the validator regression fails before that guard.
Evidence: out/t030-package-nul-red.log, -utf16-red.log, -package-nul-green.log,
-unbound-red.log and -final-focused.log. Required gates must run on these repairs.

Second standalone:1,114 units/112 files,35-file/1010.36-KB VSIX, zero verification
errors/warnings,782.335s, all366 hashes match; start08:43:16.358Z,
finish08:56:18.693Z on2026-10-27. Evidence: out/t030-verify-2*.
An isolated test then demonstrates missing Save As busy/token cancellation.
Its permanent regression fails before a shared Save/Save As lifecycle subscribes
to cancellation, interrupts the owning helper and awaits recovery. Another
failing UI test covers oversized values/empty SQL silently rejected by host
validation; local protocol validation now refuses them without locking controls.
Final focused45 cases/five files and strict types pass. Latest complete real-
host workflows pass both engines after those changes (out/t030-host-5.log).
That host run is NOT warning-free: severity warning, VSCODE-HOST-001,
20261027T170255/window1/renderer.log:9, exact message
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
Evidence: out/t030-saveas-cancel-red.log, -saveas-cancel-unit-red.log,
-ui-limit-red.log, -final-focused-2.log and -types-10.log. Final gates pending.

Third standalone fails at lint before units: one require-await error in the
new cancellation mock (zero warnings),97.638s,366 unchanged hashes. Replace the
unnecessary async keyword with an explicit resolved Promise; no test assertion
or workload changes. Retain out/t030-verify-3*. Fourth standalone is required.

Fourth standalone passes1,116 units/112 files, zero verification errors/warnings;
start2026-10-27T09:08:53.230Z, finish09:20:05.562Z,672.332s, exit0,
all366 hashes unchanged (out/t030-verify-4*). Later review repairs follow below;
this gate is historical evidence, not a final-source gate.

The owner explicitly authorizes one fresh-context independent reviewer. It
inspects the actual 33-path diff/new files without editing product files or
running builds. It establishes a directory-junction Save As bypass that creates
an actual source-wal file containing database bytes, while source-main bytes
remain unchanged. Committed-WAL loss is not established. Both-engine alias
regressions fail before canonicalizing the destination parent; all protected
suffixes now refuse and ordinary aliased copies pass. The reviewer also confirms
the browser-in-flight editing-control gap; a failing UI regression precedes
the guard, preventing old-page mutations while a browser request is pending.

The reviewer reproduces native rollback after cache spill restoring the exact
original SHA-256 but falsely reporting an external change on a corrected retry.
Retain out/t030-review/rollback-repro.cjs and alias-repro.cjs. Protected native
handoffs now return a rollback token without adopting post-unlock disk state.
Tests cover DELETE/WAL, explicit/automatic rollback, exact byte restoration,
backup plus helper restart, corrected retry and later real external writes.
The first buffer-equality red run was stopped after guarded identification of
its exact test process; the equivalent SHA-256 assertion avoids an expensive
multi-megabyte buffer comparison. No byte-fidelity assertion was removed.

Follow-up review identifies toolbar cancellation during reader suspension,
automatic OR ROLLBACK and both suspension/cancel call orders. Each has a retained
failing regression before repair. Save cancellation now covers the whole pause/
write/resume lifecycle, mutations remain blocked while saving, and the owning
engine cannot switch with panel focus. Reader suspension retains resumable state
until release and cooperates with cancellation. Dispose still invalidates it.
Latest focused52 tests/four files pass (out/t030-review-fixes-green-5.log).
Red evidence: -browser-busy-red.log, -alias-red.log, -rollback-red-2.log,
-pause-cancel-red.log, -auto-rollback-red.log, -suspend-race-red.log and
-suspend-order-red.log, all with the t030 prefix. Original failures remain.
The reviewer's last follow-up initially hit its usage limit. After reset, the
same authorized reviewer inspects the final repair and reports no remaining
concrete findings, without running builds or tests. Fifty-two focused tests pass.
The fifth literal standalone passes1,128 tests/112 files, strict types/lint,
build and35-file/1011.47-KB VSIX, zero verification errors/warnings. It starts
2026-10-27T13:43:18.083Z, finishes13:54:22.566Z,664.483s, exit0; all366 hashes
match (out/t030-verify-5*). Only evidence records change before the first full
attempt; the later recovery repair below requires new gates.
The final full gate and its exact runtime diagnostics remain pending.

The first literal full attempt is intentionally stopped after985.285s to cover
the newly reviewed cancellation-after-spill gap. It exits1 (not a passing full),
with366 unchanged hashes. All1,128 units, package/compilation and both T-030 real
minimum-host workflows pass before interruption. The1.285-GB SQLite workload
passes; the5.874-GB workload has only begun and is not claimed as passed. Started
2026-10-27T14:02:37.131Z, stopped14:19:02.416Z. A separate strict log scan passes
with exactly one approved warning: VSCODE-HOST-001, severity warning,
20261027T221333/window1/renderer.log:10,
`[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
It is NOT warning-free. Evidence: out/t030-full-1*, including -log-scan.log.
Only the exact isolated host PID/executable/profile is terminated; no test,
assertion, workload, deadline or diagnostic policy is removed or relaxed.

The new real-worker spill regression proves a nonzero journal header and changed
main-file SHA before Cancel, then reproduces failed read-only reopen. After
worker-only SQLite journal recovery, Cancel and Close both restore the exact
original bytes, preserve the queue and permit reads; stale-token replay refuses.
Wrong-inode recovery leaves replacement and journal bytes untouched. Recovery
captures the canonical source before Save, including filename aliases; Windows
tests use directory junctions, while POSIX also uses a different-name file symlink.
Windows file-symlink creation fails EPERM with/without sandbox in the retained
out/t030-file-alias-probe.mts; no whole test or assertion is skipped to hide it.

Mock transport regressions independently establish reader Open/Cancel racing
crash recovery and a stale Open reopening after Close. Both fail before retaining
the shared shutdown through recovery and guarding lifecycle changes across waits.
Final independent follow-up finds no remaining concrete defect. Focused114 cases
pass before the final disposal variant; all6 helper cases then pass. Types13 fails
one exact-optional-property assignment; deleting the optional recovery flag fixes
it without changing strict settings. Final115 focused cases/six files and strict
types14 pass. Required final standalone/full gates remain pending.
Retain out/t030-hot-journal-red.log, -hot-journal-green-1.log,
-recovery-order-red.log, -recovery-dispose-red.log, -recovery-dispose-green.log,
-recovery-focused-2.log, -types-13.log and -review-lint-3.log (all t030 prefixes).
The second full must use the repaired candidate, not an unchanged retry-to-green.

## Task-owned files

Shared-spec ownership is per hunk. Pre-existing README/TASKS changes, owner
PLAN/VALIDATION hunks, debug.log, gingTryWan and unrelated fixtures are preserved.
No dependency, package version, CI policy or historical diagnostic is changed.

- .vscodeignore
- PROGRESS.md
- esbuild.js
- docs/t030-staged-edits.md
- specs/SPEC.md
- specs/PLAN.md
- specs/VALIDATION.md
- src/editor/sqlite-browser.ts
- src/editor/sqlite-editor-ui.ts
- src/editor/sqlite-editor.ts
- src/editor/sqlite-session.ts
- src/editor/tabular-editor.ts
- src/engine/engine-client.ts
- src/engine/engine.ts
- src/engine/node-sqlite.ts
- src/engine/sqljs.ts
- src/protocol.ts
- src/staging/edit-types.ts
- src/staging/sqlite-edits.ts
- src/staging/staged-edits.ts
- src/test/staged-edits.test.ts
- src/worker/db-worker.ts
- src/worker/sqlite-edit-copy-worker.ts
- test/unit/browser-package.test.ts
- test/unit/tabular-editor.test.ts
- test/unit/staged-edits.test.ts
- test/unit/staging-safety.test.ts
- test/unit/editing-ui.test.ts
- test/unit/editing-provider.test.ts
- test/unit/storage-helper-registration.test.ts
- webview/browser-grid.ts
- webview/editing-view.ts
- webview/sqlite-browser.ts
- webview/sqlite-browser.css

Generated gate logs, hashes, diagnostics, fixtures and QA profiles stay under
ignored out/. Disposable unit/host fixture directories are removed by their tests.

Visual QA (2026-10-27): task-only hidden and visible profiles are generated.
The visible window is `[Extension Development Host] t030-visual.sqlite - Visual
Studio Code`, returned id68310. Both Computer Use interfaces reject binding it:
`window id 68310 no longer belongs to Microsoft.VisualStudioCode; current owner
is Microsoft.VisualStudioCode`. A refreshed identity-only retry fails the same
way. No UI input is sent to either the owner or task window; no new screenshot,
interactive visual pass or physical-paint claim is made. The ad-hoc launch also
emits unapproved DEP0169 url.parse() diagnostics; this is not a clean log gate.
Both task-owned process trees are closed only after verifying exact executable,
PID and isolated profile. Logs/profiles/fixtures are retained under out/.
Real-host DOM assertions are independent evidence, not a substitute claim of
visual observation. Existing host exceptions and no-retry-to-green rules remain.

Later supplemental visual QA succeeds using the already-installed VS Code
1.143.1 (bundled Node24.21.0), a new isolated profile and disposable database.
Returned window460888 has the exact title `[Extension Development Host]
t030-installed-visual.sqlite - Visual Studio Code`. The earlier minimum-host
window-binding failures remain; this does not establish their cause. Direct
screenshots show readable light/dark layouts, write-mode state, selected-cell
editor, exact int64 values, distinct NULL/empty text and BLOB placeholders,
staged-cell marker and actual dirty tab. A Unicode TEXT value is typed/staged;
a direct read still returns the original multiline text before explicit Save.
After clicking Save changes, screenshots show saved status, cleared dirty dot
and disabled Save/Revert; a direct read returns the complete new Unicode value.
Proofs/hashes: out/t030-visual-proof-staged.json and -saved.json. This is a scoped
physical paint/interaction pass on1.143.1, not whole-milestone QA or minimum-
version visual proof. Accessibility click coordinates fail after scrolling;
fresh screenshot coordinates complete those actions without guessing indexes.

This ad-hoc visual host is NOT a clean diagnostic gate. Preserve both installed
QA profiles/logs, including main `Error: Error mutex already exists`, DEP0169,
the signed-out fixture's intentional non-integration-host refusal, default-
account/provider timeout errors and warnings, cloud-dictation session warning,
and the product.json agentsWindowActivation proposal warning. None is added to
the approved exceptions. The visible records are under
out/integration-profile-t030-installed-visual-YaBzzr/logs/20261027T215616/ and
out/t030-installed-visible-host.log; hidden records use -installed-visual-host.
Both process trees are closed after exact executable/PID/profile validation.
The required minimum-version full gate remains separate and unchanged.

## Final local handoff (2026-10-27)

The final recovery/lifecycle candidate passes the literal required commands:

- `npm run verify`: exit0, 1134 unit tests /112 files, strict types/lint,
  build and 35-file VSIX package checks; zero verification errors/warnings.
  Duration702.649 seconds, 2026-10-27T14:39:31.744Z through14:51:14.393Z.
  Evidence: out/t030-verify-6.log and -status.json.
- `npm run verify:full`: exit0, the same1134 unit tests /112 files plus79
  integration tests on minimum VS Code1.140.0 / bundled Node24.21.0, with strict
  runtime-log scanning. Both T-030 native/fallback host workflows pass after
  the final recovery repairs. Duration2828.843 seconds, from14:52:02.747Z
  through15:39:11.590Z. Evidence: out/t030-full-2.log and -status.json.
- Both gates preserve all366 recorded file hashes, and standalone-after equals
  full-before for every file. Evidence: their -before.json/-after.json and
  out/t030-final-gate-links.json. Only this document and PROGRESS.md are updated
  afterward to record results; runtime, tests, specs and gate policy stay frozen.

The full run is NOT warning-free. Its sole approved diagnostic is:

`{"source":"20261027T230326/window1/renderer.log","line":10,"severity":"warning","rule":"VSCODE-HOST-001","message":"[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]"}`

The source is under out/integration-profile-mIT6rq/logs/. Every other warning
and every error remains a failure; no diagnostic rule or deadline was relaxed.
The deliberately stopped first full and all earlier failures remain retained.
The second full uses the repaired recovery candidate, not an unchanged retry.

The unchanged regression workloads also pass: ten-million-row SQLite/JSON/JSONL,
populated1/5-GB SQLite, CSV, JSON and JSONL, exact source hashes, paging and
responsiveness. SQLite host/helper peaks are282599424/295182336 bytes and
paging growth6717440/16969728 bytes. CSV peaks are304922624/248918016 bytes,
with paging growth0/32989184 bytes across60 Browse plus20 SQL pages per size.
JSON peaks are299446272/297910272 bytes; JSONL peaks303587328/289193984 bytes.
All original memory/growth/timer budgets remain unchanged. These sampled host/
helper figures exclude renderer residency, which the logs report separately;
they do not claim physical paint or unsampled peaks.

FR-016/FR-020 local acceptance is covered: explicit write mode/read-only default,
typed cell editing and exact values, PK/rowid identity, staged-only source safety,
dirty state, Undo/Redo/Revert, atomic Save/Save As, rollback/recovery, cancellation,
backup and documented refusal cases. Scoped physical light/dark QA and final
independent review are recorded above. The fallback check-to-rename race and
unknown interrupted-save outcome remain explicit limits, not stronger guarantees.

Owner next step: push the committed candidate and run the existing CI
workflow, then retain its run URL, exact SHA and Windows/macOS/Ubuntu results.
Cross-platform actual-candidate CI is not established by this Windows session.
Keep T-030 unchecked until that evidence passes; no later-task or milestone-
release checkbox may be inferred. No push, tag, release, dependency,
manifest-version or CI-policy change is made in this session. All34 task-owned
paths are listed above; owner-owned README/TASKS/shared-spec hunks and unrelated
untracked files remain preserved. PROGRESS.md is the next-session summary.

Commit handoff (2026-10-28): owner explicitly authorizes committing T-030 and
retains the push. The commit includes only the34 task-owned paths listed above;
PLAN/VALIDATION staging includes only T-030 hunks. Earlier owner README/TASKS
and shared-spec edits, debug.log, gingTryWan and unrelated fixtures remain in
the working tree. Runtime/tests remain identical to the passing gates; only
these two handoff records change after the final records proof. The existing
verification evidence is retained without an unchanged retry. Actual-candidate
three-platform CI remains pending and T-030 stays unchecked.
