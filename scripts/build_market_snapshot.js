// Regenerates the agrocast market snapshot from the agro-price WFP / HDX CSV.
//
// This script is the single source of truth for both outputs, and it is mirrored
// in the agropredict repo where the refresh Action runs it — keep the two copies
// identical if you edit it.
//
//   # bundle for the app (default; writes src/marketSnapshot.ts)
//   node scripts/build_market_snapshot.js
//
//   # hosted JSON consumed by the app's runtime sync (agropredict Action)
//   node scripts/build_market_snapshot.js --emit json \
//       --csv <path to wfp_nigeria_normalized.csv> --out <path>
//
// The raw file records each market's price against a *local measure* whose label
// carries a container multiplier (e.g. "2.5 KG" = price per ~2.5 kg bowl,
// "100 KG" = per 100 kg bag, "400 G" = per 400 g pack). Mixing those measures
// into one monthly mean would produce fake price jumps as markets switch units,
// so this script:
//   1. resolves every row to a canonical basis — price per kg (KG & G measures)
//      or per litre (L measures) — by dividing out the label multiplier;
//   2. keeps, per commodity, the single most common basis (weight wins for
//      commodities that mix weight with tubers/pieces);
//   3. aggregates each kept row into a monthly national mean;
//   4. keeps only series surveyed within MAX_STALE_MONTHS of the newest month,
//      and drops trailing months that are still in progress (few markets).

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  if (i === -1) return null;
  const value = args[i + 1];
  return value === undefined ? '' : value;
}
const has = (name) => args.includes(name);

const CSV = flag('--csv') ?? path.resolve(__dirname, '..', '..', 'agro-price', 'data', 'wfp_nigeria_normalized.csv');
const OUT = flag('--out') ?? path.resolve(__dirname, '..', 'src', 'marketSnapshot.ts');
const EMIT = has('--emit') ? flag('--emit') ?? 'ts' : 'ts';

const MONTHS = 60; // history window embedded per commodity
// Only keep series surveyed within 12 months of the newest observation anywhere
// in the file — a survey that stopped long ago is not forecastable (the model
// would bridge a meaningless multi-year gap).
const MAX_STALE_MONTHS = 12;

