import { ArraySchema, type MongsterSchemaBase } from "./base";
import { BinarySchema, Decimal128Schema, ObjectIdSchema } from "./bsons";
import { ObjectSchema, TupleSchema, UnionSchema } from "./composites";
import { BooleanSchema, DateSchema, NumberSchema, StringSchema } from "./primitives";
import { MongsterSchema } from "./schema";

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
  tuple<T extends MongsterSchemaBase<any>[]>(items: [...T]) {
    return new TupleSchema(items);
  }
  /**
   * Same thing as a `.tuple()` -> But takes the items as a args
   */
  fixedArrayOf<T extends MongsterSchemaBase<any>[]>(...items: T) {
    return new TupleSchema(items);
  }
  /**
   * An embedded document's schema representation
   * @param shape
   */
  object<T extends Record<PropertyKey, MongsterSchemaBase<any>>>(shape: T) {
    return new ObjectSchema(shape);
  }
  /**
   * An array, it's in the name...
   * @param item
   */
  array<T extends MongsterSchemaBase<any>>(item: T) {
    return new ArraySchema<T["$type"], T["$input"]>(item);
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
