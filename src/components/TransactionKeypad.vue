<template>
  <BaseModal
    :modelValue="modelValue"
    @update:modelValue="emit('update:modelValue', $event)"
    title="Quick Log Transaction"
    subtitle="Realbyte rapid math keypad & instant category tagging"
    maxWidthClass="max-w-3xl"
  >
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <!-- Left Column: Type, Categories, Subcategories, Accounts & Metadata -->
      <div class="lg:col-span-7 space-y-3.5 min-w-0">
        <!-- Mode Tabs -->
        <div class="flex items-center gap-1.5 p-1 panel-surface rounded-2xl border">
          <button
            type="button"
            @click="setTransactionType('expense')"
            class="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-colors"
            :class="
              currentType === 'expense'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            "
          >
            Expense
          </button>
          <button
            type="button"
            @click="setTransactionType('income')"
            class="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-colors"
            :class="
              currentType === 'income'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            "
          >
            Income
          </button>
          <button
            type="button"
            @click="setTransactionType('transfer')"
            class="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-colors"
            :class="
              currentType === 'transfer'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            "
          >
            Transfer
          </button>
        </div>

        <!-- Category Pills -->
        <div v-if="currentType !== 'transfer'" class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Category
            </label>
            <span class="text-[10px] text-slate-500 tabular-nums">
              {{ availableCategories.length }} available
            </span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="cat in availableCategories"
              :key="cat.id"
              type="button"
              @click="selectCategory(cat)"
              class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors border"
              :class="
                selectedCategoryId === cat.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-sm'
                  : 'panel-surface text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600'
              "
            >
              <span
                class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                :style="{ backgroundColor: cat.color || '#94A3B8' }"
              ></span>
              {{ cat.name }}
            </button>
          </div>
        </div>

        <!-- Subcategory Chips (if any) -->
        <div v-if="currentType !== 'transfer' && activeSubcategories.length > 0" class="space-y-1.5">
          <label class="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Subcategory (Optional)
          </label>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="sub in activeSubcategories"
              :key="sub"
              type="button"
              @click="selectedSubcategoryId = selectedSubcategoryId === sub ? '' : sub"
              class="px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors"
              :class="
                selectedSubcategoryId === sub
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'panel-surface text-slate-600 dark:text-slate-300'
              "
            >
              {{ sub }}
            </button>
          </div>
        </div>

        <!-- Source Account Chips -->
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {{ currentType === 'transfer' ? 'From Source Account' : 'Payment Account' }}
          </label>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="acc in activeAccounts"
              :key="'src-' + acc.id"
              type="button"
              @click="selectSourceAccount(acc.id)"
              class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors border"
              :class="
                selectedAccountId === acc.id
                  ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                  : 'panel-surface text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600'
              "
            >
              <component :is="getAccountLucideIcon(acc)" class="w-3.5 h-3.5 flex-shrink-0" />
              <span>{{ acc.name }}</span>
              <span class="text-[10px] opacity-80 tabular-nums">
                {{ formatBDT(acc.balance, store.privacyMode) }}
              </span>
            </button>
          </div>
        </div>

        <!-- Destination Account Chips (Transfer) -->
        <div v-if="currentType === 'transfer'" class="space-y-1.5">
          <label class="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            To Destination Account
          </label>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="acc in availableTargetAccounts"
              :key="'tgt-' + acc.id"
              type="button"
              @click="selectedTargetAccountId = acc.id"
              class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors border"
              :class="
                selectedTargetAccountId === acc.id
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'panel-surface text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600'
              "
            >
              <component :is="getAccountLucideIcon(acc)" class="w-3.5 h-3.5 flex-shrink-0" />
              <span>{{ acc.name }}</span>
              <span class="text-[10px] opacity-80 tabular-nums">
                {{ formatBDT(acc.balance, store.privacyMode) }}
              </span>
            </button>
          </div>
        </div>

        <!-- Date, Time, Payee & Note -->
        <div class="grid grid-cols-2 gap-2.5">
          <div>
            <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Date</label>
            <input
              v-model="txnDate"
              type="date"
              class="w-full input-surface border rounded-xl px-3 py-2 text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/40"
            />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">Time</label>
            <input
              v-model="txnTime"
              type="time"
              class="w-full input-surface border rounded-xl px-3 py-2 text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/40"
            />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Payee / Description
            </label>
            <input
              v-model="txnDescription"
              placeholder="e.g. Unimart, Fuel, Salary"
              class="w-full input-surface border rounded-xl px-3 py-2 text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/40"
            />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Note (Optional)
            </label>
            <input
              v-model="txnNote"
              placeholder="e.g. Weekly groceries"
              class="w-full input-surface border rounded-xl px-3 py-2 text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/40"
            />
          </div>
        </div>

        <!-- Optional Multi-Currency Conversion -->
        <div
          v-if="store.featureFlags.enableMultiCurrency && currentType !== 'transfer'"
          class="p-3 rounded-2xl panel-surface border space-y-2"
        >
          <div class="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span class="flex items-center gap-1.5">
              <Globe class="w-3.5 h-3.5" /> Multi-Currency Entry
            </span>
            <span v-if="fxCurrency !== 'BDT'" class="text-sky-600 dark:text-sky-400 tabular-nums">
              1 {{ fxCurrency }} = ৳{{ currentFxRate }}
            </span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <select
              v-model="fxCurrency"
              @change="applyFxConversion"
              class="input-surface border rounded-xl px-2.5 py-1.5 text-xs font-semibold"
            >
              <option v-for="code in Object.keys(store.exchangeRates)" :key="code" :value="code">
                {{ code }}
              </option>
            </select>
            <input
              v-if="fxCurrency !== 'BDT'"
              v-model.number="fxOriginalAmount"
              type="number"
              min="0"
              step="0.01"
              @input="applyFxConversion"
              placeholder="Foreign amt"
              class="input-surface border rounded-xl px-2.5 py-1.5 text-xs font-bold tabular-nums"
            />
            <div
              v-if="fxCurrency !== 'BDT'"
              class="flex items-center justify-end text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums"
            >
              = ৳{{ roundTaka(fxOriginalAmount * currentFxRate).toLocaleString('en-US') }}
            </div>
          </div>
        </div>

        <!-- Optional Local Receipt Attachment -->
        <div
          v-if="store.featureFlags.enableReceipts"
          class="flex items-center justify-between gap-2 p-2.5 rounded-xl panel-surface border text-xs"
        >
          <div class="flex items-center gap-2 min-w-0">
            <Paperclip class="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            <span class="truncate text-slate-600 dark:text-slate-300">
              {{ receiptLabel || 'No receipt attached' }}
            </span>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              @click="pickReceipt"
              class="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold"
            >
              Attach
            </button>
            <button
              v-if="receiptPath"
              type="button"
              @click="clearReceipt"
              class="px-2 py-1 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold"
            >
              Clear
            </button>
          </div>
          <input ref="receiptInputRef" type="file" accept="image/*,.pdf" class="hidden" @change="onReceiptFileChange" />
        </div>
      </div>

      <!-- Right Column: Math Display & Keypad -->
      <div class="lg:col-span-5 flex flex-col justify-between space-y-3">
        <!-- Expression & Whole-Taka Result Display -->
        <div class="panel-surface border rounded-2xl p-4 shadow-inner">
          <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1 font-semibold">
            <span class="tracking-wider uppercase">Quick Math (Whole Taka)</span>
            <span v-if="hasPendingOperator" class="text-amber-600 dark:text-amber-400 font-mono text-[10px]">
              typing...
            </span>
          </div>

          <div class="flex items-baseline justify-between gap-3">
            <div class="text-sm sm:text-base font-mono text-slate-600 dark:text-slate-300 truncate max-w-[48%] tabular-nums">
              {{ expression || '0' }}
            </div>
            <div
              class="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums"
              :class="
                currentType === 'expense'
                  ? 'text-rose-600 dark:text-rose-400'
                  : currentType === 'income'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-sky-600 dark:text-sky-400'
              "
            >
              {{ currentType === 'expense' ? '-' : currentType === 'income' ? '+' : '' }}৳{{ evaluatedAmount.toLocaleString('en-US') }}
            </div>
          </div>
        </div>

        <!-- Calculator Grid -->
        <div class="grid grid-cols-4 gap-2">
          <button
            type="button"
            @click="handleClear"
            class="h-11 rounded-xl font-bold text-sm transition-transform active:scale-95 bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20"
          >
            C
          </button>
          <button
            type="button"
            @click="appendOperator('/')"
            class="h-11 rounded-xl font-bold text-lg transition-transform active:scale-95 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
          >
            ÷
          </button>
          <button
            type="button"
            @click="appendOperator('*')"
            class="h-11 rounded-xl font-bold text-lg transition-transform active:scale-95 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
          >
            ×
          </button>
          <button
            type="button"
            @click="handleBackspace"
            aria-label="Backspace"
            class="h-11 rounded-xl font-bold text-base transition-transform active:scale-95 flex items-center justify-center bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
          >
            <Delete class="w-4 h-4" />
          </button>

          <button
            v-for="d in ['7', '8', '9']"
            :key="d"
            type="button"
            @click="appendDigit(d)"
            class="h-11 rounded-xl font-bold text-base transition-transform active:scale-95 panel-surface border hover:bg-slate-200 dark:hover:bg-slate-800 tabular-nums"
          >
            {{ d }}
          </button>
          <button
            type="button"
            @click="appendOperator('-')"
            class="h-11 rounded-xl font-bold text-lg transition-transform active:scale-95 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
          >
            −
          </button>

          <button
            v-for="d in ['4', '5', '6']"
            :key="d"
            type="button"
            @click="appendDigit(d)"
            class="h-11 rounded-xl font-bold text-base transition-transform active:scale-95 panel-surface border hover:bg-slate-200 dark:hover:bg-slate-800 tabular-nums"
          >
            {{ d }}
          </button>
          <button
            type="button"
            @click="appendOperator('+')"
            class="h-11 rounded-xl font-bold text-lg transition-transform active:scale-95 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
          >
            +
          </button>

          <button
            v-for="d in ['1', '2', '3']"
            :key="d"
            type="button"
            @click="appendDigit(d)"
            class="h-11 rounded-xl font-bold text-base transition-transform active:scale-95 panel-surface border hover:bg-slate-200 dark:hover:bg-slate-800 tabular-nums"
          >
            {{ d }}
          </button>
          <button
            type="button"
            @click="handleEquals"
            class="h-11 rounded-xl font-bold text-lg transition-transform active:scale-95 bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 hover:bg-sky-500/25"
          >
            =
          </button>

          <button
            type="button"
            @click="appendDigit('0')"
            class="h-11 rounded-xl font-bold text-base transition-transform active:scale-95 panel-surface border hover:bg-slate-200 dark:hover:bg-slate-800 tabular-nums"
          >
            0
          </button>
          <button
            type="button"
            @click="appendDot"
            class="h-11 rounded-xl font-bold text-base transition-transform active:scale-95 panel-surface border hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            .
          </button>
          <button
            type="button"
            @click="handleSave"
            :disabled="evaluatedAmount <= 0"
            class="col-span-2 h-11 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-1.5 transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            :class="saveBtnClass"
          >
            <Check class="w-4 h-4" />
            <span>Save</span>
            <span class="text-xs font-semibold opacity-95 tabular-nums">
              ৳{{ evaluatedAmount.toLocaleString('en-US') }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Banknote, Check, CreditCard, Delete, Globe, Landmark, Paperclip, Smartphone, Wallet } from 'lucide-vue-next';
