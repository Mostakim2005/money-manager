# Visual Feature & Change Log (`VISUAL_LOG.md`)
> **1-Line Summary:** Plain-English, color-coded Obsidian-compatible Mermaid flowcharts explaining how each core Money Manager feature and architectural upgrade works end to end.

## Feature & Change Flowcharts

### [VISUAL: Electron-SQLite-WAL-And-LocalStorage-Migration] | Aliases: electron startup, sqlite wal, localstorage migration, atomic save
> **1-Line Summary:** Migrates existing browser data once into `money_manager.sqlite` on startup and protects all whole-Taka writes inside atomic WAL transactions.

* **Plain-English Walkthrough:** When the desktop window opens, the Pinia store asks the Electron main process to load saved state from `money_manager.sqlite`. If the database is empty on first launch, it automatically copies any older browser `localStorage` data into SQLite so nothing is lost. Every later edit writes through an atomic `BEGIN IMMEDIATE / COMMIT` transaction using WAL mode, rolling back safely if an error occurs.

```mermaid
flowchart TD
    %% Color Definitions (Obsidian & GitHub compatible)
    classDef startNode fill:#1d4ed8,stroke:#1e3a8a,color:#ffffff
    classDef processNode fill:#0f766e,stroke:#115e59,color:#ffffff
    classDef outputNode fill:#15803d,stroke:#14532d,color:#ffffff
    classDef trapNode fill:#b91c1c,stroke:#7f1d1d,color:#ffffff

    Start([Start: Desktop App Launches]):::startNode -->|calls onMounted| Hydrate["hydrateFromElectronDb in Pinia Store"]:::processNode
    Hydrate -->|IPC db:loadState| LoadCheck{"SQLite initialized?"}:::processNode
    LoadCheck -->|No - first run| Migrate["hydrateState from localStorage + roundTaka"]:::processNode
    Migrate -->|IPC db:saveState| SaveTx["MoneySqliteService.saveFullState"]:::processNode
    LoadCheck -->|Yes - existing data| ApplyState["applyHydratedPayload + update theme"]:::processNode
    SaveTx -->|PRAGMA WAL + BEGIN IMMEDIATE| CommitDone([Output: Whole-Taka SQLite Saved]):::outputNode
    ApplyState --> Ready([Output: Desktop App Ready]):::outputNode
    SaveTx -.->|if write error occurs| Rollback["ROLLBACK Guard - Zero Partial Writes"]:::trapNode

    subgraph Legend["Legend (Color Guide)"]
        L1([Blue = Startup / User Trigger]):::startNode
        L2[Teal = Store & SQLite Processing]:::processNode
        L3([Green = Saved / Ready Output]):::outputNode
        L4[Red = Atomic Rollback Guard]:::trapNode
    end
```

* **Code Anchors (Grep Targets):**
  * `src/store/index.ts` -> `hydrateFromElectronDb`, `persistState`
  * `electron/db/sqliteService.ts` -> `MoneySqliteService`, `saveFullState`, `loadFullState`
  * `shared/schema/v1_core.sql` -> `accounts`, `transactions`, `app_settings`

---

### [VISUAL: Realbyte-Dual-Path-Collision-Free-Sync] | Aliases: wifi sync, port 10000 proxy, binary sqlite reader, dry run preview, multiset sync
> **1-Line Summary:** Pulls phone records via CORS-free Wi-Fi proxy or binary `.sqlite` reader, previews diffs safely, and merges without duplicates or balance double-counting.

* **Plain-English Walkthrough:** Users can sync from Realbyte Android either over Wi-Fi (port `10000`) through Electron's Node proxy or by picking a Google Drive / Mega `money_android.sqlite` backup file. Transfer leg pairs (`DO_TYPE` 3 and 4) are collapsed into one transfer, foreign keys are remapped, and users can inspect a Dry-Run preview before committing. Finally, 4-tier multiset reconciliation (`externalUid`, ID, post-remap fingerprint, and LWW timestamp) updates the ledger and writes an entry to `sync_logs`.

