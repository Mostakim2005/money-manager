<template>
  <div class="space-y-5">
    <!-- Modules & Feature Flags (Anti-Feature-Creep Control) -->
    <div class="card-surface border rounded-2xl p-5 shadow-sm space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="font-bold text-base flex items-center gap-2">
            <SlidersHorizontal class="w-4 h-4 text-rose-500" />
            Modules & Feature Flags
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Keep the interface pure Realbyte minimal or enable only the power modules you actively use.
          </p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            @click="store.applyFeaturePreset('realbyte_minimal')"
            class="px-3 py-1.5 rounded-xl panel-surface border text-xs font-semibold hover:border-rose-500"
          >
            Pure Realbyte Minimal Mode
          </button>
          <button
            type="button"
            @click="store.applyFeaturePreset('full_suite')"
            class="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
          >
            Full Suite
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        <div
          v-for="item in featureFlagItems"
          :key="item.key"
          class="panel-surface border rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
        >
          <div class="min-w-0">
            <div class="font-bold truncate">{{ item.label }}</div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">{{ item.desc }}</div>
          </div>
          <button
            type="button"
            role="switch"
            :aria-checked="store.featureFlags[item.key]"
            :aria-label="`Toggle ${item.label}`"
            @click="store.setFeatureFlag(item.key, !store.featureFlags[item.key])"
            class="w-10 h-6 rounded-full p-0.5 transition-colors flex-shrink-0"
            :class="store.featureFlags[item.key] ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'"
          >
            <span
              class="block w-5 h-5 rounded-full bg-white shadow transform transition-transform"
              :class="store.featureFlags[item.key] ? 'translate-x-4' : 'translate-x-0'"
            ></span>
          </button>
        </div>
      </div>
    </div>

    <!-- Budgeting Philosophy Toggle -->
    <div v-if="store.featureFlags.enableEnvelopeBudgets" class="card-surface border rounded-2xl p-5 shadow-sm space-y-3">
      <div>
        <h3 class="font-bold text-base">Budgeting Philosophy</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Choose how you organize monthly spending.</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          @click="store.setBudgetMode('cashflow_ledger')"
          class="p-4 rounded-xl border text-left space-y-1 transition-colors"
          :class="store.budgetMode === 'cashflow_ledger' ? 'border-rose-500 bg-rose-500/10' : 'panel-surface'"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-bold">Cashflow & Calendar</span>
            <span v-if="store.budgetMode === 'cashflow_ledger'" class="text-rose-600 dark:text-rose-400 text-xs font-bold">
              Active
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Realbyte default. Fluid daily entry, calendar grid, and monthly cashflow sums.
          </p>
        </button>

        <button
          type="button"
          @click="store.setBudgetMode('envelope_allocation')"
          class="p-4 rounded-xl border text-left space-y-1 transition-colors"
          :class="store.budgetMode === 'envelope_allocation' ? 'border-indigo-500 bg-indigo-500/10' : 'panel-surface'"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-bold">Zero-Based Envelope</span>
            <span v-if="store.budgetMode === 'envelope_allocation'" class="text-indigo-600 dark:text-indigo-400 text-xs font-bold">
              Active
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Actual Budget mode. Monthly category allowances with overspend alerts.
          </p>
        </button>
      </div>
    </div>

    <!-- Dual Sync Bridges & Diagnostics -->
    <div class="card-surface border rounded-2xl p-5 shadow-sm space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="font-bold text-base">Synchronization Bridges</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Connect Realbyte Android via CORS-free PC Manager Wi-Fi proxy or Google Drive / Mega SQLite backups.
          </p>
        </div>

        <span
          v-if="store.electronDbInfo"
          class="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-mono"
        >
          SQLite {{ store.electronDbInfo.journalMode.toUpperCase() }} • {{ store.electronDbInfo.dbPath }}
        </span>
      </div>

      <!-- Bridge 1: Wi-Fi PC Manager -->
      <div class="p-4 rounded-xl panel-surface border space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-xs font-bold flex items-center gap-2">
            <Wifi class="w-4 h-4 text-emerald-500" />
            Bridge 1: Realbyte Phone PC Manager (Port 10000)
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              @click="testPhoneConnection"
              class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
            >
              Test
            </button>
            <button
              type="button"
              @click="runEndpointProbe"
              :disabled="probingEndpoints"
              class="px-2.5 py-1 rounded-lg panel-surface border text-xs font-semibold hover:border-sky-500"
            >
              {{ probingEndpoints ? 'Probing...' : 'Test & Inspect Raw Server Response' }}
            </button>
            <button
              type="button"
              @click="runPcManagerDryRun"
              :disabled="syncingPcManager"
              class="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
            >
              Preview Sync (Dry Run)
            </button>
            <button
              type="button"
              @click="runPcManagerSync"
              :disabled="syncingPcManager"
              class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1"
            >
              <RefreshCw class="w-3.5 h-3.5" :class="syncingPcManager ? 'animate-spin' : ''" />
              <span>{{ syncingPcManager ? 'Syncing...' : 'Sync Now' }}</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
          <input
            v-model="store.phoneIp"
            @change="store.persistState()"
            placeholder="Phone IP (e.g. 192.168.1.105)"
            class="sm:col-span-2 input-surface border rounded-xl px-3 py-2 font-mono"
          />
          <input
            v-model.number="store.phonePort"
            @change="store.persistState()"
            type="number"
            placeholder="Port"
            class="input-surface border rounded-xl px-3 py-2 font-mono text-center tabular-nums"
          />
          <select
            v-model="store.syncScope"
            @change="store.persistState()"
            aria-label="Sync date scope"
            class="input-surface border rounded-xl px-2.5 py-2 font-semibold"
          >
            <option value="current_month">Current Month</option>
            <option value="last_90_days">Last 90 Days</option>
            <option value="full_year">Full Year ({{ store.selectedYear }})</option>
            <option value="all_history">All History (3-mo chunks)</option>
          </select>
        </div>

        <div
          v-if="connectionTestResult"
          class="text-xs font-semibold"
          :class="connectionTestResult.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'"
        >
          {{ connectionTestResult.message }}
        </div>

        <!-- Collapsible Diagnostic Endpoint Inspector -->
        <div v-if="showDiagnosticInspector" class="p-3.5 rounded-xl card-surface border space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <span class="font-bold">Diagnostic Inspector & Custom Endpoint Paths</span>
            <button type="button" @click="showDiagnosticInspector = false" class="text-slate-500 hover:underline">
              Hide
            </button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
            <div>
              <label class="block text-[10px] text-slate-500 mb-1">Accounts Path</label>
              <input v-model="store.realbyteEndpointOverrides.accountPath" @change="store.persistState()" class="w-full input-surface border rounded-lg px-2 py-1 text-[11px]" />
            </div>
            <div>
              <label class="block text-[10px] text-slate-500 mb-1">Categories Path</label>
              <input v-model="store.realbyteEndpointOverrides.categoryPath" @change="store.persistState()" class="w-full input-surface border rounded-lg px-2 py-1 text-[11px]" />
            </div>
            <div>
              <label class="block text-[10px] text-slate-500 mb-1">Ledger Path</label>
              <input v-model="store.realbyteEndpointOverrides.ledgerPath" @change="store.persistState()" class="w-full input-surface border rounded-lg px-2 py-1 text-[11px]" />
            </div>
          </div>

          <div v-if="probeResults.length > 0" class="space-y-1.5">
            <div
              v-for="res in probeResults"
              :key="res.label"
              class="p-2.5 rounded-lg panel-surface border flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]"
            >
              <div>
                <span class="font-bold">{{ res.label }}</span>
                <span class="ml-2 text-slate-500">{{ res.path }}</span>
                <div v-if="res.isHtml" class="text-amber-600 dark:text-amber-400 font-sans font-semibold mt-0.5">
                  HTML page returned — re-open PC Manager session on your phone.
                </div>
                <div v-else-if="res.error" class="text-rose-600 dark:text-rose-400 font-sans mt-0.5">
                  {{ res.error }}
                </div>
              </div>
              <div class="text-right tabular-nums">
                <span
                  class="px-2 py-0.5 rounded font-bold"
                  :class="res.ok && !res.isHtml ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'"
                >
                  HTTP {{ res.status || 'ERR' }} • {{ res.elapsedMs }}ms
                </span>
                <div v-if="res.topLevelKeys.length" class="text-[10px] text-slate-500 mt-0.5">
                  keys: {{ res.topLevelKeys.join(', ') }} ({{ res.sampleCount }} rows)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bridge 2: SQLite Backup Vault -->
      <div class="p-4 rounded-xl panel-surface border space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="text-xs font-bold flex items-center gap-2">
            <Cloud class="w-4 h-4 text-sky-500" />
            Bridge 2: Google Drive / Mega SQLite Vault (money_android.sqlite)
          </div>
          <button
            type="button"
            @click="runSampleVaultSync"
            :disabled="syncingVault"
            class="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
          >
            Run Sample SQLite Vault Sync
          </button>
        </div>

        <input
          v-model="store.cloudSyncPath"
          @change="store.persistState()"
          class="w-full input-surface border rounded-xl px-3 py-2 text-xs font-mono"
        />

        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <button
              v-if="isElectronRuntime"
              type="button"
              @click="pickNativeSqliteFile"
              class="px-3 py-1.5 rounded-xl bg-slate-900 text-white dark:bg-slate-800 text-xs font-semibold flex items-center gap-1.5"
            >
              <FolderOpen class="w-3.5 h-3.5" /> Open Binary .sqlite / .sql / .json
            </button>
            <label
              v-else
              class="px-3 py-1.5 rounded-xl card-surface border text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
            >
              <FolderOpen class="w-3.5 h-3.5" />
              <span>Process SQLite Backup Vault</span>
              <input type="file" accept=".sqlite,.db,.sql,.json" class="hidden" @change="handleVaultFileUpload" />
            </label>
          </div>
          <span class="text-[11px] text-slate-500 font-mono">Supports binary .sqlite (better-sqlite3), .sql, .json</span>
        </div>
      </div>

      <div v-if="syncError" class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400">
        {{ syncError }}
      </div>

      <!-- Live Sync Report -->
      <div v-if="store.lastSyncReport" class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Latest Sync Reconciliation Report
          </span>
          <span class="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-mono text-[10px]">
            {{ store.lastSyncReport.source === 'realbyte_pc_manager' ? 'PC Manager Wi-Fi' : 'SQLite Vault' }}
          </span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs tabular-nums">
          <div class="card-surface border p-2.5 rounded-xl">
            <div class="text-[10px] text-slate-500">WAL Mode</div>
            <div class="font-bold" :class="store.lastSyncReport.walModeVerified ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'">
              {{ store.lastSyncReport.walModeVerified ? 'Verified (WAL)' : 'Non-WAL' }}
            </div>
          </div>
          <div class="card-surface border p-2.5 rounded-xl">
            <div class="text-[10px] text-slate-500">Inserted</div>
            <div class="font-bold text-emerald-600 dark:text-emerald-400">{{ store.lastSyncReport.insertedTransactions }}</div>
          </div>
          <div class="card-surface border p-2.5 rounded-xl">
            <div class="text-[10px] text-slate-500">Updated (LWW)</div>
            <div class="font-bold text-sky-600 dark:text-sky-400">{{ store.lastSyncReport.updatedTransactions }}</div>
          </div>
          <div class="card-surface border p-2.5 rounded-xl">
            <div class="text-[10px] text-slate-500">Skipped Duplicates</div>
            <div class="font-bold">{{ store.lastSyncReport.skippedDuplicates }}</div>
          </div>
        </div>
      </div>

      <!-- Sync Audit Log (sync_logs) -->
      <div v-if="store.syncLogs.length > 0" class="pt-1">
        <button
          type="button"
          @click="showSyncLogs = !showSyncLogs"
          class="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:underline flex items-center gap-1.5"
        >
          <History class="w-3.5 h-3.5" />
          {{ showSyncLogs ? 'Hide' : 'Show' }} Sync Audit Log ({{ store.syncLogs.length }})
        </button>

        <div v-if="showSyncLogs" class="mt-2 space-y-1.5 max-h-48 overflow-y-auto scroller text-xs">
          <div
            v-for="log in store.syncLogs"
            :key="log.id"
            class="panel-surface border rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 tabular-nums"
          >
            <div>
              <span class="font-bold" :class="log.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
                {{ log.status.toUpperCase() }}
              </span>
              <span class="ml-2 font-mono text-[11px]">{{ log.source }}</span>
              <span v-if="log.scopeLabel" class="ml-1 text-[11px] text-slate-500">({{ log.scopeLabel }})</span>
              <div v-if="log.errorMessage" class="text-[11px] text-rose-500">{{ log.errorMessage }}</div>
            </div>
            <div class="text-[11px] text-slate-500 font-mono">
              +{{ log.insertedCount }} / ~{{ log.updatedCount }} / ={{ log.skippedCount }} •
              {{ new Date(log.timestamp).toLocaleString() }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Exchange Rates (Multi-Currency) -->
    <div v-if="store.featureFlags.enableMultiCurrency" class="card-surface border rounded-2xl p-5 shadow-sm space-y-3">
      <h3 class="font-bold text-base flex items-center gap-2">
        <Globe class="w-4 h-4 text-sky-500" />
        Multi-Currency Exchange Rates (to BDT)
      </h3>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
        <div
          v-for="(rate, code) in store.exchangeRates"
          :key="code"
          class="panel-surface border rounded-xl p-2.5 space-y-1"
        >
          <div class="font-bold">{{ code }}</div>
          <input
            type="number"
            step="0.01"
            min="0.01"
            :disabled="code === 'BDT'"
            :value="rate"
            @change="onExchangeRateChange(String(code), $event)"
            class="w-full input-surface border rounded-lg px-2 py-1 font-mono tabular-nums"
          />
        </div>
      </div>
    </div>

    <!-- Recurring Bills & Auto-Categorization Rules -->
    <template v-if="store.featureFlags.enableRulesAndRecurring">
      <div class="card-surface border rounded-2xl p-5 shadow-sm space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="font-bold text-base flex items-center gap-2">
              <CalendarClock class="w-4 h-4 text-amber-500" />
              Recurring Bills & Scheduled Transactions
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Automate monthly rent, utilities, and scheduled subscription payments.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="handlePostDueBills"
              class="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
            >
              Post Due Bills
            </button>
            <button
              type="button"
              @click="showAddRecurringModal = true"
              class="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
            >
              + Add Recurring
            </button>
          </div>
        </div>

        <div v-if="postResultMsg" class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 font-semibold">
          {{ postResultMsg }}
        </div>

        <div class="space-y-2">
          <div
            v-for="sched in store.recurringSchedules"
            :key="sched.id"
            class="panel-surface border rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
          >
            <div>
              <div class="font-bold flex items-center gap-2">
                <span>{{ sched.name }}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full card-surface border uppercase">{{ sched.frequency }}</span>
              </div>
              <div class="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 tabular-nums">
                {{ getCategoryName(sched.categoryId) }} • {{ getAccountName(sched.accountId) }} • Due: {{ sched.nextDueDate }}
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="font-bold tabular-nums" :class="sched.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
                {{ sched.type === 'income' ? '+' : '-' }}৳{{ sched.amount.toLocaleString('en-US') }}
              </span>
              <button
                type="button"
                @click="store.deleteRecurringSchedule(sched.id)"
                aria-label="Delete Schedule"
                class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Auto-Categorization Rules -->
      <div class="card-surface border rounded-2xl p-5 shadow-sm space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="font-bold text-base flex items-center gap-2">
              <Sparkles class="w-4 h-4 text-rose-500" />
              Auto-Categorization Rules (Actual Budget Engine)
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Automatically tag categories based on payee, note, or multi-keyword matching.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="handleRunRulesBackfill"
              class="px-3 py-1.5 rounded-xl panel-surface border text-xs font-semibold hover:border-emerald-500"
            >
              Run Rules on Existing Transactions
            </button>
            <button
              type="button"
              @click="showAddRuleModal = true"
              class="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
            >
              + Add Rule
            </button>
          </div>
        </div>

        <div v-if="rulesRunMsg" class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
          {{ rulesRunMsg }}
        </div>

        <div class="space-y-2">
          <div
            v-for="rule in store.rules"
            :key="rule.id"
            class="panel-surface border rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
          >
            <div class="space-y-1">
              <div class="font-bold">{{ rule.name }}</div>
              <div class="flex items-center gap-1.5 flex-wrap font-mono text-[11px]">
                <span v-for="(cond, idx) in rule.conditions" :key="idx" class="px-2 py-0.5 rounded card-surface border">
                  {{ cond.field }} {{ cond.operator }} "{{ cond.value }}"
                </span>
                <span>→</span>
                <span
                  v-for="(act, idx) in rule.actions"
                  :key="'act-' + idx"
                  class="px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-300 font-semibold"
                >
                  {{ act.field }}: {{ getCategoryName(String(act.value)) }}
                </span>
              </div>
            </div>
            <button
              type="button"
              @click="store.deleteRule(rule.id)"
              aria-label="Delete Rule"
              class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Double-Entry Trial Balance & Beancount Export -->
    <div v-if="store.featureFlags.enableDoubleEntry" class="card-surface border rounded-2xl p-5 shadow-sm space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="font-bold text-base flex items-center gap-2">
            <Scale class="w-4 h-4 text-emerald-500" />
            Double-Entry Ledger & Beancount Export
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Strict verification of Debits = Credits across all accounts and categories.
          </p>
        </div>
        <span
          class="px-2.5 py-1 rounded-full text-xs font-bold"
          :class="store.trialBalance.isBalanced ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-rose-500/15 text-rose-600'"
        >
          {{ store.trialBalance.isBalanced ? 'Balanced Ledger' : 'Imbalance Detected' }}
        </span>
      </div>

      <div class="grid grid-cols-3 gap-2 text-center text-xs tabular-nums">
        <div class="panel-surface border p-2.5 rounded-xl">
          <div class="text-[11px] text-slate-500">Total Debits</div>
          <div class="font-bold text-emerald-600 dark:text-emerald-400">৳{{ store.trialBalance.totalDebits.toLocaleString('en-US') }}</div>
        </div>
        <div class="panel-surface border p-2.5 rounded-xl">
          <div class="text-[11px] text-slate-500">Total Credits</div>
          <div class="font-bold text-rose-600 dark:text-rose-400">৳{{ store.trialBalance.totalCredits.toLocaleString('en-US') }}</div>
        </div>
        <div class="panel-surface border p-2.5 rounded-xl">
          <div class="text-[11px] text-slate-500">Variance</div>
          <div class="font-bold">৳{{ Math.abs(store.trialBalance.totalDebits - store.trialBalance.totalCredits).toFixed(2) }}</div>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
        <button type="button" @click="showBeancountPreview = !showBeancountPreview" class="font-semibold hover:underline">
          {{ showBeancountPreview ? 'Hide' : 'Show' }} Beancount Preview ({{ store.doubleEntryJournal.length }} entries)
        </button>
        <div class="flex items-center gap-2">
          <button type="button" @click="copyBeancount" class="px-2.5 py-1 rounded-lg panel-surface border font-semibold">
            {{ copySuccess ? 'Copied' : 'Copy' }}
          </button>
          <button type="button" @click="exportBeancountFile" class="px-2.5 py-1 rounded-lg panel-surface border font-semibold">
            Save .beancount
          </button>
        </div>
      </div>

      <pre
        v-if="showBeancountPreview"
        class="panel-surface border rounded-xl p-3 text-[11px] font-mono text-emerald-700 dark:text-emerald-400 overflow-x-auto max-h-56"
      >{{ store.beancountExport }}</pre>
    </div>

    <!-- Data Export, Plain & Encrypted JSON Vault Backup -->
    <div class="card-surface border rounded-2xl p-5 shadow-sm space-y-3">
      <div>
        <h3 class="font-bold text-base flex items-center gap-2">
          <Shield class="w-4 h-4 text-sky-500" />
          Data Export & Encrypted Backup Vault
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Export RFC-4180 CSV reports, plain JSON backups, or AES-256-GCM encrypted vault files.
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
        <button
          type="button"
          @click="downloadLedgerCsv"
          class="p-3.5 rounded-xl panel-surface border hover:border-rose-500 text-left space-y-1"
        >
          <div class="font-bold flex items-center gap-1.5">
            <Download class="w-3.5 h-3.5 text-rose-500" /> Export CSV
          </div>
          <p class="text-[11px] text-slate-500">{{ store.transactions.length }} transactions</p>
        </button>

        <button
          v-if="store.featureFlags.enableJsonVaultBackup"
          type="button"
          @click="downloadFullJsonVault"
          class="p-3.5 rounded-xl panel-surface border hover:border-sky-500 text-left space-y-1"
        >
          <div class="font-bold flex items-center gap-1.5">
            <Database class="w-3.5 h-3.5 text-sky-500" /> Plain JSON Vault
          </div>
          <p class="text-[11px] text-slate-500">Full unencrypted snapshot</p>
        </button>

        <button
          v-if="store.featureFlags.enableJsonVaultBackup"
          type="button"
          @click="openEncryptExportModal"
          class="p-3.5 rounded-xl panel-surface border hover:border-emerald-500 text-left space-y-1"
        >
          <div class="font-bold flex items-center gap-1.5">
            <Lock class="w-3.5 h-3.5 text-emerald-500" /> Encrypted JSON Vault
          </div>
          <p class="text-[11px] text-slate-500">AES-256-GCM passphrase protected</p>
        </button>

        <label
          v-if="store.featureFlags.enableJsonVaultBackup"
          class="p-3.5 rounded-xl panel-surface border hover:border-indigo-500 text-left space-y-1 cursor-pointer"
        >
          <div class="font-bold flex items-center gap-1.5">
            <Upload class="w-3.5 h-3.5 text-indigo-500" /> Restore JSON Vault
          </div>
          <p class="text-[11px] text-slate-500">Plain or encrypted .json</p>
          <input type="file" accept=".json" class="hidden" @change="handleVaultFileUpload" />
        </label>
      </div>

      <div v-if="vaultStatusMsg" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        {{ vaultStatusMsg }}
      </div>
    </div>

    <!-- Dry-Run Sync Preview Modal -->
    <BaseModal
      v-model="showDryRunModal"
      title="Dry-Run Sync Preview"
      subtitle="Review incoming changes from Realbyte before committing to your ledger"
      maxWidthClass="max-w-xl"
    >
      <div v-if="dryRunReport" class="space-y-3 text-xs">
        <div class="grid grid-cols-4 gap-2 text-center tabular-nums">
          <div class="panel-surface border p-2.5 rounded-xl">
            <div class="text-[10px] text-slate-500">New</div>
            <div class="font-bold text-emerald-600 dark:text-emerald-400">+{{ dryRunReport.insertedTransactions }}</div>
          </div>
          <div class="panel-surface border p-2.5 rounded-xl">
            <div class="text-[10px] text-slate-500">Updated</div>
            <div class="font-bold text-sky-600 dark:text-sky-400">~{{ dryRunReport.updatedTransactions }}</div>
          </div>
          <div class="panel-surface border p-2.5 rounded-xl">
            <div class="text-[10px] text-slate-500">Skipped</div>
            <div class="font-bold">={{ dryRunReport.skippedDuplicates }}</div>
          </div>
          <div class="panel-surface border p-2.5 rounded-xl">
            <div class="text-[10px] text-slate-500">Deleted on Phone</div>
            <div class="font-bold text-rose-600 dark:text-rose-400">-{{ dryRunReport.deletedOnRemote || 0 }}</div>
          </div>
        </div>

        <div v-if="dryRunReport.previewDiff?.toInsert.length" class="space-y-1 max-h-40 overflow-y-auto scroller">
          <div class="font-bold text-emerald-600 dark:text-emerald-400">Incoming New Transactions:</div>
          <div
            v-for="t in dryRunReport.previewDiff.toInsert.slice(0, 20)"
            :key="t.id"
            class="panel-surface border rounded-lg px-2.5 py-1.5 flex justify-between tabular-nums"
          >
            <span>{{ t.date }} • {{ t.note || t.description || t.categoryId }}</span>
            <strong>৳{{ t.amount.toLocaleString('en-US') }}</strong>
          </div>
        </div>

        <div v-if="(dryRunReport.deletedOnRemote || 0) > 0" class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2">
          <label class="flex items-center gap-2 font-semibold cursor-pointer">
            <input v-model="applyDryRunDeletions" type="checkbox" />
            <span>Also delete {{ dryRunReport.deletedOnRemote }} PC records removed on phone</span>
          </label>
        </div>
      </div>

      <template #footer>
        <button type="button" @click="showDryRunModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button
          type="button"
          @click="commitDryRunSync"
          class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
        >
          Commit Sync
        </button>
      </template>
    </BaseModal>

    <!-- Encrypted Vault Export / Decrypt Passphrase Modals -->
    <BaseModal v-model="showEncryptModal" title="Export AES-256-GCM Encrypted Vault" maxWidthClass="max-w-sm">
      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-semibold mb-1">Encryption Passphrase (min 4 chars)</label>
          <input v-model="encryptPassphrase" type="password" placeholder="Enter passphrase" class="w-full input-surface border rounded-xl px-3 py-2" />
        </div>
        <div v-if="vaultModalError" class="text-rose-600 dark:text-rose-400 font-semibold">{{ vaultModalError }}</div>
      </div>
      <template #footer>
        <button type="button" @click="showEncryptModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button type="button" @click="handleExportEncryptedVault" class="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold">
          Encrypt & Export
        </button>
      </template>
    </BaseModal>

    <BaseModal v-model="showDecryptModal" title="Decrypt Vault Backup" maxWidthClass="max-w-sm">
      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-semibold mb-1">Vault Passphrase</label>
          <input v-model="decryptPassphrase" type="password" placeholder="Enter passphrase" class="w-full input-surface border rounded-xl px-3 py-2" />
        </div>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input v-model="decryptRestoreMode" type="radio" value="merge" /> Merge
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <input v-model="decryptRestoreMode" type="radio" value="replace" /> Replace State
          </label>
        </div>
        <div v-if="vaultModalError" class="text-rose-600 dark:text-rose-400 font-semibold">{{ vaultModalError }}</div>
      </div>
      <template #footer>
        <button type="button" @click="showDecryptModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button type="button" @click="handleDecryptAndRestore" class="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold">
          Decrypt & Restore
        </button>
      </template>
    </BaseModal>

    <!-- Add Rule Modal -->
    <BaseModal v-model="showAddRuleModal" title="Add Auto-Categorization Rule" maxWidthClass="max-w-md">
      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-semibold mb-1">Rule Name</label>
          <input v-model="newRuleName" placeholder="e.g. Agora / Shwapno → Groceries" class="w-full input-surface border rounded-xl px-3 py-2" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Target Field</label>
            <select v-model="newRuleField" class="w-full input-surface border rounded-xl px-3 py-2">
              <option value="note">Note</option>
              <option value="payee">Payee</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold mb-1">Keywords (comma-separated)</label>
            <input v-model="newRuleKeyword" placeholder="e.g. agora, unimart" class="w-full input-surface border rounded-xl px-3 py-2" />
          </div>
        </div>
        <div>
          <label class="block font-semibold mb-1">Assign Category</label>
          <select v-model="newRuleCategoryId" class="w-full input-surface border rounded-xl px-3 py-2">
            <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">
              {{ cat.name }} ({{ cat.type }})
            </option>
          </select>
        </div>
      </div>
      <template #footer>
        <button type="button" @click="showAddRuleModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button
          type="button"
          @click="handleAddRule"
          :disabled="!newRuleName.trim() || !newRuleKeyword.trim()"
          class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-semibold"
        >
          Save Rule
        </button>
      </template>
    </BaseModal>

    <!-- Add Recurring Schedule Modal -->
    <BaseModal v-model="showAddRecurringModal" title="Add Recurring Bill / Income" maxWidthClass="max-w-md">
      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-semibold mb-1">Schedule Name</label>
          <input v-model="newSchedule.name" placeholder="e.g. Monthly Internet Bill" class="w-full input-surface border rounded-xl px-3 py-2" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Type</label>
            <select v-model="newSchedule.type" @change="handleNewScheduleTypeChange" class="w-full input-surface border rounded-xl px-3 py-2">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold mb-1">Amount (৳)</label>
            <input v-model.number="newSchedule.amount" type="number" class="w-full input-surface border rounded-xl px-3 py-2 tabular-nums font-bold" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Category</label>
            <select v-model="newSchedule.categoryId" class="w-full input-surface border rounded-xl px-3 py-2">
              <option v-for="cat in store.categories.filter((c) => c.type === newSchedule.type)" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="block font-semibold mb-1">Account</label>
            <select v-model="newSchedule.accountId" class="w-full input-surface border rounded-xl px-3 py-2">
              <option v-for="acc in store.accounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Frequency</label>
            <select v-model="newSchedule.frequency" class="w-full input-surface border rounded-xl px-3 py-2">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="weekly">Weekly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold mb-1">Next Due Date</label>
            <input v-model="newSchedule.nextDueDate" type="date" class="w-full input-surface border rounded-xl px-3 py-2" />
          </div>
        </div>
        <div>
          <label class="block font-semibold mb-1">Note</label>
          <input v-model="newSchedule.note" class="w-full input-surface border rounded-xl px-3 py-2" />
        </div>
      </div>
      <template #footer>
        <button type="button" @click="showAddRecurringModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button
          type="button"
          @click="handleAddRecurring"
          :disabled="!newSchedule.name.trim() || newSchedule.amount <= 0"
          class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-semibold"
        >
          Save Schedule
        </button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue';
import {
  CalendarClock,
  Cloud,
  Database,
  Download,
  FolderOpen,
  Globe,
  History,
  Lock,
  RefreshCw,
  Scale,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Wifi,
} from 'lucide-vue-next';
import BaseModal from './BaseModal.vue';
import { useMoneyStore, getLocalTodayISO } from '../store';
import { RealbytePcManagerClient } from '../modules/realbyte/client';
import { decryptVaultJson, encryptVaultJson, isEncryptedVaultPayload } from '../modules/exporters/vaultCrypto';
import { saveExportFile } from '../utils/format';
import type { FeatureFlags, RealbyteProbeEndpointResult, SyncReconciliationReport, TransactionType } from '../types';

const store = useMoneyStore();
const isElectronRuntime = computed(() => Boolean(typeof window !== 'undefined' && window.moneyApi?.isElectron));

const featureFlagItems: { key: keyof FeatureFlags; label: string; desc: string }[] = [
  { key: 'enableSanchaypatra', label: 'Sanchaypatra & FDR', desc: 'Bangladesh savings certificates & FDR/DPS' },
  { key: 'enableVisualCharts', label: 'Visual Charts', desc: 'Category donut, cashflow bars, net worth trend' },
  { key: 'enableEnvelopeBudgets', label: 'Envelope Budgets', desc: 'Monthly category spending allocations' },
  { key: 'enableSavingsGoals', label: 'Savings Goals', desc: 'Dedicated sinking funds & target milestones' },
  { key: 'enableCreditCardEmi', label: 'Credit Card EMI', desc: 'Card limit tracking & installment plans' },
  { key: 'enableIouKhata', label: 'IOU Khata', desc: 'Lent & borrowed tracking with settlements' },
  { key: 'enableRulesAndRecurring', label: 'Rules & Recurring', desc: 'Auto-categorization & scheduled bills' },
  { key: 'enableBankImporters', label: 'Bank Importers', desc: 'OFX, CAMT.053 XML, CSV & QIF statements' },
  { key: 'enableMultiCurrency', label: 'Multi-Currency', desc: 'Foreign currency FX rates to BDT' },
  { key: 'enableReceipts', label: 'Receipts', desc: 'Attach local image/PDF receipts' },
  { key: 'enableDoubleEntry', label: 'Double-Entry Ledger', desc: 'Trial balance & Beancount export' },
  { key: 'enableJsonVaultBackup', label: 'JSON Vault Backup', desc: 'Plain & AES-256-GCM encrypted backups' },
  { key: 'enablePrivacyMode', label: 'Privacy Masking', desc: 'Hide balances on screen (Shift+P)' },
];

// Sync State
const connectionTestResult = ref<{ success: boolean; message: string } | null>(null);
const syncingPcManager = ref(false);
const syncingVault = ref(false);
const syncError = ref('');
const showSyncLogs = ref(false);

// Diagnostic Inspector
const probingEndpoints = ref(false);
const showDiagnosticInspector = ref(false);
const probeResults = ref<RealbyteProbeEndpointResult[]>([]);

// Dry-Run Preview
const showDryRunModal = ref(false);
const dryRunReport = ref<SyncReconciliationReport | null>(null);
const applyDryRunDeletions = ref(false);

let postMsgTimer: ReturnType<typeof setTimeout> | null = null;
let copyTimer: ReturnType<typeof setTimeout> | null = null;

onUnmounted(() => {
  if (postMsgTimer) clearTimeout(postMsgTimer);
  if (copyTimer) clearTimeout(copyTimer);
});

async function testPhoneConnection() {
  connectionTestResult.value = { success: false, message: 'Pinging Realbyte phone server...' };
  const client = new RealbytePcManagerClient(store.phoneIp, store.phonePort, store.realbyteEndpointOverrides);
  const ok = await client.checkConnection();
  connectionTestResult.value = ok
    ? { success: true, message: `Connected to Realbyte PC Manager at ${store.phoneIp}:${store.phonePort}` }
    : { success: false, message: `Could not reach ${store.phoneIp}:${store.phonePort}. Enable PC Manager on your phone.` };
}

async function runEndpointProbe() {
  probingEndpoints.value = true;
  showDiagnosticInspector.value = true;
  try {
    const client = new RealbytePcManagerClient(store.phoneIp, store.phonePort, store.realbyteEndpointOverrides);
    probeResults.value = await client.probeEndpoints();
  } finally {
    probingEndpoints.value = false;
  }
}

async function runPcManagerDryRun() {
  syncingPcManager.value = true;
  syncError.value = '';
  try {
    dryRunReport.value = await store.syncFromPcManager(undefined, {
      scope: store.syncScope,
      dryRun: true,
    });
    applyDryRunDeletions.value = false;
    showDryRunModal.value = true;
  } catch (err: any) {
    syncError.value = err?.message || 'Dry-run preview failed.';
  } finally {
    syncingPcManager.value = false;
  }
}

async function commitDryRunSync() {
  showDryRunModal.value = false;
  syncingPcManager.value = true;
  syncError.value = '';
  try {
    await store.syncFromPcManager(undefined, {
      scope: store.syncScope,
      dryRun: false,
      applyRemoteDeletions: applyDryRunDeletions.value,
    });
  } catch (err: any) {
    syncError.value = err?.message || 'PC Manager sync failed.';
  } finally {
    syncingPcManager.value = false;
  }
}

async function runPcManagerSync() {
  syncingPcManager.value = true;
  syncError.value = '';
  try {
    await store.syncFromPcManager(undefined, { scope: store.syncScope });
  } catch (err: any) {
    syncError.value = err?.message || 'PC Manager sync failed.';
  } finally {
    syncingPcManager.value = false;
  }
}

const sampleVaultDump = {
  assets: [
    { UID: 1, NAME: 'Cash Wallet', AMOUNT: 8500, ASSET_TYPE: 'cash', CURRENCY: 'BDT' },
    { UID: 4, NAME: 'bKash Personal', AMOUNT: 12450, ASSET_TYPE: 'mfs', CURRENCY: 'BDT' },
  ],
  categories: [
    { UID: 101, NAME: 'Groceries & Bazar', DO_TYPE: '1' },
    { UID: 105, NAME: 'Dining & Snacks', DO_TYPE: '1' },
  ],
  inoutcome: [
    { UID: 5003, WDATE: 1762172000000, UTIME: 1762172000000, DO_TYPE: '1', MONEY: 3500, ASSET_UID: 4, CATEGORY_UID: 101, NOTE: 'Unimart bazar' },
    { UID: 5007, WDATE: 1762430000000, UTIME: 1762430000000, DO_TYPE: '1', MONEY: 650, ASSET_UID: 1, CATEGORY_UID: 105, NOTE: 'Evening Kacchi & Cha (Synced via PC Manager)' },
    { UID: 5008, WDATE: 1762518000000, UTIME: 1762518000000, DO_TYPE: '1', MONEY: 1850, ASSET_UID: 1, CATEGORY_UID: 101, NOTE: 'Fresh Fish Bazar & Spices (New Vault Record)' },
  ],
};

async function runSampleVaultSync() {
  syncingVault.value = true;
  syncError.value = '';
  try {
    await store.syncFromSqliteVault(sampleVaultDump);
  } catch (err: any) {
    syncError.value = err?.message || 'Failed to process SQLite vault.';
  } finally {
    syncingVault.value = false;
  }
}

async function pickNativeSqliteFile() {
  if (!window.moneyApi?.fs?.pickFile) return;
  syncError.value = '';
  const picked = await window.moneyApi.fs.pickFile({
    title: 'Select Realbyte Backup (.sqlite, .sql, .json)',
    filters: [{ name: 'Money Manager Backups', extensions: ['sqlite', 'db', 'sql', 'json'] }],
  });
  if (picked.canceled || !picked.filePath) return;

  store.cloudSyncPath = picked.filePath;
  syncingVault.value = true;
  try {
    const lower = picked.filePath.toLowerCase();
    if (lower.endsWith('.json') && picked.textContent) {
      await handleJsonStringUpload(picked.textContent);
    } else if (lower.endsWith('.sql') && picked.textContent) {
      await store.syncFromSqliteVault(picked.textContent);
    } else {
      await store.syncFromSqliteVault(null, { filePath: picked.filePath });
    }
  } catch (err: any) {
    syncError.value = err?.message || 'Error processing backup file.';
  } finally {
    syncingVault.value = false;
  }
}

// Encrypted Vault & JSON Restore
const showEncryptModal = ref(false);
const encryptPassphrase = ref('');
const showDecryptModal = ref(false);
const decryptPassphrase = ref('');
const decryptRestoreMode = ref<'merge' | 'replace'>('merge');
const pendingEncryptedPayload = ref('');
const vaultModalError = ref('');
const vaultStatusMsg = ref('');

async function handleJsonStringUpload(text: string) {
  const json = JSON.parse(text);
  if (isEncryptedVaultPayload(json)) {
    pendingEncryptedPayload.value = text;
    decryptPassphrase.value = '';
    vaultModalError.value = '';
    showDecryptModal.value = true;
    return;
  }
  if (
    json &&
    (json.schema === 'money-manager-vault-v1' ||
      (Array.isArray(json.transactions) && Array.isArray(json.accounts) && !json.inoutcome && !json.INOUTCOME))
  ) {
    const res = store.restoreFullBackupJson(json, 'merge');
    vaultStatusMsg.value = `Restored vault: ${res.restoredTransactions} transactions, ${res.restoredAccounts} accounts.`;
  } else {
    await store.syncFromSqliteVault(json);
  }
}

async function handleVaultFileUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  syncingVault.value = true;
  syncError.value = '';
  try {
    if (file.name.endsWith('.json')) {
      await handleJsonStringUpload(await file.text());
    } else if (file.name.endsWith('.sql')) {
      await store.syncFromSqliteVault(await file.text());
    } else {
      await store.syncFromSqliteVault(await file.arrayBuffer());
    }
  } catch (err: any) {
    syncError.value = err?.message || 'Error processing vault file.';
  } finally {
    syncingVault.value = false;
  }
}

