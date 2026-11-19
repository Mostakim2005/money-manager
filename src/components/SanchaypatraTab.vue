<template>
  <div class="space-y-5">
    <!-- Hero Summary Card -->
    <div class="card-surface border border-indigo-500/30 rounded-2xl p-5 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <div class="text-xs font-semibold text-indigo-600 dark:text-indigo-300 tracking-wider uppercase flex items-center gap-1.5">
            <Landmark class="w-4 h-4" />
            Bangladesh National Savings Certificates (সঞ্চয়পত্র) & Term Deposits
          </div>
          <div class="text-3xl font-extrabold mt-1 tabular-nums">
            {{ formatBDT(store.totalSanchaypatraPrincipal + store.totalFdrDpsPrincipal, store.privacyMode) }}
          </div>
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            Sanchaypatra: {{ formatBDT(store.totalSanchaypatraPrincipal, store.privacyMode) }} •
            FDR/DPS: {{ formatBDT(store.totalFdrDpsPrincipal, store.privacyMode) }}
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            @click="showSlabEditorModal = true"
            class="px-3 py-2 rounded-xl panel-surface border text-xs font-semibold flex items-center gap-1.5 hover:border-indigo-500"
          >
            <SlidersHorizontal class="w-3.5 h-3.5" /> Edit Gov Slab Rates
          </button>
          <button
            type="button"
            @click="showAddModal = true"
            class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm flex items-center gap-1"
          >
            <Plus class="w-3.5 h-3.5" /> Add Certificate
          </button>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800 text-center">
        <div class="panel-surface border p-2.5 rounded-xl">
          <div class="text-[11px] text-slate-500 dark:text-slate-400">Certificates</div>
          <div class="text-sm font-bold tabular-nums">{{ store.sanchaypatraSchemes.length }} total</div>
        </div>
        <div class="panel-surface border p-2.5 rounded-xl">
          <div class="text-[11px] text-slate-500 dark:text-slate-400">AIT Withholding</div>
          <div class="text-sm font-bold text-emerald-600 dark:text-emerald-400">5% / 10% Tiered</div>
        </div>
        <div class="panel-surface border p-2.5 rounded-xl">
          <div class="text-[11px] text-slate-500 dark:text-slate-400">FDR / DPS</div>
          <div class="text-sm font-bold tabular-nums">{{ store.fdrDpsAccounts.length }} active</div>
        </div>
      </div>
    </div>

    <!-- Active Savings Certificates -->
    <div class="space-y-3">
      <h3 class="font-bold text-sm">Savings Certificates</h3>

      <div
        v-for="scheme in store.sanchaypatraSchemes"
        :key="scheme.id"
        class="card-surface border rounded-2xl p-4 shadow-sm space-y-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-bold flex items-center gap-2 flex-wrap">
              <span>{{ scheme.name }}</span>
              <span
                class="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase"
                :class="
                  scheme.status === 'encashed'
                    ? 'bg-slate-500/20 text-slate-500'
                    : scheme.status === 'matured'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                "
              >
                {{ scheme.status || 'active' }}
              </span>
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
              Reg: {{ scheme.registrationNo }} • Issued: {{ scheme.issueDate }}
            </div>
          </div>

          <div class="text-right">
            <div class="text-base font-extrabold tabular-nums">
              {{ formatBDT(scheme.principal, store.privacyMode) }}
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 font-semibold tabular-nums">
              {{ (scheme.slabGrossRate * 100).toFixed(2) }}% Gross
            </span>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2 p-2.5 rounded-xl panel-surface border text-center tabular-nums">
          <div>
            <div class="text-[10px] text-slate-500 dark:text-slate-400">Net Payout</div>
            <div class="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              +{{ formatBDT(scheme.netPeriodicProfit, store.privacyMode) }}
            </div>
          </div>
          <div>
            <div class="text-[10px] text-slate-500 dark:text-slate-400">Next Payout</div>
            <div class="text-xs font-bold text-sky-600 dark:text-sky-400">{{ scheme.nextPayoutDate }}</div>
          </div>
          <div>
            <div class="text-[10px] text-slate-500 dark:text-slate-400">Maturity Date</div>
            <div class="text-xs font-bold">{{ scheme.maturityDate }}</div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
          <div class="text-slate-500 dark:text-slate-400">
            Account: <strong class="text-slate-700 dark:text-slate-200">{{ getAccountName(scheme.linkedAccountId) }}</strong>
            • Tax: <strong class="text-amber-600 dark:text-amber-400 tabular-nums">{{ scheme.aitRate * 100 }}% AIT</strong>
          </div>

          <div class="flex items-center gap-1.5 flex-wrap">
            <button
              v-if="scheme.status !== 'encashed'"
              type="button"
              @click="openEncashmentModal(scheme)"
              class="px-2.5 py-1.5 rounded-xl panel-surface border text-xs font-semibold hover:border-amber-500"
            >
              Early Encashment
            </button>
            <button
              type="button"
              @click="openEditSchemeModal(scheme)"
              aria-label="Edit certificate"
              class="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 dark:hover:text-sky-400"
            >
              <Pencil class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              @click="store.deleteSanchaypatra(scheme.id)"
              aria-label="Delete certificate"
              class="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:hover:text-rose-400"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
            <button
              v-if="scheme.status !== 'matured' && scheme.status !== 'encashed'"
              type="button"
              @click="store.collectSanchaypatraPayout(scheme.id)"
              class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1"
            >
              <Banknote class="w-3.5 h-3.5" />
              Collect (+{{ formatBDT(scheme.netPeriodicProfit, store.privacyMode) }})
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- FDR & DPS Bank Deposits Section -->
    <div class="card-surface border rounded-2xl p-5 shadow-sm space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="font-bold text-base flex items-center gap-2">
            <PiggyBank class="w-4 h-4 text-sky-500" />
            FDR & DPS Bank Deposits
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Track Fixed Deposit Receipts (FDR) and monthly Deposit Pension Schemes (DPS) with AIT net maturity estimates.
          </p>
        </div>
        <button
          type="button"
          @click="showAddFdrModal = true"
          class="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center gap-1"
        >
          <Plus class="w-3.5 h-3.5" /> Add FDR / DPS
        </button>
      </div>

      <div v-if="store.fdrDpsAccounts.length === 0" class="py-6 text-center text-xs text-slate-500">
        No FDR or DPS deposits recorded yet.
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          v-for="item in store.fdrDpsAccounts"
          :key="item.id"
          class="panel-surface border rounded-2xl p-4 space-y-2.5 text-xs"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="font-bold text-sm flex items-center gap-2">
                <span class="px-2 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400 text-[10px] uppercase font-bold">
                  {{ item.kind }}
                </span>
                <span>{{ item.bankName }}</span>
              </div>
              <div class="text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                Acc: {{ item.accountNumber || '—' }} • {{ (item.annualRate * 100).toFixed(2) }}% p.a. • {{ item.tenureMonths }} mo
              </div>
            </div>
            <button
              type="button"
              @click="store.deleteFdrDps(item.id)"
              aria-label="Delete deposit"
              class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2 tabular-nums">
            <div>
              <div class="text-[10px] text-slate-500">Deposited Principal</div>
              <div class="font-bold">{{ formatBDT(item.principal, store.privacyMode) }}</div>
            </div>
            <div class="text-right">
              <div class="text-[10px] text-slate-500">Est. Net Maturity ({{ item.maturityDate }})</div>
              <div class="font-bold text-emerald-600 dark:text-emerald-400">
                {{ formatBDT(item.expectedMaturityAmount, store.privacyMode) }}
              </div>
            </div>
          </div>

          <div v-if="item.kind === 'dps'" class="pt-1 flex items-center justify-between gap-2">
            <span class="text-[11px] text-slate-500 tabular-nums">
              Installments: {{ item.paidInstallments }}/{{ item.tenureMonths }} ({{ formatBDT(item.monthlyInstallment, store.privacyMode) }}/mo)
            </span>
            <button
              v-if="item.status === 'active'"
              type="button"
              @click="store.logDpsInstallment(item.id)"
              class="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold"
            >
              Log Installment
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Certificate Modal -->
    <BaseModal v-model="showAddModal" title="Add National Savings Certificate" maxWidthClass="max-w-md">
      <div class="space-y-3 text-xs">
        <div>
          <label class="block font-semibold mb-1">Scheme Type</label>
          <select v-model="form.schemeDefId" class="w-full input-surface border rounded-xl px-3 py-2">
            <option v-for="def in store.customSchemeDefinitions" :key="def.id" :value="def.id">
              {{ def.name }} ({{ def.banglaName }})
            </option>
          </select>
        </div>

        <div>
          <label class="block font-semibold mb-1">Registration Number</label>
          <input v-model="form.registrationNo" placeholder="e.g. BD-SP-109281" class="w-full input-surface border rounded-xl px-3 py-2" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold mb-1">Principal (৳)</label>
            <input v-model.number="form.principal" type="number" step="100000" class="w-full input-surface border rounded-xl px-3 py-2 tabular-nums" />
          </div>
          <div>
            <label class="block font-semibold mb-1">Issue Date</label>
            <input v-model="form.issueDate" type="date" class="w-full input-surface border rounded-xl px-3 py-2 tabular-nums" />
          </div>
        </div>

        <div>
          <label class="block font-semibold mb-1">Linked Bank Account</label>
          <select v-model="form.linkedAccountId" class="w-full input-surface border rounded-xl px-3 py-2">
            <option v-for="acc in bankAccounts" :key="acc.id" :value="acc.id">
              {{ acc.name }} ({{ formatBDT(acc.balance, store.privacyMode) }})
            </option>
          </select>
        </div>

        <div v-if="previewResult" class="p-3 rounded-xl panel-surface border border-indigo-500/30 space-y-1">
          <div class="font-bold text-indigo-600 dark:text-indigo-300">Live Cumulative Slab Calculation:</div>
          <div class="flex justify-between">
            <span>Gross Annual Rate:</span>
            <strong class="tabular-nums">{{ (previewResult.effectiveAnnualRate * 100).toFixed(2) }}%</strong>
          </div>
          <div class="flex justify-between">
            <span>AIT Rate:</span>
            <strong class="text-amber-600 dark:text-amber-400 tabular-nums">{{ previewResult.aitRate * 100 }}%</strong>
          </div>
          <div class="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
            <span>Net Periodic Payout:</span>
            <strong class="text-emerald-600 dark:text-emerald-400 tabular-nums">
              +{{ formatBDT(previewResult.netPeriodicPayoutBDT, store.privacyMode) }}
            </strong>
          </div>
        </div>
      </div>

      <template #footer>
        <button type="button" @click="showAddModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button type="button" @click="handleSave" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">
          Save Certificate
        </button>
      </template>
    </BaseModal>

    <!-- Edit Certificate Modal -->
    <BaseModal v-model="showEditSchemeModal" title="Edit Savings Certificate" maxWidthClass="max-w-md">
      <div v-if="editingScheme" class="space-y-3 text-xs">
        <div>
          <label class="block font-semibold mb-1">Registration Number</label>
          <input v-model="editSchemeForm.registrationNo" class="w-full input-surface border rounded-xl px-3 py-2" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Principal (৳)</label>
            <input v-model.number="editSchemeForm.principal" type="number" class="w-full input-surface border rounded-xl px-3 py-2 tabular-nums" />
          </div>
          <div>
            <label class="block font-semibold mb-1">Net Payout (৳)</label>
            <input v-model.number="editSchemeForm.netPeriodicProfit" type="number" class="w-full input-surface border rounded-xl px-3 py-2 tabular-nums" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Next Payout Date</label>
            <input v-model="editSchemeForm.nextPayoutDate" type="date" class="w-full input-surface border rounded-xl px-3 py-2" />
          </div>
          <div>
            <label class="block font-semibold mb-1">Linked Account</label>
            <select v-model="editSchemeForm.linkedAccountId" class="w-full input-surface border rounded-xl px-3 py-2">
              <option v-for="acc in bankAccounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
            </select>
          </div>
        </div>
      </div>

      <template #footer>
        <button type="button" @click="showEditSchemeModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button type="button" @click="handleSaveSchemeEdit" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold">
          Save Changes
        </button>
      </template>
    </BaseModal>

    <!-- Early Encashment Simulator & Execution Modal -->
    <BaseModal
      v-model="showEncashModal"
      :title="`Early Encashment: ${encashScheme?.name || ''}`"
      subtitle="Simulates premature surrender penalty, AIT withholding, and principal settlement"
      maxWidthClass="max-w-md"
    >
      <div v-if="encashScheme" class="space-y-3 text-xs">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Encashment Date</label>
            <input v-model="encashDate" type="date" class="w-full input-surface border rounded-xl px-3 py-2" />
          </div>
          <div>
            <label class="block font-semibold mb-1">Already Paid Profit (৳)</label>
            <input v-model.number="encashAlreadyPaid" type="number" min="0" class="w-full input-surface border rounded-xl px-3 py-2 tabular-nums" />
          </div>
        </div>

        <div v-if="encashPreview" class="panel-surface border rounded-2xl p-3.5 space-y-2 tabular-nums">
          <div class="flex justify-between">
            <span>Completed Years:</span>
            <strong>{{ encashPreview.completedYears }} yrs</strong>
          </div>
          <div class="flex justify-between">
            <span>Early Surrender Rate:</span>
            <strong>{{ (encashPreview.effectiveEarlyRate * 100).toFixed(2) }}%</strong>
          </div>
          <div class="flex justify-between">
            <span>Net Accrued Profit (after AIT):</span>
            <strong>{{ formatBDT(encashPreview.netAccruedProfitBDT, store.privacyMode) }}</strong>
          </div>
          <div class="flex justify-between">
            <span>Clawback / Profit Adjustment:</span>
            <strong :class="encashPreview.adjustmentDeltaBDT >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
              {{ encashPreview.adjustmentDeltaBDT >= 0 ? '+' : '' }}{{ encashPreview.adjustmentDeltaBDT.toLocaleString('en-US') }} BDT
            </strong>
          </div>
          <div class="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-sm font-extrabold">
            <span>Net Settlement Payout:</span>
            <span class="text-emerald-600 dark:text-emerald-400">
              {{ formatBDT(encashPreview.netSettlementPayoutBDT, store.privacyMode) }}
            </span>
          </div>
        </div>
      </div>

      <template #footer>
        <button type="button" @click="showEncashModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button type="button" @click="executeEncashment" class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold">
          Execute Encashment & Deposit
        </button>
      </template>
    </BaseModal>

    <!-- Editable Government Slab Rates Modal -->
    <BaseModal
      v-model="showSlabEditorModal"
      title="Edit Sanchaypatra Government Slab Rates"
      subtitle="Customize slab rates if Bangladesh National Savings Directorate updates statutory tiers"
      maxWidthClass="max-w-2xl"
    >
      <div class="space-y-4 text-xs">
        <div v-for="def in store.customSchemeDefinitions" :key="def.id" class="panel-surface border rounded-2xl p-3.5 space-y-2">
          <div class="font-bold text-sm">{{ def.name }}</div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div v-for="(slab, sIdx) in def.slabRates" :key="sIdx" class="p-2 rounded-xl card-surface border space-y-1">
              <div class="text-[10px] text-slate-500 font-semibold">
                Tier {{ sIdx + 1 }} ({{ slab.maxPrincipalBDT === Infinity ? 'Above 3M' : `≤ ${(slab.maxPrincipalBDT / 100000).toFixed(0)}L` }})
              </div>
              <label class="flex items-center gap-1">
                <span>Rate %:</span>
                <input
                  type="number"
                  step="0.01"
                  :value="Number((slab.annualRate * 100).toFixed(2))"
                  @change="updateSlabRate(def, sIdx, $event)"
                  class="w-20 input-surface border rounded-lg px-2 py-1 font-bold tabular-nums"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <button
          type="button"
          @click="store.resetSchemeDefinitions()"
          class="mr-auto px-3 py-2 rounded-xl panel-surface border text-xs font-semibold"
        >
          Reset Statutory Defaults
        </button>
        <button type="button" @click="showSlabEditorModal = false" class="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold">
          Done
        </button>
      </template>
    </BaseModal>

    <!-- Add FDR / DPS Modal -->
    <BaseModal v-model="showAddFdrModal" title="Add FDR / DPS Deposit" maxWidthClass="max-w-md">
      <div class="space-y-3 text-xs">
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            @click="fdrForm.kind = 'fdr'"
            class="py-2 rounded-xl font-bold border"
            :class="fdrForm.kind === 'fdr' ? 'bg-sky-600 text-white border-sky-600' : 'panel-surface'"
          >
            FDR (Lump Sum)
          </button>
          <button
            type="button"
            @click="fdrForm.kind = 'dps'"
            class="py-2 rounded-xl font-bold border"
            :class="fdrForm.kind === 'dps' ? 'bg-sky-600 text-white border-sky-600' : 'panel-surface'"
          >
            DPS (Monthly)
          </button>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold mb-1">Bank Name</label>
            <input v-model="fdrForm.bankName" placeholder="e.g. BRAC Bank" class="w-full input-surface border rounded-xl px-3 py-2" />
          </div>
          <div>
            <label class="block font-semibold mb-1">Account No.</label>
            <input v-model="fdrForm.accountNumber" placeholder="Optional" class="w-full input-surface border rounded-xl px-3 py-2" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div v-if="fdrForm.kind === 'fdr'">
            <label class="block font-semibold mb-1">Principal (৳)</label>
            <input v-model.number="fdrForm.principal" type="number" class="w-full input-surface border rounded-xl px-3 py-2 tabular-nums" />
          </div>
          <div v-else>
            <label class="block font-semibold mb-1">Monthly Installment (৳)</label>
            <input v-model.number="fdrForm.monthlyInstallment" type="number" class="w-full input-surface border rounded-xl px-3 py-2 tabular-nums" />
          </div>
          <div>
            <label class="block font-semibold mb-1">Annual Rate (%)</label>
            <input v-model.number="fdrForm.annualRatePct" type="number" step="0.1" class="w-full input-surface border rounded-xl px-3 py-2 tabular-nums" />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div>
            <label class="block font-semibold mb-1">Tenure (Mo)</label>
            <input v-model.number="fdrForm.tenureMonths" type="number" min="3" class="w-full input-surface border rounded-xl px-2.5 py-2 tabular-nums" />
          </div>
          <div>
            <label class="block font-semibold mb-1">AIT (%)</label>
            <input v-model.number="fdrForm.aitPct" type="number" step="1" class="w-full input-surface border rounded-xl px-2.5 py-2 tabular-nums" />
          </div>
          <div>
            <label class="block font-semibold mb-1">Start Date</label>
            <input v-model="fdrForm.startDate" type="date" class="w-full input-surface border rounded-xl px-2.5 py-2" />
          </div>
        </div>

        <div>
          <label class="block font-semibold mb-1">Linked Funding Account</label>
          <select v-model="fdrForm.linkedAccountId" class="w-full input-surface border rounded-xl px-3 py-2">
            <option v-for="acc in bankAccounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
          </select>
        </div>

        <div class="p-3 rounded-xl panel-surface border tabular-nums flex justify-between">
          <span>Projected Net Maturity:</span>
          <strong class="text-emerald-600 dark:text-emerald-400">
            {{ formatBDT(fdrPreviewMaturity, store.privacyMode) }}
          </strong>
        </div>
      </div>

      <template #footer>
        <button type="button" @click="showAddFdrModal = false" class="px-4 py-2 rounded-xl panel-surface border text-xs font-semibold">
          Cancel
        </button>
        <button type="button" @click="handleCreateFdr" class="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold">
          Save Deposit
        </button>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Banknote, Landmark, Pencil, PiggyBank, Plus, SlidersHorizontal, Trash2 } from 'lucide-vue-next';
