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
- T-002: helper/worker redesign passes executing-query cancellation and reopening; supported minimum is VS Code 1.140.0. Owner manual QA passes both engines (native 24 ms, fallback 92 ms, recovery and responsive typing). [CI run 37916047454](https://github.com/JreyForFun/lite-voyager/actions/runs/37916047454) passes all three Full verification jobs for the initial implementation at f3085869c88262b2ffdbfddb47805f6287cdcc3a. Owner-authorized review fixes add red-first WAL/snapshot rejection, complete statement cleanup, and exact page-budget tests. A fresh-context follow-up review found no remaining concrete defect. Local full verification passes with 103 unit tests, six integration tests, and strict logs; VS Code 1.141.0 also passes integration/log checks. Fix commit 9b80bbfe805a84edf65e72297daf20a65ea8d041 needs owner sign-in/push because no cached GitHub credentials are available. The checkbox stays open pending fresh three-platform CI for these fixes.
- Other Milestone 0B tasks T-004, T-008, T-051, and T-050 are not started. No context/trace scripts or dependency audit exist.
- Before the milestone gate, clarify the Milestone 0 Engine interface requirement versus T-009. Three-platform CI evidence is recorded; spikes, other gate requirements and remaining foundation tasks are still open. No milestone gate has passed.

## Milestone 0B: Foundation and risk spikes (mostly AI, with you running things)
Goal: set up tooling and prove the risky technical bets before building features.

- [x] **T-006 [AI]** Configure the scaffolded project: strict TypeScript, lint, esbuild bundles for host and webview, Vitest, a `protocol.ts` skeleton, and a `.vscode/launch.json` for F5. Define two scripts: `npm run verify` (typecheck, lint, unit tests, build, `.vsix` package dry run) and `npm run verify:full` (the same plus integration tests in a real VS Code). Treat warnings as failures. Do not add dependencies beyond those named in `PLAN.md` without asking. *(Plan section 1, `VALIDATION.md` section 1)*
- [x] **T-005 [AI]** Create test fixtures: a small SQLite file (one table with a BLOB column, one with no primary key, one `WITHOUT ROWID` table), small CSV / TSV / JSON / JSONL / XLSX files, and a script that generates large CSV and SQLite files. Also add fixtures for the edge cases listed in `VALIDATION.md` section 5 (corrupt, empty, BOM, 64-bit integers, awkward names, and so on). Large files are git-ignored. You run the generator script locally. *(Inventory and runtime recipes: `test/fixtures/manifest.json`, `test/fixtures/README.md`; tooling: PLAN section 1.)*
- [x] **T-007 [AI+H]** CI: the AI writes `.github/workflows/ci.yml` and workflow contract tests. Run `npm ci` and `npm run verify:full` (strict checks, lint, unit tests, builds, VSIX packaging, extension integration tests and runtime-log checks) on Windows, macOS, and Linux; use an isolated D-Bus session and xvfb on Linux. All three jobs report results even if one fails. You push the committed changes and provide the Actions run URL, commit SHA, and green conclusions for all three jobs; paste any failing step logs back to the AI. Keep this checkbox open until that evidence passes. **Approved clarification:** full integration coverage on all three platforms, matching `VALIDATION.md` section 1; local workflow tests alone do not prove CI success. *(Passed run/SHA/job evidence recorded above.)*
- [ ] **T-002 [AI+H]** Spike: the extension host launches a helper with its bundled runtime, with `node:sqlite` inside a `worker_threads` worker. Open/query read-only; cancel executing SQL by killing the helper and confirming its exit within 1,000 ms, then reopen/query successfully. **Owner-approved revision:** terminating a worker alone waited for native SQLite execution; use the helper/worker design (PLAN D-3, SPEC FR-015). You test by hand on your operating system; fresh CI covers the others. Record tested VS Code/runtime versions, document the supported minimum, and verify real sql.js fallback when the built-in module is unavailable. Not a go/no-go gate. *(NFR-002, NFR-005, FR-015, R-2)*
- [ ] **T-004 [AI+H]** Spike: the AI writes a script that streams a 1 GB generated CSV into an on-disk SQLite file with batched inserts. You run it and paste back the time and peak memory. Decide whether the targets in NFR-003 and NFR-004 are realistic. *(FR-004, R-1)*
- [ ] **T-008 [AI+H]** Spike: render a CodeMirror 6 editor and a virtualized grid in a webview. You open it with F5 and judge whether scrolling feels smooth. Confirm or change the editor choice. *(Plan section 1)*
- [ ] **T-051 [AI]** Spec tools: `npm run ctx -- <TASK-ID>` prints the task line, the full text of the FR / NFR requirements it links to, and the Constitution, ready to paste into a fresh AI chat. `npm run trace` lists every requirement ID that has no test whose name starts with that ID. Plain Node scripts, no new dependencies. *(`CONTEXT.md`, `VALIDATION.md` layer 2)*
- [ ] **T-050 [AI+H]** Dependency check: list the license of every dependency and run `npm audit`; check SheetJS's current install guidance. You review the list and decide. *(D-4)*

**Gate (see `VALIDATION.md` section 4):** T-002 and T-004 results are written into `PLAN.md`, `npm run verify:full` is green locally and in CI, and the milestone checklist is complete. Then tag, close the chat, and start Milestone 1 in a fresh one (`CONTEXT.md` section 5).

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
