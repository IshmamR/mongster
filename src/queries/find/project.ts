import type { FindCursor } from "mongodb";
import type { BooleanNumber } from "../../common/number";
import type { OmitFieldIfPresent, OmitFields, Prettify } from "../../common/record";

export type ProjectionShape<T> = Partial<Record<keyof T, BooleanNumber>> &
  Partial<Record<string, BooleanNumber>>;

export type OmitIdIfPresent<Rec> = OmitFieldIfPresent<Rec, "_id">;

type InclusiveProj<T> = Record<keyof T, 1> & { _id: BooleanNumber };
type ExclusiveProj<T> = Record<keyof T, 0> & { _id: BooleanNumber };

type ValidIncProj<T, Proj = InclusiveProj<T>> =
  Proj extends ProjectionShape<T> ? Partial<Proj> : never;
type ValidExcProj<T, Proj = ExclusiveProj<T>> =
  Proj extends ProjectionShape<T> ? Partial<Proj> : never;

export type StrictProjection<T> = Prettify<ValidIncProj<T> | ValidExcProj<T>>;

// Are all values in P (except _id) 0?
type IsExclusion<P, PToUse = OmitIdIfPresent<P>> = [keyof PToUse] extends [never]
  ? false
  : PToUse extends Partial<Record<keyof P, 0>>
    ? true
    : PToUse extends Partial<Record<keyof P, 1>>
      ? false
      : never;

// Get keys in P (projection) where value is 1 and key is in T
type InclusionKeys<T, P> = Extract<
  {
    [K in keyof P]: P[K] extends 1 ? K : never;
  }[keyof P],
  keyof T
>;
// Get keys in P (projection) where value is 0 and key is in T
type ExclusionKeys<T, P> = Extract<
  {
    [K in keyof P]: P[K] extends 0 ? K : never;
  }[keyof P],
  keyof T
>;

export type ProjectedType<T, P extends ProjectionShape<T>> =
  IsExclusion<P> extends true
    ? OmitFields<T, ExclusionKeys<T, P>>
    : Pick<T, InclusionKeys<T, P>> extends infer R
      ? P extends { _id: 0 }
        ? OmitIdIfPresent<R>
        : T extends { _id: infer Id }
          ? R & { _id: Id } // add _id by default for inclusion projections
          : R
      : never;

export function projectFunc<T, P extends StrictProjection<T>>(
  cursor: FindCursor<T>,
  projection: P,
) {
  const projectionMap: Record<string, BooleanNumber> = {};
  let mode: "inclusive" | "exclusive" | null = null;

  for (const [key, raw] of Object.entries(projection as Record<string, unknown>)) {
    if (raw !== 0 && raw !== 1) {
      throw Error(`Invalid projection value for key '${key}': expected 0 or 1`);
    }
    const val = raw as BooleanNumber;

    if (key !== "_id") {
      if (mode === null) {
        mode = val === 1 ? "inclusive" : "exclusive";
      } else {
        if (mode === "inclusive" && val === 0) {
          throw Error("Cannot mix inclusive and exclusive projection together");
        }
        if (mode === "exclusive" && val === 1) {
          throw Error("Cannot mix inclusive and exclusive projection together");
        }
      }
    }

    projectionMap[key] = val;
  }

  return cursor.project(projectionMap) as FindCursor<ProjectedType<T, P>>;
}
