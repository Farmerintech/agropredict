import type { MacroSnapshot } from "@/lib/macro";
import type { PriceObservation } from "@/lib/prices";

export type Point = { date: string; price: number };
export type ForecastInputs = {
  basePrice: number;
  historicalMonthlyTrend: number;
  inflationAnnual: number | null;
  fxChangeAnnual: number | null;
  costOfCapitalAnnual: number | null;
  blendedMonthlyRate: number;
  lastObserved: string;
};
export type ForecastResult = {
  history: Point[];
  forecast: Point[];
  inputs: ForecastInputs;
  warnings: string[];
};

// Tunable model coefficients.
const FX_PASSTHROUGH = 0.5; // share of naira depreciation passed into prices
const CARRY_WEIGHT = 0.3; // weight of financing/storage cost
const TREND_WEIGHT = 0.5; // blend: historical trend vs macro-driven rate
const MAX_MONTHLY = 0.06; // cap on monthly growth (avoids explosive forecasts)

const EMPTY_INPUTS: ForecastInputs = {
  basePrice: 0,
  historicalMonthlyTrend: 0,
  inflationAnnual: null,
  fxChangeAnnual: null,
  costOfCapitalAnnual: null,
  blendedMonthlyRate: 0,
  lastObserved: "",
};

export function predictPrices(
  rows: PriceObservation[],
  macro: MacroSnapshot | null,
  horizon: number,
  costOfCapitalOverride?: number
): ForecastResult {
  const warnings: string[] = [];

  const monthly = aggregateMonthly(rows);
  if (monthly.length === 0) {
    return { history: [], forecast: [], inputs: EMPTY_INPUTS, warnings: ["No historical data for this commodity."] };
  }

  const history = monthly.slice(-24);
  const baseWindow = monthly.slice(-3);
  const basePrice = baseWindow.reduce((a, p) => a + p.price, 0) / baseWindow.length;

  // Historical month-over-month growth over the last 12 points.
  const trendWindow = monthly.slice(-12);
  let gHist = 0;
  if (trendWindow.length >= 2) {
    const first = trendWindow[0].price;
    const last = trendWindow[trendWindow.length - 1].price;
    if (first > 0 && last > 0) gHist = Math.pow(last / first, 1 / (trendWindow.length - 1)) - 1;
  }

  const inflationAnnual = latestValue(macro?.inflation ?? []);
  const fxChangeAnnual = fxYearOverYear(macro?.exchangeRate ?? []);
  const costOfCapitalAnnual = costOfCapitalOverride ?? latestValue(macro?.lendingRate ?? []);

  const inflM = inflationAnnual != null ? Math.pow(1 + inflationAnnual / 100, 1 / 12) - 1 : 0;
  const fxM = fxChangeAnnual != null ? Math.pow(1 + fxChangeAnnual / 100, 1 / 12) - 1 : 0;
  const carryM = costOfCapitalAnnual != null ? Math.pow(1 + costOfCapitalAnnual / 100, 1 / 12) - 1 : 0;
  const macroM = inflM + FX_PASSTHROUGH * fxM + CARRY_WEIGHT * carryM;
  const blended = Math.min(MAX_MONTHLY, TREND_WEIGHT * gHist + (1 - TREND_WEIGHT) * macroM);

  const lastMonth = monthly[monthly.length - 1].date;

  // Forecast from the last observed month through the current month plus the
  // requested horizon. Commodities whose data ends before today (e.g. some WFP
  // series stop years ago) still get a prediction spanning the current year,
  // bridged from their own last available observations.
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const endMonth = addMonths(currentMonth, horizon);
  const monthsAhead = Math.max(horizon, monthSpan(lastMonth, endMonth));
  const bridgeMonths = monthSpan(lastMonth, currentMonth);

  const forecast: Point[] = [];
  for (let k = 1; k <= monthsAhead; k += 1) {
    forecast.push({ date: addMonths(lastMonth, k), price: Math.round(basePrice * Math.pow(1 + blended, k)) });
  }

  if (bridgeMonths > 3) {
    warnings.push(
      `Last observation ${lastMonth} — forecast bridges ${bridgeMonths} months to ${currentMonth} using this commodity's own history.`
    );
  }

  return {
    history,
    forecast,
    inputs: {
      basePrice,
      historicalMonthlyTrend: gHist,
      inflationAnnual,
      fxChangeAnnual,
      costOfCapitalAnnual,
      blendedMonthlyRate: blended,
      lastObserved: lastMonth,
    },
    warnings,
  };
}

function aggregateMonthly(rows: PriceObservation[]): Point[] {
  const map = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    const v = Number(r.price_naira);
    if (!Number.isFinite(v)) continue;
    const key = r.observation_date.slice(0, 7);
    const cur = map.get(key) || { sum: 0, count: 0 };
    cur.sum += v;
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([date, { sum, count }]) => ({ date, price: sum / count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function latestValue(series: { value: number | null }[]): number | null {
  return series.find((p) => p.value != null)?.value ?? null;
}

function fxYearOverYear(series: { value: number | null }[]): number | null {
  const values = series.filter((p) => p.value != null).map((p) => p.value as number);
  if (values.length < 2) return null;
  return values[0] / values[1] - 1;
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

function monthSpan(fromYm: string, toYm: string): number {
  const [fy, fm] = fromYm.split("-").map(Number);
  const [ty, tm] = toYm.split("-").map(Number);
  return ty * 12 + tm - (fy * 12 + fm);
}
