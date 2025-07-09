
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
          <div className="flex items-center gap-4" style={{ alignItems: 'center' }}>
            <img
              src="/joveo-logo.png"
              alt="Joveo Logo"
              className={`h-16 w-16 md:h-24 md:w-24 drop-shadow-lg transition-all duration-700 ${logoVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
              style={{
                borderRadius: '16px',
                display: 'block',
                marginBottom: '0px',
                boxSizing: 'content-box',
                paddingBottom: '4px',
              }}
            />
            <h1
              className={`text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-0 transition-opacity duration-700 ${titleVisible ? 'opacity-100' : 'opacity-0'}`}
              style={{ lineHeight: 1.1 }}
            >
              Joveo’s AI Scenario Planner
            </h1>
          </div>
          <div
            className={`text-gray-500 text-lg mt-0.5 transition-opacity duration-700 ${taglineVisible ? 'opacity-100' : 'opacity-0'}`}
          >
            Powered by <span className="font-semibold text-indigo-500">Joveo</span>
          </div>
          {/* Animated divider */}
          <div className="w-full flex justify-center mt-2">
            <div
              className={`h-1 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full transition-all duration-700 ${dividerVisible ? 'w-48' : 'w-0'}`}
              style={{ transitionProperty: 'width' }}
            />
          </div>
        </div>
        {/* ...rest of your dashboard... */}
        <TradingCalculator />
      </div>
    </div>
  );
};

export default Index;
