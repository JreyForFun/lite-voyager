# Lite Voyager Constitution

These principles outrank every other document. If a requirement, plan, or task conflicts with one of them, the requirement, plan, or task is wrong. Changing this file needs a changelog entry.

1. **Never destroy user data.** Source files are untouched until the user explicitly saves. Saves are atomic (a SQLite transaction, or write-to-temp-then-rename for text formats). Nothing is changed silently.
2. **No artificial size limits.** On the primary (disk-backed) engine, any file can be opened. Memory use stays bounded no matter how big the file is; the real limit is disk space and patience. Long operations show progress and can be cancelled. The memory-limited fallback engine (see `PLAN.md` D-3) is the only exception, and it must say so (principle 6).
3. **Local and private.** No network calls and no telemetry in v1.
4. **Zero setup.** Nothing to install besides the extension: no native binaries, no external CLI. Works on Windows, macOS, and Linux.
5. **The UI never freezes.** Heavy work runs off the main thread. Grids are virtualized. Results are paged, never dumped whole into the webview.
6. **Honest limits.** If a format has a real limitation (for example, Excel files must be read into memory), say so before the user hits it. Never truncate or drop data silently.
7. **Spec first, test first.** Behavior is written down in `SPEC.md` with acceptance criteria before code is written, and every requirement gets a test. Nothing is "done" without evidence: command output you have seen (`VALIDATION.md`).
8. **Stay lite.** Do a few things very well. Finish Milestones 1 and 2 before starting Milestones 3 and 4. A new feature must earn its place; "DB Browser has it" is not a reason.

## Changelog
- v0.3: Principle 7 now requires evidence for "done".
- v0.2: Renamed to Lite Voyager. Added principle 8 (stay lite) and the fallback-engine exception to principle 2.
- v0.1: Initial version.
