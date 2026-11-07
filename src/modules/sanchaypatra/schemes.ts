export interface SchemeDefinition {
  id: string;
  name: string;
  banglaName: string;
  tenureYears: number;
  payoutIntervalMonths: number;
  maxIndividualLimitBDT: number;
  slabRates: {
    maxPrincipalBDT: number; // Tier ceiling (e.g. 1,500,000)
    annualRate: number;      // e.g. 0.1128
  }[];
}

export const BANGLADESH_SANCHAYPATRA_SCHEMES: SchemeDefinition[] = [
  {
    id: 'bd_5yr',
    name: '5-Year Bangladesh Sanchaypatra',
    banglaName: '৫ বছর মেয়াদী বাংলাদেশ সঞ্চয়পত্র',
    tenureYears: 5,
    payoutIntervalMonths: 6,
    maxIndividualLimitBDT: 3000000,
    slabRates: [
      { maxPrincipalBDT: 1500000, annualRate: 0.1128 },
      { maxPrincipalBDT: 3000000, annualRate: 0.1030 },
      { maxPrincipalBDT: Infinity, annualRate: 0.0930 }
    ]
  },
  {
    id: 'three_month_profit',
    name: '3-Month Profit-Bearing Sanchaypatra',
    banglaName: '৩ মাস অন্তর মুনাফাভিত্তিক সঞ্চয়পত্র',
    tenureYears: 3,
    payoutIntervalMonths: 3,
    maxIndividualLimitBDT: 3000000,
    slabRates: [
      { maxPrincipalBDT: 1500000, annualRate: 0.1104 },
      { maxPrincipalBDT: 3000000, annualRate: 0.1000 },
      { maxPrincipalBDT: Infinity, annualRate: 0.0900 }
    ]
  },
  {
    id: 'paribar',
    name: 'Paribar Sanchaypatra',
    banglaName: 'পরিবার সঞ্চয়পত্র',
    tenureYears: 5,
    payoutIntervalMonths: 1,
    maxIndividualLimitBDT: 4500000,
    slabRates: [
      { maxPrincipalBDT: 1500000, annualRate: 0.1152 },
      { maxPrincipalBDT: 3000000, annualRate: 0.1050 },
      { maxPrincipalBDT: Infinity, annualRate: 0.0950 }
    ]
  },
  {
    id: 'pensioner',
    name: 'Pensioner Sanchaypatra',
    banglaName: 'পেনশনার সঞ্চয়পত্র',
    tenureYears: 5,
    payoutIntervalMonths: 3,
    maxIndividualLimitBDT: 5000000,
    slabRates: [
      { maxPrincipalBDT: 1500000, annualRate: 0.1176 },
      { maxPrincipalBDT: 3000000, annualRate: 0.1075 },
      { maxPrincipalBDT: Infinity, annualRate: 0.0975 }
    ]
  }
];
