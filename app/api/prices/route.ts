import { NextResponse } from "next/server";
import { readPrices } from "@/lib/prices";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const commodity = params.get("commodity")?.toLowerCase();
  const state = params.get("state")?.toLowerCase();
  const source = params.get("source")?.toLowerCase();
  const rows = await readPrices();
  const filtered = rows.filter((row) =>
    (!commodity || row.commodity.toLowerCase().includes(commodity)) &&
    (!state || row.state.toLowerCase() === state) && (!source || row.source.toLowerCase() === source)
  );
  return NextResponse.json({ data: filtered, count: filtered.length, source: "wfp_hdx" });
}
