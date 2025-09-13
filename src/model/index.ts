import type { CollectionOptions, Filter, WithId } from "mongodb";
import { getDb } from "../connection";
import findDocuments, { type FindOptions } from "../queries/find";
import type { Query } from "../queries/find/Query";
import findSingleDocument, { type FindOneOptions } from "../queries/findOne";
import type { InferSchemaType, SchemaDefinition } from "../schema/old";

interface Model<T> {
  find: (filter: Filter<T>, opts?: FindOptions) => Query<WithId<T>>;
  findOne: (filter: Filter<T>, opts?: FindOneOptions) => Promise<WithId<T> | null>;
}

export function createModel<Def extends SchemaDefinition>(
  collectionName: string,
  schema: Def,
  collectionOptions?: CollectionOptions,
): Model<InferSchemaType<Def>> {
  const db = getDb();
  type TDoc = InferSchemaType<Def>;
  const collection = db.collection<TDoc>(collectionName, collectionOptions);

  return {
    find: (filter: Filter<TDoc>, opts?: FindOptions) =>
      findDocuments(filter, schema, collection, opts),
    findOne: (filter: Filter<TDoc>, opts?: FindOneOptions) =>
      findSingleDocument(filter, schema, collection, opts),
    // ... more methods
  };
}
