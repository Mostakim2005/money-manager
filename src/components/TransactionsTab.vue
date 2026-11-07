<template>
  <div class="space-y-4">
    <!-- Search & Filter Bar with Action Buttons -->
    <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
      <input
        v-model="searchQuery"
        placeholder="Search notes, accounts, or categories..."
        class="flex-1 min-w-[200px] bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
      />
      <div class="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          @click="downloadCsv"
          class="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs shadow-md transition-all whitespace-nowrap flex items-center gap-1.5 border border-slate-600"
        >
          <span>📤</span> Export CSV
        </button>
        <button
          type="button"
          @click="openImportModal"
          class="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-xs shadow-md transition-all whitespace-nowrap flex items-center gap-1.5 border border-slate-600"
        >
          <span>📥</span> Import Statement
        </button>
        <button
          type="button"
          @click="showAddModal = true"
          class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-lg transition-all whitespace-nowrap flex items-center gap-1"
        >
          <span>+</span> Add Transaction
        </button>
      </div>
    </div>

    <!-- Grouped Transactions List -->
    <div class="space-y-3">
      <div v-if="filteredTransactions.length === 0" class="text-center py-12 text-slate-500 text-sm">
        No transactions matching query.
      </div>

      <div
        v-for="txn in filteredTransactions"
        :key="txn.id"
        class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 shadow-xl flex items-center justify-between hover:border-slate-600/60 transition-all gap-3"
      >
        <div class="flex items-center gap-3 min-w-0">
          <!-- Icon -->
          <div
            v-if="txn.type === 'transfer'"
            class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-inner bg-sky-600 flex-shrink-0"
          >
            ⇄
          </div>
          <div
            v-else
            class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-inner flex-shrink-0"
            :style="{ backgroundColor: getCategory(txn.categoryId)?.color || '#64748B' }"
          >
            {{ getCategory(txn.categoryId)?.name.charAt(0) || '?' }}
          </div>

          <!-- Transaction details -->
          <div class="min-w-0">
            <div v-if="txn.type === 'transfer'" class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-400 font-bold text-xs border border-sky-500/30">
                ⇄ Transfer: {{ getAccount(txn.accountId)?.name }} → {{ getAccount(txn.targetAccountId)?.name }}
              </span>
            </div>
            <div v-else class="text-sm font-semibold text-white truncate">
              {{ getCategory(txn.categoryId)?.name }}
            </div>

            <div class="text-xs text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
              <span class="tabular-nums">{{ txn.date }}</span>
              <span v-if="txn.type !== 'transfer'">• {{ getAccount(txn.accountId)?.name }}</span>
              <span v-if="txn.note">• {{ txn.note }}</span>

              <!-- Subtle Sync Source Badges -->
              <span
                v-if="txn.syncSource === 'realbyte_pc_manager'"
                class="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono font-semibold"
              >
                📶 Wi-Fi Sync
              </span>
              <span
                v-else-if="txn.syncSource === 'realbyte_sqlite_backup'"
                class="text-[9px] px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-400 border border-purple-800/40 font-mono font-semibold"
              >
                📂 Vault Sync
              </span>
              <span
                v-else-if="txn.syncSource === 'bank_import'"
                class="text-[9px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/40 font-mono font-semibold"
              >
                📥 Imported
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 flex-shrink-0">
          <div class="text-right">
            <div
              class="text-sm font-bold tabular-nums"
              :class="txn.type === 'income' ? 'text-emerald-400' : txn.type === 'expense' ? 'text-rose-400' : 'text-sky-400'"
            >
              {{ txn.type === 'income' ? '+' : txn.type === 'expense' ? '-' : '⇄ ' }}{{ formatBDT(txn.amount) }}
            </div>
            <div class="text-[10px] text-slate-500 tabular-nums">{{ txn.time || '12:00' }}</div>
          </div>

          <!-- Compact Action Buttons: Edit, Split & Delete -->
          <div class="flex items-center gap-1.5 border-l border-slate-700/60 pl-2">
            <button
              type="button"
              @click="openEditModal(txn)"
              class="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-sky-400 hover:border-sky-500/50 flex items-center justify-center text-xs transition-all"
              title="Edit transaction"
              aria-label="Edit transaction"
            >
              ✏️
            </button>
            <button
              v-if="txn.type !== 'transfer'"
              type="button"
              @click="openSplitModal(txn)"
              class="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 text-xs font-semibold transition-all flex items-center gap-1"
              title="Split transaction across 2 categories"
              aria-label="Split transaction"
            >
              <span>✂️</span> <span class="hidden sm:inline text-[11px]">Split</span>
            </button>
            <button
              type="button"
              @click="handleDeleteTransaction(txn.id)"
              class="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/50 flex items-center justify-center text-xs transition-all"
              title="Delete transaction (reverses account balance)"
              aria-label="Delete transaction"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Transaction Keypad Modal Component -->
    <TransactionKeypad
      v-model="showAddModal"
      :initialDate="store.selectedDate"
      :categories="store.categories"
      :accounts="store.accounts"
      @save="handleKeypadSave"
    />

    <!-- Bank Statement Importer Modal (CSV, QIF, OFX, CAMT) -->
    <div
      v-if="showImportModal"
      role="dialog"
      aria-modal="true"
      aria-label="Import Bank Statement"
      class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto overscroll-contain"
      @click.self="showImportModal = false"
    >
      <div class="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 w-full max-w-lg shadow-2xl space-y-4 text-white">
        <!-- Header -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <div class="flex items-center gap-2">
            <span class="text-lg">📥</span>
            <div>
              <h3 class="text-base font-bold text-white">Import Bank Statement</h3>
              <p class="text-xs text-slate-400">Zero-collision statement reconciliation (OFX, CAMT.053, CSV, QIF)</p>
            </div>
          </div>
          <button
            type="button"
            @click="showImportModal = false"
            class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm"
            aria-label="Close import modal"
          >
            ✕
          </button>
        </div>

        <!-- Format Selector -->
        <div class="space-y-1.5">
          <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Statement Format</label>
          <div class="grid grid-cols-4 gap-2">
            <button
              type="button"
              @click="importFormat = 'ofx'"
              class="py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center"
              :class="importFormat === 'ofx'
                ? 'bg-rose-600 text-white border-rose-500 shadow-md'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'"
            >
              OFX / QFX
            </button>
            <button
              type="button"
              @click="importFormat = 'camt'"
              class="py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center"
              :class="importFormat === 'camt'
                ? 'bg-rose-600 text-white border-rose-500 shadow-md'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'"
            >
              CAMT.053
            </button>
            <button
              type="button"
              @click="importFormat = 'csv'"
              class="py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center"
              :class="importFormat === 'csv'
                ? 'bg-rose-600 text-white border-rose-500 shadow-md'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'"
            >
              CSV
            </button>
            <button
              type="button"
              @click="importFormat = 'qif'"
              class="py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center"
              :class="importFormat === 'qif'
                ? 'bg-rose-600 text-white border-rose-500 shadow-md'
                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'"
            >
              QIF
            </button>
          </div>
        </div>

        <!-- Target Account Selector -->
        <div class="space-y-1.5">
          <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Target Account</label>
          <select
            v-model="importAccountId"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
          >
            <option v-for="acc in store.accounts" :key="acc.id" :value="acc.id">
              {{ acc.name }} ({{ acc.currency }})
            </option>
          </select>
        </div>

        <!-- Statement Content / File Upload -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between flex-wrap gap-1">
            <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Statement Content</label>
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="loadSampleCityBankOfx"
                class="text-[11px] text-sky-400 hover:text-sky-300 font-semibold underline"
              >
                Sample OFX
              </button>
              <span class="text-slate-600">•</span>
              <button
                type="button"
                @click="loadSampleCamtXml"
                class="text-[11px] text-sky-400 hover:text-sky-300 font-semibold underline"
              >
                Sample CAMT.053 XML
              </button>
            </div>
          </div>
          <textarea
            v-model="importContent"
            rows="5"
            placeholder="Paste raw OFX / CAMT.053 XML / CSV / QIF statement text or choose file below..."
            class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-slate-600"
          ></textarea>
          <div class="flex items-center justify-between pt-1">
            <input
              type="file"
              @change="handleFileUpload"
              class="text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
            />
          </div>
        </div>

        <!-- Reconciliation Report Card (Displayed after import) -->
        <div
          v-if="importReport"
          class="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-2 text-xs"
        >
          <div class="flex items-center justify-between text-emerald-400 font-bold">
            <span class="flex items-center gap-1.5">
              <span>✓</span> Statement Reconciled Successfully
            </span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
              Zero Duplicates
            </span>
          </div>
          <div class="grid grid-cols-2 gap-2 text-slate-300 pt-1">
            <div class="bg-slate-950/60 p-2 rounded-xl">
              <span class="text-slate-400 text-[11px]">Inserted Records:</span>
              <div class="text-base font-bold text-emerald-400 tabular-nums">{{ importReport.insertedTransactions }}</div>
            </div>
            <div class="bg-slate-950/60 p-2 rounded-xl">
              <span class="text-slate-400 text-[11px]">Skipped Duplicates:</span>
              <div class="text-base font-bold text-slate-200 tabular-nums">{{ importReport.skippedDuplicates }}</div>
            </div>
          </div>
        </div>

        <div v-if="importError" class="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300">
          {{ importError }}
        </div>

        <!-- Footer Actions -->
        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            @click="showImportModal = false"
            class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold transition-all"
          >
            {{ importReport ? 'Close' : 'Cancel' }}
          </button>
          <button
            type="button"
            @click="handleExecuteImport"
            :disabled="!importContent.trim()"
            class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg transition-all"
          >
            Execute Import
          </button>
        </div>
      </div>
    </div>

    <!-- Split Transaction Modal -->
    <div
      v-if="showSplitModal && splitModalTxn"
      role="dialog"
      aria-modal="true"
      aria-label="Split transaction"
      class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto overscroll-contain"
      @click.self="showSplitModal = false"
    >
      <div class="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-4 text-white">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <div class="flex items-center gap-2">
            <span class="text-lg">✂️</span>
            <div>
              <h3 class="text-base font-bold text-white">Split Transaction</h3>
              <p class="text-xs text-slate-400">Split ৳<span class="tabular-nums">{{ splitModalTxn.amount.toLocaleString() }}</span> across 2 categories</p>
            </div>
          </div>
          <button
            type="button"
            @click="showSplitModal = false"
            class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm"
            aria-label="Close split modal"
          >
            ✕
          </button>
        </div>

        <!-- Split Part 1 -->
        <div class="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
          <div class="text-[11px] font-bold uppercase tracking-wider text-rose-400">Part 1</div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[10px] text-slate-400 mb-1">Category</label>
              <select
                v-model="split1.categoryId"
                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                <option v-for="cat in availableSplitCategories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] text-slate-400 mb-1">Amount (৳)</label>
              <input
                v-model.number="split1.amount"
                type="number"
                min="1"
                @input="autoBalanceSplit2"
                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white tabular-nums"
              />
            </div>
          </div>
          <div>
            <input
              v-model="split1.note"
              placeholder="Note for Part 1"
              class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200"
            />
          </div>
        </div>

        <!-- Split Part 2 -->
        <div class="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
          <div class="text-[11px] font-bold uppercase tracking-wider text-sky-400">Part 2</div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[10px] text-slate-400 mb-1">Category</label>
              <select
                v-model="split2.categoryId"
                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                <option v-for="cat in availableSplitCategories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] text-slate-400 mb-1">Amount (৳)</label>
              <input
                v-model.number="split2.amount"
                type="number"
                min="1"
                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white tabular-nums"
              />
            </div>
          </div>
          <div>
            <input
              v-model="split2.note"
              placeholder="Note for Part 2"
              class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200"
            />
          </div>
        </div>

        <!-- Split Balance Verification -->
        <div class="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-950 border border-slate-800">
          <span class="text-slate-400">Total Allocated:</span>
          <span
            class="font-bold font-mono tabular-nums"
            :class="split1.amount + split2.amount === splitModalTxn.amount ? 'text-emerald-400' : 'text-rose-400'"
          >
            ৳{{ (split1.amount + split2.amount).toLocaleString() }} / ৳{{ splitModalTxn.amount.toLocaleString() }}
          </span>
        </div>

        <div v-if="splitError" class="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300">
          {{ splitError }}
        </div>

        <!-- Footer Actions -->
        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            @click="showSplitModal = false"
            class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="handleSaveSplit"
            :disabled="split1.amount + split2.amount !== splitModalTxn.amount"
            class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg transition-all"
          >
            Confirm Split
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Transaction Modal -->
    <div
      v-if="showEditModal && editingTxn"
      role="dialog"
      aria-modal="true"
      aria-label="Edit transaction"
      class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto overscroll-contain"
      @click.self="showEditModal = false"
    >
      <div class="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 w-full max-w-md shadow-2xl space-y-4 text-white">
        <div class="flex items-center justify-between pb-3 border-b border-slate-800">
          <div class="flex items-center gap-2">
            <span class="text-lg">✏️</span>
            <div>
              <h3 class="text-base font-bold text-white">Edit Transaction</h3>
              <p class="text-xs text-slate-400">Modify transaction details and adjust accounts</p>
            </div>
          </div>
          <button
            type="button"
            @click="showEditModal = false"
            class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm"
            aria-label="Close edit modal"
          >
            ✕
          </button>
        </div>

        <!-- Type Selector (if not transfer) -->
        <div v-if="editingTxn.type !== 'transfer'" class="grid grid-cols-2 gap-2">
          <button
            type="button"
            @click="editType = 'expense'"
            class="py-2 rounded-xl text-xs font-bold border transition-all"
            :class="editType === 'expense' ? 'bg-rose-600 text-white border-rose-500 shadow-md' : 'bg-slate-950 text-slate-400 border-slate-800'"
          >
            Expense
          </button>
          <button
            type="button"
            @click="editType = 'income'"
            class="py-2 rounded-xl text-xs font-bold border transition-all"
            :class="editType === 'income' ? 'bg-emerald-600 text-white border-emerald-500 shadow-md' : 'bg-slate-950 text-slate-400 border-slate-800'"
          >
            Income
          </button>
        </div>

        <!-- Amount & Date -->
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[10px] text-slate-400 mb-1">Amount (৳)</label>
            <input
              v-model.number="editAmount"
              type="number"
              min="1"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white tabular-nums focus:outline-none focus:border-slate-600"
            />
          </div>
          <div>
            <label class="block text-[10px] text-slate-400 mb-1">Date</label>
            <input
              v-model="editDate"
              type="date"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white tabular-nums focus:outline-none focus:border-slate-600"
            />
          </div>
        </div>

        <!-- Account & Category -->
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[10px] text-slate-400 mb-1">Account</label>
            <select
              v-model="editAccountId"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
            >
              <option v-for="acc in store.accounts" :key="acc.id" :value="acc.id">
                {{ acc.name }}
              </option>
            </select>
          </div>
          <div v-if="editingTxn.type !== 'transfer'">
            <label class="block text-[10px] text-slate-400 mb-1">Category</label>
            <select
              v-model="editCategoryId"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
            >
              <option
                v-for="cat in store.categories.filter(c => c.type === editType)"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </option>
            </select>
          </div>
        </div>

        <!-- Note -->
        <div>
          <label class="block text-[10px] text-slate-400 mb-1">Note / Description</label>
          <input
            v-model="editNote"
            placeholder="Transaction note"
            class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
          />
        </div>

        <!-- Footer Actions -->
        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            @click="showEditModal = false"
            class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="handleSaveEdit"
            :disabled="editAmount <= 0"
            class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-lg transition-all"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMoneyStore } from '../store';
