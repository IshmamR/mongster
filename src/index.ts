import { MongsterClient } from "./client";
import type { MongsterModel } from "./collection";
import { MongsterSchemaBuilder } from "./schema";
import type { MongsterSchemaBase, MongsterSchemaInternal } from "./schema/base";
import type { MongsterSchema } from "./schema/schema";
import type { InferSchemaInputType, InferSchemaType } from "./types/types.schema";

export type { MongsterErrorCode, MongsterIssue } from "./error";
export {
  ConnectionError,
  IndexSyncError,
  MongsterError,
  QueryError,
  SchemaError,
  TransactionError,
  ValidationError,
} from "./error";

export const M: MongsterSchemaBuilder = new MongsterSchemaBuilder();
export function defineSchema<T extends Record<string, MongsterSchemaInternal<any>>>(
  shape: T,
): MongsterSchema<T> {
  return M.schema(shape);
}

export namespace M {
  export type infer<MS extends MongsterSchemaBase<any>> = InferSchemaType<MS>;
  export type inferInput<MS extends MongsterSchemaBase<any>> = InferSchemaInputType<MS>;
}

export const mongster: MongsterClient = new MongsterClient();

export { AggregateQuery } from "./queries/AggregateQuery";
export { MongsterClient };

export function model<CN extends string, SC extends MongsterSchema<any, any, any>>(
  name: CN,
  schema: SC,
): MongsterModel<CN, SC> {
  return mongster.model<CN, SC>(name, schema);
}
