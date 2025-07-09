from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import pandas as pd
import numpy as np
import csv
from sklearn.linear_model import LinearRegression
import uvicorn
import logging
from sklearn.metrics import r2_score
from calendar import month_abbr
import os
import traceback
import random
import math
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Allow CORS for local frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set up robust data paths
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend', 'data'))
DATA1_PATH = os.path.join(DATA_DIR, 'data1.csv')
BUDGET_LOG_PATH = os.path.join(DATA_DIR, 'budget_log.csv')

try:
    logger.info("Loading data files...")
    data1 = pd.read_csv(DATA1_PATH)
    budget_log = pd.read_csv(BUDGET_LOG_PATH)
    logger.info("Data files loaded successfully")
except Exception as e:
    logger.error(f"Error loading data files: {e}")
    raise

# Preprocess for June daily analysis
june_data = data1.copy()
june_data['EVENT_PUBLISHER_DATE'] = pd.to_datetime(june_data['EVENT_PUBLISHER_DATE'])
june_data = june_data[june_data['EVENT_PUBLISHER_DATE'].dt.month == 6]
budget_log['Date'] = pd.to_datetime(budget_log['Date'])
budget_log_sorted = budget_log.sort_values('Date')
june_data = pd.merge_asof(
    june_data.sort_values('EVENT_PUBLISHER_DATE'),
    budget_log_sorted,
    left_on='EVENT_PUBLISHER_DATE',
    right_on='Date',
    direction='backward'
)

# Aggregate by day (sum across jobs)
june_daily = june_data.groupby('EVENT_PUBLISHER_DATE').agg({
    'CDSPEND': 'sum',
    'APPLY_START': 'sum',
    'Budget': 'first',
    'Duration_weeks': 'first'
}).reset_index()
june_daily['CPAS'] = june_daily['CDSPEND'] / june_daily['APPLY_START'].replace(0, np.nan)

# Build daily CPAS and Apply Starts for June
daily = june_data.groupby('EVENT_PUBLISHER_DATE').agg({'CDSPEND': 'sum', 'APPLY_START': 'sum'}).reset_index()
daily['CPAS'] = daily['CDSPEND'] / daily['APPLY_START']
daily = daily[daily['APPLY_START'] > 0]
daily = daily.sort_values('EVENT_PUBLISHER_DATE')

logger.info("API initialization complete")

# --- Seasonality factor helper ---
def get_seasonality_factor(target_date):
    """
    Returns a seasonality factor for the given date.
    - If you have multi-month historical data, calculate the ratio of AS (or spend) for the target month to June.
    - For now, use a simple default: June=1.0, July=1.05, August=1.10, September=0.95, etc.
    """
    month = pd.to_datetime(target_date).month
    # Example: hardcoded seasonality factors (customize as needed)
    seasonality = {6: 1.0, 7: 1.05, 8: 1.10, 9: 0.95, 10: 0.90, 11: 0.85, 12: 0.80, 1: 0.90, 2: 0.92, 3: 0.95, 4: 0.98, 5: 1.00}
    return seasonality.get(month, 1.0)

# Add at the top of the file (or near other constants)
SEASONALITY_FACTORS = {
    1: 0.90,  # January
    2: 0.92,
    3: 0.95,
    4: 0.98,
    5: 1.00,
    6: 1.00,  # June (reference)
    7: 1.05,
    8: 1.10,
    9: 0.95,
    10: 0.90,
    11: 0.85,
    12: 0.80
}