import BaseModal from './BaseModal.vue';
import { useMoneyStore, getLocalTodayISO } from '../store';
import { calculateEarlyEncashment, calculateSanchaypatraProfit } from '../modules/sanchaypatra/calculator';
import { calculateDpsMaturity, calculateFdrMaturity } from '../modules/sanchaypatra/fdrDpsCalculator';
import type { SchemeDefinition } from '../modules/sanchaypatra/schemes';
import { formatBDT } from '../utils/format';
import type { SanchaypatraScheme } from '../types';

const store = useMoneyStore();

const bankAccounts = computed(() =>
  store.accounts.filter((a) => !a.archived && (a.type === 'bank' || a.type === 'cash'))
);

function getAccountName(id: string): string {
  return store.accounts.find((a) => a.id === id)?.name || 'Linked Account';
}

// Add Certificate
const showAddModal = ref(false);
const form = ref({
  schemeDefId: 'bd_5yr',
  registrationNo: '',
  principal: 1000000,
  issueDate: getLocalTodayISO(),
  linkedAccountId: store.accounts[0]?.id || '',
});

const previewResult = computed(() => {
  const def = store.customSchemeDefinitions.find((s) => s.id === form.value.schemeDefId);
  if (!def || form.value.principal <= 0) return null;
  return calculateSanchaypatraProfit(
    form.value.principal,
    def,
    store.totalSanchaypatraPrincipal + form.value.principal
  );
});

