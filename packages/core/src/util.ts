import { QimenError } from "./errors.js";

/**
 * `config.new_list` — rotate `list` so that it starts at `item`.
 *
 * Upstream relies on the `ValueError` this raises when `item` is absent: several
 * branches in `pan_sky` are reached only through that exception. The port keeps
 * the throw and handles it explicitly at those sites, so a genuine table miss
 * still surfaces instead of silently producing a wrong plate.
 */
export function rotate<T>(list: readonly T[], item: T): T[] {
  const i = list.indexOf(item);
  if (i < 0) throw new QimenError("TABLE_LOOKUP_FAILED", `${String(item)} is not in list`, { list });
  return [...list.slice(i), ...list.slice(0, i)];
}

/** Same as `rotate` but returns `null` instead of throwing — for the sites that catch. */
export function tryRotate<T>(list: readonly T[], item: T): T[] | null {
  return list.includes(item) ? rotate(list, item) : null;
}

/** `config.new_list_r` — rotate anticlockwise: start at `item` and walk backwards. */
export function rotateReverse<T>(list: readonly T[], item: T): T[] {
  const start = list.indexOf(item);
  if (start < 0) throw new QimenError("TABLE_LOOKUP_FAILED", `${String(item)} is not in list`, { list });
  const n = list.length;
  const out: T[] = [];
  for (let i = 0; i < n; i++) {
    out.push(list[(((start - i) % n) + n) % n] as T);
  }
  return out;
}

/**
 * `config.multi_key_dict_get` — a dict whose keys are *groups* of keys.
 * Returns `undefined` on a miss, exactly like the Python original.
 */
export function multiKeyGet<V>(table: ReadonlyArray<readonly [readonly string[], V]>, key: string): V | undefined {
  for (const [keys, value] of table) {
    if (keys.includes(key)) return value;
  }
  return undefined;
}

/** Pair up two equal-length lists into a record, `dict(zip(a, b))`. */
export function zipRecord<V>(keys: readonly string[], values: readonly V[]): Record<string, V> {
  const out: Record<string, V> = {};
  const n = Math.min(keys.length, values.length);
  for (let i = 0; i < n; i++) out[keys[i] as string] = values[i] as V;
  return out;
}

/** Invert a record; later keys win on collision, as `dict(zip(values, keys))` does. */
export function invertRecord<V extends string>(record: Record<string, V>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(record)) out[v] = k;
  return out;
}

/**
 * Freeze an object and everything reachable from it.
 *
 * Every result this engine hands out is frozen. That is not tidiness: the
 * memoised derivations below are shared between callers, so a caller that
 * mutated one would poison the cache and change *other* callers' charts — the
 * exact opposite of the determinism the engine promises. Freezing turns that
 * into an immediate `TypeError` at the mutation site instead of a wrong chart
 * somewhere else later.
 *
 * Callers who want to modify a result should copy it first.
 */
export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

/**
 * Cache a pure function on a string key, bounded so a long-running server
 * cannot grow one without limit.
 *
 * Everything in this engine is a pure function of (datetime, school), and the
 * derivations stack deeply — a chart asks for its bureau eight times over, and
 * each ask would otherwise walk the solar-term table again. Memoising the few
 * primitives at the bottom turns that from quadratic re-derivation into one
 * pass. Purity is what makes this safe: same key, same answer, forever — and
 * `deepFreeze` is what keeps it true once the value has left the function.
 */
export function memoize<Args extends unknown[], R>(
  keyOf: (...args: Args) => string,
  fn: (...args: Args) => R,
  limit = 4096
): (...args: Args) => R {
  const cache = new Map<string, R>();
  return (...args: Args): R => {
    const key = keyOf(...args);
    const hit = cache.get(key);
    if (hit !== undefined || cache.has(key)) return hit as R;
    const value = deepFreeze(fn(...args));
    if (cache.size >= limit) {
      // Cheapest useful eviction: drop the oldest insertion.
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
    cache.set(key, value);
    return value;
  };
}

/** Split a string into fixed-width chunks — the `re.findall("..", s)` idiom. */
export function chunk(s: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + size <= s.length; i += size) out.push(s.slice(i, i + size));
  return out;
}

/** `[list[i:i+n] for i in range(0, len(list), n)]` */
export function splitList<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
