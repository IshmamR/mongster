import type { IndexDescription } from "mongodb";
import { MError, ValidationError } from "../error";
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
import {
  ArraySchema,
  MongsterSchemaBase,
  MongsterSchemaInternal,
  NullableSchema,
  OptionalSchema,
} from "./base";
import { BinarySchema, Decimal128Schema, ObjectIdSchema } from "./bsons";
import { ObjectSchema, TupleSchema, UnionSchema } from "./composites";
import { BooleanSchema, DateSchema, NumberSchema, StringSchema } from "./primitives";

function unwrapSchema(s: MongsterSchemaBase<any>): MongsterSchemaInternal<any> {
  let cur: any = s;
  while (cur && cur.inner instanceof MongsterSchemaInternal) cur = cur.inner;
  return cur as MongsterSchemaInternal<any>;
}

function processOperators<$T>(updateObj: MongsterUpdateFilter<$T>): MongsterUpdateFilter<$T> {
  const parsedUpdateRecord: MongsterUpdateFilter<$T> = {};

  function processOperator<K extends keyof MongsterUpdateFilter<$T>>(
    operator: K,
    validator?: (val: any, key: string) => void,
  ) {
    const operatorValue = updateObj[operator];
    if (typeof operatorValue === "undefined") return;
    if (typeof operatorValue !== "object") {
      throw new ValidationError(`${operator} must be an object`);
    }
    if (Array.isArray(operatorValue)) throw new ValidationError(`${operator} cannot be an array`);

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
  }

  processOperator("$currentDate", (val, key) => {
    if (typeof val !== "boolean" && typeof val !== "object") {
      throw new ValidationError(`$currentDate.${key} must be a boolean or object with $type field`);
    }
    if (typeof val === "object") {
      if (Array.isArray(val)) throw new ValidationError(`$currentDate.${key} cannot be an array`);
      if (val.$type !== "date" && val.$type !== "timestamp") {
        throw new ValidationError(
          `$currentDate.${key}.$type must be "date" or "timestamp", got "${val.$type}"`,
        );
      }
    }
  });

  processOperator("$inc", (val, key) => {
    if (typeof val === "number") return;
    throw new ValidationError(`$inc.${key} must be a number, got ${typeof val}`);
  });

  processOperator("$min");
  processOperator("$max");

  processOperator("$mul", (val, key) => {
    if (typeof val === "number") return;
    throw new ValidationError(`$mul.${key} must be a number, got ${typeof val}`);
  });

  processOperator("$rename", (val, key) => {
    if (typeof val === "string") return;
    throw new ValidationError(`$rename.${key} must be a string, got ${typeof val}`);
  });

  processOperator("$set");
  processOperator("$setOnInsert");

  processOperator("$unset", (val, key) => {
    if (val !== "" && val !== 1 && val !== true) {
      throw new ValidationError(`$unset.${key} must be "", 1, or true, got ${JSON.stringify(val)}`);
    }
  });

  processOperator("$addToSet");

  processOperator("$pop", (val, key) => {
    if (val === -1 || val === 1) return;
    throw new ValidationError(`$pop.${key} must be -1 or 1, got ${val}`);
  });

  processOperator("$pull");
  processOperator("$push");

  processOperator("$pullAll", (val, key) => {
    if (Array.isArray(val)) return;
    throw new ValidationError(`$pullAll.${key} must be an array, got ${typeof val}`);
  });

  processOperator("$bit", (val, key) => {
    if (typeof val !== "object") {
      throw new ValidationError(`$bit.${key} must be an object, got ${typeof val}`);
    }
    if (Array.isArray(val)) throw new ValidationError(`$bit.${key} cannot be an array`);

    const hasAnd = "and" in val;
    const hasOr = "or" in val;
    const hasXor = "xor" in val;

    const validOperatorCount = [hasAnd, hasOr, hasXor].filter(Boolean).length;
    if (validOperatorCount !== 1) {
      throw new ValidationError(
        `$bit.${key} must have exactly one of "and", "or", or "xor" operators`,
      );
    }
    const operatorVal = val.and ?? val.or ?? val.xor;
    if (typeof operatorVal !== "number" || !Number.isInteger(operatorVal)) {
      throw new ValidationError(
        `$bit.${key} operator value must be an integer, got ${typeof operatorVal}`,
      );
    }
  });

  return parsedUpdateRecord;
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

  // Override base parseForUpdate with specialized signature for update operations
  parseForUpdate(updateObj: MongsterUpdateFilter<$T>, isUpsert?: boolean): MongsterUpdateFilter<$T>;
  parseForUpdate(v: unknown): $T | undefined;
  parseForUpdate(updateObj: unknown, isUpsert?: boolean): any {
    // If called with update filter object
    if (typeof updateObj === "object" && updateObj !== null && !Array.isArray(updateObj)) {
      const hasUpdateOperator = Object.keys(updateObj).some((k) => k.startsWith("$"));
      if (hasUpdateOperator) {
        return this.#parseUpdateObject(updateObj as MongsterUpdateFilter<$T>, isUpsert);
      }
    }

    // Otherwise, treat as regular parse for update (partial validation)
    if (updateObj === undefined) return undefined;

    if (typeof updateObj !== "object" || updateObj === null) throw new MError("Expected an object");
    if (Array.isArray(updateObj)) throw new MError("Expected an object, but received an array");

    const out: Record<string, unknown> = {};
    for (const [k, s] of Object.entries(this.#shape)) {
      try {
        const parsed = s.parseForUpdate((updateObj as any)[k]);
        // Only include defined values
        if (parsed !== undefined) {
          out[k] = parsed;
        }
      } catch (err) {
        throw new MError(`${k}: ${(err as MError).message}`, {
          cause: err,
        });
      }
    }

    return out as $T;
  }

  #parseUpdateObject(
    updateObj: MongsterUpdateFilter<$T>,
    isUpsert?: boolean,
  ): MongsterUpdateFilter<$T> {
    Object.keys(updateObj).forEach((key) => {
      if (!updateKeysArray.includes(key as any)) throw new ValidationError("Invalid update key");
    });

    const processedUpdateRecord = processOperators(updateObj);
    if (this.options.withTimestamps) {
      const autoTimestampData: any = { updatedAt: true };
      if (isUpsert) autoTimestampData.createdAt = true;
      processedUpdateRecord.$currentDate = {
        ...(processedUpdateRecord.$currentDate ?? {}),
        ...autoTimestampData,
      };
    }

    // Helper to resolve schema at path
    const resolveSchemaAtPath = (
      path: string,
    ): { schema: MongsterSchemaInternal<any>; isOptional: boolean; isNullable: boolean } | null => {
      const segments = path.split(".");
      let currentSchema: MongsterSchemaInternal<any> | undefined;
      let currentShape: Record<string, MongsterSchemaInternal<any>> = this.#shape;
      let isOptional = false;
      let isNullable = false;

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        if (!segment) continue;

        // Handle array index notation (e.g., "tags.0" or "users.0.name")
        if (/^\d+$/.test(segment)) {
          if (!currentSchema) return null;
          const unwrapped = unwrapSchema(currentSchema);
          if (!(unwrapped instanceof ArraySchema)) {
            throw new ValidationError(
              `Cannot use array index on non-array field at "${segments.slice(0, i).join(".")}"`,
            );
          }
          currentSchema = unwrapped.getShapes();
          continue;
        }

        currentSchema = currentShape[segment];
        if (!currentSchema) {
          throw new ValidationError(
            `Field "${segments.slice(0, i + 1).join(".")}" does not exist in schema`,
          );
        }

        // Track optional/nullable wrappers
        if (currentSchema instanceof OptionalSchema) {
          isOptional = true;
          currentSchema = (currentSchema as any).inner;
        }
        if (currentSchema instanceof NullableSchema) {
          isNullable = true;
          currentSchema = (currentSchema as any).inner;
        }

        if (!currentSchema) {
          throw new ValidationError(
            `Field "${segments.slice(0, i + 1).join(".")}" is undefined after unwrapping`,
          );
        }

        // Unwrap other wrappers
        const unwrapped = unwrapSchema(currentSchema);

        // If we have more segments, check if this is an object or array
        if (i < segments.length - 1) {
          if (unwrapped instanceof ObjectSchema) {
            currentShape = unwrapped.getShape();
          } else if (unwrapped instanceof ArraySchema) {
            // Next segment should be either an index or we continue with array element schema
            const nextSegment = segments[i + 1];
            if (nextSegment && /^\d+$/.test(nextSegment)) {
            } else {
              // Treat as nested field in array element
              currentSchema = unwrapped.getShapes();
              const innerUnwrapped = unwrapSchema(currentSchema);
              if (innerUnwrapped instanceof ObjectSchema) {
                currentShape = innerUnwrapped.getShape();
              } else {
                throw new ValidationError(
                  `Cannot access nested field on non-object array element at "${segments.slice(0, i + 1).join(".")}"`,
                );
              }
            }
          } else {
            throw new ValidationError(
              `Cannot access nested field "${segments[i + 1]}" on non-object field at "${segments.slice(0, i + 1).join(".")}"`,
            );
          }
        }
      }

      if (!currentSchema) return null;
      return { schema: currentSchema, isOptional, isNullable };
    };

    // Validate $set
    if (typeof processedUpdateRecord.$set !== "undefined") {
      Object.entries(processedUpdateRecord.$set).forEach(([path, value]) => {
        const resolved = resolveSchemaAtPath(path);
        if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

        const { schema, isNullable } = resolved;

        // Disallow undefined (should use $unset instead)
        if (value === undefined) {
          throw new ValidationError(`Cannot set "${path}" to undefined, use $unset instead`);
        }

        // Allow null only if schema is nullable
        if (value === null && !isNullable) {
          throw new ValidationError(`Field "${path}" is not nullable`);
        }

        // Validate value against schema - use parseForUpdate
        if (value !== null) {
          try {
            schema.parseForUpdate(value);
          } catch (err) {
            throw new ValidationError(`$set.${path}: ${(err as MError).message}`);
          }
        }
      });
    }

    // Validate $setOnInsert (same as $set)
    if (typeof processedUpdateRecord.$setOnInsert !== "undefined") {
      Object.entries(processedUpdateRecord.$setOnInsert).forEach(([path, value]) => {
        const resolved = resolveSchemaAtPath(path);
        if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

        const { schema, isNullable } = resolved;

        if (value === undefined) {
          throw new ValidationError(`Cannot set "${path}" to undefined in $setOnInsert`);
        }

        if (value === null && !isNullable) {
          throw new ValidationError(`Field "${path}" is not nullable`);
        }

        if (value !== null) {
          try {
            schema.parseForUpdate(value);
          } catch (err) {
            throw new ValidationError(`$setOnInsert.${path}: ${(err as MError).message}`);
          }
        }
      });
    }

    // Validate $inc
    if (typeof processedUpdateRecord.$inc !== "undefined") {
      Object.entries(processedUpdateRecord.$inc).forEach(([path, value]) => {
        const resolved = resolveSchemaAtPath(path);
        if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

        const unwrapped = unwrapSchema(resolved.schema);
        if (!(unwrapped instanceof NumberSchema)) {
          throw new ValidationError(
            `$inc can only be used on number fields, but "${path}" is not a number`,
          );
        }

        // Validate the increment value would not violate constraints
        // Note: We can't fully validate min/max without current value, but we validate type
        if (typeof value !== "number") {
          throw new ValidationError(`$inc.${path} must be a number, got ${typeof value}`);
        }
      });
    }

    // Validate $mul
    if (typeof processedUpdateRecord.$mul !== "undefined") {
      Object.entries(processedUpdateRecord.$mul).forEach(([path, value]) => {
        const resolved = resolveSchemaAtPath(path);
        if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

        const unwrapped = unwrapSchema(resolved.schema);
        if (!(unwrapped instanceof NumberSchema)) {
          throw new ValidationError(
            `$mul can only be used on number fields, but "${path}" is not a number`,
          );
        }

        if (typeof value !== "number") {
          throw new ValidationError(`$mul.${path} must be a number, got ${typeof value}`);
        }
      });
    }

    // Validate $min
    if (typeof processedUpdateRecord.$min !== "undefined") {
      Object.entries(processedUpdateRecord.$min).forEach(([path, value]) => {
        const resolved = resolveSchemaAtPath(path);
        if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

        // Validate value matches field type - use parseForUpdate
        try {
          resolved.schema.parseForUpdate(value);
        } catch (err) {
          throw new ValidationError(`$min.${path}: ${(err as MError).message}`);
        }
      });
    }

    // Validate $max
    if (typeof processedUpdateRecord.$max !== "undefined") {
      Object.entries(processedUpdateRecord.$max).forEach(([path, value]) => {
        const resolved = resolveSchemaAtPath(path);
        if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

        // Validate value matches field type - use parseForUpdate
        try {
          resolved.schema.parseForUpdate(value);
        } catch (err) {
          throw new ValidationError(`$max.${path}: ${(err as MError).message}`);
        }
      });
    }

    // Validate $unset
    if (typeof processedUpdateRecord.$unset !== "undefined") {
      Object.entries(processedUpdateRecord.$unset).forEach(([path, _value]) => {
        const resolved = resolveSchemaAtPath(path);
        if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

        // Can only unset optional fields
        if (!resolved.isOptional && !resolved.isNullable) {
          throw new ValidationError(`Cannot unset required field "${path}"`);
        }
      });
    }

    // Validate $currentDate
    if (typeof processedUpdateRecord.$currentDate !== "undefined") {
      Object.entries(processedUpdateRecord.$currentDate).forEach(([path, _value]) => {
        // Skip auto-added timestamp fields
        if (this.options.withTimestamps && (path === "updatedAt" || path === "createdAt")) {
          return;
        }

        const resolved = resolveSchemaAtPath(path);
        if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

        const unwrapped = unwrapSchema(resolved.schema);
        if (!(unwrapped instanceof DateSchema)) {
          throw new ValidationError(
            `$currentDate can only be used on date fields, but "${path}" is not a date`,
          );
        }
      });
    }

    // Validate $push
    if (typeof processedUpdateRecord.$push !== "undefined") {
      Object.entries(processedUpdateRecord.$push).forEach(([path, value]) => {
        const resolved = resolveSchemaAtPath(path);
        if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

        const unwrapped = unwrapSchema(resolved.schema);
        if (!(unwrapped instanceof ArraySchema)) {
          throw new ValidationError(
            `$push can only be used on array fields, but "${path}" is not an array`,
          );
        }

        const elementSchema = unwrapped.getShapes();

        // Handle $each modifier
        if (typeof value === "object" && value !== null && "$each" in value) {
          const eachValue = (value as any).$each;
          if (!Array.isArray(eachValue)) {
            throw new ValidationError(`$push.${path}.$each must be an array`);
          }
          eachValue.forEach((item: any, idx: number) => {
            try {
              elementSchema.parseForUpdate(item);
            } catch (err) {
              throw new ValidationError(`$push.${path}.$each[${idx}]: ${(err as MError).message}`);
            }
          });
        } else {
          // Single value push
          try {
            elementSchema.parseForUpdate(value);
          } catch (err) {
            throw new ValidationError(`$push.${path}: ${(err as MError).message}`);
          }
        }
      });
    }

    // Validate $addToSet
    if (typeof processedUpdateRecord.$addToSet !== "undefined") {
      Object.entries(processedUpdateRecord.$addToSet).forEach(([path, value]) => {
        const resolved = resolveSchemaAtPath(path);
        if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

        const unwrapped = unwrapSchema(resolved.schema);
        if (!(unwrapped instanceof ArraySchema)) {
          throw new ValidationError(
            `$addToSet can only be used on array fields, but "${path}" is not an array`,
          );
        }

        const elementSchema = unwrapped.getShapes();

        // Handle $each modifier
        if (typeof value === "object" && value !== null && "$each" in value) {
          const eachValue = (value as any).$each;
          if (!Array.isArray(eachValue)) {
            throw new ValidationError(`$addToSet.${path}.$each must be an array`);
          }
          eachValue.forEach((item: any, idx: number) => {
            try {
              elementSchema.parseForUpdate(item);
            } catch (err) {
              throw new ValidationError(
                `$addToSet.${path}.$each[${idx}]: ${(err as MError).message}`,
              );
            }
          });
        } else {
          // Single value
          try {
            elementSchema.parseForUpdate(value);
          } catch (err) {
            throw new ValidationError(`$addToSet.${path}: ${(err as MError).message}`);
          }
        }
      });
    }

    // Validate $pull
    if (typeof processedUpdateRecord.$pull !== "undefined") {
      Object.entries(processedUpdateRecord.$pull).forEach(([path, value]) => {
        const resolved = resolveSchemaAtPath(path);
        if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

        const unwrapped = unwrapSchema(resolved.schema);
        if (!(unwrapped instanceof ArraySchema)) {
          throw new ValidationError(
            `$pull can only be used on array fields, but "${path}" is not an array`,
          );
        }

        const elementSchema = unwrapped.getShapes();

        // $pull can be a value or a query condition
        // For simplicity, validate if it's not an object (query), otherwise it's a simple value
        if (typeof value !== "object" || value === null) {
          try {
            elementSchema.parseForUpdate(value);
          } catch (err) {
            throw new ValidationError(`$pull.${path}: ${(err as MError).message}`);
          }
        }
        // For query objects, we'd need more complex validation - skip for now
      });
    }

    // Validate $pullAll
    if (typeof processedUpdateRecord.$pullAll !== "undefined") {
      Object.entries(processedUpdateRecord.$pullAll).forEach(([path, values]) => {
        const resolved = resolveSchemaAtPath(path);
        if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

        const unwrapped = unwrapSchema(resolved.schema);
        if (!(unwrapped instanceof ArraySchema)) {
          throw new ValidationError(
            `$pullAll can only be used on array fields, but "${path}" is not an array`,
          );
        }

        const elementSchema = unwrapped.getShapes();

        if (!Array.isArray(values)) {
          throw new ValidationError(`$pullAll.${path} must be an array`);
        }

        values.forEach((item: any, idx: number) => {
          try {
            elementSchema.parseForUpdate(item);
          } catch (err) {
            throw new ValidationError(`$pullAll.${path}[${idx}]: ${(err as MError).message}`);
          }
        });
      });
    }

    // Validate $pop
    if (typeof processedUpdateRecord.$pop !== "undefined") {
      Object.entries(processedUpdateRecord.$pop).forEach(([path, _value]) => {
        const resolved = resolveSchemaAtPath(path);
        if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

        const unwrapped = unwrapSchema(resolved.schema);
        if (!(unwrapped instanceof ArraySchema)) {
          throw new ValidationError(
            `$pop can only be used on array fields, but "${path}" is not an array`,
          );
        }
      });
    }

    // Validate $rename
    if (typeof processedUpdateRecord.$rename !== "undefined") {
      Object.entries(processedUpdateRecord.$rename).forEach(([sourcePath, targetPath]) => {
        if (typeof targetPath !== "string") {
          throw new ValidationError(`$rename.${sourcePath} must be a string`);
        }

        const sourceResolved = resolveSchemaAtPath(sourcePath);
        if (!sourceResolved)
          throw new ValidationError(`Source field "${sourcePath}" does not exist in schema`);

        const targetResolved = resolveSchemaAtPath(targetPath);
        if (!targetResolved)
          throw new ValidationError(`Target field "${targetPath}" does not exist in schema`);

        // Check type compatibility - compare constructor names
        const sourceUnwrapped = unwrapSchema(sourceResolved.schema);
        const targetUnwrapped = unwrapSchema(targetResolved.schema);

        if (sourceUnwrapped.constructor.name !== targetUnwrapped.constructor.name) {
          throw new ValidationError(
            `Cannot rename "${sourcePath}" to "${targetPath}": incompatible types`,
          );
        }
      });
    }

    return processedUpdateRecord;
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
