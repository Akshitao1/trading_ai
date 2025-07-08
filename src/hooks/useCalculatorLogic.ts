import { useState } from 'react';
import { PredictionResults, TradingInputs, HistoricalData, PacingData, JobImpactData, Recommendation } from '@/types/trading';
import juneData from '@/data/data1.json'; // Assume you convert data1.csv to data1.json for import
import forecastedCPAS from '@/data/forecasted_cpas.json'; // New: import Prophet forecast

const marketSeasonality = {
  Jan: 0.9, Feb: 0.95, Mar: 1.0, Apr: 1.05, May: 1.1, Jun: 1.2,
  Jul: 1.15, Aug: 1.1, Sep: 1.0, Oct: 1.05, Nov: 1.2, Dec: 1.3
};

function getMonthShort(date: Date) {
  return date.toLocaleString('default', { month: 'short' });
}

export const useCalculatorLogic = () => {
  const [results, setResults] = useState<PredictionResults | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Helper: Parse date string to Date
  const parseDate = (dateStr: string) => new Date(dateStr);

  // Helper: Filter June data by date range
  const filterDataByRange = (start: string, end: string) => {
    const startDate = parseDate(start);
    const endDate = parseDate(end);
    return juneData.filter((row: any) => {
      const d = parseDate(row.EVENT_PUBLISHER_DATE);
      return d >= startDate && d <= endDate && row.APPLY_START > 0;
    });
  };

  // Helper: Calculate average CPAS from June data
  const getJuneAvgCPAS = () => {
    const validRows = juneData.filter((row: any) => row.APPLY_START > 0);
    const cpasList = validRows.map((row: any) => row.CDSPEND / row.APPLY_START);
    return cpasList.length > 0 ? cpasList.reduce((sum, c) => sum + c, 0) / cpasList.length : 0;
  };

  // --- New: Analyze June data for weekly CPAS patterns ---
  // Helper to get week number in June (1-based)
  function getJuneWeek(dateStr: string) {
    const date = new Date(dateStr);
    return Math.floor((date.getDate() - 1) / 7) + 1;
  }

  // Aggregate June data by week, sum CDSPEND and APPLY_START per day, then per week
  const juneCPASByWeek: { [week: number]: number } = {};
  const weekSums: { [week: number]: { spend: number; apply: number } } = {};
  juneData.forEach((row: any) => {
    if (row.APPLY_START > 0 && row.CDSPEND > 0 && row.EVENT_PUBLISHER_DATE.startsWith('2025-06')) {
      const week = getJuneWeek(row.EVENT_PUBLISHER_DATE);
      if (!weekSums[week]) weekSums[week] = { spend: 0, apply: 0 };
      weekSums[week].spend += row.CDSPEND;
      weekSums[week].apply += row.APPLY_START;
    }
  });
  for (const week in weekSums) {
    juneCPASByWeek[week] = weekSums[week].spend / weekSums[week].apply;
  }
  // If a week is missing, fill with June average
  const juneAvgCPAS = Object.values(juneCPASByWeek).reduce((a, b) => a + b, 0) / Object.values(juneCPASByWeek).length;
  for (let w = 1; w <= 5; w++) {
    if (!juneCPASByWeek[w]) juneCPASByWeek[w] = juneAvgCPAS;
  }

  // --- Calculate normalized weekly multipliers from June data ---
  const weekMultipliers: number[] = [];
  for (let w = 1; w <= 4; w++) {
    weekMultipliers.push(juneCPASByWeek[w] / juneAvgCPAS);
  }
  // Normalize so average is 1.0
  const avgMultiplier = weekMultipliers.reduce((a, b) => a + b, 0) / weekMultipliers.length;
  for (let i = 0; i < weekMultipliers.length; i++) {
    weekMultipliers[i] = weekMultipliers[i] / avgMultiplier;
  }

  // --- Calculate historical weekly apply starts proportions from June data ---
  const weekApplyStarts: { [week: number]: number } = {};
  let totalJuneAS = 0;
  juneData.forEach((row: any) => {
    if (row.APPLY_START > 0 && row.EVENT_PUBLISHER_DATE.startsWith('2025-06')) {
      const week = getJuneWeek(row.EVENT_PUBLISHER_DATE);
      weekApplyStarts[week] = (weekApplyStarts[week] || 0) + row.APPLY_START;
      totalJuneAS += row.APPLY_START;
    }
  });
  const weekProportions: number[] = [];
  for (let w = 1; w <= 4; w++) {
    weekProportions.push(weekApplyStarts[w] ? weekApplyStarts[w] / totalJuneAS : 1 / 4);
  }

  const calculatePredictions = async (inputs: TradingInputs): Promise<PredictionResults> => {
    setIsCalculating(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      // Always use backend for predictions
      const weeks = Math.max(1, Math.round((new Date(inputs.endDate).getTime() - new Date(inputs.startDate).getTime()) / (1000 * 60 * 60 * 24 * 7)));
      const apiUrl = `http://localhost:8000/api/cpas-for-budget?budget=${inputs.budget}&duration=${weeks}&start_date=${inputs.startDate}&end_date=${inputs.endDate}`;
      const resp = await fetch(apiUrl);
      if (resp.ok) {
        const data = await resp.json();
      const campaignDays = Math.ceil((new Date(inputs.endDate).getTime() - new Date(inputs.startDate).getTime()) / (1000 * 60 * 60 * 24));
        const minDuration = Math.max(7, campaignDays); // Enforce at least 7 days or actual campaign duration
        const rawDaysToGoal = Math.ceil(inputs.asGoal / (data.total_apply_starts / campaignDays));
        const daysToGoal = Math.max(rawDaysToGoal, minDuration);
      const results: PredictionResults = {
          estimatedCPAS: data.cpas,
          projectedAS: data.total_apply_starts,
          budgetSpend: data.total_spend,
          daysToGoal,
        goalStatus: {
            cpasGoalMet: inputs.cpasGoal ? data.cpas <= inputs.cpasGoal : true,
            asGoalMet: data.total_apply_starts >= inputs.asGoal,
            budgetExhausted: data.total_spend >= inputs.budget * 0.95
          },
          pacingTrends: data.pacingTrends || [],
          jobImpact: { qualityScore: 0, impactOnCPAS: 0, impactOnVolume: 0, optimalJobCount: 0, qualityDistribution: { high: 0, medium: 0, low: 0 } },
          recommendations: [],
          confidence: typeof data.confidence === 'number' ? data.confidence : 0.95
        };
      setResults(results);
        return results;
      } else {
        throw new Error('Backend prediction failed');
      }
    } catch (error) {
      console.error('Error calculating predictions:', error);
      setResults(null);
      return null;
    } finally {
      setIsCalculating(false);
    }
  };

  return {
    results,
    isCalculating,
    calculatePredictions
  };
};

export async function fetchBoundaries(budget: number, duration: number) {
  const apiUrl = `http://localhost:8000/api/boundaries-for-budget?budget=${budget}&duration=${duration}`;
  const resp = await fetch(apiUrl);
  if (!resp.ok) throw new Error('Failed to fetch boundaries');
  return await resp.json();
}

export async function fetchJobQualityScores() {
  const apiUrl = `http://localhost:8000/api/job-quality-scores`;
  const resp = await fetch(apiUrl);
  if (!resp.ok) throw new Error('Failed to fetch job quality scores');
  return await resp.json();
}

export async function fetchJobImpactScenarios(budget: number, duration: number, asGoal: number, startDate?: string, endDate?: string) {
  let apiUrl = `http://localhost:8000/api/job-impact-scenarios?budget=${budget}&duration=${duration}&as_goal=${asGoal}`;
  if (startDate && endDate) {
    apiUrl += `&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
  }
  const resp = await fetch(apiUrl);
  if (!resp.ok) throw new Error('Failed to fetch job impact scenarios');
  return await resp.json();
}
