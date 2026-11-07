# 02 — Master Feature List (typing: what exists where)

> Parent: `00-INDEX.md`. Last updated: 2026-10-19.
> **Tier 0 = must-have (your stated needs). Tier 1 = standard money-manager expectations. Tier 2 = differentiator/extra.**
> ✅ solid · ⚠️ partial/manual · ❌ absent

## Tier 0 — Your must-haves

| # | Feature | Money managers (MMEX/GnuCash/Firefly/Actual) | Wealth trackers (PP/Ghostfolio/Wealthfolio) | Notes on your bond goal |
|---|---------|----------------------------------------------|---------------------------------------------|--------------------------|
| T0.1 | Accounts & balance overview | ✅ | ✅ | — |
| T0.2 | Income/expense/transfer transactions | ✅ | ⚠️ | — |
| T0.3 | **Invested amount per asset (bonds incl.)** | ❌ | ✅ | Entry price + units; PP stores purchase history per ISIN |
| T0.4 | **Rate of return — realized + market value** | ❌ | ✅ PP exact (TWR & IRR) | PP is the only exact open-source implementation |
| T0.5 | **Expected return / projections / simulation** | ❌ | ⚠️ Wealthfolio simulations; PP scenario pages | Likely needs custom logic (coupon schedule → YTM) |
| T0.6 | **Adjustable/annotatable records** (edit buys, manual price/coupon updates) | ✅ | ✅ | Manual override is where bond workflows live |
| T0.7 | Local/private data (no cloud SaaS) | ✅ | ✅ (Wealthfolio/PP local; Ghostfolio self-host) | — |

## Tier 1 — Standard money-manager features

| # | Feature | MMEX | GnuCash | Firefly III | Actual | Wealth trackers |
|---|---------|------|---------|-------------|--------|-----------------|
| T1.1 | Categories, tags, payees | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| T1.2 | Split transactions | ✅ | ✅ | ✅ | ✅ | ❌ |
| T1.3 | Recurring / scheduled transactions | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| T1.4 | Budgets (period/envelope) | ✅ (annual/monthly) | ✅ | ✅ (flexible) | ✅ (envelope, best-in-class) | ⚠️ (Wealthfolio: goals/budget present) |
| T1.5 | Reports & charts (by category, trend) | ✅ | ✅ | ✅ | ✅ | ✅ (portfolio-oriented) |
| T1.6 | Multi-currency | ✅ | ✅ | ✅ | ✅ | ✅ |
| T1.7 | CSV/QIF/OFX import-export | ✅ | ✅ | ✅ (strongest importer) | ✅ | ✅ (CSV; broker APIs in PP/W) |
| T1.8 | Rules / auto-categorization | ⚠️ | ⚠️ | ✅ best-in-class | ✅ | ❌ |
| T1.9 | Attachments/notes/receipts | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| T1.10 | Mobile capture / companion | ✅ Android (KDE applet, sync work needed) | ⚠️ (web add-ons) | ✅ (mobile via sync) | ✅ (official) | ✅ (Wealthfolio iOS; PP Android) |
| T1.11 | Encryption/backup | ✅ db password | ✅ file | ✅ DB-level | ✅ local sync | ✅ file-level |
| T1.12 | Net worth tracking | ⚠️ | ✅ | ⚠️ | ⚠️ | ✅ core |

## Tier 2 — Wealth/fund management differentiators

| # | Feature | PP | Ghostfolio | Wealthfolio | Plain-text (Beancount/hledger) |
|---|---------|----|------------|-------------|-------------------------------|
| T2.1 | Correct TWR + IRR/XIRR | ✅ exact | ⚠️ TWR-simplified | ⚠️ | ⚠️ via plugins (XIRR libs exist) |
| T2.2 | Dividends & coupon ledger | ✅ (treat coupon as income txn) | ⚠️ | ⚠️ | ✅ |
| T2.3 | **Bond specifics: face value, coupon %, maturity, accrued interest, YTM** | ⚠️ manual fields (workable) | ❌/limited | ❌ | ⚠️ manual (fully enforceable to model) |
| T2.4 | Asset allocation / rebalancing rules | ✅ | ✅ (X-ray) | ⚠️ | ⚠️ (scripts) |
| T2.5 | Auto price/market-data feed | ✅ many exchanges | ✅ | ✅ | ⚠️ (manual import, or via script) |
| T2.6 | Tax reporting (cap gains, coupons) | ✅ (German/strong tooling) | ⚠️ | ⚠️ | ⚠️ (reports) |
| T2.7 | Scenario/what-if & FIRE-style projection | ✅ (performance + assumptions) | ❌ | ✅ simulations | ⚠️ script |
| T2.8 | Double-entry ledger integrity | ✅ (transactions reconcile) | ❌ | ❌ | ✅ core |

## Gap summary (what no single OSS app does today)

1. **Bond math automation** — coupon schedules, YTM/accrued interest, maturity ladder; expect custom module wherever you land (see `07-Bond-Tracker-Spec/` when started).
2. **Unified money + wealth in one UI with double-entry** — today = 2 apps or a fork.
3. **Proper "expected return" projection** — absent everywhere; custom formula module needed.
