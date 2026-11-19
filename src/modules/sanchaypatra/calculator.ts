import type { SchemeDefinition } from './schemes';
import type { EarlyEncashmentResult, SanchaypatraScheme } from '../../types';
import { advanceDueDate } from '../transactions/recurringAndSplit';

export interface SanchaypatraCalculationResult {
  principalBDT: number;
  grossAnnualProfitBDT: number;
  effectiveAnnualRate: number;
  aitRate: number;
  annualAitTaxBDT: number;
  netAnnualProfitBDT: number;
  payoutIntervalMonths: number;
  installmentsPerYear: number;
  grossPeriodicPayoutBDT: number;
  periodicAitTaxBDT: number;
  netPeriodicPayoutBDT: number;
}

/**
 * Calculates tiered slab profit and Advance Income Tax (AIT) withholding for Sanchaypatra.
 * In Bangladesh:
 * - Slabs: Tiered interest rates apply per cumulative principal bracket (up to 1.5M, 1.5M-3M, 3M+).
 *   Existing holdings offset the starting slab position (Fixes C5).
 * - AIT: 5% tax if total cumulative investment <= BDT 500,000; 10% tax if > BDT 500,000.
 * - Amounts are rounded to whole Taka (BDT integer).
 */
export function calculateSanchaypatraProfit(
  principalBDT: number,
  scheme: SchemeDefinition,
  totalSanchaypatraHoldingsBDT: number = principalBDT
): SanchaypatraCalculationResult {
  if (principalBDT <= 0) {
    throw new Error('Principal must be greater than zero.');
  }

  // 1. Calculate tiered gross annual profit across slabs taking existing holdings into account (Fixes C5)
  const existingHoldingsBDT = Math.max(0, totalSanchaypatraHoldingsBDT - principalBDT);
  let remainingPrincipal = principalBDT;
  let cursor = existingHoldingsBDT;
  let totalGrossAnnualProfit = 0;

  for (const slab of scheme.slabRates) {
    if (remainingPrincipal <= 0) break;

    if (cursor >= slab.maxPrincipalBDT) {
      continue;
    }

    const availableInThisSlab = slab.maxPrincipalBDT - cursor;
    const applicableAmountInThisSlab = Math.min(remainingPrincipal, availableInThisSlab);

    totalGrossAnnualProfit += applicableAmountInThisSlab * slab.annualRate;
    remainingPrincipal -= applicableAmountInThisSlab;
    cursor += applicableAmountInThisSlab;
  }

  const effectiveAnnualRate = totalGrossAnnualProfit / principalBDT;

  // 2. Determine Advance Income Tax (AIT) rate
  // Government rule: 5% tax if cumulative holdings <= 500,000 BDT, otherwise 10%
  const aitRate = totalSanchaypatraHoldingsBDT <= 500000 ? 0.05 : 0.10;
  const annualAitTaxBDT = totalGrossAnnualProfit * aitRate;
  const netAnnualProfitBDT = totalGrossAnnualProfit - annualAitTaxBDT;

  // 3. Periodic installment breakdown (rounded to whole Taka)
  const installmentsPerYear = 12 / scheme.payoutIntervalMonths;
  const grossPeriodicPayoutBDT = Math.round(totalGrossAnnualProfit / installmentsPerYear);
  const periodicAitTaxBDT = Math.round(annualAitTaxBDT / installmentsPerYear);
  const netPeriodicPayoutBDT = Math.round(netAnnualProfitBDT / installmentsPerYear);

  return {
    principalBDT: Math.round(principalBDT),
    grossAnnualProfitBDT: Math.round(totalGrossAnnualProfit),
    effectiveAnnualRate: Number(effectiveAnnualRate.toFixed(4)),
    aitRate,
    annualAitTaxBDT: Math.round(annualAitTaxBDT),
    netAnnualProfitBDT: Math.round(netAnnualProfitBDT),
    payoutIntervalMonths: scheme.payoutIntervalMonths,
    installmentsPerYear,
    grossPeriodicPayoutBDT,
    periodicAitTaxBDT,
    netPeriodicPayoutBDT,
  };
}

