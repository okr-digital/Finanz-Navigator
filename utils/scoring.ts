import { UserProfile, ModuleId } from '../types';

type AustrianRealityBenchmark = {
  netIncomeMonthly: number;
  liquidAssets: number;
  targetSavingsRate: number;
  targetEmergencyMonths: number;
  warningDebtRatio: number;
};

const AUSTRIAN_BENCHMARKS: Record<UserProfile['basic']['householdType'], AustrianRealityBenchmark> = {
  single: { netIncomeMonthly: 2600, liquidAssets: 9000, targetSavingsRate: 0.12, targetEmergencyMonths: 3, warningDebtRatio: 0.15 },
  paar: { netIncomeMonthly: 4300, liquidAssets: 18000, targetSavingsRate: 0.15, targetEmergencyMonths: 4, warningDebtRatio: 0.14 },
  familie: { netIncomeMonthly: 5200, liquidAssets: 14000, targetSavingsRate: 0.10, targetEmergencyMonths: 5, warningDebtRatio: 0.12 },
};

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value));

const getRealityBenchmark = (profile: UserProfile): AustrianRealityBenchmark =>
  AUSTRIAN_BENCHMARKS[profile.basic.householdType] ?? AUSTRIAN_BENCHMARKS.single;

const getEmergencyFundTarget = (profile: UserProfile): number => {
  const benchmark = getRealityBenchmark(profile);
  let target = benchmark.targetEmergencyMonths;
  if (profile.basic.employment === 'selbstständig') target += 2;
  if (profile.basic.employment === 'teilzeit') target += 1;
  return target;
};

const getRetirementPreparednessTarget = (age: number): number => {
  if (age >= 55) return 18;
  if (age >= 45) return 12;
  if (age >= 35) return 8;
  return 4;
};

const calculateRealityScore = (profile: UserProfile, freeCash: number): number => {
  const benchmark = getRealityBenchmark(profile);
  const netIncome = profile.cashflow.netIncomeMonthly || 0;
  const totalAssets = (profile.assets.savings || 0) + (profile.assets.investments || 0);

  const incomeRatio = netIncome / Math.max(benchmark.netIncomeMonthly, 1);
  const assetsRatio = totalAssets / Math.max(benchmark.liquidAssets, 1);
  const savingsRate = netIncome > 0 ? freeCash / netIncome : 0;
  const savingsRatio = savingsRate / Math.max(benchmark.targetSavingsRate, 0.01);

  let score =
    (clamp(incomeRatio * 100, 0, 140) * 0.45) +
    (clamp(assetsRatio * 100, 0, 140) * 0.35) +
    (clamp(savingsRatio * 100, 0, 140) * 0.20);

  // Lebensrealität: Teilzeit hat meist engere Spielräume, Selbstständigkeit mehr Volatilität.
  if (profile.basic.employment === 'teilzeit') score -= 8;
  if (profile.basic.employment === 'selbstständig') score -= 4;

  // Mit höherem Alter steigen finanzielle Mindestanforderungen (Reserven/Vorsorge).
  if ((profile.basic.age || 0) >= 50) score -= 6;
  else if ((profile.basic.age || 0) >= 40) score -= 3;

  return clamp(Math.round(score));
};

/**
 * Calculates scores (0-100) based on user inputs.
 */
