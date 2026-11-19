<template>
  <div class="card-surface border rounded-2xl p-5 shadow-sm space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="font-bold text-base flex items-center gap-2">
          <TrendingUp class="w-4 h-4 text-rose-500" />
          Visual Financial Analytics
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Category distribution, trailing cashflow trends, and reconstructed net worth trajectory.
        </p>
      </div>

      <div class="flex items-center p-1 panel-surface border rounded-xl text-xs font-semibold">
        <button
          type="button"
          @click="windowMonths = 6"
          class="px-2.5 py-1 rounded-lg transition-colors"
          :class="windowMonths === 6 ? 'bg-rose-600 text-white' : 'text-slate-500 dark:text-slate-400'"
        >
          6 Months
        </button>
        <button
          type="button"
          @click="windowMonths = 12"
          class="px-2.5 py-1 rounded-lg transition-colors"
          :class="windowMonths === 12 ? 'bg-rose-600 text-white' : 'text-slate-500 dark:text-slate-400'"
        >
          12 Months
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <!-- 1. Category Expense Donut -->
      <div class="panel-surface border rounded-2xl p-4 space-y-3">
        <div class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Expense Mix
        </div>

        <div v-if="expenseItems.length === 0" class="py-10 text-center text-xs text-slate-500">
          No expenses in selected scope.
        </div>

        <div v-else class="flex flex-col items-center gap-4">
          <div class="relative w-36 h-36">
            <svg viewBox="0 0 120 120" class="w-full h-full -rotate-90" role="img" aria-label="Expense distribution donut chart">
              <circle
                cx="60"
                cy="60"
                r="44"
                fill="none"
                stroke="currentColor"
                class="text-slate-200 dark:text-slate-800"
                stroke-width="14"
              />
              <circle
                v-for="seg in donutSegments"
                :key="seg.categoryId"
                cx="60"
                cy="60"
                r="44"
                fill="none"
                :stroke="seg.color"
                stroke-width="14"
                :stroke-dasharray="`${seg.dashLength} ${circumference}`"
                :stroke-dashoffset="-seg.offset"
                stroke-linecap="butt"
              />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
              <span class="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Spent</span>
              <span class="text-xs font-extrabold tabular-nums">
                {{ formatCompactBDT(totalExpense, store.privacyMode) }}
              </span>
            </div>
          </div>

          <div class="w-full space-y-1.5">
            <div
              v-for="item in expenseItems.slice(0, 5)"
              :key="item.categoryId"
              class="flex items-center justify-between text-xs"
            >
              <span class="flex items-center gap-2 min-w-0 truncate">
                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ backgroundColor: item.color || '#EF4444' }"></span>
                <span class="truncate">{{ item.categoryName }}</span>
              </span>
              <span class="font-semibold tabular-nums text-slate-600 dark:text-slate-300 flex-shrink-0">
                {{ item.percentage }}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Income vs Expense Bar Chart -->
      <div class="panel-surface border rounded-2xl p-4 space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Income vs Expense
          </span>
          <div class="flex items-center gap-3 text-[10px] font-semibold">
            <span class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span class="w-2 h-2 rounded-sm bg-emerald-500"></span> In
            </span>
            <span class="flex items-center gap-1 text-rose-600 dark:text-rose-400">
              <span class="w-2 h-2 rounded-sm bg-rose-500"></span> Out
            </span>
          </div>
        </div>

        <svg viewBox="0 0 320 155" class="w-full h-40 overflow-visible" role="img" aria-label="Monthly income versus expense bar chart">
          <line x1="0" y1="125" x2="320" y2="125" stroke="currentColor" class="text-slate-300 dark:text-slate-700" stroke-width="1" />
          <g v-for="(pt, idx) in monthlyTrend" :key="pt.monthKey">
            <!-- Income bar -->
            <rect
              :x="barGroupX(idx)"
              :y="125 - barHeight(pt.income)"
              :width="barWidth"
              :height="barHeight(pt.income)"
              rx="3"
              fill="#10B981"
            >
              <title>{{ pt.label }} Income: {{ formatBDT(pt.income, store.privacyMode) }}</title>
            </rect>
            <!-- Expense bar -->
            <rect
              :x="barGroupX(idx) + barWidth + 2"
              :y="125 - barHeight(pt.expense)"
              :width="barWidth"
              :height="barHeight(pt.expense)"
              rx="3"
              fill="#F43F5E"
            >
              <title>{{ pt.label }} Expense: {{ formatBDT(pt.expense, store.privacyMode) }}</title>
            </rect>
            <text
              v-if="windowMonths <= 6 || idx % 2 === 0"
              :x="barGroupX(idx) + barWidth"
              y="142"
              text-anchor="middle"
              class="fill-slate-500 dark:fill-slate-400 text-[9px]"
            >
              {{ pt.label.split(' ')[0] }}
            </text>
          </g>
        </svg>
      </div>

      <!-- 3. Net Worth Trend Chart -->
      <div class="panel-surface border rounded-2xl p-4 space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Net Worth Trajectory
          </span>
          <span class="text-xs font-bold text-sky-600 dark:text-sky-400 tabular-nums">
            {{ formatCompactBDT(store.totalNetWorth, store.privacyMode) }}
          </span>
        </div>

        <svg viewBox="0 0 320 155" class="w-full h-40 overflow-visible" role="img" aria-label="Net worth trend chart">
          <defs>
            <linearGradient id="nwAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#0EA5E9" stop-opacity="0.35" />
              <stop offset="100%" stop-color="#0EA5E9" stop-opacity="0.02" />
            </linearGradient>
          </defs>
          <path :d="netWorthAreaPath" fill="url(#nwAreaGrad)" />
          <polyline
            :points="netWorthLinePoints"
            fill="none"
            stroke="#0EA5E9"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <g v-for="(pt, idx) in netWorthCoords" :key="pt.monthKey">
            <circle :cx="pt.x" :cy="pt.y" r="3.5" fill="#0EA5E9">
              <title>{{ pt.label }}: {{ formatBDT(pt.netWorth, store.privacyMode) }}</title>
            </circle>
            <text
              v-if="windowMonths <= 6 || idx % 2 === 0"
              :x="pt.x"
              y="144"
              text-anchor="middle"
              class="fill-slate-500 dark:fill-slate-400 text-[9px]"
            >
              {{ pt.label.split(' ')[0] }}
            </text>
          </g>
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { TrendingUp } from 'lucide-vue-next';
import { useMoneyStore } from '../store';
import { computeMonthlyTrend, computeNetWorthTrend, type CategoryBreakdownItem } from '../modules/statistics/analytics';
import { formatBDT, formatCompactBDT } from '../utils/format';

