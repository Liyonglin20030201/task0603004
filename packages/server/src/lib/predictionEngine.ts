import { linearRegression, linearRegressionLine, standardDeviation } from 'simple-statistics';

export interface PredictionPoint {
  date: string;
  value: number;
  confidenceLow: number;
  confidenceHigh: number;
}

export interface PredictionResult {
  type: string;
  horizonDays: number;
  predictions: PredictionPoint[];
  modelParams: {
    slope: number;
    intercept: number;
    r2: number;
    trend: 'improving' | 'stable' | 'declining';
  };
}

export interface DailyDataPoint {
  date: string;
  value: number;
}

function computeR2(data: [number, number][], line: (x: number) => number): number {
  const yMean = data.reduce((s, d) => s + d[1], 0) / data.length;
  const ssTotal = data.reduce((s, d) => s + (d[1] - yMean) ** 2, 0);
  const ssResidual = data.reduce((s, d) => s + (d[1] - line(d[0])) ** 2, 0);
  if (ssTotal === 0) return 0;
  return 1 - ssResidual / ssTotal;
}

export function generatePredictions(
  dailyData: DailyDataPoint[],
  horizonDays: number,
  type: string
): PredictionResult {
  const n = dailyData.length;
  if (n < 7) {
    return {
      type,
      horizonDays,
      predictions: [],
      modelParams: { slope: 0, intercept: 0, r2: 0, trend: 'stable' },
    };
  }

  // Apply 7-day rolling average
  const smoothed: number[] = [];
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - 6);
    const window = dailyData.slice(start, i + 1).map(d => d.value);
    smoothed.push(window.reduce((a, b) => a + b, 0) / window.length);
  }

  // Weighted linear regression: recent data weighted higher
  const weightedData: [number, number][] = smoothed.map((val, i) => {
    const weight = Math.pow(0.95, n - 1 - i);
    return [i * weight, val * weight] as [number, number];
  });

  const reg = linearRegression(weightedData);
  const line = linearRegressionLine(reg);

  // Unweighted for R2 and residuals
  const unweightedData: [number, number][] = smoothed.map((val, i) => [i, val]);
  const unweightedReg = linearRegression(unweightedData);
  const unweightedLine = linearRegressionLine(unweightedReg);
  const r2 = computeR2(unweightedData, unweightedLine);

  // Residual standard error
  const residuals = unweightedData.map(([x, y]) => y - unweightedLine(x));
  const residualStd = residuals.length > 2 ? standardDeviation(residuals) : 1;

  // Generate predictions
  const lastDate = new Date(dailyData[n - 1].date);
  const predictions: PredictionPoint[] = [];

  for (let d = 1; d <= horizonDays; d++) {
    const futureDate = new Date(lastDate);
    futureDate.setDate(futureDate.getDate() + d);

    const x = n - 1 + d;
    const predicted = unweightedLine(x);
    const confidence = 1.28 * residualStd * Math.sqrt(1 + d / n); // ~80% CI

    predictions.push({
      date: futureDate.toISOString().slice(0, 10),
      value: Math.max(0, Math.round(predicted * 100) / 100),
      confidenceLow: Math.max(0, Math.round((predicted - confidence) * 100) / 100),
      confidenceHigh: Math.round((predicted + confidence) * 100) / 100,
    });
  }

  const slope = unweightedReg.m;
  let trend: 'improving' | 'stable' | 'declining';
  if (slope > 0.5) trend = 'improving';
  else if (slope < -0.5) trend = 'declining';
  else trend = 'stable';

  return {
    type,
    horizonDays,
    predictions,
    modelParams: {
      slope: Math.round(slope * 1000) / 1000,
      intercept: Math.round(unweightedReg.b * 100) / 100,
      r2: Math.round(r2 * 1000) / 1000,
      trend,
    },
  };
}