export const calculateScores = (profile: UserProfile): UserProfile => {
  const newScores = { ...profile.scores };
  const recommendations: ModuleId[] = [];
  const benchmark = getRealityBenchmark(profile);
  const age = profile.basic.age || 30;

  const netIncomeRaw = profile.cashflow.netIncomeMonthly || 0;
  const netIncome = Math.max(1, netIncomeRaw); // avoid div by zero
  const fixedCosts = profile.cashflow.fixedCostsMonthly || 0;
  const debtService = profile.debts.consumerLoansMonthly || 0;
  const freeCash = profile.cashflow.freeCashMonthly 
    ? profile.cashflow.freeCashMonthly 
    : netIncomeRaw - fixedCosts;
  const totalAssets = (profile.assets.savings || 0) + (profile.assets.investments || 0);
  const ef = profile.protection.emergencyFundMonths;
  const monthlyBurn = fixedCosts + debtService;
  const burnMonthsCovered = monthlyBurn > 0 ? totalAssets / monthlyBurn : 0;
  const savingsRate = freeCash / netIncome;

  // --- 1. Liquidity Score (real-life resilience in Austria) ---
  const emergencyTarget = getEmergencyFundTarget(profile);
  const efRatio = ef / Math.max(1, emergencyTarget);
  let liquidityScore = clamp(efRatio * 70 + 20);
  if (burnMonthsCovered >= emergencyTarget) liquidityScore += 10;
  if (freeCash < 0) liquidityScore -= 8;
  newScores.liquidity = clamp(Math.round(liquidityScore));

  // --- 2. Wealth Score (income + assets + savings discipline) ---
  const savingsRatio = savingsRate / Math.max(benchmark.targetSavingsRate, 0.01);
  const assetsRatio = totalAssets / Math.max(benchmark.liquidAssets, 1);
  let wealthScore =
    (clamp(savingsRatio * 100, 0, 130) * 0.45) +
    (clamp(assetsRatio * 100, 0, 130) * 0.35) +
    (clamp((netIncomeRaw / Math.max(benchmark.netIncomeMonthly, 1)) * 100, 0, 130) * 0.20);
  if (freeCash < 0) wealthScore -= 15;
  newScores.wealth = clamp(Math.round(wealthScore));

  // --- 3. Protection Score (risk profile by household pressure) ---
  const costPressure = fixedCosts / netIncome;
  let protectionScore = 20;
  if (profile.protection.incomeProtection === 'yes') protectionScore += 45;
  else if (profile.protection.incomeProtection === 'unknown') protectionScore += 18;
  protectionScore += clamp((ef / Math.max(1, emergencyTarget)) * 30, 0, 30);
  if (costPressure > 0.75) protectionScore -= 12;
  else if (costPressure > 0.65) protectionScore -= 6;
  if (profile.basic.householdType === 'familie') protectionScore -= 4;
  newScores.protection = clamp(Math.round(protectionScore));


  // --- 4. Retirement Score (age-adjusted preparedness) ---
  let retirementScore = 10;
  if (profile.protection.privatePension === 'yes') retirementScore = 72;
  else if (profile.protection.privatePension === 'unknown') retirementScore = 38;
  const retirementTargetMonths = getRetirementPreparednessTarget(age);
  const reserveMonthsIncome = totalAssets / netIncome;
  retirementScore += clamp((reserveMonthsIncome / retirementTargetMonths) * 20, 0, 20);
  retirementScore += clamp((savingsRate / Math.max(benchmark.targetSavingsRate, 0.01)) * 8, 0, 8);
  if (age >= 45 && profile.protection.privatePension !== 'yes') retirementScore -= 8;
  if (age >= 55 && profile.protection.privatePension !== 'yes') retirementScore -= 10;
  newScores.retirement = clamp(Math.round(retirementScore));

  // --- 5. Debt Score ---
  let debtScore = 95;
  const dsti = debtService / netIncome;
  if (dsti > 0.4) debtScore = 20;
  else if (dsti > 0.3) debtScore = 35;
  else if (dsti > 0.2) debtScore = 55;
  else if (dsti > benchmark.warningDebtRatio) debtScore = 72;
  
  // Hypothek ist "gute Schulden" aber drückt Score leicht wenn keine Assets dagegen stehen
  if (profile.debts.mortgageRemaining && profile.debts.mortgageRemaining > 0) {
     debtScore -= totalAssets >= benchmark.liquidAssets ? 2 : 8;
  }
  if (freeCash < 0) debtScore -= 10;
  if (age < 30 && dsti > 0.2) debtScore -= 5;

  newScores.debt = clamp(Math.round(debtScore));

  // --- Overall Score ---
  const realityScore = calculateRealityScore(profile, freeCash);
  newScores.overall = Math.round(
    (newScores.liquidity * 0.2) +
    (newScores.wealth * 0.2) +
    (newScores.protection * 0.2) +
    (newScores.retirement * 0.2) +
    (newScores.debt * 0.1) +
    (realityScore * 0.1)
  );

  // --- Routing Logic (Smart Recommendations) ---
  
  // 1. Retirement Logic
  if (newScores.retirement < 70) {
    recommendations.push('pension');
  }

  // 2. Debt/Financing Logic
  // Recommend financing if debt score is bad OR if they have a mortgage (optimization)
  if (newScores.debt < 50 || (profile.debts.mortgageRemaining || 0) > 0) {
    recommendations.push('finanzierung');
  }

  // 3. Risk Logic
  if (newScores.protection < 70) {
    recommendations.push('risiko');
  }

  // Limit to max 2 recommendations for focus
  const finalRecommendations = recommendations.slice(0, 2);
  
  // Fallback: If everything is great, maybe investment/wealth (mapped to finanzierung generic or pension optimization)
  if (finalRecommendations.length === 0) {
    finalRecommendations.push('pension'); // "Vorsorge optimieren"
  }

  return {
    ...profile,
    scores: newScores,
    recommendedModules: finalRecommendations,
    cashflow: {
        ...profile.cashflow,
        freeCashMonthly: freeCash // Update calc value if not set
    }
  };
};

