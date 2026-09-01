import { NextResponse } from "next/server";
import { readPrices } from "@/lib/prices";

export async function GET() {
  const rows = await readPrices();
  return NextResponse.json([...new Set(rows.map((row) => row.state).filter(Boolean))].sort());
}
