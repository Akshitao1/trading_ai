import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';
import { PredictionResults, TradingInputs } from '@/types/trading';
import { Switch } from '@/components/ui/switch';
import juneData from '@/data/data1.json'; // Import June data for historic trend
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useCalculatorLogic, fetchBoundaries } from '@/hooks/useCalculatorLogic';

interface PacingAnalysisProps {
  results: PredictionResults;
  inputs: TradingInputs;
}

// Helper to get week number in June (1-based)
function getJuneWeek(dateStr: string) {
  const date = new Date(dateStr);
  return Math.floor((date.getDate() - 1) / 7) + 1;
}

// Calculate June weekly CPAS averages
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
for (let w = 1; w <= 4; w++) {
  if (!juneCPASByWeek[w]) juneCPASByWeek[w] = juneAvgCPAS;
}

// Add the PacingScenarioSlider component
const PacingScenarioSlider = ({ inputs, currentResults, overviewResults }) => {
  const { calculatePredictions } = useCalculatorLogic();
  const [budgetPct, setBudgetPct] = useState(1); // 1 = 100%
  const [duration, setDuration] = useState(30); // default 30 days
  const [scenario, setScenario] = useState(null);
  const [loading, setLoading] = useState(false);
  const [boundaries, setBoundaries] = useState(null);
  const [boundariesLoading, setBoundariesLoading] = useState(false);

  // Find min/max for sliders
  const minBudget = Math.round(inputs.budget * 0.5);
  const maxBudget = Math.round(inputs.budget * 1.5);
  const minDuration = 7;
  const maxDuration = 60;

  // Helper to check if scenario matches main campaign
  const isMainCampaign =
    Math.round(inputs.budget * budgetPct) === inputs.budget && duration === (new Date(inputs.endDate).getTime() - new Date(inputs.startDate).getTime()) / (1000 * 60 * 60 * 24) + 1;

  useEffect(() => {
    const runScenario = async () => {
      setLoading(true);
      const today = new Date(inputs.startDate);
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + duration - 1);
      const scenarioInputs = {
        ...inputs,
        budget: Math.round(inputs.budget * budgetPct),
        startDate: inputs.startDate,
        endDate: endDate.toISOString().slice(0, 10),
      };
      // Use the same logic as for Estimated CPAS/Apply Starts
      const res = await calculatePredictions(scenarioInputs);
      setScenario(res);
      setLoading(false);
    };
    runScenario();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetPct, duration, inputs]);

  useEffect(() => {
    const getBoundaries = async () => {
      setBoundariesLoading(true);
      try {
        const budget = Math.round(inputs.budget * budgetPct);
        const res = await fetchBoundaries(budget, duration);
        setBoundaries(res);
      } catch (e) {
        setBoundaries(null);
      }
      setBoundariesLoading(false);
    };
    getBoundaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetPct, duration, inputs]);

  // Use overviewResults for baseline if scenario matches main campaign
  const baseline = isMainCampaign && overviewResults ? overviewResults : currentResults;

  return (
    <Card className="my-6">
      <CardHeader>
        <CardTitle>Pacing Scenario Explorer</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <label className="block font-medium mb-1">Budget: ${Math.round(inputs.budget * budgetPct).toLocaleString()}</label>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.01}
            value={budgetPct}
            onChange={e => setBudgetPct(Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <div className="flex justify-between text-xs">
            <span>${minBudget.toLocaleString()}</span>
            <span>${maxBudget.toLocaleString()}</span>
          </div>
        </div>
        <div className="mb-4">
          <label className="block font-medium mb-1">Duration: {duration} days</label>
          <input
            type="range"
            min={minDuration}
            max={maxDuration}
            step={1}
            value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <div className="flex justify-between text-xs">
            <span>{minDuration} days</span>
            <span>{maxDuration} days</span>
          </div>
        </div>
        {loading && <div>Calculating...</div>}
        {scenario && !loading && (
          <div className="mt-4 space-y-2">
            <div className="text-sm text-gray-600 mb-2">
              <b>How do these numbers change?</b> As you adjust the budget or duration sliders, Projected CPAS and Apply Starts update in real time. Increasing the budget or extending the duration typically lowers CPAS (cost per apply start) and increases total Apply Starts, while reducing budget or shortening duration usually raises CPAS and lowers Apply Starts. The model uses historical pacing and seasonality to estimate these changes.
            </div>
            <div>
              <b>Projected CPAS:</b> ${typeof scenario.estimatedCPAS === 'number' ? scenario.estimatedCPAS.toFixed(2) : '-'}
              <span className={scenario.estimatedCPAS < baseline.estimatedCPAS ? 'text-green-600 ml-2' : 'text-red-600 ml-2'}>
                {scenario.estimatedCPAS < baseline.estimatedCPAS
                  ? `↓ ${(100 * (baseline.estimatedCPAS - scenario.estimatedCPAS) / baseline.estimatedCPAS).toFixed(1)}%`
                  : scenario.estimatedCPAS > baseline.estimatedCPAS
                  ? `↑ ${(100 * (scenario.estimatedCPAS - baseline.estimatedCPAS) / baseline.estimatedCPAS).toFixed(1)}%`
                  : '0.0%'}
              </span>
            </div>
            <div>
              <b>Projected Apply Starts:</b> {typeof scenario.projectedAS === 'number' ? scenario.projectedAS.toLocaleString() : '-'}
            </div>
            <div>
              <b>Projected Spend:</b> ${typeof scenario.budgetSpend === 'number' ? scenario.budgetSpend.toLocaleString() : '-'}
            </div>
          </div>
        )}
        <div className="mt-6">
          <b>Boundary Conditions</b>
          {boundariesLoading && <div>Loading boundaries...</div>}
          {boundaries && !boundariesLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div className="border rounded p-3 bg-gray-50">
                <div className="font-semibold text-green-700">Maximum Delivery</div>
                <div>Apply Starts: <b>{boundaries.max_apply_starts.toLocaleString()}</b></div>
                <div>Spend: <b>${boundaries.max_spend.toLocaleString()}</b></div>
                <div>CPAS: <b>${boundaries.max_cpas.toFixed(2)}</b></div>
              </div>
              <div className="border rounded p-3 bg-gray-50">
                <div className="font-semibold text-red-700">Minimum Delivery</div>
                <div>Apply Starts: <b>{boundaries.min_apply_starts.toLocaleString()}</b></div>
                <div>Spend: <b>${boundaries.min_spend.toLocaleString()}</b></div>
                <div>CPAS: <b>${boundaries.min_cpas.toFixed(2)}</b></div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const PacingAnalysis: React.FC<PacingAnalysisProps> = ({ results, inputs }) => {
  // --- Get seasonality factor for selected month ---
  const marketSeasonality = {
    Jan: 0.9, Feb: 0.95, Mar: 1.0, Apr: 1.05, May: 1.1, Jun: 1.2,
    Jul: 1.15, Aug: 1.1, Sep: 1.0, Oct: 1.05, Nov: 1.2, Dec: 1.3
  };
  function getMonthShort(date: Date) {
    return date.toLocaleString('default', { month: 'short' });
  }
  const month = inputs.startDate ? getMonthShort(new Date(inputs.startDate)) : 'Jun';
  const seasonalityFactor = marketSeasonality[month] || 1.0;

  // --- Build historic daily CPAS trend, seasonally adjusted ---
  const juneCPASByDate: { [date: string]: number } = {};
  juneData.forEach((row: any) => {
    if (row.APPLY_START > 0 && row.CDSPEND > 0 && row.EVENT_PUBLISHER_DATE.startsWith('2025-06')) {
      juneCPASByDate[row.EVENT_PUBLISHER_DATE] = (row.CDSPEND / row.APPLY_START) * seasonalityFactor;
    }
  });

  // --- Build chart data for the campaign period using historic trend ---
  const campaignDays = Math.ceil((new Date(inputs.endDate).getTime() - new Date(inputs.startDate).getTime()) / (1000 * 60 * 60 * 24));
  const chartData = [];
  const juneDates = Object.keys(juneCPASByDate).sort(); // Ensure sorted by date
  for (let i = 0; i < campaignDays; i++) {
    const date = new Date(inputs.startDate);
    date.setDate(date.getDate() + i);
    const dayOfMonth = date.getDate();
    // Find June date with same day
    const juneDate = `2025-06-${dayOfMonth.toString().padStart(2, '0')}`;
    const cpas = juneCPASByDate[juneDate] ?? null; // null if not found
    chartData.push({
      day: date.toISOString().slice(0, 10),
      week: getJuneWeek(juneDate),
      cpas,
      historicDate: juneDate
    });
  }

  // --- Weekly Performance Trends (sum by week) ---
  const weeklyData = chartData.reduce((acc, day) => {
    const weekKey = `Week ${day.week}`;
    if (!acc[weekKey]) {
      acc[weekKey] = {
        week: weekKey,
        totalAS: 0,
        totalSpend: 0,
        avgCPAS: 0,
        days: 0
      };
    }
    // For demo, assume 1 AS per day, spend = cpas (can be improved if you want to use real AS)
    acc[weekKey].totalAS += 1;
    acc[weekKey].totalSpend += day.cpas || 0;
    acc[weekKey].days += 1;
    return acc;
  }, {} as any);
  const weeklyChartData = Object.values(weeklyData).map((week: any) => ({
    ...week,
    avgCPAS: Math.round((week.totalSpend / week.totalAS) * 100) / 100
  }));

  // --- Find peaks/troughs ---
  const cpasValues = chartData.map(d => d.cpas);
  const maxCPAS = Math.max(...cpasValues.filter(cpas => cpas !== null));
  const minCPAS = Math.min(...cpasValues.filter(cpas => cpas !== null));

  // --- Reference line for average CPAS ---
  const avgCPAS = cpasValues.reduce((a, b) => a + b, 0) / cpasValues.length;

  // --- Week boundaries for shading ---
  const weekBoundaries = Array.from(new Set(chartData.map(d => d.week)));

  // --- Build moving average (7-day) for CPAS ---
  function movingAverage(data: any[], window: number) {
    return data.map((d, i) => {
      const slice = data.slice(Math.max(0, i - window + 1), i + 1);
      const valid = slice.filter(x => x.cpas !== null && x.cpas !== undefined);
      const avg = valid.length > 0 ? valid.reduce((sum, x) => sum + x.cpas, 0) / valid.length : null;
      return { ...d, cpasMA: avg };
    });
  }
  const chartDataWithMA = movingAverage(chartData, 7);

  // --- Day of the Week Analysis ---
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const cpasByDayOfWeek: { [day: string]: number[] } = {};
  Object.entries(juneCPASByDate).forEach(([date, cpas]) => {
    const d = new Date(date);
    const day = dayNames[d.getDay()];
    if (!cpasByDayOfWeek[day]) cpasByDayOfWeek[day] = [];
    cpasByDayOfWeek[day].push(cpas);
  });
  const dayOfWeekChartData = dayNames.map(day => ({
    day,
    avgCPAS: cpasByDayOfWeek[day] && cpasByDayOfWeek[day].length > 0 ?
      (cpasByDayOfWeek[day].reduce((a, b) => a + b, 0) / cpasByDayOfWeek[day].length) : null
  }));

  // --- Week of the Month Analysis ---
  const cpasByWeekOfMonth: { [week: number]: number[] } = {};
  Object.entries(juneCPASByDate).forEach(([date, cpas]) => {
    const week = getJuneWeek(date);
    if (!cpasByWeekOfMonth[week]) cpasByWeekOfMonth[week] = [];
    cpasByWeekOfMonth[week].push(cpas);
  });
  const weekOfMonthChartData = [1, 2, 3, 4].map(week => ({
    week: `Week ${week}`,
    avgCPAS: cpasByWeekOfMonth[week] && cpasByWeekOfMonth[week].length > 0 ?
      (cpasByWeekOfMonth[week].reduce((a, b) => a + b, 0) / cpasByWeekOfMonth[week].length) : null
  }));

  // --- Build historic daily Apply Start and Spend trend, seasonally adjusted ---
  const juneASByDate: { [date: string]: number } = {};
  const juneSpendByDate: { [date: string]: number } = {};
  juneData.forEach((row: any) => {
    if (row.APPLY_START > 0 && row.EVENT_PUBLISHER_DATE.startsWith('2025-06')) {
      juneASByDate[row.EVENT_PUBLISHER_DATE] = row.APPLY_START;
    }
    if (row.CDSPEND > 0 && row.EVENT_PUBLISHER_DATE.startsWith('2025-06')) {
      juneSpendByDate[row.EVENT_PUBLISHER_DATE] = row.CDSPEND * seasonalityFactor;
    }
  });

  // --- Build chart data for the campaign period using historic trend (Apply Start & Spend) ---
  const chartDataAS = [];
  const chartDataSpend = [];
  for (let i = 0; i < campaignDays; i++) {
    const date = new Date(inputs.startDate);
    date.setDate(date.getDate() + i);
    const dayOfMonth = date.getDate();
    const juneDate = `2025-06-${dayOfMonth.toString().padStart(2, '0')}`;
    chartDataAS.push({
      day: date.toISOString().slice(0, 10),
      week: getJuneWeek(juneDate),
      as: juneASByDate[juneDate] ?? null,
      historicDate: juneDate
    });
    chartDataSpend.push({
      day: date.toISOString().slice(0, 10),
      week: getJuneWeek(juneDate),
      spend: juneSpendByDate[juneDate] ?? null,
      historicDate: juneDate
    });
  }

  // --- Moving averages for AS and Spend ---
  function movingAverageKey(data: any[], key: string, window: number) {
    return data.map((d, i) => {
      const slice = data.slice(Math.max(0, i - window + 1), i + 1);
      const valid = slice.filter(x => x[key] !== null && x[key] !== undefined);
      const avg = valid.length > 0 ? valid.reduce((sum, x) => sum + x[key], 0) / valid.length : null;
      return { ...d, [`${key}MA`]: avg };
    });
  }
  const chartDataASWithMA = movingAverageKey(chartDataAS, 'as', 7);
  const chartDataSpendWithMA = movingAverageKey(chartDataSpend, 'spend', 7);

  // --- Day of the Week Analysis for AS and Spend ---
  const asByDayOfWeek: { [day: string]: number[] } = {};
  const spendByDayOfWeek: { [day: string]: number[] } = {};
  Object.entries(juneASByDate).forEach(([date, as]) => {
    const d = new Date(date);
    const day = dayNames[d.getDay()];
    if (!asByDayOfWeek[day]) asByDayOfWeek[day] = [];
    asByDayOfWeek[day].push(as);
  });
  Object.entries(juneSpendByDate).forEach(([date, spend]) => {
    const d = new Date(date);
    const day = dayNames[d.getDay()];
    if (!spendByDayOfWeek[day]) spendByDayOfWeek[day] = [];
    spendByDayOfWeek[day].push(spend);
  });
  const dayOfWeekASChartData = dayNames.map(day => ({
    day,
    avgAS: asByDayOfWeek[day] && asByDayOfWeek[day].length > 0 ?
      (asByDayOfWeek[day].reduce((a, b) => a + b, 0) / asByDayOfWeek[day].length) : null
  }));
  const dayOfWeekSpendChartData = dayNames.map(day => ({
    day,
    avgSpend: spendByDayOfWeek[day] && spendByDayOfWeek[day].length > 0 ?
      (spendByDayOfWeek[day].reduce((a, b) => a + b, 0) / spendByDayOfWeek[day].length) : null
  }));

  // --- Week of the Month Analysis for AS and Spend ---
  const asByWeekOfMonth: { [week: number]: number[] } = {};
  const spendByWeekOfMonth: { [week: number]: number[] } = {};
  Object.entries(juneASByDate).forEach(([date, as]) => {
    const week = getJuneWeek(date);
    if (!asByWeekOfMonth[week]) asByWeekOfMonth[week] = [];
    asByWeekOfMonth[week].push(as);
  });
  Object.entries(juneSpendByDate).forEach(([date, spend]) => {
    const week = getJuneWeek(date);
    if (!spendByWeekOfMonth[week]) spendByWeekOfMonth[week] = [];
    spendByWeekOfMonth[week].push(spend);
  });
  const weekOfMonthASChartData = [1, 2, 3, 4].map(week => ({
    week: `Week ${week}`,
    avgAS: asByWeekOfMonth[week] && asByWeekOfMonth[week].length > 0 ?
      (asByWeekOfMonth[week].reduce((a, b) => a + b, 0) / asByWeekOfMonth[week].length) : null
  }));
  const weekOfMonthSpendChartData = [1, 2, 3, 4].map(week => ({
    week: `Week ${week}`,
    avgSpend: spendByWeekOfMonth[week] && spendByWeekOfMonth[week].length > 0 ?
      (spendByWeekOfMonth[week].reduce((a, b) => a + b, 0) / spendByWeekOfMonth[week].length) : null
  }));

  // --- Scale Apply Start Evolution to match Estimated AS ---
  // Calculate total of the raw pattern for the campaign period
  const totalRawAS = chartDataAS.reduce((sum, d) => sum + (d.as || 0), 0);
  const asScalingFactor = totalRawAS > 0 ? (results.projectedAS / totalRawAS) : 1;
  // Apply scaling to date-wise chart
  const chartDataASScaled = chartDataAS.map(d => ({
    ...d,
    as: d.as !== null && d.as !== undefined ? d.as * asScalingFactor : null
  }));
  const chartDataASWithMAScaled = movingAverageKey(chartDataASScaled, 'as', 7);
  // Day of week scaling
  const dayOfWeekASChartDataScaled = dayNames.map(day => {
    const raw = asByDayOfWeek[day] && asByDayOfWeek[day].length > 0 ?
      (asByDayOfWeek[day].reduce((a, b) => a + b, 0) / asByDayOfWeek[day].length) : null;
    return {
      day,
      avgAS: raw !== null ? raw * asScalingFactor : null
    };
  });
  // Week of month scaling
  const weekOfMonthASChartDataScaled = [1, 2, 3, 4].map(week => {
    const raw = asByWeekOfMonth[week] && asByWeekOfMonth[week].length > 0 ?
      (asByWeekOfMonth[week].reduce((a, b) => a + b, 0) / asByWeekOfMonth[week].length) : null;
    return {
      week: `Week ${week}`,
      avgAS: raw !== null ? raw * asScalingFactor : null
    };
  });

  // --- Scale Spend Evolution to match projected total spend ---
  const totalRawSpend = chartDataSpend.reduce((sum, d) => sum + (d.spend || 0), 0);
  const spendScalingFactor = totalRawSpend > 0 ? (results.budgetSpend / totalRawSpend) : 1;
  // Apply scaling to date-wise chart
  const chartDataSpendScaled = chartDataSpend.map(d => ({
    ...d,
    spend: d.spend !== null && d.spend !== undefined ? d.spend * spendScalingFactor : null
  }));
  const chartDataSpendWithMAScaled = movingAverageKey(chartDataSpendScaled, 'spend', 7);
  // Day of week scaling
  const dayOfWeekSpendChartDataScaled = dayNames.map(day => {
    const raw = spendByDayOfWeek[day] && spendByDayOfWeek[day].length > 0 ?
      (spendByDayOfWeek[day].reduce((a, b) => a + b, 0) / spendByDayOfWeek[day].length) : null;
    return {
      day,
      avgSpend: raw !== null ? raw * spendScalingFactor : null
    };
  });
  // Week of month scaling
  const weekOfMonthSpendChartDataScaled = [1, 2, 3, 4].map(week => {
    const raw = spendByWeekOfMonth[week] && spendByWeekOfMonth[week].length > 0 ?
      (spendByWeekOfMonth[week].reduce((a, b) => a + b, 0) / spendByWeekOfMonth[week].length) : null;
    return {
      week: `Week ${week}`,
      avgSpend: raw !== null ? raw * spendScalingFactor : null
    };
  });

  return (
    <div className="space-y-6">
      <PacingScenarioSlider inputs={inputs} currentResults={results} overviewResults={results} />
      <Tabs defaultValue="daywise">
        <TabsList>
          <TabsTrigger value="daywise">Date-wise</TabsTrigger>
          <TabsTrigger value="dayofweek">Day of the Week</TabsTrigger>
          <TabsTrigger value="weekofmonth">Week of the Month</TabsTrigger>
        </TabsList>
        <TabsContent value="daywise">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-600" />
                CPAS Evolution
            </CardTitle>
              <CardDescription>
                Cost per Apply Start trends over time, using the exact historic daily pattern (seasonally adjusted).
              </CardDescription>
          </CardHeader>
          <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartDataWithMA} margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickFormatter={d => d.slice(5)} />
                  <YAxis />
                  {/* Main CPAS line */}
                  <Line
                    type="monotone"
                    dataKey="cpas"
                    stroke="#8B5CF6"
                    strokeWidth={3}
                    name={'CPAS (Seasonally Adjusted)'}
                    dot={false}
                    isAnimationActive={false}
                  />
                  {/* Moving Average line */}
                  <Line
                    type="monotone"
                    dataKey="cpasMA"
                    stroke="#F59E42"
                    strokeWidth={3}
                    name={'7-Day Moving Avg'}
                    dot={false}
                    isAnimationActive={false}
                    strokeDasharray="5 5"
                    opacity={0.6}
                  />
                  {/* Highlight peaks/troughs */}
                  <Line
                    type="monotone"
                    dataKey={d => (d.cpas === maxCPAS || d.cpas === minCPAS) ? d.cpas : null}
                    stroke="#F59E42"
                    strokeWidth={0}
                    dot={{ r: 6, fill: '#F59E42', stroke: '#fff', strokeWidth: 2 }}
                    legendType="none"
                  />
                  <Tooltip
                    formatter={(value, name, props) => {
                      return [
                        `$${value}`,
                        name === 'cpas' ? 'CPAS (Seasonally Adjusted)' : name
                      ];
                    }}
                    labelFormatter={(label, payload) => {
                      if (!payload || !payload[0]) return label;
                      const d = payload[0].payload;
                      return `Date: ${d.day} | Week: ${d.week}`;
                    }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-white p-3 rounded shadow text-xs">
                          <div><b>Date:</b> {d.day}</div>
                          <div><b>Week:</b> {d.week}</div>
                          <div><b>CPAS:</b> {d.cpas !== null && d.cpas !== undefined ? `$${d.cpas.toFixed(2)}` : 'N/A'}</div>
                          {d.cpasMA !== null && d.cpasMA !== undefined && (
                            <div><b>7-Day MA:</b> ${d.cpasMA.toFixed(2)}</div>
                          )}
                        </div>
                      );
                    }}
                  />
                <Legend />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-green-600" />
                Apply Start Evolution
              </CardTitle>
              <CardDescription>
                Apply Start trends over time, using the exact historic daily pattern, scaled to match your Estimated AS.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartDataASWithMAScaled} margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickFormatter={d => d.slice(5)} />
                  <YAxis />
                <Line 
                  type="monotone" 
                    dataKey="as"
                    stroke="#22C55E"
                  strokeWidth={3}
                    name={'Apply Start'}
                    dot={false}
                    isAnimationActive={false}
                />
                <Line 
                  type="monotone" 
                    dataKey="asMA"
                    stroke="#6366F1"
                  strokeWidth={3}
                    name={'7-Day Moving Avg'}
                    dot={false}
                    isAnimationActive={false}
                    strokeDasharray="5 5"
                    opacity={0.6}
                  />
                  <Tooltip formatter={(v, n) => (typeof v === 'number' && v !== null) ? v.toFixed(2) : 'N/A'} />
                  <Legend />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Spend Evolution
            </CardTitle>
              <CardDescription>
                Spend trends over time, using the exact historic daily pattern (seasonally adjusted), scaled to match your projected total spend.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartDataSpendWithMAScaled} margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickFormatter={d => d.slice(5)} />
                  <YAxis />
                  <Line
                    type="monotone"
                    dataKey="spend"
                    stroke="#3B82F6"
                    strokeWidth={3}
                    name={'Spend'}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="spendMA"
                    stroke="#F59E42"
                    strokeWidth={3}
                    name={'7-Day Moving Avg'}
                    dot={false}
                    isAnimationActive={false}
                    strokeDasharray="5 5"
                    opacity={0.6}
                  />
                  <Tooltip formatter={(v, n) => (typeof v === 'number' && v !== null) ? v.toFixed(2) : 'N/A'} />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="dayofweek">
          <Card>
            <CardHeader>
              <CardTitle>CPAS Evolution: Day of the Week Analysis</CardTitle>
              <CardDescription>Average CPAS by weekday (seasonally adjusted, historic June data)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dayOfWeekChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip formatter={v => (typeof v === 'number' && v !== null) ? `$${v.toFixed(2)}` : 'N/A'} />
                  <Bar dataKey="avgCPAS" fill="#8B5CF6" name="Avg CPAS" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Apply Start Evolution: Day of the Week Analysis</CardTitle>
              <CardDescription>Average Apply Start by weekday (historic June data, scaled to match your Estimated AS)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dayOfWeekASChartDataScaled}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip formatter={v => (typeof v === 'number' && v !== null) ? v.toFixed(2) : 'N/A'} />
                  <Bar dataKey="avgAS" fill="#22C55E" name="Avg Apply Start" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Spend Evolution: Day of the Week Analysis</CardTitle>
              <CardDescription>Average Spend by weekday (seasonally adjusted, historic June data, scaled to match your projected total spend)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dayOfWeekSpendChartDataScaled}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip formatter={v => (typeof v === 'number' && v !== null) ? v.toFixed(2) : 'N/A'} />
                  <Bar dataKey="avgSpend" fill="#3B82F6" name="Avg Spend" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="weekofmonth">
          <Card>
            <CardHeader>
              <CardTitle>CPAS Evolution: Week of the Month Analysis</CardTitle>
              <CardDescription>Average CPAS by week of month (seasonally adjusted, historic June data)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weekOfMonthChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip formatter={v => (typeof v === 'number' && v !== null) ? `$${v.toFixed(2)}` : 'N/A'} />
                  <Bar dataKey="avgCPAS" fill="#F59E42" name="Avg CPAS" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Apply Start Evolution: Week of the Month Analysis</CardTitle>
              <CardDescription>Average Apply Start by week of month (historic June data, scaled to match your Estimated AS)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weekOfMonthASChartDataScaled}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                  <Tooltip formatter={v => (typeof v === 'number' && v !== null) ? v.toFixed(2) : 'N/A'} />
                  <Bar dataKey="avgAS" fill="#22C55E" name="Avg Apply Start" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      <Card>
        <CardHeader>
              <CardTitle>Spend Evolution: Week of the Month Analysis</CardTitle>
              <CardDescription>Average Spend by week of month (seasonally adjusted, historic June data, scaled to match your projected total spend)</CardDescription>
        </CardHeader>
        <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weekOfMonthSpendChartDataScaled}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip formatter={v => (typeof v === 'number' && v !== null) ? v.toFixed(2) : 'N/A'} />
                  <Bar dataKey="avgSpend" fill="#3B82F6" name="Avg Spend" />
                </BarChart>
              </ResponsiveContainer>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
