# Project Operating Instructions (`AGENTS.md`)
> **Notice:** This project inherits user persona, confirmation gates, and documentation blueprints from the global master `AGENTS.md`. Do not duplicate those rules here.

## 1. Project Tech Stack & Environment
* **Domain / Goal:** Cross-platform Personal Finance & Money Manager with Realbyte parity, Sanchaypatra (Bangladeshi government savings certificates) profit tracking, and free Google Drive / Mega SQLite syncing.
* **Target Platforms:** Windows PC (Tauri 2 + Vue 3 / TS portable desktop) and Android Phone (Realbyte mobile anchor).
* **Storage Engine:** SQLite (`money_android.sqlite`, local-first, WAL mode).
* **Primary Framework:** Tauri 2 + Vue 3 + TypeScript + Tailwind CSS (borrowing Actual Budget's TypeScript rule & import engines).

## 2. Mandatory Verification & Build Commands
* **Logic & Math Test Suite:** `npm test` (verifies Sanchaypatra slab math, calendar aggregation, and Realbyte schema validation).
* **Code Lint & Static Analysis:** `npm run lint` or `npm run typecheck`.
* **Desktop Portable Build:** `npm run tauri build` (or tag-triggered GitHub Actions cloud build).

## 3. Repository Directory Structure & Conventions
* `docs/` — Core documentation suite (`PRODUCT.md`, `ARCHITECTURE.md`, `DECISIONS_AND_TRAPS.md`).
* `src/` — Modular source files (or candidate component wrappers).
* `Wealth-Apps/` — Cloned reference repositories and architectural exploration targets.

## 4. Repository-Specific Engineering Traps
* **TRAP 1 (No Flat Index Docs):** Do not create `INDEX.md` or `00-INDEX.md`. All documentation lives in `docs/` using self-descriptive slug headers (`### [TYPE: ...] | Aliases: ...`) and mandatory 1-line summaries.
* **TRAP 2 (Sanchaypatra Slab Integrity):** Always apply tiered interest slabs and mandatory Advance Income Tax (AIT) withholding when calculating savings certificate profit schedules.
* **TRAP 3 (Atomic SQLite Concurrency):** Ensure Write-Ahead Logging (`WAL`) is enabled on all SQLite database connections to prevent database lock corruption during cross-device syncing.
