<template>
  <div class="space-y-4">
    <!-- Month Header & Summary Banner (Realbyte Style) -->
    <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 shadow-xl">
      <div class="flex items-center justify-between mb-3">
        <button
          type="button"
          @click="changeMonth(-1)"
          aria-label="Previous month"
          class="p-2 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
        >
          ◀
        </button>
        <h2 class="text-xl font-bold tracking-tight text-white">
          {{ monthName }} {{ store.selectedYear }}
        </h2>
        <button
          type="button"
          @click="changeMonth(1)"
          aria-label="Next month"
          class="p-2 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
        >
          ▶
        </button>
      </div>

      <div class="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-700/60 tabular-nums">
        <div class="bg-slate-900/50 p-2.5 rounded-xl">
          <div class="text-xs font-medium text-slate-400">Income</div>
          <div class="text-base font-bold text-emerald-400">+{{ formatBDT(monthSummary.totalIncome) }}</div>
        </div>
        <div class="bg-slate-900/50 p-2.5 rounded-xl">
          <div class="text-xs font-medium text-slate-400">Expense</div>
          <div class="text-base font-bold text-rose-400">-{{ formatBDT(monthSummary.totalExpense) }}</div>
        </div>
        <div class="bg-slate-900/50 p-2.5 rounded-xl">
          <div class="text-xs font-medium text-slate-400">Total</div>
          <div class="text-base font-bold" :class="monthSummary.netBalance >= 0 ? 'text-sky-400' : 'text-rose-400'">
            {{ monthSummary.netBalance >= 0 ? '+' : '' }}{{ formatBDT(monthSummary.netBalance) }}
          </div>
        </div>
      </div>
    </div>

    <!-- 7-Column Realbyte Calendar Grid -->
    <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 shadow-xl">
      <!-- Weekday Headers -->
      <div class="grid grid-cols-7 gap-1 text-center font-semibold text-xs text-slate-400 mb-2">
        <span class="text-rose-400">Sun</span>
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span class="text-sky-400">Sat</span>
      </div>

      <!-- Calendar Days -->
      <div class="grid grid-cols-7 gap-1 sm:gap-1.5">
        <!-- Padding empty cells for first day of month -->
        <div v-for="pad in startPaddingDays" :key="'pad-' + pad" class="min-h-[4.5rem] sm:min-h-[5.25rem] min-w-0 bg-slate-900/20 rounded-xl opacity-30"></div>

        <!-- Real days -->
        <div
          v-for="d in daysInMonth"
          :key="'day-' + d"
          @click="selectDate(d)"
          class="min-h-[4.5rem] sm:min-h-[5.25rem] min-w-0 overflow-hidden p-1 sm:p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between"
          :class="[
            selectedDateStr === getDateStr(d)
              ? 'border-rose-500 bg-rose-500/10 ring-2 ring-rose-500/40'
              : 'border-slate-700/50 bg-slate-900/40 hover:bg-slate-700/40'
          ]"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold tabular-nums" :class="isWeekend(d) ? 'text-rose-400' : 'text-slate-300'">
              {{ d }}
            </span>
            <span v-if="getDaySummary(d)?.transactionCount" class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          </div>

          <div class="text-right space-y-0.5 overflow-hidden tabular-nums">
            <div v-if="getDaySummary(d)?.income" class="text-[9px] sm:text-[10px] font-semibold text-emerald-400 leading-tight truncate">
              +{{ formatCompact(getDaySummary(d)!.income) }}
            </div>
            <div v-if="getDaySummary(d)?.expense" class="text-[9px] sm:text-[10px] font-semibold text-rose-400 leading-tight truncate">
              -{{ formatCompact(getDaySummary(d)!.expense) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Day Transaction Sheet (Shown when day is tapped) -->
    <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 shadow-xl">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 class="font-bold text-white text-base">
            Transactions on {{ selectedDateStr }}
          </h3>
          <span class="text-xs text-slate-400 tabular-nums">
            {{ selectedDayTransactions.length }} recorded
          </span>
        </div>
        <button
          type="button"
          @click="showKeypad = true"
          class="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-md transition-all flex items-center gap-1 active:scale-95"
        >
          <span>+</span> Log on {{ selectedDateStr }}
        </button>
      </div>

      <div v-if="selectedDayTransactions.length === 0" class="text-center py-6 text-slate-500 text-sm">
        No transactions recorded on this day.
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="txn in selectedDayTransactions"
          :key="txn.id"
          class="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-slate-700/40"
        >
          <div class="flex items-center gap-3">
            <div
              v-if="txn.type === 'transfer'"
              class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white bg-sky-600 text-base"
            >
              ⇄
            </div>
            <div
              v-else
              class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white"
              :style="{ backgroundColor: getCategory(txn.categoryId)?.color || '#64748B' }"
            >
              {{ getCategory(txn.categoryId)?.name.charAt(0) || '?' }}
            </div>
            <div>
              <div v-if="txn.type === 'transfer'" class="text-sm font-semibold text-sky-400">
                ⇄ Transfer: {{ getAccount(txn.accountId)?.name }} → {{ getAccount(txn.targetAccountId)?.name }}
              </div>
              <div v-else class="text-sm font-semibold text-white">
                {{ getCategory(txn.categoryId)?.name }}
              </div>
              <div class="text-xs text-slate-400">
                <span v-if="txn.type !== 'transfer'">{{ getAccount(txn.accountId)?.name }}</span>
                <span v-if="txn.note"> • {{ txn.note }}</span>
              </div>
            </div>
          </div>

          <div class="text-right tabular-nums">
            <div
              class="text-sm font-bold"
              :class="txn.type === 'income' ? 'text-emerald-400' : txn.type === 'expense' ? 'text-rose-400' : 'text-sky-400'"
            >
              {{ txn.type === 'income' ? '+' : txn.type === 'expense' ? '-' : '⇄ ' }}{{ formatBDT(txn.amount) }}
            </div>
            <div class="text-[10px] text-slate-500">{{ txn.time || '12:00' }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Transaction Keypad Modal Component -->
    <TransactionKeypad
      v-model="showKeypad"
      :initialDate="selectedDateStr"
      :categories="store.categories"
      :accounts="store.accounts"
      @save="handleKeypadSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMoneyStore } from '../store';
import { buildMonthCalendarMatrix } from '../modules/calendar/matrix';
import { TransactionType } from '../types';
import TransactionKeypad from './TransactionKeypad.vue';

const store = useMoneyStore();
const showKeypad = ref(false);

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

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const monthName = computed(() => monthNames[store.selectedMonth - 1]);
const daysInMonth = computed(() => new Date(store.selectedYear, store.selectedMonth, 0).getDate());

const startPaddingDays = computed(() => {
  return new Date(store.selectedYear, store.selectedMonth - 1, 1).getDay();
});

const monthSummary = computed(() => {
  return buildMonthCalendarMatrix(store.transactions, store.selectedYear, store.selectedMonth);
});

const selectedDateStr = computed(() => store.selectedDate);

const selectedDayTransactions = computed(() => {
  return store.transactions.filter(t => t.date === store.selectedDate);
});

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
  return dayOfWeek === 0; // Sunday
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

function getCategory(id?: string) {
  if (!id) return undefined;
  return store.categories.find(c => c.id === id);
}

function getAccount(id?: string) {
  if (!id) return undefined;
  return store.accounts.find(a => a.id === id);
}

function formatBDT(amount: number): string {
  return '৳' + amount.toLocaleString('en-US');
}

function formatCompact(amount: number): string {
  if (amount >= 100000) return (amount / 100000).toFixed(1) + 'L';
  if (amount >= 1000) return (amount / 1000).toFixed(0) + 'k';
  return String(amount);
}
</script>
