<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
    @click.self="close"
  >
    <div
      class="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden my-auto transition-all"
    >
      <!-- Modal Header: Mode Tabs & Dismiss -->
      <div class="px-5 pt-4 pb-3 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900/95">
        <!-- Mode Tabs -->
        <div class="flex items-center gap-1.5 p-1 bg-slate-950 rounded-2xl border border-slate-800">
          <button
            type="button"
            @click="setTransactionType('expense')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
            :class="currentType === 'expense'
              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 ring-1 ring-rose-400/50'
              : 'text-slate-400 hover:text-slate-200'"
          >
            Expense
          </button>
          <button
            type="button"
            @click="setTransactionType('income')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
            :class="currentType === 'income'
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400/50'
              : 'text-slate-400 hover:text-slate-200'"
          >
            Income
          </button>
          <button
            type="button"
            @click="setTransactionType('transfer')"
            class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
            :class="currentType === 'transfer'
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25 ring-1 ring-sky-400/50'
              : 'text-slate-400 hover:text-slate-200'"
          >
            Transfer
          </button>
        </div>

        <!-- Close '✕' Button -->
        <button
          type="button"
          @click="close"
          class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm transition-all border border-slate-700/60"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <!-- Scrollable Main Content -->
      <div class="p-4 sm:p-5 space-y-3.5 max-h-[82vh] overflow-y-auto">
        <!-- Live Expression & Evaluated Amount Display Bar -->
        <div class="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-inner">
          <div class="flex items-center justify-between text-[11px] text-slate-400 mb-1 font-semibold">
            <span class="tracking-wider uppercase">Quick Math Expression</span>
            <span v-if="hasPendingOperator" class="text-amber-400 font-mono text-[10px]">
              typing...
            </span>
          </div>

          <div class="flex items-baseline justify-between gap-3">
            <!-- Typed Math Expression -->
            <div class="text-base sm:text-lg font-mono text-slate-300 truncate max-w-[55%]">
              {{ expression || '0' }}
            </div>

            <!-- Evaluated BDT Total -->
            <div
              class="text-2xl sm:text-3xl font-extrabold tracking-tight"
              :class="currentType === 'expense' ? 'text-rose-400' : currentType === 'income' ? 'text-emerald-400' : 'text-sky-400'"
            >
              {{ currentType === 'expense' ? '-' : currentType === 'income' ? '+' : '' }}৳{{ evaluatedAmount.toLocaleString('en-US') }}
            </div>
          </div>
        </div>

        <!-- High-Contrast Category Pills (When not Transfer) -->
        <div v-if="currentType !== 'transfer'" class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Category</label>
            <span class="text-[10px] text-slate-500">{{ availableCategories.length }} available</span>
          </div>
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              v-for="cat in availableCategories"
              :key="cat.id"
              type="button"
              @click="selectedCategoryId = cat.id"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border"
              :class="selectedCategoryId === cat.id
                ? 'bg-slate-800 text-white border-white/60 ring-2 ring-white/20 shadow-md'
                : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'"
            >
              <span
                class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                :style="{ backgroundColor: cat.color || '#94A3B8' }"
              ></span>
              {{ cat.name }}
            </button>
          </div>
        </div>

        <!-- Quick Payment Method / Account Chips -->
        <div class="space-y-2.5">
          <!-- Source Account Chips -->
          <div class="space-y-1.5">
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {{ currentType === 'transfer' ? 'From Source Account' : 'Payment Account' }}
            </label>
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              <button
                v-for="acc in accounts"
                :key="'src-' + acc.id"
                type="button"
                @click="selectSourceAccount(acc.id)"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border"
                :class="selectedAccountId === acc.id
                  ? 'bg-slate-800 text-white border-sky-400/80 ring-2 ring-sky-400/30 shadow-md'
                  : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'"
              >
                <span>{{ getAccountIcon(acc) }}</span>
                <span>{{ acc.name }}</span>
                <span class="text-[10px] text-slate-400 font-normal">৳{{ acc.balance.toLocaleString('en-US') }}</span>
              </button>
            </div>
          </div>

          <!-- Target Account Chips (Only when Transfer) -->
          <div v-if="currentType === 'transfer'" class="space-y-1.5">
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              To Destination Account
            </label>
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              <button
                v-for="acc in availableTargetAccounts"
                :key="'tgt-' + acc.id"
                type="button"
                @click="selectedTargetAccountId = acc.id"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border"
                :class="selectedTargetAccountId === acc.id
                  ? 'bg-slate-800 text-white border-emerald-400/80 ring-2 ring-emerald-400/30 shadow-md'
                  : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'"
              >
                <span>{{ getAccountIcon(acc) }}</span>
                <span>{{ acc.name }}</span>
                <span class="text-[10px] text-slate-400 font-normal">৳{{ acc.balance.toLocaleString('en-US') }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Date, Time, Payee/Description, and Note Inputs -->
        <div class="grid grid-cols-2 gap-2.5">
          <div>
            <label class="block text-[11px] font-semibold text-slate-300 mb-1">Date</label>
            <input
              v-model="txnDate"
              type="date"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
            />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-slate-300 mb-1">Time</label>
            <input
              v-model="txnTime"
              type="time"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-slate-600"
            />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-slate-300 mb-1">Payee / Description</label>
            <input
              v-model="txnDescription"
              placeholder="e.g. Unimart, Fuel, Salary"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
            />
          </div>
          <div>
            <label class="block text-[11px] font-semibold text-slate-300 mb-1">Note (Optional)</label>
            <input
              v-model="txnNote"
              placeholder="e.g. Weekly groceries"
              class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-600"
            />
          </div>
        </div>

        <!-- Tactile Calculator Keypad Grid -->
        <div class="pt-1">
          <div class="grid grid-cols-4 gap-2">
            <!-- Row 1 -->
            <button
              type="button"
              @click="handleClear"
              class="h-11 sm:h-12 rounded-xl font-bold text-base transition-all active:scale-[0.97] flex items-center justify-center select-none bg-slate-800/80 hover:bg-slate-700/80 text-rose-400 border border-rose-500/30 shadow-sm"
            >
              C
            </button>
            <button
              type="button"
              @click="appendOperator('/')"
              class="h-11 sm:h-12 rounded-xl font-bold text-lg transition-all active:scale-[0.97] flex items-center justify-center select-none bg-slate-800/90 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 shadow-sm"
            >
              ÷
            </button>
            <button
              type="button"
              @click="appendOperator('*')"
              class="h-11 sm:h-12 rounded-xl font-bold text-lg transition-all active:scale-[0.97] flex items-center justify-center select-none bg-slate-800/90 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 shadow-sm"
            >
              ×
            </button>
            <button
              type="button"
              @click="handleBackspace"
              class="h-11 sm:h-12 rounded-xl font-bold text-base transition-all active:scale-[0.97] flex items-center justify-center select-none bg-slate-800/80 hover:bg-slate-700/80 text-amber-400 border border-amber-500/30 shadow-sm"
            >
              ⌫
            </button>

            <!-- Row 2 -->
            <button
              type="button"
              @click="appendDigit('7')"
              class="h-11 sm:h-12 rounded-xl font-bold text-base transition-all active:scale-[0.97] flex items-center justify-center select-none bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/60 shadow-sm"
            >
              7
            </button>
            <button
              type="button"
              @click="appendDigit('8')"
              class="h-11 sm:h-12 rounded-xl font-bold text-base transition-all active:scale-[0.97] flex items-center justify-center select-none bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/60 shadow-sm"
            >
              8
            </button>
            <button
              type="button"
              @click="appendDigit('9')"
              class="h-11 sm:h-12 rounded-xl font-bold text-base transition-all active:scale-[0.97] flex items-center justify-center select-none bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/60 shadow-sm"
            >
              9
            </button>
            <button
              type="button"
              @click="appendOperator('-')"
              class="h-11 sm:h-12 rounded-xl font-bold text-lg transition-all active:scale-[0.97] flex items-center justify-center select-none bg-slate-800/90 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 shadow-sm"
            >
              −
            </button>

            <!-- Row 3 -->
            <button
              type="button"
              @click="appendDigit('4')"
              class="h-11 sm:h-12 rounded-xl font-bold text-base transition-all active:scale-[0.97] flex items-center justify-center select-none bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/60 shadow-sm"
            >
              4
            </button>
            <button
              type="button"
              @click="appendDigit('5')"
              class="h-11 sm:h-12 rounded-xl font-bold text-base transition-all active:scale-[0.97] flex items-center justify-center select-none bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/60 shadow-sm"
            >
              5
            </button>
            <button
              type="button"
              @click="appendDigit('6')"
              class="h-11 sm:h-12 rounded-xl font-bold text-base transition-all active:scale-[0.97] flex items-center justify-center select-none bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/60 shadow-sm"
            >
              6
            </button>
            <button
              type="button"
              @click="appendOperator('+')"
              class="h-11 sm:h-12 rounded-xl font-bold text-lg transition-all active:scale-[0.97] flex items-center justify-center select-none bg-slate-800/90 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 shadow-sm"
            >
              +
            </button>

            <!-- Row 4 -->
            <button
              type="button"
              @click="appendDigit('1')"
              class="h-11 sm:h-12 rounded-xl font-bold text-base transition-all active:scale-[0.97] flex items-center justify-center select-none bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/60 shadow-sm"
            >
              1
            </button>
            <button
              type="button"
              @click="appendDigit('2')"
              class="h-11 sm:h-12 rounded-xl font-bold text-base transition-all active:scale-[0.97] flex items-center justify-center select-none bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/60 shadow-sm"
            >
              2
            </button>
            <button
              type="button"
              @click="appendDigit('3')"
              class="h-11 sm:h-12 rounded-xl font-bold text-base transition-all active:scale-[0.97] flex items-center justify-center select-none bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/60 shadow-sm"
            >
              3
            </button>
            <button
              type="button"
              @click="handleEquals"
              class="h-11 sm:h-12 rounded-xl font-bold text-lg transition-all active:scale-[0.97] flex items-center justify-center select-none bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 border border-sky-500/40 shadow-sm"
            >
              =
            </button>

            <!-- Row 5 -->
            <button
              type="button"
              @click="appendDigit('0')"
              class="h-11 sm:h-12 rounded-xl font-bold text-base transition-all active:scale-[0.97] flex items-center justify-center select-none bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/60 shadow-sm"
            >
              0
            </button>
            <button
              type="button"
              @click="appendDot"
              class="h-11 sm:h-12 rounded-xl font-bold text-base transition-all active:scale-[0.97] flex items-center justify-center select-none bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/60 shadow-sm"
            >
              .
            </button>
            <button
              type="button"
              @click="handleSave"
              :disabled="evaluatedAmount <= 0"
              class="col-span-2 h-11 sm:h-12 rounded-xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              :class="saveBtnClass"
            >
              <span>✓ Save</span>
              <span class="text-xs font-semibold opacity-95">৳{{ evaluatedAmount.toLocaleString('en-US') }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { TransactionType, Category, Account } from '../types';

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
    initialType: 'expense'
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
      accountId: string;
      targetAccountId?: string;
      date: string;
      time: string;
      note: string;
      description: string;
    }
  ): void;
}>();

