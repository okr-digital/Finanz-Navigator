export type HouseholdType = 'single' | 'paar' | 'familie';
export type EmploymentType = 'angestellt' | 'selbstständig' | 'teilzeit';
export type YesNoUnknown = 'yes' | 'no' | 'unknown';
export type ModuleId = 'pension' | 'finanzierung' | 'risiko';

export interface PensionScenario {
  returnPA: number;
  requiredPMT: number; // Monthly saving needed to close gap
  extraPMT: number; // requiredPMT - currentSavings
}

export interface PensionModuleResult {
  desiredPensionMonthly: number;
  retirementAge: number;
  replacementRate: number;
  isPartTimeOrKarenz: boolean;
  estimatedStatutoryPensionMonthly: number;
  gapMonthly: number;
  capitalNeeded: number;
  yearsToRetirement: number;
  currentSavingsMonthly: number;
  currentSavingsStock: number;
  pensionDurationYears: number;
  scenarioA: PensionScenario; // Conservative
  scenarioB: PensionScenario; // Optimistic
  assessment: 'green' | 'yellow' | 'red';
  generatedSummary: string;
}

export interface AncillaryCostItem {
  id: string;
  label: string;
  value: number; // Represents % or absolute value based on type
  type: 'percent' | 'fixed';
  isActive: boolean;
}

export interface FinanzierungScenario {
  label: string;
  interestPA: number;
  paymentMonthly: number;
  totalRepayment: number;
  dsti: number;
}

export interface FinanzierungModuleResult {
  purchasePrice: number;
  purpose: string;
  equity: number;
  equityWork: number;
  ancillaryCosts: {
    items: AncillaryCostItem[];
    total: number;
  };
  loanAmount: number;
  termYears: number;
  netIncomeMonthly: number;
  existingDebtPaymentsMonthly: number;
  scenarioA: FinanzierungScenario;
  scenarioB: FinanzierungScenario;
  ltv: number;
  kimCheck: {
    ltvStatus: 'green' | 'yellow' | 'red';
    dstiAStatus: 'green' | 'yellow' | 'red';
    dstiBStatus: 'green' | 'yellow' | 'red';
    termStatus: 'green' | 'red';
  };
  assessment: 'green' | 'yellow' | 'red';
  generatedSummary: string;
}

export interface RisikoModuleResult {
  netIncomeMonthly: number;
  fixedCostsMonthly: number;
  debtPaymentsMonthly: number;
  variableCostsMonthly: number;
  monthlyBurn: number;
  savings: number;
  quickInvestments: number;
  liquidReserves: number;
  runwayMonths: number;
  shockMonths: 3 | 6 | 12;
  supportMonthly: number;
  shockDeficitMonthly: number;
  totalShockNeed: number;
  gapToSafety: number;
  incomeProtection: YesNoUnknown;
  assessment: 'green' | 'yellow' | 'red';
  generatedSummary: string;
}

export interface UserProfile {
  meta: {
    sessionId: string;
    createdAt: string;
    lastUpdatedAt: string;
    isFinished: boolean;
  };
  basic: {
    age: number | null;
    householdType: HouseholdType;
    employment: EmploymentType;
  };
  cashflow: {
    netIncomeMonthly: number | null;
    fixedCostsMonthly: number | null;
    freeCashMonthly: number | null; // Calculated or manual
  };
  assets: {
    savings: number | null;
    investments: number | null;
  };
  debts: {
    mortgageRemaining: number | null;
    consumerLoansMonthly: number | null;
  };
  protection: {
    emergencyFundMonths: number; // 0, 1, 2, 3, 6, 12
    privatePension: YesNoUnknown;
    incomeProtection: YesNoUnknown;
  };
  scores: {
    liquidity: number;
    wealth: number;
    protection: number;
    retirement: number;
    debt: number;
    overall: number;
  };
  recommendedModules: ModuleId[];
  moduleResults: {
    pension: PensionModuleResult | null;
    finanzierung: FinanzierungModuleResult | null;
    risiko: RisikoModuleResult | null;
  };
  lead: {
    name: string;
    email: string;
    phone: string;
    consent: boolean;
  };
}

export const INITIAL_STATE: UserProfile = {
  meta: {
    sessionId: '',
    createdAt: '',
    lastUpdatedAt: '',
    isFinished: false
  },
  basic: {
    age: null,
    householdType: 'single',
    employment: 'angestellt',
  },
  cashflow: {
    netIncomeMonthly: null,
    fixedCostsMonthly: null,
    freeCashMonthly: null,
  },
  assets: {
    savings: null,
    investments: null,
  },
  debts: {
    mortgageRemaining: null,
    consumerLoansMonthly: null,
  },
  protection: {
    emergencyFundMonths: 0,
    privatePension: 'unknown',
    incomeProtection: 'unknown',
  },
  scores: {
    liquidity: 0,
    wealth: 0,
    protection: 0,
    retirement: 0,
    debt: 0,
    overall: 0,
  },
  recommendedModules: [],
  moduleResults: {
    pension: null,
    finanzierung: null,
    risiko: null,
  },
  lead: {
    name: '',
    email: '',
    phone: '',
    consent: false,
  },
};