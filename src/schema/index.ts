import { ArraySchema, type MongsterSchemaInternal } from "./base";
import { BinarySchema, Decimal128Schema, ObjectIdSchema } from "./bsons";
import { ObjectSchema, TupleSchema, UnionSchema } from "./composites";
import { BooleanSchema, DateSchema, NumberSchema, StringSchema } from "./primitives";
import { MongsterSchema } from "./schema";

export class MongsterSchemaBuilder {
  number(): NumberSchema {
    return new NumberSchema();
  }
  string(): StringSchema {
    return new StringSchema();
  }
  boolean(): BooleanSchema {
    return new BooleanSchema();
  }
  date(): DateSchema {
    return new DateSchema();
  }
  /**
   * Fixed-position array (tuple).
   * @params items
   */
  tuple<T extends MongsterSchemaInternal<any>[]>(items: [...T]): TupleSchema<[...T]> {
    return new TupleSchema(items);
  }
  /**
   * Same thing as a `.tuple()` -> But takes the items as a args
   */
  fixedArrayOf<T extends MongsterSchemaInternal<any>[]>(...items: T): TupleSchema<T> {
    return new TupleSchema(items);
  }
  /**
   * An embedded document's schema representation
   * @param shape
   */
  object<T extends Record<PropertyKey, MongsterSchemaInternal<any>>>(shape: T): ObjectSchema<T> {
    return new ObjectSchema(shape);
  }
  /**
   * An array, it's in the name...
   * @param item
   */
  array<T extends MongsterSchemaInternal<any>>(item: T): ArraySchema<T["$type"], T["$input"]> {
    return new ArraySchema<T["$type"], T["$input"]>(item);
  }
  /**
   * Use whatever mixture of types/shapes you want. Mongo does not care, why should we ?
   * @param shapes
   */
  union<T extends MongsterSchemaInternal<any>[]>(...shapes: T): UnionSchema<T> {
    return new UnionSchema(shapes);
  }
  /**
   * Similar to `.union()` -> Only difference is it takes an array as param instead
   * @param shapes
   */
  oneOf<T extends MongsterSchemaInternal<any>[]>(shapes: [...T]): UnionSchema<[...T]> {
    return new UnionSchema(shapes);
  }

  objectId(): ObjectIdSchema {
    return new ObjectIdSchema();
  }
  decimal(): Decimal128Schema {
    return new Decimal128Schema();
  }
  binary(): BinarySchema {
    return new BinarySchema();
  }

  /**
   * A collection's schema representation
   * @param shape
   */
  schema<T extends Record<string, MongsterSchemaInternal<any>>>(shape: T): MongsterSchema<T> {
    return new MongsterSchema(shape);
  }
}
