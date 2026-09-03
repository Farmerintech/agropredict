import fs from "node:fs/promises";
import path from "node:path";

export type SnapshotCommodity = {
  unit: string;
  months: { date: string; price: number }[];
};
export type MarketSnapshot = {
  date: string;
  commodities: Record<string, SnapshotCommodity>;
};

/**
 * The same monthly snapshot the agrocast app predicts from, produced by
 * scripts/build_market_snapshot.js (unit-normalized per kg/litre, dominant
 * measure-class only, dead surveys >12 months and in-progress trailing months
 * dropped). Served by /api/snapshot so the web forecast mirrors the app.
 */
export async function readSnapshot(): Promise<MarketSnapshot> {
  const file = path.join(process.cwd(), "data", "agrocast-market.json");
  const text = await fs.readFile(file, "utf8");
  return JSON.parse(text) as MarketSnapshot;
}
