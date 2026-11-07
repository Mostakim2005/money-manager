import { SchemeDefinition } from './schemes';

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
 * - Slabs: Tiered interest rates apply per principal bracket (up to 1.5M, 1.5M-3M, 3M+).
 * - AIT: 5% tax if total investment <= BDT 500,000; 10% tax if > BDT 500,000.
 */
export function calculateSanchaypatraProfit(
  principalBDT: number,
  scheme: SchemeDefinition,
  totalSanchaypatraHoldingsBDT: number = principalBDT
): SanchaypatraCalculationResult {
  if (principalBDT <= 0) {
    throw new Error('Principal must be greater than zero.');
  }

  // 1. Calculate tiered gross annual profit across slabs
  let remainingPrincipal = principalBDT;
  let lowerBound = 0;
  let totalGrossAnnualProfit = 0;

  for (const slab of scheme.slabRates) {
    if (remainingPrincipal <= 0) break;

    const slabCapacity = slab.maxPrincipalBDT - lowerBound;
    const applicableAmountInThisSlab = Math.min(remainingPrincipal, slabCapacity);

    totalGrossAnnualProfit += applicableAmountInThisSlab * slab.annualRate;
    remainingPrincipal -= applicableAmountInThisSlab;
    lowerBound = slab.maxPrincipalBDT;
  }

  const effectiveAnnualRate = totalGrossAnnualProfit / principalBDT;

  // 2. Determine Advance Income Tax (AIT) rate
  // Government rule: 5% tax if cumulative holdings <= 500,000 BDT, otherwise 10%
  const aitRate = totalSanchaypatraHoldingsBDT <= 500000 ? 0.05 : 0.10;
  const annualAitTaxBDT = totalGrossAnnualProfit * aitRate;
  const netAnnualProfitBDT = totalGrossAnnualProfit - annualAitTaxBDT;

  // 3. Periodic installment breakdown
  const installmentsPerYear = 12 / scheme.payoutIntervalMonths;
  const grossPeriodicPayoutBDT = totalGrossAnnualProfit / installmentsPerYear;
  const periodicAitTaxBDT = annualAitTaxBDT / installmentsPerYear;
  const netPeriodicPayoutBDT = netAnnualProfitBDT / installmentsPerYear;

  return {
    principalBDT,
    grossAnnualProfitBDT: Math.round(totalGrossAnnualProfit),
    effectiveAnnualRate: Number(effectiveAnnualRate.toFixed(4)),
    aitRate,
    annualAitTaxBDT: Math.round(annualAitTaxBDT),
    netAnnualProfitBDT: Math.round(netAnnualProfitBDT),
    payoutIntervalMonths: scheme.payoutIntervalMonths,
    installmentsPerYear,
    grossPeriodicPayoutBDT: Number(grossPeriodicPayoutBDT.toFixed(2)),
    periodicAitTaxBDT: Number(periodicAitTaxBDT.toFixed(2)),
    netPeriodicPayoutBDT: Number(netPeriodicPayoutBDT.toFixed(2))
  };
}

/**
 * Generates all expected payout dates from issue date until maturity.
 */
export function generatePayoutScheduleDates(
  issueDateISO: string,
  tenureYears: number,
  payoutIntervalMonths: number
): string[] {
  const dates: string[] = [];
  const start = new Date(issueDateISO);
  const totalInstallments = (tenureYears * 12) / payoutIntervalMonths;

  for (let i = 1; i <= totalInstallments; i++) {
    const nextDate = new Date(start);
    nextDate.setMonth(start.getMonth() + i * payoutIntervalMonths);
    dates.push(nextDate.toISOString().split('T')[0]);
  }

  return dates;
}
