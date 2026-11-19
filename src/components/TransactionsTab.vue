<template>
  <div class="space-y-4">
    <!-- Multi-Facet Filter & Action Bar -->
    <div class="card-surface border rounded-2xl p-4 shadow-sm space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2.5">
        <div class="relative flex-1 min-w-[220px]">
          <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="searchQuery"
            placeholder="Search notes, payees, accounts, or categories..."
            class="w-full input-surface border rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/40"
          />
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            @click="downloadCsv"
            class="px-3 py-2 rounded-xl panel-surface border text-xs font-semibold flex items-center gap-1.5 hover:border-slate-400 dark:hover:border-slate-600"
          >
            <Download class="w-3.5 h-3.5" /> Export CSV
          </button>

          <button
            v-if="store.featureFlags.enableBankImporters"
            type="button"
            @click="openImportModal"
            class="px-3 py-2 rounded-xl panel-surface border text-xs font-semibold flex items-center gap-1.5 hover:border-slate-400 dark:hover:border-slate-600"
          >
            <Upload class="w-3.5 h-3.5" /> Import Statement
          </button>

          <button
            type="button"
            @click="store.openQuickKeypad()"
            class="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-sm flex items-center gap-1"
          >
            <Plus class="w-3.5 h-3.5" /> Add Transaction
          </button>
        </div>
      </div>

      <!-- Facet Filter Row -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
        <select v-model="filterType" aria-label="Filter by type" class="input-surface border rounded-xl px-2.5 py-1.5">
          <option value="all">All Types</option>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
          <option value="transfer">Transfer</option>
        </select>

        <select v-model="filterAccountId" aria-label="Filter by account" class="input-surface border rounded-xl px-2.5 py-1.5">
          <option value="all">All Accounts</option>
          <option v-for="acc in store.accounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
        </select>

        <select v-model="filterCategoryId" aria-label="Filter by category" class="input-surface border rounded-xl px-2.5 py-1.5">
          <option value="all">All Categories</option>
          <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
        </select>

        <input v-model="filterDateFrom" type="date" aria-label="From date" class="input-surface border rounded-xl px-2.5 py-1.5" />
        <input v-model="filterDateTo" type="date" aria-label="To date" class="input-surface border rounded-xl px-2.5 py-1.5" />

        <button
          type="button"
          @click="resetFilters"
          class="px-3 py-1.5 rounded-xl panel-surface border text-slate-600 dark:text-slate-300 font-semibold hover:border-slate-400"
        >
          Reset ({{ filteredTransactions.length }})
        </button>
      </div>
    </div>

    <!-- Bulk Selection Bar -->
    <div
      v-if="selectedIds.length > 0"
      class="card-surface border border-rose-500/40 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
    >
      <div class="font-bold flex items-center gap-2">
        <span class="px-2 py-0.5 rounded-full bg-rose-600 text-white tabular-nums">{{ selectedIds.length }}</span>
        <span>selected</span>
        <span class="text-slate-500 dark:text-slate-400 tabular-nums">
          (Total: {{ formatBDT(selectedTotalAmount, store.privacyMode) }})
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          @click="handleBulkMerge"
          :disabled="selectedIds.length < 2"
          class="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-semibold flex items-center gap-1"
        >
          <Merge class="w-3.5 h-3.5" /> Merge
        </button>

        <div class="flex items-center gap-1">
          <select v-model="bulkTargetCategoryId" class="input-surface border rounded-xl px-2 py-1.5 text-xs">
            <option value="">Re-categorize to...</option>
            <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">
              {{ cat.name }} ({{ cat.type }})
            </option>
          </select>
          <button
            type="button"
            @click="handleBulkRecategorize"
            :disabled="!bulkTargetCategoryId"
            class="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold"
          >
            Apply
          </button>
        </div>

        <button
          type="button"
          @click="handleBulkDelete"
          class="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-1"
        >
          <Trash2 class="w-3.5 h-3.5" /> Delete
        </button>

        <button
          type="button"
          @click="selectedIds = []"
          class="px-2.5 py-1.5 rounded-xl panel-surface border font-semibold"
        >
          Clear
        </button>
      </div>
    </div>

    <div v-if="bulkFeedback" role="status" class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-1">
      {{ bulkFeedback }}
    </div>

    <!-- Accessible Visually Hidden Sort Status -->
    <div role="status" class="sr-only">{{ sortStatusAnnouncement }}</div>

    <!-- Dense Sortable Ledger Table -->
    <div
      role="region"
      aria-labelledby="tx-table-caption"
      tabindex="0"
      class="card-surface border rounded-2xl shadow-sm overflow-x-auto scroller"
    >
      <table class="w-full text-left border-collapse min-w-[760px]">
        <caption id="tx-table-caption" class="sr-only">Transactions Ledger</caption>

        <thead class="panel-surface border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <tr>
            <th scope="col" class="py-3 pl-4 pr-2 w-10">
              <input
                type="checkbox"
                aria-label="Select all visible transactions"
                :checked="allVisibleSelected"
                @change="toggleSelectAll"
              />
            </th>
            <th scope="col" :aria-sort="getAriaSort('date')" class="p-0">
              <button
                type="button"
                @click="toggleSort('date')"
                class="w-full py-3 px-3 flex items-center gap-1.5 font-bold hover:text-slate-900 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <span>Date</span>
                <component :is="getSortIcon('date')" class="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </th>
            <th scope="col" :aria-sort="getAriaSort('category')" class="p-0">
              <button
                type="button"
                @click="toggleSort('category')"
                class="w-full py-3 px-3 flex items-center gap-1.5 font-bold hover:text-slate-900 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <span>Category / Type</span>
                <component :is="getSortIcon('category')" class="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </th>
            <th scope="col" :aria-sort="getAriaSort('account')" class="p-0">
              <button
                type="button"
                @click="toggleSort('account')"
                class="w-full py-3 px-3 flex items-center gap-1.5 font-bold hover:text-slate-900 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <span>Account</span>
                <component :is="getSortIcon('account')" class="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </th>
            <th scope="col" class="py-3 px-3 font-bold">Payee / Note</th>
            <th scope="col" :aria-sort="getAriaSort('amount')" class="p-0 text-right">
              <button
                type="button"
                @click="toggleSort('amount')"
                class="w-full py-3 px-3 flex items-center justify-end gap-1.5 font-bold hover:text-slate-900 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <span>Amount</span>
                <component :is="getSortIcon('amount')" class="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </th>
            <th scope="col" class="py-3 pl-2 pr-4 text-right font-bold">Actions</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-200 dark:divide-slate-800/80 text-xs">
          <tr v-if="sortedTransactions.length === 0">
            <td colspan="7" class="text-center py-12 text-slate-500">
              No transactions match your current filters.
            </td>
          </tr>

          <tr
            v-for="txn in sortedTransactions"
            :key="txn.id"
            class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
          >
            <td class="py-2.5 pl-4 pr-2">
              <input
                type="checkbox"
                :aria-label="`Select transaction ${txn.note || txn.date}`"
                :checked="selectedIds.includes(txn.id)"
                @change="toggleRowSelection(txn.id)"
              />
            </td>

            <td class="py-2.5 px-3 whitespace-nowrap tabular-nums">
              <div class="font-semibold">{{ txn.date }}</div>
              <div class="text-[10px] text-slate-500">{{ txn.time || '12:00' }}</div>
            </td>

            <td class="py-2.5 px-3">
              <div v-if="txn.type === 'transfer'" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-400 font-semibold">
                <ArrowLeftRight class="w-3 h-3" /> Transfer
              </div>
              <div v-else class="flex items-center gap-2">
                <span
                  class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  :style="{ backgroundColor: getCategory(txn.categoryId)?.color || '#64748B' }"
                ></span>
                <span class="font-semibold">{{ getCategory(txn.categoryId)?.name || 'Uncategorized' }}</span>
                <span v-if="txn.subcategoryId" class="text-[10px] px-1.5 py-0.5 rounded panel-surface border text-slate-500">
                  {{ txn.subcategoryId }}
                </span>
              </div>
            </td>

            <td class="py-2.5 px-3 whitespace-nowrap">
              <span v-if="txn.type === 'transfer'" class="text-sky-600 dark:text-sky-400 font-medium">
                {{ getAccount(txn.accountId)?.name }} → {{ getAccount(txn.targetAccountId)?.name }}
              </span>
              <span v-else>{{ getAccount(txn.accountId)?.name }}</span>
            </td>

            <td class="py-2.5 px-3 max-w-[260px]">
              <div class="truncate font-medium">
                {{ txn.note || txn.description || '—' }}
              </div>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span
                  v-if="txn.syncSource === 'realbyte_pc_manager'"
                  class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono"
                >
                  <Wifi class="w-2.5 h-2.5" /> Wi-Fi
                </span>
                <span
                  v-else-if="txn.syncSource === 'realbyte_sqlite_backup'"
                  class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono"
                >
                  <Database class="w-2.5 h-2.5" /> Vault
                </span>
                <span
                  v-else-if="txn.syncSource === 'bank_import'"
                  class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono"
                >
                  <Upload class="w-2.5 h-2.5" /> Bank
                </span>
                <button
                  v-if="txn.receiptPath"
                  type="button"
                  @click="openReceipt(txn.receiptPath)"
                  class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:underline"
                >
                  <Paperclip class="w-2.5 h-2.5" /> Receipt
                </button>
              </div>
            </td>

            <td
              class="py-2.5 px-3 text-right font-bold tabular-nums whitespace-nowrap"
              :class="
                txn.type === 'income'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : txn.type === 'expense'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-sky-600 dark:text-sky-400'
              "
            >
              {{ formatSignedBDT(txn.amount, txn.type, store.privacyMode) }}
            </td>

            <td class="py-2.5 pl-2 pr-4 text-right whitespace-nowrap">
              <div class="inline-flex items-center gap-1">
                <button
                  type="button"
                  @click="openEditModal(txn)"
                  aria-label="Edit transaction"
                  class="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-500/10"
                >
                  <Pencil class="w-3.5 h-3.5" />
                </button>
                <button
                  v-if="txn.type !== 'transfer'"
                  type="button"
                  @click="openSplitModal(txn)"
                  aria-label="Split transaction"
                  class="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10"
                >
                  <Scissors class="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  @click="store.deleteTransaction(txn.id)"
                  aria-label="Delete transaction"
                  class="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Bank Statement Importer Modal -->
    <BaseModal
      v-model="showImportModal"
      title="Import Bank Statement"
      subtitle="Zero-collision reconciliation (OFX, CAMT.053 XML, CSV, QIF)"
    >
      <div class="space-y-4 text-xs">
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="fmt in (['ofx', 'camt', 'csv', 'qif'] as const)"
            :key="fmt"
            type="button"
            @click="importFormat = fmt"
            class="py-2 px-2 rounded-xl font-semibold border uppercase"
            :class="importFormat === fmt ? 'bg-rose-600 text-white border-rose-600' : 'panel-surface'"
          >
            {{ fmt === 'camt' ? 'CAMT.053' : fmt }}
          </button>
        </div>

        <div>
          <label class="block font-semibold mb-1">Target Account</label>
          <select v-model="importAccountId" class="w-full input-surface border rounded-xl px-3 py-2">
            <option v-for="acc in store.accounts" :key="acc.id" :value="acc.id">
              {{ acc.name }} ({{ acc.currency }})
            </option>
          </select>
        </div>

        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="font-semibold">Statement Content</label>
            <div class="flex items-center gap-2">
              <button type="button" @click="loadSampleCityBankOfx" class="text-sky-600 dark:text-sky-400 underline font-semibold">
                Sample OFX
              </button>
              <button type="button" @click="loadSampleCamtXml" class="text-sky-600 dark:text-sky-400 underline font-semibold">
                Sample CAMT XML
              </button>
            </div>
          </div>
          <textarea
            v-model="importContent"
            rows="5"
            placeholder="Paste statement content or pick a file below..."
            class="w-full input-surface border rounded-xl p-3 font-mono text-xs"
          ></textarea>
          <input type="file" @change="handleFileUpload" class="text-xs" />
        </div>

        <div v-if="importReport" class="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
          <div class="font-bold text-emerald-600 dark:text-emerald-400">Statement Reconciled Successfully</div>
          <div class="tabular-nums">
            Inserted: <strong>{{ importReport.insertedTransactions }}</strong> •
            Skipped Duplicates: <strong>{{ importReport.skippedDuplicates }}</strong>
          </div>
        </div>

        <div v-if="importError" class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400">
          {{ importError }}
        </div>
      </div>

      <template #footer>
        <button type="button" @click="showImportModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          {{ importReport ? 'Close' : 'Cancel' }}
        </button>
        <button
          type="button"
          @click="handleExecuteImport"
          :disabled="!importContent.trim()"
          class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-semibold"
        >
          Execute Import
        </button>
      </template>
    </BaseModal>

    <!-- Split Transaction Modal -->
    <BaseModal
      v-model="showSplitModal"
      title="Split Transaction"
      :subtitle="splitModalTxn ? `Split ৳${splitModalTxn.amount.toLocaleString('en-US')} across 2 categories` : ''"
      maxWidthClass="max-w-md"
    >
      <div v-if="splitModalTxn" class="space-y-3 text-xs">
        <div class="p-3 rounded-2xl panel-surface border space-y-2">
          <div class="font-bold text-rose-600 dark:text-rose-400 uppercase text-[11px]">Part 1</div>
          <div class="grid grid-cols-2 gap-2">
            <select v-model="split1.categoryId" class="input-surface border rounded-xl px-2.5 py-1.5">
              <option v-for="cat in availableSplitCategories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
            </select>
            <input v-model.number="split1.amount" type="number" min="1" @input="autoBalanceSplit2" class="input-surface border rounded-xl px-2.5 py-1.5 font-bold tabular-nums" />
          </div>
          <input v-model="split1.note" placeholder="Note for Part 1" class="w-full input-surface border rounded-xl px-2.5 py-1.5" />
        </div>

        <div class="p-3 rounded-2xl panel-surface border space-y-2">
          <div class="font-bold text-sky-600 dark:text-sky-400 uppercase text-[11px]">Part 2</div>
          <div class="grid grid-cols-2 gap-2">
            <select v-model="split2.categoryId" class="input-surface border rounded-xl px-2.5 py-1.5">
              <option v-for="cat in availableSplitCategories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
            </select>
            <input v-model.number="split2.amount" type="number" min="1" class="input-surface border rounded-xl px-2.5 py-1.5 font-bold tabular-nums" />
          </div>
          <input v-model="split2.note" placeholder="Note for Part 2" class="w-full input-surface border rounded-xl px-2.5 py-1.5" />
        </div>

        <div class="flex items-center justify-between p-2.5 rounded-xl panel-surface border tabular-nums">
          <span>Allocated:</span>
          <strong :class="split1.amount + split2.amount === splitModalTxn.amount ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
            ৳{{ (split1.amount + split2.amount).toLocaleString('en-US') }} / ৳{{ splitModalTxn.amount.toLocaleString('en-US') }}
          </strong>
        </div>

        <div v-if="splitError" class="text-rose-600 dark:text-rose-400">{{ splitError }}</div>
      </div>

      <template #footer>
        <button type="button" @click="showSplitModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button
          type="button"
          @click="handleSaveSplit"
          :disabled="!splitModalTxn || split1.amount + split2.amount !== splitModalTxn.amount"
          class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-semibold"
        >
          Confirm Split
        </button>
      </template>
    </BaseModal>

    <!-- Edit Transaction Modal -->
    <BaseModal v-model="showEditModal" title="Edit Transaction" maxWidthClass="max-w-md">
      <div v-if="editingTxn" class="space-y-3 text-xs">
        <div v-if="editingTxn.type !== 'transfer'" class="grid grid-cols-2 gap-2">
          <button
            type="button"
            @click="switchEditType('expense')"
            class="py-2 rounded-xl font-bold border"
            :class="editType === 'expense' ? 'bg-rose-600 text-white border-rose-600' : 'panel-surface'"
          >
            Expense
          </button>
          <button
            type="button"
            @click="switchEditType('income')"
            class="py-2 rounded-xl font-bold border"
            :class="editType === 'income' ? 'bg-emerald-600 text-white border-emerald-600' : 'panel-surface'"
          >
            Income
          </button>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Amount (৳)</label>
            <input v-model.number="editAmount" type="number" min="1" class="w-full input-surface border rounded-xl px-3 py-2 font-bold tabular-nums" />
          </div>
          <div>
            <label class="block font-semibold mb-1">Date</label>
            <input v-model="editDate" type="date" class="w-full input-surface border rounded-xl px-3 py-2 tabular-nums" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">{{ editingTxn.type === 'transfer' ? 'From Account' : 'Account' }}</label>
            <select v-model="editAccountId" class="w-full input-surface border rounded-xl px-2.5 py-2">
              <option v-for="acc in store.accounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
            </select>
          </div>
          <div v-if="editingTxn.type !== 'transfer'">
            <label class="block font-semibold mb-1">Category</label>
            <select v-model="editCategoryId" class="w-full input-surface border rounded-xl px-2.5 py-2">
              <option v-for="cat in store.categories.filter((c) => c.type === editType)" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>
          <div v-else>
            <label class="block font-semibold mb-1">To Target Account</label>
            <select v-model="editTargetAccountId" class="w-full input-surface border rounded-xl px-2.5 py-2">
              <option v-for="acc in store.accounts.filter((a) => a.id !== editAccountId)" :key="acc.id" :value="acc.id">
                {{ acc.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Payee / Description</label>
            <input v-model="editDescription" class="w-full input-surface border rounded-xl px-3 py-2" />
          </div>
          <div>
            <label class="block font-semibold mb-1">Note</label>
            <input v-model="editNote" class="w-full input-surface border rounded-xl px-3 py-2" />
          </div>
        </div>
      </div>

      <template #footer>
        <button type="button" @click="showEditModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button
          type="button"
          @click="handleSaveEdit"
          :disabled="editAmount <= 0"
          class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-semibold"
        >
          Save Changes
        </button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  Database,
  Download,
  Merge,
  Paperclip,
  Pencil,
  Plus,
  Scissors,
  Search,
  Trash2,
  Upload,
  Wifi,
} from 'lucide-vue-next';
import BaseModal from './BaseModal.vue';
import { useMoneyStore } from '../store';
import { formatBDT, formatSignedBDT, saveExportFile } from '../utils/format';
import type { SyncReconciliationReport, Transaction, TransactionType } from '../types';

const store = useMoneyStore();

// Filters
const searchQuery = ref('');
const filterType = ref<'all' | TransactionType>('all');
const filterAccountId = ref('all');
const filterCategoryId = ref('all');
const filterDateFrom = ref('');
const filterDateTo = ref('');

// Sort state
type SortCol = 'date' | 'category' | 'account' | 'amount';
const sortKey = ref<SortCol>('date');
const sortDir = ref<'asc' | 'desc'>('desc');
const sortStatusAnnouncement = ref('');
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// Bulk selection
const selectedIds = ref<string[]>([]);
const bulkTargetCategoryId = ref('');
const bulkFeedback = ref('');

function getCategory(id?: string) {
  if (!id) return undefined;
  return store.categories.find((c) => c.id === id);
}

function getAccount(id?: string) {
  if (!id) return undefined;
  return store.accounts.find((a) => a.id === id);
}

const filteredTransactions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return store.transactions.filter((t) => {
    if (filterType.value !== 'all' && t.type !== filterType.value) return false;
    if (filterAccountId.value !== 'all' && t.accountId !== filterAccountId.value && t.targetAccountId !== filterAccountId.value) {
      return false;
    }
    if (filterCategoryId.value !== 'all' && t.categoryId !== filterCategoryId.value) return false;
    if (filterDateFrom.value && t.date < filterDateFrom.value) return false;
    if (filterDateTo.value && t.date > filterDateTo.value) return false;

    if (!q) return true;
    const cat = getCategory(t.categoryId)?.name.toLowerCase() || '';
    const acc = getAccount(t.accountId)?.name.toLowerCase() || '';
    const targetAcc = t.targetAccountId ? getAccount(t.targetAccountId)?.name.toLowerCase() || '' : '';
    const note = t.note?.toLowerCase() || '';
    const desc = t.description?.toLowerCase() || '';
    return cat.includes(q) || acc.includes(q) || targetAcc.includes(q) || note.includes(q) || desc.includes(q);
  });
});

