import { MError, ValidationError } from "../error";
import {
  ArraySchema,
  type MongsterSchemaBase,
  MongsterSchemaInternal,
  NullableSchema,
  OptionalSchema,
} from "../schema/base";
import { ObjectSchema } from "../schema/composites";
import { DateSchema, NumberSchema } from "../schema/primitives";
import type { MongsterUpdateFilter } from "../types/types.filter";
import type { MongsterSchemaOptions } from "../types/types.schema";

export function unwrapSchema(s: MongsterSchemaBase<any>): MongsterSchemaInternal<any> {
  let cur: any = s;
  while (cur && cur.inner instanceof MongsterSchemaInternal) cur = cur.inner;
  return cur as MongsterSchemaInternal<any>;
}

export function processOperators<$T>(
  updateObj: MongsterUpdateFilter<$T>,
): MongsterUpdateFilter<$T> {
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
 * tests array index notation (e.g., "tags.0" or "users.0.name")
 */
const ARRAY_INDEX_NOTATION_REGEX = /^\d+$/;

export function resolveSchemaAtPath(
  path: string,
  shape: Record<string, MongsterSchemaInternal<any>>,
): { schema: MongsterSchemaInternal<any>; isOptional: boolean; isNullable: boolean } | null {
  const segments = path.split(".");

  let currentSchema: MongsterSchemaInternal<any> | undefined;
  let currentShape: Record<string, MongsterSchemaInternal<any>> = shape;

  let isOptional = false;
  let isNullable = false;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment || segment.trim() === "") continue;

    if (ARRAY_INDEX_NOTATION_REGEX.test(segment)) {
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

    if (currentSchema instanceof OptionalSchema) {
      isOptional = true;
      currentSchema = currentSchema.inner;
    }
    if (currentSchema instanceof NullableSchema) {
      isNullable = true;
      currentSchema = currentSchema.inner;
    }

    if (!currentSchema) {
      throw new ValidationError(
        `Field "${segments.slice(0, i + 1).join(".")}" is undefined after unwrapping`,
      );
    }

    const unwrapped = unwrapSchema(currentSchema);

    if (i < segments.length - 1) {
      if (unwrapped instanceof ObjectSchema) {
        currentShape = unwrapped.getShape();
      } else if (unwrapped instanceof ArraySchema) {
        // next segment should be either an index or we continue with array element schema
        const nextSegment = segments[i + 1];
        if (!nextSegment || !ARRAY_INDEX_NOTATION_REGEX.test(nextSegment)) {
          // will be treated as nested field in array element
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
}

export function validateUpdateRecord<$T>(
  processedRecord: MongsterUpdateFilter<$T>,
  shape: Record<string, MongsterSchemaInternal<any>>,
  schemaOptions?: MongsterSchemaOptions,
) {
  // $set
  if (typeof processedRecord.$set !== "undefined") {
    Object.entries(processedRecord.$set).forEach(([path, value]) => {
      const resolved = resolveSchemaAtPath(path, shape);
      if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

      if (typeof value === "undefined") {
        throw new ValidationError(`Cannot set "${path}" to undefined, use $unset instead`);
      } else if (value === null) {
        if (!resolved.isNullable) throw new ValidationError(`Field "${path}" is not nullable`);
      } else {
        try {
          resolved.schema.parseForUpdate(value);
        } catch (err) {
          throw new ValidationError(`$set.${path}: ${(err as MError).message}`);
        }
      }
    });
  }

  // $setOnInsert
  if (typeof processedRecord.$setOnInsert !== "undefined") {
    Object.entries(processedRecord.$setOnInsert).forEach(([path, value]) => {
      const resolved = resolveSchemaAtPath(path, shape);
      if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

      if (typeof value === "undefined") {
        throw new ValidationError(`Cannot set "${path}" to undefined in $setOnInsert`);
      } else if (value === null) {
        if (!resolved.isNullable) throw new ValidationError(`Field "${path}" is not nullable`);
      } else {
        try {
          resolved.schema.parseForUpdate(value);
        } catch (err) {
          if (err instanceof MError) {
            throw new ValidationError(`$setOnInsert.${path}: ${err.message}`);
          }
          throw new ValidationError(`$setOnInsert.${path}: Something did not add up`);
        }
      }
    });
  }

  // $unset
  if (typeof processedRecord.$unset !== "undefined") {
    Object.entries(processedRecord.$unset).forEach(([path, _value]) => {
      const resolved = resolveSchemaAtPath(path, shape);
      if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);
      if (!resolved.isOptional) throw new ValidationError(`Cannot unset required field "${path}"`);
    });
  }

  // $inc
  if (typeof processedRecord.$inc !== "undefined") {
    Object.entries(processedRecord.$inc).forEach(([path, value]) => {
      const resolved = resolveSchemaAtPath(path, shape);
      if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

      if (typeof value !== "number") {
        throw new ValidationError(`$inc.${path} must be a number, got ${typeof value}`);
      }

      const unwrapped = unwrapSchema(resolved.schema);
      if (!(unwrapped instanceof NumberSchema)) {
        throw new ValidationError(
          `$inc can only be used on number fields, but "${path}" is not a number`,
        );
      }
    });
  }

  // $mul
  if (typeof processedRecord.$mul !== "undefined") {
    Object.entries(processedRecord.$mul).forEach(([path, value]) => {
      const resolved = resolveSchemaAtPath(path, shape);
      if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

      if (typeof value !== "number") {
        throw new ValidationError(`$mul.${path} must be a number, got ${typeof value}`);
      }

      const unwrapped = unwrapSchema(resolved.schema);
      if (!(unwrapped instanceof NumberSchema)) {
        throw new ValidationError(
          `$mul can only be used on number fields, but "${path}" is not a number`,
        );
      }
    });
  }

  // $min
  if (typeof processedRecord.$min !== "undefined") {
    Object.entries(processedRecord.$min).forEach(([path, value]) => {
      const resolved = resolveSchemaAtPath(path, shape);
      if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

      try {
        resolved.schema.parseForUpdate(value);
      } catch (err) {
        if (err instanceof MError) throw new ValidationError(`$min.${path}: ${err.message}`);
        throw new ValidationError(`$min.${path}: Something did not add up`);
      }
    });
  }

  // $max
  if (typeof processedRecord.$max !== "undefined") {
    Object.entries(processedRecord.$max).forEach(([path, value]) => {
      const resolved = resolveSchemaAtPath(path, shape);
      if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

      try {
        resolved.schema.parseForUpdate(value);
      } catch (err) {
        if (err instanceof MError) throw new ValidationError(`$max.${path}: ${err.message}`);
        throw new ValidationError(`$max.${path}: Something did not add up`);
      }
    });
  }

  // $currentDate
  if (typeof processedRecord.$currentDate !== "undefined") {
    Object.entries(processedRecord.$currentDate).forEach(([path, _value]) => {
      if (schemaOptions?.withTimestamps && (path === "updatedAt" || path === "createdAt")) {
        // auto updated fields are skipped
        return;
      }

      const resolved = resolveSchemaAtPath(path, shape);
      if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

      const unwrapped = unwrapSchema(resolved.schema);
      if (!(unwrapped instanceof DateSchema)) {
        throw new ValidationError(
          `$currentDate can only be used on date fields, but "${path}" is not a date`,
        );
      }
    });
  }

  // $addToSet
  if (typeof processedRecord.$addToSet !== "undefined") {
    Object.entries(processedRecord.$addToSet).forEach(([path, value]) => {
      const resolved = resolveSchemaAtPath(path, shape);
      if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

      const unwrapped = unwrapSchema(resolved.schema);
      if (!(unwrapped instanceof ArraySchema)) {
        throw new ValidationError(
          `$addToSet can only be used on array fields, but "${path}" is not an array`,
        );
      }

      const elementSchema = unwrapped.getShapes();

      if (typeof value === "object" && value !== null && "$each" in value) {
        const eachValue = value.$each;
        if (!Array.isArray(eachValue)) {
          throw new ValidationError(`$addToSet.${path}.$each must be an array`);
        }
        eachValue.forEach((item, idx) => {
          try {
            elementSchema.parseForUpdate(item);
          } catch (err) {
            const errPath = `$addToSet.${path}.$each[${idx}]`;
            if (err instanceof MError) throw new ValidationError(`${errPath}: ${err.message}`);
            throw new ValidationError(`${errPath}: Something did not add up`);
          }
        });
      } else {
        try {
          elementSchema.parseForUpdate(value);
        } catch (err) {
          const errPath = `$addToSet.${path}`;
          if (err instanceof MError) throw new ValidationError(`${errPath}: ${err.message}`);
          throw new ValidationError(`${errPath}: Something did not add up`);
        }
      }
    });
  }

  // $push
  if (typeof processedRecord.$push !== "undefined") {
    Object.entries(processedRecord.$push).forEach(([path, value]) => {
      const resolved = resolveSchemaAtPath(path, shape);
      if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

      const unwrapped = unwrapSchema(resolved.schema);
      if (!(unwrapped instanceof ArraySchema)) {
        throw new ValidationError(
          `$push can only be used on array fields, but "${path}" is not an array`,
        );
      }

      const elementSchema = unwrapped.getShapes();

      if (typeof value === "object" && value !== null && "$each" in value) {
        const eachValue = value.$each;
        if (!Array.isArray(eachValue)) {
          throw new ValidationError(`$push.${path}.$each must be an array`);
        }
        eachValue.forEach((item, idx) => {
          try {
            elementSchema.parseForUpdate(item);
          } catch (err) {
            const errPath = `$push.${path}.$each[${idx}]`;
            if (err instanceof MError) throw new ValidationError(`${errPath}: ${err.message}`);
            throw new ValidationError(`${errPath}: Something did not add up`);
          }
        });
      } else {
        try {
          elementSchema.parseForUpdate(value);
        } catch (err) {
          const errPath = `$push.${path}`;
          if (err instanceof MError) throw new ValidationError(`${errPath}: ${err.message}`);
          throw new ValidationError(`${errPath}: Something did not add up`);
        }
      }
    });
  }

  // $pull
  if (typeof processedRecord.$pull !== "undefined") {
    Object.entries(processedRecord.$pull).forEach(([path, value]) => {
      const resolved = resolveSchemaAtPath(path, shape);
      if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

      const unwrapped = unwrapSchema(resolved.schema);
      if (!(unwrapped instanceof ArraySchema)) {
        throw new ValidationError(
          `$pull can only be used on array fields, but "${path}" is not an array`,
        );
      }

      const elementSchema = unwrapped.getShapes();

      if (typeof value !== "object" || value === null) {
        try {
          elementSchema.parseForUpdate(value);
        } catch (err) {
          const errPath = `$pull.${path}`;
          if (err instanceof MError) throw new ValidationError(`${errPath}: ${err.message}`);
          throw new ValidationError(`${errPath}: Something did not add up`);
        }
      }
    });
  }

  // $pullAll
  if (typeof processedRecord.$pullAll !== "undefined") {
    Object.entries(processedRecord.$pullAll).forEach(([path, values]) => {
      const resolved = resolveSchemaAtPath(path, shape);
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
          const errPath = `$pullAll.${path}[${idx}]`;
          if (err instanceof MError) throw new ValidationError(`${errPath}: ${err.message}`);
          throw new ValidationError(`${errPath}: Something did not add up`);
        }
      });
    });
  }

  // $pop
  if (typeof processedRecord.$pop !== "undefined") {
    Object.entries(processedRecord.$pop).forEach(([path, _value]) => {
      const resolved = resolveSchemaAtPath(path, shape);
      if (!resolved) throw new ValidationError(`Field "${path}" does not exist in schema`);

      const unwrapped = unwrapSchema(resolved.schema);
      if (!(unwrapped instanceof ArraySchema)) {
        throw new ValidationError(
          `$pop can only be used on array fields, but "${path}" is not an array`,
        );
      }
    });
  }

  // $rename
  if (typeof processedRecord.$rename !== "undefined") {
    Object.entries(processedRecord.$rename).forEach(([sourcePath, targetPath]) => {
      if (typeof targetPath !== "string") {
        throw new ValidationError(`$rename.${sourcePath} must be a string`);
      }

      const sourceResolved = resolveSchemaAtPath(sourcePath, shape);
      if (!sourceResolved) {
        throw new ValidationError(`Source field "${sourcePath}" does not exist in schema`);
      }

      const targetResolved = resolveSchemaAtPath(targetPath, shape);
      if (!targetResolved) {
        throw new ValidationError(`Target field "${targetPath}" does not exist in schema`);
      }

      const sourceUnwrapped = unwrapSchema(sourceResolved.schema);
      const targetUnwrapped = unwrapSchema(targetResolved.schema);
      if (sourceUnwrapped.constructor.name !== targetUnwrapped.constructor.name) {
        throw new ValidationError(
          `Cannot rename "${sourcePath}" to "${targetPath}": incompatible types`,
        );
      }
    });
  }

  return processedRecord;
}
