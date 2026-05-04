import { MongsterClient } from "./client";
import { MongsterSchemaBuilder } from "./schema";
import type { MongsterSchemaBase } from "./schema/base";
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

export const M = new MongsterSchemaBuilder();
export const defineSchema = M.schema;

export namespace M {
  export type infer<MS extends MongsterSchemaBase<any>> = InferSchemaType<MS>;
  export type inferInput<MS extends MongsterSchemaBase<any>> = InferSchemaInputType<MS>;
}

export const mongster = new MongsterClient();

export { AggregateQuery } from "./queries/AggregateQuery";
export { MongsterClient };

export function model<CN extends string, SC extends MongsterSchema<any, any, any>>(
  name: CN,
  schema: SC,
) {
  return mongster.model<CN, SC>(name, schema);
}
