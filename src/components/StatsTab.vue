<template>
  <div class="space-y-4">
    <!-- Period Filter & Manage Categories -->
    <div class="card-surface border rounded-2xl p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
      <div v-if="periodScope === 'month'" class="flex items-center gap-2">
        <button
          type="button"
          @click="changeMonth(-1)"
          aria-label="Previous Month"
          class="p-2 rounded-xl panel-surface border hover:border-slate-400"
        >
          <ChevronLeft class="w-4 h-4" />
        </button>
        <div>
          <span class="text-sm font-bold tracking-wide">
            {{ monthName }} {{ store.selectedYear }}
          </span>
          <span class="ml-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            ({{ activeTransactions.length }} txns)
          </span>
        </div>
        <button
          type="button"
          @click="changeMonth(1)"
          aria-label="Next Month"
          class="p-2 rounded-xl panel-surface border hover:border-slate-400"
        >
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>

      <div v-else class="flex items-center gap-2 px-1">
        <span class="text-sm font-bold tracking-wide">All-Time Overview</span>
        <span class="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
          ({{ store.transactions.length }} total txns)
        </span>
      </div>

      <div class="flex items-center gap-2 ml-auto flex-wrap">
        <button
          type="button"
          @click="showCategoriesModal = true"
          class="px-3 py-1.5 rounded-xl panel-surface border text-xs font-semibold flex items-center gap-1.5 hover:border-slate-400"
        >
          <FolderCog class="w-3.5 h-3.5" /> Manage Categories
        </button>

        <div class="flex items-center p-1 panel-surface border rounded-xl text-xs font-semibold">
          <button
            type="button"
            @click="periodScope = 'month'"
            class="px-3 py-1 rounded-lg transition-colors"
            :class="periodScope === 'month' ? 'bg-rose-600 text-white' : 'text-slate-500 dark:text-slate-400'"
          >
            Monthly
          </button>
          <button
            type="button"
            @click="periodScope = 'all'"
            class="px-3 py-1 rounded-lg transition-colors"
            :class="periodScope === 'all' ? 'bg-rose-600 text-white' : 'text-slate-500 dark:text-slate-400'"
          >
            All-Time
          </button>
        </div>
      </div>
    </div>

    <!-- Savings Rate Banner -->
    <div class="card-surface border rounded-2xl p-5 shadow-sm">
      <div class="flex items-center justify-between mb-3">
        <div>
          <div class="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Savings Rate</div>
          <div class="text-2xl font-bold mt-0.5 tabular-nums">{{ stats.savingsRatePercentage }}%</div>
        </div>
        <div class="text-right">
          <div class="text-xs text-slate-500 dark:text-slate-400">Net Saved</div>
          <div
            class="text-lg font-bold tabular-nums"
            :class="stats.netSavings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
          >
            {{ stats.netSavings >= 0 ? '+' : '' }}{{ formatBDT(stats.netSavings, store.privacyMode) }}
          </div>
        </div>
      </div>

      <div class="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden p-0.5">
        <div
          class="h-full rounded-full transition-all duration-500"
          :class="stats.savingsRatePercentage >= 20 ? 'bg-emerald-500' : 'bg-amber-500'"
          :style="{ width: Math.min(Math.max(stats.savingsRatePercentage, 0), 100) + '%' }"
        ></div>
      </div>
    </div>

    <!-- Visual Charts Module -->
    <AnalyticsCharts
      v-if="store.featureFlags.enableVisualCharts"
      :expenseItems="stats.expenseBreakdown"
      :totalExpense="stats.totalExpense"
    />

    <!-- Zero-Based Envelope Budgeting Card (Gated by enableEnvelopeBudgets) -->
    <div
      v-if="store.featureFlags.enableEnvelopeBudgets && store.budgetMode === 'envelope_allocation'"
      class="card-surface border border-indigo-500/40 rounded-2xl p-5 shadow-sm space-y-4"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div class="flex items-center gap-2">
            <Mail class="w-4 h-4 text-indigo-500" />
            <h3 class="font-bold text-base">Zero-Based Envelope Budgets</h3>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 font-semibold">
              {{ activeMonthCount }} mo window
            </span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Allocated envelopes vs. actual expenditures. Edit limits directly below or in Manage Categories.
          </p>
        </div>
        <button
          type="button"
          @click="store.setBudgetMode('cashflow_ledger')"
          class="text-xs text-slate-500 dark:text-slate-400 underline"
        >
          Switch to Cashflow view
        </button>
      </div>

      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="panel-surface border p-2.5 rounded-xl">
          <div class="text-[11px] text-slate-500 dark:text-slate-400">Total Budgeted</div>
          <div class="text-sm font-bold mt-0.5 tabular-nums">{{ formatBDT(totalAllocated, store.privacyMode) }}</div>
        </div>
        <div class="panel-surface border p-2.5 rounded-xl">
          <div class="text-[11px] text-slate-500 dark:text-slate-400">Total Spent</div>
          <div class="text-sm font-bold text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums">
            {{ formatBDT(totalSpent, store.privacyMode) }}
          </div>
        </div>
        <div class="panel-surface border p-2.5 rounded-xl">
          <div class="text-[11px] text-slate-500 dark:text-slate-400">Remaining</div>
          <div
            class="text-sm font-bold mt-0.5 tabular-nums"
            :class="totalRemaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
          >
            {{ totalRemaining >= 0 ? '+' : '' }}{{ formatBDT(totalRemaining, store.privacyMode) }}
          </div>
        </div>
      </div>

      <div class="space-y-3">
        <div
          v-for="env in envelopeList"
          :key="env.id"
          class="p-3 rounded-xl panel-surface border space-y-2"
        >
          <div class="flex items-center justify-between text-xs gap-2">
            <span class="font-bold flex items-center gap-2">
              <span class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: env.color || '#64748B' }"></span>
              {{ env.name }}
            </span>

            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums" :class="getStatusBadgeClass(env.status)">
                {{ env.percentage > 100 ? 'OVER ' + env.percentage.toFixed(0) + '%' : env.percentage.toFixed(0) + '%' }}
              </span>
              <span class="font-bold tabular-nums" :class="env.remaining >= 0 ? '' : 'text-rose-600 dark:text-rose-400'">
                {{ env.remaining >= 0 ? formatBDT(env.remaining, store.privacyMode) + ' left' : '-' + formatBDT(Math.abs(env.remaining), store.privacyMode) + ' over' }}
              </span>
            </div>
          </div>

          <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-300"
              :class="getProgressBarColor(env.status)"
              :style="{ width: Math.min(env.percentage, 100) + '%' }"
            ></div>
          </div>

          <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Spent: <strong class="tabular-nums">{{ formatBDT(env.spent, store.privacyMode) }}</strong></span>
            <label class="flex items-center gap-1.5">
              <span>Monthly Cap: ৳</span>
              <input
                type="number"
                min="0"
                step="500"
                :value="env.monthlyCap"
                @change="onInlineBudgetChange(env.id, $event)"
                class="w-24 input-surface border rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums text-right"
              />
            </label>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="store.featureFlags.enableEnvelopeBudgets"
      class="p-4 rounded-2xl card-surface border border-indigo-500/30 flex items-center justify-between gap-3 shadow-sm"
    >
      <div>
        <div class="text-xs font-bold text-indigo-600 dark:text-indigo-300 flex items-center gap-1.5">
          <Mail class="w-4 h-4" /> Zero-Based Envelope Budgeting Available
        </div>
        <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          Assign monthly spending envelopes per category to track spending limits.
        </div>
      </div>
      <button
        type="button"
        @click="store.setBudgetMode('envelope_allocation')"
        class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold whitespace-nowrap"
      >
        Enable Envelopes
      </button>
    </div>

    <!-- Expense & Income Breakdowns -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card-surface border rounded-2xl p-5 shadow-sm space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-sm">Expenses by Category</h3>
          <span class="text-xs text-rose-600 dark:text-rose-400 font-bold tabular-nums">
            -{{ formatBDT(stats.totalExpense, store.privacyMode) }}
          </span>
        </div>

        <div v-if="stats.expenseBreakdown.length === 0" class="text-center py-6 text-slate-500 text-xs">
          No expense data recorded in this period.
        </div>

        <div v-else class="space-y-3">
          <div v-for="item in stats.expenseBreakdown" :key="item.categoryId" class="space-y-1.5">
            <div class="flex justify-between text-xs">
              <span class="font-semibold flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: item.color || '#EF4444' }"></span>
                {{ item.categoryName }}
              </span>
              <span class="font-bold tabular-nums">
                {{ formatBDT(item.totalAmount, store.privacyMode) }}
                <span class="text-slate-500 font-normal">({{ item.percentage }}%)</span>
              </span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div class="h-full rounded-full" :style="{ width: item.percentage + '%', backgroundColor: item.color || '#EF4444' }"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="card-surface border rounded-2xl p-5 shadow-sm space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-sm">Income by Category</h3>
          <span class="text-xs text-emerald-600 dark:text-emerald-400 font-bold tabular-nums">
            +{{ formatBDT(stats.totalIncome, store.privacyMode) }}
          </span>
        </div>

        <div v-if="stats.incomeBreakdown.length === 0" class="text-center py-6 text-slate-500 text-xs">
          No income data recorded in this period.
        </div>

        <div v-else class="space-y-3">
          <div v-for="item in stats.incomeBreakdown" :key="item.categoryId" class="space-y-1.5">
            <div class="flex justify-between text-xs">
              <span class="font-semibold flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: item.color || '#10B981' }"></span>
                {{ item.categoryName }}
              </span>
              <span class="font-bold tabular-nums">
                {{ formatBDT(item.totalAmount, store.privacyMode) }}
                <span class="text-slate-500 font-normal">({{ item.percentage }}%)</span>
              </span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div class="h-full rounded-full" :style="{ width: item.percentage + '%', backgroundColor: item.color || '#10B981' }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Manage Categories & Monthly Envelopes Modal -->
    <BaseModal
      v-model="showCategoriesModal"
      title="Manage Categories & Envelopes"
      subtitle="Add, edit, delete categories and configure subcategories or monthly caps"
      maxWidthClass="max-w-2xl"
    >
      <div class="space-y-4 text-xs">
        <!-- Create Category Form -->
        <div class="panel-surface border rounded-2xl p-3.5 space-y-2.5">
          <div class="font-bold uppercase tracking-wider text-[11px] text-slate-500">Add New Category</div>
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input v-model="newCat.name" placeholder="Category name" class="input-surface border rounded-xl px-2.5 py-1.5 sm:col-span-2" />
            <select v-model="newCat.type" class="input-surface border rounded-xl px-2.5 py-1.5">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <input v-model.number="newCat.budgetMonthlyAllocated" type="number" min="0" placeholder="Envelope ৳" class="input-surface border rounded-xl px-2.5 py-1.5 tabular-nums" />
          </div>
          <div class="flex items-center gap-2">
            <input v-model="newCat.subcategoriesText" placeholder="Subcategories (comma-separated, e.g. Tea, Coffee)" class="flex-1 input-surface border rounded-xl px-2.5 py-1.5" />
            <input v-model="newCat.color" type="color" class="h-8 w-10 rounded border" />
            <button
              type="button"
              @click="handleAddCategory"
              class="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold"
            >
              Add
            </button>
          </div>
        </div>

        <!-- Existing Categories List -->
        <div class="space-y-2 max-h-[45vh] overflow-y-auto scroller">
          <div
            v-for="cat in store.categories"
            :key="cat.id"
            class="panel-surface border rounded-xl p-3 flex flex-wrap items-center justify-between gap-2"
          >
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: cat.color || '#64748B' }"></span>
              <div>
                <div class="font-bold">
                  {{ cat.name }}
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 uppercase ml-1">
                    {{ cat.type }}
                  </span>
                </div>
                <div class="text-[11px] text-slate-500">
                  Subcategories: {{ (cat.subcategories || []).join(', ') || 'None' }}
                  <span v-if="cat.type === 'expense'">
                    • Envelope: ৳{{ (cat.budgetMonthlyAllocated || 0).toLocaleString('en-US') }}
                  </span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1.5">
              <button
                type="button"
                @click="startEditCategory(cat)"
                class="px-2.5 py-1 rounded-lg panel-surface border font-semibold hover:border-sky-500"
              >
                Edit
              </button>
              <button
                type="button"
                @click="handleDeleteCategory(cat)"
                class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                aria-label="Delete category"
              >
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Inline Category Editor -->
        <div v-if="editingCategory" class="panel-surface border border-sky-500/40 rounded-2xl p-3.5 space-y-2.5">
          <div class="font-bold text-sky-600 dark:text-sky-400">Editing: {{ editingCategory.name }}</div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input v-model="editCatForm.name" class="input-surface border rounded-xl px-2.5 py-1.5" />
            <input v-model.number="editCatForm.budgetMonthlyAllocated" type="number" min="0" placeholder="Envelope ৳" class="input-surface border rounded-xl px-2.5 py-1.5 tabular-nums" />
            <input v-model="editCatForm.color" type="color" class="h-8 w-full rounded border" />
          </div>
          <input v-model="editCatForm.subcategoriesText" placeholder="Subcategories (comma-separated)" class="w-full input-surface border rounded-xl px-2.5 py-1.5" />
          <div class="flex justify-end gap-2">
            <button type="button" @click="editingCategory = null" class="px-3 py-1 rounded-lg panel-surface border">Cancel</button>
            <button type="button" @click="saveEditCategory" class="px-3 py-1 rounded-lg bg-sky-600 text-white font-semibold">Save</button>
          </div>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronLeft, ChevronRight, FolderCog, Mail, Trash2 } from 'lucide-vue-next';
