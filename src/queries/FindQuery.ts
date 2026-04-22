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
  FindQueryHooks,
  PopulateOptions,
  PopulateResult,
  PopulateSelectKeys,
  PopulateSpec,
  RefFieldKeys,
  RefMeta,
} from "../types/types.populate";
import type {
  AllProjKeys,
  ProjectionFromExclusionKeys,
  ProjectionFromInclusionKeys,
  ProjectionRecord,
  SchemaSort,
} from "../types/types.query";

type PromiseOnFulfilled<Res> = ((value: Res[]) => Res[] | PromiseLike<Res[]>) | null | undefined;
type PromiseOnRejected = ((reason: unknown) => PromiseLike<never>) | null | undefined;

export class FindQuery<
  T,
  OT extends Document = Document,
  Shape extends Record<string, unknown> = Record<string, never>,
> {
  #collection: Collection<OT>;
  #filter: Filter<OT>;
  #findOptions?: FindOptions & Abortable;
  #sortSpec?: Sort;
  #limitN?: number;
  #skipN?: number;
  #hooks?: FindQueryHooks<OT>;
  #refMap: Map<string, RefMeta>;
  #populates: PopulateSpec[] = [];

  projection?: ProjectionRecord<OT>;

  constructor(
    collection: Collection<OT>,
    filter: Filter<OT>,
    options?: FindOptions & Abortable,
    hooks?: FindQueryHooks<OT>,
    refMap?: Map<string, RefMeta>,
  ) {
    this.#collection = collection;
    this.#filter = filter;
    this.#findOptions = options;
    this.#hooks = hooks;
    this.#refMap = refMap ?? new Map();
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

  populate<
    const K extends RefFieldKeys<Shape>,
    const Select extends readonly PopulateSelectKeys<Shape, K>[] | undefined = undefined,
    const ExcludeId extends boolean | undefined = undefined,
  >(
    field: K,
    options?: PopulateOptions<Shape, K, Select, ExcludeId>,
  ): FindQuery<T, PopulateResult<OT, Shape, K, Select, ExcludeId>, Shape> {
    this.#populates.push({
      field,
      select: options?.select,
      excludeId: options?.excludeId,
    });
    return this as unknown as FindQuery<T, PopulateResult<OT, Shape, K, Select, ExcludeId>, Shape>;
  }

  async exec(): Promise<OT[]> {
    let filter = this.#filter;

    if (this.#hooks) {
      const preCtx = await this.#hooks.preExec({ filter });
      filter = preCtx.filter;
    }

    let results: OT[];

    if (this.#populates.length === 0) {
      const cursor = this.#buildCursor(filter);
      results = await cursor.toArray();
    } else {
      results = await this.#execWithPopulate(filter);
    }

    if (this.#hooks) {
      await this.#hooks.postExec({ filter, result: results });
    }

    return results;
  }

  async #execWithPopulate(filter: Filter<OT>): Promise<OT[]> {
    const pipeline: Document[] = [{ $match: filter }];

    for (const spec of this.#populates) {
      const ref = this.#refMap.get(spec.field);
      if (!ref) {
        throw new QueryError(
          `populate: "${spec.field}" is not a ref field. Use .ref(() => Model) in the schema.`,
        );
      }

      const collectionName = ref.getCollectionName();
      const lookupStage: Document = {
        $lookup: {
          from: collectionName,
          localField: spec.field,
          foreignField: "_id",
          as: spec.field,
        },
      };

      if (spec.select) {
        const projection: Document = {};
        for (const f of spec.select) {
          projection[f] = 1;
        }
        if (spec.excludeId) {
          projection._id = 0;
        }
        if (spec.select.length === 0 && !spec.excludeId) {
          projection._id = 1;
        }
        if (Object.keys(projection).length > 0) {
          lookupStage.$lookup.pipeline = [{ $project: projection }];
        }
      }

      pipeline.push(lookupStage);

      pipeline.push({
        $unwind: {
          path: `$${spec.field}`,
          preserveNullAndEmptyArrays: true,
        },
      });
    }

    if (this.#sortSpec) pipeline.push({ $sort: this.#sortSpec });
    if (this.#skipN !== undefined) pipeline.push({ $skip: this.#skipN });
    if (this.#limitN !== undefined) pipeline.push({ $limit: this.#limitN });
    if (this.projection) pipeline.push({ $project: this.projection });

    const nullDefaults: Document = {};
    for (const spec of this.#populates) {
      nullDefaults[spec.field] = { $ifNull: [`$${spec.field}`, null] };
    }
    if (Object.keys(nullDefaults).length > 0) {
      pipeline.push({ $addFields: nullDefaults });
    }

    const cursor = this.#collection.aggregate<OT>(pipeline, this.#findOptions);
    return cursor.toArray();
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
