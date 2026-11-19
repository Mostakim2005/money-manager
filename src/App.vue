<template>
  <div class="min-h-screen app-shell flex flex-col lg:flex-row">
    <!-- Desktop Left Collapsible Sidebar -->
    <aside
      aria-label="Primary navigation"
      class="hidden lg:flex flex-col justify-between sidebar-surface border-r sticky top-0 h-screen transition-[width] duration-200 flex-shrink-0"
      :class="store.sidebarCollapsed ? 'w-[76px]' : 'w-[244px]'"
    >
      <div class="p-3.5 space-y-4">
        <!-- Brand & Collapse Toggle -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center font-extrabold text-white text-base shadow-md flex-shrink-0">
              ৳
            </div>
            <div v-if="!store.sidebarCollapsed" class="min-w-0">
              <h1 class="text-sm font-bold tracking-tight truncate">Money Manager</h1>
              <span class="inline-block text-[10px] px-2 py-0.5 rounded-full panel-surface border font-medium text-slate-500 dark:text-slate-400">
                {{ store.budgetMode === 'cashflow_ledger' ? 'Cashflow' : 'Envelope' }}
              </span>
            </div>
          </div>

          <button
            type="button"
            @click="store.sidebarCollapsed = !store.sidebarCollapsed"
            :aria-label="store.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            class="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
          >
            <PanelLeftOpen v-if="store.sidebarCollapsed" class="w-4 h-4" />
            <PanelLeftClose v-else class="w-4 h-4" />
          </button>
        </div>

        <!-- Net Worth Summary Card -->
        <div v-if="!store.sidebarCollapsed" class="panel-surface border rounded-2xl p-3 space-y-1">
          <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Net Worth
          </div>
          <div class="text-lg font-extrabold tabular-nums">
            {{ formatBDT(store.totalNetWorth, store.privacyMode) }}
          </div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
            Liquid:
            <strong class="text-emerald-600 dark:text-emerald-400">
              {{ formatBDT(store.totalLiquidAssets, store.privacyMode) }}
            </strong>
          </div>
        </div>

        <!-- Global Quick Log Button -->
        <button
          type="button"
          @click="store.openQuickKeypad()"
          class="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-md flex items-center justify-center gap-2 transition-colors"
          title="Quick Log Transaction (Shortcut: N or Ctrl+K)"
        >
          <Plus class="w-4 h-4 flex-shrink-0" />
          <span v-if="!store.sidebarCollapsed">Quick Log (N)</span>
        </button>

        <!-- Navigation Links -->
        <nav class="space-y-1">
          <button
            v-for="tab in visibleTabs"
            :key="tab.id"
            type="button"
            @click="store.activeTab = tab.id"
            :aria-current="store.activeTab === tab.id ? 'page' : undefined"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors"
            :class="
              store.activeTab === tab.id
                ? 'bg-rose-600/10 text-rose-600 dark:text-rose-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'
            "
            :title="store.sidebarCollapsed ? tab.label : undefined"
          >
            <component :is="tab.icon" class="w-4 h-4 flex-shrink-0" />
            <span v-if="!store.sidebarCollapsed" class="truncate">{{ tab.label }}</span>
          </button>
        </nav>
      </div>

      <!-- Sidebar Footer: Privacy, Theme, Sync Status -->
      <div class="p-3.5 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <div class="flex items-center gap-1.5" :class="store.sidebarCollapsed ? 'flex-col' : ''">
          <button
            v-if="store.featureFlags.enablePrivacyMode"
            type="button"
            @click="store.togglePrivacyMode()"
            :aria-pressed="store.privacyMode"
            :title="store.privacyMode ? 'Show balances (Shift+P)' : 'Hide balances (Shift+P)'"
            class="flex-1 py-2 px-2.5 rounded-xl panel-surface border text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-slate-400 dark:hover:border-slate-600"
          >
            <EyeOff v-if="store.privacyMode" class="w-3.5 h-3.5 text-amber-500" />
            <Eye v-else class="w-3.5 h-3.5" />
            <span v-if="!store.sidebarCollapsed">{{ store.privacyMode ? 'Hidden' : 'Privacy' }}</span>
          </button>

          <button
            type="button"
            @click="store.toggleTheme()"
            :aria-label="isLight ? 'Switch to dark theme' : 'Switch to light theme'"
            class="flex-1 py-2 px-2.5 rounded-xl panel-surface border text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-slate-400 dark:hover:border-slate-600"
          >
            <Moon v-if="isLight" class="w-3.5 h-3.5" />
            <Sun v-else class="w-3.5 h-3.5 text-amber-400" />
            <span v-if="!store.sidebarCollapsed">{{ isLight ? 'Dark' : 'Light' }}</span>
          </button>
        </div>

        <div
          class="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold"
          :class="syncBadgeClass"
        >
          <span class="w-2 h-2 rounded-full flex-shrink-0" :class="syncDotClass"></span>
          <span v-if="!store.sidebarCollapsed" class="truncate">
            {{ store.syncStatus }}
            <template v-if="store.electronDbInfo?.walMode"> • WAL</template>
          </span>
        </div>
      </div>
    </aside>

    <!-- Main Viewport Column -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Mobile / Tablet Compact Top Bar -->
      <header class="lg:hidden sticky top-0 z-30 sidebar-surface border-b px-4 py-3 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center font-extrabold text-white text-sm flex-shrink-0">
            ৳
          </div>
          <div class="min-w-0">
            <h1 class="text-sm font-bold tracking-tight truncate">Money Manager</h1>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
              Net: <strong>{{ formatBDT(store.totalNetWorth, store.privacyMode) }}</strong>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1.5 flex-shrink-0">
          <button
            v-if="store.featureFlags.enablePrivacyMode"
            type="button"
            @click="store.togglePrivacyMode()"
            aria-label="Toggle privacy mode"
            class="p-2 rounded-xl panel-surface border"
          >
            <EyeOff v-if="store.privacyMode" class="w-4 h-4 text-amber-500" />
            <Eye v-else class="w-4 h-4" />
          </button>
          <button
            type="button"
            @click="store.toggleTheme()"
            aria-label="Toggle color theme"
            class="p-2 rounded-xl panel-surface border"
          >
            <Moon v-if="isLight" class="w-4 h-4" />
            <Sun v-else class="w-4 h-4 text-amber-400" />
          </button>
          <div class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold" :class="syncBadgeClass">
            <span class="w-2 h-2 rounded-full" :class="syncDotClass"></span>
            <span class="hidden sm:inline">{{ store.syncStatus }}</span>
          </div>
        </div>
      </header>

      <!-- Active Tab View -->
      <main class="flex-1 p-4 md:p-6 lg:p-7 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
        <TransactionsTab v-if="store.activeTab === 'transactions'" />
        <CalendarTab v-else-if="store.activeTab === 'daily'" />
        <AccountsTab v-else-if="store.activeTab === 'accounts'" />
        <StatsTab v-else-if="store.activeTab === 'stats'" />
        <SanchaypatraTab v-else-if="store.activeTab === 'sanchaypatra' && store.featureFlags.enableSanchaypatra" />
        <PlanningTab v-else-if="store.activeTab === 'planning' && hasPlanningFeatures" />
        <SettingsTab v-else />
      </main>
    </div>

    <!-- Mobile FAB (+) -->
    <button
      type="button"
      @click="store.openQuickKeypad()"
      aria-label="Log new transaction"
      class="lg:hidden fixed bottom-20 right-4 z-30 w-12 h-12 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-xl flex items-center justify-center"
    >
      <Plus class="w-6 h-6" />
    </button>

    <!-- Undo Delete Toast Banner -->
    <div
      v-if="store.lastDeletedTransaction"
      role="status"
      aria-live="polite"
      class="fixed bottom-20 lg:bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-40 card-surface border px-4 py-2.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 max-w-sm"
    >
      <div class="text-xs">
        <span class="font-semibold">Deleted transaction</span>
        <span class="text-slate-500 dark:text-slate-400 ml-1 tabular-nums">
          ({{ formatBDT(store.lastDeletedTransaction.amount, store.privacyMode) }})
        </span>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="store.undoLastDelete()"
          class="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
        >
          Undo
        </button>
        <button
          type="button"
          @click="store.lastDeletedTransaction = null"
          class="w-6 h-6 rounded-lg panel-surface border flex items-center justify-center"
          aria-label="Dismiss undo banner"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Single Global Quick-Log Keypad Modal -->
    <TransactionKeypad
      v-model="store.keypadOpen"
      :initialDate="store.keypadInitialDate"
      :initialType="store.keypadInitialType"
      :categories="store.categories"
      :accounts="store.accounts"
      @save="handleFabSave"
    />

    <!-- Mobile Bottom Navigation -->
    <nav
      aria-label="Primary sections"
      class="lg:hidden fixed bottom-0 left-0 right-0 z-30 sidebar-surface border-t px-2 py-2 flex items-center justify-around"
    >
      <button
        v-for="tab in visibleTabs"
        :key="tab.id"
        type="button"
        @click="store.activeTab = tab.id"
        :aria-current="store.activeTab === tab.id ? 'page' : undefined"
        class="flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1 px-1 rounded-xl"
        :class="store.activeTab === tab.id ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-500 dark:text-slate-400'"
      >
        <component :is="tab.icon" class="w-4 h-4" />
        <span class="text-[10px] truncate w-full text-center">{{ tab.shortLabel }}</span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import {
  BarChart3,
  CalendarDays,
  Eye,
  EyeOff,
  Landmark,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ReceiptText,
  Settings,
  Sun,
  Target,
  Wallet,
  X,
} from 'lucide-vue-next';
import { useMoneyStore } from './store';
import TransactionsTab from './components/TransactionsTab.vue';
import CalendarTab from './components/CalendarTab.vue';
import AccountsTab from './components/AccountsTab.vue';
import StatsTab from './components/StatsTab.vue';
import SanchaypatraTab from './components/SanchaypatraTab.vue';
import PlanningTab from './components/PlanningTab.vue';
import SettingsTab from './components/SettingsTab.vue';
import TransactionKeypad from './components/TransactionKeypad.vue';
import { formatBDT } from './utils/format';
import type { TransactionType } from './types';

