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

- [ ] **T-000 [H]** Create a **new** GitHub repository named `lite-voyager` (not a fork) with an MIT license and a Node `.gitignore`. Clone it. Add a README stub that credits filesql. Copy in this `specs/` folder plus `AGENTS.md` and `PROGRESS.md`, and commit them as the first commit.
- [ ] **T-001 [H]** Check that "Lite Voyager" is free on the VS Code Marketplace and create your publisher account. Re-verify the competitor table in `SPEC.md` (install counts and features change). *(D-1)*
- [ ] **T-003 [H]** Run the extension generator yourself, because it is interactive: `npm install -g yo generator-code`, then `yo code`. Choose New Extension (TypeScript) with esbuild. If it creates a subfolder, move its contents to the repo root. Press F5 and confirm the "Hello World" command works. Commit.

## Milestone 0B: Foundation and risk spikes (mostly AI, with you running things)
Goal: set up tooling and prove the risky technical bets before building features.

- [ ] **T-006 [AI]** Configure the scaffolded project: strict TypeScript, lint, esbuild bundles for host and webview, Vitest, a `protocol.ts` skeleton, and a `.vscode/launch.json` for F5. Define two scripts: `npm run verify` (typecheck, lint, unit tests, build, `.vsix` package dry run) and `npm run verify:full` (the same plus integration tests in a real VS Code). Treat warnings as failures. Do not add dependencies beyond those named in `PLAN.md` without asking. *(Plan section 1, `VALIDATION.md` section 1)*
- [ ] **T-005 [AI]** Create test fixtures: a small SQLite file (one table with a BLOB column, one with no primary key, one `WITHOUT ROWID` table), small CSV / TSV / JSON / JSONL / XLSX files, and a script that generates large CSV and SQLite files. Also add fixtures for the edge cases listed in `VALIDATION.md` section 5 (corrupt, empty, BOM, 64-bit integers, awkward names, and so on). Large files are git-ignored. You run the generator script locally.
- [ ] **T-007 [AI+H]** CI: the AI writes `.github/workflows/ci.yml` (lint and unit tests on Windows, macOS, Linux; extension integration tests on Linux using xvfb). You commit and push, check the Actions tab is green, and paste any failures back to the AI.
- [ ] **T-002 [AI+H]** Spike: run `node:sqlite` inside a `worker_threads` worker in the extension host. Open a SQLite file, run a query, terminate the worker to cancel. You test by hand on your own operating system; CI covers the others. Record which VS Code versions have `node:sqlite`, set the documented minimum version, and confirm the sql.js fallback triggers when `node:sqlite` is unavailable. Not a go/no-go gate (see `PLAN.md` D-3). *(NFR-002, R-2)*
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
- v0.6: Added verify scripts (T-006), edge-case fixtures (T-005), spec tools (T-051), fallback test hook (T-009), milestone gates, and the fresh-chat working loop.
- v0.5: Split Milestone 0 into human setup (0A) and AI work (0B); added owner tags. Moved CI to T-007, license audit to T-050, webview spike to T-008, project config to T-006.
- v0.4: Added T-000 (repo setup), T-017, T-018, T-070.
- v0.3: Renamed to Lite Voyager. T-002 is no longer a gate; added T-009 (Engine interface and fallback).
- v0.2: Added Milestone 0 spikes, any-size tasks, and open-behavior tasks.
- v0.1: Initial draft.
