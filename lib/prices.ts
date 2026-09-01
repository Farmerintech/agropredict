import fs from "node:fs/promises";
import path from "node:path";

export type PriceObservation = {
  commodity: string;
  state: string;
  market: string;
  price_naira: string;
  unit: string;
  observation_date: string;
  source: string;
};

export async function readPrices(): Promise<PriceObservation[]> {
  const file = path.join(process.cwd(), "data", "wfp_nigeria_normalized.csv");
  const text = await fs.readFile(file, "utf8");
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const fields = parseCsvLine(header);
  return lines.filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(fields.map((field, index) => [field, values[index] ?? ""])) as PriceObservation;
  });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value); value = ""; }
    else value += char;
  }
  values.push(value);
  return values;
}
