/**
 * Compile-time drift guard between the output schemas and the core result types.
 *
 * There is no runtime code here — only type-level assertions. Rename a field in
 * `@cka4913/qimen-core`, change its type, add one, or drop one, and `tsc` fails in
 * this file rather than the mismatch reaching a client as a runtime output
 * validation error.
 *
 * The check is *mutual assignability* rather than strict identity: strict
 * identity trips over harmless differences in how optionality is spelled, which
 * would make the guard noisy enough that someone eventually deletes it. Mutual
 * assignability still catches every renamed, added, removed or retyped field,
 * which is what actually drifts.
 */
import type { z } from "zod";
import type { GoldenMirrorChart, KeChart, QimenChart, SearchResult, SixwuPath, ZhirunRaw } from "@cka4913/qimen-core";
import type {
  goldenMirrorChartSchema,
  keChartSchema,
  qimenChartSchema,
  searchResultSchema,
  sixwuResultSchema,
  zhirunRawSchema,
} from "./output-schemas.js";

/** Fails to compile unless `A` and `B` accept each other. */
type MutuallyAssignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** `Assert<...>` only accepts `true`, so a mismatch is a compile error. */
type Assert<T extends true> = T;

type _Chart = Assert<MutuallyAssignable<z.infer<typeof qimenChartSchema>, QimenChart>>;
type _Ke = Assert<MutuallyAssignable<z.infer<typeof keChartSchema>, KeChart>>;
type _Golden = Assert<MutuallyAssignable<z.infer<typeof goldenMirrorChartSchema>, GoldenMirrorChart>>;
type _Zhirun = Assert<MutuallyAssignable<z.infer<typeof zhirunRawSchema>, ZhirunRaw>>;
type _Sixwu = Assert<MutuallyAssignable<z.infer<typeof sixwuResultSchema>, SixwuPath>>;
type _Search = Assert<MutuallyAssignable<z.infer<typeof searchResultSchema>, SearchResult>>;

// Referencing the aliases keeps them from being elided as unused.
export type OutputSchemaChecks = [_Chart, _Ke, _Golden, _Zhirun, _Sixwu, _Search];
