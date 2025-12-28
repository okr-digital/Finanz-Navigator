import { UserProfile, ModuleId } from '../types';

/**
 * Calculates scores (0-100) based on user inputs.
 */
export const calculateScores = (profile: UserProfile): UserProfile => {
  const newScores = { ...profile.scores };
  const recommendations: ModuleId[] = [];

  // --- 1. Liquidity Score ---
  // Notgroschen >= 3 Monate -> 80-100
  // 1-2 Monate -> 40-70
  // <1 Monat -> 0-40
  const ef = profile.protection.emergencyFundMonths;
  if (ef >= 6) newScores.liquidity = 100;
  else if (ef >= 3) newScores.liquidity = 85;
  else if (ef >= 2) newScores.liquidity = 60;
  else if (ef >= 1) newScores.liquidity = 45;
  else newScores.liquidity = 20;

  // --- 2. Wealth Score ---
  // freeCashMonthly / netIncomeMonthly
  const netIncome = profile.cashflow.netIncomeMonthly || 1; // avoid div by zero
  const freeCash = profile.cashflow.freeCashMonthly 
    ? profile.cashflow.freeCashMonthly 
    : (profile.cashflow.netIncomeMonthly || 0) - (profile.cashflow.fixedCostsMonthly || 0);
  
  const savingsRate = freeCash / netIncome;
  
  if (savingsRate >= 0.20) newScores.wealth = 95;
  else if (savingsRate >= 0.15) newScores.wealth = 80; // Gut
  else if (savingsRate >= 0.10) newScores.wealth = 60;
  else if (savingsRate >= 0.05) newScores.wealth = 40; // Mittel
  else newScores.wealth = 20; // Kritisch

  // Add bonus for existing assets
  const totalAssets = (profile.assets.savings || 0) + (profile.assets.investments || 0);
  if (totalAssets > netIncome * 6) newScores.wealth = Math.min(100, newScores.wealth + 10);


  // --- 3. Protection Score ---
  let protectionBase = 20;
  if (profile.protection.incomeProtection === 'yes') protectionBase += 40;
  if (profile.protection.incomeProtection === 'unknown') protectionBase += 10;
  
  if (ef >= 3) protectionBase += 30;
  else if (ef >= 1) protectionBase += 10;

  newScores.protection = Math.min(100, protectionBase);


  // --- 4. Retirement Score ---
  // privatePension yes -> +60, unknown -> +30, no -> +10
  let retirementBase = 10;
  if (profile.protection.privatePension === 'yes') retirementBase = 80;
  if (profile.protection.privatePension === 'unknown') retirementBase = 40;
  
  // Alter spielt eine Rolle: Je älter ohne Vorsorge, desto schlechter
  if (profile.basic.age && profile.basic.age > 40 && profile.protection.privatePension === 'no') {
    retirementBase = 10;
  }
  
  newScores.retirement = retirementBase;

  // --- 5. Debt Score ---
  let debtScore = 100;
  const debtService = profile.debts.consumerLoansMonthly || 0;
  const dsti = debtService / netIncome;

  if (dsti > 0.4) debtScore = 20;
  else if (dsti > 0.3) debtScore = 40;
  else if (dsti > 0.1) debtScore = 70;
  
  // Hypothek ist "gute Schulden" aber drückt Score leicht wenn keine Assets dagegen stehen
  if (profile.debts.mortgageRemaining && profile.debts.mortgageRemaining > 0) {
     // Neutraler Impact, check equity ratio conceptually (skipped for MVP)
     debtScore -= 5; 
  }

  newScores.debt = Math.max(0, Math.min(100, debtScore));

  // --- Overall Score ---
  newScores.overall = Math.round(
    (newScores.liquidity + newScores.wealth + newScores.protection + newScores.retirement + newScores.debt) / 5
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