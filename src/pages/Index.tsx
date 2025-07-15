import React, { useEffect, useState } from "react";
import { TradingCalculator } from "@/components/TradingCalculator";
import Header from "@/components/Header";

const Index = () => {
  const [logoVisible, setLogoVisible] = useState(false);
  const [titleVisible, setTitleVisible] = useState(false);
  const [taglineVisible, setTaglineVisible] = useState(false);
  const [dividerVisible, setDividerVisible] = useState(false);
  const [currency, setCurrency] = useState<'USD' | 'MXN' | 'BRL'>('USD');

  useEffect(() => {
    setTimeout(() => setLogoVisible(true), 100);
    setTimeout(() => setTitleVisible(true), 400);
    setTimeout(() => setTaglineVisible(true), 700);
    setTimeout(() => setDividerVisible(true), 900);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <Header />
      <div className="container mx-auto px-4 py-8" style={{ position: 'relative' }}>
        {/* Header with logo and title */}
        <div className="flex flex-row items-center mt-8 mb-4" style={{ justifyContent: 'flex-start', paddingLeft: '2rem' }}>
          <img
            src="/joveo-logo.png"
            alt="Joveo Logo"
            className={`transition-all duration-700 ${logoVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}
            style={{
              height: '3.5rem',
              width: '3.5rem',
              borderRadius: "16px",
              display: "block",
              marginBottom: "0px",
              boxSizing: "content-box",
              paddingBottom: "4px",
            }}
          />
          <h1
            className={`text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-0 transition-opacity duration-700 ml-4 ${titleVisible ? "opacity-100" : "opacity-0"}`}
            style={{ lineHeight: 1.1, height: '3.5rem', display: 'flex', alignItems: 'center' }}
          >
            Joveo’s AI Scenario Planner
          </h1>
        </div>
        <div
          className={`text-gray-500 text-lg mt-0.5 transition-opacity duration-700 ${
            taglineVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Powered by Joveo removed */}
        </div>
        {/* Currency selector: move below tagline, full width flex, right aligned */}
        <div className="w-full flex justify-end mt-6 mb-2" style={{paddingRight: '2rem'}}>
          <div className="flex flex-col items-end">
            <div className="flex items-center bg-gray-100 rounded-full px-2 py-1">
              <button
                type="button"
                className={`font-semibold px-3 py-1 rounded-full transition-colors duration-200 ${currency === 'USD' ? 'text-blue-600' : 'text-gray-400'}`}
                onClick={() => setCurrency('USD')}
                style={{ outline: 'none', border: 'none', background: 'none', zIndex: 1 }}
              >
                USD ($)
              </button>
              <div
                className={`w-10 h-6 mx-2 rounded-full bg-gray-200 flex items-center transition-colors duration-200 ${currency === 'BRL' ? 'bg-blue-200' : ''}`}
                style={{ position: 'relative' }}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${currency === 'BRL' ? 'translate-x-4' : 'translate-x-0'}`}
                  style={{ position: 'absolute', left: currency === 'BRL' ? '20px' : '2px', top: '0.5px', pointerEvents: 'none' }}
                />
              </div>
              <button
                type="button"
                className={`font-semibold px-3 py-1 rounded-full transition-colors duration-200 ${currency === 'BRL' ? 'text-blue-600' : 'text-gray-400'}`}
                onClick={() => setCurrency('BRL')}
                style={{ outline: 'none', border: 'none', background: 'none', zIndex: 1 }}
              >
                BRL (R$)
              </button>
            </div>
          </div>
        </div>
        {/* ...rest of your dashboard... */}
        <div style={{ paddingTop: '0.625rem' }}>
          <TradingCalculator currency={currency} setCurrency={setCurrency} />
        </div>
      </div>
    </div>
  );
};

export default Index;
