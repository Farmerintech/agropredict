"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import AppShell from "@/components/AppShell";

type Row = { price_naira: string; observation_date: string };

export default function Analytics() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    fetch("/api/prices?source=wfp_hdx")
      .then((r) => r.json())
      .then((d) => setRows(d.data || []));
  }, []);
  const data = useMemo(() => {
    const m = new Map<string, { sum: number; count: number }>();
    rows.forEach((r) => {
      const x = m.get(r.observation_date) || { sum: 0, count: 0 };
      x.sum += Number(r.price_naira);
      x.count++;
      m.set(r.observation_date, x);
    });
    return [...m].sort(([a], [b]) => a.localeCompare(b)).slice(-24).map(([date, x]) => ({ date, price: Math.round(x.sum / x.count) }));
  }, [rows]);
  return (
    <AppShell title="Analytics" status={<span className="status"><i /> WFP / HDX connected</span>}>
      <section className="intro">
            <p className="eyebrow">ANALYTICS</p>
            <h1>Market movement over time.</h1>
            <p className="lede">National average price observations from the connected WFP / HDX source.</p>
          </section>
          <section className="workspace">
            <div className="workspace-head">
              <div>
                <h2>Average price trend</h2>
                <p>Last 24 available months · all commodities</p>
              </div>
              <div className="workspace-actions">
                <Link href="/dashboard?source=wfp_hdx" className="data-link">← Back to source data</Link>
                <span className="source-pill">WFP · HDX</span>
              </div>
            </div>
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
        </section>
    </AppShell>
  );
}
