import type { Filter, IndexSpecification } from "mongodb";
import { MError } from "../error";
import type { AllFilterKeys } from "../types/types.query";
import type {
  IndexDirection,
  IndexOptions,
  MongsterSchemaOptions,
  ObjectOutput,
  Resolve,
  SchemaMeta,
  ValidatorFunc,
  WithTimestamps,
} from "../types/types.schema";

export abstract class MongsterSchemaBase<T> {
  declare $type: T;

  #meta: SchemaMeta<T> = { options: {} };

  abstract clone(): this;
  abstract parse(v: unknown): T;

  getMeta(): SchemaMeta<T> {
    return this.#meta;
  }
  setMeta(meta: SchemaMeta<T>) {
    this.#meta = meta;
  }

  index(direction: IndexDirection = 1): this {
    const clone = this.clone();
    clone.#meta = { ...this.#meta, options: { ...this.#meta.options }, index: direction };
    return clone;
  }

  uniqueIndex(): this {
    const clone = this.clone();
    clone.#meta = {
      ...this.#meta,
      options: { ...this.#meta.options, unique: true },
      index: this.#meta.index ?? 1,
    };
    return clone;
  }

  sparseIndex(): this {
    const clone = this.clone();
    clone.#meta = {
      ...this.#meta,
      options: { ...this.#meta.options, sparse: true },
      index: this.#meta.index ?? 1,
    };
    return clone;
  }

  partialIndex(expr: Filter<T>): this {
    const clone = this.clone();
    clone.#meta = {
      ...this.#meta,
      options: { ...this.#meta.options, partialFilterExpression: expr },
      index: this.#meta.index ?? 1,
    };
    return clone;
  }

  hashedIndex(): this {
    const clone = this.clone();
    clone.#meta = { ...this.#meta, options: { ...this.#meta.options }, index: "hashed" };
    return clone;
  }

  textIndex(): this {
    const clone = this.clone();
    clone.#meta = { ...this.#meta, options: { ...this.#meta.options }, index: "text" };
    return clone;
  }

  optional() {
    return new OptionalSchema<T>(this);
  }

  nullable() {
    return new NullableSchema<T>(this);
  }

  array() {
    return new ArraySchema<T>(this);
  }

  /**
   * Custom validation method for your schema
   */
  validate(validator: ValidatorFunc<T>, message?: string) {
    return new CustomValidationSchema<T>(this, validator, message);
  }
}

class CustomValidationSchema<T> extends MongsterSchemaBase<T> {
  declare $type: T;

  // @internal used internally
  protected inner: MongsterSchemaBase<T>;

  #validator: ValidatorFunc<T>;
  #msg?: string;

  constructor(inner: MongsterSchemaBase<T>, validator: ValidatorFunc<T>, msg?: string) {
    super();
    this.#validator = validator;
    this.#msg = msg;
    this.inner = inner;
  }

