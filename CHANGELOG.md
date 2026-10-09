# Change Log

All notable changes to the "lite-voyager" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- T-002: added SQLite worker/fallback spike commands with a killable helper,
  typed messages, bounded read-only results, and packaged MIT sql.js 1.14.2
  assets. Confirmed cancellation within one second, reopening, exact integers,
  and source-byte safety locally in VS Code 1.140.0 and 1.141.0. Supported
  minimum is the lowest tested host, 1.140.0. Manual QA and fresh CI are pending.
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
