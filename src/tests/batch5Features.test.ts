import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMoneyStore } from '../store';
import { encryptVaultJson, decryptVaultJson, isEncryptedVaultPayload } from '../modules/exporters/vaultCrypto';
import { calculateEarlyEncashment } from '../modules/sanchaypatra/calculator';
import { calculateFdrMaturity, calculateDpsMaturity } from '../modules/sanchaypatra/fdrDpsCalculator';
import { computeMonthlyTrend, computeNetWorthTrend } from '../modules/statistics/analytics';

describe('Batch 5 Power Modules, Reconciliation, FDR/DPS & Encrypted Vaults', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    let storage: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => {
        storage[key] = val;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        storage = {};
      },
      length: 0,
      key: () => null,
    } as Storage;
  });

  it('encrypts and decrypts JSON vaults using AES-256-GCM and rejects wrong passphrases', async () => {
    const store = useMoneyStore();
    const plain = store.fullBackupJson;
    const encrypted = await encryptVaultJson(plain, 'Strong-BD-Pass-2026');
    const parsed = JSON.parse(encrypted);

    expect(isEncryptedVaultPayload(parsed)).toBe(true);
    expect(parsed.cipher).toBe('AES-256-GCM');

    const decrypted = await decryptVaultJson(encrypted, 'Strong-BD-Pass-2026');
    expect(JSON.parse(decrypted).schema).toBe('money-manager-vault-v1');

    await expect(decryptVaultJson(encrypted, 'WrongPass')).rejects.toThrow('Incorrect passphrase');
  });

  it('reconciles asset and credit card liability account balances in whole Taka', () => {
    const store = useMoneyStore();

    // Asset account: City Bank starts at 68,000 -> reconcile to 70,500 (+2,500 income)
    store.reconcileAccountBalance('city_bank', 70500, 'Statement sync');
    expect(store.accounts.find((a) => a.id === 'city_bank')!.balance).toBe(70500);
    expect(store.transactions[0].type).toBe('income');
    expect(store.transactions[0].amount).toBe(2500);

    // Asset account: City Bank down to 65,000 (-5,500 expense)
    store.reconcileAccountBalance('city_bank', 65000);
    expect(store.accounts.find((a) => a.id === 'city_bank')!.balance).toBe(65000);
    expect(store.transactions[0].type).toBe('expense');
    expect(store.transactions[0].amount).toBe(5500);

    // Credit card liability: City Amex starts at 18,500 owed -> reconcile to 20,000 owed
    store.reconcileAccountBalance('city_amex', 20000);
    expect(store.accounts.find((a) => a.id === 'city_amex')!.balance).toBe(20000);
    expect(store.transactions[0].type).toBe('expense');
    expect(store.transactions[0].amount).toBe(1500);

    // Credit card liability reduced to 15,000 owed
    store.reconcileAccountBalance('city_amex', 15000);
    expect(store.accounts.find((a) => a.id === 'city_amex')!.balance).toBe(15000);
    expect(store.transactions[0].type).toBe('income');
    expect(store.transactions[0].amount).toBe(5000);
  });

  it('computes Sanchaypatra early encashment, custom slab rates, and FDR/DPS maturity', () => {
    const store = useMoneyStore();
    const scheme = store.sanchaypatraSchemes[0]; // 1,000,000 issued 2025-06-15

    const preview = calculateEarlyEncashment(scheme, '2027-07-01', 50760);
    expect(preview.completedYears).toBe(2);
    expect(preview.effectiveEarlyRate).toBeGreaterThan(0);
    expect(preview.effectiveEarlyRate).toBeLessThan(scheme.slabGrossRate);
    expect(Number.isInteger(preview.netSettlementPayoutBDT)).toBe(true);

    const beforeBank = store.accounts.find((a) => a.id === scheme.linkedAccountId)!.balance;
    const settlement = store.encashSanchaypatra(scheme.id, '2027-07-01', 50760)!;
    expect(scheme.status).toBe('encashed');
    expect(store.accounts.find((a) => a.id === scheme.linkedAccountId)!.balance).toBe(
      beforeBank + settlement.netSettlementPayoutBDT
    );

    // FDR & DPS whole-Taka math
    const fdr = calculateFdrMaturity({ principalBDT: 500000, annualRate: 0.09, tenureMonths: 12, aitRate: 0.10 });
    expect(fdr.netProfitBDT).toBeGreaterThan(0);
    expect(fdr.netMaturityAmountBDT).toBe(500000 + fdr.netProfitBDT);

    const dps = calculateDpsMaturity({ monthlyInstallmentBDT: 5000, annualRate: 0.085, tenureMonths: 36, aitRate: 0.10 });
    expect(dps.totalDepositedBDT).toBe(180000);
    expect(dps.netMaturityAmountBDT).toBeGreaterThan(180000);

    // Store FDR/DPS installment logging
    const prevNetWorth = store.totalNetWorth;
    store.addFdrDps({
      kind: 'dps',
      bankName: 'BRAC Bank',
      accountNumber: 'DPS-101',
      principal: 5000,
      monthlyInstallment: 5000,
      annualRate: 0.085,
      aitRate: 0.10,
      tenureMonths: 24,
      startDate: '2026-11-01',
      linkedAccountId: 'city_bank',
    });
    expect(store.totalFdrDpsPrincipal).toBe(5000);
    expect(store.totalNetWorth).toBe(prevNetWorth + 5000);

    const dpsId = store.fdrDpsAccounts[0].id;
    store.logDpsInstallment(dpsId, '2026-11-19');
    expect(store.fdrDpsAccounts[0].paidInstallments).toBe(2);
    expect(store.fdrDpsAccounts[0].principal).toBe(10000);
  });

  it('computes trailing cashflow and net worth trends cleanly', () => {
    const store = useMoneyStore();
    const monthly = computeMonthlyTrend(store.transactions, 2026, 11, 6);
    expect(monthly).toHaveLength(6);
    expect(monthly[5].monthKey).toBe('2026-11');
    expect(monthly[5].income).toBeGreaterThan(0);

    const nwTrend = computeNetWorthTrend(store.totalNetWorth, store.transactions, 2026, 11, 6);
    expect(nwTrend).toHaveLength(6);
    expect(nwTrend[5].netWorth).toBe(store.totalNetWorth);
  });

  it('supports Savings Goals, Credit Card EMIs, IOU Khata settlements, bulk ops, and multi-currency', () => {
    const store = useMoneyStore();

    // Savings Goal
    store.addSavingsGoal({
      name: 'Emergency Fund',
      targetAmount: 50000,
      currentAmount: 20000,
      targetDate: '2027-06-01',
      linkedAccountId: 'city_bank',
    });
    const goalId = store.savingsGoals[0].id;
    store.contributeToSavingsGoal(goalId, 30000, false);
    expect(store.savingsGoals[0].status).toBe('completed');

    // Credit Card EMI
    store.addCreditCardEmi({
      accountId: 'city_amex',
      title: 'Phone 6M EMI',
      totalAmount: 60000,
      tenureMonths: 6,
      startDate: '2026-11-01',
    });
    const emiId = store.creditCardEmis[0].id;
    const beforeDebt = store.accounts.find((a) => a.id === 'city_amex')!.balance;
    store.logEmiInstallment(emiId, '2026-11-19');
    expect(store.creditCardEmis[0].paidMonths).toBe(1);
    expect(store.accounts.find((a) => a.id === 'city_amex')!.balance).toBe(beforeDebt + 10000);

    // IOU Khata
    store.addIouRecord({
      personName: 'Rafi',
      direction: 'lent',
      principal: 8000,
      date: '2026-11-10',
      accountId: 'bkash',
    });
    const iouId = store.iouRecords[0].id;
    const beforeBkash = store.accounts.find((a) => a.id === 'bkash')!.balance;
    store.settleIouRecord(iouId, 3000, 'bkash', '2026-11-19');
    expect(store.iouRecords[0].status).toBe('open');
    expect(store.accounts.find((a) => a.id === 'bkash')!.balance).toBe(beforeBkash + 3000);
    store.settleIouRecord(iouId, 5000, 'bkash', '2026-11-20');
    expect(store.iouRecords[0].status).toBe('settled');

    // Multi-currency transaction conversion -> whole Taka
    store.addTransaction({
      date: '2026-11-19',
      amount: 0,
      currency: 'USD',
      originalAmount: 10,
      exchangeRate: 120,
      type: 'expense',
      categoryId: 'utilities',
      accountId: 'city_bank',
      note: 'Cloud hosting',
    });
    expect(store.transactions[0].amount).toBe(1200);

    // Bulk recategorize + bulk delete
    const targetIds = [store.transactions[0].id];
    expect(store.bulkRecategorizeTransactions(targetIds, 'groceries')).toBe(1);
    expect(store.transactions[0].categoryId).toBe('groceries');
    expect(store.bulkDeleteTransactions(targetIds)).toBe(1);

    // Preset switch resets hidden active tab
    store.activeTab = 'sanchaypatra';
    store.applyFeaturePreset('realbyte_minimal');
    expect(store.activeTab).toBe('daily');
  });
});
