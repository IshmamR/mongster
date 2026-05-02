import type { Abortable, Collection, Document, Filter, FindOneOptions } from "mongodb";
import { QueryError } from "../error";
import type {
  FindOneQueryHooks,
  PopulateOptions,
  PopulateResult,
  PopulateSelectKeys,
  PopulateSpec,
  RefFieldKeys,
  RefMeta,
} from "../types/types.populate";

type PromiseOnFulfilled<Res> =
  | ((value: Res | null) => Res | null | PromiseLike<Res | null>)
  | null
  | undefined;
type PromiseOnRejected = ((reason: unknown) => PromiseLike<never>) | null | undefined;

export class FindOneQuery<
  T,
  OT extends Document = Document,
  Shape extends Record<string, unknown> = Record<string, never>,
> {
  #collection: Collection<OT>;
  #filter: Filter<OT>;
  #findOptions?: Omit<FindOneOptions, "timeoutMode"> & Abortable;
  #hooks?: FindOneQueryHooks<OT>;
  #refMap: Map<string, RefMeta>;
  #populates: PopulateSpec[] = [];

  constructor(
    collection: Collection<OT>,
    filter: Filter<OT>,
    options?: Omit<FindOneOptions, "timeoutMode"> & Abortable,
    hooks?: FindOneQueryHooks<OT>,
    refMap?: Map<string, RefMeta>,
  ) {
    this.#collection = collection;
    this.#filter = filter;
    this.#findOptions = options;
    this.#hooks = hooks;
    this.#refMap = refMap ?? new Map();
  }

  populate<
    const K extends RefFieldKeys<Shape>,
    const Select extends readonly PopulateSelectKeys<Shape, K>[] | undefined = undefined,
    const ExcludeId extends boolean | undefined = undefined,
    const PopulateReturn = FindOneQuery<T, PopulateResult<OT, Shape, K, Select, ExcludeId>, Shape>,
  >(field: K, options?: PopulateOptions<Shape, K, Select, ExcludeId>): PopulateReturn {
    this.#populates.push({
      field,
      select: options?.select,
      excludeId: options?.excludeId,
    });
    return this as unknown as PopulateReturn;
  }

  async exec(): Promise<OT | null> {
    let filter = this.#filter;

    if (this.#hooks) {
      filter = await this.#hooks.preExec(filter);
    }

    let result: OT | null;

    if (this.#populates.length === 0) {
      result = await this.#collection.findOne<OT>(filter, this.#findOptions);
    } else {
      result = await this.#execWithPopulate(filter);
    }

    if (this.#hooks) {
      await this.#hooks.postExec(filter, result);
    }

    return result;
  }

  async #execWithPopulate(filter: Filter<OT>): Promise<OT | null> {
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

    pipeline.push({ $limit: 1 });

    // we need to set null for missing lookups ($unwind will remove the field for empty arrays)
    const nullDefaults: Document = {};
    for (const spec of this.#populates) {
      nullDefaults[spec.field] = { $ifNull: [`$${spec.field}`, null] };
    }
    if (Object.keys(nullDefaults).length > 0) {
      pipeline.push({ $addFields: nullDefaults });
    }

    const cursor = this.#collection.aggregate<OT>(pipeline, this.#findOptions);
    const results = await cursor.toArray();
    return results[0] ?? null;
  }

  // biome-ignore lint/suspicious/noThenProperty: needed for thenable
  then(resolve?: PromiseOnFulfilled<OT>, reject?: PromiseOnRejected) {
    return this.exec().then(resolve, reject);
  }

  catch(reject: PromiseOnRejected) {
    return this.exec().catch(reject);
  }
}
