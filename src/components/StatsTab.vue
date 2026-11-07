<template>
  <div class="space-y-4">
    <!-- Period Filter & Month / All-Time Toggle Bar -->
    <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3.5 shadow-xl flex flex-wrap items-center justify-between gap-3">
      <!-- Month Navigation (when periodScope === 'month') -->
      <div v-if="periodScope === 'month'" class="flex items-center gap-2">
        <button
          @click="changeMonth(-1)"
          class="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center text-xs transition-all shadow-sm"
          aria-label="Previous Month"
        >
          ◀
        </button>
        <div>
          <span class="text-sm font-bold text-white tracking-wide">
            {{ monthName }} {{ store.selectedYear }}
          </span>
          <span class="ml-2 text-[10px] text-slate-400 font-medium">
            ({{ activeTransactions.length }} txns)
          </span>
        </div>
        <button
          @click="changeMonth(1)"
          class="w-8 h-8 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center text-xs transition-all shadow-sm"
          aria-label="Next Month"
        >
          ▶
        </button>
      </div>

      <!-- All-Time Label (when periodScope === 'all') -->
      <div v-else class="flex items-center gap-2 px-1">
        <span class="text-sm font-bold text-white tracking-wide">
          All-Time Overview
        </span>
        <span class="text-[10px] text-slate-400 font-medium">
          ({{ store.transactions.length }} total txns)
        </span>
      </div>

      <!-- Segmented Mode Toggle -->
      <div class="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800 ml-auto">
        <button
          type="button"
          @click="periodScope = 'month'"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          :class="periodScope === 'month'
            ? 'bg-rose-600 text-white shadow-md'
            : 'text-slate-400 hover:text-slate-200'"
        >
          Monthly
        </button>
        <button
          type="button"
          @click="periodScope = 'all'"
          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          :class="periodScope === 'all'
            ? 'bg-rose-600 text-white shadow-md'
            : 'text-slate-400 hover:text-slate-200'"
        >
          All-Time
        </button>
      </div>
    </div>

    <!-- Savings Rate Banner -->
    <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-xl">
      <div class="flex items-center justify-between mb-3">
        <div>
          <div class="text-xs text-slate-400 font-semibold uppercase tracking-wider">Savings Rate</div>
          <div class="text-2xl font-bold text-white mt-0.5 tabular-nums">{{ stats.savingsRatePercentage }}%</div>
        </div>
        <div class="text-right">
          <div class="text-xs text-slate-400">Net Saved</div>
          <div class="text-lg font-bold tabular-nums" :class="stats.netSavings >= 0 ? 'text-emerald-400' : 'text-rose-400'">
            {{ stats.netSavings >= 0 ? '+' : '' }}{{ formatBDT(stats.netSavings) }}
          </div>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="w-full h-3 rounded-full bg-slate-900 overflow-hidden p-0.5 border border-slate-700/60">
        <div
          class="h-full rounded-full transition-all duration-500"
          :class="stats.savingsRatePercentage >= 20 ? 'bg-emerald-500' : 'bg-amber-500'"
          :style="{ width: Math.min(Math.max(stats.savingsRatePercentage, 0), 100) + '%' }"
        ></div>
      </div>
    </div>

    <!-- Zero-Based Envelope Budgeting Card (Active when budgetMode === 'envelope_allocation') -->
    <div
      v-if="store.budgetMode === 'envelope_allocation'"
      class="bg-slate-800/80 border border-indigo-500/40 rounded-2xl p-5 shadow-xl space-y-4 ring-1 ring-indigo-500/20"
    >
      <div class="flex items-center justify-between">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-base">✉️</span>
            <h3 class="font-bold text-white text-base">Zero-Based Envelope Budgets</h3>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
              Actual Budget Mode
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-1">
            Allocated monthly envelopes vs. actual expenditures.
          </p>
        </div>
        <button
          type="button"
          @click="store.budgetMode = 'cashflow_ledger'"
          class="text-[11px] text-slate-400 hover:text-slate-200 underline"
        >
          Cashflow view
        </button>
      </div>

      <!-- Envelope Aggregate Metric Cards -->
      <div class="grid grid-cols-3 gap-2 text-center pt-1">
        <div class="bg-slate-900/60 border border-slate-700/50 p-2.5 rounded-xl">
          <div class="text-[11px] font-medium text-slate-400">Total Budgeted</div>
          <div class="text-sm sm:text-base font-bold text-slate-200 mt-0.5 tabular-nums">
            {{ formatBDT(totalAllocated) }}
          </div>
        </div>
        <div class="bg-slate-900/60 border border-slate-700/50 p-2.5 rounded-xl">
          <div class="text-[11px] font-medium text-slate-400">Total Spent</div>
          <div class="text-sm sm:text-base font-bold text-rose-400 mt-0.5 tabular-nums">
            {{ formatBDT(totalSpent) }}
          </div>
        </div>
        <div class="bg-slate-900/60 border border-slate-700/50 p-2.5 rounded-xl">
          <div class="text-[11px] font-medium text-slate-400">Remaining Balance</div>
          <div
            class="text-sm sm:text-base font-bold mt-0.5 tabular-nums"
            :class="totalRemaining >= 0 ? 'text-emerald-400' : 'text-rose-400'"
          >
            {{ totalRemaining >= 0 ? '+' : '' }}{{ formatBDT(totalRemaining) }}
          </div>
        </div>
      </div>

      <!-- Envelope Categories List -->
      <div class="space-y-3 pt-2">
        <div
          v-for="env in envelopeList"
          :key="env.id"
          class="p-3 rounded-xl bg-slate-900/50 border border-slate-700/50 space-y-2 hover:border-slate-600 transition-all"
        >
          <!-- Top Row: Category Name & Balances -->
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-white flex items-center gap-2">
              <span class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: env.color || '#64748B' }"></span>
              {{ env.name }}
            </span>

            <div class="flex items-center gap-2">
              <span
                class="px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums"
                :class="getStatusBadgeClass(env.status)"
              >
                {{ env.percentage > 100 ? 'OVER ' + env.percentage.toFixed(0) + '%' : env.percentage.toFixed(0) + '%' }}
              </span>
              <span
                class="font-bold tabular-nums"
                :class="env.remaining >= 0 ? 'text-slate-200' : 'text-rose-400'"
              >
                {{ env.remaining >= 0 ? formatBDT(env.remaining) + ' left' : '-' + formatBDT(Math.abs(env.remaining)) + ' over' }}
              </span>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
            <div
              class="h-full rounded-full transition-all duration-300"
              :class="getProgressBarColor(env.status)"
              :style="{ width: Math.min(env.percentage, 100) + '%' }"
            ></div>
          </div>

          <!-- Bottom Row: Spent vs Allocated -->
          <div class="flex items-center justify-between text-[11px] text-slate-400">
            <span>Spent: <strong class="text-slate-300 tabular-nums">{{ formatBDT(env.spent) }}</strong></span>
            <span>Envelope: <strong class="text-slate-300 tabular-nums">{{ formatBDT(env.allocated) }}</strong></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Banner to switch to Envelope Mode when in Cashflow mode -->
    <div
      v-else
      class="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 flex items-center justify-between gap-3 shadow-lg"
    >
      <div>
        <div class="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
          <span>✉️</span> Zero-Based Envelope Budgeting Available
        </div>
        <div class="text-[11px] text-slate-400 mt-0.5">
          Assign every Taka into category envelopes to track monthly spending limits.
        </div>
      </div>
      <button
        type="button"
        @click="store.budgetMode = 'envelope_allocation'"
        class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md whitespace-nowrap transition-all"
      >
        Enable Envelopes
      </button>
    </div>

    <!-- Expense by Category Breakdown -->
    <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-xl space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-white text-sm">Expenses by Category</h3>
        <span class="text-xs text-rose-400 font-bold tabular-nums">-{{ formatBDT(stats.totalExpense) }}</span>
      </div>

      <div v-if="stats.expenseBreakdown.length === 0" class="text-center py-6 text-slate-500 text-sm">
        No expense data recorded in this period.
      </div>

      <div v-else class="space-y-3">
        <div v-for="item in stats.expenseBreakdown" :key="item.categoryId" class="space-y-1.5">
          <div class="flex justify-between text-xs">
            <span class="font-semibold text-slate-200 flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: item.color || '#EF4444' }"></span>
              {{ item.categoryName }}
            </span>
            <span class="text-slate-300 font-bold tabular-nums">
              {{ formatBDT(item.totalAmount) }} <span class="text-slate-400 font-normal">({{ item.percentage }}%)</span>
            </span>
          </div>

          <!-- Percentage bar -->
          <div class="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
            <div
              class="h-full rounded-full"
              :style="{ width: item.percentage + '%', backgroundColor: item.color || '#EF4444' }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Income by Category Breakdown -->
    <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-xl space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-white text-sm">Income by Category</h3>
        <span class="text-xs text-emerald-400 font-bold tabular-nums">+{{ formatBDT(stats.totalIncome) }}</span>
      </div>

      <div v-if="stats.incomeBreakdown.length === 0" class="text-center py-6 text-slate-500 text-sm">
        No income data recorded in this period.
      </div>

      <div v-else class="space-y-3">
        <div v-for="item in stats.incomeBreakdown" :key="item.categoryId" class="space-y-1.5">
          <div class="flex justify-between text-xs">
            <span class="font-semibold text-slate-200 flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: item.color || '#10B981' }"></span>
              {{ item.categoryName }}
            </span>
            <span class="text-slate-300 font-bold tabular-nums">
              {{ formatBDT(item.totalAmount) }} <span class="text-slate-400 font-normal">({{ item.percentage }}%)</span>
            </span>
          </div>

          <div class="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
            <div
              class="h-full rounded-full"
              :style="{ width: item.percentage + '%', backgroundColor: item.color || '#10B981' }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMoneyStore } from '../store';