function monthSpan(fromYm, toYm) {
  const [fy, fm] = fromYm.split('-').map(Number);
  const [ty, tm] = toYm.split('-').map(Number);
  return ty * 12 + tm - (fy * 12 + fm);
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ',' && !inQuotes) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// -> { basis: 'kg'|'litre'|'count', per: number|null, label: string }
// per = divisor that converts the row price to the canonical unit.
function resolveUnit(unit) {
  const raw = (unit || '').trim();
  const upper = raw.toUpperCase();
  const m = upper.match(/^([\d.]+)?\s*(KG|G|L|PCS|PIECES|TUBERS|UNIT|SACK)$/);
  if (!m) return null;
  const num = m[1] ? Number(m[1]) : null;
  const kind = m[2];
  if (kind === 'KG') return { basis: 'kg', per: num && num > 0 ? num : 1, label: 'kg' };
  if (kind === 'G') return { basis: 'kg', per: (num && num > 0 ? num : 1) / 1000, label: 'kg' };
  if (kind === 'L') return { basis: 'litre', per: num && num > 0 ? num : 1, label: 'L' };
  // Counts (eggs "30 pcs", yam "100 Tubers", bread "Unit") cannot be converted to
  // weight; they only mix with each other.
  return { basis: 'count', per: 1, label: raw || 'unit' };
}

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** -> { commodities: { name: { unit, months } }, referenceMonth } */
function aggregate(lines) {
  // commodity -> { basisTotals, rows: [{ basis, per, price, date }] }
  const perCommodity = new Map();
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const r = splitCsvLine(line);
    if (r.length < 6) continue;
    const commodity = r[0].trim();
    const price = Number(r[3]);
    const unit = r[4];
    const date = (r[5] || '').trim();
    if (!commodity || !Number.isFinite(price) || price <= 0 || !date) continue;
    const resolved = resolveUnit(unit);
    if (!resolved) continue;
    const entry = perCommodity.get(commodity) || { basisTotals: { kg: 0, litre: 0, count: 0 }, rows: [] };
    entry.basisTotals[resolved.basis] += 1;
    entry.rows.push({ basis: resolved.basis, per: resolved.per, price, date, label: resolved.label });
    perCommodity.set(commodity, entry);
  }

  const snapshot = {};
  for (const [commodity, { basisTotals, rows }] of perCommodity) {
    const basis = Object.entries(basisTotals).sort((a, b) => b[1] - a[1])[0][0];
    const kept = rows.filter((row) => row.basis === basis);
    const unitLabel = basis === 'kg' ? 'kg' : basis === 'litre' ? 'L' : null;
    // Most common count label for display ("30 pcs", "unit", ...).
    let countLabel = unitLabel;
    if (basis === 'count') {
      const tally = new Map();
      for (const row of kept) tally.set(row.label, (tally.get(row.label) || 0) + 1);
      countLabel = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }

    const byMonth = new Map();
    let lastMonth = '';
    for (const row of kept) {
      const key = row.date.slice(0, 7);
      if (key > lastMonth) lastMonth = key;
      const cur = byMonth.get(key) || { sum: 0, count: 0 };
      cur.sum += row.price / row.per;
      cur.count += 1;
      byMonth.set(key, cur);
    }
    const monthsAll = [...byMonth.entries()]
      .map(([date, { sum, count }]) => ({ date, price: Math.round((sum / count) * 100) / 100, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Trim trailing months that are clearly still in progress: a survey month
    // with only a handful of reporting markets can read as a price crash/spike
    // (e.g. one market covering 2026-07 when the norm is 15+). Drop the last
    // month whenever it has under half the median coverage of the prior ~6.
    while (monthsAll.length >= 12) {
      const last = monthsAll[monthsAll.length - 1];
      const prior = monthsAll.slice(-7, -1).map((m) => m.count);
      if (last.count < 0.5 * median(prior)) monthsAll.pop();
      else break;
    }
    const months = monthsAll.map(({ date, price }) => ({ date, price })).slice(-MONTHS);
    if (months.length) snapshot[commodity] = { unit: countLabel, months, lastMonth };
  }

  // Drop surveys that stopped too long before the newest data anywhere.
  const referenceMonth = [...Object.values(snapshot)]
    .map((s) => s.lastMonth)
    .sort()
    .pop() ?? '';
  for (const name of Object.keys(snapshot)) {
    if (monthSpan(snapshot[name].lastMonth, referenceMonth) > MAX_STALE_MONTHS) delete snapshot[name];
  }

  const commodities = {};
  for (const [name, { unit, months }] of Object.entries(snapshot)) commodities[name] = { unit, months };
  return { commodities, referenceMonth };
}

function main() {
  const lines = fs.readFileSync(CSV, 'utf8').split('\n');
  const { commodities, referenceMonth } = aggregate(lines);
  const names = Object.keys(commodities).sort((a, b) => a.localeCompare(b));

  if (EMIT === 'json') {
    const payload = { date: referenceMonth, commodities };
    const text = `${JSON.stringify(payload)}\n`;
    if (flag('--out') == null || args.includes('--stdout')) {
      process.stdout.write(text);
    } else {
      fs.writeFileSync(OUT, text);
    }
    console.log(`JSON snapshot: ${names.length} commodities, data through ${referenceMonth}${flag('--out') != null ? ` → ${OUT}` : ''}`);
    return;
  }

  const body = names
    .map((name) => {
      const { unit, months } = commodities[name];
      const points = months.map((m) => `{ date: '${m.date}', price: ${m.price} }`).join(', ');
      return `  '${name}': { unit: '${unit}', months: [${points}] },`;
    })
    .join('\n');

  const out = `// AUTO-GENERATED by scripts/build_market_snapshot.js — do not edit by hand.
// Regenerate after refreshing the agro-price WFP/HDX CSV:
//   node scripts/build_market_snapshot.js
// Monthly national means (naira) from ${CSV.split(path.sep).slice(-3).join(path.sep)}.
// Weights are normalized to a single unit per commodity (see script header).

export type MarketCommodity = {
  unit: string;
  months: { date: string; price: number }[];
};

export const marketSnapshotDate = '${referenceMonth}';

export const marketSnapshot: Record<string, MarketCommodity> = {
${body}
};
`;
  fs.writeFileSync(OUT, out);
  const sizeKb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`Wrote ${OUT}`);
  console.log(`${names.length} commodities, data up to ${referenceMonth}, ${sizeKb} KB`);
  names.forEach((name) => {
    const months = commodities[name].months;
    const last = months.slice(-3).map((m) => `${m.date}:${m.price}`).join('  ');
    console.log(`  ${name} [${commodities[name].unit}] last=${last}`);
  });
}

main();