import BaseModal from './BaseModal.vue';
import AnalyticsCharts from './AnalyticsCharts.vue';
import { useMoneyStore } from '../store';
import { computePeriodAnalytics } from '../modules/statistics/analytics';
import { formatBDT } from '../utils/format';
import type { Category } from '../types';

const store = useMoneyStore();
const periodScope = ref<'month' | 'all'>('month');

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
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

const activeTransactions = computed(() => {
  if (periodScope.value === 'all') return store.transactions;
  const prefix = `${store.selectedYear}-${String(store.selectedMonth).padStart(2, '0')}`;
  return store.transactions.filter((t) => t.date.startsWith(prefix));
});

const stats = computed(() => computePeriodAnalytics(activeTransactions.value, store.categories));

const expenseCategorySumsMap = computed(() => {
  const map = new Map<string, number>();
  for (const t of activeTransactions.value) {
    if (t.type === 'expense') {
      map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount);
    }
  }
  return map;
});

const activeMonthCount = computed(() => {
  if (periodScope.value === 'month') return 1;
  const distinctMonths = new Set<string>();
  for (const t of store.transactions) {
    if (t.date && t.date.length >= 7) distinctMonths.add(t.date.slice(0, 7));
  }
  return Math.max(1, distinctMonths.size);
});

