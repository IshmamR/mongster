import type {
  Abortable,
  AggregateOptions,
  AnyBulkWriteOperation,
  BulkWriteOptions,
  BulkWriteResult,
  Collection,
  CollectionOptions,
  CountDocumentsOptions,
  DeleteOptions,
  DeleteResult,
  DistinctOptions,
  Document,
  EstimatedDocumentCountOptions,
  Filter,
  FindOneAndDeleteOptions,
  FindOneAndReplaceOptions,
  FindOneAndUpdateOptions,
  FindOneOptions,
  FindOptions,
  Flatten,
  IndexDescription,
  InsertManyResult,
  InsertOneOptions,
  InsertOneResult,
  OptionalUnlessRequiredId,
  ReplaceOptions,
  Sort,
  UpdateFilter,
  UpdateOptions,
  UpdateResult,
  WithId,
  WithoutId,
} from "mongodb";
import type { MongsterClient } from "../client";
import { IndexSyncError, QueryError } from "../error";
import { HookRegistry } from "../hooks";
import { AggregateQuery } from "../queries/AggregateQuery";
import { FindOneQuery } from "../queries/FindOneQuery";
import { FindQuery } from "../queries/FindQuery";
import { RefObjectIdSchema } from "../schema/bsons";
import type { MongsterSchema } from "../schema/schema";
import type { MongsterFilter, MongsterUpdateFilter } from "../types/types.filter";
import type {
  HookName,
  HookOperation,
  PostHookContextMap,
  PostHookFn,
  PreHookContextMap,
  PreHookFn,
} from "../types/types.hooks";
import type { SyncIndexResponse } from "../types/types.model";
import type { RefMeta } from "../types/types.populate";
import type { AllFilterKeys } from "../types/types.query";
import type { InferSchemaInputType, InferSchemaType } from "../types/types.schema";

const propsToCopyForNormalization = [
  "unique",
  "sparse",
  "background",
  "expireAfterSeconds",
  "weights",
  "default_language",
  "language_override",
  "hidden",
  "storageEngine",
  "version",
  "textIndexVersion",
  "bits",
  "min",
  "max",
  "bucketSize",
  "wildcardProjection",
  "partialFilterExpression",
  "2dsphereIndexVersion",
] as const satisfies (keyof IndexDescription)[];

/**
 * normalizes an IndexDescription by copying only the supported/known
 * index properties and ensuring a stable shape for hashing/comparison.
 */
function normalizeIndex(idx: IndexDescription): IndexDescription {
  if (!idx.key) throw new IndexSyncError("Normalization error: No key in index object");

  const normalized: IndexDescription = {
    key: Object.fromEntries(Object.entries(idx.key).sort(([a], [b]) => a.localeCompare(b))),
  };
  for (const prop of propsToCopyForNormalization) {
    if (idx[prop] !== undefined) {
      normalized[prop] = idx[prop] as never; // needed never to stop TS from screaming T_T
    }
  }
  return normalized;
}

/**
 * creates a deterministic, human-readable hash for an index description.
 *
 * Example
 * ```ts
 * // input
 * const idx = {
 *   key: { a: 1, b: -1 },
 *   unique: true,
 *   partialFilterExpression: { status: "active" },
 * } as IndexDescription;
 *
 * // output (string)
 * // '{"a":1,"b":-1}|unique:true|partialFilterExpression:{"status":"active"}'
 * const h = hashIndex(idx);
 * ```
 */
function hashIndex(idx: IndexDescription): string {
  let hash = JSON.stringify(idx.key);
  for (const prop of propsToCopyForNormalization) {
    const val = idx[prop];
    if (val !== undefined) {
      hash += `|${prop}:${typeof val === "object" ? JSON.stringify(val) : val}`;
    }
  }
  return hash;
}

/** MongoDB error code returned when a namespace (collection) does not exist. */
const MONGO_ERROR_NS_NOT_FOUND = 26;