import { computePeriodAnalytics } from '../modules/statistics/analytics';

const store = useMoneyStore();

// Period Filter Scope: 'month' or 'all'
const periodScope = ref<'month' | 'all'>('month');

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const monthName = computed(() => monthNames[store.selectedMonth - 1] || 'Current Month');

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
}

// Filtered Transactions based on Selected Period Scope
const activeTransactions = computed(() => {
  if (periodScope.value === 'all') {
    return store.transactions;
  }
  const prefix = `${store.selectedYear}-${String(store.selectedMonth).padStart(2, '0')}`;
  return store.transactions.filter(t => t.date.startsWith(prefix));
});

// Period Analytics Breakdown
const stats = computed(() => {
  return computePeriodAnalytics(activeTransactions.value, store.categories);
});

// Zero-Based Envelope Budgeting Data
interface EnvelopeRow {
  id: string;
  name: string;
  color?: string;
  allocated: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: 'safe' | 'warning' | 'danger';
}

const expenseCategorySumsMap = computed(() => {
  const map = new Map<string, number>();
  for (const t of activeTransactions.value) {
    if (t.type === 'expense') {
      map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount);
    }
  }
  return map;
});

const envelopeList = computed<EnvelopeRow[]>(() => {
  return store.categories
    .filter(c => c.type === 'expense')
    .map(c => {
      const allocated = c.budgetMonthlyAllocated || 0;
      const spent = expenseCategorySumsMap.value.get(c.id) || 0;
      const remaining = allocated - spent;
      const percentage = allocated > 0 ? (spent / allocated) * 100 : (spent > 0 ? 100 : 0);

      let status: 'safe' | 'warning' | 'danger' = 'safe';
      if (percentage > 100) {
        status = 'danger'; // Overspent > 100%
      } else if (percentage >= 80) {
        status = 'warning'; // 80-100%
      }

      return {
        id: c.id,
        name: c.name,
        color: c.color,
        allocated,
        spent,
        remaining,
        percentage,
        status
      };
    })
    .sort((a, b) => b.allocated - a.allocated);
});

const totalAllocated = computed(() => {
  return envelopeList.value.reduce((sum, item) => sum + item.allocated, 0);
});

const totalSpent = computed(() => {
  return envelopeList.value.reduce((sum, item) => sum + item.spent, 0);
});

const totalRemaining = computed(() => {
  return totalAllocated.value - totalSpent.value;
});

function getProgressBarColor(status: 'safe' | 'warning' | 'danger'): string {
  if (status === 'safe') return 'bg-emerald-500';
  if (status === 'warning') return 'bg-amber-500';
  return 'bg-rose-500';
}

function getStatusBadgeClass(status: 'safe' | 'warning' | 'danger'): string {
  if (status === 'safe') return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
  if (status === 'warning') return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
  return 'bg-rose-500/15 text-rose-400 border border-rose-500/30 font-bold';
}

function formatBDT(amount: number): string {
  return '৳' + amount.toLocaleString('en-US');
}
</script>