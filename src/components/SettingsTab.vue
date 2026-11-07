<template>
  <div class="space-y-4">
    <!-- Budgeting Philosophy Toggle Card -->
    <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-xl space-y-3">
      <div>
        <h3 class="font-bold text-white text-base">Budgeting Philosophy</h3>
        <p class="text-xs text-slate-400 mt-0.5">Choose how you organize and track your finances.</p>
      </div>

      <div class="grid grid-cols-2 gap-3 pt-2">
        <div
          @click="store.budgetMode = 'cashflow_ledger'"
          class="p-4 rounded-xl border cursor-pointer transition-all space-y-1.5"
          :class="store.budgetMode === 'cashflow_ledger' ? 'border-rose-500 bg-rose-500/10' : 'border-slate-700 bg-slate-900/40 hover:bg-slate-700/30'"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-bold text-white">Cashflow & Calendar</span>
            <span v-if="store.budgetMode === 'cashflow_ledger'" class="text-rose-400 text-xs font-bold">✓ Active</span>
          </div>
          <p class="text-xs text-slate-400">
            Realbyte default. Fluid daily expense entry, color-coded calendar grid, and monthly cashflow sums.
          </p>
        </div>

        <div
          @click="store.budgetMode = 'envelope_allocation'"
          class="p-4 rounded-xl border cursor-pointer transition-all space-y-1.5"
          :class="store.budgetMode === 'envelope_allocation' ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 bg-slate-900/40 hover:bg-slate-700/30'"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-bold text-white">Zero-Based Envelope</span>
            <span v-if="store.budgetMode === 'envelope_allocation'" class="text-indigo-400 text-xs font-bold">✓ Active</span>
          </div>
          <p class="text-xs text-slate-400">
            Actual Budget mode. Assign every income dollar into monthly category envelopes with progress limits.
          </p>
        </div>
      </div>
    </div>

    <!-- Dual Sync Bridge Configuration -->
    <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-xl space-y-4">
      <div>
        <h3 class="font-bold text-white text-base">Synchronization Bridges</h3>
        <p class="text-xs text-slate-400 mt-0.5">Connect your phone's database to your PC via Cloud Drive or Local Wi-Fi.</p>
      </div>

      <!-- Sync Option 1: Google Drive / Mega Synced SQLite File -->
      <div class="p-4 rounded-xl bg-slate-900/50 border border-slate-700/60 space-y-2">
        <div class="flex items-center justify-between">
          <div class="text-xs font-bold text-white flex items-center gap-2">
            <span>☁️</span> Google Drive / Mega Synced SQLite File
          </div>
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">Active Watcher</span>
        </div>
        <p class="text-xs text-slate-400">Path to mirrored Realbyte backup database file on your PC:</p>
        <input
          v-model="store.cloudSyncPath"
          class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
        />
      </div>

      <!-- Sync Option 2: Local Wi-Fi PC Manager Server -->
      <div class="p-4 rounded-xl bg-slate-900/50 border border-slate-700/60 space-y-2">
        <div class="flex items-center justify-between">
          <div class="text-xs font-bold text-white flex items-center gap-2">
            <span>📶</span> Realbyte Phone PC Manager (Local Wi-Fi)
          </div>
          <button
            @click="testPhoneConnection"
            class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold transition-all"
          >
            Test Connection
          </button>
        </div>
        <p class="text-xs text-slate-400">Connect directly to Realbyte's embedded Wi-Fi web server (Port 10000):</p>
        <div class="grid grid-cols-3 gap-2">
          <input
            v-model="store.phoneIp"
            placeholder="Phone IP (e.g. 192.168.1.105)"
            class="col-span-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
          />
          <input
            v-model.number="store.phonePort"
            type="number"
            placeholder="Port"
            class="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono text-center"
          />
        </div>
        <div v-if="connectionTestResult" class="text-xs font-semibold" :class="connectionTestResult.success ? 'text-emerald-400' : 'text-amber-400'">
          {{ connectionTestResult.message }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useMoneyStore } from '../store';
import { RealbytePcManagerClient } from '../modules/realbyte/client';

const store = useMoneyStore();
const connectionTestResult = ref<{ success: boolean; message: string } | null>(null);

async function testPhoneConnection() {
  connectionTestResult.value = { success: false, message: 'Pinging phone PC Manager server...' };
  const client = new RealbytePcManagerClient(store.phoneIp, store.phonePort);
  const ok = await client.checkConnection();
  if (ok) {
    connectionTestResult.value = { success: true, message: `Connected to Realbyte PC Manager at ${store.phoneIp}:${store.phonePort}` };
  } else {
    connectionTestResult.value = {
      success: false,
      message: `Could not reach ${store.phoneIp}:${store.phonePort}. Ensure PC Manager is turned ON in Realbyte on your phone.`
    };
  }
}
</script>