function handleSave() {
  if (!form.value.registrationNo.trim()) return;
  const def = store.customSchemeDefinitions.find((s) => s.id === form.value.schemeDefId);
  if (!def) return;
  store.addSanchaypatra({
    name: def.name,
    registrationNo: form.value.registrationNo,
    principal: form.value.principal,
    issueDate: form.value.issueDate,
    schemeDefId: form.value.schemeDefId,
    linkedAccountId: form.value.linkedAccountId,
  });
  showAddModal.value = false;
  form.value.registrationNo = '';
}

// Edit Certificate
const showEditSchemeModal = ref(false);
const editingScheme = ref<SanchaypatraScheme | null>(null);
const editSchemeForm = ref({
  registrationNo: '',
  principal: 0,
  netPeriodicProfit: 0,
  nextPayoutDate: '',
  linkedAccountId: '',
});

function openEditSchemeModal(scheme: SanchaypatraScheme) {
  editingScheme.value = scheme;
  editSchemeForm.value = {
    registrationNo: scheme.registrationNo,
    principal: scheme.principal,
    netPeriodicProfit: scheme.netPeriodicProfit,
    nextPayoutDate: scheme.nextPayoutDate,
    linkedAccountId: scheme.linkedAccountId,
  };
  showEditSchemeModal.value = true;
}

