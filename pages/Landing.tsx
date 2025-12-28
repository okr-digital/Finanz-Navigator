import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { Button, Card } from '../components/UI';
import { saveToDatabase } from '../services/api';
import { INITIAL_STATE } from '../types';

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { hasPreviousSession, resetProfile } = useUser();

  const handleStart = () => {
    resetProfile();
    navigate('/check');
  };

  const handleContinue = () => {
    navigate('/check'); // Logic in Check page will handle resume step
  };

  const runConnectionTest = async () => {
    const testProfile = {
      ...INITIAL_STATE,
      meta: {
        ...INITIAL_STATE.meta,
        sessionId: `TEST-${Date.now()}`,
        isFinished: true,
        createdAt: new Date().toISOString()
      },
      lead: {
        name: 'Michael Maier',
        email: 'michael.maier@test-example.com',
        phone: '0664 12345678',
        consent: true
      },
      basic: {
        age: 42,
        householdType: 'familie',
        employment: 'angestellt'
      },
      cashflow: {
        netIncomeMonthly: 3500,
        fixedCostsMonthly: 2000,
        freeCashMonthly: 1500
      },
      assets: {
        savings: 15000,
        investments: 5000
      },
      scores: {
        overall: 85,
        liquidity: 90,
        wealth: 60,
        protection: 80,
        retirement: 70,
        debt: 100
      }
    };

    alert('⏳ Sende Test-Daten für "Michael Maier"... \n\nBitte Browser-Konsole (F12) für Details öffnen.');
    
    // Cast to any to avoid strict typing issues with the spread of INITIAL_STATE for test purposes
    const success = await saveToDatabase(testProfile as any);
    
    if (success) {
      alert('✅ ERFOLG!\n\nMichael Maier wurde in der Supabase Tabelle "DB Finanz Navigator Leads" gespeichert.');
    } else {
      alert('❌ FEHLER.\n\nDaten konnten nicht gespeichert werden.\n\nMögliche Ursachen:\n1. API Key falsch (Muss der "anon" / "public" Key sein, startet oft mit "eyJ...")\n2. Tabelle "DB Finanz Navigator Leads" existiert nicht oder hat falsche Spalten.\n3. Row Level Security (RLS) blockiert den Insert (Policy prüfen).');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 bg-gradient-to-b from-white to-gray-50 pt-20 md:pt-24">
      <div className="text-center max-w-2xl mx-auto space-y-6">
        <div className="inline-block px-4 py-1.5 rounded-full bg-red-50 text-[#D70F21] text-sm font-semibold mb-4">
          Für Österreich 🇦🇹
        </div>
        
        <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 tracking-tight leading-tight">
          Wie fit sind Ihre <br className="hidden md:block"/>
          <span className="text-[#D70F21]">Finanzen wirklich?</span>
        </h1>
        
        <p className="text-xl text-gray-600 max-w-lg mx-auto leading-relaxed">
          Machen Sie den kostenlosen 3-Minuten Check. Erhalten Sie eine neutrale Auswertung zu Vermögen, Absicherung und Vorsorge.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Button onClick={handleStart} className="text-lg px-8 shadow-xl shadow-red-200">
            Jetzt Check starten
          </Button>
          
          {hasPreviousSession && (
            <Button onClick={handleContinue} variant="outline">
              Analyse fortsetzen
            </Button>
          )}
        </div>
        
        <p className="text-sm text-gray-400 mt-4">
          Unverbindlich & anonym bis zum Ergebnis.
        </p>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl w-full">
        <Card className="text-center hover:-translate-y-1 transition-transform duration-300">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="font-bold text-gray-900 mb-2">Ganzheitlicher Score</h3>
          <p className="text-sm text-gray-500">Ampelsystem für alle wichtigen Lebensbereiche.</p>
        </Card>
        <Card className="text-center hover:-translate-y-1 transition-transform duration-300">
          <div className="text-4xl mb-4">🎯</div>
          <h3 className="font-bold text-gray-900 mb-2">Konkrete Schritte</h3>
          <p className="text-sm text-gray-500">Erhalten Sie klare Handlungs-empfehlungen.</p>
        </Card>
        <Card className="text-center hover:-translate-y-1 transition-transform duration-300">
          <div className="text-4xl mb-4">🔒</div>
          <h3 className="font-bold text-gray-900 mb-2">Sicher & Diskret</h3>
          <p className="text-sm text-gray-500">Ihre Daten gehören Ihnen. DSGVO konform.</p>
        </Card>
      </div>

      {/* Dev Tooling */}
      <div className="mt-20 border-t pt-8 pb-4 w-full max-w-lg text-center opacity-50 hover:opacity-100 transition-opacity">
        <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-widest">Developer Zone</p>
        <button 
          onClick={runConnectionTest}
          className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-600 px-3 py-2 rounded border border-gray-300 transition-colors"
        >
          🛠 DEV: Testdaten senden (Michael Maier)
        </button>
      </div>
    </div>
  );
};