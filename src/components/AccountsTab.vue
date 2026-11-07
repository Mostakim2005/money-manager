<template>
  <div class="space-y-4">
    <!-- Net Worth Card (Realbyte Style) -->
    <div class="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
      <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="flex items-center justify-between mb-4">
        <div>
          <div class="text-xs font-semibold text-slate-400 tracking-wider uppercase">Net Worth Total</div>
          <div class="text-3xl font-extrabold text-white mt-1">{{ formatBDT(overview.netWorth) }}</div>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="showTransferModal = true"
            class="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-lg transition-all flex items-center gap-1.5"
          >
            <span>⇄</span> Transfer
          </button>
          <button
            type="button"
            @click="showAddModal = true"
            class="px-3.5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs shadow-lg transition-all"
          >
            + Add Account
          </button>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2 pt-3 border-t border-slate-700/60 text-center">
        <div>
          <div class="text-[11px] text-slate-400">Liquid Assets</div>
          <div class="text-sm font-bold text-emerald-400">{{ formatBDT(overview.totalAssets) }}</div>
        </div>
        <div>
          <div class="text-[11px] text-slate-400">Liabilities</div>
          <div class="text-sm font-bold text-rose-400">-{{ formatBDT(overview.totalLiabilities) }}</div>
        </div>
        <div>
          <div class="text-[11px] text-slate-400">Investments</div>
          <div class="text-sm font-bold text-sky-400">{{ formatBDT(overview.totalInvestments) }}</div>
        </div>
      </div>
    </div>

    <!-- Account Groups -->
    <div v-for="group in overview.groups" :key="group.id" class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 shadow-xl">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-slate-200 text-sm flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full" :class="group.type === 'asset' ? 'bg-emerald-500' : group.type === 'liability' ? 'bg-rose-500' : 'bg-sky-500'"></span>
          {{ group.name }}
        </h3>
        <span class="text-xs font-bold" :class="group.type === 'liability' ? 'text-rose-400' : 'text-slate-300'">
          {{ formatBDT(group.totalBalance) }}
        </span>
      </div>

      <!-- Account List inside Group -->
      <div class="space-y-2">
        <div
          v-for="acc in group.accounts"
          :key="acc.id"
          class="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-slate-700/40 hover:border-slate-600/60 transition-all"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-inner"
              :style="{ backgroundColor: acc.color || '#3B82F6' }"
            >
              {{ acc.name.substring(0, 2).toUpperCase() }}
            </div>
            <div>
              <div class="text-sm font-semibold text-white">{{ acc.name }}</div>
              <div class="text-xs text-slate-400" v-if="acc.accountNumber">Acc: {{ acc.accountNumber }}</div>
            </div>
          </div>

          <div class="text-sm font-bold" :class="acc.type === 'credit_card' || acc.type === 'liability' ? 'text-rose-400' : 'text-white'">
            {{ formatBDT(acc.balance) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Add Account Modal -->
    <div v-if="showAddModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4">
        <h3 class="text-lg font-bold text-white">Create New Account</h3>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Account Name</label>
          <input v-model="newAcc.name" placeholder="e.g. BRAC Bank / bKash" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Account Type</label>
            <select v-model="newAcc.type" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
              <option value="bank">Bank Account</option>
              <option value="cash">Cash Wallet</option>
              <option value="mfs">Mobile Wallet (bKash/Nagad)</option>
              <option value="credit_card">Credit Card</option>
              <option value="asset">Savings / Investment</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Initial Balance (৳)</label>
            <input v-model.number="newAcc.balance" type="number" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2 border-t border-slate-700/60">
          <button @click="showAddModal = false" class="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 text-xs font-semibold">Cancel</button>
          <button @click="handleCreateAccount" class="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold shadow-lg">Save Account</button>
        </div>
      </div>
    </div>

    <!-- Quick Account Transfer Modal (Transfer Mode) -->
    <TransactionKeypad
      v-model="showTransferModal"
      initialType="transfer"
      :categories="store.categories"
      :accounts="store.accounts"
      @save="handleTransferSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMoneyStore } from '../store';
import { buildAccountsHierarchy } from '../modules/accounts/manager';
import { AccountType, TransactionType } from '../types';
import TransactionKeypad from './TransactionKeypad.vue';

const store = useMoneyStore();
const showAddModal = ref(false);
const showTransferModal = ref(false);

const newAcc = ref({
  name: '',
  type: 'bank' as AccountType,
  balance: 0,
  currency: 'BDT',
  color: '#3B82F6'
});

const overview = computed(() => {
  return buildAccountsHierarchy(store.accounts, store.totalSanchaypatraPrincipal);
});

function handleTransferSave(payload: {
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

function handleCreateAccount() {
  if (!newAcc.value.name.trim()) return;
  store.addAccount({ ...newAcc.value });
  showAddModal.value = false;
  newAcc.value.name = '';
  newAcc.value.balance = 0;
}

function formatBDT(amount: number): string {
  return '৳' + amount.toLocaleString('en-US');
}
</script>
