import type {
  Abortable,
  AggregateOptions,
  BulkWriteOptions,
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
import { FindQuery } from "../queries/FindQuery";
import type { MongsterSchema } from "../schema/schema";
import type { MongsterFilter, MongsterUpdateFilter } from "../types/types.filter";
import type { SyncIndexResponse } from "../types/types.model";
import type { AllFilterKeys } from "../types/types.query";
import type { InferSchemaInputType, InferSchemaType } from "../types/types.schema";

function normalizeIndex(idx: any): IndexDescription {
  if (!idx.key) throw new Error("Normalization error: No key in index object");
  const normalized: IndexDescription = { key: idx.key };

  if (idx.unique !== undefined) normalized.unique = idx.unique;
  if (idx.sparse !== undefined) normalized.sparse = idx.sparse;
  if (idx.background !== undefined) normalized.background = idx.background;
  if (idx.expireAfterSeconds !== undefined) normalized.expireAfterSeconds = idx.expireAfterSeconds;
  if (idx.weights !== undefined) normalized.weights = idx.weights;
  if (idx.default_language !== undefined) normalized.default_language = idx.default_language;
  if (idx.language_override !== undefined) normalized.language_override = idx.language_override;
  if (idx.hidden !== undefined) normalized.hidden = idx.hidden;
  if (idx.storageEngine !== undefined) normalized.storageEngine = idx.storageEngine;
  if (idx.version !== undefined) normalized.version = idx.version;
  if (idx.textIndexVersion !== undefined) normalized.textIndexVersion = idx.textIndexVersion;
  if (idx.bits !== undefined) normalized.bits = idx.bits;
  if (idx.min !== undefined) normalized.min = idx.min;
  if (idx.max !== undefined) normalized.max = idx.max;
  if (idx.bucketSize !== undefined) normalized.bucketSize = idx.bucketSize;
  if (idx.wildcardProjection !== undefined) normalized.wildcardProjection = idx.wildcardProjection;
  if (idx.partialFilterExpression !== undefined) {
    normalized.partialFilterExpression = idx.partialFilterExpression;
  }
  if (idx["2dsphereIndexVersion"] !== undefined) {
    normalized["2dsphereIndexVersion"] = idx["2dsphereIndexVersion"];
  }

  return normalized;
}

function hashIndex(idx: IndexDescription) {
  return JSON.stringify(idx);
}

interface SyncIndexProp {
  force?: boolean;
  autoDrop?: boolean;
}

export class MongsterModel<
  CN extends string,
  SC extends MongsterSchema<any>,
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

  #indexSynced = false;

  constructor(connection: MongsterClient, collectionName: CN, schema: SC) {
    this.#collectionName = collectionName;
    this.#schema = schema;
    this.#connection = connection;
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

    if (force) this.#indexSynced = false;
    if (!this.#connection.getOptions().autoIndex || this.#indexSynced) {
      return { created: 0, dropped: 0, unchanged: 0 };
    }

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
      if (err.code === 26) {
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
    input: OptionalUnlessRequiredId<OT>,
    options?: InsertOneOptions,
  ): Promise<InsertOneResult<OT>> {
    if (!input || typeof input !== "object") {
      throw new Error("insertOne: input must be an object");
    }
    if (Array.isArray(input)) {
      throw new Error("insertOne: input cannot be an array, use insertMany instead");
    }

    if (!this.#indexSynced) await this.syncIndexes();

    const collection = this.getCollection();

    const parsedInput = this.#schema.parse(input) as typeof input;

    const result = await collection.insertOne(parsedInput, options);

    return result;
  }

  async insertMany(
    inputArr: OptionalUnlessRequiredId<OT>[],
    options?: BulkWriteOptions,
  ): Promise<InsertManyResult<OT>> {
    if (!Array.isArray(inputArr)) {
      throw new Error("insertMany: input must be an array");
    }
    if (inputArr.length === 0) {
      throw new Error("insertMany: input array cannot be empty");
    }

    if (!this.#indexSynced) await this.syncIndexes();

    const collection = this.getCollection();

    const parsedInputArr: OptionalUnlessRequiredId<OT>[] = [];
    for (let i = 0; i < inputArr.length; i++) {
      const input = inputArr[i];
      if (!input || typeof input !== "object") {
        throw new Error(`insertMany: input at index ${i} must be an object`);
      }
      if (Array.isArray(input)) {
        throw new Error(`insertMany: input at index ${i} cannot be an array`);
      }
      const parsedInput = this.#schema.parse(input) as OptionalUnlessRequiredId<OT>;
      parsedInputArr.push(parsedInput);
    }

    const result = await collection.insertMany(parsedInputArr, options);
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
      throw new Error("createOne: input must be an object");
    }
    if (Array.isArray(input)) {
      throw new Error("createOne: input cannot be an array, use createMany instead");
    }

    if (!this.#indexSynced) await this.syncIndexes();

    const collection = this.getCollection();

    const parsedInput = this.#schema.parse(input) as OptionalUnlessRequiredId<OT>;

    const result = await collection.insertOne(parsedInput, options);
    if (!result.acknowledged) return null;
    return { ...parsedInput, _id: result.insertedId ?? input._id } as OT;
  }

  async createMany(
    inputArr: OptionalUnlessRequiredId<T>[],
    options?: BulkWriteOptions,
  ): Promise<OT[]> {
    if (!Array.isArray(inputArr)) {
      throw new Error("createMany: input must be an array");
    }
    if (inputArr.length === 0) {
      throw new Error("createMany: input array cannot be empty");
    }

    if (!this.#indexSynced) await this.syncIndexes();

    const collection = this.getCollection();

    const parsedInputArr: OptionalUnlessRequiredId<OT>[] = [];
    for (let i = 0; i < inputArr.length; i++) {
      const input = inputArr[i];
      if (!input || typeof input !== "object") {
        throw new Error(`createMany: input at index ${i} must be an object`);
      }
      if (Array.isArray(input)) {
        throw new Error(`createMany: input at index ${i} cannot be an array`);
      }
      const parsedInput = this.#schema.parse(input) as OptionalUnlessRequiredId<OT>;
      parsedInputArr.push(parsedInput);
    }

    const result = await collection.insertMany(parsedInputArr, options);
    if (!result.acknowledged || result.insertedCount !== inputArr.length) return [];

    return parsedInputArr.map((pi, index) => ({
      ...pi,
      _id: (pi as any)._id ?? result.insertedIds[index],
    })) as OT[];
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

  find(filter: MongsterFilter<OT>, options?: FindOptions & Abortable): FindQuery<T, OT> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new Error("find: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new Error("find: filter cannot be an array");
    }

    const collection = this.getCollection();

    const cursor = collection.find<OT>(filter as Filter<OT>, options);
    return new FindQuery<T, OT>(cursor);
  }

  async findOne(
    filter: MongsterFilter<OT>,
    options?: Omit<FindOneOptions, "timeoutMode"> & Abortable,
  ): Promise<OT | null> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new Error("findOne: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new Error("findOne: filter cannot be an array");
    }

    const collection = this.getCollection();

    const result = await collection.findOne(filter as Filter<OT>, options);
    return result;
  }

  async distinct(
    key: AllFilterKeys<OT>,
    filter?: MongsterFilter<OT>,
    options?: DistinctOptions,
  ): Promise<Flatten<WithId<OT>[string]>[]> {
    if (!key || typeof key !== "string") {
      throw new Error("distinct: key must be a non-empty string");
    }
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new Error("distinct: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new Error("distinct: filter cannot be an array");
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
      throw new Error("updateOne: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new Error("updateOne: filter cannot be an array");
    }
    if (!updateData || typeof updateData !== "object") {
      throw new Error("updateOne: updateData must be an object");
    }
    if (Array.isArray(updateData)) {
      throw new Error("updateOne: updateData cannot be an array");
    }

    if (options?.upsert && !this.#indexSynced) await this.syncIndexes();

    const collection = this.getCollection();

    const parsedUpdateData = this.#schema.parseForUpdate(updateData as any);

    const result = await collection.updateOne(
      filter as Filter<OT>,
      parsedUpdateData as UpdateFilter<OT>,
      options,
    );
    return result;
  }

  async updateMany(
    filter: MongsterFilter<OT>,
    updateData: MongsterUpdateFilter<OT>,
    options?: UpdateOptions & { sort?: Sort },
  ): Promise<UpdateResult<OT>> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new Error("updateMany: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new Error("updateMany: filter cannot be an array");
    }
    if (!updateData || typeof updateData !== "object") {
      throw new Error("updateMany: updateData must be an object");
    }
    if (Array.isArray(updateData)) {
      throw new Error("updateMany: updateData cannot be an array");
    }

    if (options?.upsert && !this.#indexSynced) await this.syncIndexes();

    const collection = this.getCollection();

    const parsedUpdateData = this.#schema.parseForUpdate(updateData as any);

    const result = await collection.updateMany(
      filter as Filter<OT>,
      parsedUpdateData as UpdateFilter<OT>,
      options,
    );
    return result;
  }

  async findOneAndUpdate(
    filter: MongsterFilter<OT>,
    updateData: MongsterUpdateFilter<OT>,
    options?: FindOneAndUpdateOptions & { includeResultMetadata: true },
  ): Promise<WithId<OT> | null> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new Error("findOneAndUpdate: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new Error("findOneAndUpdate: filter cannot be an array");
    }
    if (!updateData || typeof updateData !== "object") {
      throw new Error("findOneAndUpdate: updateData must be an object");
    }
    if (Array.isArray(updateData)) {
      throw new Error("findOneAndUpdate: updateData cannot be an array");
    }

    if (options?.upsert && !this.#indexSynced) await this.syncIndexes();

    const collection = this.getCollection();

    const parsedUpdateData = this.#schema.parseForUpdate(updateData as any);

    const result = await collection.findOneAndUpdate(
      filter as Filter<OT>,
      parsedUpdateData as UpdateFilter<OT>,
      options ?? {},
    );
    return result;
  }

  async replaceOne(
    filter: MongsterFilter<OT>,
    replacement: WithoutId<OT>,
    options?: ReplaceOptions,
  ): Promise<UpdateResult<OT>> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new Error("replaceOne: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new Error("replaceOne: filter cannot be an array");
    }
    if (!replacement || typeof replacement !== "object") {
      throw new Error("replaceOne: replacement must be an object");
    }
    if (Array.isArray(replacement)) {
      throw new Error("replaceOne: replacement cannot be an array");
    }

    if (options?.upsert && !this.#indexSynced) await this.syncIndexes();

    const collection = this.getCollection();
    const parsedData = this.#schema.parse(replacement) as WithoutId<OT>;

    const result = await collection.replaceOne(filter as Filter<OT>, parsedData, options);
    return result;
  }

  async findOneAndReplace(
    filter: MongsterFilter<OT>,
    replacement: WithoutId<OT>,
    options?: FindOneAndReplaceOptions & { includeResultMetadata: true },
  ): Promise<WithId<OT> | null> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new Error("findOneAndReplace: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new Error("findOneAndReplace: filter cannot be an array");
    }
    if (!replacement || typeof replacement !== "object") {
      throw new Error("findOneAndReplace: replacement must be an object");
    }
    if (Array.isArray(replacement)) {
      throw new Error("findOneAndReplace: replacement cannot be an array");
    }

    if (options?.upsert && !this.#indexSynced) await this.syncIndexes();

    const collection = this.getCollection();
    const parsedData = this.#schema.parse(replacement) as WithoutId<OT>;

    const result = await collection.findOneAndReplace(
      filter as Filter<OT>,
      parsedData,
      options ?? {},
    );
    return result;
  }

  async upsertOne(
    filter: MongsterFilter<OT>,
    updateData: OptionalUnlessRequiredId<T>,
    options?: UpdateOptions & { sort?: Sort },
  ): Promise<UpdateResult<OT>> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new Error("upsertOne: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new Error("upsertOne: filter cannot be an array");
    }
    if (!updateData || typeof updateData !== "object") {
      throw new Error("upsertOne: updateData must be an object");
    }
    if (Array.isArray(updateData)) {
      throw new Error("upsertOne: updateData cannot be an array");
    }

    if (!this.#indexSynced) await this.syncIndexes();

    const collection = this.getCollection();
    const parsedData = this.#schema.parse(updateData);

    const result = await collection.updateOne(
      filter as Filter<OT>,
      parsedData as UpdateFilter<OT>,
      { ...options, upsert: true },
    );
    return result;
  }

  async deleteOne(filter: MongsterFilter<OT>, options?: DeleteOptions): Promise<DeleteResult> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new Error("deleteOne: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new Error("deleteOne: filter cannot be an array");
    }

    const collection = this.getCollection();

    const result = await collection.deleteOne(filter as Filter<OT>, options);
    return result;
  }

  async deleteMany(filter: MongsterFilter<OT>, options?: DeleteOptions): Promise<DeleteResult> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new Error("deleteMany: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new Error("deleteMany: filter cannot be an array");
    }

    const collection = this.getCollection();

    const result = await collection.deleteMany(filter as Filter<OT>, options);
    return result;
  }

  async findOneAndDelete(
    filter: MongsterFilter<OT>,
    options?: FindOneAndDeleteOptions & { includeResultMetadata: true },
  ): Promise<WithId<OT> | null> {
    if (filter !== null && filter !== undefined && typeof filter !== "object") {
      throw new Error("findOneAndDelete: filter must be an object");
    }
    if (Array.isArray(filter)) {
      throw new Error("findOneAndDelete: filter cannot be an array");
    }

    const collection = this.getCollection();

    const result = await collection.findOneAndDelete(filter as Filter<OT>, options ?? {});
    return result;
  }

  async aggregateRaw<ReturnType = Document[]>(
    pipeline?: Document[],
    options?: AggregateOptions & Abortable,
  ): Promise<ReturnType> {
    if (pipeline !== null && pipeline !== undefined && !Array.isArray(pipeline)) {
      throw new Error("aggregateRaw: pipeline must be an array");
    }

    const collection = this.getCollection();

    const result = collection.aggregate(pipeline, options);
    return result.toArray() as unknown as ReturnType;
  }
}
