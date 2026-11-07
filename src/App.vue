<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between max-w-4xl mx-auto border-x border-slate-800/80 shadow-2xl">
    <!-- Top Header Bar -->
    <header class="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-5 py-3.5 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center font-extrabold text-white text-sm shadow-lg">
          ৳
        </div>
        <div>
          <h1 class="text-base font-bold text-white tracking-tight flex items-center gap-2">
            Money Manager
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-medium">
              {{ store.budgetMode === 'cashflow_ledger' ? 'Cashflow' : 'Envelope' }}
            </span>
          </h1>
        </div>
      </div>

      <!-- Sync Status Pill -->
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          {{ store.syncStatus }}
        </div>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="flex-1 p-4 md:p-6 pb-24">
      <TransactionsTab v-if="store.activeTab === 'transactions'" />
      <CalendarTab v-else-if="store.activeTab === 'daily'" />
      <AccountsTab v-else-if="store.activeTab === 'accounts'" />
      <StatsTab v-else-if="store.activeTab === 'stats'" />
      <SanchaypatraTab v-else-if="store.activeTab === 'sanchaypatra'" />
      <SettingsTab v-else-if="store.activeTab === 'settings'" />
    </main>

    <!-- Bottom Navigation Bar (Realbyte Parity) -->
    <nav class="fixed bottom-0 left-0 right-0 max-w-4xl mx-auto z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-3 py-2 flex items-center justify-around shadow-2xl">
      <button
        @click="store.activeTab = 'transactions'"
        class="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all"
        :class="store.activeTab === 'transactions' ? 'text-rose-400 font-bold' : 'text-slate-400 hover:text-slate-200'"
      >
        <span class="text-base">📝</span>
        <span class="text-[10px]">Trans.</span>
      </button>

      <button
        @click="store.activeTab = 'daily'"
        class="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all"
        :class="store.activeTab === 'daily' ? 'text-rose-400 font-bold' : 'text-slate-400 hover:text-slate-200'"
      >
        <span class="text-base">📅</span>
        <span class="text-[10px]">Daily</span>
      </button>

      <button
        @click="store.activeTab = 'accounts'"
        class="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all"
        :class="store.activeTab === 'accounts' ? 'text-rose-400 font-bold' : 'text-slate-400 hover:text-slate-200'"
      >
        <span class="text-base">💳</span>
        <span class="text-[10px]">Accounts</span>
      </button>

      <button
        @click="store.activeTab = 'stats'"
        class="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all"
        :class="store.activeTab === 'stats' ? 'text-rose-400 font-bold' : 'text-slate-400 hover:text-slate-200'"
      >
        <span class="text-base">📊</span>
        <span class="text-[10px]">Stats</span>
      </button>

      <button
        @click="store.activeTab = 'sanchaypatra'"
        class="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all"
        :class="store.activeTab === 'sanchaypatra' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'"
      >
        <span class="text-base">🇧🇩</span>
        <span class="text-[10px]">Sanchay</span>
      </button>

      <button
        @click="store.activeTab = 'settings'"
        class="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all"
        :class="store.activeTab === 'settings' ? 'text-rose-400 font-bold' : 'text-slate-400 hover:text-slate-200'"
      >
        <span class="text-base">⚙️</span>
        <span class="text-[10px]">Settings</span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { useMoneyStore } from './store';
import TransactionsTab from './components/TransactionsTab.vue';
import CalendarTab from './components/CalendarTab.vue';
import AccountsTab from './components/AccountsTab.vue';
import StatsTab from './components/StatsTab.vue';
import SanchaypatraTab from './components/SanchaypatraTab.vue';
import SettingsTab from './components/SettingsTab.vue';

const store = useMoneyStore();
</script>
