"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import AppShell from "@/components/AppShell";
import FilterSelect from "@/components/FilterSelect";

type Row = { commodity: string; state: string; price_naira: string; observation_date: string };

export default function Analytics() {
  const [rows, setRows] = useState<Row[]>([]);
  const [commodity, setCommodity] = useState("");
  const [state, setState] = useState("");
  useEffect(() => {
    fetch("/api/prices?source=wfp_hdx")
      .then((r) => r.json())
      .then((d) => setRows(d.data || []));
  }, []);
  const commodities = useMemo(() => [...new Set(rows.map((r) => r.commodity).filter(Boolean))].sort(), [rows]);
  const states = useMemo(() => [...new Set(rows.map((r) => r.state).filter(Boolean))].sort(), [rows]);
  const scoped = useMemo(
    () => rows.filter((r) => (!commodity || r.commodity === commodity) && (!state || r.state === state)),
    [rows, commodity, state]
  );
  const data = useMemo(() => {
    const m = new Map<string, { sum: number; count: number }>();
    scoped.forEach((r) => {
      const x = m.get(r.observation_date) || { sum: 0, count: 0 };
      x.sum += Number(r.price_naira);
      x.count++;
      m.set(r.observation_date, x);
    });
    return [...m].sort(([a], [b]) => a.localeCompare(b)).slice(-24).map(([date, x]) => ({ date, price: Math.round(x.sum / x.count) }));
  }, [scoped]);
  const scopeLabel = [commodity || "all commodities", state || "all states"].join(" · ");
  return (
    <AppShell title="Analytics" status={<span className="status"><i /> WFP / HDX connected</span>}>
      <section className="intro">
            <p className="eyebrow">ANALYTICS</p>
            <h1>Market movement over time.</h1>
            <p className="lede">Average price observations from the connected WFP / HDX source, filterable by commodity and state.</p>
          </section>
          <section className="workspace">
            <div className="workspace-head">
              <div>
                <h2>Average price trend</h2>
                <p>Last 24 available months · {scopeLabel}</p>
              </div>
              <div className="workspace-actions">
                <Link href="/dashboard?source=wfp_hdx" className="data-link">← Back to source data</Link>
                <span className="source-pill">WFP · HDX</span>
              </div>
            </div>
            <div className="filters">
              <FilterSelect
                value={commodity}
                onValueChange={setCommodity}
                options={commodities.map((c) => ({ value: c, label: c }))}
                allLabel="All commodities"
                placeholder="All commodities"
              />
              <FilterSelect
                value={state}
                onValueChange={setState}
                options={states.map((s) => ({ value: s, label: s }))}
                allLabel="All states"
                placeholder="All states"
              />
            </div>
            {data.length === 0 ? (
              <div className="chart chart-empty">
                <p className="empty-note">No observations for {scopeLabel}.</p>
              </div>
            ) : (
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8eee8" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => [`₦${v.toLocaleString()}`, "Average price"]} />
                    <Line type="monotone" dataKey="price" stroke="#1d6b46" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
        </section>
    </AppShell>
  );
}
