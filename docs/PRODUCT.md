# Product Intent & Feature Map (`PRODUCT.md`)
> **1-Line Summary:** The permanent source of truth for the Money Manager application, prioritizing Realbyte Money Manager parity, localized Bangladeshi savings certificates (Sanchaypatra), and free cross-device PC-Phone syncing.

## 1. Core Vision & User Experience Intent
* **What This App Does (Plain English):** A personal finance and money manager app that delivers the seamless daily logging experience of Realbyte's "Money Manager Expense & Budget", complemented by custom management for localized savings schemes (such as Bangladesh National Savings Certificates / Sanchaypatra and fixed deposits), running locally on both Windows PC and Android phone with free local/cloud synchronization.
* **How It Must Feel to Use:** Fast, tactile, and frictionless. Opening the app on a phone must present a rapid transaction keypad, while the dashboard features a color-coded daily calendar (green income, red expense). Data remains private and local-first without requiring expensive subscriptions or forced third-party clouds.

---

## 2. Active Features (Do Not Break)

### [FEATURE: Calendar-Daily-Grid-View] | Aliases: calendar view, daily totals, monthly calendar, expense grid
> **1-Line Summary:** A month-grid calendar view displaying daily net income (green) and expense (red) totals directly inside each date cell.
* **User Intention (Non-Negotiable):** Replicate the primary browsing UX of Realbyte Money Manager, enabling users to spot high-spending days instantly and inspect or edit transactions by tapping any date.
* **Visual / UI Behavior:** Top bar with month switcher and monthly income/expense/total summary banner; grid showing days 1–31 with daily sums; tapping a cell opens the day's transaction sheet.
* **Code Anchors (Grep Targets):**
  * `docs/PRODUCT.md` -> `Calendar-Daily-Grid-View`
  * UI Component -> `CalendarGrid`, `DailyTransactionSheet`

### [FEATURE: Rapid-Transaction-Keypad] | Aliases: quick entry, calculator input, category picker, expense logger
> **1-Line Summary:** A dedicated calculator-style numeric pad for logging amounts, instantly linked to category icons, account selection, and optional notes.
* **User Intention (Non-Negotiable):** Frictionless entry under 5 seconds per transaction: Amount -> Category -> Account -> Note/Description.
* **Visual / UI Behavior:** Bottom sheet or full screen with a built-in math keypad (addition/subtraction), high-contrast category icons, and payment method chips (Cash, Bank, bKash, Nagad, Card).
* **Code Anchors (Grep Targets):**
  * UI Component -> `TransactionKeypad`, `CategorySelector`

### [FEATURE: Account-And-Asset-Hierarchy] | Aliases: accounts, wallet, bank accounts, mobile financial services, cards
> **1-Line Summary:** Hierarchical account management supporting cash wallets, local bank accounts, mobile financial services (MFS), credit cards, and fixed assets.
* **User Intention (Non-Negotiable):** Accurately mirror local Bangladeshi payment methods (Cash, bKash, Nagad, Rocket, Bank Accounts, Credit Cards) with seamless account-to-account transfers and balance tracking.
* **Visual / UI Behavior:** Grouped list under Assets, Liabilities, and Accounts; shows live balances and transfer shortcuts.
* **Code Anchors (Grep Targets):**
  * Data Model -> `Account`, `AccountType`, `TransferEngine`

### [FEATURE: Sanchaypatra-Scheme-Tracker] | Aliases: sanchaypatra, savings certificate, fixed deposit, fdr, profit schedule
> **1-Line Summary:** Specialized investment tracker for government savings certificates (Sanchaypatra) and fixed deposits with automated profit schedules and tax deduction tracking.
* **User Intention (Non-Negotiable):** Replace complex Wall Street stock tracking with a practical local investment manager that records principal, purchase date, tenure/maturity, slab interest rate, payout frequency (monthly/quarterly), and auto-deducted Advance Income Tax (AIT), generating scheduled profit reminders or auto-ledger entries.
* **Visual / UI Behavior:** Dedicated "Savings Schemes & Assets" section showing certificate type, invested principal, accrued/expected payout date, and maturity countdown.
* **Code Anchors (Grep Targets):**
  * Calculation Module -> `SanchaypatraCalculator`, `ProfitScheduleEngine`

