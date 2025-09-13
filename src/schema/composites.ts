import { MongsTerror } from "../error";
import type { ObjectOutput, Resolve, ResolveTuple, WithTimestamps } from "../types/types.schema";
import { MongsterSchemaBase } from "./base";

type ObjectChecks<DO> = {
  default?: DO;

  withTimestamps?: boolean;
};

export class ObjectSchema<
  T extends Record<string, MongsterSchemaBase<any>>,
  ResolvedObj = Resolve<ObjectOutput<T>>,
> extends MongsterSchemaBase<ResolvedObj> {
  declare $type: ResolvedObj;

  constructor(
    protected shape: T,
    private checks: ObjectChecks<ResolvedObj> = {},
  ) {
    super();
  }

  protected clone(): this {
    return new ObjectSchema(this.shape, this.checks) as this;
  }

  default(obj: ResolvedObj): ObjectSchema<T, ResolvedObj> {
    return new ObjectSchema(this.shape, { ...this.checks, default: obj });
  }

  withTimestamps(): ObjectSchema<T, WithTimestamps<ResolvedObj>> {
    return new ObjectSchema<T, WithTimestamps<ResolvedObj>>(this.shape, {
      ...(this.checks as ObjectChecks<WithTimestamps<ResolvedObj>>),
      withTimestamps: true,
    });
  }

  parse(v: unknown): ResolvedObj {
    if (typeof v === "undefined" && typeof this.checks.default !== "undefined") {
      return this.checks.default;
    }

    if (typeof v !== "object") throw new MongsTerror("Expected an object");
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
}

type UnionChecks<DU> = {
  default?: DU;
};

export class UnionSchema<
  T extends MongsterSchemaBase<any>[],
  $T = T[number]["$type"],
> extends MongsterSchemaBase<$T> {
  declare $type: $T;

  constructor(
    private shapes: T,
    private checks: UnionChecks<$T> = {},
  ) {
    super();
  }

  protected clone(): this {
    return new UnionSchema(this.shapes, this.checks) as this;
  }

  default(d: $T): UnionSchema<T> {
    return new UnionSchema(this.shapes, { ...this.checks, default: d });
  }

  parse(v: unknown): $T {
    if (typeof v === "undefined" && typeof this.checks.default !== "undefined") {
      return this.checks.default;
    }

    let isValid = false;
    for (const shape of this.shapes) {
      try {
        v = shape.parse(v);
        isValid = true;
        break;
      } catch {}
    }

    if (!isValid) {
      throw new MongsTerror(
        `Expected one of: ${this.shapes.map((shape) => (shape.constructor as any).name).join(" | ")}`,
      );
    }

    return v as $T;
  }
}

type TupleChecks<DT> = {
  default?: DT;
};

export class TupleSchema<
  T extends MongsterSchemaBase<any>[],
  $T = ResolveTuple<{
    [K in keyof T]: T[K] extends MongsterSchemaBase<infer U> ? U : never;
  }>,
> extends MongsterSchemaBase<$T> {
  declare $type: $T;

  constructor(
    private shapes: T,
    private checks: TupleChecks<$T> = {},
  ) {
    super();
  }

  protected clone(): this {
    return new TupleSchema(this.shapes, this.checks) as this;
  }

  default(d: $T): TupleSchema<T, $T> {
    return new TupleSchema(this.shapes, { ...this.checks, default: d });
  }

  parse(v: unknown): $T {
    if (typeof v === "undefined" && typeof this.checks.default !== "undefined") {
      return this.checks.default;
    }

    if (!Array.isArray(v)) throw new MongsTerror("Expected a tuple (must be an array)");
    if (v.length !== this.shapes.length) {
      throw new MongsTerror(
        `Expected tuple of length ${this.shapes.length}, received of length ${v.length}`,
      );
    }

    const out: any[] = [];
    for (let i = 0; i < this.shapes.length; i++) {
      const shape = this.shapes[i];
      if (!shape) throw new MongsTerror(`Invalid schema shape`);

      try {
        out[i] = shape.parse(v[i]);
      } catch (err) {
        throw new MongsTerror(`[${i}] ${(err as Error).message}`, {
          cause: err,
        });
      }
    }
    return out as $T;
  }
}
