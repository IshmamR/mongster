import type { Filter } from "mongodb";
import { MError } from "../error";
import type { MongsterIndexDirection, SchemaMeta, ValidatorFunc } from "../types/types.schema";

export abstract class MongsterSchemaBase<T, I = T & any> {
  declare $type: T;
  declare $input: I;

  #idxMeta: SchemaMeta<T> = { options: {} };

  abstract clone(): this;
  abstract parse(v: unknown): T;

  getIdxMeta(): SchemaMeta<T> {
    return this.#idxMeta;
  }
  setIdxMeta(meta: SchemaMeta<T>): void {
    this.#idxMeta = meta;
  }

  index(direction: MongsterIndexDirection = 1): this {
    const clone = this.clone();
    clone.#idxMeta = {
      ...this.#idxMeta,
      options: { ...this.#idxMeta.options },
      index: direction,
    };
    return clone;
  }

  uniqueIndex(): this {
    const clone = this.clone();
    clone.#idxMeta = {
      ...this.#idxMeta,
      options: { ...this.#idxMeta.options, unique: true },
      index: this.#idxMeta.index ?? 1,
    };
    return clone;
  }

  sparseIndex(): this {
    const clone = this.clone();
    clone.#idxMeta = {
      ...this.#idxMeta,
      options: { ...this.#idxMeta.options, sparse: true },
      index: this.#idxMeta.index ?? 1,
    };
    return clone;
  }

  partialIndex(expr: Filter<T>): this {
    const clone = this.clone();
    clone.#idxMeta = {
      ...this.#idxMeta,
      options: { ...this.#idxMeta.options, partialFilterExpression: expr },
      index: this.#idxMeta.index ?? 1,
    };
    return clone;
  }

  hashedIndex(): this {
    const clone = this.clone();
    clone.#idxMeta = {
      ...this.#idxMeta,
      options: { ...this.#idxMeta.options },
      index: "hashed",
    };
    return clone;
  }

  textIndex(): this {
    const clone = this.clone();
    clone.#idxMeta = {
      ...this.#idxMeta,
      options: { ...this.#idxMeta.options },
      index: "text",
    };
    return clone;
  }

  optional(): OptionalSchema<T> {
    return new OptionalSchema<T>(this);
  }

  nullable(): NullableSchema<T> {
    return new NullableSchema<T>(this);
  }

  array(): ArraySchema<T, I> {
    return new ArraySchema<T, I>(this);
  }

  /**
   * Custom validation method for your schema
   */
  validate(validator: ValidatorFunc<T>, message?: string): CustomValidationSchema<T> {
    return new CustomValidationSchema<T>(this, validator, message);
  }
}

class CustomValidationSchema<T> extends MongsterSchemaBase<T, T> {
  declare $type: T;
  declare $input: T;

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

export class WithDefaultSchema<T> extends MongsterSchemaBase<T, T | undefined> {
  declare $type: T;
  declare $input: T | undefined;

  // @internal used internally
  protected inner: MongsterSchemaBase<T>;

  constructor(inner: MongsterSchemaBase<T>) {
    super();
    this.inner = inner;
  }

  clone(): this {
    return new WithDefaultSchema(this.inner) as this;
  }

  parse(v: unknown): T {
    return this.inner.parse(v);
  }
}

export class OptionalSchema<T> extends MongsterSchemaBase<T | undefined, T | undefined> {
  declare $type: T | undefined;
  declare $input: T | undefined;

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

export class NullableSchema<T> extends MongsterSchemaBase<T | null, T | null> {
  declare $type: T | null;
  declare $input: T | null;

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
  defaultFn?: () => A;
}

export class ArraySchema<T, I> extends MongsterSchemaBase<T[], I[]> {
  declare $type: T[];
  declare $input: I[];

  #shapes: MongsterSchemaBase<T, I>;
  #checks: ArrayChecks<T[]>;

  constructor(shapes: MongsterSchemaBase<T, I>, checks: ArrayChecks<T[]> = {}) {
    super();
    this.#shapes = shapes;
    this.#checks = checks;
  }

  getShapes(): MongsterSchemaBase<T, I> {
    return this.#shapes;
  }

  min(n: number): ArraySchema<T, I> {
    return new ArraySchema(this.#shapes, { ...this.#checks, min: n });
  }

  max(n: number): ArraySchema<T, I> {
    return new ArraySchema(this.#shapes, { ...this.#checks, max: n });
  }

  default(d: T[]): WithDefaultSchema<T[]> {
    const arrSchema = new ArraySchema(this.#shapes, { ...this.#checks, default: d });
    return new WithDefaultSchema(arrSchema);
  }

  defaultFn(fn: () => T[]): WithDefaultSchema<T[]> {
    const arrSchema = new ArraySchema(this.#shapes, { ...this.#checks, defaultFn: fn });
    return new WithDefaultSchema(arrSchema);
  }

  clone(): this {
    return new ArraySchema(this.#shapes, { ...this.#checks }) as this;
  }

  parse(v: unknown): T[] {
    if (typeof v === "undefined") {
      if (typeof this.#checks.default !== "undefined") return this.#checks.default;
      if (typeof this.#checks.defaultFn === "function") return this.#checks.defaultFn();
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
