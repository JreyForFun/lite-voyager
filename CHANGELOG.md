# Change Log

All notable changes to the "lite-voyager" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- T-008: added an experimental CodeMirror SQL editor and virtualized synthetic
  ten-million-row grid. Page requests contain 128 rows; the webview caches at
  most four pages and renders the viewport plus six overscan rows on each side.
  A bounded scroll track supports the entire row range, with wheel, keyboard
  and explicit row jumps. Assets and MIT dependency notices are packaged locally.
  Owner manual QA passes in VS Code 1.141.0, with 512 cached and about 20–23
  rendered rows; CodeMirror 6 is confirmed. The owner task commit remains pending.

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
