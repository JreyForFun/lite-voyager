# Lite Voyager: Tasks

Status: Draft v0.6 | Work from top to bottom. Each task names the requirements it satisfies. A task is done only when its acceptance criteria pass and its tests exist.

Tick boxes as you go: `[ ]` todo, `[x]` done.

## Who does what

Every task is tagged by owner, so an AI assistant never wastes time on things it cannot do.

| Tag | Meaning |
|---|---|
| **[H]** | Human only. Accounts, GitHub or Marketplace websites, interactive generators, anything that needs your login or your machine. The AI must not attempt these. |
| **[AI]** | The AI can do it entirely inside the IDE: writing code, config files, tests, scripts. |
| **[AI+H]** | The AI writes it, then you run it and paste the result back (test output, timings, what you saw after pressing F5). |

Milestones 1 to 4: every task is **[AI+H]** unless marked otherwise. The AI writes code and tests; you run the tests and check the result in VS Code.

Task numbers are IDs, not order. Work in the order the lists appear.

## Milestone 0A: Human setup (do these yourself, in this order)

- [x] **T-000 [H]** Create a **new** GitHub repository named `lite-voyager` (not a fork) with an MIT license and a Node `.gitignore`. Clone it. Add a README stub that credits filesql. Copy in this `specs/` folder plus `AGENTS.md` and `PROGRESS.md`, and commit them as the first commit. **Approved exception:** the user authorized AI execution and a follow-up setup commit preserving the existing initial commit.
- [x] **T-001 [H]** Check that "Lite Voyager" is free on the VS Code Marketplace and create your publisher account. Re-verify the competitor table in `SPEC.md` (install counts and features change). *(D-1; owner reports and dated review recorded below.)*
- [x] **T-003 [H]** Run the extension generator yourself, because it is interactive: `npm install -g yo generator-code`, then `yo code`. Choose New Extension (TypeScript) with esbuild. If it creates a subfolder, move its contents to the repo root. Press F5 and confirm the "Hello World" command works. Commit.

