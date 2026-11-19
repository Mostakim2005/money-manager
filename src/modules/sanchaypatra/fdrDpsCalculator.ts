/**
 * Whole-Taka FDR (Fixed Deposit Receipt) and DPS (Deposit Pension Scheme) calculators
 * tailored to Bangladeshi bank compounding & AIT withholding norms.
 */

export interface FdrCalculationResult {
  principalBDT: number;
  grossMaturityBDT: number;
  grossProfitBDT: number;
  aitTaxBDT: number;
  netProfitBDT: number;
  netMaturityAmountBDT: number;
}

export interface DpsCalculationResult {
  monthlyInstallmentBDT: number;
  tenureMonths: number;
  totalDepositedBDT: number;
  grossMaturityBDT: number;
  grossProfitBDT: number;
  aitTaxBDT: number;
  netProfitBDT: number;
  netMaturityAmountBDT: number;
}

export function calculateFdrMaturity(params: {
  principalBDT: number;
  annualRate: number;
  tenureMonths: number;
  aitRate?: number;
  compoundingPerYear?: number;
}): FdrCalculationResult {
  const principalBDT = Math.round(Math.max(0, params.principalBDT));
  const tenureMonths = Math.max(1, Math.round(params.tenureMonths));
  const aitRate = params.aitRate ?? 0.10;
  const compounding = params.compoundingPerYear ?? 4;

  if (principalBDT === 0) {
    return {
      principalBDT: 0,
      grossMaturityBDT: 0,
      grossProfitBDT: 0,
      aitTaxBDT: 0,
      netProfitBDT: 0,
      netMaturityAmountBDT: 0,
    };
  }

  const years = tenureMonths / 12;
  const rawMaturity =
    tenureMonths < 12
      ? principalBDT * (1 + params.annualRate * years)
      : principalBDT * Math.pow(1 + params.annualRate / compounding, compounding * years);

  const grossMaturityBDT = Math.round(rawMaturity);
  const grossProfitBDT = Math.max(0, grossMaturityBDT - principalBDT);
  const aitTaxBDT = Math.round(grossProfitBDT * aitRate);
  const netProfitBDT = grossProfitBDT - aitTaxBDT;
  const netMaturityAmountBDT = principalBDT + netProfitBDT;

  return {
    principalBDT,
    grossMaturityBDT,
    grossProfitBDT,
    aitTaxBDT,
    netProfitBDT,
    netMaturityAmountBDT,
  };
}

export function calculateDpsMaturity(params: {
  monthlyInstallmentBDT: number;
  annualRate: number;
  tenureMonths: number;
  aitRate?: number;
}): DpsCalculationResult {
  const monthlyInstallmentBDT = Math.round(Math.max(0, params.monthlyInstallmentBDT));
  const tenureMonths = Math.max(1, Math.round(params.tenureMonths));
  const aitRate = params.aitRate ?? 0.10;

  const totalDepositedBDT = monthlyInstallmentBDT * tenureMonths;
  if (monthlyInstallmentBDT === 0) {
    return {
      monthlyInstallmentBDT: 0,
      tenureMonths,
      totalDepositedBDT: 0,
      grossMaturityBDT: 0,
      grossProfitBDT: 0,
      aitTaxBDT: 0,
      netProfitBDT: 0,
      netMaturityAmountBDT: 0,
    };
  }

  const monthlyRate = params.annualRate / 12;
  const rawMaturity =
    monthlyRate <= 0
      ? totalDepositedBDT
      : monthlyInstallmentBDT * ((Math.pow(1 + monthlyRate, tenureMonths) - 1) / monthlyRate) * (1 + monthlyRate);

  const grossMaturityBDT = Math.round(rawMaturity);
  const grossProfitBDT = Math.max(0, grossMaturityBDT - totalDepositedBDT);
  const aitTaxBDT = Math.round(grossProfitBDT * aitRate);
  const netProfitBDT = grossProfitBDT - aitTaxBDT;
  const netMaturityAmountBDT = totalDepositedBDT + netProfitBDT;

  return {
    monthlyInstallmentBDT,
    tenureMonths,
    totalDepositedBDT,
    grossMaturityBDT,
    grossProfitBDT,
    aitTaxBDT,
    netProfitBDT,
    netMaturityAmountBDT,
  };
}