@app.get('/api/cpas-for-budget')
def cpas_for_budget(
    budget: float = Query(..., description="Budget in dollars"),
    duration: int = Query(..., description="Duration in weeks"),
    start_date: Optional[str] = Query(None, description="Campaign start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Campaign end date (YYYY-MM-DD)"),
    as_goal: Optional[float] = Query(None, description="Apply Starts Goal")
):
    """Return the average CPAS for the selected duration (using the real June daily pattern, matching date range if possible)."""
    try:
        # --- Seasonality factor: always set at the top ---
        if start_date:
            user_month = pd.to_datetime(start_date).month
        else:
            user_month = 6  # Default to June
        seasonality_factor = SEASONALITY_FACTORS.get(user_month, 1.0)
        # --- Dashboard caps ---
        min_budget = 5000
        min_duration = 7  # days
        min_cpas = 3.0
        max_cpas = 15.0
        max_as_per_30d = 50000
        
        
        budget = max(budget, min_budget)
        if start_date and end_date:
            start_dt = pd.to_datetime(start_date)
            end_dt = pd.to_datetime(end_date)
            num_days = (end_dt - start_dt).days + 1
            if num_days < min_duration:
                end_dt = start_dt + pd.Timedelta(days=min_duration-1)
                num_days = min_duration
            target_dates = [start_dt + pd.Timedelta(days=i) for i in range(num_days)]
        else:
            num_days = max(int(duration * 7), min_duration)
            target_dates = [pd.Timestamp(year=2025, month=6, day=1) + pd.Timedelta(days=i) for i in range(num_days)]
        # --- Custom logic for budget < 50000 ---
        if budget < 50000:
            logger.info(f"Received as_goal: {as_goal}")
            as_goal_val = as_goal if as_goal is not None else 1
            total_predicted_as = (budget / as_goal_val) * num_days if as_goal_val > 0 else 0
            estimated_cpas = budget / ((370 * num_days) / 3) if num_days > 0 else 0
            # Apply seasonality
            total_predicted_as *= seasonality_factor
            estimated_cpas /= seasonality_factor
            estimated_cpas = max(estimated_cpas, min_cpas)
            logger.info(f"Custom logic for budget < 50000: total_predicted_as={total_predicted_as}, estimated_cpas={estimated_cpas}, seasonality_factor={seasonality_factor}, as_goal_val={as_goal_val}")
            return {
                'start_date': str(target_dates[0].date()),
                'end_date': str(target_dates[-1].date()),
                'num_days': num_days,
                'budget': float(budget),
                'total_spend': float(budget),
                'total_apply_starts': int(total_predicted_as),
                'cpas': float(estimated_cpas),
                'confidence': 1.0,
                'pacingTrends': [],
                'days_to_goal': None,
                'seasonality_factor': seasonality_factor
            }
        # --- Always use June data for model training ---
        june_days = june_daily.copy()
        # Robust regression: clip outliers, regularize
        X = june_days[['CDSPEND']].values
        y = june_days['APPLY_START'].values
        # Remove outliers (e.g., >99th percentile)
        y_clip = np.clip(y, np.percentile(y, 1), np.percentile(y, 99))
        X_clip = np.clip(X, np.percentile(X, 1), np.percentile(X, 99))
        reg = LinearRegression().fit(X_clip, y_clip)
        y_pred = reg.predict(X_clip)
        r2 = r2_score(y_clip, y_pred)
        # Model confidence: use r2_score, clamp to [0.92, 1.0]. Only clamp to 0.95 if regression is unreliable.
        if np.isnan(r2) or r2 < 0.92:
            confidence = 0.95
        else:
            confidence = min(1.0, max(0.92, r2))
        # --- Calculate June pacing (share of total spend per day) ---
        june_daily_grouped = june_daily.groupby('EVENT_PUBLISHER_DATE').agg({'CDSPEND': 'sum'}).reset_index()
        june_total_spend = june_daily_grouped['CDSPEND'].sum()
        june_daily_grouped['pacing_share'] = june_daily_grouped['CDSPEND'] / june_total_spend
        # Normalize pacing shares so sum = 1 for selected days
        pacing_map = dict(zip(june_daily_grouped['EVENT_PUBLISHER_DATE'].dt.day, june_daily_grouped['pacing_share']))
        selected_pacing_shares = np.array([pacing_map.get(min(d.day, 30), 1/30) for d in target_dates])
        selected_pacing_shares = selected_pacing_shares / selected_pacing_shares.sum()
        # --- Enhanced Feature Engineering for June Days ---
        june_days = june_daily.copy()
        june_days['day_of_week'] = june_days['EVENT_PUBLISHER_DATE'].dt.dayofweek
        # One-hot encode day of week
        day_of_week_dummies = pd.get_dummies(june_days['day_of_week'], prefix='dow')

        # Number of jobs live per day
        DATA1_PATH = os.path.join(DATA_DIR, 'data1.csv')
        data1 = pd.read_csv(DATA1_PATH)
        data1['EVENT_PUBLISHER_DATE'] = pd.to_datetime(data1['EVENT_PUBLISHER_DATE'])
        june_data_all = data1[data1['EVENT_PUBLISHER_DATE'].dt.month == 6]
        jobs_per_day = june_data_all.groupby('EVENT_PUBLISHER_DATE')['MAIN_REF_NUMBER'].nunique()
        june_days = june_days.merge(jobs_per_day.rename('jobs_live'), left_on='EVENT_PUBLISHER_DATE', right_index=True, how='left')

        # Average job quality score per day
        DATA2_PATH = os.path.join(DATA_DIR, 'data2.csv')
        jobs_quality = []
        with open(DATA2_PATH, newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                if not row.get('Job Title') and not row.get('English Job title'):
                    continue
                points = 0
                title_val = (row.get('Title Appropriate?') or '').strip().lower()
                if title_val.startswith('yes'):
                    points += 1
                elif title_val.startswith('partially'):
                    points += 0.5
                salary_val = (row.get('Salary Mentioned?') or '').strip().lower()
                if salary_val.startswith('yes'):
                    points += 1
                phone_val = (row.get('Phone Number in JD') or '').strip().lower()
                if phone_val == 'no':
                    points += 1
                jd_val = (row.get('JD Formatted Correctly?') or '').strip().lower()
                if jd_val.startswith('yes'):
                    points += 1
                elif jd_val.startswith('partially'):
                    points += 0.5
                score = round((points / 4) * 100, 1)
                jobs_quality.append(score)
        # For demo, assign average quality to all days (can be improved with job-date mapping)
        avg_quality = sum(jobs_quality) / len(jobs_quality) if jobs_quality else 75
        june_days['avg_quality'] = avg_quality

        # Previous day's spend and applies (momentum)
        june_days = june_days.sort_values('EVENT_PUBLISHER_DATE')
        june_days['prev_day_spend'] = june_days['CDSPEND'].shift(1).fillna(0)
        june_days['prev_day_applies'] = june_days['APPLY_START'].shift(1).fillna(0)

        # --- Data-driven regime segmentation using clustering ---
        # Prepare features for clustering
        clustering_features = [
            june_days['CDSPEND'],
            june_days['APPLY_START'],
            june_days['jobs_live'],
            june_days['avg_quality'],
            june_days['prev_day_spend'],
            june_days['prev_day_applies'],
        ]
        clustering_X = pd.concat(clustering_features, axis=1).fillna(0).astype(float)

        # Auto-select optimal number of clusters (2-6) using silhouette score
        best_score = -1
        best_k = 2
        for k in range(2, 7):
            kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
            labels = kmeans.fit_predict(clustering_X)
            score = silhouette_score(clustering_X, labels)
            if score > best_score:
                best_score = score
                best_k = k
        # Fit final k-means with best_k
        kmeans = KMeans(n_clusters=best_k, random_state=42, n_init=10)
        june_days['regime'] = kmeans.fit_predict(clustering_X) + 1  # Regimes 1..k
        regime_dummies = pd.get_dummies(june_days['regime'], prefix='regime')

        # Build the enhanced feature matrix
        features = [
            june_days['CDSPEND'],
            june_days['jobs_live'],
            june_days['avg_quality'],
            june_days['prev_day_spend'],
            june_days['prev_day_applies'],
            day_of_week_dummies,
            regime_dummies
        ]
        X_full = pd.concat(features, axis=1)
        X_full = X_full.astype(float)
        y_full = june_days['APPLY_START'].values
        # Remove outliers
        y_clip = np.clip(y_full, np.percentile(y_full, 1), np.percentile(y_full, 99))
        X_clip = np.clip(X_full, np.percentile(X_full, 1), np.percentile(X_full, 99))
        # Fit a model for each regime, then average predictions/confidence weighted by days
        predictions = []
        confidences = []
        total_days = 0
        for regime_id in range(1, best_k + 1): # Changed to 1..k for k-means clusters
            mask = (june_days['regime'] == regime_id).values  # Ensure mask is a NumPy array
            if mask.sum() < 3: # Minimum 3 days for a regime
                continue
            X_reg = X_clip[mask]
            y_reg = y_clip[mask]
            reg = LinearRegression().fit(X_reg, y_reg)
            y_pred = reg.predict(X_reg)
            r2 = r2_score(y_reg, y_pred)
            confidence = min(1.0, max(0.92, r2)) if not np.isnan(r2) and r2 >= 0.92 else 0.95
            # For each target day, if it falls in this regime, predict
            regime_days = 0
            for i, d in enumerate(target_dates):
                # Assign regime to target day based on date
                if regime_id == 1 and d >= pd.Timestamp('2025-06-01') and d < pd.Timestamp('2025-06-08'):
                    is_regime = True
                elif regime_id == 2 and d >= pd.Timestamp('2025-06-08') and d < pd.Timestamp('2025-06-15'):
                    is_regime = True
                elif regime_id == 3 and d >= pd.Timestamp('2025-06-15') and d < pd.Timestamp('2025-06-22'):
                    is_regime = True
                elif regime_id == 4 and d >= pd.Timestamp('2025-06-22') and d < pd.Timestamp('2025-06-29'):
                    is_regime = True
                else:
                    is_regime = False
                if not is_regime:
                    continue
                dow_vec = [0]*7
                dow_vec[d.dayofweek] = 1
                regime_vec = [0]*best_k # Changed to best_k for k-means clusters
                regime_vec[regime_id-1] = 1
                x = [budget * selected_pacing_shares[i]] + dow_vec + regime_vec
                pred = float(reg.predict([x])[0])
                pred = np.clip(pred, 0, max_as_per_30d / 3)
                day_seasonality = get_seasonality_factor(d)
                pred_seasonal = pred * day_seasonality
                predictions.append(pred_seasonal)
                regime_days += 1
            confidences.append(confidence * regime_days)
            total_days += regime_days
        if predictions and total_days > 0:
            total_predicted_as = sum(predictions)
            avg_confidence = sum(confidences) / total_days
        else:
            total_predicted_as = 0
            avg_confidence = 0.95
        # Cap total_predicted_as to max allowed for the window
        max_allowed_as = max_as_per_30d * (len(target_dates)/30)
        logger.info(f"Capping total_predicted_as: {total_predicted_as:.2f} to max_allowed_as: {max_allowed_as:.2f} for {len(target_dates)} days")
        total_predicted_as = min(total_predicted_as, max_allowed_as)
        total_spend = budget
        estimated_cpas = total_spend / total_predicted_as if total_predicted_as > 0 else 0
        estimated_cpas = np.clip(estimated_cpas, min_cpas, max_cpas)
        logger.info(f"Total predicted AS: {total_predicted_as:.2f}, Total spend: {total_spend:.2f}, Estimated CPAS: {estimated_cpas:.2f}, Model confidence: {avg_confidence:.4f}")
        # --- Build pacingTrends for the selected days ---
        pacingTrends = []
        cumulative_spend = 0.0
        for i, d in enumerate(target_dates):
            # Use June pacing share for each mapped day
            day_num = min(d.day, 30)
            pacing_share = pacing_map.get(day_num, 1/30)
            day_spend = budget * pacing_share
            cumulative_spend += day_spend
            pacingTrends.append({
                'day': i + 1,
                'date': str(d.date()),
                'dailySpend': round(day_spend, 2),
                'cumulativeSpend': round(cumulative_spend, 2)
            })
        if not pacingTrends:
            # fallback: fill with zeros
            pacingTrends = [{'day': i+1, 'date': '', 'dailySpend': 0.0, 'cumulativeSpend': 0.0} for i in range(len(target_dates))]
        # --- Calculate Days to Goal based only on Start Date, Budget, CPAS, and AS Goal ---
        # Use min_duration if selected window is shorter
        as_goal = None
        try:
            as_goal = float(str(Query.__defaults__[0]))  # Try to get from query if present
        except Exception:
            pass
        # If as_goal is not provided, skip Days to Goal calculation
        days_to_goal = None
        if as_goal and estimated_cpas > 0:
            # Use the minimum duration for daily rate if window is shorter
            daily_as_rate = total_predicted_as / len(target_dates) if len(target_dates) > 0 else 0
            if daily_as_rate > 0:
                days_to_goal = int(np.ceil(as_goal / daily_as_rate))
        # --- Build a daily spend vs. CPAS curve from budget log ---
        budget_log['End_Date'] = budget_log['Date'] + pd.to_timedelta(budget_log['Duration_weeks'] * 7, unit='D')
        budget_cpas_points = []
        for idx, row in budget_log.iterrows():
            period = (june_daily['EVENT_PUBLISHER_DATE'] >= row['Date']) & (june_daily['EVENT_PUBLISHER_DATE'] < row['End_Date'])
            period_data = june_daily[period]
            if not period_data.empty:
                total_spend = period_data['CDSPEND'].sum()
                total_applies = period_data['APPLY_START'].sum()
                days = (row['End_Date'] - row['Date']).days
                daily_spend = total_spend / days if days > 0 else 0
                cpas = total_spend / total_applies if total_applies > 0 else np.nan
                if daily_spend > 0 and cpas > 0:
                    budget_cpas_points.append((daily_spend, cpas))
        logger.info(f"Budget log daily spend vs CPAS points: {budget_cpas_points}")
        # Fit a regression (or step function) for daily spend vs. CPAS
        if len(budget_cpas_points) >= 2:
            X_spend = np.array([x[0] for x in budget_cpas_points]).reshape(-1, 1)
            y_cpas = np.array([x[1] for x in budget_cpas_points])
            spend_cpas_reg = LinearRegression().fit(X_spend, y_cpas)
            logger.info(f"Regression coef: {spend_cpas_reg.coef_}, intercept: {spend_cpas_reg.intercept_}")
        else:
            spend_cpas_reg = None
        # Calculate requested daily spend
        requested_daily_spend = budget / len(target_dates) if len(target_dates) > 0 else 0
        # Piecewise/logarithmic CPAS for high spends
        # --- Smoother budget-CPAS relationship ---
        # Calculate median historical daily spend
        hist_daily_spends = [x[0] for x in budget_cpas_points] if budget_cpas_points else []
        if hist_daily_spends:
            median_hist_spend = np.median(hist_daily_spends)
        else:
            median_hist_spend = 0
        if spend_cpas_reg is not None and len(budget_cpas_points) >= 2:
            # Sort points by daily spend
            budget_cpas_points = sorted(budget_cpas_points, key=lambda x: x[0])
            spends = [x[0] for x in budget_cpas_points]
            cpases = [x[1] for x in budget_cpas_points]

            if requested_daily_spend <= spends[0]:
                # Extrapolate below min (assume linear trend)
                slope = (cpases[1] - cpases[0]) / (spends[1] - spends[0])
                estimated_cpas = cpases[0] + slope * (requested_daily_spend - spends[0])
                logger.info(f'Extrapolated CPAS below min: {estimated_cpas:.2f}')
            elif requested_daily_spend >= spends[-1]:
                # Extrapolate above max (as before)
                slope = (cpases[-1] - cpases[-2]) / (spends[-1] - spends[-2])
                estimated_cpas = cpases[-1] + slope * (requested_daily_spend - spends[-1])
                logger.info(f'Extrapolated CPAS above max: {estimated_cpas:.2f}')
            else:
                # Interpolate between closest points
                for i in range(1, len(spends)):
                    if spends[i-1] <= requested_daily_spend <= spends[i]:
                        slope = (cpases[i] - cpases[i-1]) / (spends[i] - spends[i-1])
                        estimated_cpas = cpases[i-1] + slope * (requested_daily_spend - spends[i-1])
                        logger.info(f'Interpolated CPAS: {estimated_cpas:.2f}')
                        break
        else:
            # Fallback to previous logic
            estimated_cpas = base_cpas
        # Remove hard $15 cap, but keep min_cpas
        estimated_cpas = max(estimated_cpas, min_cpas)
        # Calculate Estimated AS using the same logic as Estimated CPAS
        total_predicted_as = budget / estimated_cpas if estimated_cpas > 0 else 0
        # --- Apply seasonality to both AS and CPAS right before return ---
        logger.info(f"Pre-seasonality: total_predicted_as={total_predicted_as}, estimated_cpas={estimated_cpas}, seasonality_factor={seasonality_factor}")
        total_predicted_as *= seasonality_factor
        estimated_cpas /= seasonality_factor
        logger.info(f"Post-seasonality: total_predicted_as={total_predicted_as}, estimated_cpas={estimated_cpas}, seasonality_factor={seasonality_factor}")
        estimated_cpas = max(estimated_cpas, min_cpas)
        return {
            'start_date': str(target_dates[0].date()),
            'end_date': str(target_dates[-1].date()),
            'num_days': len(target_dates),
            'budget': float(budget),
            'total_spend': float(total_spend),
            'total_apply_starts': int(total_predicted_as),
            'cpas': float(estimated_cpas),
            'confidence': float(round(avg_confidence, 4)),
            'pacingTrends': pacingTrends,
            'days_to_goal': days_to_goal,
            'seasonality_factor': seasonality_factor
        }
    except Exception as e:
        logger.error(f"Error in cpas_for_budget: {e}\n" + traceback.format_exc())
        return {"error": f"Calculation failed: {str(e)}"}

@app.get('/api/boundaries-for-budget')
def boundaries_for_budget(budget: float = Query(...), duration: int = Query(...)):
    try:
        logger.info(f"Calculating boundaries for budget: ${budget}, duration: {duration}")
        # Get the best and worst CPAS days for the selected duration
        best_days = daily.nsmallest(duration, 'CPAS')
        worst_days = daily.nlargest(duration, 'CPAS')

        # Max delivery: use best CPAS days
        total_best_as = best_days['APPLY_START'].sum()
        total_best_spend = best_days['CDSPEND'].sum()
        avg_best_cpas = total_best_spend / total_best_as if total_best_as > 0 else 0
        # If budget is limiting, scale down
        if total_best_spend > budget:
            scale = budget / total_best_spend
            total_best_as = int(total_best_as * scale)
            total_best_spend = budget
        
        # Min delivery: use worst CPAS days
        total_worst_as = worst_days['APPLY_START'].sum()
        total_worst_spend = worst_days['CDSPEND'].sum()
        avg_worst_cpas = total_worst_spend / total_worst_as if total_worst_as > 0 else 0
        if total_worst_spend > budget:
            scale = budget / total_worst_spend
            total_worst_as = int(total_worst_as * scale)
            total_worst_spend = budget

        logger.info("Boundaries calculation complete")
        return {
            'max_apply_starts': int(total_best_as),
            'max_spend': float(total_best_spend),
            'max_cpas': float(avg_best_cpas),
            'min_apply_starts': int(total_worst_as),
            'min_spend': float(total_worst_spend),
            'min_cpas': float(avg_worst_cpas),
            'duration_days': duration,
            'budget': budget
        }
    except Exception as e:
        logger.error(f"Error in boundaries_for_budget: {e}")
        return {"error": f"Boundaries calculation failed: {str(e)}"}

@app.get('/api/job-quality-scores')
def job_quality_scores():
    try:
        logger.info("Loading job quality scores...")
        DATA2_PATH = os.path.join(DATA_DIR, 'data2.csv')
        jobs = []
        with open(DATA2_PATH, newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                # Skip empty rows
                if not row.get('Job Title') and not row.get('English Job title'):
                    continue
                # Scoring logic
                points = 0
                # Title Appropriate?
                title_val = (row.get('Title Appropriate?') or '').strip().lower()
                if title_val.startswith('yes'):
                    points += 1
                elif title_val.startswith('partially'):
                    points += 0.5
                # Salary Mentioned?
                salary_val = (row.get('Salary Mentioned?') or '').strip().lower()
                if salary_val.startswith('yes'):
                    points += 1
                # Phone Number in JD
                phone_val = (row.get('Phone Number in JD') or '').strip().lower()
                if phone_val == 'no':
                    points += 1
                # JD Formatted Correctly?
                jd_val = (row.get('JD Formatted Correctly?') or '').strip().lower()
                if jd_val.startswith('yes'):
                    points += 1
                elif jd_val.startswith('partially'):
                    points += 0.5
                score = round((points / 4) * 100, 1)
                # Get REQ_ID from the 4th column (index 3) since the header is empty
                req_id = list(row.values())[3] if len(row) > 3 else ''
                # Get JOB_URL from the column name
                job_url = row.get('JOB_URL', '')
                jobs.append({
                    'Job Title': row.get('Job Title', ''),
                    'English Job title': row.get('English Job title', ''),
                    'Station': row.get('Station', ''),
                    'DSP': row.get('DSP', ''),
                    'REQ_ID': req_id,
                    'Title Appropriate?': row.get('Title Appropriate?', ''),
                    'Salary Mentioned?': row.get('Salary Mentioned?', ''),
                    'Phone Number in JD': row.get('Phone Number in JD', ''),
                    'JD Formatted Correctly?': row.get('JD Formatted Correctly?', ''),
                    'Job Quality Score': score,
                    'JOB_URL': job_url
                })
        logger.info(f"Loaded {len(jobs)} job quality scores")
        return {'jobs': jobs}
    except Exception as e:
        logger.error(f"Error in job_quality_scores: {e}")
        return {"error": f"Failed to load job quality scores: {str(e)}"}

@app.get('/api/job-impact-scenarios')
def job_impact_scenarios(
    budget: float = Query(...),
    duration: int = Query(...),
    as_goal: int = Query(...),
    start_date: Optional[str] = Query(None, description="Campaign start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Campaign end date (YYYY-MM-DD)")
):
    try:
        logger.info(f"Calculating job impact scenarios for budget: ${budget}, duration: {duration}, AS goal: {as_goal}, start_date: {start_date}, end_date: {end_date}")
        # --- Market seasonality factors (same as frontend) ---
        market_seasonality = {
            'Jan': 0.9, 'Feb': 0.95, 'Mar': 1.0, 'Apr': 1.05, 'May': 1.1, 'Jun': 1.2,
            'Jul': 1.15, 'Aug': 1.1, 'Sep': 1.0, 'Oct': 1.05, 'Nov': 1.2, 'Dec': 1.3
        }
        
        # --- Map user date range to a contiguous window in June ---
        if start_date and end_date:
            start_dt = pd.to_datetime(start_date)
            end_dt = pd.to_datetime(end_date)
            num_days = (end_dt - start_dt).days + 1
            june_start_day = min(max(start_dt.day, 1), 30)
            june_end_day = min(june_start_day + num_days - 1, 30)
            mapped_june_days = [pd.Timestamp(year=2025, month=6, day=day) for day in range(june_start_day, june_end_day + 1)]
            logger.info(f"Job Impact mapping: start_dt.day={start_dt.day}, num_days={num_days}, june_start_day={june_start_day}, june_end_day={june_end_day}, mapped_june_days={[d.strftime('%Y-%m-%d') for d in mapped_june_days]}")
        else:
            num_days = max(int(duration * 7), 7)
            mapped_june_days = [pd.Timestamp(year=2025, month=6, day=day) for day in range(1, min(1 + num_days, 31))]
            logger.info(f"Job Impact mapping (no dates): num_days={num_days}, mapped_june_days={[d.strftime('%Y-%m-%d') for d in mapped_june_days]}")
        selected_days = june_daily[june_daily['EVENT_PUBLISHER_DATE'].isin(mapped_june_days)]
        if selected_days.empty:
            logger.error(f"No June data available for the mapped range {mapped_june_days[0].date()} to {mapped_june_days[-1].date()}")
            return {"error": f"No June data available for the mapped range {mapped_june_days[0].date()} to {mapped_june_days[-1].date()}"}

        # --- Always train regression models on all June data ---
        DATA1_PATH = os.path.join(DATA_DIR, 'data1.csv')
        data1 = pd.read_csv(DATA1_PATH)
        data1['EVENT_PUBLISHER_DATE'] = pd.to_datetime(data1['EVENT_PUBLISHER_DATE'])
        june_data_all = data1[data1['EVENT_PUBLISHER_DATE'].dt.month == 6]
        job_stats_all = june_data_all.groupby('MAIN_REF_NUMBER').agg({'CDSPEND': 'sum', 'APPLY_START': 'sum'}).reset_index()
        job_stats_all = job_stats_all[job_stats_all['APPLY_START'] > 0]
        job_stats_all['CPAS'] = job_stats_all['CDSPEND'] / job_stats_all['APPLY_START']
        
        # --- Load job quality scores ---
        DATA2_PATH = os.path.join(DATA_DIR, 'data2.csv')
        jobs = []
        with open(DATA2_PATH, newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                if not row.get('Job Title') and not row.get('English Job title'):
                    continue
                points = 0
                title_val = (row.get('Title Appropriate?') or '').strip().lower()
                if title_val.startswith('yes'):
                    points += 1
                elif title_val.startswith('partially'):
                    points += 0.5
                salary_val = (row.get('Salary Mentioned?') or '').strip().lower()
                if salary_val.startswith('yes'):
                    points += 1
                phone_val = (row.get('Phone Number in JD') or '').strip().lower()
                if phone_val == 'no':
                    points += 1
                jd_val = (row.get('JD Formatted Correctly?') or '').strip().lower()
                if jd_val.startswith('yes'):
                    points += 1
                elif jd_val.startswith('partially'):
                    points += 0.5
                score = round((points / 4) * 100, 1)
                jobs.append({'score': score})
        if not jobs:
            return {'error': 'No jobs found'}
        avg_quality = sum(j['score'] for j in jobs) / len(jobs)

        # --- Train regression models on all June data ---
        Xq = job_stats_all[['quality']] if 'quality' in job_stats_all else None
        if Xq is None:
        # Join with job quality (assume order matches for demo)
            min_len = min(len(job_stats_all), len(jobs))
            job_stats_all = job_stats_all.iloc[:min_len].copy()
            job_stats_all['quality'] = [j['score'] for j in jobs[:min_len]]
            Xq = job_stats_all[['quality']].values
        else:
            Xq = job_stats_all[['quality']].values
        y_cpas = job_stats_all['CPAS'].values
        y_as = job_stats_all['APPLY_START'].values
        reg_cpas = LinearRegression().fit(Xq, y_cpas) if len(job_stats_all) >= 3 else None
        reg_as = LinearRegression().fit(Xq, y_as) if len(job_stats_all) >= 3 else None

        # --- For each mapped June day, determine regime and predict ---
        june_regimes = []
        for date in mapped_june_days:
            day = date.day
            if day <= 7:
                june_regimes.append(1)
            elif day <= 14:
                june_regimes.append(2)
            elif day <= 21:
                june_regimes.append(3)
            else:
                june_regimes.append(4)
        # For each mapped day, get June stats
        june_stats = june_daily.set_index('EVENT_PUBLISHER_DATE').loc[mapped_june_days]
        # Seasonality factor for the user's selected month
        if start_date:
            user_month = pd.to_datetime(start_date).month
        else:
            user_month = 6  # Default to June
        seasonality_factor = SEASONALITY_FACTORS.get(user_month, 1.0)

        # --- Predict for each mapped day for current and perfect quality ---
        predicted_as_current = []
        predicted_spend_current = []
        predicted_as_perfect = []
        predicted_spend_perfect = []
        if reg_cpas is not None and reg_as is not None:
            cpas_june_avg = job_stats_all['CPAS'].mean()
            # Quality factors
            quality_factor_current = float(reg_cpas.predict([[avg_quality]])[0]) / cpas_june_avg if cpas_june_avg > 0 else 1.0
            quality_factor_perfect = float(reg_cpas.predict([[100]])[0]) / cpas_june_avg if cpas_june_avg > 0 else 1.0
            # Quality factors for AS
            as_base_current = float(reg_as.predict([[avg_quality]])[0])
            as_base_perfect = float(reg_as.predict([[100]])[0])
            as_june_avg = job_stats_all['APPLY_START'].mean()
            as_quality_factor_current = as_base_current / as_june_avg if as_june_avg > 0 else 1.0
            as_quality_factor_perfect = as_base_perfect / as_june_avg if as_june_avg > 0 else 1.0
        else:
            quality_factor_current = 1.0
            quality_factor_perfect = 1.0
        for i, date in enumerate(mapped_june_days):
            day_stats = june_stats.loc[date]
            # Use actual June CPAS and AS for the day, adjusted for seasonality and quality
            cpas_pred_current = day_stats['CPAS'] * seasonality_factor * quality_factor_current
            as_pred_current = day_stats['APPLY_START'] * seasonality_factor * as_quality_factor_current
            cpas_pred_perfect = day_stats['CPAS'] * seasonality_factor * quality_factor_perfect
            as_pred_perfect = day_stats['APPLY_START'] * seasonality_factor * as_quality_factor_perfect
            predicted_as_current.append(as_pred_current)
            predicted_spend_current.append(cpas_pred_current * as_pred_current)
            predicted_as_perfect.append(as_pred_perfect)
            predicted_spend_perfect.append(cpas_pred_perfect * as_pred_perfect)
        total_predicted_as_current = sum(predicted_as_current)
        total_predicted_spend_current = sum(predicted_spend_current)
        avg_predicted_cpas_current = total_predicted_spend_current / total_predicted_as_current if total_predicted_as_current > 0 else 0
        total_predicted_as_perfect = sum(predicted_as_perfect)
        total_predicted_spend_perfect = sum(predicted_spend_perfect)
        avg_predicted_cpas_perfect = total_predicted_spend_perfect / total_predicted_as_perfect if total_predicted_as_perfect > 0 else 0

        # Safeguard: perfect quality should not result in worse CPAS than current
        if avg_predicted_cpas_perfect > avg_predicted_cpas_current:
            avg_predicted_cpas_perfect = avg_predicted_cpas_current * 0.85

        # --- Optimal job count logic (as before, but for mapped days) ---
        # Use filtered data for mapped days
        filtered_data1 = data1[data1['EVENT_PUBLISHER_DATE'].isin(mapped_june_days)]
        june_job_count = len(filtered_data1['MAIN_REF_NUMBER'].unique())
        june_avg_spend_per_job = filtered_data1['CDSPEND'].sum() / june_job_count if june_job_count > 0 else 0
        june_avg_as_per_job = filtered_data1['APPLY_START'].sum() / june_job_count if june_job_count > 0 else 0
        max_jobs_by_budget = int(budget / june_avg_spend_per_job) if june_avg_spend_per_job > 0 else 1
        jobs_needed_for_as_goal = int(as_goal / june_avg_as_per_job) if june_avg_as_per_job > 0 else 1
        jobs_by_duration = max(1, int(june_job_count * (len(mapped_june_days) / 30)))
        optimal_job_count = min(max_jobs_by_budget, jobs_needed_for_as_goal, jobs_by_duration)
        optimal_job_count = max(1, optimal_job_count)
        if optimal_job_count == max_jobs_by_budget:
            optimal_job_count_reason = f'Limited by budget: can afford {max_jobs_by_budget} jobs at ${june_avg_spend_per_job:.2f} each (based on mapped June days)'
        elif optimal_job_count == jobs_needed_for_as_goal:
            optimal_job_count_reason = f'Limited by AS goal: need {jobs_needed_for_as_goal} jobs to reach {as_goal} AS at {june_avg_as_per_job:.1f} AS per job (based on mapped June days)'
        elif optimal_job_count == jobs_by_duration:
            optimal_job_count_reason = f'Limited by duration: can run {jobs_by_duration} jobs in {duration} weeks (scaled from mapped June job count)'
        else:
            optimal_job_count_reason = 'Calculated based on budget, AS goal, and duration constraints'
        projected_as = optimal_job_count * june_avg_as_per_job
        projected_spend = optimal_job_count * june_avg_spend_per_job
        if projected_as < as_goal:
            optimal_job_count_reason += f'. Note: This will deliver {int(projected_as)} AS (below goal of {as_goal})'

        # Confidence: use R2 from regression if available, else default
        if reg_cpas is not None and len(job_stats_all) >= 3:
            y_pred_cpas = reg_cpas.predict(Xq)
            r2 = r2_score(y_cpas, y_pred_cpas)
            confidence = max(0.92, min(1.0, r2))
        else:
            confidence = 0.92

        # --- Find average job-level AS for mapped June days ---
        filtered_data1 = data1[data1['EVENT_PUBLISHER_DATE'].isin(mapped_june_days)]
        job_as_counts = filtered_data1.groupby('MAIN_REF_NUMBER')['APPLY_START'].sum()
        avg_as_per_job = job_as_counts.mean() if not job_as_counts.empty else 0

        debug_info = {
            'mapped_june_days': [str(d.date()) for d in mapped_june_days],
            'num_jobs_analyzed': int(len(job_stats_all)),
            'quality_std': float(round(job_stats_all['quality'].std(), 2)),
            'avg_cpas': float(round(job_stats_all['CPAS'].mean(), 2)),
            'avg_as_per_job': float(round(june_avg_as_per_job, 1)),
            'regression_used': reg_cpas is not None and len(job_stats_all) >= 3,
            'current_cpas': float(round(avg_predicted_cpas_current, 2)),
            'june_job_count': int(june_job_count),
            'selected_days': [str(d.date()) for d in mapped_june_days],
            'debug_warning': None,
            'calculation_method': 'June-trained ML, mapped dates, regime, seasonality, job quality'
        }
        return {
            'overall_quality_score': round(avg_quality, 1),
            'cpas_if_perfect_quality': float(round(avg_predicted_cpas_perfect, 2)),
            'cpas_current': float(round(avg_predicted_cpas_current, 2)),
            'as_if_perfect_quality': int(round(total_predicted_as_perfect)),
            'as_current': int(round(total_predicted_as_current)),
            'optimal_job_count': optimal_job_count,
            'optimal_job_count_reason': optimal_job_count_reason,
            'confidence': float(round(confidence, 4)),
            'avg_as_per_job': float(round(avg_as_per_job, 2)),
            'debug_info': to_py(debug_info)
        }
    except Exception as e:
        logger.error(f"Error in job_impact_scenarios: {e}")
        return {"error": f"Job impact scenarios calculation failed: {str(e)}"}

def to_py(val):
    if isinstance(val, (np.integer, np.int64, np.int32)):
        return int(val)
    if isinstance(val, (np.floating, np.float64, np.float32)):
        return float(val)
    if isinstance(val, np.ndarray):
        return [to_py(x) for x in val.tolist()]
    if isinstance(val, (list, tuple)):
        return [to_py(x) for x in val]
    if isinstance(val, dict):
        return {k: to_py(v) for k, v in val.items()}
    return val

if __name__ == "__main__":
    logger.info("Starting FastAPI server...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info") 