/**
 * Options for `MongsterModel#syncIndexes`.
 *
 * - `force`: reset the internal "indexes synced" state before running sync.
 *   Useful for testing or when you want to re-apply schema indexes even if they
 *   were previously synced.
 * - `autoDrop`: when true (default) remove DB indexes that are not present in
 *   the schema. Set to `false` to only create missing indexes and preserve any
 *   manual indexes in the database.
 *
 * Example:
 * ```ts
 * model.syncIndexes({ force: true, autoDrop: false });
 * ```
 */
export interface SyncIndexProp {
  /** Reset internal sync state and re-run index sync */
  force?: boolean;
  /** Whether to auto-drop DB indexes not present in the schema (default: true) */
  autoDrop?: boolean;
}

type SchemaShape<SC extends MongsterSchema<any, any, any>> =
  SC extends MongsterSchema<infer Shape, any, any> ? Shape : never;

export class MongsterModel<
  CN extends string,
  SC extends MongsterSchema<any, any, any>,
  T extends Document = InferSchemaInputType<SC>,
  OT extends Document = InferSchemaType<SC>,
> {
  declare $type: T;
  declare $outType: OT;

  #schema: SC;
  #collectionOpts: CollectionOptions = {};
  #connection: MongsterClient;
  #collection?: Collection<OT>;
  #collectionName: CN;
  #hooks: HookRegistry;

  #indexSynced = false;
  #indexSyncPromise: Promise<SyncIndexResponse> | null = null;

  constructor(connection: MongsterClient, collectionName: CN, schema: SC) {
    this.#collectionName = collectionName;
    this.#schema = schema;
    this.#connection = connection;
    this.#hooks = new HookRegistry();
  }

  #buildRefMap(): Map<string, RefMeta> {
    const shape = this.#schema.getShape();
    const map = new Map<string, RefMeta>();
    for (const [key, fieldSchema] of Object.entries(shape)) {
      if (fieldSchema instanceof RefObjectIdSchema) {
        const modelFn = fieldSchema.getModelFn() as () => { getCollectionName(): string };
        map.set(key, {
          getCollectionName: () => modelFn().getCollectionName(),
        });
      }
    }
    return map;
  }

  pre<Op extends HookName>(op: Op, fn: PreHookFn<Op, T, OT>): this {
    this.#hooks.addPre(op, fn);
    return this;
  }

  post<Op extends HookName>(op: Op, fn: PostHookFn<Op, T, OT>): this {
    this.#hooks.addPost(op, fn);
    return this;
  }

  async #runPre<Op extends HookOperation>(
    op: Op,
    ctx: PreHookContextMap<T, OT>[Op],
  ): Promise<PreHookContextMap<T, OT>[Op]> {
    let current = await this.#hooks.runPre(op, ctx);
    current = await this.#schema.getHooks().runPre(op, current);
    return current;
  }

  async #runPost<Op extends HookOperation>(
    op: Op,
    ctx: PostHookContextMap<T, OT>[Op],
  ): Promise<void> {
    await this.#schema.getHooks().runPost(op, ctx);
    await this.#hooks.runPost(op, ctx);
  }

  getCollection(): Collection<OT> {
    if (typeof this.#collection !== "undefined") return this.#collection;

    const db = this.#connection.getDb();
    this.#collection = db.collection<OT>(this.#collectionName, this.#collectionOpts);
    return this.#collection;
  }

  getCollectionName(): string {
    return this.#collectionName;
  }

  async syncIndexes(props?: SyncIndexProp): Promise<SyncIndexResponse> {
    const { force = false, autoDrop = true } = props ?? {};

    if (force) {
      this.#indexSynced = false;
      this.#indexSyncPromise = null;
    }
    if (!this.#connection.getOptions().autoIndex || this.#indexSynced) {
      return { created: 0, dropped: 0, unchanged: 0 };
    }

    // prevent concurrent sync attempts by reusing in-flight promise
    if (this.#indexSyncPromise) return this.#indexSyncPromise;
    this.#indexSyncPromise = this.#synchronizeIndexes(autoDrop);

    try {
      return await this.#indexSyncPromise;
    } catch (err) {
      this.#indexSyncPromise = null;
      throw err;
    }
  }

  async #synchronizeIndexes(autoDrop: boolean): Promise<SyncIndexResponse> {
    const collection = this.getCollection();

    // get indexes from schema
    const schemaIndexes = this.#schema.collectIndexes();

    try {
      // indexes in db
      const dbIndexes = await collection.listIndexes().toArray();

      const dbManMadeIndexes = dbIndexes.filter((idx) => idx.name !== "_id_");

      const schemaIndexMap = new Map<string, IndexDescription>();
      for (const idx of schemaIndexes) {
        const normalized = normalizeIndex(idx);
        const hash = hashIndex(normalized);
        schemaIndexMap.set(hash, idx);
      }
      const dbIndexMap = new Map<string, any>();
      for (const idx of dbManMadeIndexes) {
        const normalized = normalizeIndex(idx);
        const hash = hashIndex(normalized);
        dbIndexMap.set(hash, idx);
      }

      // figure out what needs to change
      const indexesToCreate: IndexDescription[] = [];
      const idxNamesToDrop: string[] = [];
      let unchangedCount = 0;

      for (const [hash, schemaIdx] of schemaIndexMap) {
        if (!dbIndexMap.has(hash)) {
          indexesToCreate.push(schemaIdx);
        } else {
          unchangedCount++;
        }
      }

      for (const [hash, dbIdx] of dbIndexMap) {
        if (!schemaIndexMap.has(hash)) {
          idxNamesToDrop.push(dbIdx.name);
        }
      }

      if (autoDrop && idxNamesToDrop.length) {
        const dropIndexPromises = idxNamesToDrop.map((idxName) => collection.dropIndex(idxName));
        await Promise.all(dropIndexPromises);
      }

      if (indexesToCreate.length) {
        await collection.createIndexes(indexesToCreate);
      }

      this.#indexSynced = true;

      return {
        created: indexesToCreate.length,
        dropped: idxNamesToDrop.length,
        unchanged: unchangedCount,
      };
    } catch (err: any) {
      if (err.code === MONGO_ERROR_NS_NOT_FOUND) {
        // collection doesn't exist yet

        if (!schemaIndexes.length) return { created: 0, dropped: 0, unchanged: 0 };

        // create the collection and put the indexes

        await this.#connection.getDb().createCollection(this.#collectionName);
        await collection.createIndexes(schemaIndexes);

        this.#indexSynced = true;
        return { created: schemaIndexes.length, dropped: 0, unchanged: 0 };
      }
      throw err;
    }
  }

  /**
   * Insert a document to the collection.
   */
  async insertOne(
    input: OptionalUnlessRequiredId<T>,
    options?: InsertOneOptions,
  ): Promise<InsertOneResult<OT>> {
    if (!input || typeof input !== "object") {
      throw new QueryError("insertOne: input must be an object");
    }
    if (Array.isArray(input)) {
      throw new QueryError("insertOne: input cannot be an array, use insertMany instead");
    }

    if (!this.#indexSynced) await this.syncIndexes();

    const preCtx = await this.#runPre("insertOne", { doc: input as T });

    const collection = this.getCollection();
    const parsedInput = this.#schema.parse(preCtx.doc) as OptionalUnlessRequiredId<OT>;
    const result = await collection.insertOne(parsedInput, options);

    await this.#runPost("insertOne", { doc: preCtx.doc, result });

    return result;
  }

  async insertMany(
    inputArr: OptionalUnlessRequiredId<T>[],
    options?: BulkWriteOptions,
  ): Promise<InsertManyResult<OT>> {
    if (!Array.isArray(inputArr)) {
      throw new QueryError("insertMany: input must be an array");
    }
    if (inputArr.length === 0) {
      throw new QueryError("insertMany: input array cannot be empty");
    }

    if (!this.#indexSynced) await this.syncIndexes();

    const preCtx = await this.#runPre("insertMany", { docs: inputArr as T[] });

    const collection = this.getCollection();

    const parsedInputArr: OptionalUnlessRequiredId<OT>[] = [];
    for (let i = 0; i < preCtx.docs.length; i++) {
      const input = preCtx.docs[i];
      if (!input || typeof input !== "object") {
        throw new QueryError(`insertMany: input at index ${i} must be an object`);
      }
      if (Array.isArray(input)) {
        throw new QueryError(`insertMany: input at index ${i} cannot be an array`);
      }
      const parsedInput = this.#schema.parse(input) as OptionalUnlessRequiredId<OT>;
      parsedInputArr.push(parsedInput);
    }

    const result = await collection.insertMany(parsedInputArr, options);

    await this.#runPost("insertMany", { docs: preCtx.docs, result });

    return result;
  }

  /**
   * Insert a document to the collection. Returns the created document.
   */
  async createOne(
    input: OptionalUnlessRequiredId<T>,
    options?: InsertOneOptions,
  ): Promise<OT | null> {
    if (!input || typeof input !== "object") {
      throw new QueryError("createOne: input must be an object");
    }
    if (Array.isArray(input)) {
      throw new QueryError("createOne: input cannot be an array, use createMany instead");
    }

    if (!this.#indexSynced) await this.syncIndexes();

    const preCtx = await this.#runPre("createOne", { doc: input as T });

    const collection = this.getCollection();
    const parsedInput = this.#schema.parse(preCtx.doc) as OptionalUnlessRequiredId<OT>;
    const result = await collection.insertOne(parsedInput, options);
    if (!result.acknowledged) return null;
    const created = { ...parsedInput, _id: result.insertedId ?? preCtx.doc._id } as OT;

    await this.#runPost("createOne", { doc: preCtx.doc, result: created });

    return created;
  }

  async createMany(
    inputArr: OptionalUnlessRequiredId<T>[],
    options?: BulkWriteOptions,
  ): Promise<OT[]> {
    if (!Array.isArray(inputArr)) {
      throw new QueryError("createMany: input must be an array");
    }
    if (inputArr.length === 0) {
      throw new QueryError("createMany: input array cannot be empty");
    }

    if (!this.#indexSynced) await this.syncIndexes();

    const preCtx = await this.#runPre("createMany", { docs: inputArr as T[] });

    const collection = this.getCollection();

    const parsedInputArr: OptionalUnlessRequiredId<OT>[] = [];
    for (let i = 0; i < preCtx.docs.length; i++) {
      const input = preCtx.docs[i];
      if (!input || typeof input !== "object") {
        throw new QueryError(`createMany: input at index ${i} must be an object`);
      }
      if (Array.isArray(input)) {
        throw new QueryError(`createMany: input at index ${i} cannot be an array`);
      }
      const parsedInput = this.#schema.parse(input) as OptionalUnlessRequiredId<OT>;
      parsedInputArr.push(parsedInput);
    }

    const result = await collection.insertMany(parsedInputArr, options);
    if (!result.acknowledged || result.insertedCount !== preCtx.docs.length) return [];

    const created = parsedInputArr.map((pi, index) => ({
      ...pi,
      _id: pi._id ?? result.insertedIds[index],
    })) as OT[];

    await this.#runPost("createMany", { docs: preCtx.docs, result: created });

    return created;
  }

  async count(filter?: Filter<OT>, options?: CountDocumentsOptions & Abortable): Promise<number> {
    const collection = this.getCollection();

    const docCount = await collection.countDocuments(filter, options);
    return docCount;
  }

  async estimatedCount(options?: EstimatedDocumentCountOptions): Promise<number> {
    const collection = this.getCollection();

    const estimate = await collection.estimatedDocumentCount(options);
    return estimate;
  }

  find(
    filter: MongsterFilter<OT> = {},
    options?: FindOptions & Abortable,
  ): FindQuery<T, OT, SchemaShape<SC>> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new QueryError("find: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new QueryError("find: filter cannot be an array");
    }

    const collection = this.getCollection();

    const hooks = {
      preExec: async ({ filter }: { filter: Filter<OT> }) => {
        const ctx = await this.#runPre("find", { filter: filter as MongsterFilter<OT> });
        return { filter: ctx.filter as Filter<OT> };
      },
      postExec: async ({ filter, result }: { filter: Filter<OT>; result: OT[] }) => {
        await this.#runPost("find", { filter: filter as MongsterFilter<OT>, result });
      },
    };

    return new FindQuery<T, OT, SchemaShape<SC>>(
      collection,
      filter as Filter<OT>,
      options,
      hooks,
      this.#buildRefMap(),
    );
  }

  findOne(
    filter: MongsterFilter<OT>,
    options?: Omit<FindOneOptions, "timeoutMode"> & Abortable,
  ): FindOneQuery<T, OT, SchemaShape<SC>> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new QueryError("findOne: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new QueryError("findOne: filter cannot be an array");
    }

    const collection = this.getCollection();

    const hooks = {
      preExec: async (f: Filter<OT>) => {
        const ctx = await this.#runPre("findOne", { filter: f as MongsterFilter<OT> });
        return ctx.filter as Filter<OT>;
      },
      postExec: async (f: Filter<OT>, result: OT | null) => {
        await this.#runPost("findOne", { filter: f as MongsterFilter<OT>, result });
      },
    };

    return new FindOneQuery<T, OT, SchemaShape<SC>>(
      collection,
      filter as Filter<OT>,
      options,
      hooks,
      this.#buildRefMap(),
    );
  }

  findById(
    _id: WithId<OT>["_id"],
    options?: Omit<FindOneOptions, "timeoutMode"> & Abortable,
  ): FindOneQuery<T, OT, SchemaShape<SC>> {
    if (_id === null || _id === undefined) {
      throw new QueryError("findById: _id is required");
    }

    const collection = this.getCollection();
    let currentId = _id;

    const hooks = {
      preExec: async (_f: Filter<OT>) => {
        const ctx = await this.#runPre("findById", { _id: currentId });
        currentId = ctx._id;
        return { _id: currentId } as Filter<OT>;
      },
      postExec: async (_f: Filter<OT>, result: OT | null) => {
        await this.#runPost("findById", { _id: currentId, result });
      },
    };

    return new FindOneQuery<T, OT, SchemaShape<SC>>(
      collection,
      { _id } as Filter<OT>,
      options,
      hooks,
      this.#buildRefMap(),
    );
  }

  async distinct(
    key: AllFilterKeys<OT>,
    filter?: MongsterFilter<OT>,
    options?: DistinctOptions,
  ): Promise<Flatten<WithId<OT>[string]>[]> {
    if (!key || typeof key !== "string") {
      throw new QueryError("distinct: key must be a non-empty string");
    }
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new QueryError("distinct: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new QueryError("distinct: filter cannot be an array");
    }

    const collection = this.getCollection();

    const distinctArray = await collection.distinct(
      key as string,
      (filter ?? {}) as Filter<OT>,
      options ?? {},
    );
    return distinctArray;
  }

  async updateOne(
    filter: MongsterFilter<OT>,
    updateData: MongsterUpdateFilter<OT>,
    options?: UpdateOptions & { sort?: Sort },
  ): Promise<UpdateResult<OT>> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new QueryError("updateOne: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new QueryError("updateOne: filter cannot be an array");
    }
    if (!updateData || typeof updateData !== "object") {
      throw new QueryError("updateOne: updateData must be an object");
    }
    if (Array.isArray(updateData)) {
      throw new QueryError("updateOne: updateData cannot be an array");
    }

    if (options?.upsert && !this.#indexSynced) await this.syncIndexes();

    const preCtx = await this.#runPre("updateOne", { filter, update: updateData });

    const collection = this.getCollection();
    const parsedUpdateData = this.#schema.parseForUpdate(preCtx.update as any, options?.upsert);
    const result = await collection.updateOne(
      preCtx.filter as Filter<OT>,
      parsedUpdateData as UpdateFilter<OT>,
      options,
    );

    await this.#runPost("updateOne", { filter: preCtx.filter, update: preCtx.update, result });

    return result;
  }

  async updateMany(
    filter: MongsterFilter<OT>,
    updateData: MongsterUpdateFilter<OT>,
    options?: UpdateOptions & { sort?: Sort },
  ): Promise<UpdateResult<OT>> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new QueryError("updateMany: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new QueryError("updateMany: filter cannot be an array");
    }
    if (!updateData || typeof updateData !== "object") {
      throw new QueryError("updateMany: updateData must be an object");
    }
    if (Array.isArray(updateData)) {
      throw new QueryError("updateMany: updateData cannot be an array");
    }

    if (options?.upsert && !this.#indexSynced) await this.syncIndexes();

    const preCtx = await this.#runPre("updateMany", { filter, update: updateData });

    const collection = this.getCollection();
    const parsedUpdateData = this.#schema.parseForUpdate(preCtx.update as any, options?.upsert);
    const result = await collection.updateMany(
      preCtx.filter as Filter<OT>,
      parsedUpdateData as UpdateFilter<OT>,
      options,
    );

    await this.#runPost("updateMany", { filter: preCtx.filter, update: preCtx.update, result });

    return result;
  }

  async findOneAndUpdate(
    filter: MongsterFilter<OT>,
    updateData: MongsterUpdateFilter<OT>,
    options?: FindOneAndUpdateOptions & { includeResultMetadata: true },
  ): Promise<WithId<OT> | null> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new QueryError("findOneAndUpdate: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new QueryError("findOneAndUpdate: filter cannot be an array");
    }
    if (!updateData || typeof updateData !== "object") {
      throw new QueryError("findOneAndUpdate: updateData must be an object");
    }
    if (Array.isArray(updateData)) {
      throw new QueryError("findOneAndUpdate: updateData cannot be an array");
    }

    if (options?.upsert && !this.#indexSynced) await this.syncIndexes();

    const preCtx = await this.#runPre("findOneAndUpdate", { filter, update: updateData });

    const collection = this.getCollection();
    const parsedUpdateData = this.#schema.parseForUpdate(preCtx.update as any, options?.upsert);
    const result = await collection.findOneAndUpdate(
      preCtx.filter as Filter<OT>,
      parsedUpdateData as UpdateFilter<OT>,
      options ?? {},
    );

    await this.#runPost("findOneAndUpdate", {
      filter: preCtx.filter,
      update: preCtx.update,
      result,
    });

    return result;
  }

  async replaceOne(
    filter: MongsterFilter<OT>,
    replacement: WithoutId<OT>,
    options?: ReplaceOptions,
  ): Promise<UpdateResult<OT>> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new QueryError("replaceOne: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new QueryError("replaceOne: filter cannot be an array");
    }
    if (!replacement || typeof replacement !== "object") {
      throw new QueryError("replaceOne: replacement must be an object");
    }
    if (Array.isArray(replacement)) {
      throw new QueryError("replaceOne: replacement cannot be an array");
    }

    if (options?.upsert && !this.#indexSynced) await this.syncIndexes();

    const preCtx = await this.#runPre("replaceOne", { filter, replacement });

    const collection = this.getCollection();
    const parsedData = this.#schema.parse(preCtx.replacement) as WithoutId<OT>;
    const result = await collection.replaceOne(preCtx.filter as Filter<OT>, parsedData, options);

    await this.#runPost("replaceOne", {
      filter: preCtx.filter,
      replacement: preCtx.replacement,
      result,
    });

    return result;
  }

  async findOneAndReplace(
    filter: MongsterFilter<OT>,
    replacement: WithoutId<OT>,
    options?: FindOneAndReplaceOptions & { includeResultMetadata: true },
  ): Promise<WithId<OT> | null> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new QueryError("findOneAndReplace: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new QueryError("findOneAndReplace: filter cannot be an array");
    }
    if (!replacement || typeof replacement !== "object") {
      throw new QueryError("findOneAndReplace: replacement must be an object");
    }
    if (Array.isArray(replacement)) {
      throw new QueryError("findOneAndReplace: replacement cannot be an array");
    }

    if (options?.upsert && !this.#indexSynced) await this.syncIndexes();

    const preCtx = await this.#runPre("findOneAndReplace", { filter, replacement });

    const collection = this.getCollection();
    const parsedData = this.#schema.parse(preCtx.replacement) as WithoutId<OT>;
    const result = await collection.findOneAndReplace(
      preCtx.filter as Filter<OT>,
      parsedData,
      options ?? {},
    );

    await this.#runPost("findOneAndReplace", {
      filter: preCtx.filter,
      replacement: preCtx.replacement,
      result,
    });

    return result;
  }

  async upsertOne(
    filter: MongsterFilter<OT>,
    updateData: OptionalUnlessRequiredId<T>,
    options?: UpdateOptions & { sort?: Sort },
  ): Promise<UpdateResult<OT>> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new QueryError("upsertOne: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new QueryError("upsertOne: filter cannot be an array");
    }
    if (!updateData || typeof updateData !== "object") {
      throw new QueryError("upsertOne: updateData must be an object");
    }
    if (Array.isArray(updateData)) {
      throw new QueryError("upsertOne: updateData cannot be an array");
    }

    if (!this.#indexSynced) await this.syncIndexes();

    const preCtx = await this.#runPre("upsertOne", { filter, doc: updateData as T });

    const collection = this.getCollection();
    const parsedData = this.#schema.parse(preCtx.doc);

    const { _id, ...dataWithoutId } = parsedData;
    const updateFilter = { $set: dataWithoutId } as UpdateFilter<OT>;
    if (typeof _id !== "undefined") {
      (updateFilter as UpdateFilter<any>).$setOnInsert = { _id };
    }

    const result = await collection.updateOne(preCtx.filter as Filter<OT>, updateFilter, {
      ...options,
      upsert: true,
    });

    await this.#runPost("upsertOne", { filter: preCtx.filter, doc: preCtx.doc, result });

    return result;
  }

  async deleteOne(filter: MongsterFilter<OT>, options?: DeleteOptions): Promise<DeleteResult> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new QueryError("deleteOne: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new QueryError("deleteOne: filter cannot be an array");
    }

    const preCtx = await this.#runPre("deleteOne", { filter });

    const collection = this.getCollection();
    const result = await collection.deleteOne(preCtx.filter as Filter<OT>, options);

    await this.#runPost("deleteOne", { filter: preCtx.filter, result });

    return result;
  }

  async deleteMany(filter: MongsterFilter<OT>, options?: DeleteOptions): Promise<DeleteResult> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new QueryError("deleteMany: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new QueryError("deleteMany: filter cannot be an array");
    }

    const preCtx = await this.#runPre("deleteMany", { filter });

    const collection = this.getCollection();
    const result = await collection.deleteMany(preCtx.filter as Filter<OT>, options);

    await this.#runPost("deleteMany", { filter: preCtx.filter, result });

    return result;
  }

  async findOneAndDelete(
    filter: MongsterFilter<OT>,
    options?: FindOneAndDeleteOptions & { includeResultMetadata: true },
  ): Promise<WithId<OT> | null> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new QueryError("findOneAndDelete: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new QueryError("findOneAndDelete: filter cannot be an array");
    }

    const preCtx = await this.#runPre("findOneAndDelete", { filter });

    const collection = this.getCollection();
    const result = await collection.findOneAndDelete(preCtx.filter as Filter<OT>, options ?? {});

    await this.#runPost("findOneAndDelete", { filter: preCtx.filter, result });

    return result;
  }

  aggregate(options?: AggregateOptions & Abortable): AggregateQuery<OT, OT> {
    const collection = this.getCollection();
    return new AggregateQuery<OT, OT>(collection, options);
  }

  async aggregateRaw<ReturnType = Document[]>(
    pipeline?: Document[],
    options?: AggregateOptions & Abortable,
  ): Promise<ReturnType> {
    if (pipeline !== null && pipeline !== undefined && !Array.isArray(pipeline)) {
      throw new QueryError("aggregateRaw: pipeline must be an array");
    }

    const collection = this.getCollection();

    const result = collection.aggregate(pipeline, options);
    return result.toArray() as unknown as ReturnType;
  }

  async bulkWrite(
    operations: AnyBulkWriteOperation<OT>[],
    options?: BulkWriteOptions,
  ): Promise<BulkWriteResult> {
    if (!Array.isArray(operations)) {
      throw new QueryError("bulkWrite: operations must be an array");
    }

    if (!this.#indexSynced) await this.syncIndexes();

    const preCtx = await this.#runPre("bulkWrite", { operations });

    const collection = this.getCollection();
    const result = await collection.bulkWrite(preCtx.operations, options);

    await this.#runPost("bulkWrite", { operations: preCtx.operations, result });

    return result;
  }
}
