import { UserProfile } from '../types';
import { supabase } from '../lib/supabaseClient';

/**
 * Sendet das Nutzerprofil an die Supabase Datenbank.
 */
export const saveToDatabase = async (data: UserProfile): Promise<boolean> => {
  console.log("🚀 Sende Daten an Supabase...", data);

  try {
    // Mapping der verschachtelten Struktur auf eine flache Datenbank-Zeile
    const flatPayload = {
      // System & Meta (Fix für Error 23502: created_at muss gesetzt sein)
      created_at: data.meta.createdAt || new Date().toISOString(),
      session_id: data.meta.sessionId,
      is_finished: data.meta.isFinished,
      
      // Lead Daten
      lead_name: data.lead.name,
      lead_email: data.lead.email,
      lead_phone: data.lead.phone,
      lead_consent: data.lead.consent,

      // Basisdaten
      age: data.basic.age,
      household_type: data.basic.householdType,
      employment: data.basic.employment,

      // Finanzen (Cashflow & Assets)
      net_income: data.cashflow.netIncomeMonthly,
      fixed_costs: data.cashflow.fixedCostsMonthly,
      savings: data.assets.savings,
      investments: data.assets.investments,

      // Schulden
      mortgage_remaining: data.debts.mortgageRemaining,
      consumer_loans_monthly: data.debts.consumerLoansMonthly,

      // Absicherung Status
      emergency_fund_months: data.protection.emergencyFundMonths,
      has_private_pension: data.protection.privatePension,
      has_income_protection: data.protection.incomeProtection,

      // Scores (KPIs)
      score_overall: data.scores.overall,
      score_liquidity: data.scores.liquidity,
      score_wealth: data.scores.wealth,
      score_protection: data.scores.protection,
      score_retirement: data.scores.retirement,
      score_debt: data.scores.debt,

      // Modul-Spezifische Ergebnisse
      pension_gap_monthly: data.moduleResults.pension?.gapMonthly || null,
      pension_capital_needed: data.moduleResults.pension?.capitalNeeded || null,
      
      finance_loan_amount: data.moduleResults.finanzierung?.loanAmount || null,
      finance_ltv: data.moduleResults.finanzierung?.ltv || null,
      
      risk_runway_months: data.moduleResults.risiko?.runwayMonths || null,
      risk_gap_to_safety: data.moduleResults.risiko?.gapToSafety || null,

      // Rohdaten als Backup
      profile_data: data
    };

    // Upsert: Aktualisiert existierende Einträge (basierend auf session_id) oder fügt neue hinzu.
    const { error } = await supabase
      .from('DB Finanz Navigator Leads') 
      .upsert(flatPayload, { onConflict: 'session_id' });

    if (error) {
      console.error("Supabase Error:", JSON.stringify(error, null, 2));
      return false;
    }

    console.log("✅ Daten erfolgreich in Supabase gespeichert/aktualisiert.");
    return true;

  } catch (error) {
    console.error("❌ Fehler beim Speichern der Daten:", error);
    return false;
  }
};