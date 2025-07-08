
import React from 'react';
import { TradingCalculator } from '@/components/TradingCalculator';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            Generic AI Trading Analytics Model
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            Advanced machine learning model that adapts to any trading campaign dataset. 
            Our AI analyzes your trading metrics, job quality correlations, and budget allocation patterns 
            to provide intelligent predictions and optimization recommendations.
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
    </div>
  );
};

export default Index;
