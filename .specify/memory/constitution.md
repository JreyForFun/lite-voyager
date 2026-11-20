# Lite Voyager Constitution

## Core Principles

### I. Never Destroy User Data

Source files MUST stay untouched until the user explicitly saves. Saves MUST be atomic (a
SQLite transaction, or write-to-temp-then-rename for text formats). Nothing is changed silently.

### II. No Artificial Size Limits

On the primary (disk-backed) engine, any file MUST be openable. Memory use MUST stay bounded
regardless of file size; the real limit is disk space and patience. Long operations MUST show
progress and be cancellable. The memory-limited fallback engine (`specs/PLAN.md` D-3) is the only
exception, and it MUST say so (Principle VI).

### III. Local and Private

No network calls and no telemetry in v1.

### IV. Zero Setup

Nothing to install besides the extension: no native binaries, no external CLI. MUST work on
Windows, macOS and Linux.

### V. The UI Never Freezes

Heavy work MUST run off the main thread. Grids MUST be virtualized. Results MUST be paged, never
sent whole to the webview.

### VI. Honest Limits

If a format has a real limitation (for example, Excel files must be read into memory), the user
MUST be told before hitting it. Data MUST never be truncated or dropped silently.

### VII. Spec First, Test First

Behavior MUST be written down in `specs/SPEC.md` with acceptance criteria before code is written,
and every requirement MUST have a test. Nothing is "done" without evidence: command output that
has been seen (`specs/VALIDATION.md`).

### VIII. Stay Lite

Do a few things very well. Milestones 1 and 2 MUST be finished before Milestones 3 and 4. A new
feature must earn its place; "DB Browser has it" is not a reason.

## Technical Constraints

- TypeScript strict mode; no `any`, `@ts-ignore` or lint disables without a written reason.
- Database engine: `node:sqlite` in a `worker_threads` worker, `sql.js` fallback, both behind one
  `Engine` interface.
- Host and webview communicate only through typed messages in `src/protocol.ts`.
- User data is never concatenated into SQL: identifiers are quoted and values are parameters.
- SQLite 64-bit integers MUST be displayed exactly, never rounded through JavaScript numbers.
- BLOB cells show a placeholder such as `[BLOB 24 KB]` only.
- No dependency is added unless `specs/PLAN.md` names it or the owner approves it.

## Development Workflow and Quality Gates

- Work proceeds one task from `specs/TASKS.md` at a time; [H] tasks are human-only.
- Tests are written first from Given/When/Then acceptance criteria; test names start with the
  requirement ID (for example `FR-002: ...`). Bug fixes start with a failing test.
- A task is done only when `npm run verify` passes with zero errors and zero warnings, and, where
  required, `npm run verify:full` passes under the exceptions listed in `specs/VALIDATION.md`
  section 1. Tests are never skipped, weakened or deleted to pass.

## Governance

`specs/CONSTITUTION.md` is the authoritative constitution; this file is its Spec Kit mirror so
that `/speckit-*` commands can check work against it. If the two ever differ,
`specs/CONSTITUTION.md` wins. Amendments are made there first, with a changelog entry, and this
mirror is then updated with a matching version. Every Spec Kit plan MUST pass a constitution check
against Principles I–VIII before implementation.

**Version**: 0.3.0 | **Ratified**: 2026-10-08 | **Last Amended**: 2026-11-20
