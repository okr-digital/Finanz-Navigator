import React from 'react';
import { Button, Card } from '../components/UI';

export const Thanks: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <Card className="max-w-lg text-center p-8">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">
          ✓
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Vielen Dank!</h1>
        <p className="text-gray-600 mb-8">
          Ihre Daten wurden erfolgreich übermittelt. Sie erhalten in Kürze eine E-Mail mit Ihrer Zusammenfassung.
        </p>
        <div className="bg-gray-50 p-6 rounded-lg mb-8 text-left">
          <h3 className="font-bold text-gray-800 mb-2">Wie geht es weiter?</h3>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-600">
            <li>Ein Experte in Ihrer Nähe prüft Ihre Angaben.</li>
            <li>Wir melden uns für ein kurzes Feedback-Gespräch.</li>
            <li>Gemeinsam optimieren wir Ihre Finanzstrategie.</li>
          </ol>
        </div>
        <Button onClick={() => window.location.href = '/'} variant="outline">
          Zurück zur Startseite
        </Button>
      </Card>
    </div>
  );
};