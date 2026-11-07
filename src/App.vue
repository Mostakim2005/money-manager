<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between max-w-4xl mx-auto border-x border-slate-800/80 shadow-2xl">
    <!-- Top Header Bar -->
    <header class="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center font-extrabold text-white text-sm shadow-lg flex-shrink-0">
          ৳
        </div>
        <div class="min-w-0">
          <h1 class="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <span class="truncate">Money Manager</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-medium flex-shrink-0">
              {{ store.budgetMode === 'cashflow_ledger' ? 'Cashflow' : 'Envelope' }}
            </span>
          </h1>
          <div class="text-[11px] text-slate-400 flex items-center gap-2 tabular-nums truncate mt-0.5">
            <span>Net: <strong class="text-slate-200">৳{{ store.totalNetWorth.toLocaleString('en-US') }}</strong></span>
            <span>•</span>
            <span>Liquid: <strong class="text-emerald-400">৳{{ store.totalLiquidAssets.toLocaleString('en-US') }}</strong></span>
          </div>
        </div>
      </div>

      <!-- Header Actions: Quick Log, Theme Toggle, Sync Pill -->
      <div class="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          @click="showFabKeypad = true"
          class="hidden sm:inline-flex px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition-colors items-center gap-1 active:scale-95"
        >
          <span>+</span> Log
        </button>

        <button
          type="button"
          @click="toggleTheme"
          aria-label="Toggle color theme"
          class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-colors flex items-center gap-1 shadow-sm"
        >
          <span>{{ isLight ? '🌙 Dark' : '☀️ Light' }}</span>
        </button>

        <div class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="hidden sm:inline">{{ store.syncStatus }}</span>
        </div>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="flex-1 p-4 md:p-6 pb-28">
      <TransactionsTab v-if="store.activeTab === 'transactions'" />
      <CalendarTab v-else-if="store.activeTab === 'daily'" />
      <AccountsTab v-else-if="store.activeTab === 'accounts'" />
      <StatsTab v-else-if="store.activeTab === 'stats'" />
      <SanchaypatraTab v-else-if="store.activeTab === 'sanchaypatra'" />
      <SettingsTab v-else-if="store.activeTab === 'settings'" />
    </main>

    <!-- Realbyte Signature Floating Action Button (+) -->
    <button
      type="button"
      @click="showFabKeypad = true"
      aria-label="Log new transaction"
      class="fixed bottom-20 right-5 z-30 w-12 h-12 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-xl flex items-center justify-center text-2xl font-bold enabled:active:scale-[0.96] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
    >
      +
    </button>

    <!-- Undo Delete Toast Banner (better-writing: Undo beats confirmation) -->
    <div
      v-if="(store as any).lastDeletedTransaction"
      role="status"
      aria-live="polite"
      class="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-20 z-40 bg-slate-900 border border-slate-700 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 max-w-sm"
    >
      <div class="text-xs">
        <span class="font-semibold text-slate-200">Deleted transaction</span>
        <span class="text-slate-400 ml-1 tabular-nums">(৳{{ (store as any).lastDeletedTransaction?.amount?.toLocaleString('en-US') }})</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="handleUndo"
          class="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow transition-all active:scale-95"
        >
          Undo
        </button>
        <button
          type="button"
          @click="(store as any).lastDeletedTransaction = null"
          class="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs"
          aria-label="Dismiss undo banner"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Quick-Log Keypad Modal overlay -->
    <TransactionKeypad
      v-model="showFabKeypad"
      :initialDate="store.selectedDate"
      :categories="store.categories"
      :accounts="store.accounts"
      @save="handleFabSave"
    />

    <!-- Bottom Navigation Bar (Realbyte Parity, Accessible Navigation) -->
    <nav
      aria-label="Primary sections"
      class="fixed bottom-0 left-0 right-0 max-w-4xl mx-auto z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-2 flex items-center justify-around shadow-2xl"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="store.activeTab = tab.id"
        type="button"
        :aria-current="store.activeTab === tab.id ? 'page' : undefined"
        class="flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1 px-1 rounded-xl transition-all"
        :class="store.activeTab === tab.id ? 'text-rose-400 font-bold' : 'text-slate-400 hover:text-slate-200'"
      >
        <span class="text-base">{{ tab.icon }}</span>
        <span class="text-[10px] min-w-0 truncate w-full text-center">{{ tab.label }}</span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useMoneyStore } from './store';
import TransactionsTab from './components/TransactionsTab.vue';
import CalendarTab from './components/CalendarTab.vue';
import AccountsTab from './components/AccountsTab.vue';
import StatsTab from './components/StatsTab.vue';
import SanchaypatraTab from './components/SanchaypatraTab.vue';
import SettingsTab from './components/SettingsTab.vue';
import TransactionKeypad from './components/TransactionKeypad.vue';
import { TransactionType } from './types';

const store = useMoneyStore();
const showFabKeypad = ref(false);

const tabs = [
  { id: 'transactions', icon: '📝', label: 'Trans.' },
  { id: 'daily', icon: '📅', label: 'Daily' },
  { id: 'accounts', icon: '💳', label: 'Accounts' },
  { id: 'stats', icon: '📊', label: 'Stats' },
  { id: 'sanchaypatra', icon: '🇧🇩', label: 'Sanchay' },
  { id: 'settings', icon: '⚙️', label: 'Settings' }
] as const;

const isLight = computed(() => (store as any).themeMode === 'light');

function toggleTheme() {
  if (typeof (store as any).toggleTheme === 'function') {
    (store as any).toggleTheme();
  } else {
    const next = isLight.value ? 'dark' : 'light';
    (store as any).themeMode = next;
    applyTheme(next);
  }
}

function applyTheme(mode: string) {
  document.documentElement.classList.add('no-transitions');
  document.documentElement.setAttribute('data-theme', mode);
  requestAnimationFrame(() => {
    document.documentElement.classList.remove('no-transitions');
  });
}

watch(
  () => (store as any).themeMode,
  mode => {
    applyTheme(mode || 'dark');
  },
  { immediate: true }
);

function handleFabSave(payload: {
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

function handleUndo() {
  if (typeof (store as any).undoLastDelete === 'function') {
    (store as any).undoLastDelete();
  }
}

onMounted(() => {
  store.hydrateState();
  applyTheme((store as any).themeMode || 'dark');
});
</script>