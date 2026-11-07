# 05 — Forkability Scorecard (4 candidate repositories)

> Parent: `00-INDEX.md`. Created 2026-10-19 after cloning all four repos into `Wealth-Apps\` (see catalog). `05-Decision.md` slot re-reserved as `06-Decision.md`.
> Decision context: user targets a **conventional money manager** (daily calendar, monthly totals, account types, statistics, amount/category/account/note, custom income sources), local data, portable-first testing, later installer distribution; LLM-based coding (Claude/GPT/Gemini friendly code).

## Scorecard (weights in header; each axis 1–5, 5 = best)

| Axis (weight) | Firefly III (PHP/Laravel) | MMEX (C++/wxWidgets) | KMyMoney (C++/Qt6/KF6) | Wealthfolio (TS/React + Rust/Tauri) |
|---|---|---|---|---|
| **Language match — LLM-friendly, low-friction (×2)** | 5 (Laravel; huge corpus) | 3 (C++ verbose but very regular/generated) | 2 (C++ + KDE/Qt/ECM landscape) | 4 (TS easy; Rust harder) |
| **Extensibility points (×2)** | 4 (API-first: route→request→repo→factory→transformer; e-add hooks) | 4 (generated model layer + custom fields + Lua general-reports) | 3 (plugin interfaces; core edits need Qt MVC) | 5 (addon SDK is first-class, documented v3.7) |
| **Repo health / release cadence** | 5 (very active, frequent releases) | 4 (active; 1.9.5 May 2026) | 3 (stable cadence: 5.2.2 Feb 2026; slower) | 4 (fast-moving 3.x line, young) |
| **Docs / onboarding quality** | 4 (official docs repo + our doc\ set) | 3 (handbook + code regularity) | 3 (handbook + wiki) | 5 (in-repo docs/architecture outstanding) |
| **Your listed feature coverage (calendar, monthly totals, acct types, stats, category/account/note, custom sources)** | 3 (all except daily calendar widget; add-able) | **5** (matches list out-of-the-box) | 4 (all except daily calendar; add-able; investments strong) | 2 (spending OK, calendar absent, no full conventional core) |
| **Local-first data + portable-exe bundling ease** | 3 (needs PHP runtime bundle; doable) | **4** (native exe/portable out of box) | 2 (heavy deps; nightly-only Windows installer) | 5 (Tauri = single exe) |
| **Wealth/investment readiness for phase 2** | 1 (none) | 3 (stocks/assets basic) | 4 (securities/prices/loan math) | 5 (TWR/MWR engine) |
| **Total (out of 35, weighted feel)** | 25 (approx) | **26 (approx — winner for phase 1)** | 21 | **24 — winner for phase 2 wealth** |

Weighted shading: MMEX wins **earnest conventional coverage + portable**; Firefly wins if you accept browser UI (highest raw data-integrity design + importer stack); Wealthfolio wins wealth-only.

## At-a-glance decision logic (what follows is advice pending `06-Decision.md` pilot)
- **Phase 1 (money manager, use it tomorrow):** MMEX — run `installers\mmex-1.9.4-win64-portable.zip`/exe; SQLite `.mmb` data; fork later for calendar view + any gaps. Note v1.9.4 date-filter balance bug (#8509).
- **Phase 1 alternative if browser UI acceptable:** Firefly III portable bundle (PHP+SQLite+launcher) — heavier runtime, richer web UI, best importers/rules/reports.
- **Phase 2 ()wealth: bonds/YTM/expected return):** Wealthfolio fork (bond facts + projection in portfolio-engine) OR MMEX fork using assets/stocks/custom-fields + General-Reports as long as analytics stay simple.
- **KMyMoney:** keep as reference only — `mymoney\mymoneyaccountloan.cpp` amortization engine + `misc\knetvaluewidget` are the best code references for bond math; don't adopt as base (build cost).

## Depth-of-docs map (already written for all 4)
| Repo | doc\ set |
|---|---|
| `Wealth-Apps\firefly-iii\` | doc\00–06 ✅ (+ official docs clone `firefly-iii-docs\`) |
| `Wealth-Apps\wealthfolio\` | doc\00–06 ✅ |
| `Wealth-Apps\moneymanagerex\` | doc\00–06 ✅ |
| `Wealth-Apps\kmymoney\` | doc\00–06 ✅ |

## Open pilot TODOs (moved from 04-Approach-Options next steps)
1. Run MMEX portable with an empty DB → exercise your listed features against real bank CSV import.
2. Decide fork base in `06-Decision.md` with the one-day feature spike (add "monthly totals"×"source" field).
3. Phase-2 bond spec → `07-Bond-Tracker-Spec\07.1-Data-Model.md` (columns: ISIN, issuer, face value, coupon rate, frequency, maturity, price basis) — engine math borrowed from KMyMoney loan code / Wealthfolio projection module.
