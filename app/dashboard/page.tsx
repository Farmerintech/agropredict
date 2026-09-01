"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import FilterSelect from "@/components/FilterSelect";

type Row = {
  commodity: string;
  state: string;
  market: string;
  price_naira: string;
  unit: string;
  observation_date: string;
};

const SOURCE_LABELS: Record<string, string> = { wfp_hdx: "WFP / HDX" };
const SOURCE_PILLS: Record<string, string> = { wfp_hdx: "WFP · HDX" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const PAGE_SIZE = 10;

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeView />
    </Suspense>
  );
}

function HomeView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [commodity, setCommodity] = useState("");
  const [state, setState] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [page, setPage] = useState(1);
  const searchParams = useSearchParams();
  const source = searchParams.get("source");
  const sourceLabel = (source && SOURCE_LABELS[source]) || "WFP / HDX";
  const sourcePill = (source && SOURCE_PILLS[source]) || "WFP · HDX";

  useEffect(() => {
    const query = source ? `?source=${encodeURIComponent(source)}` : "";
    fetch(`/api/prices${query}`)
      .then((r) => r.json())
      .then((d) => setRows((d.data || []).slice().sort((a: Row, b: Row) => b.observation_date.localeCompare(a.observation_date))));
  }, [source]);

  useEffect(() => {
    setPage(1);
  }, [q, commodity, state, month, year, source]);

  const commodities = useMemo(() => [...new Set(rows.map((r) => r.commodity).filter(Boolean))].sort(), [rows]);
  const states = useMemo(() => [...new Set(rows.map((r) => r.state).filter(Boolean))].sort(), [rows]);
  const years = useMemo(
    () => [...new Set(rows.map((r) => r.observation_date.slice(0, 4)).filter(Boolean))].sort().reverse(),
    [rows]
  );
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const date = r.observation_date;
        return (
          (!q || `${r.commodity} ${r.market} ${r.state}`.toLowerCase().includes(q.toLowerCase())) &&
          (!commodity || r.commodity === commodity) &&
          (!state || r.state === state) &&
          (!month || date.slice(5, 7) === month.padStart(2, "0")) &&
          (!year || date.slice(0, 4) === year)
        );
      }),
    [rows, q, commodity, state, month, year]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <AppShell title="Dashboard" status={<span className="status"><i /> {sourceLabel} connected</span>}>
      <section className="intro">
            <p className="eyebrow">MARKET INTELLIGENCE</p>
            <h1>Food prices, clearly mapped.</h1>
            <p className="lede">Explore historical staple prices across Nigerian markets with transparent, source-attributed observations.</p>
          </section>
          <section className="workspace">
            <div className="workspace-head">
              <div>
                <h2>Price observations</h2>
                <p>{filtered.length.toLocaleString()} matching records</p>
              </div>
              <span className="source-pill">{sourcePill}</span>
            </div>
            <div className="filters">
              <div className="search-wrap">
                <span>⌕</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search commodity, state or market" />
              </div>
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
              <FilterSelect
                value={month}
                onValueChange={setMonth}
                options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
                allLabel="All months"
                placeholder="All months"
              />
              <FilterSelect
                value={year}
                onValueChange={setYear}
                options={years.map((y) => ({ value: y, label: y }))}
                allLabel="All years"
                placeholder="All years"
              />
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>{["Date", "Commodity", "State", "Market", "Price", "Unit"].map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {pageRows.map((r, i) => (
                    <tr key={(safePage - 1) * PAGE_SIZE + i}>
                      <td data-label="Date" className="date">{r.observation_date}</td>
                      <td data-label="Commodity" className="commodity">{r.commodity}</td>
                      <td data-label="State">{r.state || "—"}</td>
                      <td data-label="Market">{r.market || "—"}</td>
                      <td data-label="Price" className="price">₦{Number(r.price_naira).toLocaleString()}</td>
                      <td data-label="Unit">{r.unit || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span className="page-info">Showing {start.toLocaleString()}–{end.toLocaleString()} of {filtered.length.toLocaleString()} records</span>
              <div className="page-buttons">
                <button className="page-btn" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>← Prev</button>
                <span className="page-now">Page {safePage.toLocaleString()} of {totalPages.toLocaleString()}</span>
                <button className="page-btn" disabled={safePage === totalPages} onClick={() => setPage(safePage + 1)}>Next →</button>
              </div>
            </div>
          </section>
          <footer>Source: World Food Programme Price Database via HDX · Original units retained.</footer>
    </AppShell>
  );
}