// Transaction Mode
const currentType = ref<TransactionType>('expense');

// Expression & Evaluator State
const expression = ref('0');

// Form Fields
const selectedCategoryId = ref('');
const selectedAccountId = ref('');
const selectedTargetAccountId = ref('');
const txnDate = ref(props.initialDate || new Date().toISOString().split('T')[0]);
const txnTime = ref(new Date().toTimeString().substring(0, 5));
const txnDescription = ref('');
const txnNote = ref('');

// Filtered Categories based on currentType
const availableCategories = computed(() => {
  if (currentType.value === 'transfer') return [];
  return props.categories.filter(c => c.type === currentType.value);
});

// Target Accounts for Transfer
const availableTargetAccounts = computed(() => {
  return props.accounts.filter(a => a.id !== selectedAccountId.value);
});

// Has Pending Operator Flag
const hasPendingOperator = computed(() => {
  return /[+\-−×÷]\s*$/.test(expression.value);
});

// Safe Evaluated Amount (NO eval())
const evaluatedAmount = computed(() => {
  return evaluateSafeMath(expression.value);
});

// Save Button Style based on currentType
const saveBtnClass = computed(() => {
  if (currentType.value === 'expense') {
    return 'bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white shadow-rose-500/25';
  }
  if (currentType.value === 'income') {
    return 'bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-emerald-500/25';
  }
  return 'bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white shadow-sky-500/25';
});

