/**
 * Golden corpus loader.
 *
 * The corpus files under `../data/*.json.gz` are the recorded output of the
 * upstream Python engine (`kentang2017/kinqimen`), produced by
 * `scripts/gen-corpus.py`. They are the compatibility target: the TypeScript
 * port is correct exactly insofar as it reproduces them.
 *
 * This package is test-only and is never loaded at runtime by the MCP server.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "data");

export type StageName = "calendar" | "ju" | "hour" | "minute" | "golden" | "patterns";

/** `[year, month, day, hour, minute]`, exactly as upstream was called. */
export type CorpusInput = [number, number, number, number, number];

export interface CorpusFile<Case> {
  generatedBy: string;
  upstream: string;
  stage: StageName;
  count: number;
  cases: Case[];
}

export interface CalendarCase {
  input: CorpusInput;
  ganzhi: [string, string, string, string, string];
  jieqi: string;
  jieqiStart: [number, number, number, number, number];
  jieqiStartName: string;
  lunar: { year: number; monthName: string; month: number; day: number };
  error?: string;
}

export interface JuCase {
  input: CorpusInput;
  chaibu: string;
  zhirun: string;
  ke: string;
  raw: {
    jieqi: string;
    daysFromJieqi: number;
    sanyuan: string;
    zhifuStem: string;
    jieqiJu: string;
    yinyang: string;
    current: string;
    chaoshen: string;
    other: string;
    other1: string;
  };
  error?: string;
}

/** Charts are compared structurally against upstream's raw Chinese-keyed dicts. */
export interface ChartCase {
  input: CorpusInput;
  chaibu: Record<string, unknown>;
  zhirun: Record<string, unknown>;
}

export interface GoldenCase {
  input: CorpusInput;
  gpan: Record<string, unknown>;
  error?: string;
}

export interface PatternCase {
  input: CorpusInput;
  chaibu: Record<string, Record<string, string>>;
  zhirun: Record<string, Record<string, string>>;
}

const cache = new Map<StageName, unknown>();

export function loadStage<Case>(stage: StageName): CorpusFile<Case> {
  const hit = cache.get(stage);
  if (hit) return hit as CorpusFile<Case>;
  const raw = gunzipSync(readFileSync(join(DATA_DIR, `${stage}.json.gz`))).toString("utf8");
  const parsed = JSON.parse(raw) as CorpusFile<Case>;
  cache.set(stage, parsed);
  return parsed;
}

export const loadCalendar = () => loadStage<CalendarCase>("calendar");
export const loadJu = () => loadStage<JuCase>("ju");
export const loadHour = () => loadStage<ChartCase>("hour");
export const loadMinute = () => loadStage<ChartCase>("minute");
export const loadGolden = () => loadStage<GoldenCase>("golden");
export const loadPatterns = () => loadStage<PatternCase>("patterns");

/**
 * The date from which upstream's hour resolution stops being trustworthy.
 *
 * Upstream routes the query hour through `ephem.Date`, whose float64 day number
 * loses its last bit of precision this far from its 1899 epoch: from 2079-06-06
 * onwards `ephem.Date("…/… 05:00:00")` reads back as `04:59:59.999999`, and
 * upstream truncates that to hour 4. The hour branch, hour pillar, 值符 and
 * ultimately the whole chart shift by one position.
 *
 * This port reads the requested hour directly, so it disagrees with upstream
 * for those dates *on purpose*. `deviations.spec.ts` pins the disagreement to
 * exactly this cause; the parity suites skip past it.
 */
export const EPHEM_PRECISION_BREAKDOWN = { year: 2079, month: 6, day: 6 } as const;

/** True when upstream's own output for this input is free of the ephem hour bug. */
export function upstreamHourIsSound(input: CorpusInput): boolean {
  const [y, m, d] = input;
  const b = EPHEM_PRECISION_BREAKDOWN;
  return y < b.year || (y === b.year && (m < b.month || (m === b.month && d < b.day)));
}

/** Turn a corpus input tuple into the shape the engine takes. */
export function toCivil(input: CorpusInput) {
  return { year: input[0], month: input[1], day: input[2], hour: input[3], minute: input[4] };
}

/** Human-readable label for test failure messages. */
export function label(input: CorpusInput): string {
  const [y, m, d, h, mi] = input;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")} ${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}
