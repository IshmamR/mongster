import type { IndexDescription } from "mongodb";
import { MError } from "../error";
import { updateKeysArray } from "../helpers/constants";
import type { MongsterUpdateFilter } from "../types/types.filter";
import type { AllFilterKeys } from "../types/types.query";
import type {
  MongsterIndexDirection,
  MongsterIndexOptions,
  MongsterSchemaOptions,
  ObjectInput,
  ObjectOutput,
  Resolve,
  WithTimestamps,
} from "../types/types.schema";
import { ArraySchema, MongsterSchemaBase, MongsterSchemaInternal, OptionalSchema } from "./base";
import { BinarySchema, Decimal128Schema, ObjectIdSchema } from "./bsons";
import { ObjectSchema, TupleSchema, UnionSchema } from "./composites";
import { BooleanSchema, DateSchema, NumberSchema, StringSchema } from "./primitives";

function unwrapSchema(s: MongsterSchemaBase<any>): MongsterSchemaInternal<any> {
  let cur: any = s;
  while (cur && cur.inner instanceof MongsterSchemaInternal) cur = cur.inner;
  return cur as MongsterSchemaInternal<any>;
}

/**
 * The schema that goes to collection
 */
export class MongsterSchema<
  T extends Record<string, MongsterSchemaInternal<any>>,
  $T = Resolve<ObjectOutput<T>>,
  $I = Resolve<ObjectInput<T>>,
