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
  RenameOptions,
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

function hashIndex(idx: any) {
  return JSON.stringify({
    key: idx.key,
    unique: idx.unique,
    sparse: idx.sparse,
    partialFilterExpression: idx.partialFilterExpression,
    expireAfterSeconds: idx.expireAfterSeconds,
  });
}

function normalizeIndex(idx: any): IndexDescription {
  const normalized: IndexDescription = { key: idx.key };

  // Add optional properties if they exist
  if (idx.unique !== undefined) normalized.unique = idx.unique;
  if (idx.sparse !== undefined) normalized.sparse = idx.sparse;
  if (idx.background !== undefined) normalized.background = idx.background;
  if (idx.partialFilterExpression !== undefined) {
    normalized.partialFilterExpression = idx.partialFilterExpression;
  }
  if (idx.expireAfterSeconds !== undefined) {
    normalized.expireAfterSeconds = idx.expireAfterSeconds;
  }
  if (idx.weights !== undefined) normalized.weights = idx.weights;
  if (idx.default_language !== undefined) normalized.default_language = idx.default_language;
  if (idx.language_override !== undefined) normalized.language_override = idx.language_override;

  return normalized;
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

  async syncIndexes(force = false): Promise<SyncIndexResponse> {
    if (!this.#connection.getOptions().autoIndex || (this.#indexSynced && !force)) {
      return { created: 0, dropped: 0, unchanged: 0 };
    }

    const collection = this.getCollection();

    // get indexes from schema
    const schemaIndexes = this.#schema.collectIndexes();

    try {
      // indexes in db
      const dbIndexes = await collection.listIndexes().toArray();

      const dbUserIndexes = dbIndexes.filter((idx) => idx.name !== "_id_");

      const schemaIndexMap = new Map<string, IndexDescription>();
      for (const idx of schemaIndexes) {
        const normalized = normalizeIndex(idx);
        const hash = hashIndex(normalized);
        schemaIndexMap.set(hash, idx);
      }
      const dbIndexMap = new Map<string, any>();
      for (const idx of dbUserIndexes) {
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

      for (const idxName of idxNamesToDrop) {
        await collection.dropIndex(idxName);
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
    await this.syncIndexes();

    const collection = this.getCollection();

    const parsedInput = this.#schema.parse(input) as typeof input;

    const result = await collection.insertOne(parsedInput, options);

    return result;
  }

  async insertMany(
    inputArr: OptionalUnlessRequiredId<OT>[],
    options?: BulkWriteOptions,
  ): Promise<InsertManyResult<OT>> {
    await this.syncIndexes();

    const collection = this.getCollection();

    const parsedInputArr: OptionalUnlessRequiredId<OT>[] = [];
    for (const input of inputArr) {
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
    await this.syncIndexes();

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
    await this.syncIndexes();

    const collection = this.getCollection();

    const parsedInputArr: OptionalUnlessRequiredId<OT>[] = [];
    for (const input of inputArr) {
      const parsedInput = this.#schema.parse(input) as OptionalUnlessRequiredId<OT>;
      parsedInputArr.push(parsedInput);
    }

    const result = await collection.insertMany(parsedInputArr, options);
    if (!result.acknowledged || result.insertedCount !== inputArr.length) return [];

    return parsedInputArr.map((pi, index) => ({
      ...pi,
      _id: pi ?? result.insertedIds[index],
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
    const collection = this.getCollection();

    const cursor = collection.find<OT>(filter as Filter<OT>, options);
    return new FindQuery<T, OT>(cursor);
  }

  async findOne(
    filter: MongsterFilter<OT>,
    options?: Omit<FindOneOptions, "timeoutMode"> & Abortable,
  ): Promise<OT | null> {
    const collection = this.getCollection();

    const result = await collection.findOne(filter as Filter<OT>, options);
    return result;
  }

  async distinct(
    key: AllFilterKeys<OT>,
    filter?: MongsterFilter<OT>,
    options?: DistinctOptions,
  ): Promise<Flatten<WithId<OT>[string]>[]> {
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
    if (options?.upsert) await this.syncIndexes();

    const collection = this.getCollection();

    const result = await collection.updateOne(
      filter as Filter<OT>,
      updateData as UpdateFilter<OT>,
      options,
    );
    return result;
  }

  async updateMany(
    filter: MongsterFilter<OT>,
    updateData: MongsterUpdateFilter<OT>,
    options?: UpdateOptions & { sort?: Sort },
  ): Promise<UpdateResult<OT>> {
    if (options?.upsert) await this.syncIndexes();

    const collection = this.getCollection();

    const result = await collection.updateMany(
      filter as Filter<OT>,
      updateData as UpdateFilter<OT>,
      options,
    );
    return result;
  }

  async findOneAndUpdate(
    filter: MongsterFilter<OT>,
    updateData: MongsterUpdateFilter<OT>,
    options?: FindOneAndUpdateOptions & { includeResultMetadata: true },
  ): Promise<WithId<OT> | null> {
    if (options?.upsert) await this.syncIndexes();

    const collection = this.getCollection();

    const result = await collection.findOneAndUpdate(
      filter as Filter<OT>,
      updateData as UpdateFilter<OT>,
      options ?? {},
    );
    return result;
  }

  async replaceOne(
    filter: MongsterFilter<OT>,
    replacement: WithoutId<OT>,
    options?: ReplaceOptions,
  ): Promise<UpdateResult<OT>> {
    if (options?.upsert) await this.syncIndexes();

    const collection = this.getCollection();

    const result = await collection.replaceOne(filter as Filter<OT>, replacement, options);
    return result;
  }

  async findOneAndReplace(
    filter: MongsterFilter<OT>,
    replacement: WithoutId<OT>,
    options?: FindOneAndReplaceOptions & { includeResultMetadata: true },
  ): Promise<WithId<OT> | null> {
    if (options?.upsert) await this.syncIndexes();

    const collection = this.getCollection();

    const result = await collection.findOneAndReplace(
      filter as Filter<OT>,
      replacement,
      options ?? {},
    );
    return result;
  }

  async upsertOne(
    filter: MongsterFilter<OT>,
    updateData: OptionalUnlessRequiredId<T>,
    options?: UpdateOptions & { sort?: Sort },
  ): Promise<UpdateResult<OT>> {
    await this.syncIndexes();

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
    const collection = this.getCollection();

    const result = await collection.deleteOne(filter as Filter<OT>, options);
    return result;
  }

  async deleteMany(filter: MongsterFilter<OT>, options?: DeleteOptions): Promise<DeleteResult> {
    const collection = this.getCollection();

    const result = await collection.deleteMany(filter as Filter<OT>, options);
    return result;
  }

  async findOneAndDelete(
    filter: MongsterFilter<OT>,
    options?: FindOneAndDeleteOptions & { includeResultMetadata: true },
  ): Promise<WithId<OT> | null> {
    const collection = this.getCollection();

    const result = await collection.findOneAndDelete(filter as Filter<OT>, options ?? {});
    return result;
  }

  async renameCollection(newName: string, options?: RenameOptions): Promise<Collection<OT>> {
    const collection = this.getCollection();

    const renamedCollection = await collection.rename(newName, options);
    this.#collection = renamedCollection as unknown as Collection<OT>;
    return this.#collection;
  }

  async aggregateRaw<ReturnType = Document[]>(
    pipeline?: Document[],
    options?: AggregateOptions & Abortable,
  ): Promise<ReturnType> {
    const collection = this.getCollection();

    const result = collection.aggregate(pipeline, options);
    return result.toArray() as unknown as ReturnType;
  }
}
