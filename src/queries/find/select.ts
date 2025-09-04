import type { FindCursor } from "mongodb";
import type { BooleanNumber } from "../../common/number";
import type { UnionToIntersection } from "../../common/record";
import type { ProjectedType, ProjectionShape } from "./project";

type SingleSelection<T> = keyof T extends string ? keyof T | `-${keyof T}` : never;

export type SelectionFields<T> = keyof T extends string
  ? SingleSelection<T> | ReadonlyArray<`${keyof T}` | "-_id"> | ReadonlyArray<`-${keyof T}` | "_id">
  : never;

// Get the field key
type StripMinus<T, Str extends SingleSelection<T>> = Str extends `-${infer K}` ? K : Str;
type SingleProjectionFromString<T, Str extends SingleSelection<T>> = Str extends `-${infer K}`
  ? Record<K, 0>
  : Str extends `${infer K}`
    ? Record<K, 1>
    : never;

type SelectionFlagsFromSingle<T, S extends SingleSelection<T>> =
  StripMinus<T, S> extends keyof T ? SingleProjectionFromString<T, S> : never;

// only produce a record when the key is actually valid
type SelectionFlagsFromArray<T, Arr extends readonly SingleSelection<T>[]> = {
  [Idx in keyof Arr]: Arr[Idx] extends SingleSelection<T>
    ? StripMinus<T, Arr[Idx]> extends keyof T
      ? SingleProjectionFromString<T, Arr[Idx]>
      : never
    : never;
}[number] extends infer R
  ? UnionToIntersection<R> // flatten the union of records into one object
  : never;

type ExtractSelection<T, SF> = SF extends readonly SingleSelection<T>[]
  ? SelectionFlagsFromArray<T, SF>
  : SF extends SingleSelection<T>
    ? SelectionFlagsFromSingle<T, SF>
    : never;

type AsProjectionShape<T, P> = P extends ProjectionShape<T> ? P : never;

type ProjectedExtraction<T, SF> = ProjectedType<T, AsProjectionShape<T, ExtractSelection<T, SF>>>;

export function selectFunc<T, SF extends SelectionFields<T>>(cursor: FindCursor<T>, fields: SF) {
  const iterable: string[] = Array.isArray(fields) ? fields : [fields];
  const projectionMap: Record<string, BooleanNumber> = {};
  let projectionType: "inclusive" | "exclusive" | null = null;
  for (const field of iterable) {
    if (field.startsWith("-")) {
      const fieldName = field.slice(1);
      if (!!projectionType && projectionType !== "exclusive" && fieldName !== "_id") {
        throw Error("Cannot mix inclusive and exclusive projection together");
      }
      projectionType = "exclusive";
      projectionMap[fieldName] = 0;
    } else {
      if (!!projectionType && projectionType !== "exclusive" && field !== "_id") {
        throw Error("Cannot mix inclusive and exclusive projection together");
      }
      projectionType = "inclusive";
      projectionMap[field] = 1;
    }
  }
  return cursor.project(projectionMap) as FindCursor<ProjectedExtraction<T, SF>>;
}