```mermaid
flowchart TD
    %% Color Definitions (Obsidian & GitHub compatible)
    classDef startNode fill:#1d4ed8,stroke:#1e3a8a,color:#ffffff
    classDef processNode fill:#0f766e,stroke:#115e59,color:#ffffff
    classDef outputNode fill:#15803d,stroke:#14532d,color:#ffffff
    classDef trapNode fill:#b91c1c,stroke:#7f1d1d,color:#ffffff

    StartWifi([Start: Wi-Fi Sync :10000]):::startNode -->|90-day chunks| Proxy["electron/net/realbyteProxy.ts"]:::processNode
    StartFile([Start: Open money_android.sqlite]):::startNode -->|read-only open| Reader["electron/db/realbyteReader.ts"]:::processNode
    Proxy -.->|if HTML page returned| HtmlGuard["Throw REALBYTE_SESSION_INACTIVE"]:::trapNode
    Proxy -->|JSON rows| Normalize["normalizePcManagerData + collapseRealbyteTransferPairs"]:::processNode
    Reader -->|table rows| Normalize
    Normalize -->|under withSyncLock| DryRun{"Dry-Run Preview?"}:::processNode
    DryRun -->|Yes| Preview([Output: Show +New / ~Updated / -Deleted Diff]):::outputNode
    DryRun -->|No - Commit| Reconcile["reconcileRealbyteSync: Remap FKs + Fingerprint + LWW"]:::processNode
    Reconcile -->|persist & audit| SyncLog([Output: Ledger Updated & Logged in sync_logs]):::outputNode

    subgraph Legend["Legend (Color Guide)"]
        L1([Blue = Sync Trigger Source]):::startNode
        L2[Teal = Proxy, Reader & Reconciler]:::processNode
        L3([Green = Preview or Committed Sync]):::outputNode
        L4[Red = HTML Session Guard]:::trapNode
    end
```

* **Code Anchors (Grep Targets):**
  * `electron/net/realbyteProxy.ts` -> `fetchRealbyteTransactions`, `probeRealbyteEndpoints`
  * `electron/db/realbyteReader.ts` -> `readRealbyteBinarySqlite`
  * `src/modules/database/sqliteVault.ts` -> `collapseRealbyteTransferPairs`, `parseRealbyteSqliteVault`
  * `src/modules/sync/syncCoordinator.ts` -> `reconcileRealbyteSync`, `computeTransactionFingerprint`

---

### [VISUAL: Sanchaypatra-Cumulative-Slab-And-Early-Encashment] | Aliases: sanchaypatra slab, ait tax, early encashment, fdr dps maturity
> **1-Line Summary:** Offsets Sanchaypatra slab tiers by existing holdings, applies 5%/10% AIT tax, and simulates premature surrender adjustments or bank FDR/DPS maturity in whole Taka.

* **Plain-English Walkthrough:** When adding a Sanchaypatra certificate, the calculator shifts the starting slab cursor by total existing Sanchaypatra holdings before computing tiered gross profit and subtracting 5% or 10% Advance Income Tax (AIT). Payout dates advance month-end safely without UTC drift, and an Early Encashment flow simulates reduced statutory rates plus clawback adjustments before depositing the settlement into the linked bank account.