const store = useMoneyStore();

const hasPlanningFeatures = computed(
  () =>
    store.featureFlags.enableSavingsGoals ||
    store.featureFlags.enableCreditCardEmi ||
    store.featureFlags.enableIouKhata
);

const visibleTabs = computed(() => {
  const list: {
    id: 'daily' | 'transactions' | 'accounts' | 'stats' | 'sanchaypatra' | 'planning' | 'settings';
    label: string;
    shortLabel: string;
    icon: any;
  }[] = [
    { id: 'daily', label: 'Daily Calendar', shortLabel: 'Daily', icon: CalendarDays },
    { id: 'transactions', label: 'Transactions', shortLabel: 'Trans.', icon: ReceiptText },
    { id: 'accounts', label: 'Accounts', shortLabel: 'Accounts', icon: Wallet },
    { id: 'stats', label: 'Statistics', shortLabel: 'Stats', icon: BarChart3 },
  ];

  if (store.featureFlags.enableSanchaypatra) {
    list.push({ id: 'sanchaypatra', label: 'Sanchaypatra & FDR', shortLabel: 'Sanchay', icon: Landmark });
  }
  if (hasPlanningFeatures.value) {
    list.push({ id: 'planning', label: 'Goals, EMI & Khata', shortLabel: 'Plan', icon: Target });
  }
  list.push({ id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings });
  return list;
});

