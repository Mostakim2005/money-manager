# Product Intent & Feature Map (`PRODUCT.md`)
> **1-Line Summary:** The permanent source of truth for the Money Manager application, prioritizing Realbyte Money Manager parity, localized Bangladeshi savings certificates (Sanchaypatra, FDR, DPS), modular feature flags, and collision-free Electron PC-Phone syncing.

## 1. Core Vision & User Experience Intent
* **What This App Does (Plain English):** A personal finance and money manager desktop app built on Electron + Vue 3 + `better-sqlite3` WAL that delivers the seamless daily logging experience of Realbyte's "Money Manager Expense & Budget", complemented by localized Bangladesh savings trackers (Sanchaypatra, FDR, DPS), planning tools, and zero-cost PC-to-Android synchronization.
* **How It Must Feel to Use:** Fast, tactile, and uncluttered. Out of the box, users can stay in **Pure Realbyte Minimal Mode** (Daily Calendar, Transactions, Accounts, Stats, Quick Keypad) or selectively toggle lateral modules (`feature_flags`) in Settings.

---

## 2. Active Features (Do Not Break)

### [FEATURE: Calendar-Daily-Grid-View] | Aliases: calendar view, daily totals, monthly calendar, expense grid
> **1-Line Summary:** A responsive 12-column master-detail month calendar displaying daily net income and expense totals beside a sticky Day Transaction Sheet.
* **User Intention (Non-Negotiable):** Replicate Realbyte's primary calendar UX on desktop with immediate day drilldown, Friday/Saturday Bangladesh weekend highlighting, quick-add, inline edit, and delete/undo.
* **Code Anchors (Grep Targets):**
  * `src/components/CalendarTab.vue` -> `monthSummary`, `selectedDayTransactions`, `openInlineEdit`
  * `src/modules/calendar/matrix.ts` -> `buildMonthCalendarMatrix`

### [FEATURE: Rapid-Transaction-Keypad] | Aliases: quick entry, calculator input, category picker, expense logger
> **1-Line Summary:** A single global 2-column calculator keypad modal (`N` or `Ctrl+K`) with safe arithmetic evaluation, subcategories, optional multi-currency FX conversion, and local receipt attachments.
* **User Intention (Non-Negotiable):** Frictionless entry under 5 seconds per transaction in whole-Taka integers (`roundTaka`), supporting Expense, Income, and Account-to-Account Transfers.
* **Code Anchors (Grep Targets):**
  * `src/components/TransactionKeypad.vue` -> `evaluateSafeMath`, `handleSave`, `applyFxConversion`
  * `src/App.vue` -> `handleGlobalShortcut`
  * `src/modules/accounts/transferEngine.ts` -> `executeAccountTransfer`, `roundTaka`

### [FEATURE: Sortable-Bulk-Ledger] | Aliases: transactions table, multi-facet filter, bulk merge, bulk recategorize
> **1-Line Summary:** A dense sortable ledger table with multi-facet filtering (Type, Account, Category, Date Range), accessible column sorting, and bulk Merge / Re-categorize / Delete actions.
* **User Intention:** Enable rapid desktop auditing, receipt opening, splitting across two categories, and zero-duplicate merging without losing keyboard or screen-reader semantics.
* **Code Anchors (Grep Targets):**
  * `src/components/TransactionsTab.vue` -> `sortedTransactions`, `toggleSort`, `handleBulkMerge`, `handleBulkRecategorize`
  * `src/store/index.ts` -> `bulkRecategorizeTransactions`, `bulkDeleteTransactions`, `splitExistingTransaction`, `mergeSelectedTransactions`

### [FEATURE: Account-And-Asset-Hierarchy] | Aliases: accounts, wallet, bank accounts, mobile financial services, cards, reconciliation
> **1-Line Summary:** Hierarchical account management supporting Cash, Bank, MFS (bKash/Nagad), Credit Cards, Assets, and Liabilities with Edit, Archive, Delete, and 1-click Balance Reconciliation.
* **User Intention (Non-Negotiable):** Accurately track balances in whole Taka with signed liability math (`credit_card`, `liability`) and 1-click statement reconciliation (`"Balance Adjustment"` delta transactions).
* **Code Anchors (Grep Targets):**
  * `src/components/AccountsTab.vue` -> `openReconcileModal`, `handleExecuteReconcile`, `openEditModal`
  * `src/modules/accounts/manager.ts` -> `buildAccountsHierarchy`
  * `src/store/index.ts` -> `reconcileAccountBalance`, `editAccount`, `archiveAccount`, `deleteAccount`

