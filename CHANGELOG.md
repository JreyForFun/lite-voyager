# Change Log

All notable changes to the "lite-voyager" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- T-010 repair: offer Lite Voyager in **Reopen Editor With** for saved local
  files with any name. Keep defaults for the four SQLite extensions, preserve
  other file types' normal editors and respect explicit user associations.
  Added a failing registration regression and real-host default/override tests;
  the earlier direct Open With test bypassed picker eligibility.

- T-010: added a read-only binary custom editor, default SQLite extension
  associations, worker-backed header/database validation, opening/error states,
  persistent fallback notices and large-file consent, cancellation and helper
  cleanup. Explicit Open With also validates local files with other extensions.
  Added tests for source safety and editor lifecycle. No dependency was added;
  table browsing and production first-row performance remain later tasks.
  Red-first lifecycle repairs make document disposal idempotent and wait for
  confirmed helper cleanup before opening completion after cancellation.

- T-009: added the production asynchronous Engine boundary, native/sql.js worker
  backends, bounded result pages, confirmed helper cancellation/reopening,
  persistent fallback notices, and consent before loading files above decimal
  200 MB. The permanent `LITE_VOYAGER_FORCE_FALLBACK=1` hook exercises fallback.
  Engine Check demonstrates the UX before the custom editor is implemented.
  Fallback rejects changed and WAL/journal snapshots explicitly. Assets remain
  local and packaged; no dependency was added. Production browsing/performance
  acceptance follows in later tasks.
  Red-first repairs preserve sqliteX tables, coalesce repeated cancellation,
  and restrict EXPLAIN to read queries so preparation-time PRAGMAs cannot alter
  safety settings.
  Test launches isolate inherited VS Code startup/cache paths; all diagnostic
  checks and the two exact approved host exceptions remain unchanged.
  CI follow-up: select the dot reporter explicitly so slow passing test names
  containing "error" do not trigger the diagnostic gate. Real console warnings
  and errors stay visible in both CI and agent environments; the gate still
  rejects them and failed assertions.
  Follow-up: normalize terminal formatting only for diagnostic matching, so
  colored CI output cannot hide warnings/errors. Original console output is
  preserved. Regressions explicitly cover color on/off and segmented formatting.
  T-009 is complete: local verification and fresh Windows/macOS/Ubuntu full
  [CI](https://github.com/JreyForFun/lite-voyager/actions/runs/38018867617) pass
  for repaired candidate 7114b62. Later browsing/performance/manual QA stays open.

- T-052: foundation review repairs reject malformed CSV text after a closing
  quote instead of silently discarding it, and allow immediate SQLite spike
  recovery after a worker crash while confirming the old helper has exited.
  Added foundation requirement-coverage checks and corrected cancellation/
  fallback-safety test prefixes. Local full verification and final three-platform
  [CI](https://github.com/JreyForFun/lite-voyager/actions/runs/37962951570) pass on
  adjusted-fixture candidate 6b2d665. Milestone 0 is complete with local foundation
  checkpoint v0.0.1; production features follow in Milestone 1.
  Follow-up: preserve the large quoted-header regression and its original
  timeout while reducing redundant tiny filesystem reads; explicitly assert
  that its input still spans read chunks.

- T-008: added an experimental CodeMirror SQL editor and virtualized synthetic
  ten-million-row grid. Page requests contain 128 rows; the webview caches at
  most four pages and renders the viewport plus six overscan rows on each side.
  A bounded scroll track supports the entire row range, with wheel, keyboard
  and explicit row jumps. Assets and MIT dependency notices are packaged locally.
  Owner manual QA passes in VS Code 1.141.0, with 512 cached and about 20–23
  rendered rows; CodeMirror 6 is confirmed. T-008 is complete at commit 8fed6f0;
  the owner reports pushing. The foundation milestone remains open.

- T-002: added SQLite worker/fallback spike commands with a killable helper,
  typed messages, bounded read-only results, and packaged MIT sql.js 1.14.2
  assets. Confirmed cancellation within one second, reopening, exact integers,
  and source-byte safety locally in VS Code 1.140.0 and 1.141.0. Supported
  minimum is the lowest tested host, 1.140.0. Owner manual QA and fresh Windows,
  macOS, and Linux CI pass for the initial implementation. Fixed review findings
  with red-first regressions: fallback explicitly rejects WAL/journal snapshots
  and observed concurrent file changes; statements are freed on every sql.js
  result path. Corrected complete-page 256 KiB accounting with boundary tests.
  Independent follow-up review found no remaining concrete defect. Local full
  verification passes (103 unit / six integration tests), and [fresh CI](https://github.com/JreyForFun/lite-voyager/actions/runs/37922970386)
  passes on Windows, macOS, and Linux for the review fixes. T-002 is complete.
  Compiler-contract fixtures share one setup program, retaining their full
  libraries, compiler settings, diagnostic checks, and assertions.

- T-007: added full verification CI on Windows, macOS, and Linux, with an
  isolated D-Bus session and xvfb on Linux plus workflow regression tests.
  [Run 37884550873](https://github.com/JreyForFun/lite-voyager/actions/runs/37884550873)
  passed all three jobs for commit `93b23bf` on 2026-10-09.
- T-001: recorded the owner's dated competitor review and Marketplace reports.
  Preserved the revised positioning and restored the approved FR-020 correction.
- T-005: added synthetic SQLite, CSV/TSV, JSON/JSONL, and XLSX test fixtures,
  an integrity inventory, stress datasets, and safe large-file generators.
- Development tests require Node 25.7+ for SQLite without experimental warnings.
