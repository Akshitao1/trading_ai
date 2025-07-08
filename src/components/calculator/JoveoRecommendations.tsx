import React from 'react';
import { PredictionResults, TradingInputs } from '@/types/trading';

interface JoveoRecommendationsProps {
  results: PredictionResults;
  inputs: TradingInputs;
}

export const JoveoRecommendations: React.FC<JoveoRecommendationsProps> = ({ results, inputs }) => {
  let appropriateEndDate = '';
  if (inputs.startDate && results.daysToGoal) {
    const start = new Date(inputs.startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + results.daysToGoal - 1);
    appropriateEndDate = end.toISOString().slice(0, 10);
  }

  // Budget prediction insight
  let budgetInsight = null;
  if (
    results.estimatedCPAS > 0 &&
    results.projectedAS > 0 &&
    !results.goalStatus.asGoalMet
  ) {
    const requiredBudget = inputs.asGoal * results.estimatedCPAS;
    const extraBudget = requiredBudget - inputs.budget;
    if (extraBudget > 0) {
      budgetInsight = (
        <div className="mt-2 text-sm text-green-900 font-semibold">
          To meet your Apply Starts goal of {inputs.asGoal.toLocaleString()}, you would need approximately ${extraBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })} more budget (total required: ${requiredBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}).
        </div>
      );
    }
  }

  return (
    <div className="space-y-3">
      {/* Appropriate End Date at the top */}
      {appropriateEndDate && (
        <div className="p-3 bg-green-50 border-l-4 border-l-green-500 rounded">
          <div className="font-medium text-green-800">Appropriate End Date</div>
          <div className="text-sm text-green-700">{appropriateEndDate}</div>
        </div>
      )}
      {/* Budget insight immediately after end date */}
      {budgetInsight && (
        <div className="p-3 bg-green-50 border-l-4 border-l-green-500 rounded">
          {budgetInsight}
        </div>
      )}
    </div>
  );
}; 