// Safe Arithmetic Evaluator
function evaluateSafeMath(expr: string): number {
  if (!expr || !expr.trim()) return 0;

  // Normalize operators to standard characters
  let clean = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');

  // Strip trailing operators and whitespace
  clean = clean.replace(/[+\-*/\s]+$/, '').trim();
  if (!clean) return 0;

  // Tokenize numbers and operators
  const rawTokens = clean.match(/(\d+\.?\d*|[+\-*/])/g);
  if (!rawTokens || rawTokens.length === 0) return 0;

  // Process unary minus / plus at start or right after another operator
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

  // Pass 1: Multiplication and Division
  const pass1: (number | string)[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const item = tokens[i];
    if (item === '*' || item === '/') {
      const prev = pass1.pop();
      const next = tokens[++i];
      if (typeof prev === 'number' && typeof next === 'number') {
        if (item === '*') {
          pass1.push(prev * next);
        } else {
          pass1.push(next !== 0 ? prev / next : 0);
        }
      } else if (typeof prev === 'number') {
        pass1.push(prev);
      }
    } else {
      pass1.push(item);
    }
  }

  // Pass 2: Addition and Subtraction
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

// Keypad Actions
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
  if (currentPart.includes('.')) {
    return;
  }
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

  if (!expression.value) {
    expression.value = '0';
  }
}