import BaseModal from './BaseModal.vue';
import { useMoneyStore } from '../store';
import { roundTaka } from '../modules/accounts/transferEngine';
import { formatBDT } from '../utils/format';
import type { TransactionType, Category, Account } from '../types';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    initialDate?: string;
    initialType?: TransactionType;
    categories: Category[];
    accounts: Account[];
  }>(),
  {
    initialDate: '',
    initialType: 'expense',
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (
    e: 'save',
    payload: {
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
    }
  ): void;
}>();

const store = useMoneyStore();

const currentType = ref<TransactionType>('expense');
const expression = ref('0');
const selectedCategoryId = ref('');
const selectedSubcategoryId = ref('');
const selectedAccountId = ref('');
const selectedTargetAccountId = ref('');
const txnDate = ref(props.initialDate || new Date().toISOString().split('T')[0]);
const txnTime = ref(new Date().toTimeString().substring(0, 5));
const txnDescription = ref('');
const txnNote = ref('');

// Multi-currency & receipt state
const fxCurrency = ref('BDT');
const fxOriginalAmount = ref(0);
const receiptPath = ref('');
const receiptLabel = ref('');
const receiptInputRef = ref<HTMLInputElement | null>(null);

const currentFxRate = computed(() => store.exchangeRates[fxCurrency.value] || 1);

