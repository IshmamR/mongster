import { Mongster } from "./mongster";
import { MongsterSchemaBuilder } from "./schema";
import type { MongsterSchema } from "./schema/base";

export { Mongster } from "./mongster";

export const M = new MongsterSchemaBuilder();
export const defineSchema = M.schema;

export const mongster = new Mongster();

export function collection<CN extends string, SC extends MongsterSchema<any, any>>(
  name: CN,
  schema: SC,
) {
  return mongster.collection<CN, SC>(name, schema);
}
