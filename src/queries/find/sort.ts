import type { FindCursor, Sort, SortDirection } from "mongodb";

export type SanitizedSortDirection = Exclude<SortDirection, { readonly $meta: string }>;
export type SchemaSort<T> = keyof T extends string
  ?
      | keyof T
      | Partial<Record<keyof T, SanitizedSortDirection>>
      | ReadonlyArray<keyof T>
      | ReadonlyArray<[keyof T, SanitizedSortDirection]>
      | [keyof T, SanitizedSortDirection]
  : never;

export function sortFunc<T>(cursor: FindCursor<T>, sort: SchemaSort<T>) {
  return cursor.sort(sort as Sort);
}
