import type { Abortable, AggregateOptions, Document } from "mongodb";
import type { BinaryDigit, Prettify } from "./types.common";
import type { PropertyType } from "./types.filter";
import type {
  AllFilterKeys,
  AllProjKeys,
  ProjectionFromExclusionKeys,
  ProjectionFromInclusionKeys,
} from "./types.query";
import type { NoExpandType } from "./types.schema";

export type AggregateQueryOptions = AggregateOptions & Abortable;

export type AggregateFieldPath<T> = `$${Extract<AllFilterKeys<T>, string>}`;

export type AggregateExpression<T> =
  | AggregateFieldPath<T>
  | NoExpandType
  | readonly AggregateExpression<T>[]
  | { [K: string]: AggregateExpression<T> };

/** turns aggregation expression into its TypeScript return type */
export type ResolveAggregateExpression<T, Expr> = Expr extends `$${infer Path}`
  ? Path extends Extract<AllFilterKeys<T>, string>
    ? PropertyType<T, Path>
    : unknown
  : Expr extends NoExpandType
    ? Expr
    : Expr extends readonly (infer U)[]
      ? ResolveAggregateExpression<T, U>[]
      : Expr extends object
        ? { [K in keyof Expr]: ResolveAggregateExpression<T, Expr[K]> }
        : Expr;

export type GroupIdExpression<T> =
  | AggregateFieldPath<T>
  | null
  | (string & {})
  | number
  | boolean
  | readonly AggregateExpression<T>[]
  | { [K: string]: AggregateExpression<T> };

export type GroupAccumulator<T> =
  | { $sum: AggregateFieldPath<T> | number }
  | { $avg: AggregateFieldPath<T> | number }
  | { $count: Record<string, never> }
  | { $min: AggregateExpression<T> }
  | { $max: AggregateExpression<T> }
  | { $first: AggregateExpression<T> }
  | { $last: AggregateExpression<T> }
  | { $push: AggregateExpression<T> }
  | { $addToSet: AggregateExpression<T> }
  | { $top: { sortBy: Record<string, -1 | 1>; output: AggregateExpression<T> } }
  | { $topN: { n: number; sortBy: Record<string, -1 | 1>; output: AggregateExpression<T> } }
  | { $bottom: { sortBy: Record<string, -1 | 1>; output: AggregateExpression<T> } }
  | { $bottomN: { n: number; sortBy: Record<string, -1 | 1>; output: AggregateExpression<T> } }
  | { $percentile: { input: AggregateFieldPath<T>; p: number[]; method: "approximate" } }
  | { $median: { input: AggregateFieldPath<T>; method: "approximate" } }
  | { $stdDevPop: AggregateFieldPath<T> | number }
  | { $stdDevSamp: AggregateFieldPath<T> | number }
  | { $minN: { input: AggregateExpression<T>; n: number } }
  | { $maxN: { input: AggregateExpression<T>; n: number } }
  | { $firstN: { input: AggregateExpression<T>; n: number } }
  | { $lastN: { input: AggregateExpression<T>; n: number } }
  | { $concatArrays: AggregateExpression<T>[] }
  | { $mergeObjects: AggregateExpression<T> };

// let's see if these are sufficient enough first. will add more if people use it

type GroupAccumulatorResult<T, Acc> = Acc extends { $sum: unknown }
  ? number
  : Acc extends { $avg: unknown }
    ? number
    : Acc extends { $count: unknown }
      ? number
      : Acc extends { $min: infer Expr }
        ? ResolveAggregateExpression<T, Expr>
        : Acc extends { $max: infer Expr }
          ? ResolveAggregateExpression<T, Expr>
          : Acc extends { $first: infer Expr }
            ? ResolveAggregateExpression<T, Expr>
            : Acc extends { $last: infer Expr }
              ? ResolveAggregateExpression<T, Expr>
              : Acc extends { $push: infer Expr }
                ? ResolveAggregateExpression<T, Expr>[]
                : Acc extends { $addToSet: infer Expr }
                  ? ResolveAggregateExpression<T, Expr>[]
                  : Acc extends { $top: { output: infer Expr } }
                    ? ResolveAggregateExpression<T, Expr>
                    : Acc extends { $topN: { output: infer Expr } }
                      ? ResolveAggregateExpression<T, Expr>[]
                      : Acc extends { $bottom: { output: infer Expr } }
                        ? ResolveAggregateExpression<T, Expr>
                        : Acc extends { $bottomN: { output: infer Expr } }
                          ? ResolveAggregateExpression<T, Expr>[]
                          : Acc extends { $percentile: unknown }
                            ? number[]
                            : Acc extends { $median: unknown }
                              ? number
                              : Acc extends { $stdDevPop: unknown }
                                ? number
                                : Acc extends { $stdDevSamp: unknown }
                                  ? number
                                  : Acc extends { $minN: { input: infer Expr } }
                                    ? ResolveAggregateExpression<T, Expr>[]
                                    : Acc extends { $maxN: { input: infer Expr } }
                                      ? ResolveAggregateExpression<T, Expr>[]
                                      : Acc extends { $firstN: { input: infer Expr } }
                                        ? ResolveAggregateExpression<T, Expr>[]
                                        : Acc extends { $lastN: { input: infer Expr } }
                                          ? ResolveAggregateExpression<T, Expr>[]
                                          : Acc extends { $concatArrays: readonly (infer Expr)[] }
                                            ? ResolveAggregateExpression<T, Expr>
                                            : Acc extends { $mergeObjects: unknown }
                                              ? Record<string, unknown>
                                              : never;