  clone(): this {
    return new CustomValidationSchema(this.inner, this.#validator, this.#msg) as this;
  }

  parse(v: unknown): T {
    const parsed = this.inner.parse(v);
    const validated = this.#validator(parsed);
    if (!validated) throw new MError(this.#msg ?? `Custom validation failed`);
    return parsed;
  }
}

export class OptionalSchema<T> extends MongsterSchemaBase<T | undefined> {
  declare $type: T | undefined;

  // @internal used internally
  protected inner: MongsterSchemaBase<T>;

  constructor(inner: MongsterSchemaBase<T>) {
    super();
    this.inner = inner;
  }

  clone(): this {
    return new OptionalSchema(this.inner) as this;
  }

  parse(v: unknown): T | undefined {
    return v === undefined ? undefined : this.inner.parse(v);
  }
}

export class NullableSchema<T> extends MongsterSchemaBase<T | null> {
  declare $type: T | null;

  // @internal used internally
  protected inner: MongsterSchemaBase<T>;

  constructor(inner: MongsterSchemaBase<T>) {
    super();
    this.inner = inner;
  }

  clone(): this {
    return new NullableSchema(this.inner) as this;
  }

  parse(v: unknown): T | null {
    return v === null ? null : this.inner.parse(v);
  }
}

interface ArrayChecks<A> {
  min?: number;
  max?: number;
  default?: A;
}

export class ArraySchema<T> extends MongsterSchemaBase<T[]> {
  declare $type: T[];

  #shapes: MongsterSchemaBase<T>;
  #checks: ArrayChecks<T[]>;

  constructor(shapes: MongsterSchemaBase<T>, checks: ArrayChecks<T[]> = {}) {
    super();
    this.#shapes = shapes;
    this.#checks = checks;
  }

  min(n: number): ArraySchema<T> {
    return new ArraySchema(this.#shapes, { ...this.#checks, min: n });
  }

  max(n: number): ArraySchema<T> {
    return new ArraySchema(this.#shapes, { ...this.#checks, max: n });
  }

  default(d: T[]): ArraySchema<T> {
    return new ArraySchema(this.#shapes, { ...this.#checks, default: d });
  }

  clone(): this {
    return new ArraySchema(this.#shapes, { ...this.#checks }) as this;
  }

  parse(v: unknown): T[] {
    if (typeof v === "undefined" && typeof this.#checks.default !== "undefined") {
      return this.#checks.default;
    }

    if (!Array.isArray(v)) throw new MError("Expected an array");

    const arrLength = v.length;
    if (typeof this.#checks.min !== "undefined" && arrLength < this.#checks.min) {
      throw new MError(`Array length must be greater than or equal to ${this.#checks.min}`);
    }
    if (typeof this.#checks.max !== "undefined" && arrLength > this.#checks.max) {
      throw new MError(`Array length must be less than or equal to ${this.#checks.max}`);
    }

    return v.map((x, i) => {
      try {
        return this.#shapes.parse(x);
      } catch (err) {
        throw new MError(`[${i}] ${(err as Error).message}`, {
          cause: err,
        });
      }
    });
  }
}

/**
 * The schema that goes to collection
 */
export class MongsterSchema<
  T extends Record<string, MongsterSchemaBase<any>>,
  $T = Resolve<ObjectOutput<T>>,
> extends MongsterSchemaBase<$T> {
  declare $type: $T;
  declare $brand: "MongsterSchema";

  protected rootIndexes: IndexSpecification[] = [];
  protected options: MongsterSchemaOptions = {};

  #shape: T;

  constructor(shape: T) {
    super();
    this.#shape = shape;
  }

  withTimestamps(): MongsterSchema<T, WithTimestamps<$T>> {
    const clone = this.clone();
    clone.options = { ...this.options, withTimestamps: true };
    return clone as MongsterSchema<T, WithTimestamps<$T>>;
  }

  createIndex<K extends AllFilterKeys<$T>>(
    keys: Record<K, IndexDirection>,
    options?: IndexOptions<$T>,
  ): this {
    this.rootIndexes.push({ key: keys, ...(options as any) });
    return this;
  }

  clone(): this {
    return new MongsterSchema(this.#shape) as this;
  }

  parse(v: unknown): $T {
    if (typeof v !== "object" || v === null) throw new MError("Expected an object");
    if (Array.isArray(v)) throw new MError("Expected an object, but received an array");

    const out: Record<string, unknown> = {};
    for (const [k, s] of Object.entries(this.#shape)) {
      try {
        out[k] = (s as MongsterSchemaBase<any>).parse((v as any)[k]);
      } catch (err) {
        throw new MError(`${k}: ${(err as MError).message}`, {
          cause: err,
        });
      }
    }
    return out as $T;
  }

  /**
   * recursively gather all index specifications declared via:
   *  - field-level schema meta (`index()`, `unique()`, `sparse()`, `text()`, `hashed()`, `ttl()`)
   *  - root-level `createIndex()` calls on this (and nested `MongsterSchema` instances)
   * nested keys use MongoDB dot notation (e.g. `address.zip`).
   */
  collectIndexes(): IndexSpecification[] {
    const collected: IndexSpecification[] = [...this.rootIndexes];

    function pushFieldIndex(path: string, schema: MongsterSchemaBase<any>) {
      const meta = schema.getMeta();
      if (meta && typeof meta.index !== "undefined") {
        const opts =
          meta.options && Object.keys(meta.options).length ? { ...meta.options } : undefined;
        collected.push({
          key: { [path]: meta.index },
          ...(opts as any),
        });
      }
    }

    function unwrap(s: MongsterSchemaBase<any>): MongsterSchemaBase<any> {
      let cur: any = s;
      while (cur && cur.inner instanceof MongsterSchemaBase) cur = cur.inner;
      return cur as MongsterSchemaBase<any>;
    }

    function walkShape(shape: Record<string, MongsterSchemaBase<any>>, parent: string) {
      for (const [k, rawSchema] of Object.entries(shape)) {
        const path = parent ? `${parent}.${k}` : k;
        collect(rawSchema, path);
      }
    }

    function collect(schema: MongsterSchemaBase<any>, path: string) {
      pushFieldIndex(path, schema);
      const unwrapped = unwrap(schema);
      if (unwrapped !== schema) pushFieldIndex(path, unwrapped);

      if (unwrapped instanceof MongsterSchema) {
        for (const idxRaw of (unwrapped as any).rootIndexes as IndexSpecification[]) {
          const idx: any = idxRaw as any;
          if (idx && typeof idx === "object" && idx.key && typeof idx.key === "object") {
            const newKey: any = {};
            for (const [k, v] of Object.entries(idx.key as Record<string, any>)) {
              newKey[`${path}.${k}`] = v;
            }
            const cloned: any = { ...idx };
            cloned.key = newKey;
            collected.push(cloned);
          }
        }
        walkShape((unwrapped as any).shape, path);
      } else if ((unwrapped as any).shape && typeof (unwrapped as any).shape === "object") {
        walkShape((unwrapped as any).shape, path);
      } else if (unwrapped instanceof ArraySchema) {
        const inner = (unwrapped as any).shapes as MongsterSchemaBase<any>;
        if (inner) collect(inner, path);
      }
    }

    walkShape(this.#shape, "");

    return collected;
  }
}
