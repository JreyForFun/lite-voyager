# Change Log

All notable changes to the "lite-voyager" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- T-007: run Linux CI inside an isolated D-Bus session as well as xvfb after
  Electron connection errors failed the initial Ubuntu run. Added a regression
  test; fresh Linux CI evidence is pending.
- T-001: recorded the owner's dated competitor review and Marketplace reports.
  Preserved the revised positioning and restored the approved FR-020 correction.
- T-007: added full verification CI for Windows, macOS, and Linux (with xvfb),
  workflow contract tests, and instructions for supplying remote run evidence.
  Three-platform CI execution remains pending.
- T-005: added synthetic SQLite, CSV/TSV, JSON/JSONL, and XLSX test fixtures,
  an integrity inventory, stress datasets, and safe large-file generators.
- Development tests require Node 25.7+ for SQLite without experimental warnings.