### [FEATURE: Cross-Platform-Free-Sync] | Aliases: phone pc sync, google drive sync, mega sync, sqlite backup
> **1-Line Summary:** Free, zero-subscription data synchronization between Realbyte Android and Windows PC using Google Drive or Mega Drive SQLite backups.
* **User Intention (Non-Negotiable):** Keep using the Realbyte mobile app for fast on-the-go logging with automated backup to Google Drive / Mega, while the Windows PC Power App automatically syncs the same database for deep desktop management and Sanchaypatra scheduling.
* **Visual / UI Behavior:** Realbyte app triggers periodic Google Drive backup; PC Power App monitors the synced local cloud drive folder, reloading changes smoothly.
* **Code Anchors (Grep Targets):**
  * `src/modules/sync/` -> `DriveWatcher`, `SQLiteSyncCoordinator`

### [FEATURE: Dual-Budget-Philosophy-Toggle] | Aliases: budget mode toggle, cashflow vs envelope, realbyte mode, actual budget mode
> **1-Line Summary:** Settings toggle switching between "Cashflow & Calendar Ledger" (Realbyte default) and "Zero-Based Envelope Allocation" (Actual Budget mode).
* **User Intention (Non-Negotiable):** Allow the user to experiment with zero-based envelope budgeting on their own terms without forcing artificial rationing or breaking the intuitive Realbyte cashflow experience.
* **Visual / UI Behavior:** Toggle switch in Settings under "Budgeting Philosophy". In Cashflow mode (default), categories simply track monthly spent sums on the calendar grid. In Envelope mode, category headers show monthly allocated pools, remaining balances, and progress bars.
* **Code Anchors (Grep Targets):**
  * `src/types/index.ts` -> `BudgetMode`
  * `src/components/SettingsTab.vue` -> `store.budgetMode`

### [FEATURE: Period-Visual-Analytics] | Aliases: category charts, monthly trends, cashflow breakdown, savings rate
> **1-Line Summary:** Visual analytics breakdown displaying category percentage shares and net savings rate progress bars.
* **User Intention (Non-Negotiable):** Deliver Realbyte's Statistics tab capabilities to inspect spending leaks and savings growth.
* **Visual / UI Behavior:** Realbyte-style Stats tab featuring a top savings rate progress card, followed by percentage-ranked expense category bars and income breakdowns.
* **Code Anchors (Grep Targets):**
  * `src/modules/statistics/analytics.ts` -> `computePeriodAnalytics`
  * `src/components/StatsTab.vue` -> `stats`

### [FEATURE: Bank-Statement-Importer] | Aliases: qif import, csv import, ofx import, statement parser
> **1-Line Summary:** Multi-format bank statement parser adapted from Actual Budget supporting QIF, OFX, and Bangladeshi CSV formats.
* **User Intention (Non-Negotiable):** Enable bulk statement import from local bank accounts (City Bank, BRAC Bank, Sonali Bank) without manual line-by-line logging.
* **Visual / UI Behavior:** Importer utility parsing files and generating structured transaction arrays.
* **Code Anchors (Grep Targets):**
  * `src/modules/importers/qifParser.ts` -> `parseQifContent`
  * `src/modules/importers/csvParser.ts` -> `parseCsvStatement`

---

## 3. Planned Features & App-Merge Wishlist

### [WISHLIST: Double-Entry-Ledger-Bridge] | Aliases: double entry, accounting tutor, trial balance, beancount export
> **1-Line Summary:** Optional double-entry journal view or automated Beancount/GnuCash export to help the user learn and practice true accounting.
* **User Intention:** Ensure mathematical ledger integrity (Assets = Liabilities + Equity) without overwhelming daily fast logging.
* **Target Integration Point:** Connects to transaction commit pipeline, auto-generating balanced debit/credit journal entries in the background.
