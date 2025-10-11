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
  FindOneOptions,
  FindOptions,
  Flatten,
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
import type { Mongster } from "../client";
import { Query } from "../queries/find/Query";
import type { MongsterSchema } from "../schema/base";
import type { MongsterFilter, MongsterUpdateFilter } from "../types/types.filter";
import type { AllFilterKeys } from "../types/types.query";
import type { InferSchemaInputType, InferSchemaType } from "../types/types.schema";

export class MongsterCollection<
  CN extends string,
  SC extends MongsterSchema<any>,
  T extends Document = InferSchemaInputType<SC>,
  OT extends Document = InferSchemaType<SC>,
> {
  declare $type: T;
  declare $outType: OT;

  #schema: SC;
  #collectionOpts: CollectionOptions = {};
  #connection: Mongster;
  #collection?: Collection<OT>;
  #collectionName: CN;

  constructor(connection: Mongster, collectionName: CN, schema: SC) {
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

  /**
   * Insert a document to the collection.
   */
  async insertOne(
    input: OptionalUnlessRequiredId<OT>,
    options?: InsertOneOptions,
  ): Promise<InsertOneResult<OT>> {
    const collection = this.getCollection();

    const parsedInput = this.#schema.parse(input) as typeof input;

    const result = await collection.insertOne(parsedInput, options);
    return result;
  }

  async insertMany(
    inputArr: OptionalUnlessRequiredId<OT>[],
    options?: BulkWriteOptions,
  ): Promise<InsertManyResult<OT>> {
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
  async create(input: OptionalUnlessRequiredId<T>, options?: InsertOneOptions): Promise<OT | null> {
    const collection = this.getCollection();

    const parsedInput = this.#schema.parse(input) as OptionalUnlessRequiredId<OT>;

    const result = await collection.insertOne(parsedInput, options);
    if (!result.acknowledged) return null;
    return { ...parsedInput, _id: result.insertedId ?? input._id } as OT;
  }

  async createMany(
    inputArr: OptionalUnlessRequiredId<OT>[],
    options?: BulkWriteOptions,
  ): Promise<OT[]> {
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

  find(filter: MongsterFilter<OT>, options?: FindOptions & Abortable): Query<T, OT> {
    const collection = this.getCollection();

    const cursor = collection.find<OT>(filter as Filter<OT>, options);
    return new Query<T, OT>(cursor);
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
    const collection = this.getCollection();

    const result = await collection.updateMany(
      filter as Filter<OT>,
      updateData as UpdateFilter<OT>,
      options,
    );
    return result;
  }

  async replaceOne(
    filter: MongsterFilter<OT>,
    replacement: WithoutId<OT>,
    options?: ReplaceOptions,
  ): Promise<UpdateResult<OT>> {
    const collection = this.getCollection();

    const result = await collection.replaceOne(filter as Filter<OT>, replacement, options);
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

export { MongsterCollection as MongsterModel };
