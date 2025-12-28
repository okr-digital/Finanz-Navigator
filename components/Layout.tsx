import React from 'react';
import { useLocation } from 'react-router-dom';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const isCheckFlow = location.pathname.startsWith('/check');

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-800 font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-50 print:hidden">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* Logo Placeholder */}
            <div className="w-8 h-8 bg-[#D70F21] rounded-sm flex items-center justify-center text-white font-bold text-lg">
              S
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-900">
              Finanz<span className="text-[#D70F21]">Navigator</span>
            </span>
          </div>
          {!isCheckFlow && (
             <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
               Österreich
             </div>
          )}
        </div>
      </header>

      <main className="flex-grow flex flex-col">
        {children}
      </main>

      <footer className="bg-gray-100 border-t border-gray-200 mt-auto py-8 print:hidden">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-500 mb-2">
            © {new Date().getFullYear()} Finanz-Navigator AT
          </p>
          <p className="text-xs text-gray-400 max-w-lg mx-auto">
            Disclaimer: Dieses Tool stellt keine Finanzberatung dar und ersetzt keine individuelle Beratung. 
            Alle Berechnungen sind vereinfachte Orientierungswerte.
          </p>
        </div>
      </footer>
    </div>
  );
};