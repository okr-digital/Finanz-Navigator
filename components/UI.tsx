import React from 'react';

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' }> = ({ 
  className = '', 
  variant = 'primary', 
  children, 
  ...props 
}) => {
  const baseStyle = "px-6 py-3 rounded-lg font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    // Primary: Brand Red
    primary: "bg-[#D70F21] text-white hover:bg-[#b00c1b] shadow-md hover:shadow-lg hover:shadow-red-100",
    
    // Secondary: Previously dark gray, now soft light gray/white for a cleaner look
    secondary: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm",
    
    // Outline: Transparent with border
    outline: "border-2 border-gray-200 text-gray-600 bg-transparent hover:border-gray-300 hover:bg-gray-50"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 p-6 ${className}`}>
    {children}
  </div>
);

export const InputGroup: React.FC<{ 
  label: string; 
  subLabel?: string;
  error?: string;
  children: React.ReactNode 
}> = ({ label, subLabel, error, children }) => (
  <div className="mb-6">
    <label className="block text-sm font-bold text-gray-800 mb-1">
      {label}
    </label>
    {subLabel && <p className="text-xs text-gray-500 mb-2 font-medium">{subLabel}</p>}
    {children}
    {error && <p className="text-red-600 text-xs mt-1 font-semibold flex items-center gap-1">⚠️ {error}</p>}
  </div>
);

export const NumberInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { suffix?: string }> = ({ suffix, onFocus, className = '', ...props }) => (
  <div className="relative group">
    <input 
      type="number" 
      onFocus={(e) => {
        e.target.select();
        if (onFocus) onFocus(e);
      }}
      className={`w-full p-4 border border-gray-200 rounded-lg text-lg text-gray-900 bg-white placeholder-gray-300 focus:ring-4 focus:ring-red-50 focus:border-[#D70F21] outline-none transition-all shadow-sm group-hover:border-gray-300 ${className}`}
      {...props}
    />
    {suffix && (
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium pointer-events-none">
        {suffix}
      </span>
    )}
  </div>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <div className="relative group">
    <select 
      className="w-full p-4 border border-gray-200 rounded-lg text-lg text-gray-900 bg-white appearance-none focus:ring-4 focus:ring-red-50 focus:border-[#D70F21] outline-none transition-all shadow-sm cursor-pointer group-hover:border-gray-300"
      {...props}
    />
    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>
);

export const ProgressBar: React.FC<{ current: number; total: number }> = ({ current, total }) => {
  const progress = (current / total) * 100;
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div 
        className="h-full bg-[#D70F21] transition-all duration-500 ease-out shadow-[0_0_10px_rgba(215,15,33,0.3)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export const ScoreBadge: React.FC<{ score: number }> = ({ score }) => {
  let colorClass = 'bg-gray-50 text-gray-600 border-gray-200';
  if (score >= 70) colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
  else if (score >= 40) colorClass = 'bg-amber-50 text-amber-700 border-amber-100';
  else colorClass = 'bg-red-50 text-red-700 border-red-100';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${colorClass}`}>
      Score: {score}/100
    </span>
  );
};