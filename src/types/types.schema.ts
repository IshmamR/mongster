import type { Binary, Decimal128, Double, Int32, ObjectId } from "bson";
import type { Filter } from "mongodb";
import type { MongsterSchemaBase, OptionalSchema } from "../schema/base";
import type { Prettify } from "./types.common";

export type Primitives = string | number | boolean;
export type Builtins = Primitives | Date | Buffer;
export type BsonTypes = ObjectId | Decimal128 | Double | Binary | Int32;
export type Nullish = null | undefined;

export type NoExpandType = Builtins | BsonTypes | Nullish;

type _InferSchema<T> = T extends MongsterSchemaBase<infer U> ? U : never;

export type ResolveTuple<T extends readonly unknown[]> = T extends readonly []
  ? readonly []
  : T extends readonly [infer H, ...infer R]
    ? readonly [Resolve<H>, ...ResolveTuple<R>]
    : never;

export type Resolve<T> = T extends NoExpandType
  ? T
  : T extends readonly [unknown, ...unknown[]]
    ? ResolveTuple<T> // fixed tuple
    : T extends readonly (infer U)[]
      ? Resolve<U>[] // variable-length array
      : T extends object
        ? { [K in keyof T]: Resolve<T[K]> }
        : T;

type RequiredOutputs<T extends Record<string, MongsterSchemaBase<any>>> = {
  [K in keyof T as T[K] extends OptionalSchema<any> ? never : K]: _InferSchema<T[K]>;
};
type OptionalOutputs<T extends Record<string, MongsterSchemaBase<any>>> = {
  [K in keyof T as T[K] extends OptionalSchema<any> ? K : never]?: T[K] extends OptionalSchema<
    infer U
  >
    ? U
    : never;
};
export type ObjectOutput<T extends Record<string, MongsterSchemaBase<any>>> = RequiredOutputs<T> &
  OptionalOutputs<T>;

export type IndexDirection = 1 | -1 | "hashed" | "text";
export type IndexOptions<Coll> = {
  unique?: boolean;
  sparse?: boolean;
  partialFilterExpression?: Filter<Coll>;
  expireAfterSeconds?: number; // TTL
  name?: string;
  default_language?: string;
  weights?: any;
};
export type SchemaMeta<Coll> = { index?: IndexDirection; options: IndexOptions<Coll> };

type TimestampKeys = "createdAt" | "updatedAt";

export type WithTimestamps<O> = Prettify<O & { [K in TimestampKeys]: Date }>;

export type MongsterSchemaOptions = {
  withTimestamps?: boolean;
};

/**
 * Infer the type from any given mongster schema
 */
export type InferSchemaType<MS extends MongsterSchemaBase<any>> = Prettify<
  MS["$type"] extends Record<"_id", any> ? MS["$type"] : { _id: ObjectId } & MS["$type"]
>;

type ContainsAll<T, U> = Exclude<U, T> extends never ? true : false;
export type InferSchemaInputType<MS extends MongsterSchemaBase<any>> =
  ContainsAll<keyof MS["$type"], TimestampKeys> extends true
    ? Prettify<Omit<MS["$type"], TimestampKeys> & { [K in TimestampKeys]?: Date }>
    : MS["$type"];
