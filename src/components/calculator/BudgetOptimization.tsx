import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { PredictionResults, TradingInputs } from '@/types/trading';
import { useCalculatorLogic } from '@/hooks/useCalculatorLogic';

interface BudgetOptimizationProps {
  results: PredictionResults;
  inputs: TradingInputs;
}

export const BudgetOptimization: React.FC<BudgetOptimizationProps> = ({ results, inputs }) => {
  const { calculatePredictions } = useCalculatorLogic();
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [loadingScenarios, setLoadingScenarios] = useState(true);

  // Extract seasonality factor from backend results (snake_case)
  const seasonalityFactor = (results as any).seasonality_factor || 1.0;

  // Calculate scenarios using actual prediction logic
  useEffect(() => {
    const calculateScenarios = async () => {
      setLoadingScenarios(true);

      const scenarioConfigs = [
    {
      name: 'Conservative',
          budgetMultiplier: 0.8,
      risk: 'Low',
      confidence: 0.95
    },
    {
      name: 'Current Plan',
          budgetMultiplier: 1.0,
      risk: 'Medium',
      confidence: results.confidence
    },
    {
      name: 'Aggressive',
          budgetMultiplier: 1.25,
      risk: 'High',
      confidence: 0.75
    }
  ];

      // --- Constants (should match backend) ---
      const CLIENT_ACHIEVED_SPEND = 65366.24;
      const CLIENT_ACHIEVED_AS = 11098.0;
      const CLIENT_BUDGET = 67416.00;
      const CLIENT_AS_GOAL_HISTORICAL = 13249.0;
      const CLIENT_DURATION = 30.0;
      const ALPHA = 0.2;
      const GAMMA = 0.1;
      const DELTA = 0.1;
      const CLIENT_ACHIEVED_CPAS = CLIENT_ACHIEVED_SPEND / CLIENT_ACHIEVED_AS;
      const CLIENT_TARGET_CPAS_FOR_RF = CLIENT_BUDGET / CLIENT_AS_GOAL_HISTORICAL;
      const RF_STATIC = CLIENT_ACHIEVED_CPAS / CLIENT_TARGET_CPAS_FOR_RF;
      const BASE_PREDICTED_CPAS_FACTOR = CLIENT_ACHIEVED_CPAS * RF_STATIC;

      const calculatedScenarios = scenarioConfigs.map((config) => {
          const scenarioInputs = {
            ...inputs,
            budget: Math.round(inputs.budget * config.budgetMultiplier)
          };
        const startMonth = new Date(scenarioInputs.startDate).getMonth() + 1;
        const endMonth = new Date(scenarioInputs.endDate).getMonth() + 1;
        const numDays = Math.ceil((new Date(scenarioInputs.endDate).getTime() - new Date(scenarioInputs.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const asGoal = scenarioInputs.asGoal || 1;
        // Seasonality factor (same as backend)
        const seasonality = {6: 1.0, 7: 1.05, 8: 1.10, 9: 0.95, 10: 0.90, 11: 0.85, 12: 0.80, 1: 0.90, 2: 0.92, 3: 0.95, 4: 0.98, 5: 1.00};
        const seasonalityFactor = seasonality[startMonth] || 1.0;
        // --- Explicit formula ---
        const DURATION_IMPACT_FACTOR = Math.pow(CLIENT_DURATION / numDays, ALPHA);
        const BUDGET_SENSITIVITY_FACTOR = Math.pow(scenarioInputs.budget / CLIENT_BUDGET, GAMMA);
        const AS_GOAL_SENSITIVITY_FACTOR = Math.pow(asGoal / CLIENT_AS_GOAL_HISTORICAL, DELTA);
        const JOB_QUALITY_IMPACT_FACTOR = 1.0; // Placeholder
        const estimatedCPAS = BASE_PREDICTED_CPAS_FACTOR * DURATION_IMPACT_FACTOR * BUDGET_SENSITIVITY_FACTOR * AS_GOAL_SENSITIVITY_FACTOR * JOB_QUALITY_IMPACT_FACTOR * seasonalityFactor;
        const projectedAS = estimatedCPAS > 0 ? scenarioInputs.budget / estimatedCPAS : 0;
            return {
              name: config.name,
              budget: scenarioInputs.budget,
          projectedAS: Math.round(projectedAS),
          cpas: parseFloat(estimatedCPAS.toFixed(2)),
              risk: config.risk,
              confidence: config.confidence
            };
      });

      // Edge case adjustment: If Conservative AS >= Current Plan AS, reduce Conservative AS
      if (calculatedScenarios.length >= 2) {
        const conservative = calculatedScenarios[0];
        const currentPlan = calculatedScenarios[1];
        if (conservative.projectedAS >= currentPlan.projectedAS) {
          conservative.projectedAS = Math.round(currentPlan.projectedAS * 0.75);
          conservative.cpas = conservative.budget / conservative.projectedAS;
          }
      }
      setScenarios(calculatedScenarios);
      setLoadingScenarios(false);
    };

    calculateScenarios();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs, results]);

  // Calculate cumulative budget spend over time
  const pacingTrends = Array.isArray(results.pacingTrends) ? results.pacingTrends : [];
  const budgetSpendData = pacingTrends.map((day, index) => ({
    day: index + 1,
    cumulativeSpend: day.cumulativeSpend,
    budgetRemaining: inputs.budget - day.cumulativeSpend,
    utilizationPercent: (day.cumulativeSpend / inputs.budget) * 100
  }));

  // Calculate budget spend as Projected AS * Estimated CPAS
  const budgetSpend = typeof results.projectedAS === 'number' && typeof results.estimatedCPAS === 'number'
    ? results.projectedAS * results.estimatedCPAS
    : 0;
  const budgetUtilization = Math.round((budgetSpend / inputs.budget) * 100);
  const dailyBurnRate = pacingTrends.length > 0 ? Math.round(budgetSpend / pacingTrends.length) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Budget Utilization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{budgetUtilization}%</div>
            <Progress value={budgetUtilization} className="mt-2 h-2" />
            <p className="text-xs text-gray-500 mt-1">
              ${budgetSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} of ${inputs.budget.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Daily Burn Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pacingTrends.length > 0 ? `$${dailyBurnRate}` : '-'}</div>
            <Badge variant="default" className="mt-1">
              Per Day Average
            </Badge>
            <p className="text-xs text-gray-500 mt-1">Based on campaign projections</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-600 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Budget Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {results.goalStatus.budgetExhausted ? (
                <span className="text-red-600">Over Budget</span>
              ) : (
                <span className="text-green-600">Within Budget</span>
              )}
            </div>
            <Badge variant={results.goalStatus.budgetExhausted ? "destructive" : "default"} className="mt-1">
              {results.goalStatus.budgetExhausted ? "Needs Adjustment" : "On Track"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Budget Spend Projection</CardTitle>
          <CardDescription>Cumulative budget utilization over campaign duration</CardDescription>
        </CardHeader>
        <CardContent>
          {budgetSpendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={budgetSpendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip formatter={(value, name) => [
                name === 'cumulativeSpend' ? `$${value}` : `$${value}`,
                name === 'cumulativeSpend' ? 'Spent' : 'Remaining'
              ]} />
              <Area 
                type="monotone" 
                dataKey="cumulativeSpend" 
                stackId="1"
                stroke="#3B82F6" 
                fill="#3B82F6" 
                fillOpacity={0.6}
                name="Cumulative Spend"
              />
              <Area 
                type="monotone" 
                dataKey="budgetRemaining" 
                stackId="1"
                stroke="#10B981" 
                fill="#10B981" 
                fillOpacity={0.6}
                name="Budget Remaining"
              />
            </AreaChart>
          </ResponsiveContainer>
          ) : (
            <div className="text-gray-500 text-center py-8">No pacing data available for the selected window.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Budget Scenarios Comparison</CardTitle>
          <CardDescription>Performance projections under different budget allocations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-400 rounded text-blue-900 text-sm">
            <b>Note:</b> If all scenarios show the same values, it means your campaign budgets are higher than the total possible spend for the selected duration. In this case, the campaign is not budget-constrained and all scenarios reflect the maximum achievable Apply Starts and CPAS for that period.
          </div>
          {loadingScenarios ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Calculating scenarios...</div>
            </div>
          ) : (
          <div className="space-y-4">
            {scenarios.map((scenario, index) => (
              <div key={index} className={`p-4 rounded-lg border-2 ${
                scenario.name === 'Current Plan' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-lg">{scenario.name}</h4>
                    <p className="text-sm text-gray-600">
                      Budget: ${scenario.budget.toLocaleString()} | Risk Level: {scenario.risk}
                    </p>
                  </div>
                  <Badge variant={scenario.name === 'Current Plan' ? "default" : "secondary"}>
                    {Math.round(scenario.confidence * 100)}% Confidence
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-2 bg-white rounded">
                      <div className="text-2xl font-bold text-green-600">{scenario.projectedAS.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">Apply Starts</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded">
                    <div className="text-2xl font-bold text-blue-600">
                      ${typeof scenario.cpas === 'number' ? scenario.cpas.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : scenario.cpas}
                    </div>
                    <div className="text-xs text-gray-500">Estimated CPAS</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded">
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.round((scenario.projectedAS / inputs.asGoal) * 100)}%
                    </div>
                    <div className="text-xs text-gray-500">Goal Achievement</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Budget Optimization Alerts
          </CardTitle>
          <CardDescription>Critical insights and recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {budgetUtilization > 100 && (
              <div className="p-3 bg-red-50 border-l-4 border-l-red-500 rounded">
                <div className="font-medium text-red-800">Budget Overrun Risk</div>
                <div className="text-sm text-red-700">
                  Current projections exceed budget by {(budgetUtilization - 100).toFixed(2)}%. Consider extending campaign duration or increasing budget.
                </div>
              </div>
            )}
            
            {budgetUtilization < 80 && (
              <div className="p-3 bg-yellow-50 border-l-4 border-l-yellow-500 rounded">
                <div className="font-medium text-yellow-800">Budget Underutilization</div>
                <div className="text-sm text-yellow-700">
                  Only {budgetUtilization}% of budget is projected to be used. Consider increasing job count or extending campaign reach.
                </div>
              </div>
            )}
            
            {dailyBurnRate > (inputs.budget / 30) && (
              <div className="p-3 bg-orange-50 border-l-4 border-l-orange-500 rounded">
                <div className="font-medium text-orange-800">High Burn Rate</div>
                <div className="text-sm text-orange-700">
                  Daily spend rate is high. Monitor closely to avoid early budget exhaustion.
                </div>
              </div>
            )}
            
            {!results.goalStatus.asGoalMet && (
              <div className="p-3 bg-blue-50 border-l-4 border-l-blue-500 rounded">
                <div className="font-medium text-blue-800">Apply Starts Goal Not Met</div>
                <div className="text-sm text-blue-700">
                  Current projections show {results.projectedAS.toLocaleString()} Apply Starts, below the goal of {inputs.asGoal.toLocaleString()}. 
                  Consider increasing budget or extending campaign duration.
                </div>
                {/* Extra Budget Suggestion */}
                {results.estimatedCPAS > 0 && results.projectedAS > 0 && (
                  (() => {
                    const requiredBudget = inputs.asGoal * results.estimatedCPAS;
                    const extraBudget = requiredBudget - inputs.budget;
                    if (extraBudget > 0) {
                      return (
                        <div className="mt-2 text-sm text-blue-900 font-semibold">
                          To meet your Apply Starts goal of {inputs.asGoal.toLocaleString()}, you would need approximately ${extraBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })} more budget (total required: ${requiredBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}).
                        </div>
                      );
                    }
                    return null;
                  })()
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