const isLight = computed(() => store.themeMode === 'light');

const syncBadgeClass = computed(() => {
  if (store.syncStatus === 'Synced') {
    return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400';
  }
  if (store.syncStatus === 'Syncing') {
    return 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400';
  }
  return 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400';
});

const syncDotClass = computed(() => {
  if (store.syncStatus === 'Synced') return 'bg-emerald-500';
  if (store.syncStatus === 'Syncing') return 'bg-amber-500 animate-ping';
  return 'bg-rose-500';
});

function handleFabSave(payload: {
  amount: number;
  type: TransactionType;
  categoryId: string;
  subcategoryId?: string;
  accountId: string;
  targetAccountId?: string;
  date: string;
  time: string;
  note: string;
  description: string;
  currency?: string;
  originalAmount?: number;
  exchangeRate?: number;
  receiptPath?: string;
}) {
  store.addTransaction({
    amount: payload.amount,
    type: payload.type,
    categoryId: payload.categoryId,
    subcategoryId: payload.subcategoryId,
    accountId: payload.accountId,
    targetAccountId: payload.targetAccountId,
    date: payload.date,
    time: payload.time,
    note: payload.note || payload.description,
    description: payload.description,
    currency: payload.currency,
    originalAmount: payload.originalAmount,
    exchangeRate: payload.exchangeRate,
    receiptPath: payload.receiptPath,
  });
}

function handleGlobalShortcut(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null;
  if (
    target &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
  ) {
    return;
  }

  if (!store.keypadOpen && ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
    e.preventDefault();
    store.openQuickKeypad();
    return;
  }

  if (!store.keypadOpen && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'n') {
    e.preventDefault();
    store.openQuickKeypad();
    return;
  }

  if (store.featureFlags.enablePrivacyMode && e.shiftKey && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    store.togglePrivacyMode();
  }
}

onMounted(async () => {
  await store.hydrateFromElectronDb();
  window.addEventListener('keydown', handleGlobalShortcut);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalShortcut);
});
</script>
