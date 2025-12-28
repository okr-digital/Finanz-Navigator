import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { Button, Card, InputGroup, NumberInput, Select, ProgressBar, ScoreBadge } from '../components/UI';
import { RisikoModuleResult, YesNoUnknown } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { saveToDatabase } from '../services/api';

export const RisikoModule: React.FC = () => {
  const { profile, updateNestedProfile } = useUser();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [showResult, setShowResult] = useState(false);
  const totalSteps = 4;

  // Local State
  const [netIncome, setNetIncome] = useState(profile.cashflow.netIncomeMonthly || 2500);
  const [fixedCosts, setFixedCosts] = useState(profile.cashflow.fixedCostsMonthly || 1500);
  const [debtPayments, setDebtPayments] = useState(profile.debts.consumerLoansMonthly || 0);
  const [variableCosts, setVariableCosts] = useState(0);

  const [savings, setSavings] = useState(profile.assets.savings || 0);
  const [quickInvestments, setQuickInvestments] = useState(profile.assets.investments || 0);
  
  const [shockMonths, setShockMonths] = useState<3 | 6 | 12>(6);
  const [supportMonthly, setSupportMonthly] = useState(0); // Unemployment benefits etc.

  const [incomeProtection, setIncomeProtection] = useState<YesNoUnknown>(profile.protection.incomeProtection || 'unknown');
  const [canReduceCosts, setCanReduceCosts] = useState(false);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Helpers
  const getMonthlyBurn = () => fixedCosts + debtPayments + variableCosts;
  const getLiquidReserves = () => savings + quickInvestments;
  
  // Validation
  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (currentStep === 1) {
      if (getMonthlyBurn() <= 0) {
        newErrors.costs = "Bitte geben Sie Ihre monatlichen Kosten an.";
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      if (step < totalSteps) {
        setStep(step + 1);
      } else {
        saveData();
        setStep(step + 1); // Go to step 5 (Results)
        setShowResult(true);
      }
    }
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
    else navigate('/results');
  };

  // --- Calculations ---

  const calculateResult = (): RisikoModuleResult => {
    const monthlyBurn = getMonthlyBurn();
    const liquidReserves = getLiquidReserves();
    
    // Runway
    let runwayMonths = 999;
    if (monthlyBurn > 0) {
      runwayMonths = parseFloat((liquidReserves / monthlyBurn).toFixed(1));
    }

    // Shock Analysis
    // Effective burn considering support (e.g. AMS Geld)
    const effectiveIncome = supportMonthly;
    const shockDeficitMonthly = Math.max(0, monthlyBurn - effectiveIncome);
    const totalShockNeed = shockDeficitMonthly * shockMonths;
    const gapToSafety = Math.max(0, totalShockNeed - liquidReserves);

    // Assessment
    let assessment: 'green' | 'yellow' | 'red' = 'green';
    
    if (runwayMonths < 3 || gapToSafety > 0) {
      assessment = 'red';
    } else if (runwayMonths < 6) {
      assessment = 'yellow';
    }

    // Summary Text
    let summary = "";
    if (assessment === 'green') {
      summary = `Sehr solide! Ihre Rücklagen reichen für ca. ${runwayMonths} Monate ohne Einkommen. Das gewählte Szenario (${shockMonths} Monate) ist finanziell abgedeckt.`;
    } else if (assessment === 'yellow') {
       summary = `Sie haben einen gewissen Puffer (${runwayMonths} Monate), aber bei längeren Ausfällen wird es eng. Es fehlen ca. ${gapToSafety.toLocaleString()} €, um das ${shockMonths}-Monats-Szenario voll zu decken.`;
    } else {
       summary = `Kritisch: Ihre Rücklagen decken nur ca. ${runwayMonths} Monate ab. Im Szenario eines ${shockMonths}-monatigen Ausfalls entsteht eine Lücke von ${gapToSafety.toLocaleString()} €.`;
    }

    if (incomeProtection === 'no') {
      summary += " Ohne Einkommensschutz (Berufsunfähigkeit) tragen Sie das Risiko langfristiger Ausfälle allein.";
    }

    return {
      netIncomeMonthly: netIncome,
      fixedCostsMonthly: fixedCosts,
      debtPaymentsMonthly: debtPayments,
      variableCostsMonthly: variableCosts,
      monthlyBurn,
      savings,
      quickInvestments,
      liquidReserves,
      runwayMonths,
      shockMonths,
      supportMonthly,
      shockDeficitMonthly,
      totalShockNeed,
      gapToSafety,
      incomeProtection,
      assessment,
      generatedSummary: summary
    };
  };

  const saveData = () => {
    const result = calculateResult();
    
    // Save to Context
    updateNestedProfile('moduleResults', { risiko: result });
    updateNestedProfile('protection', { incomeProtection: incomeProtection });

    // Update Score
    let protectionScore = 85;
    if (result.assessment === 'yellow') protectionScore = 60;
    if (result.assessment === 'red') protectionScore = 30;
    // Boost if insurance exists
    if (incomeProtection === 'yes') protectionScore += 10;
    
    const finalProtectionScore = Math.min(100, protectionScore);
    updateNestedProfile('scores', { protection: finalProtectionScore });

    // AUTOSAVE if Lead is known
    if (profile.lead.email && profile.lead.name) {
      const updatedProfile = {
        ...profile,
        moduleResults: {
          ...profile.moduleResults,
          risiko: result
        },
        protection: {
            ...profile.protection,
            incomeProtection: incomeProtection
        },
        scores: {
          ...profile.scores,
          protection: finalProtectionScore
        }
      };
      saveToDatabase(updatedProfile);
    }
  };

  // --- Render Functions ---

  const renderStep1 = () => (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-xl font-bold">1. Cashflow & Fixkosten</h2>
      <InputGroup label="Monatliches Netto-Haushaltseinkommen">
        <NumberInput 
          value={netIncome} 
          onChange={(e) => setNetIncome(parseFloat(e.target.value) || 0)}
          suffix="€" 
        />
      </InputGroup>
      <InputGroup label="Monatliche Fixkosten" subLabel="Wohnen, Energie, Verträge, Abos." error={errors.costs}>
        <NumberInput 
          value={fixedCosts} 
          onChange={(e) => setFixedCosts(parseFloat(e.target.value) || 0)}
          suffix="€" 
        />
      </InputGroup>
      <InputGroup label="Bestehende Kreditraten" subLabel="Monatliche Rückzahlungen.">
        <NumberInput 
          value={debtPayments} 
          onChange={(e) => setDebtPayments(parseFloat(e.target.value) || 0)}
          suffix="€" 
        />
      </InputGroup>
      <InputGroup label="Sonstiger Lebensunterhalt (Variabel)" subLabel="Essen, Kleidung, Freizeit (ca. Wert).">
        <NumberInput 
          value={variableCosts} 
          onChange={(e) => setVariableCosts(parseFloat(e.target.value) || 0)}
          suffix="€" 
        />
      </InputGroup>

      <div className="bg-red-50 p-4 rounded-lg flex justify-between items-center font-bold text-red-800 border border-red-100">
        <span>Monatlicher Bedarf ("Burn Rate"):</span>
        <span>{getMonthlyBurn().toLocaleString()} €</span>
      </div>
      <div className="text-xs text-right text-gray-400 mt-1">
        Freier Cashflow: {Math.max(0, netIncome - getMonthlyBurn()).toLocaleString()} €
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-xl font-bold">2. Rücklagen & Notgroschen</h2>
      <InputGroup label="Verfügbares Geld (Giro, Sparbuch)" subLabel="Sofort verfügbar.">
        <NumberInput 
          value={savings} 
          onChange={(e) => setSavings(parseFloat(e.target.value) || 0)}
          suffix="€" 
        />
      </InputGroup>
      <InputGroup label="Schnell verfügbare Investments" subLabel="Die Sie im Notfall innerhalb einer Woche liquidieren würden (Aktien, Fonds).">
        <NumberInput 
          value={quickInvestments} 
          onChange={(e) => setQuickInvestments(parseFloat(e.target.value) || 0)}
          suffix="€" 
        />
      </InputGroup>

      <div className="bg-green-50 p-4 rounded-lg flex justify-between items-center font-bold text-green-800 border border-green-100">
        <span>Liquiditätsreserve gesamt:</span>
        <span>{getLiquidReserves().toLocaleString()} €</span>
      </div>
      
      {getMonthlyBurn() > 0 && (
         <div className="text-center text-sm font-medium text-gray-600 mt-2">
            Das entspricht ca. <span className="text-[#D70F21] font-bold">{(getLiquidReserves() / getMonthlyBurn()).toFixed(1)} Monaten</span> Ausgaben.
         </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-xl font-bold">3. Risiko-Szenario</h2>
      <p className="text-gray-600 text-sm">Was passiert, wenn das Haupteinkommen wegfällt (Jobverlust, Krankheit)?</p>
      
      <InputGroup label="Dauer des Ausfalls simulieren">
         <div className="flex gap-2">
            {[3, 6, 12].map(m => (
                <button
                    key={m}
                    onClick={() => setShockMonths(m as 3|6|12)}
                    className={`flex-1 py-3 border rounded-lg font-bold transition-all ${
                        shockMonths === m ? 'bg-[#D70F21] text-white border-[#D70F21]' : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                >
                    {m} Monate
                </button>
            ))}
         </div>
      </InputGroup>

      <InputGroup label="Erwartete Unterstützung pro Monat" subLabel="z.B. Arbeitslosengeld (ca. 55% vom Netto) oder Partner-Einkommen.">
        <NumberInput 
          value={supportMonthly} 
          onChange={(e) => setSupportMonthly(parseFloat(e.target.value) || 0)}
          suffix="€" 
        />
      </InputGroup>
      {supportMonthly === 0 && (
          <button 
            onClick={() => setSupportMonthly(Math.round(netIncome * 0.55))}
            className="text-xs text-[#D70F21] underline"
          >
            Auf ca. AMS-Niveau (55%) setzen
          </button>
      )}

      <div className="mt-6 p-4 bg-gray-100 rounded-lg">
         <h4 className="font-bold text-gray-700 mb-2">Szenario-Check:</h4>
         <div className="flex justify-between text-sm mb-1">
            <span>Kosten pro Monat:</span>
            <span>{getMonthlyBurn().toLocaleString()} €</span>
         </div>
         <div className="flex justify-between text-sm mb-2 pb-2 border-b border-gray-300">
            <span>Einnahmen (Stütze):</span>
            <span>{supportMonthly.toLocaleString()} €</span>
         </div>
         <div className="flex justify-between font-bold text-red-600">
            <span>Defizit pro Monat:</span>
            <span>-{Math.max(0, getMonthlyBurn() - supportMonthly).toLocaleString()} €</span>
         </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-xl font-bold">4. Absicherung & Schutz</h2>
      
      <InputGroup label="Ist Ihr Einkommen gegen Berufsunfähigkeit abgesichert?">
        <div className="flex gap-2">
           {['yes', 'no', 'unknown'].map((val) => (
             <button
               key={val}
               onClick={() => setIncomeProtection(val as YesNoUnknown)}
               className={`flex-1 py-3 px-2 rounded-lg border text-sm font-medium transition-colors ${
                 incomeProtection === val 
                   ? 'bg-[#D70F21] text-white border-[#D70F21]' 
                   : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
               }`}
             >
               {val === 'yes' ? 'Ja' : val === 'no' ? 'Nein' : 'Unsicher'}
             </button>
           ))}
        </div>
      </InputGroup>

      <InputGroup label="Könnten Sie kurzfristig Kosten stark reduzieren?">
        <div className="flex gap-2">
            <button
               onClick={() => setCanReduceCosts(true)}
               className={`flex-1 py-3 border rounded-lg text-sm transition-colors ${canReduceCosts ? 'bg-[#D70F21] text-white border-[#D70F21]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
                Ja, möglich
            </button>
            <button
               onClick={() => setCanReduceCosts(false)}
               className={`flex-1 py-3 border rounded-lg text-sm transition-colors ${!canReduceCosts ? 'bg-[#D70F21] text-white border-[#D70F21]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
            >
                Nein, schwierig
            </button>
        </div>
      </InputGroup>
    </div>
  );

  const renderResultsDashboard = () => {
    // Calculate locally for display to ensure data is fresh and available
    const res = calculateResult();

    const data = [
        { name: 'Reserve', value: res.liquidReserves, fill: '#10B981' },
        { name: `Bedarf (${res.shockMonths} Mo.)`, value: res.totalShockNeed, fill: '#EF4444' }
    ];

    return (
      <div className="animate-fade-in space-y-8 pb-8">
        <div>
           <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">Ergebnis Stresstest</h2>
              <ScoreBadge score={res.assessment === 'green' ? 90 : res.assessment === 'yellow' ? 60 : 30} />
           </div>
           <p className="text-gray-600">{res.generatedSummary}</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl">
            <div>
               <p className="text-xs text-gray-500 uppercase">Monatlicher Burn</p>
               <p className="font-bold">{res.monthlyBurn.toLocaleString()} €</p>
            </div>
            <div>
               <p className="text-xs text-gray-500 uppercase">Liquidität</p>
               <p className="font-bold text-blue-600">{res.liquidReserves.toLocaleString()} €</p>
            </div>
            <div>
               <p className="text-xs text-gray-500 uppercase">Reichweite</p>
               <p className={`font-bold text-xl ${res.assessment === 'red' ? 'text-red-600' : 'text-green-600'}`}>
                 {res.runwayMonths} Monate
               </p>
            </div>
            <div className="border-l pl-4 border-gray-300">
               <p className="text-xs text-gray-500 uppercase font-bold text-[#D70F21]">Bedarf ({res.shockMonths} Mo)</p>
               <p className="font-bold">{res.totalShockNeed.toLocaleString()} €</p>
            </div>
        </div>

        {/* Chart */}
        <Card>
            <h3 className="font-bold mb-4">Deckungs-Check ({res.shockMonths} Monate Szenario)</h3>
            <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} />
                        <Tooltip formatter={(val) => `${val.toLocaleString()} €`} />
                        <Bar dataKey="value" barSize={30} radius={[0, 4, 4, 0]}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            {res.gapToSafety > 0 && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 text-center rounded-lg border border-red-100 font-semibold">
                    Deckungslücke: -{res.gapToSafety.toLocaleString()} €
                </div>
            )}
        </Card>

        {/* Recommendations */}
        <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white border rounded-lg p-4 shadow-sm">
                <div className="text-2xl mb-2">💰</div>
                <h4 className="font-bold text-sm mb-2">Notgroschen</h4>
                <p className="text-xs text-gray-600">
                    {res.runwayMonths < 3 
                     ? "Dringend auf 3 Monatsausgaben erhöhen. Erste Priorität!" 
                     : "Weiter ausbauen auf 6 Monatsgehälter für volle Sicherheit."}
                </p>
            </div>
            <div className="bg-white border rounded-lg p-4 shadow-sm">
                <div className="text-2xl mb-2">📉</div>
                <h4 className="font-bold text-sm mb-2">Fixkosten</h4>
                <p className="text-xs text-gray-600">
                    Eine Reduktion der monatlichen Fixkosten um 10% würde Ihre Reichweite sofort spürbar verlängern.
                </p>
            </div>
            <div className="bg-white border rounded-lg p-4 shadow-sm">
                <div className="text-2xl mb-2">🛡️</div>
                <h4 className="font-bold text-sm mb-2">Absicherung</h4>
                <p className="text-xs text-gray-600">
                    {res.incomeProtection === 'yes' 
                     ? "Versicherungssumme prüfen: Deckt sie die aktuelle Lücke?" 
                     : "Einkommensschutz ist essentiell, da Reserven endlich sind."}
                </p>
            </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 pt-4 border-t">
           <Button onClick={() => navigate('/report')} className="flex-1">
             Ergebnis in Report übernehmen
           </Button>
           {profile.recommendedModules.includes('pension') && (
               <Button onClick={() => navigate('/module/pension')} variant="secondary">
                 Pensions-Check
               </Button>
           )}
           <Button onClick={() => navigate('/results')} variant="outline">
             Zurück zum Hub
           </Button>
        </div>
        
        <p className="text-xs text-gray-400 text-center mt-4">
           Disclaimer: Dieses Tool ist eine unverbindliche Orientierung und ersetzt keine individuelle Beratung.
        </p>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between text-xs font-semibold uppercase text-gray-400 mb-2">
          <span>Schritt {step} von {totalSteps}</span>
          <span>Risiko-Stresstest AT</span>
        </div>
        <ProgressBar current={step} total={totalSteps} />
      </div>

      <Card className="mb-8 min-h-[400px]">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderResultsDashboard()}
      </Card>

      {!showResult && (
        <div className="flex justify-between">
            <Button variant="outline" onClick={handlePrev}>
            {step === 1 ? 'Abbrechen' : 'Zurück'}
            </Button>
            <Button onClick={handleNext} className="w-1/2">
            {step === totalSteps ? 'Auswerten' : 'Weiter'}
            </Button>
        </div>
      )}
    </div>
  );
};