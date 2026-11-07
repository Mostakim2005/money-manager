# 04 — Approach Options: ready-made vs customize vs build

> Parent: `00-INDEX.md`. Last updated: 2026-10-19.
> Your constraints: (a) everything a normal money manager offers, (b) bond/wealth tracking with invested amount,
> realized & **expected** returns, adjustable, (c) prioritize **customizable open source**, (d) double-entry
> either built-in or as a separate learning tool, (e) two best-in-class separate apps are acceptable.

## Option A — Ready-made pair (no coding) — *lowest effort, ships today*

**Stack: Money Manager EX (or Firefly III / GnuCash) + Portfolio Performance (+ optional Actual/GnuCash for double-entry practice).**

- PP handles all of 02-Tier0 T0.3/T0.4 correctly (TWR/IRR, coupons as transactions, bond as manual security).
- Money side: MMEX (offline desktop twin of your mobile app) or Firefly III (rules + importer powerhouse).
- Cons: third app stack if you add double-entry; no "expected return" projection; no single unified net-worth report across both.
- Customizability: low (accept as-is). This is the "ready-made fallback" path.

## Option B — Fork/customize Wealthfolio — *one app, modern stack, best extension base* ⭐ flagged

- Already: Windows desktop (Tauri/JS stack), local-first, holdings + performance + goals + **spending** + simulations.
- Add: bond/coupon model + expected-return projection + (optional) double-entry flagging of cash movements.
- Effort: medium (JS/TS app, extension points: data-provider + goal/simulation modules).
- Extras: iOS app; self-hosted mode ⇒ mobile capture solved without Android-native work.
- Risk: AGPL ⇒ proper sharing if forked; volatile young project.

## Option C — Docker duo, heavily scriptable: Firefly III + Ghostfolio

- Firefly III = money manager core (rules, imports, multi-currency) + Ghostfolio = wealth dashboard.
- Both expose clean REST APIs ⇒ a tiny local script can feed bond coupons into Ghostfolio and expenses into Firefly, and**sketch** a unified net-worth page yourself.
- Cons: web-based workflow (browser, Docker maintenance); Ghostfolio bonds still limited; 2 servers to run.
- Customizability: high (both AGPL, clean code, active).

## Option D — Plain-text double-entry core: Beancount/hledger + Fava (+ PP for analytics)

- One `.beancount` file = single source of truth; bonds, coupons, amortization modeled exactly, unlimited reports via Python (this IS the accounting course).
- PP optional on top only for market-price auto-quote + charts, reading the same data via CSV import.
- Effort: highest data-entry discipline; zero app-building.

## Option E — Build from scratch (worst case) — *full control*

- Recommended stack: **Tauri 2 (Rust shell) + React/TS UI + SQLite** — small Windows footprint, easy local-file privacy, Android export possible later via the same core (tauri-mobile).
- Data model: double entry at core (accounts, journal lines); a **Bond security** table (face value, coupon rate, frequency, maturity), a projection engine (YTM/accrued/planned return), CSV import, budgets/reports modules.
- Realistic effort: ≈ 3–6 months part-time for version 1; much of the design is already covered by trying Option B first.

## Comparison

| Path | Time to usable | Composite: money+wealth in 1 tool | Bonds/expected-return | Double-entry | Your effort |
|------|----------------|-----------------------------------|-----------------------|--------------|-------------|
| A ready-made pair | 0 days (install) | ❌ 2 apps | ⚠️ manual, TWR/IRR exact | via GnuCash side-app | minimal |
| **B fork Wealthfolio** | 1–2 weeks custom | ✅ | ⚠️ custom module | ❌ (add-only report view) | medium |
| C Docker duo | 2–3 days setup | ⚠️ combined page via small script | ⚠️ | ⚠️ Firefly ledger-ish | low-med |
| D plain-text | 3–7 days | ✅ (with effort on charts) | ✅ modeled by YOU | ✅ core | ongoing discipline |
| E build | 1–3+ months | ✅ by design | ✅ by design | ✅ by design | highest |

## Recommendation (maximizes constraint priority order)

1. **Adopt Option B as the main project**: fork **Wealthfolio**; add the bond/coupon + expected-return module; optionally surface a double-entry-style journal view for cash ledgers. Ship value after ~2 weeks of modifications.
2. **Meanwhile run Portfolio Performance today** as your accuracy anchor for bonds/returns — you lose nothing while building.
3. **Keep GnuCash or Beancount as a side ledger** purely as your accounting-learning track (per 03) — audit your main ledger against it weekly.
4. Re-evaluate Option E only if Wealthfolio's architecture fights you (e.g., no clean data layer for bond schedules).

## Next steps

1. Confirm chosen path(s) → write at `05-Decision.md`.
2. Spin up Wealthfolio locally + PP; import 1 month of data; validate a government bond manually priced + coupon.
3. If fork work begins → create `07-Bond-Tracker-Spec/07.1-Data-Model.md` (bond tables, coupon schedule, YTM/expected-return formulas).
