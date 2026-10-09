# Lite Voyager: instructions for AI assistants

Lite Voyager is a VS Code extension (TypeScript) that opens SQLite, CSV, JSON and XLSX files of any size, and lets users browse and query them with SQL. It opens as an editor tab, with the UI in a webview.

## Read first, every session
1. `specs/CONSTITUTION.md` (short, non-negotiable rules)
2. `PROGRESS.md` (where we left off)
3. Only the parts of `specs/SPEC.md` and `specs/PLAN.md` that the current task links to. Do not read or rewrite everything.

## How we work
- Work on exactly ONE task from `specs/TASKS.md`. No other tasks, no unrelated refactors, no "while I'm here" changes.
- Tasks tagged **[H]** are human-only (accounts, GitHub or Marketplace websites, interactive generators). Do not attempt them. Tell me the steps instead.
- Tasks tagged **[AI+H]**: you write the code and tests, then tell me the exact commands to run and what output to paste back.
- Before coding, restate the task and its acceptance criteria in your own words and list the files you will create or change. Wait for my OK.
- Write the test first, from the acceptance criteria (Given / When / Then), then the code.
- If you cannot run commands, say so. Give me the exact command and ask me to paste the output. Never claim something works unless I have shown you it passing.
- If the spec is unclear or seems wrong, stop and propose a change to the spec. Do not silently work around it.

## Validation (see `specs/VALIDATION.md`)
- Before saying a task is done, run `npm run verify` (or ask me to run it and paste the output). Zero errors and zero warnings. For `verify:full`, the only owner-approved host exceptions are the two exact renderer diagnostic families in `specs/VALIDATION.md` section 1; report each explicitly and never describe a run containing them as warning-free. Every other warning and every error fails.
- Never skip, weaken, or delete a test to make it pass. Never use `any`, `@ts-ignore`, or lint disables without a written reason.
- Test names start with the requirement ID, for example `FR-002: shows NULL differently from empty string`.
- When fixing a bug, write a failing test first.
- Cover the edge cases in `VALIDATION.md` section 5 when they apply to the task.

## Context hygiene (see `specs/CONTEXT.md`)
- One task per chat. If this chat is getting long, you start repeating yourself, or you notice you are forgetting rules, tell me and offer the session-end summary so I can start a fresh chat.
- Rely only on files and text I have pasted. Do not assume what other files contain.

## Do not guess
- Never invent APIs, package names, option names or version numbers. This matters most for the VS Code API, `node:sqlite`, CodeMirror 6, and SheetJS. If unsure, say "I'm not sure" and ask me to paste the official docs.
- Do not add a dependency unless `specs/PLAN.md` names it or I approve it. Say what it is, why, and its license.

## Stack and style
- TypeScript in strict mode. No `any`. Small functions. Clear names.
- Database engine: `node:sqlite` inside a `worker_threads` worker; `sql.js` as a fallback. Both sit behind one `Engine` interface.
- Webview UI: CodeMirror 6 for the SQL editor, a virtualized grid for results. Host and webview talk only through the typed messages in `src/protocol.ts`.
- Build with esbuild. Test with Vitest (logic) and `@vscode/test-electron` (integration).

## Hard rules (from the Constitution)
- Never modify a user's file except on an explicit save. Saves are atomic.
- No network calls. No telemetry.
- Never block the main thread. Heavy work runs in the worker. Results are paged; never send a whole table to the webview.
- Never concatenate user data into SQL. Always quote identifiers and use parameters.
- SQLite integers are 64-bit: never let them be rounded by JavaScript numbers. Display them exactly.
- Do not silently truncate or drop data. If a limit applies, show a message.
- BLOB cells show a placeholder like `[BLOB 24 KB]` only. No hex viewer in v1.
- Stay lite: fewer features, done well.

## When you reply
- List every file you changed or created.
- Give the commands to run the tests.
- Say which acceptance criteria are covered and which are not.
- At the end of a session, produce an updated `PROGRESS.md` (see its format) and say which checkbox in `specs/TASKS.md` may be ticked, only if the acceptance criteria pass.
