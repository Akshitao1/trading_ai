import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from datetime import timedelta
import json
from prophet import Prophet

# Load Data
data1 = pd.read_csv('../data/data1.csv')
data2 = pd.read_csv('../data/data2.csv')
budget_log = pd.read_csv('../data/budget_log.csv')

print('Data1 shape:', data1.shape)
print('Data2 shape:', data2.shape)
print('Budget Log shape:', budget_log.shape)

# Ensure both columns are string type for merging
job_id_col_data2 = data2.columns[3]  # 4th column is job ID

data1['MAIN_REF_NUMBER'] = data1['MAIN_REF_NUMBER'].astype(str)
data2[job_id_col_data2] = data2[job_id_col_data2].astype(str)

# Merge data1 and data2 on MAIN_REF_NUMBER and job ID column in data2
merged = pd.merge(data1, data2, left_on='MAIN_REF_NUMBER', right_on=job_id_col_data2, how='left')

# Merge budget_log on date
merged['EVENT_PUBLISHER_DATE'] = pd.to_datetime(merged['EVENT_PUBLISHER_DATE'])
budget_log['Date'] = pd.to_datetime(budget_log['Date'])
merged = pd.merge_asof(merged.sort_values('EVENT_PUBLISHER_DATE'), budget_log.sort_values('Date'), left_on='EVENT_PUBLISHER_DATE', right_on='Date', direction='backward')
print('Merged shape:', merged.shape)

# Calculate CPAS as CDSPEND / APPLY_START
merged['CPAS'] = merged['CDSPEND'] / merged['APPLY_START'].replace(0, np.nan)
merged = merged.dropna(subset=['CPAS'])

# Sort by date and take last 30 days
merged = merged.sort_values('EVENT_PUBLISHER_DATE')
last_30_days = merged.tail(30)

# Calculate average CPAS from last 30 days
avg_cpas = last_30_days['CPAS'].mean()
print(f'Average CPAS (last 30 days): {avg_cpas:.4f}')

# User input for number_of_jobs
def get_number_of_jobs():
    try:
        return int(input('Enter the number of jobs: '))
    except Exception:
        print('Invalid input. Using default value of 1.')
        return 1

number_of_jobs = get_number_of_jobs()

# Quality adjustment logic
if number_of_jobs:
    quality_adjustment = min(1.2, 0.8 + (number_of_jobs / 50) * 0.4)
else:
    quality_adjustment = 1.0

estimated_cpas = avg_cpas * (1 / quality_adjustment)
print(f'Estimated CPAS (quality adjusted): {estimated_cpas:.4f}')

# Market seasonality index (example values, adjust as needed)
market_seasonality = {
    'Jan': 0.9,
    'Feb': 0.95,
    'Mar': 1.0,
    'Apr': 1.05,
    'May': 1.1,
    'Jun': 1.2,
    'Jul': 1.15,
    'Aug': 1.1,
    'Sep': 1.0,
    'Oct': 1.05,
    'Nov': 1.2,
    'Dec': 1.3
}

# Prompt user for target month
selected_month = input('Enter the month for estimate (e.g., Jan, Feb, ...): ')
seasonality_factor = market_seasonality.get(selected_month, 1.0)
seasonality_adjusted_cpas = estimated_cpas * seasonality_factor
print(f'Seasonality-adjusted Estimated CPAS for {selected_month}: {seasonality_adjusted_cpas:.4f}')

# Save results
with open('estimated_cpas.txt', 'w') as f:
    f.write(f'Average CPAS (last 30 days): {avg_cpas:.4f}\n')
    f.write(f'Number of jobs: {number_of_jobs}\n')
    f.write(f'Quality adjustment: {quality_adjustment:.4f}\n')
    f.write(f'Estimated CPAS (quality adjusted): {estimated_cpas:.4f}\n')
    f.write(f'Seasonality factor for {selected_month}: {seasonality_factor:.4f}\n')
    f.write(f'Seasonality-adjusted Estimated CPAS for {selected_month}: {seasonality_adjusted_cpas:.4f}\n')