/**
 * Advances an ISO YYYY-MM-DD date by N months with month-end clamping and zero timezone drift (Fixes H7).
 */
export function addMonthsClampedISO(issueDateISO: string, monthsToAdd: number): string {
  const [year, month, day] = issueDateISO.split('-').map(Number);
  const totalMonths = (year * 12 + (month - 1)) + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const maxDaysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const clampedDay = Math.min(day, maxDaysInTargetMonth);

  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Generates all expected payout dates from issue date until maturity with month-end clamping and zero UTC drift.
 */
export function generatePayoutScheduleDates(
  issueDateISO: string,
  tenureYears: number,
  payoutIntervalMonths: number
): string[] {
  const dates: string[] = [];
  const totalInstallments = Math.floor((tenureYears * 12) / payoutIntervalMonths);

  for (let i = 1; i <= totalInstallments; i++) {
    dates.push(addMonthsClampedISO(issueDateISO, i * payoutIntervalMonths));
  }

  void advanceDueDate;
  return dates;
}

/**
 * Counts completed full years between two ISO YYYY-MM-DD dates.
 */
export function countCompletedYearsISO(issueDateISO: string, targetDateISO: string): number {
  const [iy, im, id] = issueDateISO.split('-').map(Number);
  const [ty, tm, td] = targetDateISO.split('-').map(Number);
  if (!iy || !im || !id || !ty || !tm || !td) return 0;

  let years = ty - iy;
  if (tm < im || (tm === im && td < id)) {
    years -= 1;
  }
  return Math.max(0, years);
}

/**
 * Computes premature encashment settlement under Bangladesh Sanchaypatra stepped surrender rules.
 * - < 1 completed year: 0% profit allowed (already paid periodic payouts are clawed back from principal).
 * - 1 .. tenureYears - 1: stepped early surrender rate below full maturity rate.
 * - >= tenureYears: full slabGrossRate applies.
 * All returned monetary figures are whole-Taka integers.
 */
export function calculateEarlyEncashment(
  scheme: SanchaypatraScheme,
  encashmentDateISO: string,
  alreadyPaidProfitBDT: number = 0
): EarlyEncashmentResult {
  const principalBDT = Math.round(scheme.principal);
  const completedYears = Math.min(
    scheme.tenureYears,
    countCompletedYearsISO(scheme.issueDate, encashmentDateISO)
  );

  let effectiveEarlyRate = 0;
  if (completedYears >= scheme.tenureYears) {
    effectiveEarlyRate = scheme.slabGrossRate;
  } else if (completedYears >= 1) {
    const floorRate = Math.max(0.05, scheme.slabGrossRate - 0.02);
    const ceilingRate = Math.max(floorRate, scheme.slabGrossRate - 0.005);
    const steps = Math.max(1, scheme.tenureYears - 2);
    const progress = Math.min(1, (completedYears - 1) / steps);
    effectiveEarlyRate = Number((floorRate + (ceilingRate - floorRate) * progress).toFixed(4));
  }

  const grossAccruedProfitBDT = Math.round(principalBDT * effectiveEarlyRate * completedYears);
  const aitDeductedBDT = Math.round(grossAccruedProfitBDT * scheme.aitRate);
  const netAccruedProfitBDT = grossAccruedProfitBDT - aitDeductedBDT;
  const paidRounded = Math.max(0, Math.round(alreadyPaidProfitBDT));
  const adjustmentDeltaBDT = netAccruedProfitBDT - paidRounded;
  const netSettlementPayoutBDT = Math.max(0, principalBDT + adjustmentDeltaBDT);

  return {
    schemeId: scheme.id,
    schemeName: scheme.name,
    principalBDT,
    issueDate: scheme.issueDate,
    encashmentDate: encashmentDateISO,
    completedYears,
    effectiveEarlyRate,
    grossAccruedProfitBDT,
    aitRate: scheme.aitRate,
    aitDeductedBDT,
    netAccruedProfitBDT,
    alreadyPaidProfitBDT: paidRounded,
    adjustmentDeltaBDT,
    netSettlementPayoutBDT,
  };
}
