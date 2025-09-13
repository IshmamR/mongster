import type { Abortable, Collection, Filter, FindOneOptions as FOneOpts, WithId } from "mongodb";
import type { InferSchemaType, SchemaDefinition } from "../../schema/old";

export type FindOneOptions = Omit<FOneOpts, "timeoutMode"> & Abortable;

export default function findSingleDocument<
  Def extends SchemaDefinition,
  T extends InferSchemaType<Def>,
>(filter: Filter<T>, _schema: Def, collection: Collection<T>, fOpts?: FindOneOptions) {
  return collection.findOne(filter, fOpts) as Promise<WithId<T> | null>;
}
