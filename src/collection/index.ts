import type {
  Abortable,
  CollectionOptions,
  CountDocumentsOptions,
  Document,
  Filter,
  FindOptions,
  InsertOneOptions,
  InsertOneResult,
  OptionalUnlessRequiredId,
  Sort,
  UpdateFilter,
  UpdateOptions,
} from "mongodb";
import type { Mongster } from "../mongster";
import { Query } from "../queries/find/Query";
import type { MongsterSchema } from "../schema/base";
import type { InferSchemaInputType, InferSchemaType } from "../types/types.schema";

export class MongsterCollection<
  CN extends string,
  SC extends MongsterSchema<any>,
  T extends Document = InferSchemaInputType<SC>,
  OT extends Document = InferSchemaType<SC>,
> {
  declare $type: T;
  declare $outType: OT;

  collectionName: CN;
  #schema: SC;
  #collectionOpts: CollectionOptions = {};
  #connection: Mongster;

  constructor(connection: Mongster, collectionName: CN, schema: SC) {
    this.collectionName = collectionName;
    this.#schema = schema;
    this.#connection = connection;
  }

  /**
   * Insert a document to the collection.
   */
  async insertOne(
    input: OptionalUnlessRequiredId<T>,
    options?: InsertOneOptions,
  ): Promise<InsertOneResult<T>> {
    const db = this.#connection.getDb();
    const collection = db.collection<T>(this.collectionName, this.#collectionOpts);

    const parsedInput = this.#schema.parse(input) as OptionalUnlessRequiredId<T>;

    const result = await collection.insertOne(parsedInput, options);
    return result;
  }

  /**
   * Insert a document to the collection. Returns the created document.
   */
  async create(input: OptionalUnlessRequiredId<T>, options?: InsertOneOptions): Promise<OT | null> {
    const db = this.#connection.getDb();
    const collection = db.collection<T>(this.collectionName, this.#collectionOpts);

    const parsedInput = this.#schema.parse(input) as OptionalUnlessRequiredId<T>;

    const result = await collection.insertOne(parsedInput, options);
    const _id = input._id ?? result.insertedId;

    const doc = await collection.findOne<OT>({ _id });
    return doc;
  }

  async count(filter?: Filter<T>, options?: CountDocumentsOptions & Abortable) {
    const db = this.#connection.getDb();
    const collection = db.collection<T>(this.collectionName, this.#collectionOpts);

    const docCount = await collection.countDocuments(filter, options);
    return docCount;
  }

  find(filter: Filter<T>, options?: FindOptions & Abortable): Query<T, OT> {
    const db = this.#connection.getDb();
    const collection = db.collection<T>(this.collectionName, this.#collectionOpts);

    const cursor = collection.find<OT>(filter, options);
    return new Query<T, OT>(cursor);
  }

  async updateOneRaw(
    match: Filter<any>,
    updateData: any,
    options?: UpdateOptions & { sort?: Sort },
  ) {
    const db = this.#connection.getDb();
    const collection = db.collection<T>(this.collectionName, this.#collectionOpts);
    const result = await collection.updateOne(match, updateData, options);
    return result;
  }

  async updateOne(
    match: Filter<T>,
    updateData: UpdateFilter<T>,
    options?: UpdateOptions & { sort?: Sort },
  ) {
    const result = await this.updateOneRaw(match, updateData, options);
    return result;
  }
}

export { MongsterCollection as MongsterModel };
