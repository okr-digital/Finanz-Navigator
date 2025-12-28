import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { Button, InputGroup, NumberInput, Select, ProgressBar, Card } from '../components/UI';
import { HouseholdType, EmploymentType, YesNoUnknown } from '../types';

export const Check: React.FC = () => {
  const navigate = useNavigate();
  const { profile, updateNestedProfile, calculateAndSave } = useUser();
  const [step, setStep] = useState(1);
  const totalSteps = 5;

  // Local state for validation per step
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (currentStep === 1) {
      if (!profile.basic.age) {
        newErrors.age = "Bitte geben Sie Ihr Alter an.";
        isValid = false;
      } else if (profile.basic.age < 16 || profile.basic.age > 100) {
        newErrors.age = "Bitte geben Sie ein realistisches Alter an.";
        isValid = false;
      }
    }

    if (currentStep === 2) {
      if (!profile.cashflow.netIncomeMonthly) {
        newErrors.netIncome = "Bitte geben Sie Ihr Netto-Einkommen an.";
        isValid = false;
      }
      if (!profile.cashflow.fixedCostsMonthly) {
        newErrors.fixedCosts = "Bitte geben Sie Ihre monatlichen Fixkosten an.";
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      if (step < totalSteps) {
        setStep(step + 1);
      } else {
        // Final step
        calculateAndSave();
        navigate('/results');
      }
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
    else navigate('/');
  };

  // --- Step Render Functions ---

  const renderStep1Basic = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold mb-6">Ihre Basisdaten</h2>
      <InputGroup label="Wie alt sind Sie?" error={errors.age}>
        <NumberInput 
          value={profile.basic.age || ''} 
          onChange={(e) => updateNestedProfile('basic', { age: parseInt(e.target.value) || null })}
          placeholder="z.B. 35"
        />
      </InputGroup>
      
      <InputGroup label="Wie leben Sie aktuell?">
        <Select 
          value={profile.basic.householdType}
          onChange={(e) => updateNestedProfile('basic', { householdType: e.target.value as HouseholdType })}
        >
          <option value="single">Single</option>
          <option value="paar">Paar</option>
          <option value="familie">Familie mit Kindern</option>
        </Select>
      </InputGroup>

      <InputGroup label="Ihre berufliche Situation?">
        <Select 
          value={profile.basic.employment}
          onChange={(e) => updateNestedProfile('basic', { employment: e.target.value as EmploymentType })}
        >
          <option value="angestellt">Angestellt / Beamter</option>
          <option value="selbstständig">Selbstständig / Unternehmer</option>
          <option value="teilzeit">Teilzeit / Geringfügig</option>
        </Select>
      </InputGroup>
    </div>
  );

  const renderStep2Income = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold mb-6">Einkommen & Ausgaben</h2>
      <p className="text-gray-500 mb-6">Bitte geben Sie die Werte für Ihren gesamten Haushalt an.</p>

      <InputGroup label="Monatliches Netto-Haushaltseinkommen" error={errors.netIncome} subLabel="Inkl. 13./14. Gehalt (durch 12 geteilt) und Beihilfen.">
        <NumberInput 
          value={profile.cashflow.netIncomeMonthly || ''} 
          onChange={(e) => updateNestedProfile('cashflow', { netIncomeMonthly: parseFloat(e.target.value) || null })}
          placeholder="z.B. 2500"
          suffix="€"
        />
      </InputGroup>

      <InputGroup label="Monatliche Fixkosten" error={errors.fixedCosts} subLabel="Miete/Kredit, Energie, Versicherungen, Auto, Abos, Essen.">
        <NumberInput 
          value={profile.cashflow.fixedCostsMonthly || ''} 
          onChange={(e) => updateNestedProfile('cashflow', { fixedCostsMonthly: parseFloat(e.target.value) || null })}
          placeholder="z.B. 1500"
          suffix="€"
        />
      </InputGroup>

      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm font-semibold text-gray-600 mb-1">Rechnerischer Überschuss:</p>
        <p className="text-2xl font-bold text-[#D70F21]">
          {((profile.cashflow.netIncomeMonthly || 0) - (profile.cashflow.fixedCostsMonthly || 0)).toLocaleString('de-AT')} €
        </p>
      </div>
    </div>
  );

  const renderStep3Assets = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold mb-6">Vermögen</h2>
      
      <InputGroup label="Liquide Ersparnisse" subLabel="Girokonto, Sparbuch, Tagesgeld.">
        <NumberInput 
          value={profile.assets.savings || ''} 
          onChange={(e) => updateNestedProfile('assets', { savings: parseFloat(e.target.value) || null })}
          placeholder="0"
          suffix="€"
        />
      </InputGroup>

      <InputGroup label="Investments / Langfristige Anlagen" subLabel="Fonds, Aktien, ETFs, Krypto, Gold.">
        <NumberInput 
          value={profile.assets.investments || ''} 
          onChange={(e) => updateNestedProfile('assets', { investments: parseFloat(e.target.value) || null })}
          placeholder="0"
          suffix="€"
        />
      </InputGroup>
    </div>
  );

  const renderStep4Debts = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold mb-6">Verbindlichkeiten</h2>
      
      <InputGroup label="Offene Wohnbaukredite (Restschuld)" subLabel="Optional. Nur wenn Immobilie vorhanden.">
        <NumberInput 
          value={profile.debts.mortgageRemaining || ''} 
          onChange={(e) => updateNestedProfile('debts', { mortgageRemaining: parseFloat(e.target.value) || null })}
          placeholder="0"
          suffix="€"
        />
      </InputGroup>

      <InputGroup label="Monatliche Rate für Konsumkredite/Leasing" subLabel="Autoleasing, Überziehungsrahmen, Ratenkäufe. (Ohne Wohnkredit)">
        <NumberInput 
          value={profile.debts.consumerLoansMonthly || ''} 
          onChange={(e) => updateNestedProfile('debts', { consumerLoansMonthly: parseFloat(e.target.value) || null })}
          placeholder="0"
          suffix="€"
        />
      </InputGroup>
    </div>
  );

  const renderStep5Protection = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold mb-6">Vorsorge & Sicherheit</h2>
      
      <InputGroup label="Wie lange könnten Sie ohne Einkommen leben?" subLabel="Basierend auf Ihrem Notgroschen.">
        <Select 
          value={profile.protection.emergencyFundMonths}
          onChange={(e) => updateNestedProfile('protection', { emergencyFundMonths: parseInt(e.target.value) })}
        >
          <option value={0}>Weniger als 1 Monat</option>
          <option value={1}>1 Monat</option>
          <option value={2}>2 Monate</option>
          <option value={3}>3 Monate</option>
          <option value={6}>6 Monate</option>
          <option value={12}>Über 1 Jahr</option>
        </Select>
      </InputGroup>

      <InputGroup label="Haben Sie eine private Pensionsvorsorge?">
        <div className="flex gap-2">
           {['yes', 'no', 'unknown'].map((val) => (
             <button
               key={val}
               onClick={() => updateNestedProfile('protection', { privatePension: val as YesNoUnknown })}
               className={`flex-1 py-3 px-2 rounded-lg border text-sm font-medium transition-colors ${
                 profile.protection.privatePension === val 
                   ? 'bg-[#D70F21] text-white border-[#D70F21]' 
                   : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
               }`}
             >
               {val === 'yes' ? 'Ja' : val === 'no' ? 'Nein' : 'Unsicher'}
             </button>
           ))}
        </div>
      </InputGroup>

      <InputGroup label="Ist Ihr Einkommen abgesichert?" subLabel="Berufsunfähigkeitversicherung o.ä.">
        <div className="flex gap-2">
           {['yes', 'no', 'unknown'].map((val) => (
             <button
               key={val}
               onClick={() => updateNestedProfile('protection', { incomeProtection: val as YesNoUnknown })}
               className={`flex-1 py-3 px-2 rounded-lg border text-sm font-medium transition-colors ${
                 profile.protection.incomeProtection === val 
                   ? 'bg-[#D70F21] text-white border-[#D70F21]' 
                   : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
               }`}
             >
               {val === 'yes' ? 'Ja' : val === 'no' ? 'Nein' : 'Unsicher'}
             </button>
           ))}
        </div>
      </InputGroup>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between text-xs font-semibold uppercase text-gray-400 mb-2">
          <span>Schritt {step} von {totalSteps}</span>
          <span>Finanz-Check</span>
        </div>
        <ProgressBar current={step} total={totalSteps} />
      </div>

      <Card className="mb-8 min-h-[400px]">
        {step === 1 && renderStep1Basic()}
        {step === 2 && renderStep2Income()}
        {step === 3 && renderStep3Assets()}
        {step === 4 && renderStep4Debts()}
        {step === 5 && renderStep5Protection()}
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          Zurück
        </Button>
        <Button onClick={nextStep} className="w-1/2">
          {step === totalSteps ? 'Auswertung anzeigen' : 'Weiter'}
        </Button>
      </div>
    </div>
  );
};