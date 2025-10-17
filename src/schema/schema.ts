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
  WithTimestamps,
} from "../types/types.schema";
import { ArraySchema, MongsterSchemaBase } from "./base";
import { ObjectSchema, TupleSchema, UnionSchema } from "./composites";

/**
 * The schema that goes to collection
 */
export class MongsterSchema<
  T extends Record<string, MongsterSchemaBase<any>>,
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
    super();
    this.#shape = shape;
    this.#collectedIndexes = null;
  }

  getShape(): T {
    return this.#shape;
  }

  withTimestamps(): MongsterSchema<T, WithTimestamps<$T>> {
    const clone = this.clone();
    clone.options = { ...this.options, withTimestamps: true };
    return clone as MongsterSchema<T, WithTimestamps<$T>>;
  }

  addIndex<K extends AllFilterKeys<$T>>(
    keys: Record<K, MongsterIndexDirection>,
    options?: MongsterIndexOptions<$T>,
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
    return out as $T;
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

    function pushFieldIndex(path: string, schema: MongsterSchemaBase<any>) {
      const meta = schema.getIdxMeta();
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
        for (const idxRaw of unwrapped.rootIndexes) {
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
        walkShape(unwrapped.getShape(), path);
      } else if (unwrapped instanceof ObjectSchema) {
        walkShape(unwrapped.getShape(), path);
      } else if (unwrapped instanceof UnionSchema || unwrapped instanceof TupleSchema) {
        walkShape(unwrapped.getShapes(), path);
      } else if (unwrapped instanceof ArraySchema) {
        const inner = unwrapped.getShapes();
        if (inner) collect(inner, path);
      }
    }

    walkShape(this.#shape, "");

    this.#collectedIndexes = collected;
    return collected;
  }
}