const activeAccounts = computed(() => props.accounts.filter((a) => !a.archived));

const availableCategories = computed(() => {
  if (currentType.value === 'transfer') return [];
  return props.categories.filter((c) => c.type === currentType.value);
});

const activeSubcategories = computed(() => {
  const cat = props.categories.find((c) => c.id === selectedCategoryId.value);
  return cat?.subcategories || [];
});

const availableTargetAccounts = computed(() => {
  return activeAccounts.value.filter((a) => a.id !== selectedAccountId.value);
});

const hasPendingOperator = computed(() => /[+\-−×÷]\s*$/.test(expression.value));

const evaluatedAmount = computed(() => roundTaka(evaluateSafeMath(expression.value)));

const saveBtnClass = computed(() => {
  if (currentType.value === 'expense') return 'bg-rose-600 hover:bg-rose-500 text-white';
  if (currentType.value === 'income') return 'bg-emerald-600 hover:bg-emerald-500 text-white';
  return 'bg-sky-600 hover:bg-sky-500 text-white';
});

function applyFxConversion() {
  if (fxCurrency.value === 'BDT') return;
  const converted = roundTaka(Number(fxOriginalAmount.value || 0) * currentFxRate.value);
  expression.value = String(converted);
}

async function pickReceipt() {
  const fsApi = typeof window !== 'undefined' ? window.moneyApi?.fs : undefined;
  if (fsApi?.pickFile) {
    const picked = await fsApi.pickFile({
      title: 'Attach Receipt Image or PDF',
      filters: [{ name: 'Receipts', extensions: ['png', 'jpg', 'jpeg', 'webp', 'pdf'] }],
    });
    if (!picked.canceled && picked.filePath) {
      receiptPath.value = picked.filePath;
      receiptLabel.value = picked.fileName || picked.filePath;
    }
    return;
  }
  receiptInputRef.value?.click();
}

