import type { SortDirection } from "mongodb";
import type { BinaryDigit, Prettify, UnionToIntersection } from "./types.common";
import type { NoExpandType } from "./types.schema";

type MaxDepth = 6;
type Depth = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type DepthInc = [1, 2, 3, 4, 5, 6, 6];

/**
 * Generate typed keys for a given object
 */
export type DotSeparatedKeys<
  T,
  IncProjKey extends boolean = false,
  Path extends string = "",
  D extends Depth = 0,
> = D extends MaxDepth
  ? Path
  : T extends NoExpandType
    ? Path
    : T extends (infer E)[]
      ? E extends NoExpandType
        ? Path
        :
            | (Path extends "" ? never : Path)
            | `${Path}.${number}`
            | `${Path}.${number}.${DotSeparatedKeys<E, IncProjKey, "", DepthInc[D]>}`
            | (IncProjKey extends true
                ? `${Path}.$` | `${Path}.$.${DotSeparatedKeys<E, IncProjKey, "", DepthInc[D]>}`
                : never)
            | DotSeparatedKeys<E, IncProjKey, Path, DepthInc[D]>
      : T extends object
        ?
            | (Path extends "" ? never : Path)
            | {
                [K in keyof T & string]: DotSeparatedKeys<
                  T[K],
                  IncProjKey,
                  Path extends "" ? K : K extends "" ? Path : `${Path}.${K}`,
                  DepthInc[D]
                >;
              }[keyof T & string]
        : Path;

export type SanitizedSortDirection = Exclude<SortDirection, { readonly $meta: string }>;
export type SchemaSort<T> = DotSeparatedKeys<T> extends string
  ?
      | DotSeparatedKeys<T>
      | Partial<Record<DotSeparatedKeys<T>, SanitizedSortDirection>>
      | ReadonlyArray<DotSeparatedKeys<T>>
      | ReadonlyArray<[DotSeparatedKeys<T>, SanitizedSortDirection]>
      | [DotSeparatedKeys<T>, SanitizedSortDirection]
  : never;

type Head<Path> = Path extends `${infer H}.${string}` ? H : Path;
type Tail<Path> = Path extends `${string}.${infer T}`
  ? T extends `${number}.${infer TT}`
    ? TT
    : T
  : never;

type IsOptional<T, K extends keyof T> = object extends Pick<T, K> ? true : false;

type AllFilterKeysBase<T> = keyof T | DotSeparatedKeys<T>;
type AllProjKeysBase<T> = keyof T | DotSeparatedKeys<T, true>;

type StripTrailingDots<K> = K extends `${string}.` ? never : K;

export type AllFilterKeys<T> = StripTrailingDots<AllFilterKeysBase<T>>;
export type AllProjKeys<T> = StripTrailingDots<AllProjKeysBase<T>>;

type ProjectIncBase<T, Path extends string> = Head<Path> extends keyof T
  ? Tail<Path> extends never
    ? Prettify<Pick<T, Head<Path>>>
    : NonNullable<T[Head<Path>]> extends (infer U)[]
      ? IsOptional<T, Head<Path>> extends true
        ? { [K in Head<Path>]?: ProjectIncBase<U, Tail<Path>>[] }
        : { [K in Head<Path>]: ProjectIncBase<U, Tail<Path>>[] }
      : NonNullable<T[Head<Path>]> extends object
        ? IsOptional<T, Head<Path>> extends true
          ? {
              [K in Head<Path>]?: ProjectIncBase<NonNullable<T[Head<Path>]>, Tail<Path>>;
            }
          : {
              [K in Head<Path>]: ProjectIncBase<NonNullable<T[Head<Path>]>, Tail<Path>>;
            }
        : never
  : never;

export type ProjectionFromInclusionKeys<T, Path extends AllProjKeys<T>> = Prettify<
  UnionToIntersection<Path extends string ? ProjectIncBase<T, Path> : never> &
    (T extends { _id: NonNullable<any> } ? { _id: T["_id"] } : object)
>;

// builds a full path: Prefix="" -> "K", else "Prefix.K"
type FullPath<P extends string, K extends string> = P extends "" ? K : `${P}.${K}`;

// if any excluded path E is a prefix of Path (E === Path or E is ancestor of Path)
// then MatchingExcluded<Path, Excluded> yields that E (otherwise never).
type MatchingExcluded<Path extends string, Excluded extends string> = Excluded extends any
  ? Path extends `${Excluded}` | `${Excluded}.${string}`
    ? Excluded
    : never
  : never;

// true if Path is excluded by at least one Excluded entry.
type IsExcluded<Path extends string, Excluded extends string> = [
  MatchingExcluded<Path, Excluded>,
] extends [never]
  ? false
  : true;

type ProjectExcBase<T, Excluded extends string, Prefix extends string = ""> = T extends NoExpandType
  ? T
  : Prettify<{
      [K in keyof T as IsExcluded<FullPath<Prefix, K & string>, Excluded> extends true
        ? never
        : K]: NonNullable<T[K]> extends (infer E)[]
        ? ProjectExcBase<E, Excluded, FullPath<Prefix, K & string>>[]
        : NonNullable<T[K]> extends object
          ? ProjectExcBase<NonNullable<T[K]>, Excluded, FullPath<Prefix, K & string>>
          : T[K];
    }>;

export type ProjectionFromExclusionKeys<T, Paths extends AllProjKeys<T>> = ProjectExcBase<
  T,
  Paths extends string ? Paths : never
>;

export type ProjectionRecord<T> = {
  [K in AllProjKeys<T>]?:
    | BinaryDigit
    | { $slice: number | [number, number] }
    | { $elemMatch: Record<keyof T, any> }
    | { $meta: string };
};
