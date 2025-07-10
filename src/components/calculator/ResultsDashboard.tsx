import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Target, DollarSign, Calendar, Briefcase, Info } from 'lucide-react';
import { PredictionResults, TradingInputs } from '@/types/trading';
import { useCalculatorLogic } from '@/hooks/useCalculatorLogic';

interface ResultsDashboardProps {
  results: PredictionResults;
  inputs: TradingInputs;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({ results, inputs }) => {
  const { calculatePredictions } = useCalculatorLogic();
  const [overviewResults, setOverviewResults] = useState(results);

  useEffect(() => {
    // Always recalculate using the backend API for the main campaign
    const fetchOverview = async () => {
      const res = await calculatePredictions(inputs);
      if (res) setOverviewResults(res);
    };
    fetchOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs]);

  const campaignDays = inputs.startDate && inputs.endDate
    ? (new Date(inputs.endDate).getTime() - new Date(inputs.startDate).getTime()) / (1000 * 60 * 60 * 24) + 1
    : 0;

  const budgetUtilization = Math.round((overviewResults.budgetSpend / inputs.budget) * 100);
  const asGoalProgress = Math.round((overviewResults.projectedAS / inputs.asGoal) * 100);

  // Calculate estimated and projected values using backend logic (no UI mention of boundaries)
  const estimatedCPAS = overviewResults.estimatedCPAS;
  const projectedAS = overviewResults.projectedAS;
  const estimatedAS = inputs.budget && estimatedCPAS > 0 ? Math.round(inputs.budget / estimatedCPAS) : 0;

  // Calculate the appropriate end date for Days to Goal
  let appropriateEndDate = '';
  if (inputs.startDate && results.daysToGoal) {
    const start = new Date(inputs.startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + results.daysToGoal - 1);
    appropriateEndDate = end.toISOString().slice(0, 10);
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Estimated CPAS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{typeof overviewResults.estimatedCPAS === 'number' ? `$${overviewResults.estimatedCPAS.toFixed(2)}` : '-'}</div>
            <div className="flex items-center gap-2 mt-1">
              {inputs.cpasGoal && (
                <Badge variant={overviewResults.goalStatus.cpasGoalMet ? "default" : "destructive"}>
                  {overviewResults.goalStatus.cpasGoalMet ? "Goal Met" : "Above Goal"}
                </Badge>
              )}
              {inputs.cpasGoal && (
                <span className="text-sm text-gray-500">
                  Goal: ${inputs.cpasGoal}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Projected Apply Starts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{typeof overviewResults.projectedAS === 'number' ? overviewResults.projectedAS.toLocaleString() : '-'}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={overviewResults.goalStatus.asGoalMet ? "default" : "destructive"}>
                {overviewResults.goalStatus.asGoalMet ? "Goal Achievable" : "Below Goal"}
              </Badge>
              <span className="text-sm text-gray-500">
                Goal: {inputs.asGoal.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-600 flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Budget Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{typeof overviewResults.projectedAS === 'number' && typeof overviewResults.estimatedCPAS === 'number' ? `$${(overviewResults.projectedAS * overviewResults.estimatedCPAS).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={overviewResults.goalStatus.budgetExhausted ? "destructive" : "default"}>
                {budgetUtilization}% Utilized
              </Badge>
              <span className="text-sm text-gray-500">
                of ${inputs.budget.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Days to Goal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{results.daysToGoal}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={results.daysToGoal <= campaignDays ? "default" : "destructive"}>
                {results.daysToGoal <= campaignDays ? "On Track" : "Extended Time"}
              </Badge>
              <span className="text-sm text-gray-500">
                Campaign: {campaignDays} days
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              Apply Starts Progress
            </CardTitle>
            <CardDescription>Projected vs. Goal Achievement</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Current Projection</span>
                <span className="font-medium">{asGoalProgress}% of goal</span>
              </div>
              <Progress value={Math.min(asGoalProgress, 100)} className="h-3" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0</span>
                <span>{inputs.asGoal.toLocaleString()} (Goal)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              Budget Utilization
            </CardTitle>
            <CardDescription>Projected Spend vs. Available Budget</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Projected Usage</span>
                <span className="font-medium">{budgetUtilization}%</span>
              </div>
              <Progress value={budgetUtilization} className="h-3" />
              <div className="flex justify-between text-xs text-gray-500">
                <span>$0</span>
                <span>${inputs.budget.toLocaleString()} (Budget)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model Confidence */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
            AI Model Confidence
          </CardTitle>
          <CardDescription>Prediction accuracy based on historical data analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Progress value={overviewResults.confidence * 100} className="h-3" />
            </div>
            <div className="text-lg font-semibold text-indigo-600">
              {Math.round(overviewResults.confidence * 100)}%
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            High confidence indicates strong correlation with historical patterns and reliable predictions.
          </p>
        </CardContent>
      </Card>
      <div className="mt-4 text-xs text-blue-700 bg-blue-50 border-l-4 border-blue-400 rounded p-3">
        <b>Note:</b> All predictions are generated using historical data as a reference for seasonality and performance patterns.
      </div>
    </div>
  );
};
