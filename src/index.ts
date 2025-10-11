import { MongsterClient } from "./client";
import { MongsterSchemaBuilder } from "./schema";
import type { MongsterSchema, MongsterSchemaBase } from "./schema/base";
import type { InferSchemaInputType, InferSchemaType } from "./types/types.schema";

export { MError } from "./error";

export const M = new MongsterSchemaBuilder();
export const defineSchema = M.schema;

export namespace M {
  export type infer<MS extends MongsterSchemaBase<any>> = InferSchemaType<MS>;
  export type inferInput<MS extends MongsterSchemaBase<any>> = InferSchemaInputType<MS>;
}

export const mongster = new MongsterClient();

export function model<CN extends string, SC extends MongsterSchema<any, any>>(
  name: CN,
  schema: SC,
) {
  return mongster.model<CN, SC>(name, schema);
}
