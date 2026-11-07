# 01 — Apps Research (money managers, budgets, wealth/portfolio trackers)

> Parent: `00-INDEX.md`. Last updated: 2026-10-19.
> Focus: Windows first, Android where relevant. Open-source + customizable prioritized; ready-made states noted.
> Legend for **Customizability**: ⭐=source available/practical to fork ⭐⭐=meant to be extended/scripted.

## 1. Classic desktop money managers

| App | License | Platforms | Stack | Core features | Investments | Customizability |
|-----|---------|-----------|-------|---------------|-------------|-----------------|
| **Money Manager EX** | GPL | Windows, Linux, macOS, (+Android companion) | C++/wxWidgets, SQLite | Accounts, transactions, categories, budgets, recurring, reports, CSV/QIF import, tagging | Weak — simple "assets" tracker, no returns | ⭐ (mature C++ codebase; forkable but heavy) |
| **GnuCash** | GPL | Windows, Linux, macOS | C/C++, Scheme GUI extensions | Double-entry accounts, budgets, invoices, multi-currency, scheduled txns, reports | Basic — stocks/mutual funds with auto quotes; no returns analytics; bonds manual | ⭐ (Scheme extension hooks exist; core C) |
| **KMyMoney** | GPL | Windows/Linux | Qt/C++ | Clean Quicken-style core, dividends, some investments | Basic–moderate | ⭐ |
| **HomeBank** | GPL | Windows/Linux | C/GTK | Simple accounts, budgets, watches | ❌ | ⭐ |

Notes:
- MMEX is the closest open-source twin to the "Money Manager Expense & Budget" (Realbyte) app you currently use on Android.
- **MMEX Data:** fast, modern, built on Tauri — no official plugin API yet (still under heavy development).
- None of these ship bond analytics (face value, coupon schedule, YTM, accrued interest).

## 2. Self-hosted budgeting apps (scriptable, no investments)

| App | License | Runtime | Strengths | Gaps |
|-----|---------|---------|-----------|------|
| **Firefly III** | AGPL | PHP/Laravel via Docker | Richest transaction engine: rules, recurring, categories/tags, budgets, API, reports; Importer for CSV/OFX | No investment/price tracking; single-entry-flavored ledger |
| **Actual Budget** | MIT (server) / FAIR client | Node, local-first, PWA | Envelope budgeting, fast UI, official desktop/mobile, sync | No investments; single-entry |

## 3. Wealth / portfolio trackers (the bond-relevant category)

| App | License | Platforms | Return math | Bonds | Quotes | Customizability |
|-----|---------|-----------|-------------|-------|--------|-----------------|
| **Portfolio Performance (PP)** | EPL | Windows/Linux/macOS desktop (Java) + Android companion | **TWR + IRR (money-weighted)**, tax, dividends, benchmarks — gold standard | ⚠️ modeled as securities; coupons/maturity entered manually (works well for gov bonds) | ✅ auto quotes incl. many exchange feeds | ⭐ (Java, big codebase; scripting limited) |
| **Ghostfolio** | AGPL | Self-hosted Docker web (Node/TS) | Portfolio/TWR dashboards, X-ray rules (drift, allocation) | ⚠️ limited fixed-income support (known gap) | ✅ | ⭐ (clean TS/SPA, REST API, data-provider abstraction; good fork target) |
| **Wealthfolio 2.0** | AGPL | **Windows desktop** (also macOS/Linux/iOS + self-hosted) | Holdings, goals, simulations, net worth | ⚠️ not yet bond-aware | ✅ | ⭐⭐ (modern JS/TS desktop stack; spending + goals already included — best extension base) |
| **Beancount / Fava** | GPL v2 (Beancount), MIT (Fava) | CLI + web UI | Fully computed via plugins (UFBR; XIRR libs) | ✅ any instrument via custom accounts/contracts | manual/scripted | ⭐⭐⭐ unlimited (Python, plain text) |

## 4. Ready-made (closed) references worth benchmarking — not candidates

- **Quicken Simplifi / Monarch / YNAB** — subscription budgeting with syncing; Windows via web; no real bond analytics.
- **Kubera** — global "everything I own" net-worth box (incl. physical assets); closed, paid.
- **Empower Premium portfolio tools** — best-in-class free tracking but US-feed-bound.
- *Mobile:* Money Manager (Realbyte) — your current daily app; keep as capture-layer if we move storage elsewhere.

## 5. Ranking conclusions

1. **Bond/wealth math, ready-made:** Portfolio Performance — only open-source tool with correct TWR/IRR today.
2. **Best customization base for a merged money+wealth app:** Wealthfolio (JS stack, local-first, has spending & goals; add a bond/data-provider module).
3. **Best double-entry + custom-scripting track:** Beancount/Fava or hledger (see `03-Double-Entry-Options.md`).
4. **Best pure money manager core (ready-made):** Firefly III (feature-richest) or MMEX (works offline, no Docker).
