import { NextResponse } from "next/server";
import { readSnapshot } from "@/lib/snapshot";

// The cleaned monthly snapshot (data/agrocast-market.json) — the single source
// of truth for forecasts, shared with the agrocast app. Serving it here means
// the web /predict mirrors the app exactly instead of re-aggregating the raw
// unit-mixed CSV.
export async function GET() {
  const snapshot = await readSnapshot();
  return NextResponse.json(snapshot);
}
