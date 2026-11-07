# 03 — Double-Entry Accounting Options (and how to learn accounting with them)

> Parent: `00-INDEX.md`. Last updated: 2026-10-19.
> You want double-entry either **inside** the chosen app or as a **separate app**, to learn real accounting.

## 1. What double-entry gives you

- Every transaction touches **≥ 2 accounts** (Asset / Liability / Income / Expense / Equity) — debits = credits.
- Prevents the "my balance is wrong and I don't know why" class of errors; forces a clean Accounting equation.
- Foundation for real reports: Balance Sheet, Income Statement, Trial Balance, cash-flow statement.

Account tree template for personal use (works in ANY double-entry app):
```
Assets:Bank: ..., Assets:Cash:Wallet, Assets:Broker:BondX (Redeemed@Purchase, InterestAccrued),
Liabilities:CreditCard:..., Equity:Opening-Balances, Income:Salary/Sources, Income:Coupons,
Expenses:Rent/Food/..., Income:Investments:Returns
```

## 2. GUI double-entry apps (easier learning curve, Windows ✔)

| App | Double-entry? | Learning support | Customization / API | Fit |
|-----|---------------|------------------|---------------------|-----|
| **GnuCash** | ✅ real | Best GUI tutor: shows two-sided entries while you type; official accounting concepts docs | Scheme extension hooks; SQL/Scheme drill | ⭐ recommended for learning via familiar UI |
| **KMyMoney** | ✅ (ledger-hiding at first, toggleable) | Gentle; ledger view available | ⭐ | OK |
| **Money Manager EX** | ❌ single-entry | — | — | Great daily money manager, no double-entry (already covered in 01) |
| **Firefly III** | ✅ ledger-style (journal view, optional strict ledger mode) | moderate | best REST API of the group | OK |
| **Actual Budget** | ❌ single-entry envelope | — | — | n/a |

## 3. Plain-text double-entry (deepest learning + ultimate customization)

| Tool | License | Model | Strengths | Fit |
|------|---------|-------|-----------|-----|
| **Beancount + Fava UI** | Beancount GPL v2 | Pure text ledger (`.beancount`), Python API, pretty web UI (Fava) | Query language, plugins, importers you write in Python, Git-friendly; huge community docs (plain-text accounting wiki) | ⭐⭐ great if you want to script everything |
| **hledger (+ hledger-web)** | GPL | Markdown-ish `.journal` files, Haskell CLI | Extremely reliable command-line reporting; can convert Beancount; budget tracking; CSV rules | ⭐⭐ |
| **Ledger CLI** | BSD | Edgy original concept | Fastest, minimal | OK |

Example beancount transaction (also shows coupon handling):
```
2026-06-01 * "Salary" "October salary"
  Assets:Bank:Main                     +1500.00 USD
  Income:Salary                       -1500.00 USD

2026-06-15 * "Buy BD bond" "10 unit @ 1000"
  Assets:Broker:Bond-5Y                +10 { 1000.00 USD }
  Assets:Bank:Main                    -10000.00 USD

2026-12-01 * "Coupon" "annual coupon 10%"
  Assets:Broker:Cash                     +100.00 USD
  Income:Coupons                        -100.00 USD
```

## 4. Recommended learning path (2–3 weeks, low risk)

1. **Week 1:** Install **GnuCash**; read the official "concept of double-entry" chapters (GnuCash guide is a great free book); enter a week of real transactions; produce your first Balance Sheet.
2. **Week 2:** Mirror the same 30 transactions in a **Beancount** ledger; learn debits/credits as plus/minus (well explained via the Income/Assets book at beancount docs); make sure GnuCash and Beancount balances reconcile — this locks in the concepts.
3. **Week 3:** Build a small **investments.ledger** section: buy bonds, track accrued interest/coupons; then decide whether the plain-text track stays homebase (see 04-Approach-Options.md).

## 5. Where double-entry fits your final decision

- Want to *learn + keep*: GnuCash (GUI) or Beancount (plains-text) as the nightly home.
- Just want *better guarantees* than your current app: any chosen main app + weekly reconciliation against a Beancount ledger (your "source of truth" file, versioned in Git).
