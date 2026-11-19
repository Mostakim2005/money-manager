<template>
  <div class="space-y-4">
    <!-- Net Worth Hero Card -->
    <div class="card-surface border rounded-2xl p-5 shadow-sm relative overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
            Net Worth Total
          </div>
          <div class="text-3xl font-extrabold mt-1 tabular-nums">
            {{ formatBDT(overview.netWorth, store.privacyMode) }}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="store.openQuickKeypad({ type: 'transfer' })"
            class="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5"
          >
            <ArrowLeftRight class="w-3.5 h-3.5" /> Transfer
          </button>
          <button
            type="button"
            @click="showAddModal = true"
            class="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-sm flex items-center gap-1"
          >
            <Plus class="w-3.5 h-3.5" /> Add Account
          </button>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200 dark:border-slate-800 text-center tabular-nums">
        <div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400">Liquid Assets</div>
          <div class="text-sm font-bold text-emerald-600 dark:text-emerald-400">
            {{ formatBDT(overview.totalAssets, store.privacyMode) }}
          </div>
        </div>
        <div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400">Liabilities</div>
          <div class="text-sm font-bold text-rose-600 dark:text-rose-400">
            -{{ formatBDT(overview.totalLiabilities, store.privacyMode) }}
          </div>
        </div>
        <div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400">Investments</div>
          <div class="text-sm font-bold text-sky-600 dark:text-sky-400">
            {{ formatBDT(overview.totalInvestments, store.privacyMode) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Account Groups -->
    <div v-for="group in overview.groups" :key="group.id" class="card-surface border rounded-2xl p-4 shadow-sm">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-sm flex items-center gap-2">
          <span
            class="w-2.5 h-2.5 rounded-full"
            :class="group.type === 'asset' ? 'bg-emerald-500' : group.type === 'liability' ? 'bg-rose-500' : 'bg-sky-500'"
          ></span>
          {{ group.name }}
        </h3>
        <span
          class="text-xs font-bold tabular-nums"
          :class="group.type === 'liability' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'"
        >
          {{ formatBDT(group.totalBalance, store.privacyMode) }}
        </span>
      </div>

      <div v-if="group.accounts.length === 0" class="text-xs text-slate-500 py-2">
        No accounts in this group.
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="acc in group.accounts"
          :key="acc.id"
          class="panel-surface border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
              :style="{ backgroundColor: acc.color || '#3B82F6' }"
            >
              {{ acc.name.substring(0, 2).toUpperCase() }}
            </div>
            <div class="min-w-0">
              <div class="text-sm font-semibold truncate">{{ acc.name }}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                <span v-if="acc.accountNumber">Acc: {{ acc.accountNumber }}</span>
                <span v-if="acc.creditLimit"> • Limit: {{ formatBDT(acc.creditLimit, store.privacyMode) }}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div
              class="text-sm font-bold tabular-nums"
              :class="acc.type === 'credit_card' || acc.type === 'liability' ? 'text-rose-600 dark:text-rose-400' : ''"
            >
              {{ formatBDT(acc.balance, store.privacyMode) }}
            </div>

            <div class="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-2">
              <button
                type="button"
                @click="openReconcileModal(acc)"
                title="Reconcile balance against bank/wallet statement"
                aria-label="Reconcile account balance"
                class="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10"
              >
                <Scale class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                @click="openEditModal(acc)"
                title="Edit account"
                aria-label="Edit account"
                class="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-500/10"
              >
                <Pencil class="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                @click="store.archiveAccount(acc.id, true)"
                title="Archive account"
                aria-label="Archive account"
                class="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10"
              >
                <Archive class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Archived Accounts Card -->
    <div v-if="archivedAccounts.length > 0" class="card-surface border rounded-2xl p-4 shadow-sm space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-wider text-slate-500">
          Archived Accounts ({{ archivedAccounts.length }})
        </span>
      </div>
      <div
        v-for="acc in archivedAccounts"
        :key="acc.id"
        class="panel-surface border rounded-xl p-2.5 flex items-center justify-between text-xs"
      >
        <span>{{ acc.name }} ({{ formatBDT(acc.balance, store.privacyMode) }})</span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="store.archiveAccount(acc.id, false)"
            class="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
          >
            Restore
          </button>
          <button
            type="button"
            @click="handleDeleteAccount(acc.id)"
            class="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Add Account Modal -->
    <BaseModal v-model="showAddModal" title="Create New Account" maxWidthClass="max-w-md">
      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-semibold mb-1">Account Name</label>
          <input v-model="newAcc.name" placeholder="e.g. BRAC Bank / bKash" class="w-full input-surface border rounded-xl px-3 py-2" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold mb-1">Account Type</label>
            <select v-model="newAcc.type" class="w-full input-surface border rounded-xl px-3 py-2">
              <option value="bank">Bank Account</option>
              <option value="cash">Cash Wallet</option>
              <option value="mfs">Mobile Wallet (bKash/Nagad)</option>
              <option value="credit_card">Credit Card</option>
              <option value="liability">Loan / Liability</option>
              <option value="asset">Savings / Investment</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold mb-1">Initial Balance (৳)</label>
            <input v-model.number="newAcc.balance" type="number" class="w-full input-surface border rounded-xl px-3 py-2 tabular-nums" />
          </div>
        </div>
      </div>
      <template #footer>
        <button type="button" @click="showAddModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button type="button" @click="handleCreateAccount" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold">
          Save Account
        </button>
      </template>
    </BaseModal>

    <!-- Edit Account Modal -->
    <BaseModal v-model="showEditModal" title="Edit Account" maxWidthClass="max-w-md">
      <div v-if="editingAccount" class="space-y-3 text-xs">
        <div>
          <label class="block font-semibold mb-1">Account Name</label>
          <input v-model="editAccForm.name" class="w-full input-surface border rounded-xl px-3 py-2" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Type</label>
            <select v-model="editAccForm.type" class="w-full input-surface border rounded-xl px-3 py-2">
              <option value="bank">Bank Account</option>
              <option value="cash">Cash Wallet</option>
              <option value="mfs">MFS Wallet</option>
              <option value="credit_card">Credit Card</option>
              <option value="liability">Liability / Loan</option>
              <option value="asset">Asset / Investment</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold mb-1">Account Number</label>
            <input v-model="editAccForm.accountNumber" class="w-full input-surface border rounded-xl px-3 py-2" />
          </div>
        </div>
        <div v-if="editAccForm.type === 'credit_card'" class="grid grid-cols-3 gap-2">
          <div>
            <label class="block font-semibold mb-1">Credit Limit (৳)</label>
            <input v-model.number="editAccForm.creditLimit" type="number" class="w-full input-surface border rounded-xl px-2.5 py-2 tabular-nums" />
          </div>
          <div>
            <label class="block font-semibold mb-1">Billing Day</label>
            <input v-model.number="editAccForm.billingDay" type="number" min="1" max="31" class="w-full input-surface border rounded-xl px-2.5 py-2 tabular-nums" />
          </div>
          <div>
            <label class="block font-semibold mb-1">Due Day</label>
            <input v-model.number="editAccForm.dueDay" type="number" min="1" max="31" class="w-full input-surface border rounded-xl px-2.5 py-2 tabular-nums" />
          </div>
        </div>
        <div class="flex items-center gap-2">
          <label class="font-semibold">Color:</label>
          <input v-model="editAccForm.color" type="color" class="h-8 w-12 rounded border border-slate-300 dark:border-slate-700" />
        </div>
        <div v-if="accountDeleteError" class="text-rose-600 dark:text-rose-400 font-semibold">
          {{ accountDeleteError }}
        </div>
      </div>

      <template #footer>
        <button
          v-if="editingAccount"
          type="button"
          @click="handleDeleteAccount(editingAccount.id, true)"
          class="mr-auto px-3 py-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 text-xs font-semibold"
        >
          Force Delete
        </button>
        <button type="button" @click="showEditModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button type="button" @click="handleSaveAccountEdit" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold">
          Save Changes
        </button>
      </template>
    </BaseModal>

    <!-- Reconcile Balance Modal -->
    <BaseModal
      v-model="showReconcileModal"
      :title="`Reconcile: ${reconcileTarget?.name || ''}`"
      subtitle="Automatically logs a Balance Adjustment transaction to match your real statement"
      maxWidthClass="max-w-md"
    >
      <div v-if="reconcileTarget" class="space-y-3 text-xs">
        <div class="grid grid-cols-2 gap-2">
          <div class="panel-surface border rounded-xl p-3">
            <div class="text-slate-500">Current Ledger</div>
            <div class="text-base font-bold tabular-nums">
              {{ formatBDT(reconcileTarget.balance, store.privacyMode) }}
            </div>
          </div>
          <div class="panel-surface border rounded-xl p-3">
            <div class="text-slate-500">Adjustment Delta</div>
            <div
              class="text-base font-bold tabular-nums"
              :class="reconcileDelta === 0 ? 'text-slate-500' : reconcileDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
            >
              {{ reconcileDelta >= 0 ? '+' : '' }}{{ reconcileDelta.toLocaleString('en-US') }} BDT
            </div>
          </div>
        </div>

        <div>
          <label class="block font-semibold mb-1">Actual Statement Balance (৳)</label>
          <input
            v-model.number="reconcileActualBalance"
            type="number"
            class="w-full input-surface border rounded-xl px-3 py-2 font-bold text-sm tabular-nums"
          />
        </div>
        <div>
          <label class="block font-semibold mb-1">Adjustment Note</label>
          <input v-model="reconcileNote" class="w-full input-surface border rounded-xl px-3 py-2" />
        </div>
      </div>

      <template #footer>
        <button type="button" @click="showReconcileModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button
          type="button"
          @click="handleExecuteReconcile"
          :disabled="reconcileDelta === 0"
          class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold"
        >
          Create Balance Adjustment
        </button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Archive, ArrowLeftRight, Pencil, Plus, Scale } from 'lucide-vue-next';
import BaseModal from './BaseModal.vue';
import { useMoneyStore } from '../store';
import { buildAccountsHierarchy } from '../modules/accounts/manager';
import { formatBDT } from '../utils/format';
import type { Account, AccountType } from '../types';

const store = useMoneyStore();

const overview = computed(() =>
  buildAccountsHierarchy(
    store.accounts,
    store.totalSanchaypatraPrincipal + store.totalFdrDpsPrincipal
  )
);

const archivedAccounts = computed(() => store.accounts.filter((a) => a.archived));

// Add Account
const showAddModal = ref(false);
const newAcc = ref({
  name: '',
  type: 'bank' as AccountType,
  balance: 0,
  currency: 'BDT',
  color: '#3B82F6',
});

function handleCreateAccount() {
  if (!newAcc.value.name.trim()) return;
  store.addAccount({ ...newAcc.value });
  showAddModal.value = false;
  newAcc.value.name = '';
  newAcc.value.balance = 0;
}

// Edit Account
const showEditModal = ref(false);
const editingAccount = ref<Account | null>(null);
const accountDeleteError = ref('');
const editAccForm = ref({
  name: '',
  type: 'bank' as AccountType,
  accountNumber: '',
  creditLimit: 0,
  billingDay: 25,
  dueDay: 12,
  color: '#3B82F6',
});

function openEditModal(acc: Account) {
  editingAccount.value = acc;
  accountDeleteError.value = '';
  editAccForm.value = {
    name: acc.name,
    type: acc.type,
    accountNumber: acc.accountNumber || '',
    creditLimit: acc.creditLimit || 0,
    billingDay: acc.billingDay || 25,
    dueDay: acc.dueDay || 12,
    color: acc.color || '#3B82F6',
  };
  showEditModal.value = true;
}

function handleSaveAccountEdit() {
  if (!editingAccount.value || !editAccForm.value.name.trim()) return;
  store.editAccount(editingAccount.value.id, {
    name: editAccForm.value.name.trim(),
    type: editAccForm.value.type,
    accountNumber: editAccForm.value.accountNumber.trim() || undefined,
    creditLimit: editAccForm.value.type === 'credit_card' ? editAccForm.value.creditLimit : undefined,
    billingDay: editAccForm.value.type === 'credit_card' ? editAccForm.value.billingDay : undefined,
    dueDay: editAccForm.value.type === 'credit_card' ? editAccForm.value.dueDay : undefined,
    color: editAccForm.value.color,
  });
  showEditModal.value = false;
}

function handleDeleteAccount(id: string, force: boolean = false) {
  accountDeleteError.value = '';
  try {
    store.deleteAccount(id, force);
    showEditModal.value = false;
  } catch (err: any) {
    accountDeleteError.value = err?.message || 'Unable to delete account.';
  }
}

// Reconcile Balance
const showReconcileModal = ref(false);
const reconcileTarget = ref<Account | null>(null);
const reconcileActualBalance = ref(0);
const reconcileNote = ref('Balance Adjustment (Reconciled)');

const reconcileDelta = computed(() => {
  if (!reconcileTarget.value) return 0;
  return Math.round(reconcileActualBalance.value || 0) - Math.round(reconcileTarget.value.balance);
});

function openReconcileModal(acc: Account) {
  reconcileTarget.value = acc;
  reconcileActualBalance.value = acc.balance;
  reconcileNote.value = 'Balance Adjustment (Reconciled)';
  showReconcileModal.value = true;
}

function handleExecuteReconcile() {
  if (!reconcileTarget.value) return;
  store.reconcileAccountBalance(
    reconcileTarget.value.id,
    reconcileActualBalance.value,
    reconcileNote.value
  );
  showReconcileModal.value = false;
}
</script>
