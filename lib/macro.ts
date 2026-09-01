export type SeriesPoint = { year: string; value: number | null };
export type MacroSnapshot = {
  inflation: SeriesPoint[];
  exchangeRate: SeriesPoint[];
  lendingRate: SeriesPoint[];
  currentFx: number | null;
  fetchedAt: string;
  errors: string[];
};

const WORLD_BANK_BASE = "https://api.worldbank.org/v2/country/NGA/indicator";
const INDICATORS = {
  inflation: "FP.CPI.TOTL.ZG",
  exchangeRate: "PA.NUS.FCRF",
  lendingRate: "FR.INR.LEND",
};

const WB_TTL = 24 * 60 * 60 * 1000; // annual series: refresh daily
const FX_TTL = 6 * 60 * 60 * 1000; // daily FX: refresh every 6h

const FETCH_TIMEOUT_MS = 20000;
const FETCH_ATTEMPTS = 3;

const cache = new Map<string, { ts: number; value: unknown }>();

async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < ttl) return hit.value as T;
  const value = await load();
  cache.set(key, { ts: Date.now(), value });
  return value;
}

async function fetchWithRetry(url: string, attempts = FETCH_ATTEMPTS): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastError;
}

async function fetchWorldBankSeries(indicator: string): Promise<SeriesPoint[]> {
  const res = await fetchWithRetry(`${WORLD_BANK_BASE}/${indicator}?format=json&per_page=12`);
  if (!res.ok) throw new Error(`World Bank ${indicator}: HTTP ${res.status}`);
  const json = await res.json();
  const rows = Array.isArray(json[1]) ? json[1] : [];
  // World Bank returns newest-first; keep that order.
  return rows.map((r: { date: string; value: number | null }) => ({ year: String(r.date), value: r.value ?? null }));
}

export async function getMacroSnapshot(): Promise<MacroSnapshot> {
  const errors: string[] = [];
  const loadSeries = async (key: keyof typeof INDICATORS) => {
    try {
      return await cached(`wb:${key}`, WB_TTL, () => fetchWorldBankSeries(INDICATORS[key]));
    } catch (e) {
      errors.push(`World Bank ${INDICATORS[key]}: ${e instanceof Error ? e.message : String(e)}`);
      return [] as SeriesPoint[];
    }
  };
  const [inflation, exchangeRate, lendingRate] = await Promise.all([
    loadSeries("inflation"),
    loadSeries("exchangeRate"),
    loadSeries("lendingRate"),
  ]);

  let currentFx: number | null = null;
  try {
    currentFx = await cached("fx:ngn", FX_TTL, async () => {
      const res = await fetchWithRetry("https://open.er-api.com/v6/latest/USD");
      if (!res.ok) throw new Error(`open.er-api: HTTP ${res.status}`);
      const json = await res.json();
      const ngn = json?.rates?.NGN;
      if (typeof ngn !== "number") throw new Error("open.er-api: NGN rate missing");
      return ngn;
    });
  } catch (e) {
    errors.push(`open.er-api: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { inflation, exchangeRate, lendingRate, currentFx, fetchedAt: new Date().toISOString(), errors };
}