const envelopeList = computed(() => {
  const multiplier = activeMonthCount.value;
  return store.categories
    .filter((c) => c.type === 'expense')
    .map((c) => {
      const monthlyCap = c.budgetMonthlyAllocated || 0;
      const allocated = monthlyCap * multiplier;
      const spent = expenseCategorySumsMap.value.get(c.id) || 0;
      const remaining = allocated - spent;
      const percentage = allocated > 0 ? (spent / allocated) * 100 : spent > 0 ? 100 : 0;

      let status: 'safe' | 'warning' | 'danger' = 'safe';
      if (percentage > 100) status = 'danger';
      else if (percentage >= 80) status = 'warning';

      return { id: c.id, name: c.name, color: c.color, monthlyCap, allocated, spent, remaining, percentage, status };
    })
    .sort((a, b) => b.allocated - a.allocated);
});

const totalAllocated = computed(() => envelopeList.value.reduce((sum, item) => sum + item.allocated, 0));
const totalSpent = computed(() => envelopeList.value.reduce((sum, item) => sum + item.spent, 0));
const totalRemaining = computed(() => totalAllocated.value - totalSpent.value);

function onInlineBudgetChange(catId: string, e: Event) {
  const val = Number((e.target as HTMLInputElement).value || 0);
  store.updateCategoryBudget(catId, val);
}

