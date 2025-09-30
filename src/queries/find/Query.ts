import type { FindCursor, Sort } from "mongodb";
import type { BooleanNumber } from "../../types/types.common";
import type {
  AllKeys,
  ProjectExclusion,
  ProjectInclusion,
  SchemaSort,
} from "../../types/types.query";

type PromiseOnFulfilled<Res> = ((value: Res[]) => Res[] | PromiseLike<Res[]>) | null | undefined;
type PromiseOnRejected = ((reason: unknown) => PromiseLike<never>) | null | undefined;

export class Query<T, OT> {
  #cursor: FindCursor<OT>;

  projection?: Partial<Record<AllKeys<OT>, BooleanNumber>>;

  constructor(cursor: FindCursor<OT>, projection?: typeof this.projection) {
    this.#cursor = cursor;
    this.projection = projection;
  }

  sort(sort: SchemaSort<T>) {
    this.#cursor = this.#cursor.sort(sort as Sort);
    return this;
  }

  limit(n: number) {
    if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) {
      throw new Error("Limit must be a positive integer");
    }
    this.#cursor = this.#cursor.limit(n);
    return this;
  }

  skip(n: number) {
    if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) {
      throw new Error("Skip must be a positive integer");
    }
    this.#cursor = this.#cursor.skip(n);
    return this;
  }

  include<K extends AllKeys<OT>>(paths: K[]) {
    for (const path of paths) {
      if (path === "") continue;
      if (typeof this.projection !== "undefined") {
        this.projection[path] = 1;
      } else {
        this.projection = { [path]: 1 } as Partial<Record<AllKeys<OT>, 1>>;
      }
    }
    return new Query(this.#cursor, this.projection) as Query<T, ProjectInclusion<OT, K>>;
  }

  exclude<K extends AllKeys<OT>>(paths: K[]) {
    for (const path of paths) {
      if (path === "") continue;
      if (typeof this.projection !== "undefined") {
        this.projection[path] = 0;
      } else {
        this.projection = { [path]: 0 } as Partial<Record<AllKeys<OT>, 0>>;
      }
    }
    return new Query(this.#cursor, this.projection) as Query<T, ProjectExclusion<OT, K>>;
  }

  project<ReturnType = OT>(projection: { [K in AllKeys<OT>]?: any }) {
    if (typeof this.projection !== "undefined") {
      this.projection = { ...this.projection, ...projection };
    } else {
      this.projection = projection as Partial<Record<AllKeys<OT>, any>>;
    }

    return new Query(this.#cursor, this.projection) as unknown as Query<T, ReturnType>;
  }

  exec(): Promise<OT[]> {
    if (typeof this.projection !== "undefined") {
      this.#cursor = this.#cursor.project(this.projection) as FindCursor<OT>;
    }
    return this.#cursor.toArray();
  }

  // biome-ignore lint/suspicious/noThenProperty: cz I need it
  then(resolve?: PromiseOnFulfilled<OT>, reject?: PromiseOnRejected) {
    return this.exec().then(resolve, reject);
  }

  catch(reject: PromiseOnRejected) {
    return this.exec().catch(reject);
  }

  async explain(): Promise<any> {
    return this.#cursor.explain();
  }
}