import { Transaction, TransactionType, SyncReconciliationReport } from '../types';
import TransactionKeypad from './TransactionKeypad.vue';

const store = useMoneyStore();
const searchQuery = ref('');
const showAddModal = ref(false);

// Bank Statement Importer State
const showImportModal = ref(false);
const importFormat = ref<'ofx' | 'camt' | 'csv' | 'qif'>('ofx');
const importAccountId = ref(store.accounts[0]?.id || '');
const importContent = ref('');
const importReport = ref<SyncReconciliationReport | null>(null);
const importError = ref('');

// Split Transaction State
const showSplitModal = ref(false);
const splitModalTxn = ref<Transaction | null>(null);
const split1 = ref({ categoryId: '', amount: 0, note: '' });
const split2 = ref({ categoryId: '', amount: 0, note: '' });
const splitError = ref('');

// Edit Transaction State
const showEditModal = ref(false);
const editingTxn = ref<Transaction | null>(null);
const editDate = ref('');
const editType = ref<TransactionType>('expense');
const editAmount = ref(0);
const editAccountId = ref('');
const editCategoryId = ref('');
const editNote = ref('');

const filteredTransactions = computed(() => {
  if (!searchQuery.value.trim()) return store.transactions;
  const q = searchQuery.value.toLowerCase();
  return store.transactions.filter(t => {
    const cat = getCategory(t.categoryId)?.name.toLowerCase() || '';
    const acc = getAccount(t.accountId)?.name.toLowerCase() || '';
    const targetAcc = t.targetAccountId ? getAccount(t.targetAccountId)?.name.toLowerCase() || '' : '';
    const note = t.note?.toLowerCase() || '';
    const desc = t.description?.toLowerCase() || '';
    return cat.includes(q) || acc.includes(q) || targetAcc.includes(q) || note.includes(q) || desc.includes(q);
  });
});

