<template>
  <div class="space-y-4">
    <!-- Header Savings Rate Banner -->
    <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-xl">
      <div class="flex items-center justify-between mb-3">
        <div>
          <div class="text-xs text-slate-400 font-semibold uppercase tracking-wider">Savings Rate</div>
          <div class="text-2xl font-bold text-white mt-0.5">{{ stats.savingsRatePercentage }}%</div>
        </div>
        <div class="text-right">
          <div class="text-xs text-slate-400">Net Saved</div>
          <div class="text-lg font-bold" :class="stats.netSavings >= 0 ? 'text-emerald-400' : 'text-rose-400'">
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

    <!-- Expense by Category Breakdown -->
    <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-xl space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-white text-sm">Expenses by Category</h3>
        <span class="text-xs text-rose-400 font-bold">-{{ formatBDT(stats.totalExpense) }}</span>
      </div>

      <div v-if="stats.expenseBreakdown.length === 0" class="text-center py-6 text-slate-500 text-sm">
        No expense data recorded.
      </div>

      <div v-else class="space-y-3">
        <div v-for="item in stats.expenseBreakdown" :key="item.categoryId" class="space-y-1.5">
          <div class="flex justify-between text-xs">
            <span class="font-semibold text-slate-200 flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: item.color || '#EF4444' }"></span>
              {{ item.categoryName }}
            </span>
            <span class="text-slate-300 font-bold">
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
        <span class="text-xs text-emerald-400 font-bold">+{{ formatBDT(stats.totalIncome) }}</span>
      </div>

      <div class="space-y-3">
        <div v-for="item in stats.incomeBreakdown" :key="item.categoryId" class="space-y-1.5">
          <div class="flex justify-between text-xs">
            <span class="font-semibold text-slate-200 flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: item.color || '#10B981' }"></span>
              {{ item.categoryName }}
            </span>
            <span class="text-slate-300 font-bold">
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
import { computed } from 'vue';
import { useMoneyStore } from '../store';
import { computePeriodAnalytics } from '../modules/statistics/analytics';

const store = useMoneyStore();

const stats = computed(() => {
  return computePeriodAnalytics(store.transactions, store.categories);
});

function formatBDT(amount: number): string {
  return '৳' + amount.toLocaleString('en-US');
}
</script>
