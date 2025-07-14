const API_CONFIG = {
  development: {
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  },
  production: {
    baseURL:
      import.meta.env.VITE_API_BASE_URL ||
      "https://trading-ai-7sam.onrender.com",
  },
};

const getApiConfig = () => {
  const env = import.meta.env.MODE || "development";
  return API_CONFIG[env as keyof typeof API_CONFIG] || API_CONFIG.development;
};

export const API_BASE_URL = getApiConfig().baseURL;

export const API_ENDPOINTS = {
  cpasForBudget: "/api/cpas-for-budget",
  boundaries: "/api/boundaries-for-budget",
  jobQualityScores: "/api/job-quality-scores",
  jobImpactScenarios: "/api/job-impact-scenarios",
};

export const buildApiUrl = (
  endpoint: string,
  params?: Record<string, string | number>
) => {
  const url = new URL(endpoint, API_BASE_URL);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value.toString());
    });
  }

  return url.toString();
};
