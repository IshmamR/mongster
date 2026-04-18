import type {
  Abortable,
  Collection,
  Document,
  Filter,
  FindCursor,
  FindOptions,
  Sort,
} from "mongodb";
import { QueryError } from "../error";
import type {
  AllProjKeys,
  ProjectionFromExclusionKeys,
  ProjectionFromInclusionKeys,
  ProjectionRecord,
  SchemaSort,
} from "../types/types.query";

type PromiseOnFulfilled<Res> = ((value: Res[]) => Res[] | PromiseLike<Res[]>) | null | undefined;
type PromiseOnRejected = ((reason: unknown) => PromiseLike<never>) | null | undefined;

export interface FindQueryHooks<OT> {
  preExec: (ctx: { filter: any }) => Promise<{ filter: any }>;
  postExec: (ctx: { filter: any; result: OT[] }) => Promise<void>;
}

export class FindQuery<T, OT extends Document = Document> {
  #collection: Collection<OT>;
  #filter: Filter<OT>;
  #findOptions?: FindOptions & Abortable;
  #sortSpec?: Sort;
  #limitN?: number;
  #skipN?: number;
  #hooks?: FindQueryHooks<OT>;

  projection?: ProjectionRecord<OT>;

  constructor(
    collection: Collection<OT>,
    filter: Filter<OT>,
    options?: FindOptions & Abortable,
    hooks?: FindQueryHooks<OT>,
  ) {
    this.#collection = collection;
    this.#filter = filter;
    this.#findOptions = options;
    this.#hooks = hooks;
  }

  #buildCursor(filter?: Filter<OT>): FindCursor<OT> {
    let cursor = this.#collection.find<OT>(filter ?? this.#filter, this.#findOptions);
    if (this.#sortSpec) cursor = cursor.sort(this.#sortSpec);
    if (this.#limitN !== undefined) cursor = cursor.limit(this.#limitN);
    if (this.#skipN !== undefined) cursor = cursor.skip(this.#skipN);
    if (this.projection) cursor = cursor.project(this.projection) as FindCursor<OT>;
    return cursor;
  }

  getCursor(): FindCursor<OT> {
    return this.#buildCursor();
  }

  sort(sort: SchemaSort<T>): this {
    this.#sortSpec = sort as Sort;
    return this;
  }

  limit(n: number): this {
    if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) {
      throw new QueryError("Limit must be a positive integer");
    }
    this.#limitN = n;
    return this;
  }

  skip(n: number): this {
    if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) {
      throw new QueryError("Skip must be a positive integer");
    }
    this.#skipN = n;
    return this;
  }

  include<K extends AllProjKeys<OT>>(paths: K[]): FindQuery<T, ProjectionFromInclusionKeys<OT, K>> {
    for (const path of paths) {
      if (typeof path !== "string") continue;
      if (path.trim() === "") continue;
      if (this.projection !== undefined) {
        this.projection[path] = 1;
      } else {
        this.projection = { [path]: 1 } as { [IK in AllProjKeys<OT>]: 1 };
      }
    }

    return this as unknown as FindQuery<T, ProjectionFromInclusionKeys<OT, K>>;
  }

  exclude<K extends AllProjKeys<OT>>(paths: K[]): FindQuery<T, ProjectionFromExclusionKeys<OT, K>> {
    for (const path of paths) {
      if (typeof path !== "string") continue;
      if (path.trim() === "") continue;
      if (this.projection !== undefined) {
        this.projection[path] = 0;
      } else {
        this.projection = { [path]: 0 } as { [EK in AllProjKeys<OT>]: 0 };
      }
    }

    return this as unknown as FindQuery<T, ProjectionFromExclusionKeys<OT, K>>;
  }

  project<ReturnType extends Document = OT>(
    projection: ProjectionRecord<OT>,
  ): FindQuery<T, ReturnType> {
    if (this.projection !== undefined) {
      this.projection = { ...this.projection, ...projection };
    } else {
      this.projection = projection;
    }

    return this as unknown as FindQuery<T, ReturnType>;
  }

  async exec(): Promise<OT[]> {
    let filter = this.#filter;

    if (this.#hooks) {
      const preCtx = await this.#hooks.preExec({ filter });
      filter = preCtx.filter;
    }

    const cursor = this.#buildCursor(filter);
    const results = await cursor.toArray();

    if (this.#hooks) {
      await this.#hooks.postExec({ filter, result: results });
    }

    return results;
  }

  // biome-ignore lint/suspicious/noThenProperty: cz I need it
  then(resolve?: PromiseOnFulfilled<OT>, reject?: PromiseOnRejected) {
    return this.exec().then(resolve, reject);
  }

  catch(reject: PromiseOnRejected) {
    return this.exec().catch(reject);
  }

  async explain(): Promise<Document> {
    return this.#buildCursor().explain();
  }
}