export const getTrafficLight = (score: number): 'red' | 'yellow' | 'green' => {
  if (score >= 70) return 'green';
  if (score >= 40) return 'yellow';
  return 'red';
};

export const getTrafficLightColor = (score: number): string => {
  const status = getTrafficLight(score);
  switch (status) {
    case 'green': return '#10B981'; // emerald-500
    case 'yellow': return '#F59E0B'; // amber-500
    case 'red': return '#EF4444'; // red-500
    default: return '#9CA3AF';
  }
};

export const getOverallBandLabel = (overallScore: number): string => {
  const tenScale = Math.max(1, Math.min(10, Math.round(overallScore / 10)));
  return `${tenScale}/10`;
};

export const getAustrianRealitySummary = (profile: UserProfile): string => {
  const benchmark = getRealityBenchmark(profile);
  const netIncome = profile.cashflow.netIncomeMonthly || 0;
  const totalAssets = (profile.assets.savings || 0) + (profile.assets.investments || 0);
  const freeCash = profile.cashflow.freeCashMonthly ?? (netIncome - (profile.cashflow.fixedCostsMonthly || 0));

  const incomeGap = netIncome - benchmark.netIncomeMonthly;
  const assetGap = totalAssets - benchmark.liquidAssets;
  const savingsRate = netIncome > 0 ? (freeCash / netIncome) * 100 : 0;
  const targetSavingsRate = benchmark.targetSavingsRate * 100;

  const incomeText = incomeGap >= 0
    ? `${Math.round(incomeGap).toLocaleString('de-AT')} € über`
    : `${Math.round(Math.abs(incomeGap)).toLocaleString('de-AT')} € unter`;
  const assetsText = assetGap >= 0
    ? `${Math.round(assetGap).toLocaleString('de-AT')} € über`
    : `${Math.round(Math.abs(assetGap)).toLocaleString('de-AT')} € unter`;

  return `Mit ${Math.round(netIncome).toLocaleString('de-AT')} € Netto/Monat und ${Math.round(totalAssets).toLocaleString('de-AT')} € Erspartem liegen Sie beim Einkommen ${incomeText} und beim Vermögen ${assetsText} dem österreichischen Vergleich für Ihren Haushaltstyp. Ihre Sparquote liegt bei ${Math.max(0, savingsRate).toFixed(1)} % (Richtwert: ${targetSavingsRate.toFixed(1)} %).`;
};

export const getAustrianAreaInsights = (profile: UserProfile): string[] => {
  const benchmark = getRealityBenchmark(profile);
  const emergencyTarget = getEmergencyFundTarget(profile);
  const netIncome = profile.cashflow.netIncomeMonthly || 0;
  const fixedCosts = profile.cashflow.fixedCostsMonthly || 0;
  const debtService = profile.debts.consumerLoansMonthly || 0;
  const freeCash = profile.cashflow.freeCashMonthly ?? (netIncome - fixedCosts);
  const totalAssets = (profile.assets.savings || 0) + (profile.assets.investments || 0);
  const savingsRate = netIncome > 0 ? (freeCash / netIncome) * 100 : 0;
  const targetSavingsRate = benchmark.targetSavingsRate * 100;
  const dsti = netIncome > 0 ? (debtService / netIncome) * 100 : 0;
  const retirementTarget = getRetirementPreparednessTarget(profile.basic.age || 30);
  const reserveMonths = netIncome > 0 ? totalAssets / netIncome : 0;

  return [
    `Liquiditat: Notgroschen ${profile.protection.emergencyFundMonths} Monate (Richtwert fuer Ihr Profil: ${emergencyTarget} Monate).`,
    `Vermoegen: Sparquote ${Math.max(0, savingsRate).toFixed(1)} % (Zielwert: ${targetSavingsRate.toFixed(1)} %) bei ${Math.round(totalAssets).toLocaleString('de-AT')} EUR Kapital.`,
    `Absicherung: Einkommen ${profile.protection.incomeProtection === 'yes' ? 'abgesichert' : profile.protection.incomeProtection === 'unknown' ? 'unklar abgesichert' : 'nicht abgesichert'} bei Fixkostenquote ${(netIncome > 0 ? (fixedCosts / netIncome) * 100 : 0).toFixed(1)} %.`,
    `Vorsorge: Reserve entspricht ${reserveMonths.toFixed(1)} Monatsnettos (altersbezogener Orientierungswert: ${retirementTarget} Monatsnettos).`,
    `Schulden: Konsumkreditquote ${dsti.toFixed(1)} % vom Netto (Warnwert fuer Ihren Haushalt: ${(benchmark.warningDebtRatio * 100).toFixed(1)} %).`,
  ];
};