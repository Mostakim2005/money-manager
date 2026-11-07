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

### [FEATURE:Rapid-Transaction-Keypad] | Aliases: quick entry, calculator input, category picker, expense logger
> **1-Line Summary:** A dedicated calculator-style numeric pad for logging amounts, instantly linked to category icons, account selection, transfers, and optional notes.
* **User Intention (Non-Negotiable):** Frictionless entry under 5 seconds per transaction: Amount -> Category -> Account -> Note/Description.
* **Visual / UI Behavior:** Bottom sheet or modal with a built-in safe math keypad (`+`, `-`, `×`, `÷` without `eval`), high-contrast category pills, payment method chips (Cash, Bank, bKash, Nagad, Card), and Account-to-Account Transfer mode.
* **Code Anchors (Grep Targets):**
  * UI Component -> `src/components/TransactionKeypad.vue`
  * Transfer Logic -> `src/modules/accounts/transferEngine.ts` -> `executeAccountTransfer`

### [FEATURE: Account-And-Asset-Hierarchy] | Aliases: accounts, wallet, bank accounts, mobile financial services, cards
> **1-Line Summary:** Hierarchical account management supporting cash wallets, local bank accounts, mobile financial services (MFS), credit cards, and fixed assets.
* **User Intention (Non-Negotiable):** Accurately mirror local Bangladeshi payment methods (Cash, bKash, Nagad, Rocket, Bank Accounts, Credit Cards) with seamless account-to-account transfers and balance tracking.
* **Visual / UI Behavior:** Grouped list under Assets, Liabilities, and Investments; shows live balances and transfer shortcuts (`executeAccountTransfer`).
* **Code Anchors (Grep Targets):**
  * `src/modules/accounts/manager.ts` -> `buildAccountsHierarchy`
  * `src/modules/accounts/transferEngine.ts` -> `executeAccountTransfer`, `isLiabilityAccount`

### [FEATURE: Sanchaypatra-Scheme-Tracker] | Aliases: sanchaypatra, savings certificate, fixed deposit, fdr, profit schedule
> **1-Line Summary:** Specialized investment tracker for government savings certificates (Sanchaypatra) and fixed deposits with automated profit schedules and tax deduction tracking.
* **User Intention (Non-Negotiable):** Replace complex Wall Street stock tracking with a practical local investment manager that records principal, purchase date, tenure/maturity, slab interest rate, payout frequency (monthly/quarterly/half-yearly), and auto-deducted Advance Income Tax (AIT), generating scheduled profit reminders or auto-ledger entries.
* **Visual / UI Behavior:** Dedicated "Savings Schemes & Assets" section showing certificate type, invested principal, accrued/expected payout date, and maturity countdown.
* **Code Anchors (Grep Targets):**
  * `src/modules/sanchaypatra/calculator.ts` -> `calculateSanchaypatraProfit`, `generatePayoutScheduleDates`
  * `src/modules/sanchaypatra/schemes.ts` -> `BANGLADESH_SANCHAYPATRA_SCHEMES`

### [FEATURE: Cross-Platform-Free-Sync] | Aliases: phone pc sync, google drive sync, mega sync, sqlite backup, pc manager wifi sync
> **1-Line Summary:** Dual-path, collision-free synchronization between Realbyte Android and Windows PC via both Realbyte's built-in Wi-Fi PC Manager server and Google Drive / Mega SQLite backups (`money_android.sqlite`).
* **User Intention (Non-Negotiable):** Keep using the Realbyte mobile app for fast on-the-go logging while syncing seamlessly through either local Wi-Fi PC Manager (port 10000) or SQLite vault backups (`INOUTCOME`, `ASSETS`, `ZCATEGORY`) without duplicate records, balance collisions, or database lock corruption.
* **Visual / UI Behavior:** Interactive Synchronization Bridges in Settings allowing 1-click Wi-Fi PC Manager sync and SQLite Vault backup processing, outputting a live `SyncReconciliationReport` (Inserted, Updated via LWW, Skipped Duplicates, and WAL verification).
* **Code Anchors (Grep Targets):**
  * `src/modules/database/sqliteVault.ts` -> `createSQLiteConnection`, `parseRealbyteSqliteVault`
  * `src/modules/sync/syncCoordinator.ts` -> `reconcileRealbyteSync`, `computeTransactionFingerprint`
  * `src/modules/realbyte/client.ts` -> `RealbytePcManagerClient`, `normalizePcManagerData`

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

### [FEATURE: Bank-Statement-Importer] | Aliases: qif import, csv import, ofx import, camt xml import, statement parser, csv exporter
> **1-Line Summary:** Multi-format bank statement parser and exporter adapted from Actual Budget supporting QIF, OFX 1.x/2.x, ISO 20022 CAMT.053 XML, and Bangladeshi CSV formats with deterministic deduplication and RFC-4180 CSV/JSON exports.
* **User Intention (Non-Negotiable):** Enable bulk statement import from local bank accounts (City Bank, BRAC Bank, Sonali Bank) without manual line-by-line logging or duplicate records, plus 1-click CSV and JSON vault exports.
* **Visual / UI Behavior:** Interactive Statement Importer modal parsing CSV, QIF, OFX, and CAMT.053 XML files, applying auto-categorization rules, and reporting inserted vs. skipped duplicate transactions; 1-click CSV and JSON export buttons.
* **Code Anchors (Grep Targets):**
  * `src/modules/importers/ofxParser.ts` -> `parseOfxStatement`, `mapParsedStatementToTransactions`
  * `src/modules/importers/camtXmlParser.ts` -> `parseCamtXmlStatement`
  * `src/modules/importers/qifParser.ts` -> `parseQifContent`
  * `src/modules/importers/csvParser.ts` -> `parseCsvStatement`
  * `src/modules/exporters/csvExporter.ts` -> `exportTransactionsToCsv`, `exportFullBackupJson`
  * `src/modules/rules/engine.ts` -> `applyRulesToTransaction`

### [FEATURE: Recurring-And-Split-Transactions] | Aliases: recurring bills, split transaction, merge transactions, scheduled bills
> **1-Line Summary:** Transaction splitting, merging, and recurring bill scheduling adapted from Actual Budget.
* **User Intention (Non-Negotiable):** Allow splitting a single shopping receipt across multiple categories, merging partial records, and automating monthly recurring bills (Rent, DESCO, Titas Gas) and Sanchaypatra profit collection.
* **Visual / UI Behavior:** Split (`✂️ Split`) and Delete (`🗑️`) actions on transaction rows, 1-click `"💰 Collect Payout"` on Sanchaypatra certificates, and a Recurring Bills scheduler card in Settings.
* **Code Anchors (Grep Targets):**
  * `src/modules/transactions/recurringAndSplit.ts` -> `splitTransaction`, `mergeTransactions`, `processDueRecurringSchedules`, `advanceDueDate`

### [FEATURE: Double-Entry-Ledger-Bridge] | Aliases: double entry, accounting tutor, trial balance, beancount export
> **1-Line Summary:** Automated double-entry journal engine and Beancount plain-text exporter maintaining strict trial balance integrity (`Debits = Credits`).
* **User Intention:** Ensure mathematical ledger integrity (`Assets = Liabilities + Equity`) and support plain-text Beancount accounting exports without slowing down daily fast logging.
* **Visual / UI Behavior:** Trial Balance verification badge and live Beancount ledger export card in Settings.
* **Code Anchors (Grep Targets):**
  * `src/modules/ledger/doubleEntryBridge.ts` -> `generateDoubleEntryJournal`, `verifyLedgerTrialBalance`, `exportJournalToBeancount`
