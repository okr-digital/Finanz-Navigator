import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { Button, Card, InputGroup, NumberInput, Select, ProgressBar, ScoreBadge } from '../components/UI';
import { FinanzierungModuleResult, AncillaryCostItem, FinanzierungScenario } from '../types';
import { saveToDatabase } from '../services/api';

export const FinanzierungModule: React.FC = () => {
  const { profile, updateNestedProfile } = useUser();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const totalSteps = 6;

  // Local State
  const [purchasePrice, setPurchasePrice] = useState<number>(300000);
  const [purpose, setPurpose] = useState<string>('kauf');
  const [equity, setEquity] = useState<number>(profile.assets.savings || 50000);
  const [equityWork, setEquityWork] = useState<number>(0);
  
  // Ancillary Costs
  const [ancillaryItems, setAncillaryItems] = useState<AncillaryCostItem[]>([
    { id: 'makler', label: 'Maklerprovision', value: 3.6, type: 'percent', isActive: true }, 
    { id: 'grest', label: 'Grunderwerbsteuer', value: 3.5, type: 'percent', isActive: true },
    { id: 'gb', label: 'Grundbuchseintragung', value: 1.1, type: 'percent', isActive: true },
    { id: 'notar', label: 'Notar / Vertrag', value: 2500, type: 'fixed', isActive: true },
    { id: 'bank', label: 'Bankgebühren / Pfandrecht', value: 1.2, type: 'percent', isActive: true },
    { id: 'gutachten', label: 'Schätzung / Gutachten', value: 400, type: 'fixed', isActive: true },
    { id: 'sonstige', label: 'Sonstige / Umzug', value: 0, type: 'fixed', isActive: false },
  ]);

  // Income & Debt
  const [netIncome, setNetIncome] = useState<number>(profile.cashflow.netIncomeMonthly || 3000);
  const [existingDebt, setExistingDebt] = useState<number>(profile.debts.consumerLoansMonthly || 0);

  // Financing Params
  const [termYears, setTermYears] = useState<number>(30);
  const [rateA, setRateA] = useState<number>(3.5); // Fix
  const [rateB, setRateB] = useState<number>(4.5); // Variable / Stress

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Helpers
  const getAncillaryTotal = () => {
    return ancillaryItems.reduce((sum, item) => {
      if (!item.isActive) return sum;
      const amount = item.type === 'percent' ? (purchasePrice * (item.value / 100)) : item.value;
      return sum + amount;
    }, 0);
  };

  const getLoanAmount = () => {
    const totalCosts = purchasePrice + getAncillaryTotal();
    const totalEquity = equity + equityWork;
    return Math.max(0, totalCosts - totalEquity);
  };

  const calculatePMT = (amount: number, ratePA: number, years: number) => {
    if (amount <= 0) return 0;
    const r = ratePA / 100 / 12;
    const n = years * 12;
    if (r === 0) return amount / n;
    return amount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  };

  // Validation
  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (currentStep === 1) {
      if (purchasePrice <= 0) {
        newErrors.purchasePrice = "Bitte geben Sie einen realistischen Kaufpreis an.";
        isValid = false;
      }
    }
    if (currentStep === 4) {
      if (netIncome <= 0) {
        newErrors.netIncome = "Bitte geben Sie ein Einkommen an.";
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      if (step < 5) {
        setStep(step + 1);
      } else {
        // Transitioning to Result Step (6)
        saveResults();
        setStep(6);
      }
    }
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
    else navigate('/results');
  };

  // --- Calculations for Result ---
  const calculateResult = (): FinanzierungModuleResult => {
    const loanAmount = getLoanAmount();
    const ancillaryTotal = getAncillaryTotal();
    const pmtA = calculatePMT(loanAmount, rateA, termYears);
    const pmtB = calculatePMT(loanAmount, rateB, termYears);

    const dstiA = (pmtA + existingDebt) / netIncome;
    const dstiB = (pmtB + existingDebt) / netIncome;
    const ltv = loanAmount / purchasePrice;

    // Traffic Lights
    const ltvStatus = ltv <= 0.90 ? 'green' : ltv <= 0.95 ? 'yellow' : 'red';
    const dstiAStatus = dstiA <= 0.40 ? 'green' : dstiA <= 0.45 ? 'yellow' : 'red';
    const dstiBStatus = dstiB <= 0.40 ? 'green' : dstiB <= 0.45 ? 'yellow' : 'red';
    const termStatus = termYears <= 35 ? 'green' : 'red';

    // Assessment
    let assessment: 'green' | 'yellow' | 'red' = 'green';
    if (ltvStatus === 'red' || dstiAStatus === 'red') assessment = 'red';
    else if (ltvStatus === 'yellow' || dstiAStatus === 'yellow') assessment = 'yellow';
    
    // Additional logic: if B is significantly worse
    if (assessment === 'green' && dstiBStatus === 'red') assessment = 'yellow';

    const scenarioA: FinanzierungScenario = {
      label: 'Szenario A',
      interestPA: rateA,
      paymentMonthly: Math.round(pmtA),
      totalRepayment: Math.round(pmtA * termYears * 12),
      dsti: dstiA
    };

    const scenarioB: FinanzierungScenario = {
      label: 'Szenario B',
      interestPA: rateB,
      paymentMonthly: Math.round(pmtB),
      totalRepayment: Math.round(pmtB * termYears * 12),
      dsti: dstiB
    };

    let summary = "";
    if (assessment === 'green') summary = "Ihr Finanzierungsvorhaben wirkt solide und liegt innerhalb der KIM-Kriterien.";
    else if (assessment === 'yellow') summary = "Das Vorhaben ist möglich, liegt aber in Grenzbereichen. Eigenmittel oder Laufzeit prüfen.";
    else summary = "Achtung: Wichtige Kennzahlen (Beleihung oder Schuldendienst) liegen außerhalb der empfohlenen Grenzen.";

    return {
      purchasePrice,
      purpose,
      equity,
      equityWork,
      ancillaryCosts: { items: ancillaryItems, total: ancillaryTotal },
      loanAmount,
      termYears,
      netIncomeMonthly: netIncome,
      existingDebtPaymentsMonthly: existingDebt,
      scenarioA,
      scenarioB,
      ltv,
      kimCheck: { ltvStatus, dstiAStatus, dstiBStatus, termStatus },
      assessment,
      generatedSummary: summary
    };
  };

  const saveResults = () => {
    const result = calculateResult();

    // Save Context
    updateNestedProfile('moduleResults', { finanzierung: result });
    
    // Update Debt Score
    let debtScore = 80;
    if (result.assessment === 'yellow') debtScore = 55;
    if (result.assessment === 'red') debtScore = 30;
    updateNestedProfile('scores', { debt: debtScore });

    // AUTOSAVE if Lead is known
    if (profile.lead.email && profile.lead.name) {
      const updatedProfile = {
        ...profile,
        moduleResults: {
          ...profile.moduleResults,
          finanzierung: result
        },
        scores: {
          ...profile.scores,
          debt: debtScore
        }
      };
      saveToDatabase(updatedProfile);
    }
  };

  // --- Step Components ---

  const renderStep1 = () => (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-xl font-bold">1. Immobilie & Vorhaben</h2>
      <InputGroup label="Kaufpreis / Immobilienwert" error={errors.purchasePrice}>
        <NumberInput 
          value={purchasePrice} 
          onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)}
          suffix="€" 
        />
      </InputGroup>
      <InputGroup label="Verwendungszweck">
        <Select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
          <option value="kauf">Kauf (Bestand)</option>
          <option value="neubau">Neubau</option>
          <option value="sanierung">Sanierung</option>
        </Select>
      </InputGroup>
      <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 border border-blue-100">
        💡 Tipp: Rechnen Sie bei Sanierungen mit einem Puffer von ca. 15-20%.
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-xl font-bold">2. Eigenmittel</h2>
      <InputGroup label="Verfügbares Eigenkapital" subLabel="Sparguthaben, Schenkungen, Verkaufserlöse.">
        <NumberInput 
          value={equity} 
          onChange={(e) => setEquity(parseFloat(e.target.value) || 0)}
          suffix="€" 
        />
      </InputGroup>
      <InputGroup label="Eigenleistung (Muskelhypothek)" subLabel="Wert der selbst durchgeführten Arbeiten. Banken erkennen dies oft nur begrenzt an.">
        <NumberInput 
          value={equityWork} 
          onChange={(e) => setEquityWork(parseFloat(e.target.value) || 0)}
          suffix="€" 
        />
      </InputGroup>
      <div className="p-4 bg-gray-50 border rounded-lg flex justify-between items-center font-bold">
        <span>Zwischensumme Eigenmittel:</span>
        <span className="text-[#D70F21]">{(equity + equityWork).toLocaleString('de-AT')} €</span>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-xl font-bold">3. Nebenkosten</h2>
      <p className="text-sm text-gray-500 mb-4">Passen Sie die Positionen an. Werte sind Orientierungshilfen.</p>
      
      <div className="space-y-3">
        {ancillaryItems.map((item, index) => {
          const calculatedVal = item.isActive 
            ? (item.type === 'percent' ? Math.round(purchasePrice * item.value / 100) : item.value) 
            : 0;

          return (
            <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${item.isActive ? 'bg-blue-50/30 border-gray-300 shadow-sm' : 'bg-gray-50 border-transparent opacity-60'}`}>
              <input 
                type="checkbox" 
                checked={item.isActive}
                onChange={(e) => {
                  const newItems = [...ancillaryItems];
                  newItems[index].isActive = e.target.checked;
                  setAncillaryItems(newItems);
                }}
                className="w-5 h-5 accent-[#D70F21] rounded focus:ring-0 cursor-pointer"
              />
              <div className="flex-grow min-w-0">
                <p className="text-sm font-semibold truncate text-gray-900">{item.label}</p>
              </div>
              
              {item.isActive && (
                <div className="flex items-center gap-2">
                  <div className="w-24">
                     {/* Using standard input here to handle decimal logic more rawly if needed, 
                         but syncing to number state. valueAsNumber helps. */}
                     <input 
                       type="number" 
                       step={item.type === 'percent' ? 0.1 : 100}
                       value={item.value}
                       onFocus={(e) => e.target.select()}
                       onChange={(e) => {
                         const newItems = [...ancillaryItems];
                         // valueAsNumber avoids the "3." -> 3 parsing issue during typing slightly better in some browsers
                         // fallback to parseFloat if valueAsNumber is NaN but value is valid string?
                         // Simplest: use e.target.value for intermediate if we wanted perfect UX, 
                         // but for now parseFloat is standard.
                         newItems[index].value = parseFloat(e.target.value) || 0;
                         setAncillaryItems(newItems);
                       }}
                       className="w-full p-2 text-right text-sm border border-gray-200 rounded bg-white text-gray-900 focus:ring-2 focus:ring-[#D70F21] focus:border-transparent outline-none"
                     />
                  </div>
                  <button 
                    onClick={() => {
                        const newItems = [...ancillaryItems];
                        newItems[index].type = item.type === 'percent' ? 'fixed' : 'percent';
                        // Reset reasonable default if switching to fix
                        if(newItems[index].type === 'fixed' && newItems[index].value < 100) newItems[index].value = 1000;
                        setAncillaryItems(newItems);
                    }}
                    className="text-xs font-bold text-gray-400 w-6 hover:text-gray-600"
                  >
                    {item.type === 'percent' ? '%' : '€'}
                  </button>
                </div>
              )}
              
              <div className="w-24 text-right text-sm font-bold text-gray-900">
                {calculatedVal.toLocaleString('de-AT')} €
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center pt-4 border-t mt-4">
        <span className="font-bold text-lg text-gray-900">Gesamt Nebenkosten:</span>
        <span className="font-bold text-xl text-[#D70F21]">{getAncillaryTotal().toLocaleString('de-AT')} €</span>
      </div>
      <p className="text-xs text-right text-gray-400">{(getAncillaryTotal() / purchasePrice * 100).toFixed(1)}% vom Kaufpreis</p>
    </div>
  );

  const renderStep4 = () => (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-xl font-bold">4. Einkommen & Haushalt</h2>
      <InputGroup label="Monatliches Haushalts-Netto" error={errors.netIncome} subLabel="Inkl. 13./14. Gehalt, Alimente, etc.">
        <NumberInput 
          value={netIncome} 
          onChange={(e) => setNetIncome(parseFloat(e.target.value) || 0)}
          suffix="€" 
        />
      </InputGroup>
      <InputGroup label="Bestehende Kreditraten" subLabel="Konsumkredite, Leasing, Alimente (monatlich).">
        <NumberInput 
          value={existingDebt} 
          onChange={(e) => setExistingDebt(parseFloat(e.target.value) || 0)}
          suffix="€" 
        />
      </InputGroup>
      
      {/* Live Preview of Loan Amount to show context */}
      <div className="bg-gray-100 p-4 rounded-lg mt-6">
        <p className="text-sm text-gray-500 mb-1">Benötigte Finanzierungssumme (ca.):</p>
        <p className="text-2xl font-bold text-gray-900">{getLoanAmount().toLocaleString('de-AT')} €</p>
      </div>
    </div>
  );

  const renderStep5 = () => {
    const loan = getLoanAmount();
    const pmtA = calculatePMT(loan, rateA, termYears);
    const pmtB = calculatePMT(loan, rateB, termYears);

    return (
      <div className="animate-fade-in space-y-6">
        <h2 className="text-xl font-bold">5. Finanzierung & Zins</h2>
        
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-900 mb-2">Laufzeit: {termYears} Jahre</label>
          <input 
            type="range" 
            min="5" 
            max="35" 
            value={termYears} 
            onChange={(e) => setTermYears(parseInt(e.target.value))}
            className="w-full accent-[#D70F21]"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>5 Jahre</span>
            <span>20</span>
            <span>35 Jahre</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
             <h3 className="font-bold text-green-800 mb-2">Szenario A (Besser)</h3>
             <InputGroup label="Zinssatz">
                <NumberInput 
                  value={rateA} 
                  onChange={(e) => setRateA(parseFloat(e.target.value))}
                  suffix="%" 
                  step={0.1}
                />
             </InputGroup>
             <div className="mt-2 text-center">
               <p className="text-sm text-green-700">Rate: <span className="font-bold text-xl">{Math.round(pmtA)} €</span></p>
             </div>
          </div>

          <div className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
             <h3 className="font-bold text-orange-800 mb-2">Szenario B (Stress)</h3>
             <InputGroup label="Zinssatz">
                <NumberInput 
                  value={rateB} 
                  onChange={(e) => setRateB(parseFloat(e.target.value))}
                  suffix="%" 
                  step={0.1}
                />
             </InputGroup>
             <div className="mt-2 text-center">
               <p className="text-sm text-orange-700">Rate: <span className="font-bold text-xl">{Math.round(pmtB)} €</span></p>
             </div>
          </div>
        </div>
        
        <p className="text-xs text-gray-500 text-center">
           Die monatliche Rate ist eine reine Zins+Tilgungsrate (Annuität). 
        </p>
      </div>
    );
  };

  const renderStep6Results = () => {
    // Calculate results on the fly for display to avoid race conditions with context updates
    const res = calculateResult(); 

    if(res.loanAmount <= 0) {
        return (
            <div className="text-center py-10">
                <h2 className="text-2xl font-bold mb-4">Keine Finanzierung notwendig</h2>
                <p>Ihre Eigenmittel decken die Gesamtkosten. Herzlichen Glückwunsch!</p>
                <Button onClick={() => navigate('/report')} className="mt-8">Zum Report</Button>
            </div>
        )
    }

    const AmpelIcon: React.FC<{status: string}> = ({status}) => {
        const color = status === 'green' ? 'bg-green-500' : status === 'yellow' ? 'bg-yellow-400' : 'bg-red-500';
        return <div className={`w-4 h-4 rounded-full ${color} shadow-sm inline-block mr-2`}></div>;
    };

    return (
      <div className="animate-fade-in space-y-8 pb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ergebnis Finanzierungs-Check</h2>
          <p className="text-gray-600">{res.generatedSummary}</p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl">
             <div>
                <p className="text-xs text-gray-500 uppercase">Kaufpreis</p>
                <p className="font-bold text-gray-900">{res.purchasePrice.toLocaleString()} €</p>
             </div>
             <div>
                <p className="text-xs text-gray-500 uppercase">Eigenmittel</p>
                <p className="font-bold text-green-600">{(res.equity + res.equityWork).toLocaleString()} €</p>
             </div>
             <div>
                <p className="text-xs text-gray-500 uppercase">Nebenkosten</p>
                <p className="font-bold text-gray-900">{res.ancillaryCosts.total.toLocaleString()} €</p>
             </div>
             <div className="border-l pl-4 border-gray-300">
                <p className="text-xs text-gray-500 uppercase font-bold text-[#D70F21]">Kreditbedarf</p>
                <p className="font-bold text-xl text-[#D70F21]">{res.loanAmount.toLocaleString()} €</p>
             </div>
        </div>

        {/* KIM Check Table */}
        <Card className="border-l-4 border-blue-500">
          <h3 className="font-bold text-lg mb-4 text-gray-900">KIM-Verordnung Orientierung (AT)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                <tr>
                  <th className="p-3">Kriterium</th>
                  <th className="p-3">Ihr Wert</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Richtwert</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="p-3 font-medium text-gray-900">Beleihungsquote (LTV)</td>
                  <td className="p-3 text-gray-900">{(res.ltv * 100).toFixed(1)}%</td>
                  <td className="p-3"><AmpelIcon status={res.kimCheck.ltvStatus}/></td>
                  <td className="p-3 text-gray-500">max. 90%</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-gray-900">Schuldendienst (DSTI A)</td>
                  <td className="p-3 text-gray-900">{(res.scenarioA.dsti * 100).toFixed(1)}%</td>
                  <td className="p-3"><AmpelIcon status={res.kimCheck.dstiAStatus}/></td>
                  <td className="p-3 text-gray-500">max. 40%</td>
                </tr>
                <tr>
                   <td className="p-3 font-medium text-gray-900">Laufzeit</td>
                   <td className="p-3 text-gray-900">{res.termYears} Jahre</td>
                   <td className="p-3"><AmpelIcon status={res.kimCheck.termStatus}/></td>
                   <td className="p-3 text-gray-500">max. 35 Jahre</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Scenario Comparison */}
        <div className="grid md:grid-cols-2 gap-6">
           <div className="bg-white border rounded-xl p-5 shadow-sm">
             <div className="flex justify-between mb-4">
               <span className="font-bold text-gray-700">Szenario A ({res.scenarioA.interestPA}%)</span>
               <ScoreBadge score={res.kimCheck.dstiAStatus === 'green' ? 90 : res.kimCheck.dstiAStatus === 'yellow' ? 60 : 30} />
             </div>
             <div className="mb-2">
               <span className="text-3xl font-bold text-gray-900">{res.scenarioA.paymentMonthly} €</span>
               <span className="text-sm text-gray-500"> / Monat</span>
             </div>
             <div className="text-xs text-gray-500">
               Gesamtrückzahlung: <span className="font-semibold">{(res.scenarioA.totalRepayment/1000).toFixed(0)}k €</span>
             </div>
           </div>

           <div className="bg-orange-50 border border-orange-100 rounded-xl p-5 shadow-sm">
             <div className="flex justify-between mb-4">
               <span className="font-bold text-orange-900">Szenario B ({res.scenarioB.interestPA}%)</span>
               <ScoreBadge score={res.kimCheck.dstiBStatus === 'green' ? 90 : res.kimCheck.dstiBStatus === 'yellow' ? 60 : 30} />
             </div>
             <div className="mb-2">
               <span className="text-3xl font-bold text-orange-700">{res.scenarioB.paymentMonthly} €</span>
               <span className="text-sm text-orange-600"> / Monat</span>
             </div>
             <div className="text-xs text-orange-800">
               Differenz: <span className="font-bold">+{res.scenarioB.paymentMonthly - res.scenarioA.paymentMonthly} €/mtl.</span>
             </div>
           </div>
        </div>

        {/* Recommendations Logic */}
        <div className="bg-blue-50 p-4 rounded-lg">
           <h4 className="font-bold text-blue-900 text-sm mb-2 uppercase">Empfehlungen</h4>
           <ul className="list-disc pl-5 text-sm space-y-1 text-blue-800">
              {res.kimCheck.ltvStatus === 'red' && <li>Beleihung zu hoch. Mehr Eigenmittel oder günstigere Immobilie prüfen.</li>}
              {res.kimCheck.dstiAStatus !== 'green' && <li>Monatsrate belastet das Haushaltsbudget stark. Laufzeit verlängern oder Umschuldung bestehender Kredite prüfen.</li>}
              {res.kimCheck.dstiAStatus === 'green' && res.kimCheck.dstiBStatus === 'red' && <li>Achtung bei variablen Zinsen! Eine Zinssteigerung wäre kritisch. Fixzinsbindung empfohlen.</li>}
              {res.assessment === 'green' && <li>Die Finanzierung wirkt solide. Holen Sie konkrete Bankangebote ein.</li>}
           </ul>
        </div>

        <div className="flex flex-col md:flex-row gap-4 pt-4 border-t">
           <Button onClick={() => navigate('/report')} className="flex-1">
             Ergebnis in Report übernehmen
           </Button>
           <Button onClick={() => navigate('/results')} variant="outline">
             Zurück zur Übersicht
           </Button>
        </div>
        
        <p className="text-xs text-gray-400 text-center mt-4">
           Disclaimer: Dieses Tool ist eine unverbindliche Orientierung und ersetzt keine Finanzierungszusage oder individuelle Beratung. 
           Berechnungen sind vereinfachte Richtwerte (Annuitätendarlehen).
        </p>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between text-xs font-semibold uppercase text-gray-400 mb-2">
          <span>Schritt {step} von {totalSteps}</span>
          <span>Immo-Finanzierung AT</span>
        </div>
        <ProgressBar current={step} total={totalSteps} />
      </div>

      <Card className="mb-8 min-h-[400px]">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
        {step === 6 && renderStep6Results()}
      </Card>

      {step < 6 && (
        <div className="flex justify-between">
            <Button variant="outline" onClick={handlePrev}>
            {step === 1 ? 'Abbrechen' : 'Zurück'}
            </Button>
            <Button onClick={handleNext} className="w-1/2">
            Weiter
            </Button>
        </div>
      )}
    </div>
  );
};