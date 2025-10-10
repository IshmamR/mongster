import { MError } from "../error";
import type { ObjectOutput, Resolve, ResolveTuple } from "../types/types.schema";
import { MongsterSchemaBase } from "./base";

interface ObjectChecks<O> {
  default?: O;
}

export class ObjectSchema<
  T extends Record<string, MongsterSchemaBase<any>>,
  $T = Resolve<ObjectOutput<T>>,
> extends MongsterSchemaBase<$T> {
  declare $type: $T;

  #shape: T;
  #checks: ObjectChecks<$T>;

  constructor(shape: T, checks: ObjectChecks<$T> = {}) {
    super();
    this.#shape = shape;
    this.#checks = checks;
  }

  default(o: $T): ObjectSchema<T, $T> {
    return new ObjectSchema(this.#shape, { ...this.#checks, default: o });
  }

  clone(): this {
    return new ObjectSchema(this.#shape, { ...this.#checks }) as this;
  }

  parse(v: unknown): $T {
    if (typeof v === "undefined" && typeof this.#checks.default !== "undefined") {
      return this.#checks.default;
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
}

export class UnionSchema<
  T extends MongsterSchemaBase<any>[],
  $T = T[number]["$type"],
> extends MongsterSchemaBase<$T> {
  declare $type: $T;

  #shapes: T;
  #checks: UnionChecks<$T>;

  constructor(shapes: T, checks: UnionChecks<$T> = {}) {
    super();
    this.#shapes = shapes;
    this.#checks = checks;
  }

  default(d: $T): UnionSchema<T> {
    return new UnionSchema(this.#shapes, { ...this.#checks, default: d });
  }

  clone(): this {
    return new UnionSchema(this.#shapes, { ...this.#checks }) as this;
  }

  parse(v: unknown): $T {
    if (typeof v === "undefined" && typeof this.#checks.default !== "undefined") {
      return this.#checks.default;
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
}

export class TupleSchema<
  T extends MongsterSchemaBase<any>[],
  $T = ResolveTuple<{
    [K in keyof T]: T[K] extends MongsterSchemaBase<infer U> ? U : never;
  }>,
> extends MongsterSchemaBase<$T> {
  declare $type: $T;

  #shapes: T;
  #checks: TupleChecks<$T>;

  constructor(shapes: T, checks: TupleChecks<$T> = {}) {
    super();
    this.#shapes = shapes;
    this.#checks = checks;
  }

  default(d: $T): TupleSchema<T, $T> {
    return new TupleSchema(this.#shapes, { ...this.#checks, default: d });
  }

  clone(): this {
    return new TupleSchema(this.#shapes, { ...this.#checks }) as this;
  }

  parse(v: unknown): $T {
    if (typeof v === "undefined" && typeof this.#checks.default !== "undefined") {
      return this.#checks.default;
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
