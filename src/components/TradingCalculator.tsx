import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputForm } from './calculator/InputForm';
import { ResultsDashboard } from './calculator/ResultsDashboard';
import { PacingAnalysis } from './calculator/PacingAnalysis';
import { JobImpactAnalysis } from './calculator/JobImpactAnalysis';
import { BudgetOptimization } from './calculator/BudgetOptimization';
import { useCalculatorLogic } from '@/hooks/useCalculatorLogic';
import { TradingInputs } from '@/types/trading';
import { JoveoRecommendations } from './calculator/JoveoRecommendations';

export const TradingCalculator = () => {
  const [inputs, setInputs] = useState<TradingInputs | null>(null);
  const { results, isCalculating, calculatePredictions } = useCalculatorLogic();

  const handleCalculate = async (formInputs: TradingInputs) => {
    setInputs(formInputs);
    await calculatePredictions(formInputs);
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      <Card className="mb-10">
        <CardHeader>
          <div className="flex items-center gap-4">
            <img src="/amazon_logo.png" alt="Amazon Logo" style={{ height: '2.5rem', width: '2.5rem', objectFit: 'contain' }} />
            <CardTitle className="text-2xl">Generic Campaign Analysis Calculator</CardTitle>
          </div>
          <CardDescription>
            Enter your campaign parameters below. Our AI model will analyze your data patterns 
            and generate predictions based on machine learning algorithms trained on trading campaign datasets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InputForm onCalculate={handleCalculate} isLoading={isCalculating} />
        </CardContent>
      </Card>

      {results && (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pacing">Pacing Analysis</TabsTrigger>
            <TabsTrigger value="job-impact">Job Impact</TabsTrigger>
            <TabsTrigger value="budget">Budget Optimization</TabsTrigger>
            <TabsTrigger value="recommendations">Joveo Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <ResultsDashboard results={results} inputs={inputs!} />
          </TabsContent>

          <TabsContent value="pacing" className="mt-6">
            <PacingAnalysis results={results} inputs={inputs!} />
          </TabsContent>

          <TabsContent value="job-impact" className="mt-6">
            <JobImpactAnalysis results={results} inputs={inputs!} />
          </TabsContent>

          <TabsContent value="budget" className="mt-6">
            <BudgetOptimization results={results} inputs={inputs!} />
          </TabsContent>

          <TabsContent value="recommendations" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Joveo Recommendations</CardTitle>
                <CardDescription>
                  Based on machine learning analysis of your campaign parameters and historical trading patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <JoveoRecommendations results={results} inputs={inputs!} />
                <div className="space-y-4">
                  {results.recommendations.map((rec, index) => (
                    <div key={index} className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-l-4 border-l-blue-500">
                      <h4 className="font-semibold text-blue-800 mb-2">{rec.category}</h4>
                      <p className="text-gray-700 mb-2">{rec.suggestion}</p>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          rec.impact === 'high' ? 'bg-red-100 text-red-800' :
                          rec.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {rec.impact.toUpperCase()} IMPACT
                        </span>
                        <span className="text-xs text-gray-500">
                          AI Confidence: {Math.round(rec.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