function handleSaveSchemeEdit() {
  if (!editingScheme.value) return;
  store.editSanchaypatra(editingScheme.value.id, { ...editSchemeForm.value });
  showEditSchemeModal.value = false;
}

// Early Encashment
const showEncashModal = ref(false);
const encashScheme = ref<SanchaypatraScheme | null>(null);
const encashDate = ref(getLocalTodayISO());
const encashAlreadyPaid = ref(0);

function openEncashmentModal(scheme: SanchaypatraScheme) {
  encashScheme.value = scheme;
  encashDate.value = getLocalTodayISO();
  encashAlreadyPaid.value = store.transactions
    .filter(
      (t) =>
        t.type === 'income' &&
        t.categoryId === 'sanchay_return' &&
        (t.note || '').includes(scheme.registrationNo)
    )
    .reduce((sum, t) => sum + t.amount, 0);
  showEncashModal.value = true;
}

const encashPreview = computed(() => {
  if (!encashScheme.value) return null;
  return calculateEarlyEncashment(encashScheme.value, encashDate.value, encashAlreadyPaid.value);
});

function executeEncashment() {
  if (!encashScheme.value) return;
  store.encashSanchaypatra(encashScheme.value.id, encashDate.value, encashAlreadyPaid.value);
  showEncashModal.value = false;
}

