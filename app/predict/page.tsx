"use client";
import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import AppShell from "@/components/AppShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MacroSnapshot } from "@/lib/macro";
import { futureForecast, predictCommodity, type MarketCommodity } from "@/lib/predict";

type Snapshot = { date: string; commodities: Record<string, MarketCommodity> };

const HORIZONS = [3, 6, 12, 24];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const EMPTY_MACRO: MacroSnapshot = { inflation: [], exchangeRate: [], lendingRate: [], currentFx: null, fetchedAt: "", errors: [] };

export default function Predict() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [macro, setMacro] = useState<MacroSnapshot>(EMPTY_MACRO);
  const [commodity, setCommodity] = useState("");
  const [horizon, setHorizon] = useState(12);
  const [coc, setCoc] = useState("");

  useEffect(() => {
    fetch("/api/snapshot")
      .then((r) => r.json())
      .then(setSnapshot)
      .catch(() => setSnapshot(null));
    fetch("/api/macro")
      .then((r) => r.json())
      .then(setMacro)
      .catch(() => setMacro(EMPTY_MACRO));
  }, []);

  // Mirror the app: commodities come from the cleaned monthly snapshot (unit
  // normalized, dead surveys and in-progress trailing months already dropped).
  const commodities = useMemo(
    () => (snapshot ? Object.keys(snapshot.commodities).sort((a, b) => a.localeCompare(b)) : []),
    [snapshot]
  );
  const active = commodity === "" ? (commodities[0] ?? "") : commodity;
  const activeCommodity = snapshot?.commodities[active] ?? null;
  const unit = activeCommodity?.unit ?? "";

  const result = useMemo(() => {
    if (!activeCommodity || activeCommodity.months.length === 0) return null;
    const parsed = Number(coc);
    const override = coc === "" || !Number.isFinite(parsed) ? undefined : parsed;
    return predictCommodity(activeCommodity, macro, horizon, override);
  }, [activeCommodity, macro, horizon, coc]);

  // Strictly-future months, exactly like the app's Month-by-month table.
  const future = useMemo(() => (result ? futureForecast(result.forecast, horizon) : []), [result, horizon]);

  const chartData = useMemo(() => {
    if (!result) return [];
    const byDate = new Map<string, { date: string; actual: number | null; predicted: number | null }>();
    result.history.forEach((p) => byDate.set(p.date, { date: p.date, actual: p.price, predicted: null }));
    future.forEach((p) => {
      const row = byDate.get(p.date) ?? { date: p.date, actual: null as number | null, predicted: null as number | null };
      row.predicted = p.price;
      byDate.set(p.date, row);
    });
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [result, future]);

  const latestInflation = latest(macro.inflation);
  const latestLending = latest(macro.lendingRate);
  const fxYoY = fxYearOverYear(macro.exchangeRate);

  return (
    <AppShell title="Predict" status={<span className="status"><i /> WFP / HDX · World Bank · live FX</span>}>
      <section className="intro">
            <p className="eyebrow">PRICE FORECAST</p>
            <h1>Where is the market headed?</h1>
            <p className="lede">Project next-month prices from the cleaned WFP/HDX monthly snapshot plus live inflation, exchange-rate and cost-of-capital conditions for Nigeria. History is normalized to a single unit per commodity, matching the agrocast app.</p>
          </section>
          <section className="workspace">
            <div className="workspace-head">
              <div>
                <h2>Commodity forecast</h2>
                <p>Base price · trend · macro adjustments</p>
              </div>
              <div className="workspace-actions">
                <span className="source-pill">Model v1</span>
              </div>
            </div>

            <div className="controls">
              <label className="field">
                <span>Commodity</span>
                <Select value={active} onValueChange={setCommodity}>
                  <SelectTrigger aria-label="Commodity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {commodities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              <label className="field">
                <span>Horizon</span>
                <Select value={String(horizon)} onValueChange={(v) => setHorizon(Number(v))}>
                  <SelectTrigger aria-label="Horizon">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HORIZONS.map((h) => <SelectItem key={h} value={String(h)}>{h} months</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              <label className="field">
                <span>Cost of capital % <em>(optional override)</em></span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={coc}
                  onChange={(e) => setCoc(e.target.value)}
                  placeholder={latestLending != null ? `auto: ${latestLending.toFixed(1)}%` : "auto"}
                />
              </label>
            </div>

            <div className="cards">
              <div className="card"><span className="k">Current FX (NGN/USD)</span><span className="v">{macro.currentFx != null ? `₦${macro.currentFx.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—"}</span></div>
              <div className="card"><span className="k">Inflation (annual)</span><span className="v">{latestInflation != null ? `${latestInflation.toFixed(1)}%` : "—"}</span></div>
              <div className="card"><span className="k">Cost of capital</span><span className="v">{result?.inputs.costOfCapitalAnnual != null ? `${result.inputs.costOfCapitalAnnual.toFixed(1)}%` : "—"}</span></div>
              <div className="card"><span className="k">FX change (YoY)</span><span className="v">{fxYoY != null ? `${fxYoY >= 0 ? "+" : ""}${(fxYoY * 100).toFixed(1)}%` : "—"}</span></div>
            </div>

            {result ? (
              <>
              <div className="forecast-wrap">
                <div className="forecast-scroll">
                  <table className="forecast-table">
                  <thead>
                    <tr>{["Month", "Predicted price", "vs base"].map((h) => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {future.length === 0 ? (
                      <tr><td colSpan={3} className="date">No months ahead of the current month yet — the latest observation is {result.inputs.lastObserved || "—"}.</td></tr>
                    ) : future.map((p) => {
                      const pct = (p.price / result.inputs.basePrice - 1) * 100;
                      return (
                        <tr key={p.date}>
                          <td data-label="Month">{formatMonth(p.date)}</td>
                          <td data-label="Predicted price" className="price">₦{p.price.toLocaleString()}{unit ? ` / ${unit}` : ""}</td>
                          <td data-label="vs base">{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  </table>
                </div>
                <div className="model-box">
                  <h3>Model assumptions</h3>
                  <ul>
                    <li>Base price (last 3 months): <strong>₦{result.inputs.basePrice.toLocaleString()}{unit ? ` / ${unit}` : ""}</strong></li>
                    <li>Last observation: <strong>{result.inputs.lastObserved || "—"}</strong></li>
                    <li>Historical monthly trend: <strong>{(result.inputs.historicalMonthlyTrend * 100).toFixed(2)}%</strong></li>
                    <li>Inflation (annual): <strong>{result.inputs.inflationAnnual != null ? result.inputs.inflationAnnual.toFixed(1) + "%" : "—"}</strong></li>
                    <li>FX change (annual): <strong>{result.inputs.fxChangeAnnual != null ? (result.inputs.fxChangeAnnual * 100 >= 0 ? "+" : "") + (result.inputs.fxChangeAnnual * 100).toFixed(1) + "%" : "—"}</strong></li>
                    <li>Cost of capital (annual): <strong>{result.inputs.costOfCapitalAnnual != null ? result.inputs.costOfCapitalAnnual.toFixed(1) + "%" : "—"}</strong></li>
                    <li>Blended monthly rate: <strong>{(result.inputs.blendedMonthlyRate * 100).toFixed(2)}%</strong></li>
                  </ul>
                  <p className="formula">P<sub>k</sub> = P<sub>0</sub> × (1 + r)<sup>k</sup>, where r = min(6%, 0.5·trend + 0.5·(inflation + 0.5·FX + 0.3·carry))</p>
                  {result.warnings.length > 0 && <p className="model-note">{result.warnings.join(" · ")}</p>}
                </div>
              </div>

              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8eee8" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`₦${v.toLocaleString()}${unit ? ` / ${unit}` : ""}`, "Price"]} />
                    {future.length > 0 && <ReferenceLine x={future[0]?.date} stroke="#c9a227" strokeDasharray="4 4" />}
                    <Line type="monotone" dataKey="actual" name="Historical" stroke="#1d6b46" strokeWidth={2.5} dot={false} connectNulls={false} />
                    <Line type="monotone" dataKey="predicted" name="Forecast" stroke="#d97706" strokeWidth={2.5} strokeDasharray="6 4" dot={false} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              </>
            ) : (
              <div className="chart chart-empty">
                <p className="empty-note">{snapshot && commodities.length === 0 ? "No cleaned price history available." : "Loading the price snapshot…"}</p>
              </div>
            )}
          </section>
          <footer>Forecast is a simple trend + macro model, not financial advice. Prices in naira per the commodity's normalized unit, from the same WFP/HDX monthly snapshot the agrocast app uses.</footer>
    </AppShell>
  );
}

function latest(series: { value: number | null }[]): number | null {
  return series.find((p) => p.value != null)?.value ?? null;
}

function fxYearOverYear(series: { value: number | null }[]): number | null {
  const values = series.filter((p) => p.value != null).map((p) => p.value as number);
  if (values.length < 2) return null;
  return values[0] / values[1] - 1;
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_NAMES[(m - 1) % 12]} ${y}`;
}
