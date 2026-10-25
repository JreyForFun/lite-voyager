# T-028: Milestone 2 checkpoint and next-chat handoff

Owner authorization: 2026-10-26 (Asia/Manila), finish all needed local closure
and next-chat preparation in this chat. Owner retains push/CI. Only T-028 is
active; T-027 is already complete. No later feature or public publishing work.

## Acceptance and version decision

T-027 reconciles the Milestone 2 requirements, all eight delegated QA checks,
both-engine scoped light/dark DOM/visual observations, cumulative independent
review and test-first repairs. Its candidate
`8cd598317a56c96e3038d7ae7fb598d9e4462411` passes locked installs and applicable
full verification on Windows/macOS/Ubuntu in
[run40211134222](https://github.com/JreyForFun/lite-voyager/actions/runs/40211134222),
attempt1. Detailed acceptance and retained failures:
[QA](t027-milestone2-qa.md), [CI confirmation](t027-ci-startup-warning-proposal.md).

This task prepares annotated local source checkpoint `v0.2.0`, matching the
earlier `v0.1.0` convention. `package.json` and the VSIX manifest stay `0.0.1`.
Marketplace/Open VSX versioning/publishing remain T-070. Do not describe this
archive as a published 0.2.0 extension or silently bump its version.

No runtime, dependency, launch option, test workload or diagnostic policy change
is planned. Confirm source/config parity with the passing full candidate; do not
rerun an unchanged full gate to seek a different outcome. Standalone verification,
isolated committed-tree packaging, archive inspection, local commits/tag and
owner handoff are required. Never stage unrelated owner document hunks/fixtures.

## Evidence retained

Latest executable standalone:1074 units/108 files, zero errors/warnings. Local
CI-enabled full:1074 units plus77 hosts,2898.017s,314matching hashes, all original
populated data/source/paging/timing/memory checks. It is not warning-free:

- HOST-005, severity warning, `20261025T233217/window1/renderer.log:1`:
  `Creation of workbench contribution 'workbench.contrib.remoteStatusIndicator' took 49ms.`
- HOST-001, severity warning, same source line11:
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.

Remote raw warning records were not retrieved. Keep every failed local/CI run,
unknown historical GPU/timing/WidgetHost cause, source-revision limit and physical
paint/unsampled-peak limitation. This checkpoint does not prove those causes.

## Artifact and verification status

Required standalone `npm run verify` passes:1074 units/108 files, strict types,
lint, production build and 34-file/997.67-KB dry-run VSIX, zero errors/warnings.
Started2026-10-25T17:29:21.036Z, finished17:37:27.115Z,486.079s, exit0;
all315 before/after hashes match. Evidence:out/t028-checkpoint-verify-1.log,
-before.json and-status.json. This dry run uses the workspace README; the
shareable archive below will use only committed task-owned content.
Independent preparation review finds no concrete scope/provenance defect.
Only records change after this gate; runtime/config parity remains unchanged.

Preparation in progress. A shareable archive must be generated from an isolated
copy of the task-only committed tree, with the installed locked dependencies,
normal prepublish build and strict package-size/diagnostic checks. This prevents
the owner's unstaged README edits from entering a supposedly tagged artifact.
Inspect all archive entries, manifest/version, worker/WASM/license files and
bundle hashes. Record build commit, final checkpoint, bytes and SHA-256 here.
No archive, local tag, installation, external push or feedback is claimed yet.

## Owner handoff

After local preparation finishes, push only the intended checkpoint and branch;
review the preserved unrelated work before committing it. A normal owner push
will trigger the existing CI. Never include all dirty files using `git add .`.

The installed extension ID is `jreyinnovarev.lite-voyager`, manifest version
`0.0.1`. Use VS Code's Extensions menu, **Install from VSIX**, and select the
checkpoint archive described above. This installs development code and may
replace an existing 0.0.1 preview. Review the confirmation rather than assuming
a same-version archive was loaded. Use disposable source copies for feedback.

Feedback checklist:

1. Open CSV/TSV with quoted multiline text, NULL/empty values and large integers;
   check exact previews, import progress/cancel and paged results.
2. Import JSON/JSONL with nested values; run SQL with `json_extract()`.
3. Import a multi-sheet XLSX; verify the warning and separate tables.
4. Check Open With/menu/default-setting behavior, keyboard navigation, light/dark
   display, schema inspection and table/column autocomplete.
5. Save explicitly as SQLite, reopen it, and confirm original files are unchanged.
6. Report confusing behavior, errors, rough edges and which editing feature is
   actually needed next. Include OS/VS Code version and reproduction steps.

Owner decision (2026-10-26): the assistant owns QA and should consider different
people using the extension and their likely feedback. Use delegated visual QA
and a clearly labelled simulated-persona assessment for the handoff decision;
do not wait for outside users. Actual external feedback has not been supplied.
Simulation is not represented as interviews or real user reports. The assessment
and observed QA results will be recorded below before the next-task recommendation.

## Assistant-led QA and simulated feedback (2026-10-26)

The owner explicitly delegates QA and simulated-persona evaluation instead of
waiting for outside feedback. The following is a heuristic product assessment,
not interviews, adoption evidence or statements from real testers.

Fresh visual-host setup uses four disposable fixture copies and an isolated
`integration-profile-t028-qa-t4CTpX` profile. Both supported computer-use
interfaces enumerate the new window but fail binding it: `window id 985222 no
longer belongs to Microsoft.VisualStudioCode; current owner is
Microsoft.VisualStudioCode`. A refreshed identity/retry fails identically. No
input is sent to the owner's editor. Fresh live visual control is unavailable;
do not claim fresh interactive QA or a new screenshot pass.

Review the retained T-027 pixels for the unchanged runtime instead:
`out/t027-qa/csv-light-multiline.png`, `imported-keyboard-dark.png`,
`xlsx-sheets.png` and `completion-light.png`. Observed: selected multiline text
remains complete in cell details; light/dark focus and selection are visible;
the XLSX sheet/source/memory notice is visible; real column autocomplete and
its keyboard guidance are visible. These historical frames and the prior
eight-item delegated QA/full77-host checks support the existing acceptance,
not a new execution of every UI check. Runtime/config parity is required.

The task-owned QA host is closed after verifying its exact executable and
unique profile on PID28860; only that process tree is ended. The launcher exits
one as expected from forced cleanup, not from an application assertion. Initial
sandbox CIM inspection was access-denied; elevated read/guarded cleanup succeeds.
Retain `out/t028-checkpoint/qa-host.log`, `qa-launch.json` and source hash records.
The ad-hoc visual launcher also reports this unapproved vendor console warning
at `out/t028-checkpoint/qa-host.log:8`:

```text
(node:28860) [DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized and prone to errors that have security implications. Use the WHATWG URL API instead. CVEs are not issued for `url.parse()` vulnerabilities.
(Use `Code --trace-deprecation ...` to show where the warning was created)
```

This visual probe is not a
clean runtime/log-gate pass. No exception is added, no host warning is hidden,
and no extension-code cause is established. Canonical test-host evidence remains
separate; no unchanged visual-launch retry-to-green is performed.

- **Data analyst (simulated):** preview, exact int64 text, paged SQL and saved
  SQLite support analysis without modifying the input. Likely friction is the
  required import before full SQL on tabular formats. Existing progress/cancel
  and honest limitations address that tradeoff; no new ingestion engine needed.
- **Spreadsheet user (simulated):** separate XLSX tables and memory warnings make
  the conversion understandable. Likely next request is correcting a few cells
  safely. Keep cached-formula/date/blank semantics explicit and make staged edits
  an explicit next task rather than silently enabling writes.
- **SQL developer (simulated):** schema inspection, completion and keyboard Run
  are useful. Likely request is controlled write access with save/revert. T-030
  already scopes that need and should preserve the read-only default.
- **Privacy-focused user (simulated):** local processing, full source-hash tests
  and explicit atomic saves provide evidence-backed protection. Editing must
  keep clear dirty state and save confirmation rather than implicit mutation.
- **Keyboard-first newcomer (simulated):** the visible focus, selected-cell pane
  and completion help are useful. Dense inline guidance consumes screen space;
  treat discoverability/polish as feedback to consider, not a fabricated defect
  or a reason to widen this checkpoint task.

Decision: existing scoped QA and verified unchanged runtime support the local
checkpoint. No new concrete runtime defect is established by this evaluation.
Recommend **T-030 planning next**, limited to FR-016/FR-020 staged edits,
read/write mode, dirty/save/revert state and stable row identity. Review write
safety carefully and write failing acceptance tests before implementation.
External feedback can still improve priorities later; it is not an owner-action
blocker under the explicit delegation. No Milestone 3 code is implemented here.
All four disposable source hashes remain unchanged. The exact next-task context
pack is ready at `out/t028-checkpoint/next-task-context.txt` (`node scripts/ctx.mts T-030`).

## Next-chat prompt (copy after the checkpoint is prepared)

```text
Read AGENTS.md, specs/CONSTITUTION.md, PROGRESS.md, then
docs/t028-milestone2-checkpoint.md. Milestone 2 has a local v0.2.0 source
checkpoint; the development VSIX manifest is still0.0.1, not a public release.
Check owner push evidence and preserve unrelated working-tree changes.
The owner delegated visual QA and simulated-persona assessment; read its labelled
results and next-task recommendation. Plan T-030 (FR-016/FR-020) only if the
completed assessment supports it. Restate acceptance,
files and uncertainties and wait for my OK before code, then write tests first.
Do not reopen an external-feedback approval wait: the owner replaced that step
with assistant-led QA/persona assessment. Do not invent real-user interviews.
Publishing remains T-070.
```

Task-owned files: README.md, CHANGELOG.md, PROGRESS.md, specs/SPEC.md,
specs/PLAN.md, specs/TASKS.md, specs/VALIDATION.md and this record. Generated
archive/build/evidence stay under ignored `out/t028-checkpoint/`.