const sortedTransactions = computed(() => {
  const factor = sortDir.value === 'asc' ? 1 : -1;
  return [...filteredTransactions.value].sort((a, b) => {
    if (sortKey.value === 'date') {
      const cmp = collator.compare(`${a.date} ${a.time || ''}`, `${b.date} ${b.time || ''}`);
      return cmp * factor;
    }
    if (sortKey.value === 'amount') {
      return (a.amount - b.amount) * factor;
    }
    if (sortKey.value === 'category') {
      const nameA = a.type === 'transfer' ? 'Transfer' : getCategory(a.categoryId)?.name || '';
      const nameB = b.type === 'transfer' ? 'Transfer' : getCategory(b.categoryId)?.name || '';
      return collator.compare(nameA, nameB) * factor;
    }
    const accA = getAccount(a.accountId)?.name || '';
    const accB = getAccount(b.accountId)?.name || '';
    return collator.compare(accA, accB) * factor;
  });
});

function toggleSort(col: SortCol) {
  if (sortKey.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = col;
    sortDir.value = col === 'date' || col === 'amount' ? 'desc' : 'asc';
  }
  const directionLabel = sortDir.value === 'asc' ? 'ascending' : 'descending';
  sortStatusAnnouncement.value = `Sorted by ${col}, ${directionLabel}, ${sortedTransactions.value.length} rows`;
}

