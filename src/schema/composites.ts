import type { IndexDescription } from "mongodb";
import { MError } from "../error";
import type { AllFilterKeys } from "../types/types.query";
import type {
  MongsterIndexDirection,
  MongsterIndexOptions,
  MongsterSchemaOptions,
  ObjectInput,
  ObjectOutput,
  Resolve,
  ResolveTuple,
  WithTimestamps,
} from "../types/types.schema";
import { MongsterSchemaInternal, WithDefaultSchema } from "./base";
import { MongsterSchema } from "./schema";

interface ObjectChecks<O> {
  default?: O;
  defaultFn?: () => O;
}

export class ObjectSchema<
  T extends Record<string, MongsterSchemaInternal<any>>,
  $T = Resolve<ObjectOutput<T>>,
  $I = Resolve<ObjectInput<T>>,
> extends MongsterSchemaInternal<$T, $I> {
  declare $type: $T;
  declare $input: $I;
  declare $brand: "ObjectSchema";

  protected rootIndexes: IndexDescription[] = [];
  protected options: MongsterSchemaOptions = {};

  #shape: T;
  #checks: ObjectChecks<$T>;

  constructor(shape: T, checks: ObjectChecks<$T> = {}) {
    for (const [_, rawSchema] of Object.entries(shape)) {
      if (rawSchema instanceof MongsterSchema) throw new Error("MongsterSchema cannot be embedded");
    }

    super();
    this.#shape = shape;
    this.#checks = checks;
  }

  getShape(): T {
    return this.#shape;
  }

  getChecks(): ObjectChecks<$T> {
    return this.#checks;
  }

  getRootIndexes(path: string): IndexDescription[] {
    return this.rootIndexes.map((ri) => {
      const keys = Object.keys(ri.key);
      const vals = Object.values(ri.key);
      const merged = Object.fromEntries(keys.map((k, i) => [`${path}.${k}`, vals[i]]));
      return { ...ri, key: merged };
    });
  }

  addIndex<K extends AllFilterKeys<$T>>(
    keys: Record<K, MongsterIndexDirection>,
    options?: MongsterIndexOptions<$T>,
  ): this {
    const clone = this.clone();
    clone.rootIndexes.push({ key: keys, ...options });
    return clone;
  }

  withTimestamps(): ObjectSchema<T, WithTimestamps<$T>> {
    const clone = this.clone();
    clone.options = { ...this.options, withTimestamps: true };
    return clone as ObjectSchema<T, WithTimestamps<$T>>;
  }

  default(o: $T): WithDefaultSchema<$T> {
    const objSchema = new ObjectSchema(this.#shape, { ...this.#checks, default: o });
    return new WithDefaultSchema(objSchema);
  }

  defaultFn(fn: () => $T): WithDefaultSchema<$T> {
    const objSchema = new ObjectSchema(this.#shape, { ...this.#checks, defaultFn: fn });
    return new WithDefaultSchema(objSchema);
  }

  clone(): this {
    const clone = new ObjectSchema(this.#shape, { ...this.#checks }) as this;
    clone.rootIndexes = [...this.rootIndexes];
    clone.options = { ...this.options };
    return clone;
  }

  parse(v: unknown): $T {
    if (typeof v === "undefined") {
      if (typeof this.#checks.default !== "undefined") return this.#checks.default;
      if (typeof this.#checks.defaultFn === "function") return this.#checks.defaultFn();
    }

    if (typeof v !== "object") throw new MError("Expected an object");
    if (Array.isArray(v)) throw new MError("Expected an object, but received an array");

    const out: Record<string, unknown> = {};
    for (const [k, s] of Object.entries(this.#shape)) {
      try {
        out[k] = (s as MongsterSchemaInternal<any>).parse((v as any)[k]);
      } catch (err) {
        throw new MError(`${k}: ${(err as MError).message}`, {
          cause: err,
        });
      }
    }

    return out as $T;
  }

  parseForUpdate(v: unknown): $T | undefined {
    if (v === undefined) return undefined;

    if (typeof v !== "object") throw new MError("Expected an object");
    if (Array.isArray(v)) throw new MError("Expected an object, but received an array");

    const out: Record<string, unknown> = {};
    for (const [k, s] of Object.entries(this.#shape)) {
      try {
        const parsed = (s as MongsterSchemaInternal<any>).parseForUpdate((v as any)[k]);
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
}

interface UnionChecks<U> {
  default?: U;
  defaultFn?: () => U;
}

export class UnionSchema<
  T extends MongsterSchemaInternal<any>[],
  $T = T[number]["$type"],
  $I = T[number]["$input"],
> extends MongsterSchemaInternal<$T, $I> {
  declare $type: $T;
  declare $input: $I;
  declare $brand: "UnionSchema";

  #shapes: T;
  #checks: UnionChecks<$T>;

  constructor(shapes: T, checks: UnionChecks<$T> = {}) {
    super();
    this.#shapes = shapes;
    this.#checks = checks;
  }

  getShapes(): T {
    return this.#shapes;
  }

  getChecks(): UnionChecks<$T> {
    return this.#checks;
  }

  default(d: $T): WithDefaultSchema<$T> {
    const unionSchema = new UnionSchema(this.#shapes, {
      ...this.#checks,
      default: d,
    });
    return new WithDefaultSchema(unionSchema);
  }

  defaultFn(fn: () => $T): WithDefaultSchema<$T> {
    const unionSchema = new UnionSchema(this.#shapes, {
      ...this.#checks,
      defaultFn: fn,
    });
    return new WithDefaultSchema(unionSchema);
  }

  clone(): this {
    return new UnionSchema(this.#shapes, { ...this.#checks }) as this;
  }

  parse(v: unknown): $T {
    if (typeof v === "undefined") {
      if (typeof this.#checks.default !== "undefined") return this.#checks.default;
      if (typeof this.#checks.defaultFn === "function") return this.#checks.defaultFn();
    }

    let isValid = false;
    for (const shape of this.#shapes) {
      try {
        v = shape.parse(v);
        isValid = true;
        break;
      } catch {}
    }

    if (!isValid) {
      throw new MError(
        `Expected one of: ${this.#shapes.map((shape) => shape.constructor.name).join(" | ")}`,
      );
    }

    return v as $T;
  }

  parseForUpdate(v: unknown): $T | undefined {
    if (v === undefined) return undefined;

    let isValid = false;
    for (const shape of this.#shapes) {
      try {
        v = shape.parseForUpdate(v);
        if (v !== undefined) {
          isValid = true;
          break;
        }
      } catch {}
    }

    if (!isValid) {
      throw new MError(
        `Expected one of: ${this.#shapes.map((shape) => shape.constructor.name).join(" | ")}`,
      );
    }

    return v as $T;
  }
}

interface TupleChecks<T> {
  default?: T;
  defaultFn?: () => T;
}

export class TupleSchema<
  T extends MongsterSchemaInternal<any, any>[],
  $T = ResolveTuple<{ [K in keyof T]: T[K]["$type"] }>,
  $I = ResolveTuple<{ [K in keyof T]: T[K]["$input"] }>,
> extends MongsterSchemaInternal<$T, $I> {
  declare $type: $T;
  declare $input: $I;
  declare $brand: "TupleSchema";

  #shapes: T;
  #checks: TupleChecks<$T>;

  constructor(shapes: T, checks: TupleChecks<$T> = {}) {
    super();
    this.#shapes = shapes;
    this.#checks = checks;
  }

  getShapes(): T {
    return this.#shapes;
  }

  getChecks(): TupleChecks<$T> {
    return this.#checks;
  }

  default(d: $T): WithDefaultSchema<$T> {
    const tupleSchema = new TupleSchema(this.#shapes, {
      ...this.#checks,
      default: d,
    });
    return new WithDefaultSchema(tupleSchema);
  }

  defaultFn(fn: () => $T): WithDefaultSchema<$T> {
    const tupleSchema = new TupleSchema(this.#shapes, {
      ...this.#checks,
      defaultFn: fn,
    });
    return new WithDefaultSchema(tupleSchema);
  }

  clone(): this {
    return new TupleSchema(this.#shapes, { ...this.#checks }) as this;
  }

  parse(v: unknown): $T {
    if (typeof v === "undefined") {
      if (typeof this.#checks.default !== "undefined") return this.#checks.default;
      if (typeof this.#checks.defaultFn === "function") return this.#checks.defaultFn();
    }

    if (!Array.isArray(v)) throw new MError("Expected a tuple (must be an array)");
    if (v.length !== this.#shapes.length) {
      throw new MError(
        `Expected tuple of length ${this.#shapes.length}, received of length ${v.length}`,
      );
    }

    const out: unknown[] = [];
    for (let i = 0; i < this.#shapes.length; i++) {
      const shape = this.#shapes[i];
      if (!shape) throw new MError(`Invalid schema shape`);

      try {
        out[i] = shape.parse(v[i]);
      } catch (err) {
        throw new MError(`[${i}] ${(err as MError).message}`, { cause: err });
      }
    }
    return out as $T;
  }

  parseForUpdate(v: unknown): $T | undefined {
    if (v === undefined) return undefined;

    if (!Array.isArray(v)) throw new MError("Expected a tuple (must be an array)");
    if (v.length !== this.#shapes.length) {
      throw new MError(
        `Expected tuple of length ${this.#shapes.length}, received of length ${v.length}`,
      );
    }

    const out: unknown[] = [];
    for (let i = 0; i < this.#shapes.length; i++) {
      const shape = this.#shapes[i];
      if (!shape) throw new MError(`Invalid schema shape`);

      try {
        const parsed = shape.parseForUpdate(v[i]);
        // For tuples, all elements must be present
        if (parsed === undefined) {
          out[i] = shape.parse(v[i]);
        } else {
          out[i] = parsed;
        }
      } catch (err) {
        throw new MError(`[${i}] ${(err as MError).message}`, { cause: err });
      }
    }
    return out as $T;
  }
}
