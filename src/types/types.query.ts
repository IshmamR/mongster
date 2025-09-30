import type { SortDirection } from "mongodb";
import type { Prettify, UnionToIntersection } from "./types.common";
import type { NoExpandType } from "./types.schema";

type Inc = [1, 2, 3, 4, 5, 6, 7, 8, 8];

/**
 * Generate typed keys for a given object (yes, even nested ones with arrays)
 */
export type DotSeparatedKeys<
  T,
  P extends string = "",
  D extends 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 = 0,
> = D extends 7
  ? P
  : T extends NoExpandType
    ? P
    : T extends (infer E)[]
      ? E extends NoExpandType
        ? P
        : P | DotSeparatedKeys<E, P, Inc[D]>
      : T extends object
        ?
            | P
            | {
                [K in keyof T & string]: `${P}${P extends "" ? "" : "."}${K}` extends infer NK
                  ? NK extends string
                    ? DotSeparatedKeys<T[K], NK, Inc[D]>
                    : never
                  : never;
              }[keyof T & string]
        : P;

export type SanitizedSortDirection = Exclude<SortDirection, { readonly $meta: string }>;
export type SchemaSort<T> =
  DotSeparatedKeys<T> extends string
    ?
        | DotSeparatedKeys<T>
        | Partial<Record<DotSeparatedKeys<T>, SanitizedSortDirection>>
        | ReadonlyArray<DotSeparatedKeys<T>>
        | ReadonlyArray<[DotSeparatedKeys<T>, SanitizedSortDirection]>
        | [DotSeparatedKeys<T>, SanitizedSortDirection]
    : never;

export type Head<Path> = Path extends `${infer H}.${string}` ? H : Path;
export type Tail<Path> = Path extends `${string}.${infer T}` ? T : never;

export type IsOptional<T, K extends keyof T> = object extends Pick<T, K> ? true : false;

export type AllKeys<T> = keyof T | DotSeparatedKeys<T>;

type ProjectIncBase<T, Path extends string> =
  Head<Path> extends keyof T
    ? Tail<Path> extends never
      ? Prettify<Pick<T, Head<Path>>>
      : NonNullable<T[Head<Path>]> extends (infer U)[]
        ? IsOptional<T, Head<Path>> extends true
          ? { [K in Head<Path>]?: ProjectIncBase<U, Tail<Path>>[] }
          : { [K in Head<Path>]: ProjectIncBase<U, Tail<Path>>[] }
        : NonNullable<T[Head<Path>]> extends object
          ? IsOptional<T, Head<Path>> extends true
            ? { [K in Head<Path>]?: ProjectIncBase<NonNullable<T[Head<Path>]>, Tail<Path>> }
            : { [K in Head<Path>]: ProjectIncBase<NonNullable<T[Head<Path>]>, Tail<Path>> }
          : never
    : never;

export type ProjectInclusion<T, Path extends AllKeys<T>> = Prettify<
  UnionToIntersection<Path extends string ? ProjectIncBase<T, Path> : never> &
    (T extends { _id: NonNullable<any> } ? { _id: T["_id"] } : never)
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

export type ProjectExclusion<T, Paths extends AllKeys<T>> = ProjectExcBase<
  T,
  Paths extends string ? Paths : never
>;