async function onReceiptFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  receiptLabel.value = file.name;
  const fsApi = typeof window !== 'undefined' ? window.moneyApi?.fs : undefined;
  if (fsApi?.saveReceipt) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const saved = await fsApi.saveReceipt({ originalName: file.name, bytes: Array.from(buf) });
    receiptPath.value = saved.filePath;
  } else {
    receiptPath.value = `local-file://${file.name}`;
  }
}

function clearReceipt() {
  receiptPath.value = '';
  receiptLabel.value = '';
}

function evaluateSafeMath(expr: string): number {
  if (!expr || !expr.trim()) return 0;
  let clean = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  clean = clean.replace(/[+\-*/\s]+$/, '').trim();
  if (!clean) return 0;

  const rawTokens = clean.match(/(\d+\.?\d*|[+\-*/])/g);
  if (!rawTokens || rawTokens.length === 0) return 0;

  const tokens: (number | string)[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const t = rawTokens[i];
    if (t === '-' && (i === 0 || ['+', '-', '*', '/'].includes(rawTokens[i - 1]))) {
      const next = rawTokens[++i];
      if (next !== undefined && !['+', '-', '*', '/'].includes(next)) {
        tokens.push(-parseFloat(next));
      }
    } else if (['+', '-', '*', '/'].includes(t)) {
      tokens.push(t);
    } else {
      tokens.push(parseFloat(t));
    }
  }

  if (tokens.length === 0) return 0;

  const pass1: (number | string)[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const item = tokens[i];
    if (item === '*' || item === '/') {
      const prev = pass1.pop();
      const next = tokens[++i];
      if (typeof prev === 'number' && typeof next === 'number') {
        pass1.push(item === '*' ? prev * next : next !== 0 ? prev / next : 0);
      } else if (typeof prev === 'number') {
        pass1.push(prev);
      }
    } else {
      pass1.push(item);
    }
  }

  if (pass1.length === 0) return 0;
  let total = typeof pass1[0] === 'number' ? pass1[0] : 0;
  for (let i = 1; i < pass1.length; i += 2) {
    const op = pass1[i];
    const next = pass1[i + 1];
    if (typeof next === 'number') {
      if (op === '+') total += next;
      else if (op === '-') total -= next;
    }
  }

  if (!isFinite(total) || isNaN(total)) return 0;
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

function appendDigit(digit: string) {
  if (expression.value === '0') {
    expression.value = digit;
  } else if (expression.value === '−0') {
    expression.value = '−' + digit;
  } else {
    expression.value += digit;
  }
}

function appendDot() {
  const parts = expression.value.split(/[+\-−×÷]/);
  const currentPart = parts[parts.length - 1].trim();
  if (currentPart.includes('.')) return;
  if (!currentPart || expression.value.endsWith(' ')) {
    expression.value += '0.';
  } else {
    expression.value += '.';
  }
}

function appendOperator(op: string) {
  const displayOp = op === '*' ? '×' : op === '/' ? '÷' : op === '-' ? '−' : '+';
  if (!expression.value || expression.value === '0') {
    if (op === '-') {
      expression.value = '−';
      return;
    }
    expression.value = '0 ' + displayOp + ' ';
    return;
  }
  if (/[+\-−×÷]\s*$/.test(expression.value)) {
    expression.value = expression.value.replace(/[+\-−×÷]\s*$/, displayOp + ' ');
  } else {
    expression.value += ' ' + displayOp + ' ';
  }
}

function handleBackspace() {
  if (!expression.value || expression.value === '0') {
    expression.value = '0';
    return;
  }
  if (/\s[+\-−×÷]\s$/.test(expression.value)) {
    expression.value = expression.value.slice(0, -3);
  } else {
    expression.value = expression.value.slice(0, -1).trimEnd();
  }
  if (!expression.value) expression.value = '0';
}

function handleClear() {
  expression.value = '0';
}

function handleEquals() {
  expression.value = String(evaluatedAmount.value);
}

function selectCategory(cat: Category) {
  selectedCategoryId.value = cat.id;
  selectedSubcategoryId.value = '';
}

function setTransactionType(type: TransactionType) {
  currentType.value = type;
  selectedSubcategoryId.value = '';
  if (type !== 'transfer') {
    const valid = props.categories.filter((c) => c.type === type);
    if (valid.length > 0 && !valid.some((c) => c.id === selectedCategoryId.value)) {
      selectedCategoryId.value = valid[0].id;
    }
  } else if (selectedTargetAccountId.value === selectedAccountId.value) {
    const other = activeAccounts.value.find((a) => a.id !== selectedAccountId.value);
    if (other) selectedTargetAccountId.value = other.id;
  }
}

function selectSourceAccount(accId: string) {
  selectedAccountId.value = accId;
  if (currentType.value === 'transfer' && selectedTargetAccountId.value === accId) {
    const other = activeAccounts.value.find((a) => a.id !== accId);
    if (other) selectedTargetAccountId.value = other.id;
  }
}

function getAccountLucideIcon(acc: Account) {
  if (acc.type === 'mfs') return Smartphone;
  if (acc.type === 'cash') return Banknote;
  if (acc.type === 'bank') return Landmark;
  if (acc.type === 'credit_card') return CreditCard;
  return Wallet;
}

function handleSave() {
  const amount = roundTaka(evaluatedAmount.value);
  if (amount <= 0) return;

  emit('save', {
    amount,
    type: currentType.value,
    categoryId: currentType.value === 'transfer' ? 'transfer' : selectedCategoryId.value,
    subcategoryId: selectedSubcategoryId.value || undefined,
    accountId: selectedAccountId.value,
    targetAccountId: currentType.value === 'transfer' ? selectedTargetAccountId.value : undefined,
    date: txnDate.value,
    time: txnTime.value,
    note: txnNote.value.trim(),
    description: txnDescription.value.trim(),
    currency: fxCurrency.value !== 'BDT' ? fxCurrency.value : 'BDT',
    originalAmount: fxCurrency.value !== 'BDT' ? fxOriginalAmount.value : undefined,
    exchangeRate: fxCurrency.value !== 'BDT' ? currentFxRate.value : undefined,
    receiptPath: receiptPath.value || undefined,
  });

  emit('update:modelValue', false);
}

function resetForm() {
  currentType.value = props.initialType || 'expense';
  expression.value = '0';
  txnDate.value = props.initialDate || new Date().toISOString().split('T')[0];
  txnTime.value = new Date().toTimeString().substring(0, 5);
  txnDescription.value = '';
  txnNote.value = '';
  selectedSubcategoryId.value = '';
  fxCurrency.value = 'BDT';
  fxOriginalAmount.value = 0;
  receiptPath.value = '';
  receiptLabel.value = '';

  const validCategories = props.categories.filter((c) => c.type === currentType.value);
  if (validCategories.length > 0) {
    selectedCategoryId.value = validCategories[0].id;
  }

  if (activeAccounts.value.length > 0 && !activeAccounts.value.some((a) => a.id === selectedAccountId.value)) {
    selectedAccountId.value = activeAccounts.value[0].id;
  }

  if (activeAccounts.value.length > 1) {
    const other = activeAccounts.value.find((a) => a.id !== selectedAccountId.value);
    if (other) selectedTargetAccountId.value = other.id;
  }
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) resetForm();
  }
);

watch(
  () => props.initialDate,
  (newDate) => {
    if (newDate) txnDate.value = newDate;
  }
);

function onKeydown(e: KeyboardEvent) {
  if (!props.modelValue) return;
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
    return;
  }

  if (e.key >= '0' && e.key <= '9') {
    appendDigit(e.key);
    e.preventDefault();
  } else if (e.key === '.') {
    appendDot();
    e.preventDefault();
  } else if (e.key === '+') {
    appendOperator('+');
    e.preventDefault();
  } else if (e.key === '-') {
    appendOperator('-');
    e.preventDefault();
  } else if (e.key === '*' || e.key === 'x' || e.key === 'X') {
    appendOperator('*');
    e.preventDefault();
  } else if (e.key === '/') {
    appendOperator('/');
    e.preventDefault();
  } else if (e.key === 'Backspace') {
    handleBackspace();
    e.preventDefault();
  } else if (e.key === '=') {
    handleEquals();
    e.preventDefault();
  } else if (e.key === 'Enter') {
    handleSave();
    e.preventDefault();
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  resetForm();
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>
