// biome-ignore-all lint/suspicious/noConsole: for testing
/** biome-ignore-all lint/correctness/noUnusedVariables: for testing */

import { MongsterCollection } from "./collection";
import { ArraySchema, MongsterSchema, type MongsterSchemaBase } from "./schema/base";
import { BinarySchema, Decimal128Schema, ObjectIdSchema } from "./schema/bsons";
import { ObjectSchema, TupleSchema, UnionSchema } from "./schema/composites";
import { BooleanSchema, DateSchema, NumberSchema, StringSchema } from "./schema/primitives";
import type { InferSchemaInputType, InferSchemaType } from "./types/types.schema";

export class MongsterSchemaBuilder {
  number() {
    return new NumberSchema();
  }
  string() {
    return new StringSchema();
  }
  boolean() {
    return new BooleanSchema();
  }
  date() {
    return new DateSchema();
  }
  /**
   * Fixed-position array (tuple).
   * @params items
   */
  tuple<T extends MongsterSchemaBase<any>[]>(...items: T) {
    return new TupleSchema(items);
  }
  /**
   * Same thing as a `.tuple()` -> But takes the items as a single array
   */
  fixedArrayOf<T extends MongsterSchemaBase<any>[]>(items: [...T]) {
    return new TupleSchema(items);
  }
  /**
   * An embedded document's schema representation
   * @param shape
   */
  object<T extends Record<string, MongsterSchemaBase<any>>>(shape: T) {
    return new ObjectSchema(shape);
  }
  /**
   * An array, it's in the name...
   * @param item
   */
  array<T extends MongsterSchemaBase<any>>(item: T) {
    return new ArraySchema<T["$type"]>(item);
  }
  /**
   * Use whatever mixture of types/shapes you want. Mongo does not care, why should we ?
   * @param shapes
   */
  union<T extends MongsterSchemaBase<any>[]>(...shapes: T) {
    return new UnionSchema(shapes);
  }
  /**
   * Similar to `.union()` -> Only difference is it takes an array as param instead
   * @param shapes
   */
  oneOf<T extends MongsterSchemaBase<any>[]>(shapes: [...T]) {
    return new UnionSchema(shapes);
  }

  objectId() {
    return new ObjectIdSchema();
  }
  decimal() {
    return new Decimal128Schema();
  }
  binary() {
    return new BinarySchema();
  }

  /**
   * A collection's schema representation
   * @param shape
   */
  schema<T extends Record<string, MongsterSchemaBase<any>>>(shape: T) {
    return new MongsterSchema(shape);
  }
}

export class Mongster {
  private collectionSchemas: MongsterSchema<any>[] = [];

  collection<CN extends string, SC extends MongsterSchema<any, any>>(
    collectionName: CN,
    schema: SC,
  ) {
    this.collectionSchemas.push(schema);
    return new MongsterCollection(collectionName, schema);
  }

  // connect(DB_URI: string) {}
}

export type InferOutput<S extends MongsterSchema<any, any>> = InferSchemaType<S>;
export type InferInput<S extends MongsterSchema<any, any>> = InferSchemaInputType<S>;
