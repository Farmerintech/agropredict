"use client";
import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import AppShell from "@/components/AppShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MacroSnapshot } from "@/lib/macro";
import { predictPrices } from "@/lib/predict";

type Row = { commodity: string; state: string; market: string; price_naira: string; unit: string; observation_date: string; source: string };

const HORIZONS = [3, 6, 12, 24];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const EMPTY_MACRO: MacroSnapshot = { inflation: [], exchangeRate: [], lendingRate: [], currentFx: null, fetchedAt: "", errors: [] };

export default function Predict() {
  const [rows, setRows] = useState<Row[]>([]);
  const [macro, setMacro] = useState<MacroSnapshot>(EMPTY_MACRO);
  const [commodity, setCommodity] = useState("");
  const [horizon, setHorizon] = useState(12);
  const [coc, setCoc] = useState("");

  useEffect(() => {
    fetch("/api/prices")
      .then((r) => r.json())
      .then((d) => setRows(d.data || []))
      .catch(() => setRows([]));
    fetch("/api/macro")
      .then((r) => r.json())
      .then(setMacro)
      .catch(() => setMacro(EMPTY_MACRO));
  }, []);

  const commodities = useMemo(() => [...new Set(rows.map((r) => r.commodity).filter(Boolean))].sort(), [rows]);
  const active = commodity === "" ? (commodities[0] ?? "") : commodity;

  const result = useMemo(() => {
    if (!active || rows.length === 0) return null;
    const rowsFor = rows.filter((r) => r.commodity === active);
    const parsed = Number(coc);
    const override = coc === "" || !Number.isFinite(parsed) ? undefined : parsed;
    return predictPrices(rowsFor, macro, horizon, override);
  }, [rows, active, macro, horizon, coc]);

  const chartData = useMemo(() => {
    if (!result) return [];
    return [
      ...result.history.map((p) => ({ date: p.date, actual: p.price, predicted: null as number | null })),
      ...result.forecast.map((p) => ({ date: p.date, actual: null as number | null, predicted: p.price })),
    ];
  }, [result]);

  const latestInflation = latest(macro.inflation);
  const latestLending = latest(macro.lendingRate);
  const fxYoY = fxYearOverYear(macro.exchangeRate);

  return (
    <AppShell title="Predict" status={<span className="status"><i /> WFP / HDX · World Bank · live FX</span>}>
      <section className="intro">
            <p className="eyebrow">PRICE FORECAST</p>
            <h1>Where is the market headed?</h1>
            <p className="lede">Project next-month prices from historical observations plus live inflation, exchange-rate and cost-of-capital conditions for Nigeria.</p>
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

            {result && (
              <div className="forecast-wrap">
                <div className="forecast-scroll">
                  <table className="forecast-table">
                  <thead>
                    <tr>{["Month", "Predicted price", "vs base"].map((h) => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {result.forecast.map((p) => {
                      const pct = (p.price / result.inputs.basePrice - 1) * 100;
                      return (
                        <tr key={p.date}>
                          <td data-label="Month">{formatMonth(p.date)}</td>
                          <td data-label="Predicted price" className="price">₦{p.price.toLocaleString()}</td>
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
                    <li>Base price (last 3 months): <strong>₦{result.inputs.basePrice.toLocaleString()}</strong></li>
                    <li>Historical monthly trend: <strong>{(result.inputs.historicalMonthlyTrend * 100).toFixed(2)}%</strong></li>
                    <li>Inflation (annual): <strong>{result.inputs.inflationAnnual != null ? result.inputs.inflationAnnual.toFixed(1) + "%" : "—"}</strong></li>
                    <li>FX change (annual): <strong>{result.inputs.fxChangeAnnual != null ? (result.inputs.fxChangeAnnual * 100 >= 0 ? "+" : "") + (result.inputs.fxChangeAnnual * 100).toFixed(1) + "%" : "—"}</strong></li>
                    <li>Cost of capital (annual): <strong>{result.inputs.costOfCapitalAnnual != null ? result.inputs.costOfCapitalAnnual.toFixed(1) + "%" : "—"}</strong></li>
                    <li>Blended monthly rate: <strong>{(result.inputs.blendedMonthlyRate * 100).toFixed(2)}%</strong></li>
                  </ul>
                  <p className="formula">P<sub>k</sub> = P<sub>0</sub> × (1 + r)<sup>k</sup>, where r = min(6%, 0.5·trend + 0.5·(inflation + 0.5·FX + 0.3·carry))</p>
                </div>
              </div>
            )}

            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8eee8" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`₦${v.toLocaleString()}`, "Price"]} />
                  {result && <ReferenceLine x={result.forecast[0]?.date} stroke="#c9a227" strokeDasharray="4 4" />}
                  <Line type="monotone" dataKey="actual" name="Historical" stroke="#1d6b46" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="predicted" name="Forecast" stroke="#d97706" strokeWidth={2.5} strokeDasharray="6 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
          <footer>Forecast is a simple trend + macro model, not financial advice. Prices in naira.</footer>
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