function handleClear() {
  expression.value = '0';
}

function handleEquals() {
  const result = evaluatedAmount.value;
  expression.value = String(result);
}

function setTransactionType(type: TransactionType) {
  currentType.value = type;
  if (type !== 'transfer') {
    const valid = props.categories.filter(c => c.type === type);
    if (valid.length > 0 && !valid.some(c => c.id === selectedCategoryId.value)) {
      selectedCategoryId.value = valid[0].id;
    }
  } else {
    if (selectedTargetAccountId.value === selectedAccountId.value) {
      const other = props.accounts.find(a => a.id !== selectedAccountId.value);
      if (other) selectedTargetAccountId.value = other.id;
    }
  }
}

function selectSourceAccount(accId: string) {
  selectedAccountId.value = accId;
  if (currentType.value === 'transfer' && selectedTargetAccountId.value === accId) {
    const other = props.accounts.find(a => a.id !== accId);
    if (other) selectedTargetAccountId.value = other.id;
  }
}

function getAccountIcon(acc: Account): string {
  if (acc.name.toLowerCase().includes('bkash')) return '📱';
  if (acc.name.toLowerCase().includes('nagad')) return '📱';
  if (acc.type === 'cash') return '💵';
  if (acc.type === 'bank') return '🏦';
  if (acc.type === 'credit_card') return '💳';
  if (acc.type === 'mfs') return '📱';
  return '💰';
}

function close() {
  emit('update:modelValue', false);
}

function handleSave() {
  const amount = evaluatedAmount.value;
  if (amount <= 0) return;

  emit('save', {
    amount,
    type: currentType.value,
    categoryId: currentType.value === 'transfer' ? '' : selectedCategoryId.value,
    accountId: selectedAccountId.value,
    targetAccountId: currentType.value === 'transfer' ? selectedTargetAccountId.value : undefined,
    date: txnDate.value,
    time: txnTime.value,
    note: txnNote.value.trim(),
    description: txnDescription.value.trim()
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

  const validCategories = props.categories.filter(c => c.type === currentType.value);
  if (validCategories.length > 0) {
    selectedCategoryId.value = validCategories[0].id;
  }

  if (props.accounts.length > 0 && !selectedAccountId.value) {
    selectedAccountId.value = props.accounts[0].id;
  }

  if (props.accounts.length > 1) {
    const other = props.accounts.find(a => a.id !== selectedAccountId.value);
    if (other) selectedTargetAccountId.value = other.id;
  }
}

watch(
  () => props.modelValue,
  isOpen => {
    if (isOpen) {
      resetForm();
    }
  }
);

watch(
  () => props.initialDate,
  newDate => {
    if (newDate) {
      txnDate.value = newDate;
    }
  }
);

// Keyboard accessibility support on Desktop
function onKeydown(e: KeyboardEvent) {
  if (!props.modelValue) return;

  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
    if (e.key === 'Escape') close();
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
  } else if (e.key === 'Escape') {
    close();
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