function openEncryptExportModal() {
  encryptPassphrase.value = '';
  vaultModalError.value = '';
  showEncryptModal.value = true;
}

async function handleExportEncryptedVault() {
  vaultModalError.value = '';
  try {
    const encrypted = await encryptVaultJson(store.fullBackupJson, encryptPassphrase.value);
    const saved = await saveExportFile({
      defaultName: 'money-manager-vault-encrypted.json',
      content: encrypted,
      mimeType: 'application/json;charset=utf-8;',
      filterLabel: 'Encrypted JSON Vault',
      extensions: ['json'],
    });
    showEncryptModal.value = false;
    if (saved.saved) {
      vaultStatusMsg.value = 'Exported AES-256-GCM encrypted JSON vault.';
    }
  } catch (err: any) {
    vaultModalError.value = err?.message || 'Encryption failed.';
  }
}

async function handleDecryptAndRestore() {
  vaultModalError.value = '';
  try {
    const plain = await decryptVaultJson(pendingEncryptedPayload.value, decryptPassphrase.value);
    const res = store.restoreFullBackupJson(plain, decryptRestoreMode.value);
    showDecryptModal.value = false;
    vaultStatusMsg.value = `Decrypted & restored ${res.restoredTransactions} transactions (${decryptRestoreMode.value}).`;
  } catch (err: any) {
    vaultModalError.value = err?.message || 'Decryption failed.';
  }
}

