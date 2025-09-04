import type { Abortable, Collection, Filter, FindOptions as FOpts, WithId } from "mongodb";
import type { InferSchemaType, SchemaDefinition } from "../../schema";
import { Query } from "./Query";

export type FindOptions = FOpts & Abortable;

export default function findDocuments<Def extends SchemaDefinition, T extends InferSchemaType<Def>>(
  filter: Filter<T>,
  _schema: Def,
  collection: Collection<T>,
  fOpts?: FindOptions,
) {
  return new Query<WithId<T>>(collection.find(filter, fOpts));
}
