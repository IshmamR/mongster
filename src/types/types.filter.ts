/**
 * @info
 * A lot of the filter types were too difficult/time-taking for me to write up from scratch.
 * So, I copied a lot of the types from papr and improved upon those. :p
 */

import type {
  AlternativeType,
  ArrayElement,
  BitwiseFilter,
  BSONRegExp,
  BSONType,
  BSONTypeAlias,
  IntegerType,
  KeysOfAType,
  NumericType,
  OnlyFieldsOfType,
  PullAllOperator,
  PullOperator,
  PushOperator,
  SetFields,
  Timestamp,
} from "mongodb";
import type { Merge, OptionalKeys, Prettify, RequiredKeys } from "./types.common";
import type { AllFilterKeys } from "./types.query";
import type { NoExpandType } from "./types.schema";

/**
 Recursively merges nested object and array types while preserving required vs optional keys.

 @example
  type Left  = { obj?: { a?: number } };
  type Right = { obj: { b: string } };
  type Combined = Left & Right;

  type R = DeepMerge<Combined>;
  // R => { obj: { b: string; a?: number } }
*/
export type DeepMerge<T> = T extends NoExpandType
  ? T
  : T extends readonly (infer E)[]
    ? DeepMerge<E>[]
    : T extends object
      ? Prettify<
          Merge<
            { [K in RequiredKeys<T>]: DeepMerge<T[K]> } & {
              [K in OptionalKeys<T>]?: DeepMerge<T[K]>;
            }
          >
        >
      : T;

type PropertyNestedTypeBase<T, Prop extends string> = Prop extends `${infer H}.${infer Rest}`
  ? H extends `${number}` | "$"
    ? NonNullable<T> extends (infer E)[]
      ? PropertyTypeBase<E, Rest>
      : unknown
    : T extends (infer E)[]
      ? PropertyTypeBase<E, Prop>
      : H extends keyof T
        ? PropertyTypeBase<NonNullable<T[H]>, Rest>
        : unknown
  : unknown;

export type PropertyNestedType<T, P extends AllFilterKeys<T>> = P extends string
  ? PropertyNestedTypeBase<T, P>
  : never;

type PropertyTypeBase<T, Prop extends string> = Prop extends keyof T
  ? T extends object
    ? Prop extends `${string}.${string}`
      ? PropertyNestedTypeBase<NonNullable<T>, Prop>
      : T[Prop]
    : T[Prop]
  : T extends (infer E)[]
    ? Prop extends `${number}`
      ? E
      : Prop extends keyof E
        ? PropertyTypeBase<E, Prop>
        : PropertyNestedTypeBase<NonNullable<T>, Prop>
    : PropertyNestedTypeBase<NonNullable<T>, Prop>;

export type PropertyType<T, P extends AllFilterKeys<T>> = P extends string
  ? PropertyTypeBase<T, P>
  : never;

///
// Filter
///

export type MongsterFilter<T> =
  | Partial<T>
  | (MongsterFilterConditions<T> & MongsterRootFilterOperators<T>);

type MongsterCondition<Type> =
  | AlternativeType<Type>
  | MongsterFilterOperators<AlternativeType<Type>>;

type MongsterFilterConditions<T> = {
  [K in AllFilterKeys<T>]?: MongsterCondition<PropertyType<T, K>>;
};

interface MongsterRootFilterOperators<T> {
  $and?: MongsterFilter<T>[];
  $nor?: MongsterFilter<T>[];
  $or?: MongsterFilter<T>[];
  $expr?: Record<string, any>;
  $text?: {
    $search: string;
    $language?: string;
    $caseSensitive?: boolean;
    $diacriticSensitive?: boolean;
  };
  $where?: string | ((this: T) => boolean);
  $comment?: string | Record<string, any>;

  $jsonSchema?: Record<string, any>;
}

interface MongsterFilterOperators<V> {
  // Comparison operator(s)
  $eq?: V;
  $gt?: V;
  $gte?: V;
  $in?: readonly V[];
  $lt?: V;
  $lte?: V;
  $ne?: V;
  $nin?: readonly V[];

