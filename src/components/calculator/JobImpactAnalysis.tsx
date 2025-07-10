import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Target, Star, Info } from 'lucide-react';
import { PredictionResults, TradingInputs } from '@/types/trading';
import { fetchJobQualityScores, fetchJobImpactScenarios } from '@/hooks/useCalculatorLogic';

interface JobImpactAnalysisProps {
  results: PredictionResults;
  inputs: TradingInputs;
}

export const JobImpactAnalysis: React.FC<JobImpactAnalysisProps> = ({ results, inputs }) => {
  const { jobImpact } = results;

  // --- Job Quality Table State ---
  const [jobScores, setJobScores] = useState([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [errorScores, setErrorScores] = useState(null);
  const [showEnglishTitle, setShowEnglishTitle] = useState(false);
  const [recommendationFilter, setRecommendationFilter] = useState<string | null>(null);

  // --- Job Impact Scenario State ---
  const [impact, setImpact] = useState(null);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [errorImpact, setErrorImpact] = useState(null);

  useEffect(() => {
    setLoadingScores(true);
    fetchJobQualityScores()
      .then(data => {
        setJobScores(data.jobs || []);
        setLoadingScores(false);
      })
      .catch(e => {
        setErrorScores('Failed to load job quality scores');
        setLoadingScores(false);
      });
  }, []);

  useEffect(() => {
    setLoadingImpact(true);
    fetchJobImpactScenarios(
      inputs.budget,
      (new Date(inputs.endDate).getTime() - new Date(inputs.startDate).getTime()) / (1000 * 60 * 60 * 24) + 1,
      inputs.asGoal,
      inputs.startDate,
      inputs.endDate
    )
      .then(data => {
        setImpact(data);
        setLoadingImpact(false);
      })
      .catch(e => {
        setErrorImpact('Failed to load job impact scenarios');
        setLoadingImpact(false);
      });
  }, [inputs.budget, inputs.startDate, inputs.endDate, inputs.asGoal]);

  return (
    <div className="space-y-6">
      {/* CPAS Calculation Explanation */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-800 mb-1">Understanding CPAS and AS Volume Calculations</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p className="text-xs text-blue-500 mt-1">Note: Campaign-level metrics are weighted by job volume, while job-level averages are not. This is why the two values can differ significantly, especially if your campaign has a few high-performing or low-performing jobs.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600 flex items-center gap-2">
              <Star className="h-4 w-4" />
              Overall Job Quality Score (1–10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingImpact ? <div>Loading...</div> : errorImpact ? <div className="text-red-600">{errorImpact}</div> : (
              <>
                <div className="text-2xl font-bold">{impact ? (impact.overall_quality_score / 10).toFixed(1) : '-'}</div>
                <Progress value={impact?.overall_quality_score} className="mt-2 h-2" />
                <p className="text-xs text-gray-500 mt-1">Average job quality score (1–10 scale)</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              CPAS if All Jobs Had 100% Quality
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingImpact ? <div>Loading...</div> : errorImpact ? <div className="text-red-600">{errorImpact}</div> : (
              <>
                <div className="text-2xl font-bold text-blue-600">${impact?.cpas_if_perfect_quality?.toFixed(2)}</div>
            <Badge variant="default" className="mt-1">
                  {impact && impact.cpas_current > 0 ? `${Math.round(100 * (impact.cpas_current - impact.cpas_if_perfect_quality) / impact.cpas_current)}% Lower` : ''}
            </Badge>
                <p className="text-xs text-gray-500 mt-1">Based on Previous Month's patterns + quality regression analysis</p>
                <p className="text-xs text-gray-400 mt-1">vs current job performance (${impact?.cpas_current?.toFixed(2)})</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-600 flex items-center gap-2">
              <Target className="h-4 w-4" />
              AS Volume if All Jobs Had 100% Quality
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingImpact ? <div>Loading...</div> : errorImpact ? <div className="text-red-600">{errorImpact}</div> : (
              <>
                <div className="text-2xl font-bold text-purple-600">{impact?.as_if_perfect_quality?.toLocaleString()}</div>
            <Badge variant="default" className="mt-1">
                  {impact && impact.as_current > 0 ? `${Math.round(100 * (impact.as_if_perfect_quality - impact.as_current) / impact.as_current)}% Higher` : ''}
            </Badge>
                <p className="text-xs text-gray-500 mt-1">Based on Previous Month's patterns + quality regression analysis</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            key: 'title',
            label: 'Improve Title',
            metric: 'Title Appropriate?',
            bestValue: 'yes',
            color: 'border-l-green-500',
            icon: <Star className="h-4 w-4 text-green-600" />,
            description: 'If all jobs had the best possible job title',
            best: (v: string) => v.toLowerCase().startsWith('yes')
          },
          {
            key: 'salary',
            label: 'Mention Salary',
            metric: 'Salary Mentioned?',
            bestValue: 'yes',
            color: 'border-l-blue-500',
            icon: <TrendingUp className="h-4 w-4 text-blue-600" />,
            description: 'If all jobs mentioned salary clearly',
            best: (v: string) => v.toLowerCase().startsWith('yes')
          },
          {
            key: 'phone',
            label: 'Remove Phone number / email from JD',
            metric: 'Phone Number in JD',
            bestValue: 'no',
            color: 'border-l-yellow-500',
            icon: <Info className="h-4 w-4 text-yellow-600" />,
            description: 'If all jobs removed phone/email from JD',
            best: (v: string) => v.toLowerCase() === 'no'
          },
          {
            key: 'jd',
            label: 'Efficient JD',
            metric: 'JD Formatted Correctly?',
            bestValue: 'yes',
            color: 'border-l-purple-500',
            icon: <Target className="h-4 w-4 text-purple-600" />,
            description: 'If all jobs had efficient, well-formatted JDs',
            best: (v: string) => v.toLowerCase().startsWith('yes')
          }
        ].map((card) => {
          // Count jobs impacted for this metric
          const impactedCount = jobScores.filter(job => !card.best((job[card.metric] || ''))).length;
          // Simulate all jobs having the best value for this metric
          const simulatedScores = jobScores.map(job => {
            const newJob = { ...job };
            if (card.metric === 'Title Appropriate?') newJob[card.metric] = 'Yes';
            if (card.metric === 'Salary Mentioned?') newJob[card.metric] = 'Yes';
            if (card.metric === 'Phone Number in JD') newJob[card.metric] = 'No';
            if (card.metric === 'JD Formatted Correctly?') newJob[card.metric] = 'Yes';
            // Recalculate score
            let points = 0;
            if ((newJob['Title Appropriate?'] || '').toLowerCase().startsWith('yes')) points += 1;
            else if ((newJob['Title Appropriate?'] || '').toLowerCase().startsWith('partially')) points += 0.5;
            if ((newJob['Salary Mentioned?'] || '').toLowerCase().startsWith('yes')) points += 1;
            if ((newJob['Phone Number in JD'] || '').toLowerCase() === 'no') points += 1;
            if ((newJob['JD Formatted Correctly?'] || '').toLowerCase().startsWith('yes')) points += 1;
            else if ((newJob['JD Formatted Correctly?'] || '').toLowerCase().startsWith('partially')) points += 0.5;
            newJob['Job Quality Score'] = Math.round((points / 4) * 100);
            return newJob;
          });
          const avgSimulatedQuality = simulatedScores.reduce((sum, j) => sum + (j['Job Quality Score'] || 0), 0) / (simulatedScores.length || 1);
          // Estimate new CPAS using the same relative improvement as perfect quality
          let improvedCPAS = impact?.cpas_current;
          if (impact && impact.overall_quality_score && impact.cpas_if_perfect_quality) {
            const relDelta = (impact.cpas_if_perfect_quality - impact.cpas_current) / (100 - impact.overall_quality_score);
            improvedCPAS = impact.cpas_current + relDelta * (avgSimulatedQuality - impact.overall_quality_score);
          }
          const percentImprovement = impact && impact.cpas_current > 0 ? Math.round(100 * (impact.cpas_current - improvedCPAS) / impact.cpas_current) : 0;
          return (
            <Card key={card.key} className={`border-l-4 ${card.color}`}>
              <CardHeader className="pb-2 flex flex-row items-center gap-2">
                {card.icon}
                <CardTitle className="text-sm font-medium flex items-center gap-1">
                  {card.label}
                  <span className="italic text-xs text-gray-500" style={{ fontSize: '0.85em' }}>({impactedCount})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${improvedCPAS?.toFixed(2)}</div>
                <Badge variant="default" className="mt-1">{percentImprovement}% Lower</Badge>
                <p className="text-xs text-gray-500 mt-1">{card.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

        <Card>
          <CardHeader>
          <CardTitle>Job Quality Scores</CardTitle>
          <CardDescription>Calculated for each job based on title, salary, phone, and formatting</CardDescription>
          </CardHeader>
          <CardContent>
          {/* Recommendation Filter Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { key: 'title', label: 'Improve Title', metric: 'Title Appropriate?', best: (v: string) => v.toLowerCase().startsWith('yes') },
              { key: 'salary', label: 'Mention Salary', metric: 'Salary Mentioned?', best: (v: string) => v.toLowerCase().startsWith('yes') },
              { key: 'phone', label: 'Remove Phone number / email from JD', metric: 'Phone Number in JD', best: (v: string) => v.toLowerCase() === 'no' },
              { key: 'jd', label: 'Efficient JD', metric: 'JD Formatted Correctly?', best: (v: string) => v.toLowerCase().startsWith('yes') },
            ].map(btn => (
              <button
                key={btn.key}
                className={`px-3 py-1 rounded border ${recommendationFilter === btn.key ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-blue-700 border-blue-300'} text-xs font-semibold transition`}
                onClick={() => setRecommendationFilter(recommendationFilter === btn.key ? null : btn.key)}
              >
                {btn.label}
              </button>
            ))}
            {recommendationFilter && (
              <button
                className="px-3 py-1 rounded border bg-gray-200 text-gray-700 border-gray-400 text-xs font-semibold ml-2"
                onClick={() => setRecommendationFilter(null)}
              >
                Clear Filter
              </button>
            )}
          </div>
          {loadingScores && <div>Loading job quality scores...</div>}
          {errorScores && <div className="text-red-600">{errorScores}</div>}
          {!loadingScores && !errorScores && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showEnglishTitle"
                    checked={showEnglishTitle}
                    onChange={(e) => setShowEnglishTitle(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="showEnglishTitle" className="text-sm font-medium text-gray-700">
                    Show English Job Title
                  </label>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-2 py-1 border">REQ_ID</th>
                      <th className="px-2 py-1 border">Station</th>
                      <th className="px-2 py-1 border">DSP</th>
                      <th className="px-2 py-1 border">Job Title</th>
                      <th className="px-2 py-1 border">Job URL</th>
                      <th className="px-2 py-1 border">Job Quality Score (1–10)</th>
                      <th className="px-2 py-1 border">Recommendations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(recommendationFilter
                      ? (() => {
                          const btns = {
                            title: { metric: 'Title Appropriate?', best: (v: string) => v.toLowerCase().startsWith('yes') },
                            salary: { metric: 'Salary Mentioned?', best: (v: string) => v.toLowerCase().startsWith('yes') },
                            phone: { metric: 'Phone Number in JD', best: (v: string) => v.toLowerCase() === 'no' },
                            jd: { metric: 'JD Formatted Correctly?', best: (v: string) => v.toLowerCase().startsWith('yes') },
                          };
                          const { metric, best } = btns[recommendationFilter];
                          return jobScores
                            .filter(job => !best((job[metric] || '')))
                            .sort((a, b) => (a['Job Quality Score'] || 0) - (b['Job Quality Score'] || 0));
                        })()
                      : jobScores.slice().sort((a, b) => (a['Job Quality Score'] || 0) - (b['Job Quality Score'] || 0))
                    ).map((job, idx) => {
                      // Determine which metric is the lowest or missing
                      const metrics = [
                        {
                          key: 'Title Appropriate?',
                          label: 'Job Title',
                          value: (job['Title Appropriate?'] || '').toLowerCase(),
                          score: (job['Title Appropriate?'] || '').toLowerCase().startsWith('yes') ? 1 : (job['Title Appropriate?'] || '').toLowerCase().startsWith('partially') ? 0.5 : 0
                        },
                        {
                          key: 'Salary Mentioned?',
                          label: 'Salary Mentioned',
                          value: (job['Salary Mentioned?'] || '').toLowerCase(),
                          score: (job['Salary Mentioned?'] || '').toLowerCase().startsWith('yes') ? 1 : 0
                        },
                        {
                          key: 'Phone Number in JD',
                          label: 'Phone Number',
                          value: (job['Phone Number in JD'] || '').toLowerCase(),
                          score: (job['Phone Number in JD'] || '').toLowerCase() === 'no' ? 1 : 0
                        },
                        {
                          key: 'JD Formatted Correctly?',
                          label: 'JD Formatting',
                          value: (job['JD Formatted Correctly?'] || '').toLowerCase(),
                          score: (job['JD Formatted Correctly?'] || '').toLowerCase().startsWith('yes') ? 1 : (job['JD Formatted Correctly?'] || '').toLowerCase().startsWith('partially') ? 0.5 : 0
                        }
                      ];
                      // Find the lowest scoring metric(s)
                      const minScore = Math.min(...metrics.map(m => m.score));
                      const lowestMetrics = metrics.filter(m => m.score === minScore);
                      // Build recommendation string
                      let recommendation = '';
                      if (minScore === 1) {
                        recommendation = 'All key quality factors are strong.';
                      } else {
                        recommendation = lowestMetrics.map(m => {
                          if (m.key === 'Title Appropriate?') return 'Improve job title clarity and relevance';
                          if (m.key === 'Salary Mentioned?') return 'Add or clarify salary information';
                          if (m.key === 'Phone Number in JD') return 'Remove phone number from job description';
                          if (m.key === 'JD Formatted Correctly?') return 'Improve job description formatting';
                          return '';
                        }).join('; ');
                      }
                      return (
                        <tr key={idx} className={job['Job Quality Score'] >= 75 ? 'bg-green-50' : job['Job Quality Score'] >= 50 ? 'bg-yellow-50' : 'bg-red-50'}>
                          <td className="px-2 py-1 border">{job['REQ_ID']}</td>
                          <td className="px-2 py-1 border">{job['Station']}</td>
                          <td className="px-2 py-1 border">{job['DSP']}</td>
                          <td className="px-2 py-1 border">{showEnglishTitle ? job['English Job title'] : job['Job Title']}</td>
                          <td className="px-2 py-1 border">
                            {job['JOB_URL'] ? (
                              <a href={job['JOB_URL']} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Link</a>
                            ) : ''}
                          </td>
                          <td className="px-2 py-1 border font-bold">{Math.round(job['Job Quality Score'] / 10)}</td>
                          <td className="px-2 py-1 border">{recommendation}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job Quality Optimization Recommendations</CardTitle>
          <CardDescription>Strategic improvements to enhance campaign performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 rounded-lg border-l-4 border-l-green-500">
              <h4 className="font-semibold text-green-800 mb-2">High-Quality Job Characteristics</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• Clear, detailed job descriptions</li>
                <li>• Competitive compensation packages</li>
                <li>• Strong employer branding</li>
                <li>• Relevant skill requirements</li>
                <li>• Growth opportunities highlighted</li>
              </ul>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-l-blue-500">
              <h4 className="font-semibold text-blue-800 mb-2">Quality Improvement Actions</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Review and enhance job titles</li>
                <li>• Add company culture information</li>
                <li>• Include benefits and perks</li>
                <li>• Use location-specific targeting</li>
                <li>• Regular performance monitoring</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