function getProgressBarColor(status: 'safe' | 'warning' | 'danger'): string {
  if (status === 'safe') return 'bg-emerald-500';
  if (status === 'warning') return 'bg-amber-500';
  return 'bg-rose-500';
}

function getStatusBadgeClass(status: 'safe' | 'warning' | 'danger'): string {
  if (status === 'safe') return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
  if (status === 'warning') return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
  return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold';
}

// Manage Categories Modal
const showCategoriesModal = ref(false);
const newCat = ref({
  name: '',
  type: 'expense' as 'income' | 'expense',
  budgetMonthlyAllocated: 5000,
  subcategoriesText: '',
  color: '#10B981',
});

function parseSubs(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function handleAddCategory() {
  if (!newCat.value.name.trim()) return;
  store.addCategory({
    name: newCat.value.name.trim(),
    type: newCat.value.type,
    color: newCat.value.color,
    budgetMonthlyAllocated: newCat.value.type === 'expense' ? newCat.value.budgetMonthlyAllocated : 0,
    subcategories: parseSubs(newCat.value.subcategoriesText),
  });
  newCat.value.name = '';
  newCat.value.subcategoriesText = '';
}

const editingCategory = ref<Category | null>(null);
const editCatForm = ref({
  name: '',
  budgetMonthlyAllocated: 0,
  color: '#10B981',
  subcategoriesText: '',
});

function startEditCategory(cat: Category) {
  editingCategory.value = cat;
  editCatForm.value = {
    name: cat.name,
    budgetMonthlyAllocated: cat.budgetMonthlyAllocated || 0,
    color: cat.color || '#10B981',
    subcategoriesText: (cat.subcategories || []).join(', '),
  };
}

function saveEditCategory() {
  if (!editingCategory.value || !editCatForm.value.name.trim()) return;
  store.editCategory(editingCategory.value.id, {
    name: editCatForm.value.name.trim(),
    budgetMonthlyAllocated: editCatForm.value.budgetMonthlyAllocated,
    color: editCatForm.value.color,
    subcategories: parseSubs(editCatForm.value.subcategoriesText),
  });
  editingCategory.value = null;
}

function handleDeleteCategory(cat: Category) {
  const fallback = store.categories.find((c) => c.id !== cat.id && c.type === cat.type);
  store.deleteCategory(cat.id, fallback?.id);
}
</script>
