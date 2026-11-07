<template>
  <div class="space-y-4">
    <!-- Budgeting Philosophy Toggle Card -->
    <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-xl space-y-3">
      <div>
        <h3 class="font-bold text-white text-base">Budgeting Philosophy</h3>
        <p class="text-xs text-slate-400 mt-0.5">Choose how you organize and track your finances.</p>
      </div>

      <div class="grid grid-cols-2 gap-3 pt-2">
        <div
          @click="store.budgetMode = 'cashflow_ledger'"
          class="p-4 rounded-xl border cursor-pointer transition-all space-y-1.5"
          :class="store.budgetMode === 'cashflow_ledger' ? 'border-rose-500 bg-rose-500/10' : 'border-slate-700 bg-slate-900/40 hover:bg-slate-700/30'"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-bold text-white">Cashflow & Calendar</span>
            <span v-if="store.budgetMode === 'cashflow_ledger'" class="text-rose-400 text-xs font-bold">✓ Active</span>
          </div>
          <p class="text-xs text-slate-400">
            Realbyte default. Fluid daily expense entry, color-coded calendar grid, and monthly cashflow sums.
          </p>
        </div>

        <div
          @click="store.budgetMode = 'envelope_allocation'"
          class="p-4 rounded-xl border cursor-pointer transition-all space-y-1.5"
          :class="store.budgetMode === 'envelope_allocation' ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-900/40 hover:bg-slate-700/30'"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-bold text-white">Zero-Based Envelope</span>
            <span v-if="store.budgetMode === 'envelope_allocation'" class="text-indigo-400 text-xs font-bold">✓ Active</span>
          </div>
          <p class="text-xs text-slate-400">
            Actual Budget mode. Assign every income dollar into monthly category envelopes with progress limits.
          </p>
        </div>
      </div>
    </div>

    <!-- Dual Sync Bridge Configuration -->
    <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-xl space-y-4">
      <div>
        <h3 class="font-bold text-white text-base">Synchronization Bridges</h3>
        <p class="text-xs text-slate-400 mt-0.5">Connect your phone's database to your PC via Cloud Drive or Local Wi-Fi.</p>
      </div>

      <!-- Sync Bridge 1: Local Wi-Fi PC Manager Server -->
      <div class="p-4 rounded-xl bg-slate-900/50 border border-slate-700/60 space-y-3">
        <div class="flex items-center justify-between">
          <div class="text-xs font-bold text-white flex items-center gap-2">
            <span>📶</span> Bridge 1: Realbyte Phone PC Manager (Local Wi-Fi Port 10000)
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="testPhoneConnection"
              class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold transition-all shadow-sm"
            >
              Test Connection
            </button>
            <button
              type="button"
              @click="runPcManagerSync"
              :disabled="syncingPcManager"
              class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-bold transition-all shadow-sm flex items-center gap-1"
            >
              <span>{{ syncingPcManager ? '⏳ Syncing...' : '🔄 Sync from PC Manager' }}</span>
            </button>
          </div>
        </div>

        <p class="text-xs text-slate-400">Connect directly to Realbyte's embedded Wi-Fi web server on your local network:</p>
        <div class="grid grid-cols-3 gap-2">
          <input
            v-model="store.phoneIp"
            placeholder="Phone IP (e.g. 192.168.1.105)"
            class="col-span-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-slate-500"
          />
          <input
            v-model.number="store.phonePort"
            type="number"
            placeholder="Port"
            class="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono text-center focus:outline-none focus:border-slate-500"
          />
        </div>
        <div v-if="connectionTestResult" class="text-xs font-semibold" :class="connectionTestResult.success ? 'text-emerald-400' : 'text-amber-400'">
          {{ connectionTestResult.message }}
        </div>
      </div>

      <!-- Sync Bridge 2: Google Drive / Mega Realbyte SQLite Vault (money_android.sqlite) -->
      <div class="p-4 rounded-xl bg-slate-900/50 border border-slate-700/60 space-y-3">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="text-xs font-bold text-white flex items-center gap-2">
            <span>☁️</span> Bridge 2: Google Drive / Mega Realbyte SQLite Vault (`money_android.sqlite`)
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="runSampleVaultSync"
              :disabled="syncingVault"
              class="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-[10px] font-bold transition-all shadow-sm"
            >
              Run Sample SQLite Vault Sync
            </button>
          </div>
        </div>

        <p class="text-xs text-slate-400">Path to mirrored Realbyte backup database file on your PC:</p>
        <input
          v-model="store.cloudSyncPath"
          class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-slate-500"
        />

        <div class="flex items-center justify-between pt-1">
          <label class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition-all inline-flex items-center gap-1.5">
            <span>📂 Process SQLite Backup Vault</span>
            <input
              type="file"
              accept=".sqlite,.db,.sql,.json"
              class="hidden"
              @change="handleVaultFileUpload"
            />
          </label>
          <span class="text-[11px] text-slate-500 font-mono">Supports .sqlite, .sql, .json</span>
        </div>
      </div>

      <div v-if="syncError" class="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300">
        {{ syncError }}
      </div>

      <!-- Live Sync Reconciliation Report Card -->
      <div
        v-if="store.lastSyncReport"
        class="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 space-y-3 shadow-xl"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h4 class="font-bold text-white text-xs tracking-wide uppercase">
              Live Sync Reconciliation Report
            </h4>
          </div>
          <span class="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
            {{ store.lastSyncReport.source === 'realbyte_pc_manager' ? 'PC Manager Wi-Fi' : 'SQLite Backup Vault' }}
          </span>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div class="bg-slate-900/80 p-2.5 rounded-xl border border-slate-700/50">
            <div class="text-[10px] text-slate-400">WAL Mode</div>
            <div class="font-bold text-xs" :class="store.lastSyncReport.walModeVerified ? 'text-emerald-400' : 'text-amber-400'">
              {{ store.lastSyncReport.walModeVerified ? '✓ Verified (WAL)' : 'Non-WAL' }}
            </div>
          </div>
          <div class="bg-slate-900/80 p-2.5 rounded-xl border border-slate-700/50">
            <div class="text-[10px] text-slate-400">Inserted</div>
            <div class="font-bold text-sm text-emerald-400">
              {{ store.lastSyncReport.insertedTransactions }}
            </div>
          </div>
          <div class="bg-slate-900/80 p-2.5 rounded-xl border border-slate-700/50">
            <div class="text-[10px] text-slate-400">Updated (LWW)</div>
            <div class="font-bold text-sm text-sky-400">
              {{ store.lastSyncReport.updatedTransactions }}
            </div>
          </div>
          <div class="bg-slate-900/80 p-2.5 rounded-xl border border-slate-700/50">
            <div class="text-[10px] text-slate-400">Skipped Duplicates</div>
            <div class="font-bold text-sm text-slate-300">
              {{ store.lastSyncReport.skippedDuplicates }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recurring Bills & Scheduled Transactions Card -->
    <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-xl space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 class="font-bold text-white text-base flex items-center gap-2">
            <span>📅</span> Recurring Bills & Scheduled Transactions
          </h3>
          <p class="text-xs text-slate-400 mt-0.5">
            Automate monthly rent, utilities, and scheduled subscription payments.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="handlePostDueBills"
            class="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1 active:scale-95"
            title="Post due scheduled bills up to 2026-12-05"
          >
            <span>⚡</span> Post Due Bills
          </button>
          <button
            type="button"
            @click="showAddRecurringModal = true"
            class="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold shadow-md transition-all whitespace-nowrap"
          >
            + Add Recurring
          </button>
        </div>
      </div>

      <div v-if="postResultMsg" class="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-300 font-semibold">
        {{ postResultMsg }}
      </div>

      <div v-if="store.recurringSchedules.length === 0" class="text-center py-6 text-slate-500 text-xs">
        No recurring bills scheduled.
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="sched in store.recurringSchedules"
          :key="sched.id"
          class="p-3 rounded-xl bg-slate-900/50 border border-slate-700/50 flex items-center justify-between gap-3 text-xs"
        >
          <div class="space-y-1">
            <div class="font-bold text-white flex items-center gap-2">
              <span>{{ sched.name }}</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                {{ sched.frequency }}
              </span>
            </div>
            <div class="text-slate-400 flex items-center gap-2 flex-wrap text-[11px]">
              <span>{{ getCategoryName(sched.categoryId) }}</span>
              <span>•</span>
              <span>{{ getAccountName(sched.accountId) }}</span>
              <span class="text-amber-400 font-semibold">• 📅 Due: {{ sched.nextDueDate }}</span>
              <span v-if="sched.note">• {{ sched.note }}</span>
            </div>
          </div>

          <div class="flex items-center gap-3 flex-shrink-0">
            <div class="text-right">
              <div
                class="text-xs font-bold"
                :class="sched.type === 'income' ? 'text-emerald-400' : 'text-rose-400'"
              >
                {{ sched.type === 'income' ? '+' : '-' }}৳{{ sched.amount.toLocaleString() }}
              </div>
            </div>
            <button
              type="button"
              @click="store.deleteRecurringSchedule(sched.id)"
              class="text-rose-400 hover:text-rose-300 p-1.5 hover:bg-rose-500/10 rounded-lg text-xs font-semibold transition-all"
              title="Delete Schedule"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Auto-Categorization Rules Card (Actual Budget Engine) -->
    <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-xl space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-bold text-white text-base flex items-center gap-2">
            <span>⚡</span> Auto-Categorization Rules (Actual Budget Engine)
          </h3>
          <p class="text-xs text-slate-400 mt-0.5">
            Automatically assign categories to new transactions based on payee, note, or keywords.
          </p>
        </div>
        <button
          type="button"
          @click="showAddRuleModal = true"
          class="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold shadow-md transition-all whitespace-nowrap"
        >
          + Add Rule
        </button>
      </div>

      <div class="space-y-2">
        <div
          v-for="rule in store.rules"
          :key="rule.id"
          class="p-3 rounded-xl bg-slate-900/50 border border-slate-700/50 flex items-center justify-between gap-3 text-xs"
        >
          <div class="space-y-1">
            <div class="font-bold text-white">{{ rule.name }}</div>
            <div class="text-slate-400 flex items-center gap-2 flex-wrap">
              <span
                v-for="(cond, idx) in rule.conditions"
                :key="idx"
                class="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300"
              >
                {{ cond.field }} {{ cond.operator }} "{{ cond.value }}"
              </span>
              <span>→</span>
              <span
                v-for="(act, idx) in rule.actions"
                :key="'act-' + idx"
                class="px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/40 text-[11px] font-mono font-semibold"
              >
                {{ act.field }}: {{ getCategoryName(String(act.value)) }}
              </span>
            </div>
          </div>
          <button
            type="button"
            @click="store.deleteRule(rule.id)"
            class="text-rose-400 hover:text-rose-300 p-1.5 hover:bg-rose-500/10 rounded-lg text-xs font-semibold transition-all"
            title="Delete Rule"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>

    <!-- Double-Entry Trial Balance & Beancount Export Card -->
    <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-xl space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-bold text-white text-base flex items-center gap-2">
            <span>⚖️</span> Double-Entry Ledger & Beancount Export
          </h3>
          <p class="text-xs text-slate-400 mt-0.5">
            Strict mathematical verification of debits and credits across all accounts and categories.
          </p>
        </div>
        <span
          class="px-2.5 py-1 rounded-full text-xs font-bold border"
          :class="store.trialBalance.isBalanced ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border-rose-500/30'"
        >
          {{ store.trialBalance.isBalanced ? '✓ Balanced Ledger' : '⚠️ Imbalance Detected' }}
        </span>
      </div>

      <!-- Trial Balance Metrics -->
      <div class="grid grid-cols-3 gap-2 text-center text-xs">
        <div class="bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/50">
          <div class="text-[11px] text-slate-400">Total Debits</div>
          <div class="text-sm sm:text-base font-bold text-emerald-400 mt-0.5">
            ৳{{ store.trialBalance.totalDebits.toLocaleString('en-US') }}
          </div>
        </div>
        <div class="bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/50">
          <div class="text-[11px] text-slate-400">Total Credits</div>
          <div class="text-sm sm:text-base font-bold text-rose-400 mt-0.5">
            ৳{{ store.trialBalance.totalCredits.toLocaleString('en-US') }}
          </div>
        </div>
        <div class="bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/50">
          <div class="text-[11px] text-slate-400">Delta Variance</div>
          <div
            class="text-sm sm:text-base font-bold mt-0.5"
            :class="Math.abs(store.trialBalance.totalDebits - store.trialBalance.totalCredits) < 0.01 ? 'text-slate-200' : 'text-rose-400'"
          >
            ৳{{ Math.abs(store.trialBalance.totalDebits - store.trialBalance.totalCredits).toFixed(2) }}
          </div>
        </div>
      </div>

      <!-- Beancount Plain-text Export Collapsible -->
      <div class="space-y-2 pt-1 border-t border-slate-700/60">
        <div class="flex items-center justify-between">
          <button
            type="button"
            @click="showBeancountPreview = !showBeancountPreview"
            class="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5"
          >
            <span>{{ showBeancountPreview ? '▼ Hide' : '▶ Show' }} Beancount Plain-Text Export</span>
            <span class="text-[10px] text-slate-500 font-mono font-normal">({{ store.doubleEntryJournal.length }} postings)</span>
          </button>

          <button
            type="button"
            @click="copyBeancount"
            class="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-750 text-slate-200 text-[11px] font-semibold transition-all flex items-center gap-1"
          >
            <span>{{ copySuccess ? '✓ Copied' : '📋 Copy' }}</span>
          </button>
        </div>

        <div v-if="showBeancountPreview" class="relative">
          <pre class="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-56 leading-relaxed select-all">{{ store.beancountExport }}</pre>
        </div>
      </div>
    </div>

    <!-- Data Export & Backup Vault Card -->
    <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-xl space-y-3">
      <div>
        <h3 class="font-bold text-white text-base flex items-center gap-2">
          <span>💾</span> Data Export & Backup Vault
        </h3>
        <p class="text-xs text-slate-400 mt-0.5">
          Download portable CSV reports or full JSON state snapshots of all accounts, transactions, and schemes.
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <button
          type="button"
          @click="downloadLedgerCsv"
          class="p-4 rounded-xl bg-slate-900/80 border border-slate-700 hover:border-slate-500 text-left transition-all space-y-1 hover:bg-slate-800/60 shadow-md group"
        >
          <div class="text-xs font-bold text-white flex items-center gap-1.5 group-hover:text-rose-400 transition-colors">
            <span>📊</span> Export Ledger CSV
          </div>
          <p class="text-[11px] text-slate-400">
            Export all {{ store.transactions.length }} transactions formatted with accounts, categories, and amounts.
          </p>
        </button>

        <button
          type="button"
          @click="downloadFullJsonVault"
          class="p-4 rounded-xl bg-slate-900/80 border border-slate-700 hover:border-slate-500 text-left transition-all space-y-1 hover:bg-slate-800/60 shadow-md group"
        >
          <div class="text-xs font-bold text-white flex items-center gap-1.5 group-hover:text-sky-400 transition-colors">
            <span>📦</span> Export Full JSON Vault
          </div>
          <p class="text-[11px] text-slate-400">
            Complete portable backup of transactions, accounts, categories, rules, schedules, and Sanchaypatra.
          </p>
        </button>
      </div>
    </div>

    <!-- Add Auto-Categorization Rule Modal -->
    <div
      v-if="showAddRuleModal"
      class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
      @click.self="showAddRuleModal = false"
    >
      <div class="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-4 text-white">
        <div class="flex items-center justify-between pb-2 border-b border-slate-800">
          <h3 class="text-base font-bold text-white">Add Auto-Categorization Rule</h3>
          <button
            type="button"
            @click="showAddRuleModal = false"
            class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm"
          >
            ✕
          </button>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Rule Name</label>
          <input
            v-model="newRuleName"
            placeholder="e.g. Agora / Shwapno → Groceries"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
          />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Target Field</label>
            <select
              v-model="newRuleField"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
            >
              <option value="note">Note</option>
              <option value="payee">Payee</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Match Keyword</label>
            <input
              v-model="newRuleKeyword"
              placeholder="e.g. agora"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Assign Category</label>
          <select
            v-model="newRuleCategoryId"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
          >
            <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">
              {{ cat.name }} ({{ cat.type }})
            </option>
          </select>
        </div>

        <div class="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            @click="showAddRuleModal = false"
            class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="handleAddRule"
            :disabled="!newRuleName.trim() || !newRuleKeyword.trim()"
            class="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white text-xs font-semibold shadow-lg"
          >
            Save Rule
          </button>
        </div>
      </div>
    </div>

    <!-- Add Recurring Schedule Modal -->
    <div
      v-if="showAddRecurringModal"
      class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
      @click.self="showAddRecurringModal = false"
    >
      <div class="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-4 text-white">
        <div class="flex items-center justify-between pb-2 border-b border-slate-800">
          <h3 class="text-base font-bold text-white">Add Recurring Bill / Income</h3>
          <button
            type="button"
            @click="showAddRecurringModal = false"
            class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm"
          >
            ✕
          </button>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Schedule Name</label>
          <input
            v-model="newSchedule.name"
            placeholder="e.g. Monthly Internet Bill / Gym Membership"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
          />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Type</label>
            <select
              v-model="newSchedule.type"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Amount (৳)</label>
            <input
              v-model.number="newSchedule.amount"
              type="number"
              placeholder="0"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-slate-600"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Category</label>
            <select
              v-model="newSchedule.categoryId"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
            >
              <option
                v-for="cat in store.categories.filter(c => c.type === newSchedule.type)"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Account</label>
            <select
              v-model="newSchedule.accountId"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
            >
              <option v-for="acc in store.accounts" :key="acc.id" :value="acc.id">
                {{ acc.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Frequency</label>
            <select
              v-model="newSchedule.frequency"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="weekly">Weekly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Next Due Date</label>
            <input
              v-model="newSchedule.nextDueDate"
              type="date"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Note (Optional)</label>
          <input
            v-model="newSchedule.note"
            placeholder="e.g. Auto-pay on 1st of month"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
          />
        </div>

        <div class="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            @click="showAddRecurringModal = false"
            class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="handleAddRecurring"
            :disabled="!newSchedule.name.trim() || newSchedule.amount <= 0"
            class="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white text-xs font-semibold shadow-lg"
          >
            Save Schedule
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useMoneyStore } from '../store';
import { RealbytePcManagerClient } from '../modules/realbyte/client';
import { TransactionType } from '../types';

const store = useMoneyStore();
const connectionTestResult = ref<{ success: boolean; message: string } | null>(null);
const syncingPcManager = ref(false);
const syncingVault = ref(false);
const syncError = ref('');

// Rules State
const showAddRuleModal = ref(false);
const newRuleName = ref('');
const newRuleField = ref<'note' | 'payee'>('note');
const newRuleKeyword = ref('');
const newRuleCategoryId = ref(store.categories[0]?.id || '');

// Recurring Schedules State
const showAddRecurringModal = ref(false);
const postResultMsg = ref('');
const newSchedule = ref({
  name: '',
  amount: 0,
  type: 'expense' as TransactionType,
  categoryId: store.categories[0]?.id || '',
  accountId: store.accounts[0]?.id || '',
  frequency: 'monthly' as 'monthly' | 'quarterly' | 'yearly' | 'weekly',
  nextDueDate: new Date().toISOString().split('T')[0],
  autoPost: true,
  note: ''
});

// Beancount Preview State
const showBeancountPreview = ref(false);
const copySuccess = ref(false);

async function testPhoneConnection() {
  connectionTestResult.value = { success: false, message: 'Pinging phone PC Manager server...' };
  const client = new RealbytePcManagerClient(store.phoneIp, store.phonePort);
  const ok = await client.checkConnection();
  if (ok) {
    connectionTestResult.value = { success: true, message: `Connected to Realbyte PC Manager at ${store.phoneIp}:${store.phonePort}` };
  } else {
    connectionTestResult.value = {
      success: false,
      message: `Could not reach ${store.phoneIp}:${store.phonePort}. Ensure PC Manager is turned ON in Realbyte on your phone.`
    };
  }
}

async function runPcManagerSync() {
  syncingPcManager.value = true;
  syncError.value = '';
  try {
    await store.syncFromPcManager();
  } catch (err: any) {
    syncError.value = err?.message || 'PC Manager sync failed.';
  } finally {
    syncingPcManager.value = false;
  }
}

const sampleVaultDump = {
  assets: [
    { UID: 1, NAME: 'Cash Wallet', AMOUNT: 8500, ASSET_TYPE: 'cash', CURRENCY: 'BDT' },
    { UID: 4, NAME: 'bKash Personal', AMOUNT: 12450, ASSET_TYPE: 'mfs', CURRENCY: 'BDT' }
  ],
  categories: [
    { UID: 101, NAME: 'Groceries & Bazar', DO_TYPE: '1' },
    { UID: 105, NAME: 'Dining & Snacks', DO_TYPE: '1' }
  ],
  inoutcome: [
    {
      UID: 5003,
      WDATE: 1762172000000,
      UTIME: 1762172000000,
      DO_TYPE: '1',
      MONEY: 3500,
      ASSET_UID: 4,
      CATEGORY_UID: 101,
      NOTE: 'Unimart bazar'
    },
    {
      UID: 5007,
      WDATE: 1762430000000,
      UTIME: 1762430000000,
      DO_TYPE: '1',
      MONEY: 650,
      ASSET_UID: 1,
      CATEGORY_UID: 105,
      NOTE: 'Evening Kacchi & Cha (Synced via PC Manager)'
    },
    {
      UID: 5008,
      WDATE: 1762518000000,
      UTIME: 1762518000000,
      DO_TYPE: '1',
      MONEY: 1850,
      ASSET_UID: 1,
      CATEGORY_UID: 101,
      NOTE: 'Fresh Fish Bazar & Spices (New Vault Record)'
    }
  ]
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

async function handleVaultFileUpload(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  syncingVault.value = true;
  syncError.value = '';
  try {
    if (file.name.endsWith('.json')) {
      const text = await file.text();
      const json = JSON.parse(text);
      await store.syncFromSqliteVault(json);
    } else if (file.name.endsWith('.sql')) {
      const text = await file.text();
      await store.syncFromSqliteVault(text);
    } else {
      const buffer = await file.arrayBuffer();
      await store.syncFromSqliteVault(buffer);
    }
  } catch (err: any) {
    syncError.value = err?.message || 'Error processing vault file.';
  } finally {
    syncingVault.value = false;
  }
}

function getCategoryName(catId: string): string {
  const cat = store.categories.find(c => c.id === catId);
  return cat ? cat.name : catId;
}

function getAccountName(accId: string): string {
  const acc = store.accounts.find(a => a.id === accId);
  return acc ? acc.name : accId;
}

function handleAddRule() {
  if (!newRuleName.value.trim() || !newRuleKeyword.value.trim() || !newRuleCategoryId.value) return;

  store.addRule({
    name: newRuleName.value.trim(),
    enabled: true,
    conditions: [
      {
        field: newRuleField.value,
        operator: 'contains',
        value: newRuleKeyword.value.trim().toLowerCase()
      }
    ],
    actions: [
      {
        field: 'categoryId',
        value: newRuleCategoryId.value
      }
    ]
  });

  showAddRuleModal.value = false;
  newRuleName.value = '';
  newRuleKeyword.value = '';
}

function handlePostDueBills() {
  const count = store.runDueRecurringSchedules('2026-12-05');
  postResultMsg.value = count > 0
    ? `Successfully posted ${count} due recurring bills!`
    : 'No bills are currently due as of 2026-12-05.';
  setTimeout(() => {
    postResultMsg.value = '';
  }, 4000);
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
    note: newSchedule.value.note.trim()
  });

  showAddRecurringModal.value = false;
  newSchedule.value.name = '';
  newSchedule.value.amount = 0;
  newSchedule.value.note = '';
}

function copyBeancount() {
  navigator.clipboard.writeText(store.beancountExport);
  copySuccess.value = true;
  setTimeout(() => {
    copySuccess.value = false;
  }, 2000);
}

function downloadLedgerCsv() {
  const blob = new Blob([store.csvExport], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'money-manager-ledger.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadFullJsonVault() {
  const blob = new Blob([store.fullBackupJson], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'money-manager-vault-backup.json');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
</script>