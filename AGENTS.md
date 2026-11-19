# Project Operating Instructions (`AGENTS.md`)
> **Notice:** This project inherits user persona, confirmation gates, and documentation blueprints from the global master `AGENTS.md`. Do not duplicate those rules here.

## 1. Project Tech Stack & Environment
* **Domain / Goal:** Cross-platform Personal Finance & Money Manager with Realbyte parity, Sanchaypatra (Bangladeshi government savings certificates) profit tracking, and free Google Drive / Mega SQLite + Local Wi-Fi PC Manager syncing.
* **Target Platforms:** Windows PC (Electron + Vue 3 / TS + `better-sqlite3` portable desktop) and Android Phone (Realbyte mobile anchor via PC Manager port 10000 & SQLite backups).
* **Storage Engine:** SQLite (`money_manager.sqlite` & `money_android.sqlite`, local-first, WAL mode, whole-Taka integer rounding).
* **Primary Framework:** Electron + Vue 3 + TypeScript + Tailwind CSS (borrowing Actual Budget's TypeScript rule & import engines).

## 2. Mandatory Verification & Build Commands
* **Logic & Math Test Suite:** `npm test` (verifies Sanchaypatra cumulative slab math, calendar aggregation, and Realbyte multiset sync reconciliation).
* **Code Lint & Static Analysis:** `npm run lint` or `npm run typecheck`.
* **Desktop Portable Build:** `npm run electron:build` (or tag-triggered GitHub Actions cloud build).

## 3. Repository Directory Structure & Conventions
* `docs/` — Core documentation suite (`PRODUCT.md`, `ARCHITECTURE.md`, `DECISIONS_AND_TRAPS.md`).
* `shared/` — Canonical SQLite schema (`v1_core.sql`), Sanchaypatra constants, and cross-platform golden test vectors (`shared/test-vectors/*.json`).
* `src/` — Modular Vue 3 + TypeScript source files and domain engines.
* `electron/` — Electron Main process (`main.ts`), Preload bridge (`preload.ts`), `better-sqlite3` WAL database service, and CORS-free Realbyte HTTP proxy.

## 4. Repository-Specific Engineering Traps
* **TRAP 1 (No Flat Index Docs):** Do not create `INDEX.md` or `00-INDEX.md`. All documentation lives in `docs/` using self-descriptive slug headers (`### [TYPE: ...] | Aliases: ...`) and mandatory 1-line summaries.
* **TRAP 2 (Sanchaypatra Cumulative Slab Integrity):** Always offset slab brackets by existing cumulative Sanchaypatra holdings (`existingHoldingsBDT`) and apply mandatory Advance Income Tax (AIT) withholding when calculating savings certificate profit schedules.
* **TRAP 3 (Atomic SQLite Concurrency & Whole-Taka Precision):** Ensure Write-Ahead Logging (`WAL`) is enabled on all SQLite database connections, round all BDT amounts to whole Taka integers (`roundTaka`), and recompute sync fingerprints after foreign-key remapping to prevent duplicates or balance double-counting.
