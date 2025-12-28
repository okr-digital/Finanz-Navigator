import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { Button, Card, InputGroup, NumberInput, Select, ProgressBar } from '../components/UI';
import { PensionModuleResult, PensionScenario, EmploymentType } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { saveToDatabase } from '../services/api';

export const PensionModule: React.FC = () => {
  const { profile, updateNestedProfile, updateProfile } = useUser();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [showResult, setShowResult] = useState(false);

  // Local State for Wizard
  const [localData, setLocalData] = useState({
    age: profile.basic.age || 30,
    netIncome: profile.cashflow.netIncomeMonthly || 2000,
    employment: profile.basic.employment || 'angestellt',
    
    desiredPension: 0, // Will be calculated in effect
    desiredRetirementAge: 65,
    isPartTimeOrKarenz: false,
    
    currentSavingsMonthly: 0,
    currentSavingsStock: 0,
    
    // Assumptions
    replacementRate: 0.60, // 60% statutory
    pensionDuration: 20,
    inflationPA: 0.02,
    
    scenarioAReturn: 0.03,
    scenarioBReturn: 0.05,
  });

  // Errors state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize defaults once netIncome is available or changes
  useEffect(() => {
    if (localData.desiredPension === 0 && localData.netIncome > 0) {
      setLocalData(prev => ({ ...prev, desiredPension: Math.round(prev.netIncome * 0.7) }));
    }
  }, [localData.netIncome]);

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (currentStep === 1) {
      if (localData.age < 16 || localData.age > 70) {
        newErrors.age = "Bitte geben Sie ein realistisches Alter an.";
        isValid = false;
      }
      if (localData.netIncome <= 0) {
        newErrors.netIncome = "Bitte geben Sie Ihr Netto-Einkommen an.";
        isValid = false;
      }
    }
    if (currentStep === 2) {
      if (localData.desiredRetirementAge <= localData.age) {
        newErrors.desiredRetirementAge = "Pensionsalter muss höher als aktuelles Alter sein.";
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      if (step < 4) {
        setStep(step + 1);
      } else {
        calculateAndShowResults();
      }
    }
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
    else navigate('/results');
  };

  // --- Calculation Engine ---

  const calculateAndShowResults = () => {
    const {
      age, netIncome, desiredRetirementAge, isPartTimeOrKarenz,
      desiredPension, replacementRate, pensionDuration,
      currentSavingsMonthly, currentSavingsStock,
      scenarioAReturn, scenarioBReturn
    } = localData;

    // 1. Calculate Statutory Pension
    let effectiveReplacementRate = replacementRate;
    if (isPartTimeOrKarenz) {
      effectiveReplacementRate = replacementRate * 0.9;
    }
    const estimatedStatutory = Math.round(netIncome * effectiveReplacementRate);

    // 2. Calculate Gap
    const gapMonthly = Math.max(0, desiredPension - estimatedStatutory);

    // 3. Capital Needed
    // Simple calc: Gap * 12 * Years (ignoring inflation adjustment on payout phase for MVP simplicity, 
    // or assuming desiredPension is already in "today's purchasing power")
    const capitalNeeded = gapMonthly * 12 * pensionDuration;

    // 4. Calculate PMT (Monthly Saving Needed)
    const yearsToRetirement = Math.max(1, desiredRetirementAge - age);
    const monthsToRetirement = yearsToRetirement * 12;

    const calculatePMT = (ratePA: number, targetFV: number, startPV: number, months: number) => {
      // Rate per month
      const r = ratePA / 12;
      
      // Future Value of Starting Capital: PV * (1+r)^n
      const fvOfStart = startPV * Math.pow(1 + r, months);
      
      // Remaining Capital to build via monthly payments
      const remainingFV = targetFV - fvOfStart;

      if (remainingFV <= 0) return 0;

      // PMT formula: PMT = FV * r / ((1+r)^n - 1)
      const pmt = remainingFV * r / (Math.pow(1 + r, months) - 1);
      return Math.round(pmt);
    };

    const reqPMT_A = calculatePMT(scenarioAReturn, capitalNeeded, currentSavingsStock, monthsToRetirement);
    const reqPMT_B = calculatePMT(scenarioBReturn, capitalNeeded, currentSavingsStock, monthsToRetirement);

    // 5. Assessment
    const gapPercentage = gapMonthly / desiredPension;
    let assessment: 'green' | 'yellow' | 'red' = 'green';
    if (gapPercentage > 0.25) assessment = 'red';
    else if (gapPercentage > 0.10) assessment = 'yellow';

    // 6. Summary Text
    let summary = "";
    if (gapMonthly === 0) {
      summary = "Hervorragend! Nach aktuellen Schätzungen deckt die staatliche Pension Ihre Wünsche ab.";
    } else {
      summary = `Es droht eine Versorgungslücke von ca. ${gapMonthly} € pro Monat. Ohne private Vorsorge fehlen Ihnen über ${pensionDuration} Jahre insgesamt ca. ${(capitalNeeded/1000).toFixed(1)}k € Kapital.`;
    }

    const result: PensionModuleResult = {
      desiredPensionMonthly: desiredPension,
      retirementAge: desiredRetirementAge,
      replacementRate: effectiveReplacementRate,
      isPartTimeOrKarenz,
      estimatedStatutoryPensionMonthly: estimatedStatutory,
      gapMonthly,
      capitalNeeded,
      yearsToRetirement,
      currentSavingsMonthly,
      currentSavingsStock,
      pensionDurationYears: pensionDuration,
      scenarioA: {
        returnPA: scenarioAReturn,
        requiredPMT: reqPMT_A,
        extraPMT: Math.max(0, reqPMT_A - currentSavingsMonthly)
      },
      scenarioB: {
        returnPA: scenarioBReturn,
        requiredPMT: reqPMT_B,
        extraPMT: Math.max(0, reqPMT_B - currentSavingsMonthly)
      },
      assessment,
      generatedSummary: summary
    };

    // Save to Context
    updateNestedProfile('moduleResults', { pension: result });
    
    // Update Global Score based on this deep dive
    let newRetirementScore = profile.scores.retirement;
    if (assessment === 'green') newRetirementScore = Math.max(newRetirementScore, 85);
    if (assessment === 'yellow') newRetirementScore = 60;
    if (assessment === 'red') newRetirementScore = 30;
    
    updateNestedProfile('scores', { retirement: newRetirementScore });
    
    // Recalculate Overall Score implicitly if needed, or simple update
    const newOverall = Math.round((
      profile.scores.liquidity + 
      profile.scores.wealth + 
      profile.scores.protection + 
      newRetirementScore + 
      profile.scores.debt
    ) / 5);
    updateNestedProfile('scores', { overall: newOverall });

    // AUTOSAVE if Lead is already known
    // We construct the updated profile object manually to save immediately
    // since React state updates are async
    if (profile.lead.email && profile.lead.name) {
      const updatedProfile = {
        ...profile,
        moduleResults: {
          ...profile.moduleResults,
          pension: result
        },
        scores: {
          ...profile.scores,
          retirement: newRetirementScore,
          overall: newOverall
        }
      };
      saveToDatabase(updatedProfile);
    }

    setShowResult(true);
  };


  // --- Render Functions ---

  const renderStep1 = () => (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-xl font-bold">1. Ausgangslage</h2>
      <InputGroup label="Ihr aktuelles Alter" error={errors.age}>
        <NumberInput 
          value={localData.age} 
          onChange={(e) => setLocalData({...localData, age: parseInt(e.target.value) || 0})} 
        />
      </InputGroup>
      <InputGroup label="Monatliches Netto-Einkommen" error={errors.netIncome}>
        <NumberInput 
          value={localData.netIncome} 
          onChange={(e) => setLocalData({...localData, netIncome: parseInt(e.target.value) || 0})}
          suffix="€" 
        />
      </InputGroup>
      <InputGroup label="Art der Beschäftigung">
        <Select 
          value={localData.employment}
          onChange={(e) => setLocalData({...localData, employment: e.target.value as EmploymentType})}
        >
          <option value="angestellt">Angestellt / Beamter</option>
          <option value="selbstständig">Selbstständig / Unternehmer</option>
          <option value="teilzeit">Teilzeit / Geringfügig</option>
        </Select>
      </InputGroup>
    </div>
  );

  const renderStep2 = () => (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-xl font-bold">2. Ihr Zielbild</h2>
      <InputGroup label="Gewünschte Pension (netto/Monat)" subLabel="Wir schlagen 70% Ihres aktuellen Einkommens vor.">
        <NumberInput 
          value={localData.desiredPension} 
          onChange={(e) => setLocalData({...localData, desiredPension: parseInt(e.target.value) || 0})}
          suffix="€" 
        />
      </InputGroup>
      <InputGroup label="Geplantes Pensionsantrittsalter" error={errors.desiredRetirementAge}>
        <NumberInput 
          value={localData.desiredRetirementAge} 
          onChange={(e) => setLocalData({...localData, desiredRetirementAge: parseInt(e.target.value) || 0})}
          placeholder="65" 
        />
      </InputGroup>
      <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
        <input 
          type="checkbox" 
          id="karenz"
          className="w-5 h-5 text-[#D70F21]"
          checked={localData.isPartTimeOrKarenz}
          onChange={(e) => setLocalData({...localData, isPartTimeOrKarenz: e.target.checked})}
        />
        <label htmlFor="karenz" className="text-sm text-gray-700">
          Ich plane längere Teilzeitphasen oder Karenzzeiten (reduziert die staatliche Prognose).
        </label>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-xl font-bold">3. Aktuelle Vorsorge</h2>
      <InputGroup label="Aktuelle monatliche Sparrate für Pension" subLabel="Private Rentenversicherung, Fondssparplan etc.">
        <NumberInput 
          value={localData.currentSavingsMonthly} 
          onChange={(e) => setLocalData({...localData, currentSavingsMonthly: parseInt(e.target.value) || 0})}
          suffix="€" 
        />
      </InputGroup>
      <InputGroup label="Bereits angespartes Kapital" subLabel="Rückkaufswerte Versicherungen, Depotwert.">
        <NumberInput 
          value={localData.currentSavingsStock} 
          onChange={(e) => setLocalData({...localData, currentSavingsStock: parseInt(e.target.value) || 0})}
          suffix="€" 
        />
      </InputGroup>
      <div className="text-center">
        <button 
          className="text-sm text-gray-500 underline"
          onClick={() => setLocalData({...localData, currentSavingsMonthly: 0, currentSavingsStock: 0})}
        >
          Ich habe aktuell keine private Vorsorge
        </button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-xl font-bold">4. Annahmen & Szenarien</h2>
      <p className="text-sm text-gray-500">Diese Werte beeinflussen die Berechnung des Kapitalbedarfs.</p>
      
      <InputGroup label="Bezugsdauer der Pension (Jahre)" subLabel="Wie lange soll das Kapital reichen?">
         <NumberInput 
          value={localData.pensionDuration} 
          onChange={(e) => setLocalData({...localData, pensionDuration: parseInt(e.target.value) || 20})}
        />
      </InputGroup>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 border rounded-lg bg-gray-50">
           <p className="font-bold text-sm mb-2 text-gray-900">Szenario A (Konservativ)</p>
           <label className="text-xs text-gray-500 block">Rendite p.a.</label>
           <select 
             className="w-full bg-white border rounded p-1 text-sm mt-1 text-gray-900 focus:ring-1 focus:ring-gray-400 outline-none"
             value={localData.scenarioAReturn}
             onChange={(e) => setLocalData({...localData, scenarioAReturn: parseFloat(e.target.value)})}
           >
             <option value={0.01}>1%</option>
             <option value={0.02}>2%</option>
             <option value={0.03}>3%</option>
             <option value={0.04}>4%</option>
           </select>
        </div>
        <div className="p-3 border rounded-lg bg-white shadow-sm border-blue-100">
           <p className="font-bold text-sm mb-2 text-blue-800">Szenario B (Optimistisch)</p>
           <label className="text-xs text-gray-500 block">Rendite p.a.</label>
           <select 
             className="w-full bg-white border rounded p-1 text-sm mt-1 text-gray-900 focus:ring-1 focus:ring-blue-400 outline-none"
             value={localData.scenarioBReturn}
             onChange={(e) => setLocalData({...localData, scenarioBReturn: parseFloat(e.target.value)})}
           >
             <option value={0.04}>4%</option>
             <option value={0.05}>5%</option>
             <option value={0.06}>6%</option>
             <option value={0.07}>7%</option>
             <option value={0.08}>8%</option>
           </select>
        </div>
      </div>
    </div>
  );

  const renderResultsDashboard = () => {
    const res = profile.moduleResults.pension;
    if (!res) return null;

    const chartData = [
      { name: 'Gesetzlich', value: res.estimatedStatutoryPensionMonthly, fill: '#9CA3AF' },
      { name: 'Lücke', value: res.gapMonthly, fill: '#EF4444' },
      { name: 'Ziel', value: res.desiredPensionMonthly, fill: '#10B981', isTotal: true },
    ];

    return (
      <div className="animate-fade-in">
        <div className="bg-white rounded-xl shadow-lg border-t-4 border-[#D70F21] overflow-hidden mb-8">
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-2">Ihr Pensions-Check Ergebnis</h2>
            <p className="text-gray-600 mb-6">{res.generatedSummary}</p>

            {/* Key Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
               <div className="p-3 bg-gray-50 rounded-lg text-center">
                 <p className="text-xs text-gray-500 uppercase">Ziel-Pension</p>
                 <p className="font-bold text-lg text-gray-900">{res.desiredPensionMonthly} €</p>
               </div>
               <div className="p-3 bg-gray-50 rounded-lg text-center">
                 <p className="text-xs text-gray-500 uppercase">Staatlich (Prognose)</p>
                 <p className="font-bold text-lg text-gray-900">{res.estimatedStatutoryPensionMonthly} €</p>
               </div>
               <div className="p-3 bg-red-50 text-red-700 rounded-lg text-center border border-red-100">
                 <p className="text-xs uppercase font-bold">Monatliche Lücke</p>
                 <p className="font-bold text-xl">{res.gapMonthly} €</p>
               </div>
               <div className="p-3 bg-gray-50 rounded-lg text-center">
                 <p className="text-xs text-gray-500 uppercase">Kapitalbedarf</p>
                 <p className="font-bold text-lg text-gray-900">{(res.capitalNeeded / 1000).toFixed(0)}k €</p>
               </div>
            </div>

            {/* Chart */}
            <div className="h-64 w-full mb-8">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `${value} €`} />
                  <ReferenceLine y={res.desiredPensionMonthly} stroke="#10B981" strokeDasharray="3 3" label="Ziel" />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Scenarios */}
            <h3 className="font-bold text-lg mb-4 text-gray-900">Lösungsszenarien</h3>
            <p className="text-sm text-gray-500 mb-4">
               Zusätzliche monatliche Sparrate nötig, um die Lücke komplett zu schließen (bis Alter {res.retirementAge}).
            </p>
            <div className="grid md:grid-cols-2 gap-4 mb-8">
               <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-gray-700">Konservativ</span>
                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">{(res.scenarioA.returnPA * 100).toFixed(0)}% Rendite</span>
                  </div>
                  <div className="text-3xl font-bold text-gray-800 mb-1">
                     {res.scenarioA.extraPMT} € <span className="text-sm font-normal text-gray-500">/ monatlich</span>
                  </div>
                  {res.currentSavingsMonthly > 0 && <p className="text-xs text-green-600">Bereits abgedeckt: {res.currentSavingsMonthly} €</p>}
               </div>

               <div className="border border-blue-100 bg-blue-50 rounded-xl p-4 relative overflow-hidden">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-blue-900">Optimiert</span>
                    <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">{(res.scenarioB.returnPA * 100).toFixed(0)}% Rendite</span>
                  </div>
                  <div className="text-3xl font-bold text-blue-700 mb-1">
                     {res.scenarioB.extraPMT} € <span className="text-sm font-normal text-blue-600">/ monatlich</span>
                  </div>
                  <p className="text-xs text-blue-500 mt-2">Höhere Ertragschancen senken den Sparbedarf.</p>
               </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
               <Button onClick={() => navigate('/report')} className="flex-1">
                 Ergebnis in Report übernehmen
               </Button>
               {profile.recommendedModules.includes('finanzierung') && (
                  <Button onClick={() => navigate('/module/finanzierung')} variant="secondary">
                     Weiter zum Finanzierungs-Check
                  </Button>
               )}
            </div>
          </div>
        </div>
        
        <p className="text-xs text-center text-gray-400 max-w-lg mx-auto">
          Hinweis: Dieses Tool ist eine unverbindliche Orientierung und ersetzt keine individuelle Beratung oder verbindliche Pensionsberechnung der PVA. Inflation und Steuerliche Aspekte sind vereinfacht dargestellt.
        </p>
      </div>
    );
  };

  if (showResult) {
    return (
       <div className="max-w-4xl mx-auto px-4 py-8">
          {renderResultsDashboard()}
       </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between text-xs font-semibold uppercase text-gray-400 mb-2">
          <span>Schritt {step} von 4</span>
          <span>Pensions-Check AT</span>
        </div>
        <ProgressBar current={step} total={4} />
      </div>

      <Card className="mb-8 min-h-[400px]">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handlePrev}>
          {step === 1 ? 'Abbrechen' : 'Zurück'}
        </Button>
        <Button onClick={handleNext} className="w-1/2">
          {step === 4 ? 'Berechnen' : 'Weiter'}
        </Button>
      </div>
    </div>
  );
};