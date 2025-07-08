
import React, { useEffect, useState } from 'react';
import { TradingCalculator } from '@/components/TradingCalculator';

const Index = () => {
  const [logoVisible, setLogoVisible] = useState(false);
  const [titleVisible, setTitleVisible] = useState(false);
  const [taglineVisible, setTaglineVisible] = useState(false);
  const [dividerVisible, setDividerVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setLogoVisible(true), 100);
    setTimeout(() => setTitleVisible(true), 400);
    setTimeout(() => setTaglineVisible(true), 700);
    setTimeout(() => setDividerVisible(true), 900);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header with logo and title */}
        <div className="flex flex-col items-center mt-8 mb-4">
          <div className="flex items-center gap-4">
            <img
              src="/joveo-logo.png"
              alt="Joveo Logo"
              className={`h-14 w-14 md:h-20 md:w-20 drop-shadow-lg rounded-[12px] transition-transform duration-500 ease-in-out 
                ${logoVisible ? 'opacity-100 translate-y-0 animate-bounce-slow' : 'opacity-0 -translate-y-8'}
                hover:scale-110 hover:rotate-6`}
              style={{ boxShadow: '0 4px 24px 0 rgba(80, 80, 255, 0.10)' }}
            />
            <h1
              className={`text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent transition-opacity duration-700 ${titleVisible ? 'opacity-100' : 'opacity-0'}`}
            >
              Generic AI Trading Analytics Model
            </h1>
          </div>
          <div className={`text-xs text-gray-400 mt-1 tracking-wide transition-opacity duration-700 ${taglineVisible ? 'opacity-100' : 'opacity-0'}`}>
            Powered by <span className="font-semibold text-indigo-500">Joveo</span>
          </div>
          <div className="w-full flex justify-center mt-2 mb-6">
            <div className={`h-1 w-32 bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 rounded-full opacity-80 shadow-lg transition-all duration-700 overflow-hidden
              ${dividerVisible ? 'animate-divider-slide-in' : 'w-0 opacity-0'}`}/>
          </div>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto mt-2 text-center transition-opacity duration-700 delay-500 opacity-100">
            Advanced machine learning model that adapts to any trading campaign dataset. Our AI analyzes your trading metrics, job quality correlations, and budget allocation patterns to provide intelligent predictions and optimization recommendations.
          </p>
        </div>

        <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-200">
          <h3 className="text-lg font-semibold text-indigo-800 mb-2">🤖 Generic AI Model</h3>
          <p className="text-indigo-700">
            This model is designed to work with any trading campaign data. Simply input your campaign parameters, 
            and our AI will analyze patterns from your data to generate predictions and recommendations.
          </p>
        </div>

        <TradingCalculator />
      </div>
      {/* Custom keyframes for bounce and divider slide-in */}
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s cubic-bezier(0.4, 0, 0.2, 1) 1;
        }
        @keyframes divider-slide-in {
          0% { width: 0; opacity: 0; }
          80% { opacity: 1; }
          100% { width: 8rem; opacity: 1; }
        }
        .animate-divider-slide-in {
          animation: divider-slide-in 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default Index;
