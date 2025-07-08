
export interface TradingInputs {
  budget: number;
  asGoal: number;
  startDate: string;
  endDate: string;
  cpasGoal?: number;
  numberOfJobs?: number;
}

export interface PredictionResults {
  estimatedCPAS: number;
  projectedAS: number;
  budgetSpend: number;
  daysToGoal: number;
  goalStatus: {
    cpasGoalMet: boolean;
    asGoalMet: boolean;
    budgetExhausted: boolean;
  };
  pacingTrends: PacingData[];
  jobImpact: JobImpactData;
  recommendations: Recommendation[];
  confidence: number;
}

export interface PacingData {
  week: number;
  day: string;
  predictedSpend: number;
  predictedAS: number;
  cumulativeSpend: number;
  cumulativeAS: number;
  cpas: number;
}

export interface JobImpactData {
  qualityScore: number;
  impactOnCPAS: number;
  impactOnVolume: number;
  optimalJobCount: number;
  qualityDistribution: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface Recommendation {
  category: string;
  suggestion: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number;
}

export interface HistoricalData {
  applyStarts: number;
  spend: number;
  clicks: number;
  cpas: number;
  date: string;
  weekday: string;
  jobCount: number;
  jobQuality: number;
}
