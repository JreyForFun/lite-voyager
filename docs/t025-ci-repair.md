# T-025 CI fixture lifecycle repair

## Failed candidate (2026-10-20)

The owner reports [run 39304280687](https://github.com/JreyForFun/lite-voyager/actions/runs/39304280687)
FAIL. Public GitHub API metadata independently confirms attempt 1, exact
`3c836def34a65eaec26e627908df18014c017485`, event push, completed failure.
Windows job 118237156967 and macOS job 118237157078 succeed at locked install
and applicable full verification. Ubuntu job 118237156628 installs locked
dependencies successfully, then fails its session-bus/virtual-display full
verification step. Only inapplicable alternative-platform steps are skipped.
Metadata is retained in `out/t025-ci-39304280687-{run,jobs}.json`; remote raw
Windows/macOS logs, warning counts and measurements are not independently read.

The owner's pasted Ubuntu log is preserved exactly in
`out/t025-ci-39304280687-ubuntu.log`. It shows types/lint/build/package,
916 units /93 files (66.73 seconds), host compilation and all 72 host tests
(seven minutes) passing. The canonical runtime scan then rejects this error:

```text
20261019T184049/main.log:8: 2026-10-19 18:46:47.131 [error] Blocked vscode-webview request vscode-webview://0ckbtgi4qtnecqqgt7qp0dv8qb88d4lhpblsu6fug3fepc8ujldp/index.html?id=da11f54f-da03-44f1-8459-4e41e43dad34&parentId=1&origin=a52a6405-2305-4a64-b077-7d4816552440&swVersion=6&extensionId=jreyinnovarev.lite-voyager&platform=electron&vscode-resource-base-authority=vscode-resource.vscode-cdn.net&parentOrigin=vscode-file%3A%2F%2Fvscode-app
```

This appears between the two both-engine/five-format T-025 case results. The
log does not map its UUID to a particular source or panel. Its sole approved
record is HOST-001 at `20261019T184049/window1/renderer.log:15`, severity warning,
exact message `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
The Ubuntu full fails and is not warning-free. Do not ignore, reclassify or
allowlist the main-process error; preserve all five existing renderer-only
warning families and every other diagnostic failure rule.

## Evidence and scoped repair

Installed VS Code 1.140.0 `out/mainImpl.js` rejects `/index.html` webview
requests if the requesting frame is missing/destroyed or its process belongs
to no live workbench window. This is compatible with premature teardown, but
does not establish which lifecycle produced the historical UUID.

Read-only inspection finds a concrete gap: the T-025 renamed-SQLite loop
opens each of five tabular suffixes, checks engine completion and immediately
closes by URI. Engine completion can precede outer-frame mounting. That loop
bypasses the existing `closeEditor` transport barrier, unlike other normal
SQLite closure tests. The existing tabular paths already await preview/DOM.

Two new regressions fail first (five existing cases pass): an exact-tab close
callback is ignored, and its error is not propagated. The existing test helper
then gains an optional close callback; the default active-editor behavior is
unchanged. Its existing transport assertion precedes that callback, and helper
exit remains awaited. The renamed loop supplies its existing URI-specific close
function through this helper. All engine/header/suffix/source-byte assertions,
timeouts and normal/opening-cancellation coverage remain. No application,
protocol, dependency, runtime diagnostic rule or production timing changes.

Red/green logs: `out/t025-ci-close-{red,green}.log`. The repaired seven cases
pass in 650 ms. Host compilation passes in `out/t025-ci-close-compile.log`.
Independent read-only review confirms the gap and finds no remaining concrete
issue in the three-file repair; historical UUID causation remains unproven.

## Focused verification

All four T-025 real-host cases pass in 30 seconds, including all five renamed
SQLite suffixes on both engines, tabular DOM/import/source checks, independent
views/cancellation and association/dirty-buffer preservation. Log:
`out/t025-ci-ready-host.log`. Its unchanged strict runtime scan accepts only
HOST-001 at `20261020T102059/window1/renderer.log:9`, severity warning, exact
message `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`.
It is not warning-free. This local pass cannot establish repaired Ubuntu CI.

The owner exits FDM again; preflight finds no FDM process before the focused
run. Existing component visual evidence and native/other-platform appearance
limits are retained; no visible UI changes require new component captures.
Prior failures and the earlier 916-unit/72-host local pass stay separate.

## Final gates and handoff

The first literal standalone (`out/t025-ci-verify.log`) passes 918 units /93
files in 389.67 seconds after types/lint pass, but the strict console gate
rejects diagnostic-like captions emitted by the new expected-close-failure
test's default stage reporter. Build/package are not reached. Preserve this
failed attempt. The test now captures and asserts the exact expected failure
stages through the helper's existing reporter argument; the test name,
rejection identity, target-call and no-wrong-editor assertions remain. No
global console suppression or gate change is made. The seven cases then pass
the unchanged strict scanner in 736 ms (`out/t025-ci-close-strict.log`).

Fresh literal standalone verification passes with exit 0: 918 units /93 files
in 360.85 seconds, strict types/lint, production build and 34-file /981.8-KB
VSIX packaging, zero errors and zero warnings. Log: `out/t025-ci-verify-2.log`.
Independent follow-up review finds no concrete issue with the explicit
expected-failure stage assertions; the first failed standalone remains.

A fresh canonical full fails in `out/t025-ci-full.log`, with final status
`out/t025-ci-full-status.json`: 917 units pass and one existing fallback FR-016
metadata/source-safety case exceeds its unchanged 5000-ms deadline (93 files,
379.70 seconds). Types/lint and all seven lifecycle regressions pass; build,
package and hosts are not reached, so there is no new host diagnostic outcome.
Preflight finds no FDM process. Source/spec files remain frozen throughout the
run, without competing diagnostic workloads. Preserve this failure; it does not
clear the Ubuntu failure or establish which operation caused the timeout.

Inspection finds an unused initial engine open/close in the read-only fixture.
Two new regressions fail first because the existing helper ignores preparation.
The fixture now awaits preparation inside cleanup protection, before its first
engine open. Its baseline hash is captured after the writer closes and before
any engine opens; chmod is applied then. Both backend regressions assert no open
has occurred during preparation, inspect actual permission bits, and confirm
one real first open with those permissions retained. All metadata,
write rejection, cancellation recovery, source hash, sidecar and final reopening
assertions remain, as does the 5000-ms deadline. This removes redundant setup
without claiming the historical timeout phase is known. Red evidence:
`out/t025-ci-schema-red.log`. All 30 metadata-suite cases pass in 16.96 seconds
(`out/t025-ci-schema-green.log`). Independent read-only review finds no concrete
issue in the fixture change and confirms the preserved assertions and budget.
The next standalone (`out/t025-ci-verify-3.log`) stops at lint: the first spy
wrapper detaches an instance method (`unbound-method`). Replace that wrapper
with a normal call-through spy and explicit preparation/open ordering assertions;
no lint disable or safety assertion removal. Preserve this failed attempt.
Follow-up review identifies a regression coverage gap: repeat the no-open
assertion after awaited chmod/stat so missing-await mutations are detected.
The fourth standalone is deliberately interrupted before completion to make
that assertion change; `out/t025-ci-verify-4.log` is not a passing result.
Independent follow-up confirms the post-await assertion closes the gap, with
no remaining concrete findings. Fresh literal standalone passes with exit 0 in
`out/t025-ci-verify-5.log`: 920 units /93 files, 346.69 seconds, strict types,
lint, production build and 34-file /981.8-KB VSIX packaging, zero errors and
zero warnings. The previous failures/interruption remain separate.

The revised candidate's canonical full passes with exit 0 in
`out/t025-ci-full-2.log`, status `out/t025-ci-full-2-status.json`: strict types,
lint, 920 units /93 files (303.26 seconds), production build, 34-file /981.8-KB
VSIX, host compilation, all 72 hosts (40 minutes), and strict runtime scanning.
It runs from 2026-10-20T03:11:30.181Z to 04:00:52.384Z (49m22.203s).
FDM is absent at preflight. All 317 frozen source/spec/record hashes match after
completion (`out/t025-ci-full-2-{source,parity}.json`). No competing tests or
profiling run during large-file measurements. The red-first preparation repair
justifies this candidate run; no unchanged full retry or changed budget.

The scan accepts exactly two renderer warnings, both at
`20261020T112015/window1/renderer.log`:

- Line 2, severity warning, VSCODE-HOST-002, exact message:
  `Creation of workbench contribution 'workbench.contrib.chatLanguageModelsData' took 32ms.`
- Line 11, severity warning, VSCODE-HOST-001, exact message:
  `[CloudSandboxApi] No 'github' session with scopes [read:user, user:email, repo, workflow]`

The full is not warning-free. No other runtime error/warning is accepted.
All four T-025 host cases pass, including both engines/five renamed suffixes,
independent cancellation and explicit associations/dirty-buffer preservation.
Populated 1.29/5.87-GB SQLite first DOM is 1496.7329/1299.6447 ms; JSON/JSONL
1/5-GB and ten-million-row checks pass. Populated CSV 1/5-GB host/helper peaks
are 214753280/213815296 bytes, with all 60 Browse/20 SQL pages and source hashes.
These are the existing sampled scopes, not physical paint or unsampled peaks.

## Changed files and owner handoff

- `src/test/file-opening.test.ts`
- `src/test/sqlite-editor-lifecycle.ts`
- `test/unit/sqlite-editor-lifecycle.test.ts`
- `test/unit/engine-schema.test.ts`
- `docs/t025-ci-repair.md` (new)
- `docs/t025-opening.md`
- `PROGRESS.md`
- `specs/TASKS.md` (T-025 records only)
- `specs/VALIDATION.md` (T-025 records only)

Commands used: `npm run verify` and `npm run verify:full`; focused checks use
`node node_modules/vitest/vitest.mjs run test/unit/sqlite-editor-lifecycle.test.ts`
and `node node_modules/vitest/vitest.mjs run test/unit/engine-schema.test.ts`.
Executable repairs and local gates pass with independent review. Prior scoped
component visuals remain valid; native menus/dialogs and other-platform physical
appearance remain unobserved. No visible production UI changes are made here.

Only evidence/status records change after the frozen full. The scoped
repair commit is for the owner to push and supply fresh actual-candidate
Windows/macOS/Ubuntu CI. Historical UUID causation remains unproven; the local
pass cannot clear the failed Ubuntu run. T-025 stays unchecked until that CI
passes; no other task, milestone, release or tag may be marked complete.
Preserve the owner's unrelated README/PLAN/T-015 edits and untracked fixtures.
