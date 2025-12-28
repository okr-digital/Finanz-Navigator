import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { Button, Card, InputGroup, ScoreBadge } from '../components/UI';
import { getTrafficLightColor, getTrafficLight } from '../utils/scoring';
import { saveToDatabase } from '../services/api';

export const Report: React.FC = () => {
  const { profile, updateNestedProfile, resetProfile } = useUser();
  const navigate = useNavigate();
  const [isUnlocked, setIsUnlocked] = useState(false);
  
  // Local Form State to prevent auto-unlocking context updates
  const [formData, setFormData] = useState({
    name: profile.lead.name || '',
    email: profile.lead.email || '',
    phone: profile.lead.phone || '',
    consent: profile.lead.consent || false
  });
  
  // Form State
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Check initial lock state (for returning users)
  useEffect(() => {
    // Only auto-unlock if we are genuinely finished AND have data in the GLOBAL profile 
    // (which implies it was saved/loaded, not just currently being typed in local state)
    if (profile.meta.isFinished && profile.lead.name && profile.lead.email) {
      setIsUnlocked(true);
    }
  }, [profile]);

  const scores = profile.scores;
  
  // --- Helpers for Dynamic Content ---

  const getTopActionAreas = () => {
    const areas = [
      { id: 'liquidity', label: 'Liquidität', score: scores.liquidity, reason: 'Ein Notgroschen schützt vor Schuldenfallen.' },
      { id: 'wealth', label: 'Vermögen', score: scores.wealth, reason: 'Vermögen sollte produktiv arbeiten.' },
      { id: 'protection', label: 'Absicherung', score: scores.protection, reason: 'Einkommensausfall ist ein Existenzrisiko.' },
      { id: 'retirement', label: 'Vorsorge', score: scores.retirement, reason: 'Staatliche Pension reicht oft nicht.' },
      { id: 'debt', label: 'Finanzierung', score: scores.debt, reason: 'Hohe Belastungen schränken ein.' },
    ];
    // Sort by score ascending (lowest first)
    return areas.sort((a, b) => a.score - b.score).slice(0, 3);
  };

  const actionAreas = getTopActionAreas();

  const getRecommendations = () => {
    const recs: {icon: string, title: string, desc: string, link?: string, priority: 'high' | 'medium' | 'low'}[] = [];
    
    // Pension
    if (profile.moduleResults.pension) {
       const res = profile.moduleResults.pension;
       if (res.assessment === 'red' || res.assessment === 'yellow') {
         recs.push({
           icon: '📉',
           title: 'Pensionsplan erstellen',
           desc: `Lücke von ${res.gapMonthly} € systematisch schließen.`,
           link: '/module/pension',
           priority: 'high'
         });
       }
    } else if (scores.retirement < 70) {
        recs.push({ icon: '🏖️', title: 'Pensions-Check durchführen', desc: 'Ermitteln Sie Ihre genaue Pensionslücke.', link: '/module/pension', priority: 'high' });
    }

    // Finanzierung / Debt
    if (profile.moduleResults.finanzierung) {
       const res = profile.moduleResults.finanzierung;
       if (res.assessment === 'red' || res.assessment === 'yellow') {
          recs.push({
             icon: '🏠', 
             title: 'Finanzierungsstruktur optimieren', 
             desc: 'Kreditrate oder Zinsrisiko überprüfen.',
             link: '/module/finanzierung',
             priority: 'high'
          });
       }
    } else if (scores.debt < 70 || (profile.debts.mortgageRemaining || 0) > 0) {
        recs.push({ icon: '🏦', title: 'Finanzierungs-Check', desc: 'Optimierungspotenzial bei Krediten prüfen.', link: '/module/finanzierung', priority: 'medium' });
    }

    // Risk
    if (profile.moduleResults.risiko) {
       const res = profile.moduleResults.risiko;
       if (res.assessment === 'red') {
          recs.push({
             icon: '🛡️',
             title: 'Existenzschutz sicherstellen',
             desc: 'Notgroschen aufbauen und Einkommen absichern.',
             link: '/module/risiko',
             priority: 'high'
          });
       }
    } else if (scores.protection < 70) {
        recs.push({ icon: '🚑', title: 'Risiko-Stresstest', desc: 'Wie lange reichen Ihre Reserven?', link: '/module/risiko', priority: 'medium' });
    }

    // General Wealth
    if (scores.wealth < 50 && recs.length < 5) {
       recs.push({ icon: '💰', title: 'Sparfähigkeit erhöhen', desc: 'Budgetanalyse durchführen und Sparplan starten.', link: '/check', priority: 'medium' });
    }

    return recs.slice(0, 5);
  };

  const recommendations = getRecommendations();

  // --- Handlers ---

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    
    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name ist erforderlich";
    if (!formData.email.trim() || !formData.email.includes('@')) newErrors.email = "Gültige E-Mail erforderlich";
    if (!formData.consent) newErrors.consent = "Zustimmung erforderlich";

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setSubmitted(true);
      
      // Prepare full profile with latest form data
      const updatedProfile = {
        ...profile,
        lead: {
          ...profile.lead,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          consent: formData.consent
        },
        meta: {
            ...profile.meta,
            isFinished: true
        }
      };

      // Save to Database
      const success = await saveToDatabase(updatedProfile);

      if (success) {
        // Only update context and unlock on success
        updateNestedProfile('lead', {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          consent: formData.consent
        });
        updateNestedProfile('meta', { isFinished: true });
        
        setIsUnlocked(true);
        // Optional: Scroll to top to see full report
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setSubmitError("Verbindungsfehler. Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.");
      }
      
      setSubmitted(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleRestart = () => {
    if (window.confirm("Möchten Sie wirklich neu starten? Alle Daten werden gelöscht.")) {
      resetProfile();
      navigate('/');
    }
  };

  // --- Components ---

  const ModuleCard = ({ type }: { type: 'pension' | 'finanzierung' | 'risiko' }) => {
    const resPension = profile.moduleResults.pension;
    const resFin = profile.moduleResults.finanzierung;
    const resRisk = profile.moduleResults.risiko;
    
    let title = '', content = null, link = `/module/${type}`;

    if (type === 'pension') {
      title = 'Pensions-Check';
      if (resPension) {
         content = (
           <div className="space-y-2 text-sm mt-3 border-t pt-2">
             <div className="flex justify-between items-center mb-1"><span className="text-gray-600">Lücke:</span> <span className="font-bold text-red-600">-{resPension.gapMonthly} €</span></div>
             <div className="flex justify-between items-center mb-1"><span className="text-gray-600">Bedarf:</span> <span className="font-bold">{resPension.scenarioA.extraPMT} €/mtl</span></div>
             <div className="mt-3"><ScoreBadge score={resPension.assessment === 'green' ? 90 : resPension.assessment === 'yellow' ? 60 : 30} /></div>
           </div>
         );
      }
    } else if (type === 'finanzierung') {
      title = 'Finanzierungs-Check';
      if (resFin) {
        content = (
           <div className="space-y-2 text-sm mt-3 border-t pt-2">
             <div className="flex justify-between items-center mb-1"><span className="text-gray-600">Kredit:</span> <span className="font-bold">{resFin.loanAmount.toLocaleString()} €</span></div>
             <div className="flex justify-between items-center mb-1"><span className="text-gray-600">Belastung:</span> <span className="font-bold">{(resFin.scenarioA.dsti*100).toFixed(1)}%</span></div>
             <div className="mt-3"><ScoreBadge score={resFin.assessment === 'green' ? 90 : resFin.assessment === 'yellow' ? 60 : 30} /></div>
           </div>
        );
      }
    } else {
      title = 'Risiko-Stresstest';
      if (resRisk) {
        content = (
           <div className="space-y-2 text-sm mt-3 border-t pt-2">
             <div className="flex justify-between items-center mb-1"><span className="text-gray-600">Reichweite:</span> <span className="font-bold">{resRisk.runwayMonths} Monate</span></div>
             <div className="flex justify-between items-center mb-1"><span className="text-gray-600">Schutz:</span> <span className="font-bold">{resRisk.incomeProtection === 'yes' ? 'Ja' : 'Nein'}</span></div>
             <div className="mt-3"><ScoreBadge score={resRisk.assessment === 'green' ? 90 : resRisk.assessment === 'yellow' ? 60 : 30} /></div>
           </div>
        );
      }
    }

    const hasResult = (type === 'pension' && resPension) || (type === 'finanzierung' && resFin) || (type === 'risiko' && resRisk);

    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full break-inside-avoid print:shadow-none print:border-gray-300">
        <h4 className="font-bold text-gray-800 text-lg">{title}</h4>
        {hasResult ? (
          <div className="flex-grow">
            {content}
          </div>
        ) : (
          <div className="mt-4 flex-grow flex flex-col justify-center text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <span className="text-2xl opacity-30 mb-1">📊</span>
            <p className="text-xs text-gray-400 font-medium">Noch nicht durchgeführt</p>
          </div>
        )}
        <Button 
            onClick={() => navigate(link)} 
            variant="outline" 
            className="w-full mt-5 text-sm py-2 print:hidden border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700"
        >
          {hasResult ? 'Details öffnen' : 'Jetzt starten'}
        </Button>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 print:p-8 print:max-w-none print:bg-white font-sans text-gray-800">
      
      {/* Styles for print */}
      <style>{`
        @media print {
          body { 
            background: white; 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact;
          }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          .break-inside-avoid { break-inside: avoid; }
          button { display: none; }
          header, footer { display: none; }
        }
      `}</style>

      {/* A) Header */}
      <div className="flex justify-between items-start mb-10 border-b pb-6">
        <div>
           <div className="flex items-center gap-2 mb-3">
             <span className="text-xs font-bold text-[#D70F21] bg-red-50 px-2 py-1 rounded border border-red-100 print:border-red-500">
               CONFIDENTIAL
             </span>
             <span className="text-xs text-gray-400">
               {new Date().toLocaleDateString('de-AT')} | ID: {profile.meta.sessionId.slice(0,8)}
             </span>
           </div>
           <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 print:text-black tracking-tight">Ihr Finanz-Report</h1>
           <p className="text-lg text-gray-600 mt-2 max-w-2xl print:text-black leading-relaxed">
             Eine ganzheitliche Orientierung zu Ihrer finanziellen Situation. 
             Basierend auf Ihren Angaben im Finanz-Navigator AT.
           </p>
           {isUnlocked && (
             <div className="mt-4 inline-flex items-center gap-2 bg-green-50 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
               <span>✓</span>
               <span>Erstellt für: {profile.lead.name}</span>
             </div>
           )}
        </div>
        <div className="no-print hidden md:block">
          <Button onClick={handleRestart} variant="outline" className="text-sm">
            Neu starten
          </Button>
        </div>
      </div>

      {/* B) Overview Section */}
      <section className="mb-16">
        <div className="flex items-center gap-5 mb-8">
           <div className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-3xl text-white shadow-lg print:shadow-none" style={{ backgroundColor: getTrafficLightColor(scores.overall) }}>
             {scores.overall}
           </div>
           <div>
             <h2 className="text-2xl font-bold text-gray-900 print:text-black">Gesamtergebnis</h2>
             <p className="text-gray-500 print:text-gray-700">Durchschnittlicher Score über alle 5 Lebensbereiche.</p>
           </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
           {[
             { label: 'Liquidität', score: scores.liquidity },
             { label: 'Vermögen', score: scores.wealth },
             { label: 'Absicherung', score: scores.protection },
             { label: 'Vorsorge', score: scores.retirement },
             { label: 'Schulden', score: scores.debt },
           ].map(item => (
             <div key={item.label} className="bg-white rounded-xl p-4 text-center border border-gray-100 shadow-sm break-inside-avoid print:bg-gray-50 print:border-gray-200">
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2 tracking-wider">{item.label}</div>
                <div className="font-black text-2xl mb-3" style={{ color: getTrafficLightColor(item.score) }}>{item.score}<span className="text-sm text-gray-400 font-normal">/100</span></div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden print:bg-gray-200">
                   <div className="h-full print-color-force transition-all duration-1000" style={{ width: `${item.score}%`, backgroundColor: getTrafficLightColor(item.score) }}></div>
                </div>
             </div>
           ))}
        </div>
      </section>

      {/* C) Detail Analysis Grid */}
      <section className="grid md:grid-cols-3 gap-8 mb-16">
         {/* Left Col: Handlungsfelder */}
         <div className="md:col-span-2 flex flex-col gap-6">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🎯</span>
                <h3 className="font-bold text-xl text-gray-900">Top 3 Handlungsfelder</h3>
            </div>
            {actionAreas.map((area, idx) => (
              <div key={area.id} className="relative bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex gap-5 items-start overflow-hidden group">
                 <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#D70F21]"></div>
                 <div className="text-gray-200 font-black text-4xl leading-none group-hover:text-red-100 transition-colors select-none">0{idx+1}</div>
                 <div className="flex-grow pt-1">
                    <h4 className="font-bold text-lg text-gray-900 mb-1">{area.label}</h4>
                    <p className="text-gray-600 leading-relaxed">
                      {isUnlocked ? area.reason : "Detailanalyse nach Freischaltung sichtbar."}
                    </p>
                 </div>
                 <ScoreBadge score={area.score} />
              </div>
            ))}
         </div>

         {/* Right Col: Modules */}
         <div className="md:col-span-1 flex flex-col gap-6">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🔎</span>
                <h3 className="font-bold text-xl text-gray-900">Deep Dives</h3>
            </div>
            {/* Show modules always, but lock content if needed logic handled inside ModuleCard or here */}
            {isUnlocked ? (
              <div className="space-y-4 h-full flex flex-col">
                <div className="flex-1"><ModuleCard type="pension" /></div>
                <div className="flex-1"><ModuleCard type="finanzierung" /></div>
                <div className="flex-1"><ModuleCard type="risiko" /></div>
              </div>
            ) : (
               <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400 h-full flex flex-col justify-center items-center border-2 border-dashed border-gray-200 print:hidden min-h-[300px]">
                  <span className="text-4xl mb-4 grayscale opacity-50">🔒</span>
                  <p className="font-medium">Modul-Details gesperrt</p>
                  <p className="text-xs mt-2">Schalten Sie den Report frei.</p>
               </div>
            )}
         </div>
      </section>

      {/* LEAD CAPTURE GATE - Hidden in Print */}
      {!isUnlocked ? (
        <div className="my-16 relative no-print">
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-0"></div>
          <Card className="relative z-10 border-[#D70F21] border-2 shadow-2xl max-w-2xl mx-auto overflow-hidden transform transition-transform hover:scale-[1.01]">
             <div className="bg-gradient-to-r from-[#D70F21] to-[#b00c1b] text-white p-6 text-center">
               <h3 className="font-bold text-2xl">Vollständigen Report freischalten</h3>
               <p className="text-red-100 mt-2 text-sm">Schritt 2 von 2: Personalisierung</p>
             </div>
             <div className="p-8">
               <p className="text-center text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
                 Erhalten Sie Zugriff auf alle Detailergebnisse, konkrete Handlungsempfehlungen und die PDF-Exportfunktion.
               </p>
               <form onSubmit={handleUnlock} className="space-y-5">
                 <div className="grid md:grid-cols-2 gap-5">
                    <InputGroup label="Vorname & Nachname" error={errors.name}>
                      <input 
                        className="w-full p-3.5 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-[#D70F21] focus:border-transparent outline-none transition-shadow" 
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="Max Mustermann"
                      />
                    </InputGroup>
                    <InputGroup label="E-Mail Adresse" error={errors.email}>
                      <input 
                        type="email"
                        className="w-full p-3.5 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-[#D70F21] focus:border-transparent outline-none transition-shadow" 
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        placeholder="max@beispiel.at"
                      />
                    </InputGroup>
                 </div>
                 
                 <div className="pt-2">
                    <InputGroup label="Telefon (optional)" subLabel="Für Rückfragen durch einen Experten.">
                      <input 
                        type="tel"
                        className="w-full p-3.5 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-[#D70F21] focus:border-transparent outline-none transition-shadow" 
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                        placeholder="+43 664 ..."
                      />
                    </InputGroup>
                    
                    <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <label className="flex items-start gap-3 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            className="mt-1 w-5 h-5 accent-[#D70F21] bg-white border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                            checked={formData.consent}
                            onChange={e => setFormData({...formData, consent: e.target.checked})}
                        />
                        <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors leading-snug">
                            Ich stimme zu, dass meine Daten zur Auswertung und Kontaktaufnahme verarbeitet werden. 
                            {errors.consent && <span className="text-[#D70F21] font-bold block mt-1">⚠️ Bitte zustimmen.</span>}
                        </span>
                        </label>
                    </div>
                 </div>
                 
                 {submitError && (
                    <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-lg text-sm text-center font-medium">
                        {submitError}
                    </div>
                 )}

                 <Button type="submit" className="w-full py-4 text-lg font-bold shadow-lg shadow-red-100 hover:shadow-red-200 mt-2" disabled={submitted}>
                   {submitted ? 'Wird gespeichert...' : 'Jetzt kostenlos freischalten'}
                 </Button>
               </form>
             </div>
          </Card>
        </div>
      ) : (
        /* UNLOCKED CONTENT START */
        <div className="animate-fade-in pt-12 border-t border-gray-200">
           
           {/* Section Header */}
           <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Ihre Empfehlungen</h2>
              <p className="text-gray-500 mt-2">Basierend auf Ihrer Analyse empfehlen wir folgende nächste Schritte.</p>
           </div>

           {/* Recommendations Grid */}
           <div className="grid md:grid-cols-2 gap-6 mb-16 page-break">
             {recommendations.map((rec, i) => (
               <div key={i} className="flex flex-col h-full bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 break-inside-avoid relative overflow-hidden group">
                  {/* Decorative highlight */}
                  <div className={`absolute top-0 left-0 w-full h-1 ${rec.priority === 'high' ? 'bg-[#D70F21]' : 'bg-blue-500'}`}></div>
                  
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-full text-2xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                        {rec.icon}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            {rec.priority === 'high' && <span className="text-[10px] uppercase font-bold text-white bg-[#D70F21] px-2 py-0.5 rounded-full tracking-wide">Wichtig</span>}
                            <h4 className="font-bold text-lg text-gray-900">{rec.title}</h4>
                        </div>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 mb-6 flex-grow leading-relaxed pl-16 -mt-2">
                    {rec.desc}
                  </p>

                  <div className="pl-16">
                    <button 
                        onClick={() => rec.link && navigate(rec.link)} 
                        className={`text-sm font-bold flex items-center gap-2 group-hover:gap-3 transition-all no-print ${rec.priority === 'high' ? 'text-[#D70F21]' : 'text-blue-600'}`}
                    >
                        Details ansehen <span>→</span>
                    </button>
                  </div>
               </div>
             ))}
             
             {recommendations.length === 0 && (
               <div className="col-span-full p-8 bg-green-50 text-green-800 rounded-xl border border-green-200 text-center">
                  <span className="text-2xl block mb-2">🌟</span>
                  <p className="font-bold">Hervorragend!</p>
                  <p className="text-sm">Aktuell keine dringenden Maßnahmen erforderlich.</p>
               </div>
             )}
           </div>

           {/* Tools & Export */}
           <div className="bg-gray-50 rounded-2xl p-8 mb-16 text-center border border-gray-100 no-print">
              <h3 className="font-bold text-gray-900 text-lg mb-2">Ergebnisse sichern</h3>
              <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
                 Laden Sie Ihren persönlichen Finanz-Report als PDF herunter oder drucken Sie ihn für Ihre Unterlagen aus.
              </p>
              <Button onClick={handlePrint} variant="secondary" className="bg-white hover:bg-gray-50 px-8">
                 🖨️ Drucken / PDF speichern
              </Button>
           </div>

           {/* Final CTA: Consultation - IMPROVED ISOLATION */}
           <div className="mt-16 relative z-10 break-inside-avoid page-break">
              <div className="absolute inset-0 bg-[#D70F21] transform -skew-y-1 rounded-3xl opacity-5 blur-xl"></div>
              <div className="relative bg-gradient-to-br from-[#D70F21] to-[#b00c1b] text-white p-10 md:p-12 rounded-2xl text-center shadow-2xl print:bg-white print:text-black print:border-t-2 print:border-red-500 print:shadow-none print:rounded-none">
                  <h2 className="text-3xl font-extrabold mb-4 print:text-[#D70F21]">Wollen wir das gemeinsam angehen?</h2>
                  <p className="max-w-2xl mx-auto mb-10 text-red-50 text-lg leading-relaxed print:text-gray-600">
                    Die Ergebnisse zeigen erste Tendenzen. Aber Finanzen sind Vertrauenssache. 
                    Ein Experte kann Ihre Situation im Detail prüfen und eine maßgeschneiderte Strategie entwickeln.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row justify-center gap-5 no-print">
                    <button className="bg-white text-[#D70F21] hover:bg-gray-100 font-bold py-4 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
                        Kostenloses Erstgespräch anfragen
                    </button>
                    <button className="bg-transparent border-2 border-white/30 text-white hover:bg-white/10 font-semibold py-4 px-8 rounded-lg transition-colors">
                        E-Mail senden
                    </button>
                  </div>
                  
                  {/* Print only contact info */}
                  <div className="hidden print:block mt-8 pt-8 border-t border-red-500/20 text-sm">
                    <p className="text-gray-500 uppercase tracking-widest text-xs mb-2">Ihr Ansprechpartner</p>
                    <p className="font-bold text-lg">Swiss Life Select Österreich</p>
                    <p>beratung@swisslife-select.at</p>
                  </div>
              </div>
           </div>
        </div>
        /* UNLOCKED CONTENT END */
      )}

      {/* Disclaimer / Footer */}
      <div className="mt-20 pt-10 border-t border-gray-100 text-xs text-gray-400 text-center leading-relaxed">
        <p>
          Dieser Report wurde automatisch erstellt am {new Date().toLocaleDateString()}. <br/>
          Alle Angaben sind unverbindliche Orientierungswerte und basieren auf Nutzereingaben.
          Keine Finanzierungs- oder Leistungszusage.
        </p>
      </div>
    </div>
  );
};