function getAriaSort(col: SortCol): 'ascending' | 'descending' | undefined {
  if (sortKey.value !== col) return undefined;
  return sortDir.value === 'asc' ? 'ascending' : 'descending';
}

function getSortIcon(col: SortCol) {
  if (sortKey.value !== col) return ArrowUpDown;
  return sortDir.value === 'asc' ? ArrowUp : ArrowDown;
}

function resetFilters() {
  searchQuery.value = '';
  filterType.value = 'all';
  filterAccountId.value = 'all';
  filterCategoryId.value = 'all';
  filterDateFrom.value = '';
  filterDateTo.value = '';
}

const allVisibleSelected = computed(
  () =>
    sortedTransactions.value.length > 0 &&
    sortedTransactions.value.every((t) => selectedIds.value.includes(t.id))
);

const selectedTotalAmount = computed(() =>
  store.transactions
    .filter((t) => selectedIds.value.includes(t.id))
    .reduce((sum, t) => sum + t.amount, 0)
);

function toggleSelectAll() {
  if (allVisibleSelected.value) {
    selectedIds.value = [];
  } else {
    selectedIds.value = sortedTransactions.value.map((t) => t.id);
  }
}

function toggleRowSelection(id: string) {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((x) => x !== id);
  } else {
    selectedIds.value.push(id);
  }
}

