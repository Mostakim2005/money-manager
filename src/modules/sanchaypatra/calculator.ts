import { SchemeDefinition } from './schemes';
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

  // Ensure advanceDueDate remains referenced/compatible
  void advanceDueDate;
  return dates;
}