  // Negation operator(s)
  $not?: V extends string ? MongsterFilterOperators<V> | RegExp : MongsterFilterOperators<V>;

  // Element operator(s)
  $exists?: boolean;
  $type?: BSONType | BSONTypeAlias;

  // Modulus operator(s)
  $mod?: V extends number ? [number, number] : never;

  // String/RegEx operator(s)
  $regex?: V extends string ? BSONRegExp | RegExp | string : never;
  $options?: V extends string ? string : never;

  // Geo spatial operator(s)
  $geoIntersects?: {
    $geometry: Document;
  };
  $geoWithin?: Document;
  $near?: Document;
  $nearSphere?: Document;
  $maxDistance?: number;
  $minDistance?: number;

  // Array operator(s)
  $all?: V extends readonly (infer U)[]
    ? readonly (U | { $elemMatch: Record<string, any> })[]
    : never;
  $elemMatch?: V extends readonly any[] ? Document : never;
  $size?: V extends readonly any[] ? number : never;

  // Bitwise operator(s)
  $bitsAllClear?: BitwiseFilter;
  $bitsAllSet?: BitwiseFilter;
  $bitsAnyClear?: BitwiseFilter;
  $bitsAnySet?: BitwiseFilter;

  // Document level expression
  $expr?: Record<string, any>;

  // Document level schema
  $jsonSchema?: Record<string, any>;

  // Random sampling
  $rand?: Record<string, never>;
}

////
// Update filter
////

/**
 * Returns all dot-notation properties of a schema with their corresponding types.
 *
 * @example
 * {
 *   foo: string;
 *   'nested.field': number;
 * }
 */
export type AllProperties<T> = {
  [P in AllFilterKeys<T> & string]?: PropertyType<T, P>;
};

/**
 * Returns all array-specific element dot-notation properties of a schema with their corresponding types.
 *
 * @example
 * {
 *   'numbersList.$': number;
 *   'numbersList.$[]': number;
 *   'numbersList.$[element]': number;
 * }
 */
export type ArrayElementsProperties<T> = {
  [P in `${KeysOfAType<AllProperties<T>, any[]>}.$${"" | `[${string}]`}`]?: ArrayElement<
    PropertyTypeBase<T, P extends `${infer K}.$${string}` ? K : never>
  >;
};

/**
 * Returns all array-specific nested dot-notation properties of a schema without type lookup.
 *
 * @example
 * {
 *   'objectList.$.foo': any;
 *   'objectList.$[].foo': any;
 *   'objectList.$[element].foo': any;
 * }
 */
export type ArrayNestedProperties<T> = {
  [P in `${KeysOfAType<AllProperties<T>, Record<string, any>[]>}.$${
    | ""
    | `[${string}]`}.${string}`]?: any;
};

export type MatchKeysAndValues<T> = AllProperties<T> &
  ArrayElementsProperties<T> &
  ArrayNestedProperties<T>;

export interface MongsterUpdateFilter<T> {
  $currentDate?: OnlyFieldsOfType<T, Date | Timestamp, true | { $type: "date" | "timestamp" }>;
  $inc?: OnlyFieldsOfType<T, NumericType | undefined>;
  $min?: MatchKeysAndValues<T>;
  $max?: MatchKeysAndValues<T>;
  $mul?: OnlyFieldsOfType<T, NumericType | undefined>;
  $rename?: Record<string, string>;
  $set?: MatchKeysAndValues<T>;
  $setOnInsert?: MatchKeysAndValues<T>;
  $unset?: OnlyFieldsOfType<T, any, "" | 1 | true>;
  $addToSet?: SetFields<T>;
  $pop?: OnlyFieldsOfType<T, readonly any[], -1 | 1>;
  $pull?: PullOperator<T>;
  $push?: PushOperator<T>;
  $pullAll?: PullAllOperator<T>;
  $bit?: OnlyFieldsOfType<
    T,
    NumericType | undefined,
    { and: IntegerType } | { or: IntegerType } | { xor: IntegerType }
  >;
}
