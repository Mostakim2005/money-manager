<template>
  <div class="space-y-4">
    <!-- Header Summary Card -->
    <div class="bg-gradient-to-br from-indigo-900/80 via-slate-800 to-slate-900 border border-indigo-500/40 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
      <div class="flex items-center justify-between mb-4">
        <div>
          <div class="text-xs font-semibold text-indigo-300 tracking-wider uppercase flex items-center gap-1.5">
            <span>🇧🇩</span> Bangladesh National Savings Certificates (সঞ্চয়পত্র)
          </div>
          <div class="text-3xl font-extrabold text-white mt-1">
            {{ formatBDT(store.totalSanchaypatraPrincipal) }}
          </div>
          <div class="text-xs text-slate-400 mt-0.5">Total Principal Invested</div>
        </div>

        <button
          @click="showAddModal = true"
          class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg transition-all"
        >
          + Add Certificate
        </button>
      </div>

      <div class="grid grid-cols-2 gap-3 pt-3 border-t border-slate-700/60">
        <div class="bg-slate-900/60 p-3 rounded-xl border border-indigo-500/20">
          <div class="text-[11px] text-slate-400">Total Certificates</div>
          <div class="text-base font-bold text-white">{{ store.sanchaypatraSchemes.length }} active</div>
        </div>
        <div class="bg-slate-900/60 p-3 rounded-xl border border-indigo-500/20">
          <div class="text-[11px] text-slate-400">AIT Withholding Tax</div>
          <div class="text-base font-bold text-emerald-400">5% / 10% Tiered</div>
        </div>
      </div>
    </div>

    <!-- Active Certificates List -->
    <div class="space-y-3">
      <h3 class="font-bold text-slate-200 text-sm">Active Savings Certificates</h3>

      <div
        v-for="scheme in store.sanchaypatraSchemes"
        :key="scheme.id"
        class="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 shadow-xl hover:border-indigo-500/50 transition-all space-y-3"
      >
        <div class="flex items-start justify-between">
          <div>
            <div class="text-sm font-bold text-white">{{ scheme.name }}</div>
            <div class="text-xs text-slate-400">Reg: {{ scheme.registrationNo }} • Issued: {{ scheme.issueDate }}</div>
          </div>
          <div class="text-right">
            <div class="text-base font-extrabold text-white">{{ formatBDT(scheme.principal) }}</div>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
              {{ (scheme.slabGrossRate * 100).toFixed(2) }}% Gross
            </span>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/40 text-center">
          <div>
            <div class="text-[10px] text-slate-400">Net Profit Payout</div>
            <div class="text-xs font-bold text-emerald-400">+{{ formatBDT(scheme.netPeriodicProfit) }}</div>
          </div>
          <div>
            <div class="text-[10px] text-slate-400">Next Payout</div>
            <div class="text-xs font-bold text-sky-400">{{ scheme.nextPayoutDate }}</div>
          </div>
          <div>
            <div class="text-[10px] text-slate-400">Maturity Date</div>
            <div class="text-xs font-bold text-slate-300">{{ scheme.maturityDate }}</div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pt-2 border-t border-slate-700/50">
          <div>
            Linked Account: <span class="text-slate-200 font-medium">{{ getAccountName(scheme.linkedAccountId) }}</span>
            <span class="mx-1.5 text-slate-600">•</span>
            Tax: <span class="text-amber-400 font-semibold">{{ scheme.aitRate * 100 }}% AIT</span>
          </div>

          <button
            type="button"
            @click="handleCollectPayout(scheme.id)"
            class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1 active:scale-95"
            title="Log net periodic profit into linked bank account and advance schedule"
          >
            <span>💰</span> Collect Payout (+{{ formatBDT(scheme.netPeriodicProfit) }})
          </button>
        </div>
      </div>
    </div>

    <!-- Add Certificate Modal -->
    <div v-if="showAddModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-slate-800 border border-slate-700 rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4">
        <h3 class="text-lg font-bold text-white">Add National Savings Certificate</h3>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Scheme Type</label>
          <select v-model="form.schemeDefId" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
            <option v-for="def in BANGLADESH_SANCHAYPATRA_SCHEMES" :key="def.id" :value="def.id">
              {{ def.name }} ({{ def.banglaName }})
            </option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Registration / Certificate Number</label>
          <input v-model="form.registrationNo" placeholder="e.g. BD-SP-109281" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Principal Amount (৳)</label>
            <input v-model.number="form.principal" type="number" step="100000" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Issue Date</label>
            <input v-model="form.issueDate" type="date" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1">Deposit Profit To Bank Account</label>
          <select v-model="form.linkedAccountId" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white">
            <option v-for="acc in bankAccounts" :key="acc.id" :value="acc.id">
              {{ acc.name }} (৳{{ acc.balance.toLocaleString() }})
            </option>
          </select>
        </div>

        <!-- Real-time Slab Calculation Preview -->
        <div v-if="previewResult" class="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 space-y-1">
          <div class="text-xs font-bold text-indigo-300">Live Slab Calculation:</div>
          <div class="flex justify-between text-xs text-slate-300">
            <span>Gross Annual Rate:</span>
            <span class="font-bold text-white">{{ (previewResult.effectiveAnnualRate * 100).toFixed(2) }}%</span>
          </div>
          <div class="flex justify-between text-xs text-slate-300">
            <span>Advance Income Tax (AIT):</span>
            <span class="font-bold text-amber-400">{{ previewResult.aitRate * 100 }}%</span>
          </div>
          <div class="flex justify-between text-xs text-slate-300 pt-1 border-t border-indigo-500/20">
            <span>Net Periodic Payout:</span>
            <span class="font-bold text-emerald-400">+{{ formatBDT(previewResult.netPeriodicPayoutBDT) }} / installment</span>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2 border-t border-slate-700/60">
          <button @click="showAddModal = false" class="px-4 py-2 rounded-xl bg-slate-700 text-slate-300 text-xs font-semibold">Cancel</button>
          <button @click="handleSave" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg">Save Certificate</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMoneyStore } from '../store';
