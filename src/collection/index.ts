import type {
  CollectionOptions,
  Document,
  Filter,
  InsertOneOptions,
  OptionalUnlessRequiredId,
  Sort,
  UpdateFilter,
  UpdateOptions,
} from "mongodb";
import { getDb } from "../connection";
import type { MongsterSchema } from "../schema/base";
import type { InferSchemaInputType } from "../types/types.schema";

export class MongsterCollection<
  CN extends string,
  SC extends MongsterSchema<any>,
  T extends Document = InferSchemaInputType<SC>,
> {
  declare $type: T;

  collectionName: CN;
  #schema: SC;
  #collectionOpts: CollectionOptions = {};

  constructor(collectionName: CN, schema: SC) {
    this.collectionName = collectionName;
    this.#schema = schema;
  }

  async insertOne(input: OptionalUnlessRequiredId<T>, options?: InsertOneOptions) {
    this.#schema.parse(input);

    const db = getDb();
    const collection = db.collection<T>(this.collectionName, this.#collectionOpts);
    const result = await collection.insertOne(input, options);
    return result;
  }

  async updateOneRaw(
    match: Filter<any>,
    updateData: any,
    options?: UpdateOptions & { sort?: Sort },
  ) {
    const db = getDb();
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
