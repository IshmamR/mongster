import { MError } from "../error";
import type { ObjectInput, ObjectOutput, Resolve, ResolveTuple } from "../types/types.schema";
import { MongsterSchemaBase, WithDefaultSchema } from "./base";

interface ObjectChecks<O> {
  default?: O;
  defaultFn?: () => O;
}

export class ObjectSchema<
  T extends Record<string, MongsterSchemaBase<any>>,
  $T = Resolve<ObjectOutput<T>>,
  $I = Resolve<ObjectInput<T>>,
> extends MongsterSchemaBase<$T, $I> {
  declare $type: $T;
  declare $input: $I;

  #shape: T;
  #checks: ObjectChecks<$T>;

  constructor(shape: T, checks: ObjectChecks<$T> = {}) {
    super();
    this.#shape = shape;
    this.#checks = checks;
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
    return new ObjectSchema(this.#shape, { ...this.#checks }) as this;
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
        out[k] = (s as MongsterSchemaBase<any>).parse((v as any)[k]);
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
  T extends MongsterSchemaBase<any>[],
  $T = T[number]["$type"],
  $I = T[number]["$input"],
> extends MongsterSchemaBase<$T, $I> {
  declare $type: $T;
  declare $input: $I;

  #shapes: T;
  #checks: UnionChecks<$T>;

  constructor(shapes: T, checks: UnionChecks<$T> = {}) {
    super();
    this.#shapes = shapes;
    this.#checks = checks;
  }

  default(d: $T): WithDefaultSchema<$T> {
    const unionSchema = new UnionSchema(this.#shapes, { ...this.#checks, default: d });
    return new WithDefaultSchema(unionSchema);
  }

  defaultFn(fn: () => $T): WithDefaultSchema<$T> {
    const unionSchema = new UnionSchema(this.#shapes, { ...this.#checks, defaultFn: fn });
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
}

interface TupleChecks<T> {
  default?: T;
  defaultFn?: () => T;
}

export class TupleSchema<
  T extends MongsterSchemaBase<any, any>[],
  $T = ResolveTuple<{ [K in keyof T]: T[K]["$type"] }>,
  $I = ResolveTuple<{ [K in keyof T]: T[K]["$input"] }>,
> extends MongsterSchemaBase<$T, $I> {
  declare $type: $T;
  declare $input: $I;

  #shapes: T;
  #checks: TupleChecks<$T>;

  constructor(shapes: T, checks: TupleChecks<$T> = {}) {
    super();
    this.#shapes = shapes;
    this.#checks = checks;
  }

  default(d: $T): WithDefaultSchema<$T> {
    const tupleSchema = new TupleSchema(this.#shapes, { ...this.#checks, default: d });
    return new WithDefaultSchema(tupleSchema);
  }

  defaultFn(fn: () => $T): WithDefaultSchema<$T> {
    const tupleSchema = new TupleSchema(this.#shapes, { ...this.#checks, defaultFn: fn });
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
}