function onExchangeRateChange(code: string, e: Event) {
  const val = Number((e.target as HTMLInputElement).value || 0);
  if (val > 0) store.updateExchangeRate(code, val);
}

// Rules & Recurring
const showAddRuleModal = ref(false);
const newRuleName = ref('');
const newRuleField = ref<'note' | 'payee'>('note');
const newRuleKeyword = ref('');
const newRuleCategoryId = ref(store.categories[0]?.id || '');
const rulesRunMsg = ref('');

function handleRunRulesBackfill() {
  const count = store.runRulesOnExistingTransactions();
  rulesRunMsg.value =
    count > 0
      ? `Re-categorized ${count} existing transactions using active rules.`
      : 'All existing transactions already match current rules.';
}

function handleAddRule() {
  if (!newRuleName.value.trim() || !newRuleKeyword.value.trim() || !newRuleCategoryId.value) return;
  store.addRule({
    name: newRuleName.value.trim(),
    enabled: true,
    matchMode: 'ANY',
    conditions: [{ field: newRuleField.value, operator: 'contains', value: newRuleKeyword.value.trim().toLowerCase() }],
    actions: [{ field: 'categoryId', value: newRuleCategoryId.value }],
  });
  showAddRuleModal.value = false;
  newRuleName.value = '';
  newRuleKeyword.value = '';
}