> extends MongsterSchemaBase<$T> {
  declare $type: $T;
  declare $input: $I;
  declare $brand: "MongsterSchema";

  protected rootIndexes: IndexDescription[] = [];
  protected options: MongsterSchemaOptions = {};

  #shape: T;
  #collectedIndexes: IndexDescription[] | null;

  constructor(shape: T) {
    for (const [_, rawSchema] of Object.entries(shape)) {
      if (rawSchema instanceof MongsterSchema) throw new Error("MongsterSchema cannot be embedded");
    }

    super();
    this.#shape = shape;
    this.#collectedIndexes = null;
  }

  getShape(): T {
    return this.#shape;
  }

  addIndex<K extends AllFilterKeys<$T>>(
    keys: Record<K, MongsterIndexDirection>,
    options?: MongsterIndexOptions<$T>,
  ): this {
    const clone = this.clone();
    clone.rootIndexes.push({ key: keys, ...options });
    return clone;
  }

  withTimestamps(): MongsterSchema<T, WithTimestamps<$T>> {
    const clone = this.clone();
    clone.options = { ...this.options, withTimestamps: true };
    return clone as MongsterSchema<T, WithTimestamps<$T>>;
  }

  clone(): this {
    const clone = new MongsterSchema(this.#shape) as this;
    clone.rootIndexes = [...this.rootIndexes];
    clone.options = { ...this.options };
    return clone;
  }

  parse(v: unknown): $T {
    if (typeof v !== "object" || v === null) throw new MError("Expected an object");
    if (Array.isArray(v)) throw new MError("Expected an object, but received an array");

    const out: Record<string, unknown> = {};

    if ("_id" in (v as any)) {
      out._id = (v as any)._id;
    }

    for (const [k, s] of Object.entries(this.#shape)) {
      try {
        out[k] = s.parse((v as any)[k]);
      } catch (err) {
        throw new MError(`${k}: ${(err as MError).message}`, {
          cause: err,
        });
      }
    }

    if (this.options.withTimestamps) {
      out.createdAt = new Date();
      out.updatedAt = new Date();
    }

    return out as $T;
  }

  parseForUpdate(updateObj: MongsterUpdateFilter<$T>) {
    Object.keys(updateObj).forEach((key) => {
      if (!updateKeysArray.includes(key as any)) throw new Error("Invalid update key");
    });

    const parsedUpdateRecord: MongsterUpdateFilter<$T> = {};

    if (this.options.withTimestamps) {
      parsedUpdateRecord.$set = {};
    }

    const processOperator = <K extends keyof MongsterUpdateFilter<$T>>(
      operator: K,
      validator?: (val: any, key: string) => void,
    ) => {
      const operatorValue = updateObj[operator];
      if (typeof operatorValue === "undefined") return;
      if (typeof operatorValue !== "object")
        throw new Error(`${String(operator)} must be an object`);
      if (Array.isArray(operatorValue)) throw new Error(`${String(operator)} cannot be an array`);

      let result: any;
      const keys = Object.keys(operatorValue);
      if (keys.length) {
        for (const key of keys) {
          const val = (operatorValue as any)[key];
          if (typeof val === "undefined") continue;

          if (validator) validator(val, key);

          if (typeof result !== "undefined") result[key] = val;
          else result = { [key]: val };
        }
      }

      if (result && Object.keys(result).length) {
        parsedUpdateRecord[operator] = result;
      }
    };

    processOperator("$currentDate", (val, key) => {
      if (typeof val !== "boolean" && typeof val !== "object")
        throw new Error(`$currentDate.${key} must be a boolean or object with $type`);
      if (typeof val === "object") {
        if (Array.isArray(val)) throw new Error(`$currentDate.${key} cannot be an array`);
        if (val.$type !== "date" && val.$type !== "timestamp")
          throw new Error(
            `$currentDate.${key}.$type must be "date" or "timestamp", got "${val.$type}"`,
          );
      }
    });

    processOperator("$inc", (val, key) => {
      if (typeof val !== "number")
        throw new Error(`$inc.${key} must be a number, got ${typeof val}`);
    });

    processOperator("$min");

    processOperator("$max");

    processOperator("$mul", (val, key) => {
      if (typeof val !== "number")
        throw new Error(`$mul.${key} must be a number, got ${typeof val}`);
    });

    processOperator("$rename", (val, key) => {
      if (typeof val !== "string")
        throw new Error(`$rename.${key} must be a string, got ${typeof val}`);
    });

    processOperator("$set");

    processOperator("$setOnInsert");

    processOperator("$unset", (val, key) => {
      if (val !== "" && val !== 1 && val !== true)
        throw new Error(`$unset.${key} must be "", 1, or true, got ${JSON.stringify(val)}`);
    });

    processOperator("$addToSet");

    processOperator("$pop", (val, key) => {
      if (val !== -1 && val !== 1) throw new Error(`$pop.${key} must be -1 or 1, got ${val}`);
    });

    processOperator("$pull");

    processOperator("$push");

    processOperator("$pullAll", (val, key) => {
      if (!Array.isArray(val))
        throw new Error(`$pullAll.${key} must be an array, got ${typeof val}`);
    });

    processOperator("$bit", (val, key) => {
      if (typeof val !== "object")
        throw new Error(`$bit.${key} must be an object, got ${typeof val}`);
      if (Array.isArray(val)) throw new Error(`$bit.${key} cannot be an array`);
      const hasAnd = "and" in val;
      const hasOr = "or" in val;
      const hasXor = "xor" in val;
      const validOperatorCount = [hasAnd, hasOr, hasXor].filter(Boolean).length;
      if (validOperatorCount !== 1)
        throw new Error(`$bit.${key} must have exactly one of "and", "or", or "xor" operators`);
      const operatorVal = val.and ?? val.or ?? val.xor;
      if (typeof operatorVal !== "number" || !Number.isInteger(operatorVal))
        throw new Error(`$bit.${key} operator value must be an integer, got ${typeof operatorVal}`);
    });

    if (this.options.withTimestamps) {
      parsedUpdateRecord.$currentDate = {
        ...(parsedUpdateRecord.$currentDate ?? {}),
        updatedAt: true,
      } as any;
    }

    return parsedUpdateRecord;
  }

  /**
   * recursively gather all index specifications declared via:
   *  - field-level schema meta (`index()`, `unique()`, `sparse()`, `text()`, `hashed()`, `ttl()`)
   *  - root-level `createIndex()` calls on this (and nested `MongsterSchema` instances)
   * nested keys use MongoDB dot notation (e.g. `address.zip`).
   */
  collectIndexes(): IndexDescription[] {
    if (this.#collectedIndexes) return this.#collectedIndexes;

    const collected = [...this.rootIndexes];

    function pushFieldIndex(path: string, schema: MongsterSchemaInternal<any>) {
      const meta = schema.getIdxMeta();
      if (meta && typeof meta.index !== "undefined") {
        const opts = Object.keys(meta.options ?? {}).length ? { ...meta.options } : undefined;
        collected.push({ key: { [path]: meta.index }, ...opts });
      }
    }

    function walkShape(shape: Record<string, MongsterSchemaInternal<any>>, parent: string) {
      for (const [k, rawSchema] of Object.entries(shape)) {
        const path = parent ? `${parent}.${k}` : k;
        collect(rawSchema, path);
      }
    }

    const collect = (schema: MongsterSchemaInternal<any>, path: string) => {
      pushFieldIndex(path, schema);
      const unwrapped = unwrapSchema(schema);
      if (unwrapped !== schema) pushFieldIndex(path, unwrapped);

      if (unwrapped instanceof ObjectSchema) {
        collected.push(...unwrapped.getRootIndexes(path));
        walkShape(unwrapped.getShape(), path);
      } else if (unwrapped instanceof UnionSchema || unwrapped instanceof TupleSchema) {
        walkShape(unwrapped.getShapes(), path);
      } else if (unwrapped instanceof ArraySchema) {
        const inner = unwrapped.getShapes();
        if (inner) collect(inner, path);
      }
    };

    walkShape(this.#shape, "");

    this.#collectedIndexes = collected;
    return collected;
  }

  getJsonSchema(): any {
    function makeJsonSchema(schema: MongsterSchemaInternal<any>): any {
      const unwrapped = unwrapSchema(schema);
      if (unwrapped instanceof NumberSchema) {
        const property: Record<string, any> = { type: "number" };
        const checks = unwrapped.getChecks();
        if (typeof checks.min !== "undefined") property.minimum = checks.min;
        if (typeof checks.max !== "undefined") property.maximum = checks.max;
        if (typeof checks.enum !== "undefined") property.enum = checks.enum;
        if (typeof checks.default !== "undefined") property.default = checks.default;
        return property;
      }

      if (unwrapped instanceof StringSchema) {
        const property: Record<string, any> = { type: "string" };
        const checks = unwrapped.getChecks();
        if (typeof checks.min !== "undefined") property.minLength = checks.min;
        if (typeof checks.max !== "undefined") property.maxLength = checks.max;
        if (typeof checks.enum !== "undefined") property.enum = checks.enum;
        if (typeof checks.match !== "undefined") property.pattern = checks.match.source;
        if (typeof checks.default !== "undefined") property.default = checks.default;
        return property;
      }

      if (unwrapped instanceof BooleanSchema) {
        const property: Record<string, any> = { type: "boolean" };
        const checks = unwrapped.getChecks();
        if (typeof checks.default !== "undefined") property.default = checks.default;
        return property;
      }
      if (unwrapped instanceof DateSchema) {
        const property: Record<string, any> = { type: "string", format: "date-time" };
        const checks = unwrapped.getChecks();
        if (typeof checks.default !== "undefined") property.default = checks.default.toISOString();
        return property;
      }

      if (unwrapped instanceof ObjectIdSchema) {
        const objectIdRegex = /^[a-f0-9]{24}$/;
        const property: Record<string, any> = { type: "string", pattern: objectIdRegex.source };
        const checks = unwrapped.getChecks();
        if (typeof checks.default !== "undefined") property.default = checks.default.toString();
        return property;
      }
      if (unwrapped instanceof Decimal128Schema) {
        const decimalRegex = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;
        const property: Record<string, any> = { type: "string", pattern: decimalRegex.source };
        const checks = unwrapped.getChecks();
        if (typeof checks.default !== "undefined") property.default = checks.default.toString();
        return property;
      }
      if (unwrapped instanceof BinarySchema) {
        return unwrapped.getJsonSchema();
      }

      if (unwrapped instanceof ArraySchema) {
        const inner = unwrapped.getShapes();
        const property: Record<string, any> = { type: "array", items: makeJsonSchema(inner) };
        const checks = unwrapped.getChecks();
        if (typeof checks.min !== "undefined") property.minItems = checks.min;
        if (typeof checks.max !== "undefined") property.maxItems = checks.max;
        if (typeof checks.default !== "undefined") property.default = checks.default;
        return property;
      }

      if (unwrapped instanceof ObjectSchema) {
        const property = walk(unwrapped.getShape());
        const checks = unwrapped.getChecks();
        if (typeof checks.default !== "undefined") property.default = checks.default;
        return property;
      }

      if (unwrapped instanceof TupleSchema) {
        const property: Record<string, any> = { type: "array", items: [] };
        const innerShapes = unwrapped.getShapes();
        for (const innerShape of innerShapes) {
          property.items.push(makeJsonSchema(innerShape));
        }
        property.minItems = innerShapes.length;
        property.maxItems = innerShapes.length;
        const checks = unwrapped.getChecks();
        if (typeof checks.default !== "undefined") property.default = checks.default;
        return property;
      }

      if (unwrapped instanceof UnionSchema) {
        const property: Record<string, any> = { anyOf: [] };
        const innerShapes = unwrapped.getShapes();
        for (const innerShape of innerShapes) {
          property.anyOf.push(makeJsonSchema(innerShape));
        }
        const checks = unwrapped.getChecks();
        if (typeof checks.default !== "undefined") property.default = checks.default;
        return property;
      }

      return { not: {} };
    }

    function walk(shape: Record<string, MongsterSchemaInternal<any>>) {
      const jsonSchema: any = {
        type: "object",
        properties: {},
        required: [],
      };
      for (const [k, rawSchema] of Object.entries(shape)) {
        const unwrapped = unwrapSchema(rawSchema);
        if (!(rawSchema instanceof OptionalSchema)) jsonSchema.required.push(k);
        jsonSchema.properties[k] = makeJsonSchema(unwrapped);
      }
      return jsonSchema;
    }

    return walk(this.#shape);
  }
}
