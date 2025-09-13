import type { Filter, IndexSpecification } from "mongodb";
import { MongsTerror } from "../error";
import type { PositiveNumber } from "../types/types.common";
import type { DotSeparatedKeys } from "../types/types.query";
import type {
  IndexDirection,
  IndexOptions,
  MongsterSchemaOptions,
  ObjectOutput,
  Resolve,
  SchemaMeta,
  WithTimestamps,
} from "../types/types.schema";

export abstract class MongsterSchemaBase<T> {
  declare $type: T;

  protected meta: SchemaMeta<T> = {
    options: {},
  };

  abstract parse(v: unknown): T;

  protected abstract clone(): this;

  index(dir: IndexDirection = 1): this {
    const copy = this.clone();
    copy.meta.index = dir;
    return copy;
  }

  unique(): this {
    const copy = this.clone();
    copy.meta.options = { ...copy.meta.options, unique: true };
    copy.meta.index ??= 1;
    return copy;
  }

  sparse(): this {
    const copy = this.clone();
    copy.meta.options = { ...copy.meta.options, sparse: true };
    copy.meta.index ??= 1;
    return copy;
  }

  partial(expr: Filter<T>): this {
    const copy = this.clone();
    copy.meta.options = {
      ...copy.meta.options,
      partialFilterExpression: expr,
    };
    copy.meta.index ??= 1;
    return copy;
  }

  hashed(): this {
    const copy = this.clone();
    copy.meta.index = "hashed";
    return copy;
  }

  text(): this {
    const copy = this.clone();
    copy.meta.index = "text";
    return copy;
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
  validate(validator: (v: T) => boolean) {
    return new CustomValidationSchema<T>(this, validator);
  }
}

export abstract class MSchemaBaseInternal<T> extends MongsterSchemaBase<T> {
  declare $type: T;

  checks: object = {};
  inner: MongsterSchemaBase<T> | undefined;
}

class CustomValidationSchema<T> extends MongsterSchemaBase<T> {
  declare $type: T;

  // @internal used internally
  protected inner: MongsterSchemaBase<T>;

  constructor(
    inner: MongsterSchemaBase<T>,
    private validator: (v: T) => boolean,
    private msg?: string,
  ) {
    super();
    this.inner = inner;
  }

  protected clone(): this {
    return new CustomValidationSchema(this.inner, this.validator, this.msg) as this;
  }

  parse(v: unknown): T {
    const validated = this.validator(v as any);
    if (!validated) throw new MongsTerror(this.msg ?? `Custom validation failed`);
    return this.inner.parse(v);
  }
}

export class OptionalSchema<T> extends MongsterSchemaBase<T | undefined> {
  declare _type: T | undefined;

  // @internal used internally
  protected inner: MongsterSchemaBase<T>;

  constructor(inner: MongsterSchemaBase<T>) {
    super();
    this.inner = inner;
  }

  protected clone(): this {
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

  protected clone(): this {
    return new NullableSchema(this.inner) as this;
  }

  parse(v: unknown): T | null {
    return v === null ? null : this.inner.parse(v);
  }
}

type ArrayChecks<DA> = {
  min?: number;
  max?: number;
  default?: DA;
};

export class ArraySchema<T> extends MongsterSchemaBase<T[]> {
  declare $type: T[];

  constructor(
    private shapes: MongsterSchemaBase<T>,
    private checks: ArrayChecks<T[]> = {},
  ) {
    super();
  }

  protected clone(): this {
    return new ArraySchema(this.shapes, this.checks) as this;
  }

  min<N extends number>(n: PositiveNumber<N>): ArraySchema<T> {
    return new ArraySchema(this.shapes, { ...this.checks, min: n as N });
  }

  max<N extends number>(n: PositiveNumber<N>): ArraySchema<T> {
    return new ArraySchema(this.shapes, { ...this.checks, max: n as N });
  }

  default(d: T[]): ArraySchema<T> {
    return new ArraySchema(this.shapes, { ...this.checks, default: d });
  }

  parse(v: unknown): T[] {
    if (typeof v === "undefined" && typeof this.checks.default !== "undefined") {
      return this.checks.default;
    }

    if (!Array.isArray(v)) throw new MongsTerror("Expected an array");

    const arrLength = v.length;
    if (typeof this.checks.min !== "undefined" && arrLength < this.checks.min) {
      throw new MongsTerror(`Array length must be greater than or equal to ${this.checks.min}`);
    }
    if (typeof this.checks.max !== "undefined" && arrLength > this.checks.max) {
      throw new MongsTerror(`Array length must be less than or equal to ${this.checks.max}`);
    }

    return v.map((x, i) => {
      try {
        return this.shapes.parse(x);
      } catch (err) {
        throw new MongsTerror(`[${i}] ${(err as Error).message}`, {
          cause: err,
        });
      }
    });
  }
}

/**
 * The one that goes to collection
 */
export class MongsterSchema<
  T extends Record<string, MongsterSchemaBase<any>>,
  ResolvedObj = Resolve<ObjectOutput<T>>,
> extends MongsterSchemaBase<ResolvedObj> {
  declare $type: ResolvedObj;

  protected rootIndexes: IndexSpecification[] = [];
  protected options: MongsterSchemaOptions = {};

  constructor(protected shape: T) {
    super();
  }

  protected clone(): this {
    return new MongsterSchema({ ...this.shape }) as this;
  }

  withTimestamps(): MongsterSchema<T, WithTimestamps<ResolvedObj>> {
    const proxySchema = new MongsterSchema<T, WithTimestamps<ResolvedObj>>(this.shape);
    proxySchema.options = { withTimestamps: true };
    return proxySchema;
  }

  createIndex<K extends DotSeparatedKeys<ResolvedObj>>(
    keys: Record<K, 1 | -1 | "text" | "hashed">,
    options?: IndexOptions<ResolvedObj>,
  ): this {
    this.rootIndexes.push({ key: keys, ...(options as any) });
    return this;
  }

  parse(v: unknown): ResolvedObj {
    if (typeof v !== "object" || v === null) throw new MongsTerror("Expected an object");
    if (Array.isArray(v)) throw new MongsTerror("Expected an object, but received an array");

    const out: any = {};
    for (const [k, s] of Object.entries(this.shape)) {
      try {
        out[k] = (s as MongsterSchemaBase<any>).parse((v as any)[k]);
      } catch (err) {
        throw new MongsTerror(`${k}: ${(err as Error).message}`, {
          cause: err,
        });
      }
    }
    return out as ResolvedObj;
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
      const meta = (schema as any).meta as SchemaMeta<any> | undefined;
      if (meta && typeof meta.index !== "undefined") {
        const opts =
          meta.options && Object.keys(meta.options).length ? { ...meta.options } : undefined;
        collected.push({
          key: { [path]: meta.index } as any,
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

    walkShape(this.shape, "");

    return collected;
  }
}