const showAddRecurringModal = ref(false);
const postResultMsg = ref('');
const newSchedule = ref({
  name: '',
  amount: 0,
  type: 'expense' as TransactionType,
  categoryId: store.categories[0]?.id || '',
  accountId: store.accounts[0]?.id || '',
  frequency: 'monthly' as 'monthly' | 'quarterly' | 'yearly' | 'weekly',
  nextDueDate: getLocalTodayISO(),
  autoPost: true,
  note: '',
});

function handlePostDueBills() {
  const todayISO = getLocalTodayISO();
  const count = store.runDueRecurringSchedules(todayISO);
  postResultMsg.value =
    count > 0
      ? `Posted ${count} due recurring bills.`
      : `No bills are due as of ${todayISO}.`;
  if (postMsgTimer) clearTimeout(postMsgTimer);
  postMsgTimer = setTimeout(() => {
    postResultMsg.value = '';
  }, 4000);
}

function handleNewScheduleTypeChange() {
  const currentCat = store.categories.find((c) => c.id === newSchedule.value.categoryId);
  if (!currentCat || currentCat.type !== newSchedule.value.type) {
    const first = store.categories.find((c) => c.type === newSchedule.value.type);
    if (first) newSchedule.value.categoryId = first.id;
  }
}

function handleAddRecurring() {
  if (!newSchedule.value.name.trim() || newSchedule.value.amount <= 0) return;
  store.addRecurringSchedule({
    name: newSchedule.value.name.trim(),
    amount: newSchedule.value.amount,
    type: newSchedule.value.type,
    categoryId: newSchedule.value.categoryId,
    accountId: newSchedule.value.accountId,
    frequency: newSchedule.value.frequency,
    nextDueDate: newSchedule.value.nextDueDate,
    autoPost: newSchedule.value.autoPost,
    note: newSchedule.value.note.trim(),
  });
  showAddRecurringModal.value = false;
  newSchedule.value.name = '';
  newSchedule.value.amount = 0;
  newSchedule.value.note = '';
}

