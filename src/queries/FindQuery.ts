import type { FindCursor, Sort } from "mongodb";
import type {
  AllProjKeys,
  ProjectionFromExclusionKeys,
  ProjectionFromInclusionKeys,
  ProjectionRecord,
  SchemaSort,
} from "../types/types.query";

type PromiseOnFulfilled<Res> = ((value: Res[]) => Res[] | PromiseLike<Res[]>) | null | undefined;
type PromiseOnRejected = ((reason: unknown) => PromiseLike<never>) | null | undefined;

export class FindQuery<T, OT> {
  #cursor: FindCursor<OT>;

  projection?: ProjectionRecord<OT>;

  constructor(cursor: FindCursor<OT>, projection?: typeof this.projection) {
    this.#cursor = cursor;
    this.projection = projection;
  }

  getCursor() {
    return this.#cursor;
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

  include<K extends AllProjKeys<OT>>(paths: K[]) {
    for (const path of paths) {
      if (typeof path !== "string") continue;
      if (path.trim() === "") continue;
      if (typeof this.projection !== "undefined") {
        this.projection[path] = 1;
      } else {
        this.projection = { [path]: 1 } as { [IK in AllProjKeys<OT>]: 1 };
      }
    }

    return this as FindQuery<T, ProjectionFromInclusionKeys<OT, K>>;
  }

  exclude<K extends AllProjKeys<OT>>(paths: K[]) {
    for (const path of paths) {
      if (typeof path !== "string") continue;
      if (path.trim() === "") continue;
      if (typeof this.projection !== "undefined") {
        this.projection[path] = 0;
      } else {
        this.projection = { [path]: 0 } as { [EK in AllProjKeys<OT>]: 0 };
      }
    }

    return this as FindQuery<T, ProjectionFromExclusionKeys<OT, K>>;
  }

  project<ReturnType = OT>(projection: ProjectionRecord<OT>) {
    if (typeof this.projection !== "undefined") {
      this.projection = { ...this.projection, ...projection };
    } else {
      this.projection = projection;
    }

    return this as unknown as FindQuery<T, ReturnType>;
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
