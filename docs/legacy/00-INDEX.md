# MoneyManager Topic — Master Index

> Goal of the project: one (or two) tools covering **personal money management + investing/wealth tracking**
> (government bonds, invested amounts, realized/expected returns, fully adjustable), **heavily prioritizing
> customizable open source**, with ready-made apps as fallback. Separate best-in-class apps (money manager +
> wealth manager) are acceptable.

**Status:** Brainstorming / research phase — app-type decision not yet made.

---

## Progressive Index Hierarchy

Numbering scheme designed to grow over time without renumbering:

```
Level 0  Topic root        OpenCode\MoneyManager\
Level 1  Top-level doc     0N-<Name>.md          (stable, never reused)
Level 2  Sub-doc/section   0N.M-<Name>.md        (slots under parent 0N)
Level 3  Deep detail       0N.M.K-<Name>.md      (rare; use only when needed)
```

Rules:
- New docs always append the next free number; existing numbers are immutable.
- The tree below is the **single source of truth**. Every new/edited doc updates this tree.
- If a doc grows past ~400 lines, split into `0N.1`, `0N.2`, … and keep a short stub + links in the parent.

### Current tree

| # | File | Purpose | Last updated | Status |
|---|------|---------|--------------|--------|
| 00 | `00-INDEX.md` | This master index + hierarchy rules | 2026-10-19 | active |
| 01 | `01-Apps-Research.md` | App-by-app research: money managers, wealth/portfolio trackers, budgets | 2026-10-19 | active |
| 02 | `02-Feature-List.md` | Master feature checklist with tiers + app coverage matrix | 2026-10-19 | active |
| 03 | `03-Double-Entry-Options.md` | Double-entry accounting options (GUI + plain-text) for learning accounting | 2026-10-19 | active |
| 04 | `04-Approach-Options.md` | Build vs customize vs ready-made options + recommendation + next steps | 2026-10-19 | active |
| 05 | `05-Forkability-Scorecard.md` | Weighted forkability scorecard across the 4 cloned candidate repos + decision logic | 2026-10-19 | active |

Planned (slots reserved):
- `06-Decision.md` — final app-type decision & adoption plan (after brainstorm ends; previously reserved as 05-Decision).
- `07-Bond-Tracker-Spec/` — `07.1-…` hands-on setup/import notebooks per chosen app.
- `07-Bond-Tracker-Spec/07.1-Data-Model.md` — bond/expected-return extension spec if customizing or building.

---

## Decision snapshot (see 04-Approach-Options.md for detail)

| Path | Money mgmt | Bond/wealth analytics | Customizable | Effort |
|------|-----------|----------------------|--------------|--------|
| Ready-made pair: **MMEX/GnuCash + Portfolio Performance** | ✅ | ✅ (PP, best-in-class, incl. bonds via manual coupons) | ❌ limited | none |
| Customize **Wealthfolio** (JS stack, local-first) | ✅ spend+goals | ⚠️ needs bond/YTM module added | ✅ high | medium |
| Customize **Ghostfolio/Firefly III** (Docker) | ✅ | ⚠️ / ❌ | ✅ high | medium-high |
| Plain-text **Ledger/Beancount/hledger + Fava** (double-entry learning) | ✅ via scripting | ✅ via scripting | ✅ unlimited | high (data entry) |
| Build from scratch (Tauri + React + SQLite) | as specified | as specified | ✅ 100% | highest |

---

## Sources (last research run)
- Expensify free-finance guide 2026, SourceForge personal-finance directory, r/selfhosted threads
- portfolio-performance.info (TWR/IRR official), wealthfolio.app + GitHub, github.com/ghostfolio/ghostfolio
- firefly-iii.org, actualbudget.org, hledger.org, github.com/beancount/beancount
- Comparison posts: portfolioglance.com (Ghostfolio alternatives), allinvestview.com (open-source vs), mycapitally.com (private trackers 2026)