const availableSplitCategories = computed(() => {
  if (!splitModalTxn.value) return store.categories;
  return store.categories.filter(c => c.type === splitModalTxn.value?.type);
});

function getCategory(id?: string) {
  if (!id) return undefined;
  return store.categories.find(c => c.id === id);
}

function getAccount(id?: string) {
  if (!id) return undefined;
  return store.accounts.find(a => a.id === id);
}

function handleKeypadSave(payload: {
  amount: number;
  type: TransactionType;
  categoryId: string;
  accountId: string;
  targetAccountId?: string;
  date: string;
  time: string;
  note: string;
  description: string;
}) {
  store.addTransaction({
    amount: payload.amount,
    type: payload.type,
    categoryId: payload.categoryId,
    accountId: payload.accountId,
    targetAccountId: payload.targetAccountId,
    date: payload.date,
    time: payload.time,
    note: payload.note || payload.description,
    description: payload.description
  });
}

function downloadCsv() {
  const blob = new Blob([store.csvExport], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'money-manager-transactions.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function handleDeleteTransaction(id: string) {
  store.deleteTransaction(id);
}

function openEditModal(txn: Transaction) {
  editingTxn.value = txn;
  editDate.value = txn.date;
  editType.value = txn.type;
  editAmount.value = txn.amount;
  editAccountId.value = txn.accountId;
  editCategoryId.value = txn.categoryId;
  editNote.value = txn.note || txn.description || '';
  showEditModal.value = true;
}

function handleSaveEdit() {
  if (!editingTxn.value) return;
  store.editTransaction(editingTxn.value.id, {
    date: editDate.value,
    type: editType.value,
    amount: editAmount.value,
    accountId: editAccountId.value,
    categoryId: editCategoryId.value,
    note: editNote.value,
    description: editNote.value
  });
  showEditModal.value = false;
  editingTxn.value = null;
}

function openSplitModal(txn: Transaction) {
  splitModalTxn.value = txn;
  splitError.value = '';
  const half = Math.round(txn.amount / 2);
  split1.value = {
    categoryId: txn.categoryId,
    amount: half,
    note: txn.note ? `${txn.note} (Part 1)` : 'Part 1'
  };
  const otherCat = store.categories.find(c => c.id !== txn.categoryId && c.type === txn.type);
  split2.value = {
    categoryId: otherCat ? otherCat.id : txn.categoryId,
    amount: txn.amount - half,
    note: txn.note ? `${txn.note} (Part 2)` : 'Part 2'
  };
  showSplitModal.value = true;
}

function autoBalanceSplit2() {
  if (!splitModalTxn.value) return;
  const remaining = splitModalTxn.value.amount - split1.value.amount;
  if (remaining >= 0) {
    split2.value.amount = remaining;
  }
}

function handleSaveSplit() {
  if (!splitModalTxn.value) return;
  const sum = split1.value.amount + split2.value.amount;
  if (sum !== splitModalTxn.value.amount) {
    splitError.value = `Sum of parts (৳${sum}) must equal original amount (৳${splitModalTxn.value.amount}).`;
    return;
  }
  if (!split1.value.categoryId || !split2.value.categoryId) {
    splitError.value = 'Please select a category for both parts.';
    return;
  }

  store.splitExistingTransaction(splitModalTxn.value.id, [
    {
      categoryId: split1.value.categoryId,
      amount: split1.value.amount,
      note: split1.value.note
    },
    {
      categoryId: split2.value.categoryId,
      amount: split2.value.amount,
      note: split2.value.note
    }
  ]);
  showSplitModal.value = false;
  splitModalTxn.value = null;
}

function openImportModal() {
  importReport.value = null;
  importError.value = '';
  if (!importAccountId.value && store.accounts.length > 0) {
    importAccountId.value = store.accounts[0].id;
  }
  showImportModal.value = true;
}

function loadSampleCityBankOfx() {
  importFormat.value = 'ofx';
  const cityBank = store.accounts.find(a => a.id === 'city_bank' || a.name.toLowerCase().includes('city'));
  if (cityBank) importAccountId.value = cityBank.id;
  importContent.value = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252

<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20261105120000[0:GMT]
            <TRNAMT>-1250.00
            <FITID>OFX-TX-001
            <NAME>Agora Superstore
            <MEMO>Weekly bazar
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20261106
            <TRNAMT>50000.00
            <FITID>OFX-TX-002
            <NAME>Brain Station 23
            <MEMO>Monthly salary
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;
}

function loadSampleCamtXml() {
  importFormat.value = 'camt';
  const cityBank = store.accounts.find(a => a.id === 'city_bank' || a.name.toLowerCase().includes('city'));
  if (cityBank) importAccountId.value = cityBank.id;
  importContent.value = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <Stmt>
      <Id>STMT-2026-11</Id>
      <Ntry>
        <Amt Ccy="BDT">2450.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt>
          <Dt>2026-11-05</Dt>
        </BookgDt>
        <AcctSvcrRef>REF-BD-20261105-01</AcctSvcrRef>
        <NtryDtls>
          <TxDtls>
            <RltdPties>
              <Cdtr>
                <Nm>Meena Bazar Dhanmondi</Nm>
              </Cdtr>
            </RltdPties>
            <RmtInf>
              <Ustrd>Weekly grocery essentials</Ustrd>
            </RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="BDT">85000.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt>
          <DtTm>2026-11-06T09:30:00</DtTm>
        </BookgDt>
        <AcctSvcrRef>REF-BD-20261106-02</AcctSvcrRef>
        <NtryDtls>
          <TxDtls>
            <RltdPties>
              <Dbtr>
                <Nm>Apex Holdings Ltd</Nm>
              </Dbtr>
            </RltdPties>
            <RmtInf>
              <Ustrd>November 2026 Salary</Ustrd>
            </RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;
}

function handleFileUpload(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'xml') importFormat.value = 'camt';
  else if (ext === 'ofx' || ext === 'qfx') importFormat.value = 'ofx';
  else if (ext === 'csv') importFormat.value = 'csv';
  else if (ext === 'qif') importFormat.value = 'qif';

  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      importContent.value = reader.result;
    }
  };
  reader.readAsText(file);
}

function handleExecuteImport() {
  if (!importContent.value.trim() || !importAccountId.value) return;
  importError.value = '';
  try {
    const report = store.importBankStatement(importFormat.value, importContent.value, importAccountId.value);
    importReport.value = report;
  } catch (err: any) {
    importError.value = err?.message || 'Failed to parse statement content.';
  }
}

function formatBDT(amount: number): string {
  return '৳' + amount.toLocaleString('en-US');
}
</script>