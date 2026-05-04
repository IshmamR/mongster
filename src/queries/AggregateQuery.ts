import type { AggregationCursor, Collection, Document } from "mongodb";
import { QueryError } from "../error";
import type {
  AddFieldsResult,
  AddFieldsStage,
  AggregateProjectResult,
  AggregateProjectSpec,
  AggregateQueryOptions,
  AggregateUnwindResult,
  CountResult,
  GroupAccumulator,
  GroupIdExpression,
  GroupResult,
  LookupFromModel,
  LookupOptions,
  LookupResult,
  UnwindOptions,
} from "../types/types.aggregate";
import type { MongsterFilter } from "../types/types.filter";
import type { AllFilterKeys, SchemaSort } from "../types/types.query";

type PromiseOnFulfilled<Res> = ((value: Res[]) => Res[] | PromiseLike<Res[]>) | null | undefined;
type PromiseOnRejected = ((reason: unknown) => PromiseLike<never>) | null | undefined;

export class AggregateQuery<Source extends Document, OT extends Document = Source> {
  #collection: Collection<Source>;
  #options?: AggregateQueryOptions;
  #pipeline: Document[] = [];

  constructor(collection: Collection<Source>, options?: AggregateQueryOptions) {
    this.#collection = collection;
    this.#options = options;
  }

  #buildCursor(): AggregationCursor<OT> {
    return this.#collection.aggregate<OT>(this.#pipeline, this.#options);
  }

  match(filter: MongsterFilter<OT>): this {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new QueryError("aggregate.match: filter must be an object");
    } else if (Array.isArray(filter)) {
      throw new QueryError("aggregate.match: filter cannot be an array");
    }

    this.#pipeline.push({ $match: filter });
    return this;
  }

  group<
    Id extends GroupIdExpression<OT>,
    Spec extends Record<string, GroupAccumulator<OT>>,
    GroupReturn = AggregateQuery<Source, GroupResult<OT, Id, Spec>>,
  >(_id: Id, spec: Spec): GroupReturn {
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
      throw new QueryError("aggregate.group: spec must be an object");
    }

    this.#pipeline.push({ $group: { _id, ...spec } });
    return this as unknown as GroupReturn;
  }

  sort(sort: SchemaSort<OT>): this {
    if (!sort || typeof sort !== "object") {
      throw new QueryError("aggregate.sort: sort must be an object or sort expression");
    }

    this.#pipeline.push({ $sort: sort as Document });
    return this;
  }

  limit(n: number): this {
    if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) {
      throw new QueryError("aggregate.limit: limit must be a positive integer");
    }

    this.#pipeline.push({ $limit: n });
    return this;
  }

  skip(n: number): this {
    if (typeof n !== "number" || !Number.isInteger(n) || n < 0) {
      throw new QueryError("aggregate.skip: skip must be a non-negative integer");
    }

    this.#pipeline.push({ $skip: n });
    return this;
  }

  project<const Spec extends AggregateProjectSpec<OT>>(
    projection: Spec,
  ): AggregateQuery<Source, AggregateProjectResult<OT, Spec>>;
  project<ReturnType extends Document = OT>(
    projection: Document,
  ): AggregateQuery<Source, ReturnType>;
  project(projection: Document): AggregateQuery<Source, Document> {
    if (!projection || typeof projection !== "object" || Array.isArray(projection)) {
      throw new QueryError("aggregate.project: projection must be an object");
    }

    this.#pipeline.push({ $project: projection });
    return this as unknown as AggregateQuery<Source, Document>;
  }

  unwind<
    const Path extends Extract<AllFilterKeys<OT>, string>,
    const IncludeIndex extends string | undefined = undefined,
    UnWindReturn = AggregateQuery<Source, AggregateUnwindResult<OT, Path, IncludeIndex>>,
  >(path: `$${Path}`, options?: UnwindOptions<IncludeIndex>): UnWindReturn {
    if (!path || typeof path !== "string") {
      throw new QueryError("aggregate.unwind: path must be a non-empty string");
    }

    this.#pipeline.push({ $unwind: options ? { path, ...options } : path });

    return this as unknown as UnWindReturn;
  }

  lookup<
    const Model extends LookupFromModel,
    const As extends string,
    LookUpReturn = AggregateQuery<Source, LookupResult<OT, Model, As>>,
  >(options: LookupOptions<OT, Model, As>): LookUpReturn {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new QueryError("aggregate.lookup: options must be an object");
    }
    if (!options.from || typeof options.from.getCollectionName !== "function") {
      throw new QueryError("aggregate.lookup: from must be a mongster model instance");
    }
    if (!options.localField || !options.foreignField || !options.as) {
      throw new QueryError("aggregate.lookup: localField, foreignField, and as are required");
    }

    this.#pipeline.push({
      $lookup: {
        from: options.from.getCollectionName(),
        localField: options.localField,
        foreignField: options.foreignField,
        as: options.as,
      },
    });

    return this as unknown as LookUpReturn;
  }

  addFields<
    const Added extends AddFieldsStage<OT>,
    AddFieldsReturn = AggregateQuery<Source, AddFieldsResult<OT, Added>>,
  >(fields: Added): AddFieldsReturn {
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
      throw new QueryError("aggregate.addFields: fields must be an object");
    }

    this.#pipeline.push({ $addFields: fields });
    return this as unknown as AddFieldsReturn;
  }

  count<
    const Name extends string = "count",
    CountReturn = AggregateQuery<Source, CountResult<Name>>,
  >(fieldName?: Name): CountReturn {
    if (fieldName && (typeof fieldName !== "string" || fieldName.trim() === "")) {
      throw new QueryError("aggregate.count: field name must be a non-empty string");
    }

    this.#pipeline.push({ $count: fieldName ?? "count" });
    return this as unknown as CountReturn;
  }

  raw<ReturnType extends Document = OT>(stage: Document): AggregateQuery<Source, ReturnType> {
    if (!stage || typeof stage !== "object" || Array.isArray(stage)) {
      throw new QueryError("aggregate.raw: stage must be an object");
    }

    this.#pipeline.push(stage);
    return this as unknown as AggregateQuery<Source, ReturnType>;
  }

  async exec(): Promise<OT[]> {
    return this.#buildCursor().toArray();
  }

  async explain(): Promise<Document> {
    return this.#buildCursor().explain();
  }

  // biome-ignore lint/suspicious/noThenProperty: needed for thenable query builder
  then(resolve?: PromiseOnFulfilled<OT>, reject?: PromiseOnRejected) {
    return this.exec().then(resolve, reject);
  }

  catch(reject: PromiseOnRejected) {
    return this.exec().catch(reject);
  }
}