function handleBulkMerge() {
  try {
    store.mergeSelectedTransactions(selectedIds.value);
    bulkFeedback.value = `Merged ${selectedIds.value.length} transactions.`;
    selectedIds.value = [];
  } catch (err: any) {
    bulkFeedback.value = err?.message || 'Unable to merge selected transactions.';
  }
}

function handleBulkRecategorize() {
  if (!bulkTargetCategoryId.value) return;
  const count = store.bulkRecategorizeTransactions(selectedIds.value, bulkTargetCategoryId.value);
  bulkFeedback.value = `Updated category on ${count} matching transactions.`;
  selectedIds.value = [];
  bulkTargetCategoryId.value = '';
}

function handleBulkDelete() {
  const count = store.bulkDeleteTransactions(selectedIds.value);
  bulkFeedback.value = `Deleted ${count} selected transactions.`;
  selectedIds.value = [];
}

async function openReceipt(receiptPath: string) {
  if (typeof window !== 'undefined' && window.moneyApi?.fs?.openPath) {
    await window.moneyApi.fs.openPath(receiptPath);
  }
}

async function downloadCsv() {
  await saveExportFile({
    defaultName: 'money-manager-transactions.csv',
    content: store.csvExport,
    mimeType: 'text/csv;charset=utf-8;',
    filterLabel: 'CSV Spreadsheet',
    extensions: ['csv'],
  });
}

