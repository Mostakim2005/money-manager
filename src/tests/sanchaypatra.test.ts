import { describe, it, expect } from 'vitest';
import { calculateSanchaypatraProfit, generatePayoutScheduleDates } from '../modules/sanchaypatra/calculator';
import { BANGLADESH_SANCHAYPATRA_SCHEMES } from '../modules/sanchaypatra/schemes';

describe('Sanchaypatra Calculation Engine', () => {
  const paribarScheme = BANGLADESH_SANCHAYPATRA_SCHEMES.find(s => s.id === 'paribar')!;
  const threeMonthScheme = BANGLADESH_SANCHAYPATRA_SCHEMES.find(s => s.id === 'three_month_profit')!;

  it('calculates 5-Year Paribar Sanchaypatra profit with 10% AIT tax for 1,000,000 BDT', () => {
    // 1M BDT falls under the first slab (up to 1.5M BDT at 11.52%)
    // Gross annual = 1,000,000 * 0.1152 = 115,200 BDT
    // Since principal > 500k, AIT = 10% -> Tax = 11,520 BDT
    // Net annual = 103,680 BDT
    // Monthly payout = 103,680 / 12 = 8,640 BDT
    const result = calculateSanchaypatraProfit(1000000, paribarScheme);

    expect(result.grossAnnualProfitBDT).toBe(115200);
    expect(result.aitRate).toBe(0.10);
    expect(result.annualAitTaxBDT).toBe(11520);
    expect(result.netAnnualProfitBDT).toBe(103680);
    expect(result.netPeriodicPayoutBDT).toBe(8640);
  });

  it('calculates tiered slab rate when investment exceeds 1.5M BDT', () => {
    // 2M BDT in Paribar:
    // First 1.5M @ 11.52% = 172,800 BDT
    // Next 500k @ 10.50% = 52,500 BDT
    // Total gross = 225,300 BDT
    const result = calculateSanchaypatraProfit(2000000, paribarScheme);

    expect(result.grossAnnualProfitBDT).toBe(225300);
    expect(result.aitRate).toBe(0.10);
    expect(result.annualAitTaxBDT).toBe(22530);
    expect(result.netAnnualProfitBDT).toBe(202770);
  });

  it('applies 5% AIT for smaller savings amounts <= 500,000 BDT', () => {
    // 500k BDT in 3-Month Profit scheme:
    // Rate = 11.04% -> Gross annual = 55,200 BDT
    // AIT = 5% -> Tax = 2,760 BDT
    // Net annual = 52,440 BDT
    // Quarterly payout (4 installments) = 13,110 BDT
    const result = calculateSanchaypatraProfit(500000, threeMonthScheme);

    expect(result.aitRate).toBe(0.05);
    expect(result.grossAnnualProfitBDT).toBe(55200);
    expect(result.annualAitTaxBDT).toBe(2760);
    expect(result.netAnnualProfitBDT).toBe(52440);
    expect(result.netPeriodicPayoutBDT).toBe(13110);
  });

  it('generates correct future payout schedule dates', () => {
    const dates = generatePayoutScheduleDates('2026-01-15', 3, 3);
    expect(dates.length).toBe(12); // 3 years * 4 quarters
    expect(dates[0]).toBe('2026-04-15');
    expect(dates[1]).toBe('2026-07-15');
    expect(dates[dates.length - 1]).toBe('2029-01-15');
  });
});
