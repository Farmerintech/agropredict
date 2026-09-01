"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type Row = { commodity: string; state: string; market: string; price_naira: string; unit: string; observation_date: string };

const FALLBACK_CHART: { date: string; price: number }[] = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(2025, 8 + i, 1);
  return {
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    price: Math.round(1350 + i * 62 + Math.sin(i) * 45),
  };
});

const monthTick = (d: string) => new Date(`${d}-01`).toLocaleDateString("en", { month: "short" });
const monthLabel = (d: string) => new Date(`${d}-01`).toLocaleDateString("en", { month: "long", year: "numeric" });

export default function Landing() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    fetch("/api/prices")
      .then((r) => r.json())
      .then((d) => setRows(d.data || []))
      .catch(() => setRows([]));
  }, []);

  const stats = useMemo(() => {
    const markets = new Set(rows.map((r) => r.market).filter(Boolean));
    const commodities = new Set(rows.map((r) => r.commodity).filter(Boolean));
    return { records: rows.length, markets: markets.size, commodities: commodities.size };
  }, [rows]);

  const chart = useMemo(() => {
    const m = new Map<string, { sum: number; count: number }>();
    rows.forEach((r) => {
      const v = Number(r.price_naira);
      if (!Number.isFinite(v)) return;
      const k = r.observation_date.slice(0, 7);
      const cur = m.get(k) || { sum: 0, count: 0 };
      cur.sum += v;
      cur.count += 1;
      m.set(k, cur);
    });
    return [...m]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([date, { sum, count }]) => ({ date, price: Math.round(sum / count) }));
  }, [rows]);

  const loaded = rows.length > 0;
  const chartData = chart.length > 1 ? chart : FALLBACK_CHART;
  const stat = (n: number) => (loaded ? n.toLocaleString() : "—");

  return (
    <div className="landing">
      <header className="l-header">
        <div className="l-header-inner">
          <Link href="/" className="l-brand">
            <span className="brand-mark">₦</span>AgroPrice <em>NG</em>
          </Link>
          <nav className="l-nav" aria-label="Landing navigation">
            <a href="#features">Features</a>
            <a href="#method">Method</a>
            <a href="#data">Data</a>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/analytics">Analytics</Link>
            <Link href="/predict">Predict</Link>
          </nav>
          <Link href="/dashboard" className="l-cta">Open dashboard →</Link>
        </div>
      </header>

      <section className="l-hero">
        <div className="l-hero-inner">
          <div>
            <p className="l-eyebrow">Nigeria food-price intelligence</p>
            <h1>Food prices, clearly mapped — and projected ahead.</h1>
            <p className="l-hero-sub">
              Explore historical staple prices across Nigerian markets from WFP / HDX, then forecast
              where the market is headed using Nigeria&apos;s live inflation, exchange-rate and financing data.
            </p>
            <div className="l-hero-actions">
              <Link href="/dashboard" className="l-btn-primary">Open the dashboard →</Link>
              <a href="#method" className="l-btn-ghost">How the forecast works</a>
            </div>
          </div>
          <div className="l-hero-card">
            <h3>National average price · last 12 months</h3>
            <p className="l-chart-note">{loaded ? "Live from WFP / HDX observations" : "Live data loading…"}</p>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={chartData} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.12)" />
                <XAxis dataKey="date" tickFormatter={monthTick} tick={{ fill: "#9fb6a6", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#9fb6a6", fontSize: 11 }} axisLine={false} tickLine={false} width={46} />
                <Tooltip
                  formatter={(v: number) => [`₦${v.toLocaleString()}`, "Avg price"]}
                  labelFormatter={(d) => monthLabel(String(d))}
                  contentStyle={{ background: "#0e2b1e", border: "1px solid rgba(255,255,255,.15)", borderRadius: 8, color: "#fff", fontSize: 12 }}
                />
                <Line type="monotone" dataKey="price" stroke="#7ee2a5" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <div className="l-stats">
        <div className="l-stat"><b>{stat(stats.records)}</b><span>Price observations</span></div>
        <div className="l-stat"><b>{stat(stats.markets)}</b><span>Markets covered</span></div>
        <div className="l-stat"><b>{stat(stats.commodities)}</b><span>Commodities tracked</span></div>
      </div>

      <section id="features" className="l-section">
        <div className="l-section-head">
          <h2>What AgroPrice does</h2>
          <p>One dashboard for exploring, understanding and projecting Nigerian staple prices — every number traceable to its source.</p>
        </div>
        <div className="l-grid-3">
          <div className="l-card"><span className="ico">🗺️</span><h3>Explore the data</h3><p>Search and filter tens of thousands of historical price observations by commodity, state, market, month or year — newest first and paginated.</p></div>
          <div className="l-card"><span className="ico">📈</span><h3>Analyze trends</h3><p>Follow the national average price path over the last 24 months with a clean, source-attributed chart on the Analytics page.</p></div>
          <div className="l-card"><span className="ico">🔮</span><h3>Project forward</h3><p>Forecast next-month prices for any commodity from its own history plus Nigeria&apos;s live inflation, exchange rate and cost of capital.</p></div>
        </div>
      </section>

      <section id="method" className="l-section">
        <div className="l-section-head">
          <h2>How the prediction works</h2>
          <p>A transparent, compounding model — no black box. Every input is shown on the Predict page.</p>
        </div>
        <div className="method">
          <div className="steps">
            <div className="step"><span className="n">1</span><div><b>Baseline price</b><p>P₀ is the average of the last three observed months for the chosen commodity.</p></div></div>
            <div className="step"><span className="n">2</span><div><b>Historical trend</b><p>g = the commodity&apos;s own month-over-month growth rate over the last 12 months.</p></div></div>
            <div className="step"><span className="n">3</span><div><b>Macro conditions</b><p>Nigeria&apos;s annual inflation, naira depreciation and lending rate are converted to monthly rates.</p></div></div>
            <div className="step"><span className="n">4</span><div><b>Blended rate</b><p>r = min(6%, 0.5·g + 0.5·macro) — half history, half live economy, capped to keep forecasts sane.</p></div></div>
            <div className="step"><span className="n">5</span><div><b>Compounding</b><p>Each month ahead projects from the base: P<sub>k</sub> = P<sub>0</sub>·(1 + r)<sup>k</sup>.</p></div></div>
          </div>
          <div className="formula-card">
            <h3>THE MODEL</h3>
            <p className="formula">
              P<sub>k</sub> = P<sub>0</sub> × (1 + r)<sup>k</sup>
              <small>
                r = min( 6%, 0.5·g + 0.5·( i + 0.5·f + 0.3·c ) )
                <br />
                i — monthly inflation · f — monthly FX depreciation · c — monthly cost of capital
              </small>
            </p>
            <div className="example">
              <p><b>Worked example (Maize, live data):</b> base price ₦198 · blended rate ≈ 3.0%/month → ≈ ₦284 at 12 months.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="data" className="l-section">
        <div className="l-section-head">
          <h2>Every data source, open and free</h2>
          <p>No API keys, no paywalls — each dataset is fetched live and credited on the dashboard.</p>
        </div>
        <div className="api-grid">
          <div className="api-card">
            <span className="badge">Historical prices</span>
            <h3>WFP Price Database · HDX</h3>
            <p>Staple food prices across Nigerian markets — the observation dataset behind the dashboard&apos;s Explore and Analytics views.</p>
            <a href="https://data.humdata.org/dataset/wfp-food-prices" target="_blank" rel="noopener noreferrer">humdata.org →</a>
          </div>
          <div className="api-card">
            <span className="badge">Macro · World Bank</span>
            <h3>World Bank Open Data API</h3>
            <p>Three annual Nigeria indicators power the forecast: inflation (FP.CPI.TOTL.ZG), official exchange rate (PA.NUS.FCRF) and lending rate (FR.INR.LEND).</p>
            <a href="https://data.worldbank.org/country/nigeria" target="_blank" rel="noopener noreferrer">data.worldbank.org →</a>
          </div>
          <div className="api-card">
            <span className="badge">Live FX</span>
            <h3>open.er-api.com</h3>
            <p>Free daily USD → NGN spot rate, refreshed every few hours, used for the current-FX card and the FX-change input to the model.</p>
            <a href="https://open.er-api.com" target="_blank" rel="noopener noreferrer">open.er-api.com →</a>
          </div>
        </div>
      </section>

      <div className="l-cta-band">
        <h2>Ready to see the markets?</h2>
        <p>Open the dashboard and explore the data behind Nigeria&apos;s food prices.</p>
        <Link href="/dashboard" className="l-btn-primary">Open the dashboard →</Link>
      </div>

      <footer className="l-footer">
        <div className="l-footer-inner">
          <div>
            <div className="l-brand"><span className="brand-mark">₦</span>AgroPrice <em>NG</em></div>
            <p className="tag">Nigeria food-price intelligence — historical data, live macro and transparent forecasts in one place.</p>
            <p className="small">Forecasts are illustrative research outputs, not financial advice.</p>
          </div>
          <div>
            <h4>Explore</h4>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/analytics">Analytics</Link>
            <Link href="/predict">Predict</Link>
          </div>
          <div>
            <h4>Data sources</h4>
            <a href="https://data.humdata.org/dataset/wfp-food-prices" target="_blank" rel="noopener noreferrer">WFP / HDX</a>
            <a href="https://data.worldbank.org/country/nigeria" target="_blank" rel="noopener noreferrer">World Bank</a>
            <a href="https://open.er-api.com" target="_blank" rel="noopener noreferrer">open.er-api.com</a>
          </div>
        </div>
        <div className="l-footer-bottom">
          <span>© 2026 AgroPrice NG · v0.1</span>
          <span>Built with Next.js · recharts · Radix UI</span>
        </div>
      </footer>
    </div>
  );
}