export type GroupResult<
  T,
  Id extends GroupIdExpression<T>,
  Fields extends Record<string, GroupAccumulator<T>>,
> = Prettify<
  { _id: ResolveAggregateExpression<T, Id> } & {
    [K in keyof Fields]: GroupAccumulatorResult<T, Fields[K]>;
  }
>;

export type AggregateProjectValue<T> = BinaryDigit | AggregateExpression<T>;

type ProjectKeysByValue<Spec, Value extends BinaryDigit> = Extract<
  { [K in keyof Spec]: Spec[K] extends Value ? K : never }[keyof Spec],
  string
>;

type IncludedProjectKeys<T, Spec> = Extract<ProjectKeysByValue<Spec, 1>, AllProjKeys<T>>;
type ExcludedProjectKeys<T, Spec> = Extract<ProjectKeysByValue<Spec, 0>, AllProjKeys<T>>;

type ProjectComputedKeys<Spec> = Extract<
  { [K in keyof Spec]: Spec[K] extends BinaryDigit ? never : K }[keyof Spec],
  string
>;

type ProjectComputedResult<T, Spec> = {
  [K in ProjectComputedKeys<Spec>]: ResolveAggregateExpression<T, Spec[K]>;
};

type ProjectDefaultId<T, Spec> = "_id" extends keyof T
  ? "_id" extends ExcludedProjectKeys<T, Spec>
    ? Record<string, never>
    : Pick<T, "_id">
  : Record<string, never>;

type ProjectIncludedBase<T, Spec> = [IncludedProjectKeys<T, Spec>] extends [never]
  ? ProjectDefaultId<T, Spec>
  : "_id" extends ExcludedProjectKeys<T, Spec>
    ? Omit<ProjectionFromInclusionKeys<T, IncludedProjectKeys<T, Spec>>, "_id">
    : ProjectionFromInclusionKeys<T, IncludedProjectKeys<T, Spec>>;

type ProjectBase<T, Spec> = [IncludedProjectKeys<T, Spec> | ProjectComputedKeys<Spec>] extends [
  never,
]
  ? ProjectionFromExclusionKeys<T, ExcludedProjectKeys<T, Spec>>
  : ProjectIncludedBase<T, Spec>;

export type AggregateProjectSpec<T> = Record<string, AggregateProjectValue<T>>;

export type AggregateProjectResult<T, Spec extends AggregateProjectSpec<T>> = [
  keyof ProjectComputedResult<T, Spec>,
] extends [never]
  ? ProjectBase<T, Spec>
  : Prettify<
      Omit<ProjectBase<T, Spec>, keyof ProjectComputedResult<T, Spec>> &
        ProjectComputedResult<T, Spec>
    >;

export interface LookupFromModel<OT extends Document = Document> {
  getCollectionName(): string;
  $outType: OT;
}

type LookupModelOutput<Model> = Model extends { $outType: infer OT extends Document } ? OT : never;

export interface LookupOptions<
  Local extends Document,
  Model extends LookupFromModel,
  As extends string,
> {
  from: Model;
  localField: Extract<AllFilterKeys<Local>, string>;
  foreignField: Extract<AllFilterKeys<LookupModelOutput<Model>>, string>;
  as: As;
}

export type LookupResult<
  Local extends Document,
  Model extends LookupFromModel,
  As extends string,
> = Prettify<Local & { [K in As]: LookupModelOutput<Model>[] }>;

type UnwindArrayValue<Value> = Value extends readonly (infer U)[]
  ? U
  : Value extends (infer U)[]
    ? U
    : Value;

export interface UnwindOptions<IncludeIndex extends string | undefined = undefined> {
  preserveNullAndEmptyArrays?: boolean;
  includeArrayIndex?: IncludeIndex;
}

export type AggregateUnwindResult<
  Doc extends Document,
  Path extends Extract<AllFilterKeys<Doc>, string>,
  IncludeIndex extends string | undefined = undefined,
> = Prettify<
  Omit<Doc, Path> & { [K in Path]: UnwindArrayValue<Doc[K]> } & (IncludeIndex extends string
      ? { [K in IncludeIndex]: number | null }
      : object)
>;

export type AddFieldsStage<Doc extends Document> = Record<string, AggregateExpression<Doc>>;

export type AddFieldsResult<Doc extends Document, Added extends AddFieldsStage<Doc>> = Prettify<
  Omit<Doc, keyof Added> & { [K in keyof Added]: ResolveAggregateExpression<Doc, Added[K]> }
>;

export type CountResult<Name extends string> = {
  [K in Name]: number;
};
