import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { Card, Button, ScoreBadge } from '../components/UI';
import { getTrafficLightColor } from '../utils/scoring';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export const Results: React.FC = () => {
  const { profile } = useUser();
  const navigate = useNavigate();

  // Guard: Redirect if no data
  useEffect(() => {
    if (!profile.meta.isFinished) {
      navigate('/check');
    }
  }, [profile, navigate]);

  const scores = profile.scores;

  const scoreData = [
    { name: 'Liquidity', value: scores.liquidity, label: 'Liquidität' },
    { name: 'Wealth', value: scores.wealth, label: 'Vermögen' },
    { name: 'Protection', value: scores.protection, label: 'Absicherung' },
    { name: 'Retirement', value: scores.retirement, label: 'Vorsorge' },
    { name: 'Debt', value: scores.debt, label: 'Schulden' },
  ];

  const OverallGauge = () => {
    const data = [
      { name: 'Score', value: scores.overall },
      { name: 'Rest', value: 100 - scores.overall }
    ];
    return (
      <div className="h-48 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="70%"
              startAngle={180}
              endAngle={0}
              innerRadius={60}
              outerRadius={90}
              paddingAngle={0}
              dataKey="value"
            >
              <Cell key="cell-0" fill={getTrafficLightColor(scores.overall)} />
              <Cell key="cell-1" fill="#f3f4f6" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute top-[65%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="text-4xl font-bold text-gray-900">{scores.overall}</p>
          <p className="text-xs uppercase text-gray-400 font-bold tracking-wider">Gesamtscore</p>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Ihre Analyse</h1>
      <p className="text-gray-600 mb-8">Basierend auf Ihren Angaben haben wir Ihre finanzielle Situation bewertet.</p>

      {/* Main Score Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <Card className="md:col-span-1 flex flex-col justify-center items-center bg-white">
          <OverallGauge />
        </Card>
        
        <Card className="md:col-span-2">
          <h3 className="font-bold text-gray-800 mb-4">Detailergebnisse</h3>
          <div className="space-y-4">
            {scoreData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-gray-700">{item.label}</span>
                    <span className={`font-bold ${item.value < 40 ? 'text-red-500' : item.value < 70 ? 'text-yellow-500' : 'text-green-500'}`}>
                      {item.value}/100
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div 
                      className="h-2.5 rounded-full transition-all duration-1000" 
                      style={{ width: `${item.value}%`, backgroundColor: getTrafficLightColor(item.value) }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recommended Modules */}
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Empfohlene Vertiefung</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {profile.recommendedModules.map((moduleId) => {
          let title = '', desc = '', icon = '';
          if (moduleId === 'pension') {
            title = 'Pensions-Check';
            desc = 'Ihre Pensionslücke detailliert berechnen und Schließungsstrategien entwickeln.';
            icon = '🏖️';
          } else if (moduleId === 'finanzierung') {
            title = 'Finanzierungs-Check';
            desc = 'Optimierung bestehender Kredite oder Planung für Eigentum.';
            icon = '🏠';
          } else if (moduleId === 'risiko') {
            title = 'Risiko-Check';
            desc = 'Existenzielle Risiken erkennen und Lücken schließen.';
            icon = '🛡️';
          }

          return (
            <div key={moduleId} className="bg-white rounded-xl shadow-md border-l-4 border-[#D70F21] p-6 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-3">{icon}</div>
              <h3 className="text-xl font-bold mb-2">{title}</h3>
              <p className="text-gray-600 mb-6 min-h-[48px]">{desc}</p>
              <div className="flex gap-3">
                <Button onClick={() => navigate(`/module/${moduleId}`)} className="text-sm py-2">
                  Jetzt starten
                </Button>
              </div>
            </div>
          );
        })}
        {profile.recommendedModules.length === 0 && (
           <Card className="md:col-span-2 text-center py-8">
              <h3 className="text-lg font-bold text-green-600 mb-2">Hervorragend aufgestellt!</h3>
              <p>Aktuell haben wir keine dringenden Warnsignale gefunden. Sie können sich dennoch den Detailreport sichern.</p>
           </Card>
        )}
      </div>

      <div className="text-center">
        <p className="text-gray-500 mb-4">Möchten Sie die Ergebnisse speichern und Details besprechen?</p>
        <Button onClick={() => navigate('/report')} variant="secondary" className="w-full md:w-auto min-w-[300px]">
          Zum Abschluss & Report
        </Button>
      </div>
    </div>
  );
};