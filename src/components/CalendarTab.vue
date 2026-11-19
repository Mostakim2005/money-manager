<template>
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
    <!-- Left Column: Month Summary Banner + 7-Column Calendar Grid -->
    <div class="lg:col-span-7 xl:col-span-8 space-y-4">
      <!-- Month Header & Summary Banner -->
      <div class="card-surface border rounded-2xl p-4 shadow-sm">
        <div class="flex items-center justify-between mb-3 gap-2">
          <button
            type="button"
            @click="changeMonth(-1)"
            aria-label="Previous month"
            class="p-2 rounded-xl panel-surface border hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>

          <div class="flex items-center gap-2.5">
            <h2 class="text-lg sm:text-xl font-bold tracking-tight">
              {{ monthName }} {{ store.selectedYear }}
            </h2>
            <button
              type="button"
              @click="jumpToToday"
              class="text-[11px] px-2.5 py-1 rounded-lg panel-surface border font-semibold hover:border-rose-500/50"
            >
              Today
            </button>
          </div>

          <button
            type="button"
            @click="changeMonth(1)"
            aria-label="Next month"
            class="p-2 rounded-xl panel-surface border hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
          >
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>

        <div class="grid grid-cols-3 gap-2.5 text-center pt-3 border-t border-slate-200 dark:border-slate-800 tabular-nums">
          <div class="panel-surface border p-2.5 rounded-xl">
            <div class="text-xs font-medium text-slate-500 dark:text-slate-400">Income</div>
            <div class="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
              +{{ formatBDT(monthSummary.totalIncome, store.privacyMode) }}
            </div>
          </div>
          <div class="panel-surface border p-2.5 rounded-xl">
            <div class="text-xs font-medium text-slate-500 dark:text-slate-400">Expense</div>
            <div class="text-sm sm:text-base font-bold text-rose-600 dark:text-rose-400">
              -{{ formatBDT(monthSummary.totalExpense, store.privacyMode) }}
            </div>
          </div>
          <div class="panel-surface border p-2.5 rounded-xl">
            <div class="text-xs font-medium text-slate-500 dark:text-slate-400">Net</div>
            <div
              class="text-sm sm:text-base font-bold"
              :class="monthSummary.netBalance >= 0 ? 'text-sky-600 dark:text-sky-400' : 'text-rose-600 dark:text-rose-400'"
            >
              {{ monthSummary.netBalance >= 0 ? '+' : '' }}{{ formatBDT(monthSummary.netBalance, store.privacyMode) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 7-Column Realbyte Calendar Grid -->
      <div class="card-surface border rounded-2xl p-4 shadow-sm">
        <div class="grid grid-cols-7 gap-1 text-center font-semibold text-xs text-slate-500 dark:text-slate-400 mb-2">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span class="text-rose-600 dark:text-rose-400">Fri</span>
          <span class="text-rose-600 dark:text-rose-400">Sat</span>
        </div>

        <div class="grid grid-cols-7 gap-1.5">
          <div
            v-for="pad in startPaddingDays"
            :key="'pad-' + pad"
            class="min-h-[4.5rem] sm:min-h-[5.25rem] rounded-xl panel-surface opacity-40"
            aria-hidden="true"
          ></div>

          <button
            v-for="d in daysInMonth"
            :key="'day-' + d"
            type="button"
            @click="selectDate(d)"
            :aria-pressed="selectedDateStr === getDateStr(d)"
            class="min-h-[4.5rem] sm:min-h-[5.25rem] min-w-0 overflow-hidden p-1.5 rounded-xl border transition-colors flex flex-col justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            :class="[
              selectedDateStr === getDateStr(d)
                ? 'border-rose-500 bg-rose-500/10 ring-2 ring-rose-500/30'
                : 'panel-surface hover:border-slate-400 dark:hover:border-slate-600',
            ]"
          >
            <div class="flex items-center justify-between w-full">
              <span
                class="text-xs font-bold tabular-nums"
                :class="isWeekend(d) ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'"
              >
                {{ d }}
              </span>
              <span
                v-if="getDaySummary(d)?.transactionCount"
                class="w-1.5 h-1.5 rounded-full bg-rose-500"
              ></span>
            </div>

            <div class="text-right space-y-0.5 overflow-hidden w-full tabular-nums">
              <div
                v-if="getDaySummary(d)?.income"
                class="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 leading-tight truncate"
              >
                +{{ formatCompactBDT(getDaySummary(d)!.income, store.privacyMode) }}
              </div>
              <div
                v-if="getDaySummary(d)?.expense"
                class="text-[10px] font-semibold text-rose-600 dark:text-rose-400 leading-tight truncate"
              >
                -{{ formatCompactBDT(getDaySummary(d)!.expense, store.privacyMode) }}
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Right Column: Sticky Day Transaction Sheet -->
    <div class="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-6 card-surface border rounded-2xl p-4 shadow-sm space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h3 class="font-bold text-base tabular-nums">
            {{ selectedDateStr }}
          </h3>
          <span class="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {{ selectedDayTransactions.length }} transaction{{ selectedDayTransactions.length === 1 ? '' : 's' }}
          </span>
        </div>
        <button
          type="button"
          @click="store.openQuickKeypad({ date: selectedDateStr })"
          class="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-sm flex items-center gap-1"
        >
          <Plus class="w-3.5 h-3.5" /> Log
        </button>
      </div>

      <div v-if="selectedDayTransactions.length === 0" class="text-center py-10 text-slate-500 text-xs">
        No transactions recorded on {{ selectedDateStr }}.
      </div>

      <div v-else class="space-y-2 max-h-[62vh] overflow-y-auto scroller pr-0.5">
        <div
          v-for="txn in selectedDayTransactions"
          :key="txn.id"
          class="panel-surface border rounded-xl p-3 flex items-center justify-between gap-2.5"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <div
              v-if="txn.type === 'transfer'"
              class="w-9 h-9 rounded-xl flex items-center justify-center text-white bg-sky-600 flex-shrink-0"
            >
              <ArrowLeftRight class="w-4 h-4" />
            </div>
            <div
              v-else
              class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
              :style="{ backgroundColor: getCategory(txn.categoryId)?.color || '#64748B' }"
            >
              {{ getCategory(txn.categoryId)?.name.charAt(0) || '?' }}
            </div>

            <div class="min-w-0">
              <div v-if="txn.type === 'transfer'" class="text-xs font-semibold text-sky-600 dark:text-sky-400 truncate">
                {{ getAccount(txn.accountId)?.name }} → {{ getAccount(txn.targetAccountId)?.name }}
              </div>
              <div v-else class="text-xs font-semibold truncate">
                {{ getCategory(txn.categoryId)?.name || 'Uncategorized' }}
                <span v-if="txn.subcategoryId" class="text-slate-500 font-normal">• {{ txn.subcategoryId }}</span>
              </div>
              <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                <span v-if="txn.type !== 'transfer'">{{ getAccount(txn.accountId)?.name }}</span>
                <span v-if="txn.note"> • {{ txn.note }}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            <div class="text-right tabular-nums">
              <div
                class="text-xs font-bold"
                :class="
                  txn.type === 'income'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : txn.type === 'expense'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-sky-600 dark:text-sky-400'
                "
              >
                {{ formatSignedBDT(txn.amount, txn.type, store.privacyMode) }}
              </div>
              <div class="text-[10px] text-slate-500">{{ txn.time || '12:00' }}</div>
            </div>

            <div class="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-2">
              <button
                type="button"
                @click="openInlineEdit(txn)"
                aria-label="Edit transaction"
                class="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-500/10"
              >
                <Pencil class="w-3.5 h-3.5" />
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
          </div>
        </div>
      </div>
    </div>

    <!-- Inline Edit Modal -->
    <BaseModal v-model="showEditModal" title="Edit Transaction" maxWidthClass="max-w-md">
      <div v-if="editingTxn" class="space-y-3 text-xs">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Amount (৳)</label>
            <input v-model.number="editForm.amount" type="number" min="1" class="w-full input-surface border rounded-xl px-3 py-2 font-bold tabular-nums" />
          </div>
          <div>
            <label class="block font-semibold mb-1">Date</label>
            <input v-model="editForm.date" type="date" class="w-full input-surface border rounded-xl px-3 py-2 tabular-nums" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Account</label>
            <select v-model="editForm.accountId" class="w-full input-surface border rounded-xl px-2.5 py-2">
              <option v-for="acc in store.accounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
            </select>
          </div>
          <div v-if="editingTxn.type !== 'transfer'">
            <label class="block font-semibold mb-1">Category</label>
            <select v-model="editForm.categoryId" class="w-full input-surface border rounded-xl px-2.5 py-2">
              <option
                v-for="cat in store.categories.filter((c) => c.type === editingTxn?.type)"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </option>
            </select>
          </div>
          <div v-else>
            <label class="block font-semibold mb-1">To Account</label>
            <select v-model="editForm.targetAccountId" class="w-full input-surface border rounded-xl px-2.5 py-2">
              <option
                v-for="acc in store.accounts.filter((a) => a.id !== editForm.accountId)"
                :key="acc.id"
                :value="acc.id"
              >
                {{ acc.name }}
              </option>
            </select>
          </div>
        </div>

        <div>
          <label class="block font-semibold mb-1">Note</label>
          <input v-model="editForm.note" class="w-full input-surface border rounded-xl px-3 py-2" />
        </div>
      </div>

      <template #footer>
        <button type="button" @click="showEditModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button type="button" @click="saveInlineEdit" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold">
          Save Changes
        </button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowLeftRight, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-vue-next';
import BaseModal from './BaseModal.vue';
import { useMoneyStore, getLocalTodayISO } from '../store';
import { buildMonthCalendarMatrix } from '../modules/calendar/matrix';
import { formatBDT, formatCompactBDT, formatSignedBDT } from '../utils/format';
import type { Transaction } from '../types';

const store = useMoneyStore();

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const monthName = computed(() => monthNames[store.selectedMonth - 1]);
const daysInMonth = computed(() => new Date(store.selectedYear, store.selectedMonth, 0).getDate());
const startPaddingDays = computed(() => new Date(store.selectedYear, store.selectedMonth - 1, 1).getDay());

const monthSummary = computed(() =>
  buildMonthCalendarMatrix(store.transactions, store.selectedYear, store.selectedMonth)
);

const selectedDateStr = computed(() => store.selectedDate);
const selectedDayTransactions = computed(() =>
  store.transactions.filter((t) => t.date === store.selectedDate)
);

function getDateStr(d: number): string {
  return `${store.selectedYear}-${String(store.selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function selectDate(d: number) {
  store.selectedDate = getDateStr(d);
}

function getDaySummary(d: number) {
  return monthSummary.value.days[getDateStr(d)];
}

function isWeekend(d: number): boolean {
  const dayOfWeek = new Date(store.selectedYear, store.selectedMonth - 1, d).getDay();
  return dayOfWeek === 5 || dayOfWeek === 6; // Friday & Saturday (Bangladesh)
}

function changeMonth(delta: number) {
  let m = store.selectedMonth + delta;
  let y = store.selectedYear;
  if (m < 1) {
    m = 12;
    y--;
  } else if (m > 12) {
    m = 1;
    y++;
  }
  store.selectedMonth = m;
  store.selectedYear = y;
  store.selectedDate = `${y}-${String(m).padStart(2, '0')}-01`;
}

function jumpToToday() {
  const today = getLocalTodayISO();
  const [y, m] = today.split('-').map(Number);
  store.selectedYear = y;
  store.selectedMonth = m;
  store.selectedDate = today;
}

function getCategory(id?: string) {
  if (!id) return undefined;
  return store.categories.find((c) => c.id === id);
}

function getAccount(id?: string) {
  if (!id) return undefined;
  return store.accounts.find((a) => a.id === id);
}

// Inline Edit
const showEditModal = ref(false);
const editingTxn = ref<Transaction | null>(null);
const editForm = ref({
  amount: 0,
  date: '',
  accountId: '',
  targetAccountId: '',
  categoryId: '',
  note: '',
});

function openInlineEdit(txn: Transaction) {
  editingTxn.value = txn;
  editForm.value = {
    amount: txn.amount,
    date: txn.date,
    accountId: txn.accountId,
    targetAccountId: txn.targetAccountId || '',
    categoryId: txn.categoryId,
    note: txn.note || '',
  };
  showEditModal.value = true;
}

function saveInlineEdit() {
  if (!editingTxn.value || editForm.value.amount <= 0) return;
  store.editTransaction(editingTxn.value.id, {
    amount: Math.round(editForm.value.amount),
    date: editForm.value.date,
    accountId: editForm.value.accountId,
    targetAccountId: editingTxn.value.type === 'transfer' ? editForm.value.targetAccountId : undefined,
    categoryId: editingTxn.value.type === 'transfer' ? 'transfer' : editForm.value.categoryId,
    note: editForm.value.note.trim() || undefined,
  });
  showEditModal.value = false;
}
</script>
