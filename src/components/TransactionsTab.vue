<template>
  <div class="space-y-4">
    <!-- Search & Filter Bar -->
    <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-3">
      <input
        v-model="searchQuery"
        placeholder="Search notes, accounts, or categories..."
        class="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500"
      />
      <button
        @click="showAddModal = true"
        class="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs shadow-lg transition-all whitespace-nowrap"
      >
        + Add Transaction
      </button>
    </div>

    <!-- Grouped Transactions List -->
    <div class="space-y-3">
      <div v-if="filteredTransactions.length === 0" class="text-center py-12 text-slate-500 text-sm">
        No transactions matching query.
      </div>

      <div
        v-for="txn in filteredTransactions"
        :key="txn.id"
        class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 shadow-xl flex items-center justify-between hover:border-slate-600/60 transition-all"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-inner"
            :style="{ backgroundColor: getCategory(txn.categoryId)?.color || '#64748B' }"
          >
            {{ getCategory(txn.categoryId)?.name.charAt(0) || '?' }}
          </div>
          <div>
            <div class="text-sm font-semibold text-white">{{ getCategory(txn.categoryId)?.name }}</div>
            <div class="text-xs text-slate-400">
              {{ txn.date }} • {{ getAccount(txn.accountId)?.name }} <span v-if="txn.note">• {{ txn.note }}</span>
            </div>
          </div>
        </div>

        <div class="text-right">
          <div class="text-sm font-bold" :class="txn.type === 'income' ? 'text-emerald-400' : 'text-rose-400'">
            {{ txn.type === 'income' ? '+' : '-' }}{{ formatBDT(txn.amount) }}
          </div>
          <div class="text-[10px] text-slate-500">{{ txn.time || '12:00' }}</div>
        </div>
      </div>
    </div>

    <!-- Quick Add Transaction Modal -->
    <div v-if="showAddModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-bold text-white">Record Transaction</h3>
          <div class="flex rounded-xl bg-slate-900 p-1 border border-slate-700">
            <button
              @click="newTxn.type = 'expense'"
              class="px-3 py-1 rounded-lg text-xs font-semibold"
              :class="newTxn.type === 'expense' ? 'bg-rose-500 text-white' : 'text-slate-400'"
            >
              Expense
            </button>
            <button
              @click="newTxn.type = 'income'"
              class="px-3 py-1 rounded-lg text-xs font-semibold"
              :class="newTxn.type === 'income' ? 'bg-emerald-500 text-white' : 'text-slate-400'"
            >
              Income
            </button>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Amount (৳)</label>
          <input
            v-model.number="newTxn.amount"
            type="number"
            placeholder="0"
            class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xl font-bold text-white"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Category</label>
            <select v-model="newTxn.categoryId" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
              <option v-for="cat in availableCategories" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Account</label>
            <select v-model="newTxn.accountId" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
              <option v-for="acc in store.accounts" :key="acc.id" :value="acc.id">
                {{ acc.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Date</label>
            <input v-model="newTxn.date" type="date" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Note (Optional)</label>
            <input v-model="newTxn.note" placeholder="Description / note" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2 border-t border-slate-700/60">
          <button @click="showAddModal = false" class="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 text-xs font-semibold">Cancel</button>
          <button @click="handleSaveTransaction" class="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold shadow-lg">Save Record</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMoneyStore } from '../store';
import { TransactionType } from '../types';

const store = useMoneyStore();
const searchQuery = ref('');
const showAddModal = ref(false);

const newTxn = ref({
  amount: 0,
  type: 'expense' as TransactionType,
  categoryId: store.categories[0]?.id || '',
  accountId: store.accounts[0]?.id || '',
  date: new Date().toISOString().split('T')[0],
  time: new Date().toTimeString().substring(0, 5),
  note: ''
});

const availableCategories = computed(() => {
  return store.categories.filter(c => c.type === newTxn.value.type);
});

const filteredTransactions = computed(() => {
  if (!searchQuery.value.trim()) return store.transactions;
  const q = searchQuery.value.toLowerCase();
  return store.transactions.filter(t => {
    const cat = getCategory(t.categoryId)?.name.toLowerCase() || '';
    const acc = getAccount(t.accountId)?.name.toLowerCase() || '';
    const note = t.note?.toLowerCase() || '';
    return cat.includes(q) || acc.includes(q) || note.includes(q);
  });
});

function getCategory(id: string) {
  return store.categories.find(c => c.id === id);
}

function getAccount(id: string) {
  return store.accounts.find(a => a.id === id);
}

function handleSaveTransaction() {
  if (newTxn.value.amount <= 0) return;
  store.addTransaction({ ...newTxn.value });
  showAddModal.value = false;
  newTxn.value.amount = 0;
  newTxn.value.note = '';
}

function formatBDT(amount: number): string {
  return '৳' + amount.toLocaleString('en-US');
}
</script>
