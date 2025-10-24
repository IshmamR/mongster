import { ArraySchema, type MongsterSchemaInternal } from "./base";
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
  tuple<T extends MongsterSchemaInternal<any>[]>(items: [...T]) {
    return new TupleSchema(items);
  }
  /**
   * Same thing as a `.tuple()` -> But takes the items as a args
   */
  fixedArrayOf<T extends MongsterSchemaInternal<any>[]>(...items: T) {
    return new TupleSchema(items);
  }
  /**
   * An embedded document's schema representation
   * @param shape
   */
  object<T extends Record<PropertyKey, MongsterSchemaInternal<any>>>(shape: T) {
    return new ObjectSchema(shape);
  }
  /**
   * An array, it's in the name...
   * @param item
   */
  array<T extends MongsterSchemaInternal<any>>(item: T) {
    return new ArraySchema<T["$type"], T["$input"]>(item);
  }
  /**
   * Use whatever mixture of types/shapes you want. Mongo does not care, why should we ?
   * @param shapes
   */
  union<T extends MongsterSchemaInternal<any>[]>(...shapes: T) {
    return new UnionSchema(shapes);
  }
  /**
   * Similar to `.union()` -> Only difference is it takes an array as param instead
   * @param shapes
   */
  oneOf<T extends MongsterSchemaInternal<any>[]>(shapes: [...T]) {
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
  schema<T extends Record<string, MongsterSchemaInternal<any>>>(shape: T) {
    return new MongsterSchema(shape);
  }
}