print('Saved estimated CPAS results to estimated_cpas.txt')

# Plot CPAS distribution for last 30 days
plt.figure(figsize=(10,5))
plt.hist(last_30_days['CPAS'], bins=30, color='skyblue', edgecolor='black')
plt.title('CPAS Distribution (Last 30 Days)')
plt.xlabel('CPAS')
plt.ylabel('Frequency')
plt.tight_layout()
plt.savefig('cpa_distribution_last_30_days.png')
plt.close()
print('Saved CPAS distribution plot for last 30 days as cpa_distribution_last_30_days.png')

# Note: PNGs (data4.1.png, data4.2.png) are not used in this script. For future work, consider extracting data from them for demand prediction.

# Load June data
june = pd.read_csv('../data/data1.csv')

# Aggregate by day: sum CDSPEND and APPLY_START, then calculate daily CPAS
june['EVENT_PUBLISHER_DATE'] = pd.to_datetime(june['EVENT_PUBLISHER_DATE'])
june = june[june['EVENT_PUBLISHER_DATE'].dt.month == 6]
daily = june.groupby('EVENT_PUBLISHER_DATE').agg({'CDSPEND': 'sum', 'APPLY_START': 'sum'}).reset_index()
daily = daily[daily['APPLY_START'] > 0]
daily['CPAS'] = daily['CDSPEND'] / daily['APPLY_START']

# Prepare for Prophet
df = daily[['EVENT_PUBLISHER_DATE', 'CPAS']].rename(columns={'EVENT_PUBLISHER_DATE': 'ds', 'CPAS': 'y'})

# Fit Prophet model
m = Prophet(yearly_seasonality=False, weekly_seasonality=True, daily_seasonality=False)
m.fit(df)

# Forecast next 60 days
future = m.make_future_dataframe(periods=60)
forecast = m.predict(future)

# Save forecasted CPAS as JSON (date, yhat)
forecast_out = forecast[['ds', 'yhat']].tail(60)
forecast_out['ds'] = forecast_out['ds'].dt.strftime('%Y-%m-%d')
forecast_dict = forecast_out.set_index('ds')['yhat'].round(2).to_dict()

with open('../src/data/forecasted_cpas.json', 'w') as f:
    json.dump(forecast_dict, f, indent=2)

print('Saved forecasted CPAS for next 60 days to src/data/forecasted_cpas.json')

# --- Automatic Budget Regime Analysis for June ---
# Assign each June day to the most recent budget regime
june_data = data1.copy()
june_data['EVENT_PUBLISHER_DATE'] = pd.to_datetime(june_data['EVENT_PUBLISHER_DATE'])
june_data = june_data[june_data['EVENT_PUBLISHER_DATE'].dt.month == 6]

# Prepare budget log for merge
budget_log_sorted = budget_log.sort_values('Date')
# Assign each row in June data the most recent budget regime
june_data = pd.merge_asof(
    june_data.sort_values('EVENT_PUBLISHER_DATE'),
    budget_log_sorted,
    left_on='EVENT_PUBLISHER_DATE',
    right_on='Date',
    direction='backward'
)

# Aggregate by budget regime
regime_groups = june_data.groupby(['Date', 'Budget', 'Duration_weeks'])
regime_summary = regime_groups.agg({
    'CDSPEND': 'sum',
    'APPLY_START': 'sum'
}).reset_index()
regime_summary['CPAS'] = regime_summary['CDSPEND'] / regime_summary['APPLY_START'].replace(0, np.nan)

print('\n=== Budget Regime Analysis for June ===')
for _, row in regime_summary.iterrows():
    print(f"Regime Start: {row['Date'].date()} | Budget: ${row['Budget']:,} | Duration: {row['Duration_weeks']} weeks")
    print(f"  Total Spend: ${row['CDSPEND']:.2f}")
    print(f"  Total Apply Starts: {int(row['APPLY_START'])}")
    print(f"  CPAS: ${row['CPAS']:.2f}\n")
# --- End Budget Regime Analysis --- 