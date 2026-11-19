<template>
  <div class="space-y-6">
    <!-- Savings Goals / Sinking Funds -->
    <section
      v-if="store.featureFlags.enableSavingsGoals"
      class="card-surface border rounded-2xl p-5 shadow-sm space-y-4"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-bold flex items-center gap-2">
            <Target class="w-4 h-4 text-emerald-500" />
            Savings Goals & Sinking Funds
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Track dedicated target funds (Emergency Reserve, Hajj, Laptop, Annual Insurance) with monthly pacing.
          </p>
        </div>
        <button
          type="button"
          @click="showAddGoalModal = true"
          class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5"
        >
          <Plus class="w-3.5 h-3.5" /> Add Goal
        </button>
      </div>

      <div v-if="store.savingsGoals.length === 0" class="py-8 text-center text-xs text-slate-500">
        No savings goals created yet. Add your first sinking fund above.
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          v-for="goal in store.savingsGoals"
          :key="goal.id"
          class="panel-surface border rounded-2xl p-4 space-y-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="text-sm font-bold flex items-center gap-2">
                {{ goal.name }}
                <span
                  class="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase"
                  :class="goal.status === 'completed' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'"
                >
                  {{ goal.status }}
                </span>
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                Target Date: {{ goal.targetDate }} • {{ getAccountName(goal.linkedAccountId) }}
              </div>
            </div>
            <button
              type="button"
              @click="store.deleteSavingsGoal(goal.id)"
              aria-label="Delete savings goal"
              class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>

          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs tabular-nums">
              <span class="font-bold text-emerald-600 dark:text-emerald-400">
                {{ formatBDT(goal.currentAmount, store.privacyMode) }}
              </span>
              <span class="text-slate-500 dark:text-slate-400">
                of {{ formatBDT(goal.targetAmount, store.privacyMode) }} ({{ goalPct(goal) }}%)
              </span>
            </div>
            <div class="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-300"
                :style="{ width: Math.min(100, goalPct(goal)) + '%', backgroundColor: goal.color || '#10B981' }"
              ></div>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 pt-1">
            <span class="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              Remaining: {{ formatBDT(Math.max(0, goal.targetAmount - goal.currentAmount), store.privacyMode) }}
            </span>
            <button
              v-if="goal.status !== 'completed'"
              type="button"
              @click="openContributeModal(goal)"
              class="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
            >
              + Contribute
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Credit Card Utilization & EMI Tracker -->
    <section
      v-if="store.featureFlags.enableCreditCardEmi"
      class="card-surface border rounded-2xl p-5 shadow-sm space-y-4"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-bold flex items-center gap-2">
            <CreditCard class="w-4 h-4 text-amber-500" />
            Credit Card Cycles & EMI Tracker
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Monitor card utilization against credit limits, billing cycles, and active installment plans.
          </p>
        </div>
        <button
          type="button"
          @click="showAddEmiModal = true"
          :disabled="creditCardAccounts.length === 0"
          class="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5"
        >
          <Plus class="w-3.5 h-3.5" /> Add EMI Plan
        </button>
      </div>

      <!-- Credit Card Utilization Summary -->
      <div v-if="creditCardAccounts.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          v-for="card in creditCardAccounts"
          :key="card.id"
          class="panel-surface border rounded-2xl p-4 space-y-2"
        >
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-sm">{{ card.name }}</span>
            <span class="text-rose-600 dark:text-rose-400 font-bold tabular-nums">
              Owed: {{ formatBDT(card.balance, store.privacyMode) }}
            </span>
          </div>
          <div v-if="card.creditLimit" class="space-y-1">
            <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                class="h-full rounded-full"
                :class="card.balance / card.creditLimit > 0.7 ? 'bg-rose-500' : 'bg-amber-500'"
                :style="{ width: Math.min(100, Math.round((card.balance / card.creditLimit) * 100)) + '%' }"
              ></div>
            </div>
            <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              <span>Limit: {{ formatBDT(card.creditLimit, store.privacyMode) }}</span>
              <span>
                Bill Day: {{ card.billingDay || '—' }} • Due Day: {{ card.dueDay || '—' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Active EMI List -->
      <div v-if="store.creditCardEmis.length === 0" class="py-4 text-center text-xs text-slate-500">
        No active credit card EMI plans.
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="emi in store.creditCardEmis"
          :key="emi.id"
          class="panel-surface border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
        >
          <div>
            <div class="font-bold text-sm flex items-center gap-2">
              {{ emi.title }}
              <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 tabular-nums">
                {{ emi.paidMonths }}/{{ emi.tenureMonths }} paid
              </span>
            </div>
            <div class="text-slate-500 dark:text-slate-400 tabular-nums">
              {{ getAccountName(emi.accountId) }} • {{ formatBDT(emi.monthlyInstallment, store.privacyMode) }}/mo • Next Due: {{ emi.nextDueDate }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="emi.status !== 'completed'"
              type="button"
              @click="store.logEmiInstallment(emi.id)"
              class="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold"
            >
              Log Installment
            </button>
            <button
              type="button"
              @click="store.deleteCreditCardEmi(emi.id)"
              aria-label="Delete EMI plan"
              class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Lent / Borrowed IOU Khata -->
    <section
      v-if="store.featureFlags.enableIouKhata"
      class="card-surface border rounded-2xl p-5 shadow-sm space-y-4"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-bold flex items-center gap-2">
            <Users class="w-4 h-4 text-indigo-500" />
            Lent & Borrowed IOU Khata
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Track personal receivables (money lent to friends/family) and payables with partial settlements.
          </p>
        </div>
        <button
          type="button"
          @click="showAddIouModal = true"
          class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5"
        >
          <Plus class="w-3.5 h-3.5" /> Add IOU
        </button>
      </div>

      <div class="grid grid-cols-2 gap-3 text-center">
        <div class="panel-surface border rounded-xl p-3">
          <div class="text-[11px] text-slate-500 dark:text-slate-400">Total Receivable (Lent)</div>
          <div class="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {{ formatBDT(totalLentOpen, store.privacyMode) }}
          </div>
        </div>
        <div class="panel-surface border rounded-xl p-3">
          <div class="text-[11px] text-slate-500 dark:text-slate-400">Total Payable (Borrowed)</div>
          <div class="text-base font-bold text-rose-600 dark:text-rose-400 tabular-nums">
            {{ formatBDT(totalBorrowedOpen, store.privacyMode) }}
          </div>
        </div>
      </div>

      <div v-if="store.iouRecords.length === 0" class="py-6 text-center text-xs text-slate-500">
        No active IOUs recorded.
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="rec in store.iouRecords"
          :key="rec.id"
          class="panel-surface border rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
        >
          <div>
            <div class="font-bold text-sm flex items-center gap-2">
              <span>{{ rec.personName }}</span>
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase"
                :class="
                  rec.direction === 'lent'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                "
              >
                {{ rec.direction === 'lent' ? 'Lent' : 'Borrowed' }}
              </span>
              <span
                v-if="rec.status === 'settled'"
                class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/20 text-slate-500"
              >
                Settled
              </span>
            </div>
            <div class="text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
              Principal: {{ formatBDT(rec.principal, store.privacyMode) }} • Settled: {{ formatBDT(rec.paidAmount, store.privacyMode) }}
              <span v-if="rec.dueDate"> • Due: {{ rec.dueDate }}</span>
              <span v-if="rec.note"> • {{ rec.note }}</span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              v-if="rec.status !== 'settled'"
              type="button"
              @click="openSettleModal(rec)"
              class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
            >
              Settle
            </button>
            <button
              type="button"
              @click="store.deleteIouRecord(rec.id)"
              aria-label="Delete IOU"
              class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Modals -->
    <BaseModal v-model="showAddGoalModal" title="Add Savings Goal">
      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-semibold mb-1">Goal Name</label>
          <input v-model="goalForm.name" placeholder="e.g. Emergency Fund" class="w-full input-surface border rounded-xl px-3 py-2" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Target Amount (৳)</label>
            <input v-model.number="goalForm.targetAmount" type="number" min="1" class="w-full input-surface border rounded-xl px-3 py-2 tabular-nums" />
          </div>
          <div>
            <label class="block font-semibold mb-1">Starting Balance (৳)</label>
            <input v-model.number="goalForm.currentAmount" type="number" min="0" class="w-full input-surface border rounded-xl px-3 py-2 tabular-nums" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Target Date</label>
            <input v-model="goalForm.targetDate" type="date" class="w-full input-surface border rounded-xl px-3 py-2" />
          </div>
          <div>
            <label class="block font-semibold mb-1">Linked Account</label>
            <select v-model="goalForm.linkedAccountId" class="w-full input-surface border rounded-xl px-3 py-2">
              <option v-for="acc in store.accounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
            </select>
          </div>
        </div>
      </div>
      <template #footer>
        <button type="button" @click="showAddGoalModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button type="button" @click="handleCreateGoal" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">
          Save Goal
        </button>
      </template>
    </BaseModal>

    <BaseModal v-model="showContributeModal" :title="`Contribute to ${activeGoal?.name || ''}`" maxWidthClass="max-w-sm">
      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-semibold mb-1">Amount (৳)</label>
          <input v-model.number="contributeAmount" type="number" min="1" class="w-full input-surface border rounded-xl px-3 py-2 tabular-nums font-bold" />
        </div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="contributeLogTxn" type="checkbox" />
          <span>Also deduct from linked account ledger</span>
        </label>
      </div>
      <template #footer>
        <button type="button" @click="showContributeModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button type="button" @click="handleContribute" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">
          Confirm
        </button>
      </template>
    </BaseModal>

    <BaseModal v-model="showAddEmiModal" title="Add Credit Card EMI Plan" maxWidthClass="max-w-md">
      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-semibold mb-1">Purchase / EMI Title</label>
          <input v-model="emiForm.title" placeholder="e.g. MacBook Air 12-Month 0% EMI" class="w-full input-surface border rounded-xl px-3 py-2" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Credit Card</label>
            <select v-model="emiForm.accountId" class="w-full input-surface border rounded-xl px-3 py-2">
              <option v-for="c in creditCardAccounts" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold mb-1">Total Amount (৳)</label>
            <input v-model.number="emiForm.totalAmount" type="number" min="1" class="w-full input-surface border rounded-xl px-3 py-2 tabular-nums" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Tenure (Months)</label>
            <input v-model.number="emiForm.tenureMonths" type="number" min="1" max="60" class="w-full input-surface border rounded-xl px-3 py-2 tabular-nums" />
          </div>
          <div>
            <label class="block font-semibold mb-1">Start Date</label>
            <input v-model="emiForm.startDate" type="date" class="w-full input-surface border rounded-xl px-3 py-2" />
          </div>
        </div>
      </div>
      <template #footer>
        <button type="button" @click="showAddEmiModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button type="button" @click="handleCreateEmi" class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold">
          Save EMI
        </button>
      </template>
    </BaseModal>

    <BaseModal v-model="showAddIouModal" title="Record IOU (Lent / Borrowed)" maxWidthClass="max-w-md">
      <div class="space-y-3 text-xs">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Direction</label>
            <select v-model="iouForm.direction" class="w-full input-surface border rounded-xl px-3 py-2">
              <option value="lent">Lent (Receivable)</option>
              <option value="borrowed">Borrowed (Payable)</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold mb-1">Person / Counterparty</label>
            <input v-model="iouForm.personName" placeholder="e.g. Tanvir" class="w-full input-surface border rounded-xl px-3 py-2" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Amount (৳)</label>
            <input v-model.number="iouForm.principal" type="number" min="1" class="w-full input-surface border rounded-xl px-3 py-2 tabular-nums" />
          </div>
          <div>
            <label class="block font-semibold mb-1">Settlement Account</label>
            <select v-model="iouForm.accountId" class="w-full input-surface border rounded-xl px-3 py-2">
              <option v-for="acc in store.accounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Date</label>
            <input v-model="iouForm.date" type="date" class="w-full input-surface border rounded-xl px-3 py-2" />
          </div>
          <div>
            <label class="block font-semibold mb-1">Due Date (Optional)</label>
            <input v-model="iouForm.dueDate" type="date" class="w-full input-surface border rounded-xl px-3 py-2" />
          </div>
        </div>
        <div>
          <label class="block font-semibold mb-1">Note</label>
          <input v-model="iouForm.note" placeholder="Optional note" class="w-full input-surface border rounded-xl px-3 py-2" />
        </div>
      </div>
      <template #footer>
        <button type="button" @click="showAddIouModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button type="button" @click="handleCreateIou" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">
          Save IOU
        </button>
      </template>
    </BaseModal>

    <BaseModal v-model="showSettleModal" :title="`Settle IOU: ${activeIou?.personName || ''}`" maxWidthClass="max-w-sm">
      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-semibold mb-1">Settlement Amount (৳)</label>
          <input v-model.number="settleAmount" type="number" min="1" class="w-full input-surface border rounded-xl px-3 py-2 tabular-nums font-bold" />
        </div>
        <div>
          <label class="block font-semibold mb-1">Account</label>
          <select v-model="settleAccountId" class="w-full input-surface border rounded-xl px-3 py-2">
            <option v-for="acc in store.accounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
          </select>
        </div>
      </div>
      <template #footer>
        <button type="button" @click="showSettleModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button type="button" @click="handleSettleIou" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">
          Confirm Settlement
        </button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { CreditCard, Plus, Target, Trash2, Users } from 'lucide-vue-next';
import BaseModal from './BaseModal.vue';
import { useMoneyStore, getLocalTodayISO } from '../store';
import { formatBDT } from '../utils/format';
import type { IouRecord, SavingsGoal } from '../types';

const store = useMoneyStore();

const creditCardAccounts = computed(() =>
  store.accounts.filter((a) => !a.archived && a.type === 'credit_card')
);

const totalLentOpen = computed(() =>
  store.iouRecords
    .filter((r) => r.direction === 'lent' && r.status !== 'settled')
    .reduce((sum, r) => sum + Math.max(0, r.principal - r.paidAmount), 0)
);

const totalBorrowedOpen = computed(() =>
  store.iouRecords
    .filter((r) => r.direction === 'borrowed' && r.status !== 'settled')
    .reduce((sum, r) => sum + Math.max(0, r.principal - r.paidAmount), 0)
);

function getAccountName(id: string): string {
  return store.accounts.find((a) => a.id === id)?.name || id;
}

function goalPct(goal: SavingsGoal): number {
  if (goal.targetAmount <= 0) return 0;
  return Math.round((goal.currentAmount / goal.targetAmount) * 100);
}

// Savings Goal Modals
const showAddGoalModal = ref(false);
const goalForm = ref({
  name: '',
  targetAmount: 100000,
  currentAmount: 0,
  targetDate: getLocalTodayISO(),
  linkedAccountId: store.accounts[0]?.id || '',
});

function handleCreateGoal() {
  if (!goalForm.value.name.trim() || goalForm.value.targetAmount <= 0) return;
  store.addSavingsGoal({
    name: goalForm.value.name.trim(),
    targetAmount: goalForm.value.targetAmount,
    currentAmount: goalForm.value.currentAmount,
    targetDate: goalForm.value.targetDate,
    linkedAccountId: goalForm.value.linkedAccountId,
    color: '#10B981',
  });
  showAddGoalModal.value = false;
  goalForm.value.name = '';
  goalForm.value.currentAmount = 0;
}

const showContributeModal = ref(false);
const activeGoal = ref<SavingsGoal | null>(null);
const contributeAmount = ref(5000);
const contributeLogTxn = ref(false);

function openContributeModal(goal: SavingsGoal) {
  activeGoal.value = goal;
  contributeAmount.value = Math.max(1000, goal.targetAmount - goal.currentAmount);
  contributeLogTxn.value = false;
  showContributeModal.value = true;
}

function handleContribute() {
  if (!activeGoal.value || contributeAmount.value <= 0) return;
  store.contributeToSavingsGoal(activeGoal.value.id, contributeAmount.value, contributeLogTxn.value);
  showContributeModal.value = false;
}

// EMI Modal
const showAddEmiModal = ref(false);
const emiForm = ref({
  title: '',
  accountId: creditCardAccounts.value[0]?.id || store.accounts[0]?.id || '',
  totalAmount: 60000,
  tenureMonths: 12,
  startDate: getLocalTodayISO(),
});

function handleCreateEmi() {
  if (!emiForm.value.title.trim() || emiForm.value.totalAmount <= 0) return;
  store.addCreditCardEmi({
    title: emiForm.value.title,
    accountId: emiForm.value.accountId || creditCardAccounts.value[0]?.id || '',
    totalAmount: emiForm.value.totalAmount,
    tenureMonths: emiForm.value.tenureMonths,
    startDate: emiForm.value.startDate,
  });
  showAddEmiModal.value = false;
  emiForm.value.title = '';
}

// IOU Modals
const showAddIouModal = ref(false);
const iouForm = ref({
  direction: 'lent' as 'lent' | 'borrowed',
  personName: '',
  principal: 5000,
  accountId: store.accounts[0]?.id || '',
  date: getLocalTodayISO(),
  dueDate: '',
  note: '',
});

function handleCreateIou() {
  if (!iouForm.value.personName.trim() || iouForm.value.principal <= 0) return;
  store.addIouRecord({
    direction: iouForm.value.direction,
    personName: iouForm.value.personName.trim(),
    principal: iouForm.value.principal,
    accountId: iouForm.value.accountId,
    date: iouForm.value.date,
    dueDate: iouForm.value.dueDate || undefined,
    note: iouForm.value.note.trim() || undefined,
  });
  showAddIouModal.value = false;
  iouForm.value.personName = '';
  iouForm.value.note = '';
}

const showSettleModal = ref(false);
const activeIou = ref<IouRecord | null>(null);
const settleAmount = ref(0);
const settleAccountId = ref('');

function openSettleModal(rec: IouRecord) {
  activeIou.value = rec;
  settleAmount.value = Math.max(0, rec.principal - rec.paidAmount);
  settleAccountId.value = rec.accountId || store.accounts[0]?.id || '';
  showSettleModal.value = true;
}

function handleSettleIou() {
  if (!activeIou.value || settleAmount.value <= 0) return;
  store.settleIouRecord(activeIou.value.id, settleAmount.value, settleAccountId.value);
  showSettleModal.value = false;
}
</script>