// Slab Rate Editor
const showSlabEditorModal = ref(false);
function updateSlabRate(def: SchemeDefinition, slabIndex: number, e: Event) {
  const pct = Number((e.target as HTMLInputElement).value || 0);
  if (pct <= 0) return;
  const updated: SchemeDefinition = {
    ...def,
    slabRates: def.slabRates.map((s, idx) =>
      idx === slabIndex ? { ...s, annualRate: Number((pct / 100).toFixed(4)) } : { ...s }
    ),
  };
  store.updateSchemeDefinition(updated);
}

// FDR / DPS Modal
const showAddFdrModal = ref(false);
const fdrForm = ref({
  kind: 'fdr' as 'fdr' | 'dps',
  bankName: '',
  accountNumber: '',
  principal: 200000,
  monthlyInstallment: 5000,
  annualRatePct: 9.0,
  aitPct: 10,
  tenureMonths: 12,
  startDate: getLocalTodayISO(),
  linkedAccountId: store.accounts[0]?.id || '',
});

const fdrPreviewMaturity = computed(() => {
  const rate = fdrForm.value.annualRatePct / 100;
  const ait = fdrForm.value.aitPct / 100;
  if (fdrForm.value.kind === 'fdr') {
    return calculateFdrMaturity({
      principalBDT: fdrForm.value.principal,
      annualRate: rate,
      tenureMonths: fdrForm.value.tenureMonths,
      aitRate: ait,
    }).netMaturityAmountBDT;
  }
  return calculateDpsMaturity({
    monthlyInstallmentBDT: fdrForm.value.monthlyInstallment,
    annualRate: rate,
    tenureMonths: fdrForm.value.tenureMonths,
    aitRate: ait,
  }).netMaturityAmountBDT;
});

function handleCreateFdr() {
  if (!fdrForm.value.bankName.trim()) return;
  store.addFdrDps({
    kind: fdrForm.value.kind,
    bankName: fdrForm.value.bankName,
    accountNumber: fdrForm.value.accountNumber,
    principal: fdrForm.value.kind === 'fdr' ? fdrForm.value.principal : fdrForm.value.monthlyInstallment,
    monthlyInstallment: fdrForm.value.kind === 'dps' ? fdrForm.value.monthlyInstallment : 0,
    annualRate: fdrForm.value.annualRatePct / 100,
    aitRate: fdrForm.value.aitPct / 100,
    tenureMonths: fdrForm.value.tenureMonths,
    startDate: fdrForm.value.startDate,
    linkedAccountId: fdrForm.value.linkedAccountId,
  });
  showAddFdrModal.value = false;
  fdrForm.value.bankName = '';
  fdrForm.value.accountNumber = '';
}
</script>