// Import Statement Modal
const showImportModal = ref(false);
const importFormat = ref<'ofx' | 'camt' | 'csv' | 'qif'>('ofx');
const importAccountId = ref(store.accounts[0]?.id || '');
const importContent = ref('');
const importReport = ref<SyncReconciliationReport | null>(null);
const importError = ref('');

function openImportModal() {
  importReport.value = null;
  importError.value = '';
  if (!importAccountId.value && store.accounts.length > 0) {
    importAccountId.value = store.accounts[0].id;
  }
  showImportModal.value = true;
}

function handleFileUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xml')) importFormat.value = 'camt';
  else if (lower.endsWith('.csv')) importFormat.value = 'csv';
  else if (lower.endsWith('.qif')) importFormat.value = 'qif';
  else importFormat.value = 'ofx';

  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') importContent.value = reader.result;
  };
  reader.readAsText(file);
}

function loadSampleCityBankOfx() {
  importFormat.value = 'ofx';
  importContent.value = `OFXHEADER:100
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261108120000
<TRNAMT>-1450.00
<FITID>CB-20261108-001
<NAME>Shwapno Gulshan 2
<MEMO>Fresh fish & vegetables
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261109183000
<TRNAMT>-650.00
<FITID>CB-20261109-002
<NAME>Uber Bangladesh
<MEMO>Ride from Banani to Dhanmondi
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;
}

function loadSampleCamtXml() {
  importFormat.value = 'camt';
  importContent.value = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <Stmt>
      <Ntry>
        <Amt Ccy="BDT">2850.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt><Dt>2026-11-10</Dt></BookgDt>
        <AcctSvcrRef>BRAC-CAMT-20261110-01</AcctSvcrRef>
        <NtryDtls><TxDtls>
          <RltdPties><Cdtr><Nm>Meena Bazar Dhanmondi</Nm></Cdtr></RltdPties>
          <RmtInf><Ustrd>Weekly groceries</Ustrd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;
}

function handleExecuteImport() {
  importError.value = '';
  try {
    importReport.value = store.importBankStatement(
      importFormat.value,
      importContent.value,
      importAccountId.value
    );
  } catch (err: any) {
    importError.value = err?.message || 'Failed to parse bank statement.';
  }
}

// Split Modal
const showSplitModal = ref(false);
const splitModalTxn = ref<Transaction | null>(null);
const split1 = ref({ categoryId: '', amount: 0, note: '' });
const split2 = ref({ categoryId: '', amount: 0, note: '' });
const splitError = ref('');

const availableSplitCategories = computed(() =>
  splitModalTxn.value
    ? store.categories.filter((c) => c.type === splitModalTxn.value?.type)
    : store.categories
);

function openSplitModal(txn: Transaction) {
  splitModalTxn.value = txn;
  splitError.value = '';
  const half = Math.round(txn.amount / 2);
  split1.value = { categoryId: txn.categoryId, amount: half, note: txn.note ? `${txn.note} (Part 1)` : 'Part 1' };
  const other = store.categories.find((c) => c.id !== txn.categoryId && c.type === txn.type);
  split2.value = {
    categoryId: other ? other.id : txn.categoryId,
    amount: Math.round(txn.amount) - half,
    note: txn.note ? `${txn.note} (Part 2)` : 'Part 2',
  };
  showSplitModal.value = true;
}

function autoBalanceSplit2() {
  if (!splitModalTxn.value) return;
  const remaining = Math.round(splitModalTxn.value.amount) - Math.round(split1.value.amount);
  if (remaining >= 0) split2.value.amount = remaining;
}

function handleSaveSplit() {
  if (!splitModalTxn.value) return;
  splitError.value = '';
  try {
    store.splitExistingTransaction(splitModalTxn.value.id, [
      { categoryId: split1.value.categoryId, amount: Math.round(split1.value.amount), note: split1.value.note },
      { categoryId: split2.value.categoryId, amount: Math.round(split2.value.amount), note: split2.value.note },
    ]);
    showSplitModal.value = false;
  } catch (err: any) {
    splitError.value = err?.message || 'Split error.';
  }
}

// Edit Modal
const showEditModal = ref(false);
const editingTxn = ref<Transaction | null>(null);
const editDate = ref('');
const editType = ref<TransactionType>('expense');
const editAmount = ref(0);
const editAccountId = ref('');
const editTargetAccountId = ref('');
const editCategoryId = ref('');
const editDescription = ref('');
const editNote = ref('');

function switchEditType(newType: 'expense' | 'income') {
  editType.value = newType;
  const currentCat = store.categories.find((c) => c.id === editCategoryId.value);
  if (!currentCat || currentCat.type !== newType) {
    const first = store.categories.find((c) => c.type === newType);
    if (first) editCategoryId.value = first.id;
  }
}

function openEditModal(txn: Transaction) {
  editingTxn.value = txn;
  editDate.value = txn.date;
  editType.value = txn.type;
  editAmount.value = txn.amount;
  editAccountId.value = txn.accountId;
  editTargetAccountId.value =
    txn.targetAccountId || store.accounts.find((a) => a.id !== txn.accountId)?.id || '';
  editCategoryId.value = txn.categoryId;
  editDescription.value = txn.description || '';
  editNote.value = txn.note || '';
  showEditModal.value = true;
}

function handleSaveEdit() {
  if (!editingTxn.value) return;
  const resolvedTarget =
    editType.value === 'transfer'
      ? editTargetAccountId.value !== editAccountId.value
        ? editTargetAccountId.value
        : store.accounts.find((a) => a.id !== editAccountId.value)?.id
      : undefined;

  store.editTransaction(editingTxn.value.id, {
    date: editDate.value,
    type: editType.value,
    amount: Math.round(editAmount.value),
    accountId: editAccountId.value,
    targetAccountId: resolvedTarget,
    categoryId: editType.value === 'transfer' ? 'transfer' : editCategoryId.value,
    note: editNote.value || undefined,
    description: editDescription.value || undefined,
  });
  showEditModal.value = false;
  editingTxn.value = null;
}
</script>
