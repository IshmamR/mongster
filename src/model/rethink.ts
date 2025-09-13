/** biome-ignore-all lint/suspicious/noExplicitAny: needed for inference */

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
import type { InferSchemaType, MongsterSchema } from "../schema/rethink";

class MongsterModel<
  CN extends string,
  SC extends MongsterSchema<any>,
  T extends Document = InferSchemaType<SC>,
> {
  declare _type: T;

  collectionName: CN;
  #schema: SC;
  #collectionOpts: CollectionOptions = {};

  constructor(collectionName: CN, schema: SC) {
    this.collectionName = collectionName;
    this.#schema = schema;

    // might compile and create the model here
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

export default MongsterModel;
