import type { MacroSnapshot } from "@/lib/macro";

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

// A monthly national series for one commodity, in a single normalized unit
// (per kg / per litre / per count). Produced by scripts/build_market_snapshot.js
// and published at data/agrocast-market.json — the same snapshot the agrocast
// app predicts from, so the web forecast mirrors the app forecast.
export type MarketCommodity = {
  unit: string;
  months: Point[];
};

// Tunable model coefficients (mirror of the app / market.ts).
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

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function addMonths(ym: string, n: number): string {
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

function latestValue(series: { value: number | null }[]): number | null {
  return series.find((p) => p.value != null)?.value ?? null;
}

function fxYearOverYear(series: { value: number | null }[]): number | null {
  const values = series.filter((p) => p.value != null).map((p) => p.value as number);
  if (values.length < 2) return null;
  return values[0] / values[1] - 1;
}

/**
 * Forecast a commodity from its monthly national series (normalized, cleaned —
 * dead surveys and in-progress trailing months already removed). Mirrors the
 * agrocast app's predictCommodity so both surfaces return the same numbers.
 */
export function predictCommodity(
  commodity: MarketCommodity,
  macro: MacroSnapshot | null,
  horizon: number,
  costOfCapitalOverride?: number
): ForecastResult {
  const warnings: string[] = [];
  const monthly = commodity.months;
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
  const currentMonth = currentMonthKey();
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

/** Forecast points for months strictly ahead of today, up to the horizon. */
export function futureForecast(forecast: Point[], horizon: number): Point[] {
  const currentMonth = currentMonthKey();
  return forecast.filter((p) => p.date > currentMonth).slice(0, horizon);
}