import { BANGLADESH_SANCHAYPATRA_SCHEMES } from '../modules/sanchaypatra/schemes';
import { calculateSanchaypatraProfit } from '../modules/sanchaypatra/calculator';

const store = useMoneyStore();
const showAddModal = ref(false);

const form = ref({
  schemeDefId: 'bd_5yr',
  registrationNo: '',
  principal: 1000000,
  issueDate: new Date().toISOString().split('T')[0],
  linkedAccountId: store.accounts[0]?.id || ''
});

const bankAccounts = computed(() => {
  return store.accounts.filter(a => a.type === 'bank' || a.type === 'cash');
});

const previewResult = computed(() => {
  const def = BANGLADESH_SANCHAYPATRA_SCHEMES.find(s => s.id === form.value.schemeDefId);
  if (!def || form.value.principal <= 0) return null;
  return calculateSanchaypatraProfit(form.value.principal, def, store.totalSanchaypatraPrincipal + form.value.principal);
});

function getAccountName(id: string): string {
  return store.accounts.find(a => a.id === id)?.name || 'Linked Account';
}

function handleCollectPayout(schemeId: string) {
  store.collectSanchaypatraPayout(schemeId);
}

function handleSave() {
  if (!form.value.registrationNo.trim()) return;
  const def = BANGLADESH_SANCHAYPATRA_SCHEMES.find(s => s.id === form.value.schemeDefId);
  if (!def) return;

  store.addSanchaypatra({
    name: def.name,
    registrationNo: form.value.registrationNo,
    principal: form.value.principal,
    issueDate: form.value.issueDate,
    schemeDefId: form.value.schemeDefId,
    linkedAccountId: form.value.linkedAccountId
  });

  showAddModal.value = false;
  form.value.registrationNo = '';
}

function formatBDT(amount: number): string {
  return '৳' + amount.toLocaleString('en-US');
}
</script>
