// biome-ignore-all lint/suspicious/noConsole: for testing
/** biome-ignore-all lint/correctness/noUnusedVariables: for testing */

import { ArraySchema, MongsterSchema, type MongsterSchemaBase } from "./schema/base";
import { BinarySchema, Decimal128Schema, ObjectIdSchema } from "./schema/bsons";
import { ObjectSchema, TupleSchema, UnionSchema } from "./schema/composites";
import { BooleanSchema, DateSchema, NumberSchema, StringSchema } from "./schema/primitives";
import type { InferSchemaInputType, InferSchemaType } from "./types/types.schema";

// helper types for this file only
type MSBAny = MongsterSchemaBase<any>;

class MongsterSchemaBuilder {
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
  tuple<T extends MSBAny[]>(...items: T) {
    return new TupleSchema(items);
  }
  /**
   * Same thing as a `.tuple()` -> But takes the items as a single array
   */
  fixedArrayOf<T extends MSBAny[]>(items: [...T]) {
    return new TupleSchema(items);
  }
  /**
   * An embedded document's schema representation
   * @param shape
   */
  object<T extends Record<string, MSBAny>>(shape: T) {
    return new ObjectSchema(shape);
  }
  /**
   * An array, it's in the name...
   * @param item
   */
  array<T extends MSBAny>(item: T) {
    return new ArraySchema<T["$type"]>(item);
  }
  /**
   * Use whatever mixture of types/shapes you want. Mongo does not care, why should we ?
   * @param shapes
   */
  union<T extends MSBAny[]>(...shapes: T) {
    return new UnionSchema(shapes);
  }
  /**
   * Similar to `.union()` -> Only difference is it takes an array as param instead
   * @param shapes
   */
  oneOf<T extends MSBAny[]>(shapes: [...T]) {
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
  schema<T extends Record<string, MSBAny>>(shape: T) {
    return new MongsterSchema(shape);
  }
}

class Mongster {
  // private schemas: MSBAny[] = [];

  M = new MongsterSchemaBuilder();

  // collection(name, schema) {
  //  schemas.push(schema)
  //  return new Collection()
  // }

  // connect(DB_URI: string) {}
}

const { M } = new Mongster();

const addressSchema = M.object({
  zip: M.string(),
});
const userSchema = new MongsterSchema({
  username: M.string().unique(),
  age: M.number().index(1),
  address: addressSchema,
  deep: M.object({
    nested: M.object({
      object: M.string().sparse().array(),
    }).unique(),
  }),
})
  .withTimestamps()
  .createIndex({ username: 1 }, { unique: true })
  .createIndex({ "address.zip": -1 })
  .createIndex({ username: 1, age: -1 });

console.time("Collect");
console.log(userSchema.collectIndexes());
console.timeEnd("Collect");

type TUser = InferSchemaType<typeof userSchema>;
type TUserInput = InferSchemaInputType<typeof userSchema>;