```mermaid
flowchart LR
    %% Color Definitions (Obsidian & GitHub compatible)
    classDef startNode fill:#1d4ed8,stroke:#1e3a8a,color:#ffffff
    classDef processNode fill:#0f766e,stroke:#115e59,color:#ffffff
    classDef outputNode fill:#15803d,stroke:#14532d,color:#ffffff
    classDef trapNode fill:#b91c1c,stroke:#7f1d1d,color:#ffffff

    Input([Start: Principal, Scheme & Existing Holdings]):::startNode -->|offset cursor| SlabCalc["calculateSanchaypatraProfit"]:::processNode
    SlabCalc -->|apply 5% or 10% AIT| Schedule["addMonthsClampedISO Schedule"]:::processNode
    Schedule -->|normal payout| Payout([Output: Whole-Taka Bank Deposit]):::outputNode
    Schedule -.->|if encashed early| Early["calculateEarlyEncashment: Stepped Rate & Clawback Guard"]:::trapNode
    Early -->|net settlement| Payout

    subgraph Legend["Legend (Color Guide)"]
        L1([Blue = Certificate Input]):::startNode
        L2[Teal = Cumulative Slab & AIT Engine]:::processNode
        L3([Green = Linked Bank Account Credit]):::outputNode
        L4[Red = Early Surrender Clawback Guard]:::trapNode
    end
```

* **Code Anchors (Grep Targets):**
  * `src/modules/sanchaypatra/calculator.ts` -> `calculateSanchaypatraProfit`, `calculateEarlyEncashment`, `addMonthsClampedISO`
  * `src/modules/sanchaypatra/fdrDpsCalculator.ts` -> `calculateFdrMaturity`, `calculateDpsMaturity`
  * `src/store/index.ts` -> `addSanchaypatra`, `collectSanchaypatraPayout`, `encashSanchaypatra`

---

### [VISUAL: Adaptive-Desktop-Shell-Feature-Flags-And-Encrypted-Vault] | Aliases: feature flags, pure realbyte minimal mode, privacy mode, aes-gcm vault
> **1-Line Summary:** Controls workspace complexity through persisted `featureFlags` presets, global shortcuts, and PBKDF2 + AES-256-GCM encrypted backup vaults.

* **Plain-English Walkthrough:** Toggling **Pure Realbyte Minimal Mode**, **Full Suite**, or individual switches in Settings updates `store.featureFlags` so unused tabs and power cards stay hidden while core logging via the global keypad (`N` / `Ctrl+K`) and Privacy Mode (`Shift+P`) remain instant. Backups can be exported either as plain JSON or encrypted with a user passphrase using PBKDF2-SHA256 and AES-GCM.

```mermaid
flowchart TD
    %% Color Definitions (Obsidian & GitHub compatible)
    classDef startNode fill:#1d4ed8,stroke:#1e3a8a,color:#ffffff
    classDef processNode fill:#0f766e,stroke:#115e59,color:#ffffff
    classDef outputNode fill:#15803d,stroke:#14532d,color:#ffffff
    classDef trapNode fill:#b91c1c,stroke:#7f1d1d,color:#ffffff

    UserAction([Start: Feature Preset, Shortcut or Vault Export]):::startNode -->|updates store| Flags["setFeatureFlag / applyFeaturePreset"]:::processNode
    Flags -->|filters nav & cards| Shell([Output: Minimal Realbyte UI or Full Power Suite]):::outputNode
    UserAction -->|export or restore| Crypto["vaultCrypto: PBKDF2-SHA256 + AES-GCM"]:::processNode
    Crypto -->|valid passphrase| VaultDone([Output: Encrypted Backup Restored / Saved]):::outputNode
    Crypto -.->|wrong passphrase| PassError["Reject Decryption & Preserve Current State"]:::trapNode

    subgraph Legend["Legend (Color Guide)"]
        L1([Blue = User Toggle or Export Trigger]):::startNode
        L2[Teal = Flag Routing & WebCrypto Cipher]:::processNode
        L3([Green = Tailored UI or Secured Vault]):::outputNode
        L4[Red = Passphrase Verification Guard]:::trapNode
    end
```

* **Code Anchors (Grep Targets):**
  * `src/store/index.ts` -> `DEFAULT_FEATURE_FLAGS`, `applyFeaturePreset`, `setFeatureFlag`, `togglePrivacyMode`
  * `src/App.vue` -> `visibleTabs`, `handleGlobalShortcut`
  * `src/modules/exporters/vaultCrypto.ts` -> `encryptVaultJson`, `decryptVaultJson`