const props = defineProps<{
  expenseItems: CategoryBreakdownItem[];
  totalExpense: number;
}>();

const store = useMoneyStore();
const windowMonths = ref<6 | 12>(6);

const radius = 44;
const circumference = 2 * Math.PI * radius;

const donutSegments = computed(() => {
  let cumulativeOffset = 0;
  const total = props.totalExpense > 0 ? props.totalExpense : 1;
  return props.expenseItems.map((item) => {
    const fraction = Math.max(0, item.totalAmount) / total;
    const dashLength = fraction * circumference;
    const seg = {
      categoryId: item.categoryId,
      color: item.color || '#EF4444',
      dashLength,
      offset: cumulativeOffset,
    };
    cumulativeOffset += dashLength;
    return seg;
  });
});

const monthlyTrend = computed(() =>
  computeMonthlyTrend(store.transactions, store.selectedYear, store.selectedMonth, windowMonths.value)
);

const maxCashflowVal = computed(() => {
  let max = 1000;
  for (const pt of monthlyTrend.value) {
    if (pt.income > max) max = pt.income;
    if (pt.expense > max) max = pt.expense;
  }
  return max;
});

const barWidth = computed(() => (windowMonths.value <= 6 ? 16 : 9));

function barGroupX(idx: number): number {
  const step = 320 / monthlyTrend.value.length;
  return Math.round(idx * step + (step - (barWidth.value * 2 + 2)) / 2);
}

function barHeight(val: number): number {
  if (val <= 0) return 2;
  return Math.max(3, Math.round((val / maxCashflowVal.value) * 110));
}

const netWorthTrend = computed(() =>
  computeNetWorthTrend(
    store.totalNetWorth,
    store.transactions,
    store.selectedYear,
    store.selectedMonth,
    windowMonths.value
  )
);

const netWorthCoords = computed(() => {
  const pts = netWorthTrend.value;
  if (pts.length === 0) return [];
  const vals = pts.map((p) => p.netWorth);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const span = Math.max(1, maxVal - minVal);

  return pts.map((pt, idx) => {
    const x = pts.length === 1 ? 160 : 14 + (idx / (pts.length - 1)) * 292;
    const y = 115 - ((pt.netWorth - minVal) / span) * 90;
    return { ...pt, x: Math.round(x), y: Math.round(y) };
  });
});

const netWorthLinePoints = computed(() =>
  netWorthCoords.value.map((p) => `${p.x},${p.y}`).join(' ')
);

const netWorthAreaPath = computed(() => {
  const coords = netWorthCoords.value;
  if (coords.length === 0) return '';
  const line = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return `${line} L ${coords[coords.length - 1].x} 125 L ${coords[0].x} 125 Z`;
});
</script>