### [FEATURE: Sanchaypatra-And-Term-Deposit-Tracker] | Aliases: sanchaypatra, savings certificate, early encashment, fdr, dps, slab rates
> **1-Line Summary:** Specialized tracker for Bangladesh Sanchaypatra (with editable statutory slab tables, cumulative holdings offsetting, AIT withholding, and premature encashment simulation) plus FDR & DPS deposits.
* **User Intention (Non-Negotiable):** Replace complex equity tickers with accurate Bangladeshi fixed-income instruments, stepped early-surrender math, and 1-click bank profit/installment posting.
* **Code Anchors (Grep Targets):**
  * `src/components/SanchaypatraTab.vue` -> `openEncashmentModal`, `updateSlabRate`, `handleCreateFdr`
  * `src/modules/sanchaypatra/calculator.ts` -> `calculateSanchaypatraProfit`, `calculateEarlyEncashment`, `addMonthsClampedISO`
  * `src/modules/sanchaypatra/fdrDpsCalculator.ts` -> `calculateFdrMaturity`, `calculateDpsMaturity`

### [FEATURE: Cross-Platform-Free-Sync] | Aliases: phone pc sync, google drive sync, mega sync, sqlite backup, pc manager wifi sync, dry run
> **1-Line Summary:** Dual-path collision-free sync via Electron's CORS-free Node HTTP proxy (`port 10000`) with raw endpoint diagnostics, chunked historical pulls, Dry-Run preview modal, native binary `.sqlite` reader (`better-sqlite3`), and persistent `sync_logs`.
* **User Intention (Non-Negotiable):** Sync seamlessly with Realbyte Android over local Wi-Fi or Google Drive / Mega `money_android.sqlite` backups with zero duplicates, zero balance double-counting, and atomic WAL writes.
* **Code Anchors (Grep Targets):**
  * `electron/net/realbyteProxy.ts` -> `checkRealbyteConnection`, `probeRealbyteEndpoints`, `fetchRealbyteTransactions`
  * `electron/db/realbyteReader.ts` -> `readRealbyteBinarySqlite`
  * `electron/db/sqliteService.ts` -> `MoneySqliteService`
  * `src/modules/sync/syncCoordinator.ts` -> `reconcileRealbyteSync`, `computeTransactionFingerprint`

### [FEATURE: Modular-Feature-Flags-And-Power-Suite] | Aliases: feature flags, realbyte minimal mode, charts, savings goals, credit card emi, iou khata, encrypted vault
> **1-Line Summary:** Toggleable `featureFlags` system (`Pure Realbyte Minimal Mode` vs `Full Suite`) gating Visual SVG Charts, Envelope Budgets, Savings Goals, CC EMIs, IOU Khata, Multi-Currency, Receipts, Rules/Recurring, Bank Importers, Double-Entry Beancount, AES-256-GCM Encrypted Vaults, and Privacy Mode (`Shift+P`).
* **User Intention (Non-Negotiable):** Deliver rich personal finance capabilities without cluttering the core Realbyte experience for users who want minimalism.
* **Code Anchors (Grep Targets):**
  * `src/components/SettingsTab.vue` -> `featureFlagItems`, `handleExportEncryptedVault`, `handleDecryptAndRestore`, `runEndpointProbe`
  * `src/components/AnalyticsCharts.vue` -> `donutSegments`, `monthlyTrend`, `netWorthTrend`
  * `src/components/PlanningTab.vue` -> `handleCreateGoal`, `handleCreateEmi`, `handleSettleIou`
  * `src/modules/exporters/vaultCrypto.ts` -> `encryptVaultJson`, `decryptVaultJson`
  * `src/store/index.ts` -> `DEFAULT_FEATURE_FLAGS`, `applyFeaturePreset`, `setFeatureFlag`, `togglePrivacyMode`