// Beancount & Exports
const showBeancountPreview = ref(false);
const copySuccess = ref(false);

async function copyBeancount() {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(store.beancountExport);
      copySuccess.value = true;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copySuccess.value = false;
      }, 2000);
    }
  } catch {
    // Ignore clipboard failure
  }
}

async function exportBeancountFile() {
  await saveExportFile({
    defaultName: 'money-manager-ledger.beancount',
    content: store.beancountExport,
    mimeType: 'text/plain;charset=utf-8;',
    filterLabel: 'Beancount Ledger',
    extensions: ['beancount', 'txt'],
  });
}

async function downloadLedgerCsv() {
  await saveExportFile({
    defaultName: 'money-manager-ledger.csv',
    content: store.csvExport,
    mimeType: 'text/csv;charset=utf-8;',
    filterLabel: 'CSV Spreadsheet',
    extensions: ['csv'],
  });
}

async function downloadFullJsonVault() {
  await saveExportFile({
    defaultName: 'money-manager-vault-backup.json',
    content: store.fullBackupJson,
    mimeType: 'application/json;charset=utf-8;',
    filterLabel: 'JSON Backup Vault',
    extensions: ['json'],
  });
}

function getCategoryName(catId: string): string {
  return store.categories.find((c) => c.id === catId)?.name || catId;
}

function getAccountName(accId: string): string {
  return store.accounts.find((a) => a.id === accId)?.name || accId;
}
</script>
