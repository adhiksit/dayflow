# Changelog

All notable changes to dayflow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-22

### Added

- Task management: add, edit, complete, reopen, delete, list with filtering by date/status/tag/priority
- Time tracking: start/stop/pause/resume timers, manual time logging, crash recovery via persisted timestamps
- Productivity scoring (0-100) with configurable weights and an explainable breakdown
- Daily summaries: tasks done/missed, time per category, top activity, score, and actionable insight
- Weekly summaries: daily score trend with sparkline, best/worst day, peak productivity window, week-over-week comparison
- CLI with commands: add, list, done, reopen, edit, rm, start, stop, pause, resume, status, log, today, week, export, import, config
- Output formats: plain text (colored), JSON, and Markdown
- Programmatic API via `Dayflow` class with typed event emitter
- Pluggable storage adapters: `JsonFileStorageAdapter` (atomic writes) and `MemoryStorageAdapter`
- Cross-platform data directory detection (macOS, Linux, Windows) with `DAYFLOW_DATA_DIR` override
- Dual ESM + CommonJS build via tsup with TypeScript declarations
- Vitest test suite with 53 tests and 85%+ branch coverage
- GitHub Actions CI: Node 18/20/22 on macOS, Linux, Windows
- NO_COLOR and non-TTY support