### Verified status (2026-10-09)
- T-000: setup commit `04c7bd7`, MIT license, Node ignore rules, root instructions, specs, and filesql credit are verified. The user reports the repository step complete; subsequent T-006 verification passes.
- T-001: checked after the owner reported the Marketplace name is free, supplied publisher ID `jreyinnovarev`, and updated SPEC.md with a dated 2026-10-09 competitor review. Local `npm run verify` passes with 66 unit tests. The AI checked the document update, not account ownership or each Marketplace figure. The supplied positioning changes are preserved; D-2 remains open.
- T-003: the user reports generator/F5 completion. TypeScript/esbuild scaffold is present; an integration test activates `jreyinnovarev.lite-voyager`, checks registration, and runs Hello World. The scaffold is included in the T-006 commit.
- T-006: strict host/webview/tooling typechecks, lint, 30 unit tests, both production bundles, and a temporary VSIX check pass. `verify:full` also passes both integration tests and structured runtime-log validation in VS Code 1.140.0. A red-first regression test verifies fresh empty installed/built-in extension directories, which isolate unrelated Git/Copilot components without modifying VS Code or filtering diagnostics. Built-in coexistence and other platforms are not covered by this local run.
- T-005: 27 committed synthetic assets plus a hashed inventory, safe generators, and runtime setup recipes are verified. All 60 unit tests (30 new T-005 tests), strict checks, lint, build and packaging pass. A real local 10-million-row run completed in 163,629 ms; an independent Python streaming/read-only check validated every CSV record and SQLite counts, ID bounds and payload lengths. CSV: 1,258,888,906 bytes; SQLite: 1,246,060,544 bytes. No future feature behavior, import speed, or peak-memory target is claimed. Large outputs are ignored.
- T-007: checked after [run 37884550873](https://github.com/JreyForFun/lite-voyager/actions/runs/37884550873) succeeded for commit `93b23bf1420cf10dd8b0ea82d3b4c2be0e35268d` on 2026-10-09. GitHub API metadata confirms all three Full verification jobs and their platform-specific verification steps succeeded. Six red-first workflow tests cover the CI contract and D-Bus regression; local verification passes with 66 unit tests and two integration tests. Initial existing T-006 compiler-test timeouts passed on unchanged retries; that timing remains intermittent locally. No engine or milestone-completion claim is made.
- T-002: helper/worker redesign passes executing-query cancellation and reopening; supported minimum is VS Code 1.140.0. Owner manual QA passes both engines (native 24 ms, fallback 92 ms, recovery and responsive typing). [CI run 37916047454](https://github.com/JreyForFun/lite-voyager/actions/runs/37916047454) passes all three Full verification jobs for the initial implementation at f3085869c88262b2ffdbfddb47805f6287cdcc3a. Owner-authorized review fixes add red-first WAL/snapshot rejection, complete statement cleanup, and exact page-budget tests. A fresh-context follow-up review found no remaining concrete defect. Local full verification passes with 103 unit tests, six integration tests, and strict logs; VS Code 1.141.0 also passes integration/log checks. The owner pushed the fixes; [fresh run 37922970386](https://github.com/JreyForFun/lite-voyager/actions/runs/37922970386), attempt 1 at 0e3ec57de8254b80a2aa8bc830ea65c527e8301c, passes all three jobs and their applicable full-verification steps on 2026-10-09. T-002 is checked; the milestone remains open.
- T-004 is checked: local verification passes with 139 unit tests (36 spike cases), and an independent Python comparison checks all 10 million rows. Owner verification passes; the owner-run 1.26 GB benchmark at 7d9cf25 verifies every row with matching source/value hashes: 145.4 s import, 223.0 MB standalone peak RSS and 27.2 ms parsed preview. Evidence, scope and feasibility decision are in PLAN.md. Production NFR-003/NFR-004 targets remain open.
- T-008 is complete at 8fed6f0: owner committed and reports pushing; local main matches origin/main. Verify passes with 150 unit tests, and owner manual QA passes in VS Code 1.141.0 (512 cached / about 20–23 rendered rows; keep CodeMirror 6). All seven integration tests pass, but the strict log gate still fails on the existing cloud-dictation warning. No new CI or foundation gate is claimed.
- T-051: ctx prints exact task/linked requirement/Constitution text; trace scans unit and integration test names without executing tests. All current task packs resolve. Verify passes with 176 unit tests, including 26 T-051 cases, strict types/lint, builds and packaging with zero errors/warnings. Trace reports 24 existing naming gaps; no full coverage or foundation gate is claimed. Task changes and completion documentation are included in the T-051 commit; the owner pushes.
- T-052 reconciles the remaining foundation gate. The production Engine scope is already clarified as T-009. Existing spike/manual evidence is sufficient for foundation scope; independently reviewed executable repairs require fresh three-platform CI and a final tag before milestone closure.

## Milestone 0B: Foundation and risk spikes (mostly AI, with you running things)
Goal: set up tooling and prove the risky technical bets before building features.

T-007 CI regression repair was reopened after failed runs 37944872111 (eb8c498),
37949436855 (d6c359b), and 37952380317 (ad7c464). All three fail on macOS;
the oldest also has a Windows responsiveness-test timeout. Historical green CI
evidence above remains valid for those earlier commits. The owner authorized
test-profile/fixture repairs; fresh local full verification and three-platform
CI are required to check T-007 again. The owner explicitly approved the two
source-restricted host diagnostic families in VALIDATION section 1, with mandatory
reporting. Every other warning and every error remains fatal.
Local final `verify:full` passes on 2026-10-10 with 197 unit tests and eight
integration tests in VS Code 1.140.0; one approved signed-out host diagnostic
is reported. Fresh [run 37956761308](https://github.com/JreyForFun/lite-voyager/actions/runs/37956761308),
attempt 1, tests repair commit `f3d82bb365f3886a18b950bbf61141a16b321faa`
and passes all three Full verification jobs on 2026-10-10. GitHub API metadata
confirms locked dependency installation and each applicable full-verification
step succeeded on Ubuntu, Windows and macOS. T-007 is checked again; no other
task is reopened or newly checked, and the foundation milestone remains open.

- [x] **T-006 [AI]** Configure the scaffolded project: strict TypeScript, lint, esbuild bundles for host and webview, Vitest, a `protocol.ts` skeleton, and a `.vscode/launch.json` for F5. Define two scripts: `npm run verify` (typecheck, lint, unit tests, build, `.vsix` package dry run) and `npm run verify:full` (the same plus integration tests in a real VS Code). Treat warnings as failures. Do not add dependencies beyond those named in `PLAN.md` without asking. *(Plan section 1, `VALIDATION.md` section 1)*
- [x] **T-005 [AI]** Create test fixtures: a small SQLite file (one table with a BLOB column, one with no primary key, one `WITHOUT ROWID` table), small CSV / TSV / JSON / JSONL / XLSX files, and a script that generates large CSV and SQLite files. Also add fixtures for the edge cases listed in `VALIDATION.md` section 5 (corrupt, empty, BOM, 64-bit integers, awkward names, and so on). Large files are git-ignored. You run the generator script locally. *(Inventory and runtime recipes: `test/fixtures/manifest.json`, `test/fixtures/README.md`; tooling: PLAN section 1.)*
- [x] **T-007 [AI+H]** CI: the AI writes `.github/workflows/ci.yml` and workflow contract tests. Run `npm ci` and `npm run verify:full` (strict checks, lint, unit tests, builds, VSIX packaging, extension integration tests and runtime-log checks) on Windows, macOS, and Linux; use an isolated D-Bus session and xvfb on Linux. All three jobs report results even if one fails. You push the committed changes and provide the Actions run URL, commit SHA, and green conclusions for all three jobs; paste any failing step logs back to the AI. Keep this checkbox open until that evidence passes. **Approved clarification:** full integration coverage on all three platforms, matching `VALIDATION.md` section 1; local workflow tests alone do not prove CI success. *(Passed run/SHA/job evidence recorded above.)*
- [x] **T-002 [AI+H]** Spike: the extension host launches a helper with its bundled runtime, with `node:sqlite` inside a `worker_threads` worker. Open/query read-only; cancel executing SQL by killing the helper and confirming its exit within 1,000 ms, then reopen/query successfully. **Owner-approved revision:** terminating a worker alone waited for native SQLite execution; use the helper/worker design (PLAN D-3, SPEC FR-015). You test by hand on your operating system; fresh CI covers the others. Record tested VS Code/runtime versions, document the supported minimum, and verify real sql.js fallback when the built-in module is unavailable. Not a go/no-go gate. *(NFR-001, NFR-002, NFR-005, NFR-009, FR-015, FR-016 spike safety criteria, R-2)*
- [x] **T-004 [AI+H]** Spike: the AI writes a script that streams a generated CSV of at least 1 GB (1,000,000,000 bytes) into an on-disk SQLite file with batched inserts. You run it and paste back the report: elapsed import time, process peak RSS, time to parsed preview rows, row/value verification, and unchanged-source hashes. Use text-only fields for exact fidelity; reject malformed inputs clearly, preserve existing destinations, and clean partial output on cancellation/failure. **Owner-approved clarification (2026-10-09):** the 1 GB standalone process measurement is preliminary evidence for NFR-003; a 5 GB run can strengthen it but does not establish peak extension memory. Parsed preview latency is supporting evidence for NFR-004, not visible first paint. Keep the original 5 GB extension-memory and visible-UI targets open; record feasibility decisions and limitations in PLAN.md. *(FR-004, NFR-001, NFR-003, NFR-004, R-1)*
- [x] **T-008 [AI+H]** Spike: render a CodeMirror 6 editor and a virtualized grid in a webview. You open it with F5 and judge whether scrolling feels smooth. Confirm or change the editor choice. Owner-approved detailed acceptance: SPEC Querying, T-008 foundation spike; bounded synthetic pages and windowed rendering, all ten million rows reachable, lifecycle/error coverage. Owner manual QA passes; CodeMirror 6 is confirmed. Task changes are committed at 8fed6f0; owner reports pushing. *(Plan section 1; README T-008 manual steps)*
- [x] **T-051 [AI]** Spec tools: `npm run ctx -- <TASK-ID>` prints the task line, the full text of the FR / NFR requirements it links to, and the Constitution, ready to paste into a fresh AI chat. `npm run trace` lists every requirement ID that has no test whose name starts with that ID. Plain Node scripts, no new dependencies. *(`CONTEXT.md`, `VALIDATION.md` layer 2)*
- [x] **T-050 [AI+H]** Dependency check: list the license of every dependency and run `npm audit`; check SheetJS's current install guidance. **Owner-approved delegation (2026-10-09):** the assistant reviews and decides within this task; the owner pushes. All 576 locked paths are inventoried; missing MIT/custom Microsoft declarations are resolved, audit reports zero known vulnerabilities, and official SheetJS install/license/advisory guidance is recorded. Retain the current tree; no dependency or fixture fix is required. Three red-first checks and verify pass with 179 tests and zero errors/warnings. Evidence: `specs/DEPENDENCIES.md`, `specs/dependency-licenses.json`, `specs/dependency-audit.json`. Completion documentation belongs to the local T-050 task commit. *(D-4)*

- [ ] **T-052 [AI+H]** Close the foundation gate: reconcile Milestone 0 acceptance-to-test coverage and existing source-safety, measurement and manual QA evidence; independently review the actual foundation diff and fix concrete findings with failing regressions first; record delegated D-2/R-1 decisions and remaining production targets. Run local `verify:full`, obtain passing three-platform CI for any new executable changes, update the gate records, commit and tag `v0.0.1`. The owner pushes and supplies remote evidence. Do not implement T-009 in this task. **Owner-approved delegation (2026-10-10):** the assistant makes necessary closure decisions and repairs; the owner handles pushing. *(VALIDATION sections 3, 4, 6; CONTEXT section 5)*

**Gate (see `VALIDATION.md` section 4):** T-002 and T-004 results are written into `PLAN.md`, `npm run verify:full` is green locally and in CI, and the milestone checklist is complete. Then tag, close the chat, and start Milestone 1 in a fresh one (`CONTEXT.md` section 5).

T-052 local candidate (2026-10-10): independent foundation review found two
concrete issues, now repaired with red-first tests and independently rechecked.
Full local verification passes with 207 unit/eight integration tests and one
explicitly reported approved host diagnostic. Source safety, scoped coverage,
measurements, existing owner QA and spike records are reconciled in VALIDATION.
No dependency or committed fixture changes. The owner pushes; fresh three-platform
CI and the final commit/tag are still required. Keep T-052 unchecked until then.

Owner-supplied run 37961300752/attempt 1 at d18e5e6 passes all locked installs
and applicable full-verification steps on Windows/macOS/Linux. Local completion
verification then hit a 5-second large quoted-header test timeout. The fixture
retains its 70 KB header, embedded LF/CRLF, exact assertions and timeout while
reading 4,096-byte chunks instead of 7-byte chunks; a new assertion confirms
the input spans reads. T-052 stays open for this adjusted fixture's fresh local
full gate/three-platform CI and final tag. No Milestone 1 task is started.
Adjusted-fixture full local verification now passes with 207 unit/eight integration
tests and one explicitly reported approved host warning; independent follow-up
review confirms unchanged acceptance. Owner pushes this candidate for fresh CI.

**Exit criteria:** T-002 and T-004 results are written into `PLAN.md`, and CI is green. The `Engine` interface from `PLAN.md` D-3 comes next in T-009. If T-004 shows imports are unacceptably slow, revisit R-1 before Milestone 2.

## Milestone 1: Read-only SQLite (release 0.1)
- [ ] **T-009** Define the `Engine` interface and implement the sql.js fallback with the memory-limited banner and large-file prompt. Add a test hook (environment variable `LITE_VOYAGER_FORCE_FALLBACK=1`) that forces the fallback engine, so both engines can be tested on any machine. *(PLAN D-3, FR-001)*
- [ ] **T-010** Custom editor for SQLite extensions; header-based detection; invalid-file error. *(FR-001)*
- [ ] **T-011** DB worker: open read-only, list tables and views, get schema. *(FR-001, FR-003, FR-016)*
- [ ] **T-012** Table list, paginated grid, NULL styling, BLOB placeholder, lazy row count, exact display of 64-bit integers. *(FR-002, section 4.1)*
- [ ] **T-013** SQL editor, run, results grid, paging, error display. *(FR-010, FR-011)*
- [ ] **T-017** Column sort and simple filter, executed in the engine. *(FR-017)*
- [ ] **T-018** Cell details panel and copy as TSV. *(FR-018)*
- [ ] **T-014** Cancel a running query without freezing the UI. *(FR-015, NFR-005)*
- [ ] **T-015** Streamed export of results to CSV / JSON. *(FR-014)*
- [ ] **T-016** Tests: invalid file; source file byte-identical after browse and query; opening a very large SQLite file stays within memory targets. *(NFR-001, NFR-003)*

**Exit criteria:** FR-001, 002, 003, 010, 011, 014, 015, 016, 017, 018 pass, plus the screen states in `SPEC.md` section 5.5.

**Gate:** complete the universal gate and the Milestone 1 manual QA in `VALIDATION.md` section 4, run the independent review (section 6), tag `v0.1.0`, then start Milestone 2 in a fresh chat. Publish a preview and gather feedback before Milestone 2.

## Milestone 2: Other formats (release 0.2)
- [ ] **T-020** `FileLoader` interface; instant preview for CSV. *(Plan section 6, FR-004)*
- [ ] **T-021** CSV / TSV streaming import with progress, cancel, delimiter detection, header toggle, type inference. *(FR-004)*
- [ ] **T-022** Temp storage: disk-space check, cleanup on close, orphan cleanup on startup, "Save as SQLite". *(FR-007)*
- [ ] **T-023** JSONL and JSON-array streaming import; nested values stored as JSON text. *(FR-005)*
- [ ] **T-024** XLSX loader with the memory warning. *(FR-006)*
- [ ] **T-025** "Open With", Explorer context menu, editor-title button, `liteVoyager.openCsvByDefault` setting. *(D-5)*
- [ ] **T-026** Autocomplete from schema. *(FR-012)*

> **Stay lite (Constitution 8):** ship Milestones 1 and 2 and gather feedback before starting 3 and 4. Later milestones are optional and should be cut or reshaped based on what users actually ask for.

## Milestone 3: Editing (release 0.3)
- [ ] **T-030** Write-mode switch and staged edits with dirty state, save, and revert; primary key or `rowid` addressing. *(FR-016, FR-020)*
- [ ] **T-031** Add and delete rows. *(FR-021)*
- [ ] **T-032** Query history. *(FR-013)*
- [ ] **T-033** External change detection and refresh prompt. *(FR-040)*

## Milestone 4: Differentiators (release 0.4)
- [ ] **T-040** Multi-file session and cross-file joins. *(FR-030)*
- [ ] **T-041** CSV and JSON write-back with warning and atomic replace. *(FR-022)*
- [ ] **T-070** Release pipeline: package, publish to the Marketplace and Open VSX, pre-release channel, Marketplace README with a screen recording. *(PLAN section 7.5)*
- [ ] **T-060** Benchmark suite versus competitors; publish results in the README. *(Goals G1 to G5)*

## Future backlog (unscheduled)
Hex / BLOB viewer, SQLCipher, Parquet, visual table designer, index manager, SQL dump, charts, Excel write-back, foreign-key navigation, DuckDB-backed read path, VS Code for Web.

## Gates

Every milestone ends with a gate (`VALIDATION.md` section 4): green `npm run verify:full` on three operating systems, requirement-to-test coverage, manual QA, independent review, measured numbers recorded, specs and `PROGRESS.md` updated, git tag. Then a **fresh AI chat** for the next milestone (`CONTEXT.md`). Milestones 2, 3, and 4 use the same gate with their own checklists.

## Working loop
1. Open a **new chat** with the task kickoff prompt (`CONTEXT.md`). Pick the next task and read the requirements it links to.
2. Write the test from the acceptance criteria first.
3. Implement until it passes. If the spec is wrong or unclear, stop and edit the spec, then continue.
4. Run `npm run verify` and read the output yourself.
5. Check the Definition of Done (`VALIDATION.md` section 2). Update changelogs of any spec file you touched.
6. Run the session-end prompt, overwrite `PROGRESS.md`, commit, and close the chat.

When using an AI coding assistant, give it `CONSTITUTION.md`, the relevant part of `SPEC.md` and `PLAN.md`, and only the single task you are working on.

## Changelog
- v0.6 T-052 fixture follow-up (2026-10-10): Recorded passing candidate CI and a subsequent local header-test timeout; fixture efficiency is repaired without reducing data/assertions or extending timeout. Keep closure open for new candidate evidence.
- v0.6 T-052 local candidate (2026-10-10): Recorded reviewed red-first repairs and passing full local gate; closure remains pending the owner's push, new three-platform CI and final tag. T-009 is not started.
- v0.6 T-052 kickoff (2026-10-10): Owner delegated foundation closure decisions and necessary fixes; added one explicit closure task and linked T-002's already-specified source/security/fallback safety criteria. Production features remain in later tasks.
- v0.6 T-007 repair completion (2026-10-10): Verified owner-supplied run 37956761308, attempt 1 at f3d82bb, including successful dependency installation and full-verification steps on all three platforms; rechecked T-007 only. Foundation completion is not claimed.
- v0.6 T-007 local repair evidence (2026-10-10): Profile/fixture repair and narrowly approved diagnostic handling pass final full verification with 197 unit/eight integration tests; T-007 stays open for fresh remote evidence.
- v0.6 T-007 CI regression repair: Reopened T-007 after three failed owner-supplied runs; preserve historical green evidence and require fresh full local/three-platform validation before rechecking.
- v0.6 T-050 completion (2026-10-09): Owner delegated review decisions; documented 576 locked package paths and all licenses, resolved metadata exceptions, captured a zero-finding audit and checked official SheetJS guidance. Three red-first task tests and verify pass (179 unit tests, zero errors/warnings); checked only T-050 in its task commit. Owner pushes; remaining foundation gate items stay open.
- v0.6 T-051 completion (2026-10-09): Added ctx/trace Node scripts without new dependencies, 26 task tests and usage documentation. Verify passes with 176 unit tests and zero errors/warnings; all task packs resolve. Checked T-051 in its task commit. The 24 naming gaps, T-050 and foundation gate remain open.
- v0.6 T-008 completion (2026-10-09): Checked T-008 after passing verification, owner QA/editor decision and task commit 8fed6f0. Owner reports pushing; local main matches origin/main. Existing full-gate warning and remaining foundation work stay open.
- v0.6 T-008 owner QA (2026-10-09): Recorded all manual checks passing and CodeMirror 6 confirmed; 512 cached / about 20–23 rendered rows. Acceptance is met with passing verification; leave checkbox open until the owner commits the task changes.
- v0.6 T-008 implementation (2026-10-09): Added owner-authorized detailed acceptance and implementation. Manual scrolling assessment and editor-choice evidence remain required; T-008 and the foundation milestone stay open.
- v0.6 T-004 completion (2026-10-09): Checked T-004 after passing owner verification and full benchmark JSON at 7d9cf25; every row and source/value hash verifies. PLAN.md records 145.4 s import, 223.0 MB standalone RSS and 27.2 ms parsed preview. The original production targets and foundation milestone remain open.
- v0.6 T-004 spike (2026-10-09): Owner authorized implementation, fixtures and measurement-scope clarification. The standalone 1 GB test provides preliminary process-memory/parsed-preview evidence; original extension-memory and visible-first-paint targets remain open. T-004 stays unchecked pending owner evidence.
- v0.6 T-002 completion (2026-10-09): Reviewed fixes, local strict gates, owner manual QA and fresh three-platform run 37922970386 at 0e3ec57 pass. Checked T-002 only; the milestone remains open.
- v0.6 T-002 authorized redesign (2026-10-09): Updated the task to require confirmed helper exit and one-second cancellation after real SQL execution begins. Local tests pass on two versions; manual QA/CI closure remains open.
- v0.6 T-002 investigation (2026-10-09): Marked the spike in progress without checking it; native worker termination failed the executing-query cancellation diagnostic. Awaiting an approved cancellation design.
- v0.6 T-007 completion (2026-10-09): Checked T-007 after the user supplied green run 37884550873 and GitHub API metadata independently confirmed commit 93b23bf and successful full-gate steps on Ubuntu, Windows, and macOS. Recorded evidence and updated current status; remaining M0 tasks/gate items stay open.
- v0.6 T-007 Ubuntu fix / T-001 evidence (2026-10-09): Recorded supplied Ubuntu test successes and D-Bus failure; added a regression test and session-bus wrapper. Checked T-001 after accepting the owner's dated competitor review and passing local verify with 66 unit tests. Restored approved FR-020 consistency without changing the supplied positioning. Both local gates pass after unchanged retries of existing compiler-test timeouts; T-007 stays unchecked pending fresh remote CI evidence.
- v0.6 T-007 CI (2026-10-09): Applied the user's approved three-platform full-gate clarification and added workflow tests/evidence instructions. Implementation is recorded separately from pending validation; T-007 stays unchecked.
- v0.6 T-005 completion (2026-10-09): Checked T-005 after 60 passing unit tests and full-size local generation independently validated with Python. Added the fixture inventory and runtime recipes; corrected approved FR-020/QA wording and synchronized affected specs/changelogs.
- v0.6 T-006 completion (2026-10-09): Checked T-006 after clean full verification with 30 unit tests, both integration tests, and runtime-log checks. Fresh empty installed/built-in extension directories resolve the unrelated host diagnostics; no tests or diagnostic checks weakened.
- v0.6 T-006 implementation (2026-10-09): Ticked T-000/T-003 with setup and activation evidence. Added 29 unit tests and strict runtime-log validation; T-006 remains open because the downloaded VS Code host emits errors/warnings. T-001 retains its competitor-review gap.
- v0.6 validation update (2026-10-09): Recorded the user's Marketplace/scaffold reports, passing scaffold build, README credit restoration, and remaining validation gaps; prepared T-006.
- v0.6 status update (2026-10-09): Recorded repository setup evidence and outstanding Milestone 0A/0B work; no checkboxes changed without passing validation.
- v0.6 clarification: User approved AI execution of T-000 and a follow-up setup commit instead of rewriting the initial commit.
- v0.6: Added verify scripts (T-006), edge-case fixtures (T-005), spec tools (T-051), fallback test hook (T-009), milestone gates, and the fresh-chat working loop.
- v0.5: Split Milestone 0 into human setup (0A) and AI work (0B); added owner tags. Moved CI to T-007, license audit to T-050, webview spike to T-008, project config to T-006.
- v0.4: Added T-000 (repo setup), T-017, T-018, T-070.
- v0.3: Renamed to Lite Voyager. T-002 is no longer a gate; added T-009 (Engine interface and fallback).
- v0.2: Added Milestone 0 spikes, any-size tasks, and open-behavior tasks.
- v0.1: Initial draft.
