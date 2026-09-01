import { NextResponse } from "next/server";
import { getMacroSnapshot } from "@/lib/macro";

export async function GET() {
  const data = await getMacroSnapshot();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=1800" },
  });
}
