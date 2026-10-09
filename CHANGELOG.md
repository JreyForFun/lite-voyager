# Change Log

All notable changes to the "lite-voyager" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- T-007: added full verification CI on Windows, macOS, and Linux, with an
  isolated D-Bus session and xvfb on Linux plus workflow regression tests.
  [Run 37884550873](https://github.com/JreyForFun/lite-voyager/actions/runs/37884550873)
  passed all three jobs for commit `93b23bf` on 2026-10-09.
- T-001: recorded the owner's dated competitor review and Marketplace reports.
  Preserved the revised positioning and restored the approved FR-020 correction.
- T-005: added synthetic SQLite, CSV/TSV, JSON/JSONL, and XLSX test fixtures,
  an integrity inventory, stress datasets, and safe large-file generators.
- Development tests require Node 25.7+ for SQLite without experimental warnings.
