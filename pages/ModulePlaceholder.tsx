import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card } from '../components/UI';

export const ModulePlaceholder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const getModuleInfo = () => {
    switch (id) {
      case 'pension': return { title: 'Pensions-Check', icon: '🏖️' };
      case 'finanzierung': return { title: 'Finanzierungs-Check', icon: '🏠' };
      case 'risiko': return { title: 'Risiko-Check', icon: '🛡️' };
      default: return { title: 'Modul', icon: '🔍' };
    }
  };

  const info = getModuleInfo();

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 text-center">
      <Card className="py-16">
        <div className="text-6xl mb-6">{info.icon}</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{info.title}</h1>
        <p className="text-xl text-gray-500 mb-8">
          Dieses Modul wird gerade vorbereitet. <br/>
          In der Vollversion können Sie hier eine detaillierte Berechnung durchführen.
        </p>
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg mb-8 inline-block text-left max-w-md">
          <p className="font-bold mb-1">Coming Soon:</p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li>Detaillierte Gap-Analyse</li>
            <li>Staatliche vs. Private Ansprüche</li>
            <li>Steuervorteil-Rechner</li>
          </ul>
        </div>
        <div className="block">
            <Button onClick={() => navigate('/results')} variant="outline" className="mr-4">
            Zurück zur Übersicht
            </Button>
            <Button onClick={() => navigate('/report')}>
            Zum Report springen
            </Button>
        </div>
      </Card>
    </div>
  );
};